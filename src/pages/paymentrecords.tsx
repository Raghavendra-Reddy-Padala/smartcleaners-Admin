import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, IndianRupee, CheckCircle2, Clock, AlertCircle, CreditCard, Banknote, Smartphone, Edit2, History, Package, ShoppingBag } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, doc, updateDoc, onSnapshot, query, orderBy, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loading } from '@/components/ui/loading';

// ── Types ──────────────────────────────────────────────────────────────────

interface PaymentEntry {
  amount: number;
  mode: string;
  type: string;
  note: string;   // always string, never undefined — Firestore rejects undefined values
  paidAt: string;
}

interface OrderItem {
  productId?: string;
  quantity: number;
  unitPrice: number;
  finalUnitPrice: number;
  lineTotal: number;
  bulkDiscountPerUnit?: number;
  productDetails?: {
    name: string;
    description?: string;
    dimensions?: string;
    images?: string[];
    sku?: string;
    weight?: string;
  };
}

interface Order {
  id: string;
  orderId: string;
  customer: {
    name: string;
    phone: string;
    address?: { fullAddress?: string };
  };
  items?: OrderItem[];
  paymentMethod: string;
  paymentStatus?: string;
  paymentrecord?: string;
  paymentHistory?: PaymentEntry[];
  amountPaid?: number;
  pricing: {
    finalTotal: number;
    subtotal?: number;
    shippingCost?: number;
    bulkDiscountTotal?: number;
    itemCount?: number;
  };
  status: string;
  createdAt: any;
}

const PAYMENT_MODES = [
  { value: 'upi',  label: 'UPI',          icon: <Smartphone className="h-4 w-4" /> },
  { value: 'bank', label: 'Bank Transfer', icon: <CreditCard className="h-4 w-4" /> },
  { value: 'cash', label: 'Cash',          icon: <Banknote className="h-4 w-4" /> },
  { value: 'card', label: 'Card',          icon: <CreditCard className="h-4 w-4" /> },
];

// ── Helpers ────────────────────────────────────────────────────────────────

const recordColor = (r: string) => {
  if (r === 'paid')    return 'bg-green-100 text-green-800 border-green-200';
  if (r === 'partial') return 'bg-orange-100 text-orange-800 border-orange-200';
  return 'bg-red-100 text-red-800 border-red-200';
};

const modeIcon = (mode: string) => {
  const m = PAYMENT_MODES.find(p => p.value === mode);
  return m ? m.icon : <IndianRupee className="h-4 w-4" />;
};

// ── Component ──────────────────────────────────────────────────────────────

export const PaymentRecords: React.FC = () => {
  const [orders, setOrders]               = useState<Order[]>([]);
  const [loading, setLoading]             = useState(true);
  const [searchTerm, setSearchTerm]       = useState('');
  const [recordFilter, setRecordFilter]   = useState('all');

  const [payDialog, setPayDialog]         = useState<{ open: boolean; order: Order | null }>({ open: false, order: null });
  const [payType, setPayType]             = useState<'full' | 'partial'>('full');
  const [payMode, setPayMode]             = useState('cash');
  const [partialAmount, setPartialAmount] = useState('');
  const [payNote, setPayNote]             = useState('');
  const [saving, setSaving]               = useState(false);

  const [histDialog, setHistDialog]       = useState<{ open: boolean; order: Order | null }>({ open: false, order: null });
  const [itemsDialog, setItemsDialog]     = useState<{ open: boolean; order: Order | null }>({ open: false, order: null });

  const { toast } = useToast();

  // ── Firestore listener ────────────────────────────────────────────────

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      snap => {
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
        setLoading(false);
      },
      err => {
        console.error('Firestore onSnapshot error:', err);
        setLoading(false);
        toast({ title: 'Could not load orders', description: err.message, variant: 'destructive' });
      }
    );
    return () => unsub();
  }, []);

  // ── Derived helpers ───────────────────────────────────────────────────

  const getRecord    = (o: Order) => o.paymentrecord ?? 'unpaid';
  const getPaid      = (o: Order) => o.amountPaid ?? 0;
  const getRemaining = (o: Order) => Math.max(0, (o.pricing?.finalTotal ?? 0) - getPaid(o));

  // ── Save payment ──────────────────────────────────────────────────────

  const handleSavePayment = async () => {
    if (!payDialog.order) return;

    const order     = payDialog.order;
    const total     = order.pricing?.finalTotal ?? 0;
    const prevPaid  = getPaid(order);
    const remaining = total - prevPaid;

    let addedAmount = 0;
    if (payType === 'full') {
      addedAmount = remaining;
    } else {
      const v = parseFloat(partialAmount);
      if (!partialAmount || isNaN(v) || v <= 0) {
        toast({ title: 'Enter a valid amount', variant: 'destructive' });
        return;
      }
      if (v > remaining) {
        toast({ title: 'Amount exceeds remaining balance', variant: 'destructive' });
        return;
      }
      addedAmount = v;
    }

    if (addedAmount <= 0) {
      toast({ title: 'Nothing to pay', description: 'Order is already fully paid', variant: 'destructive' });
      return;
    }

    const newPaid   = prevPaid + addedAmount;
    const newRecord = newPaid >= total ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';

    // IMPORTANT: No undefined values — Firestore will reject them
    const entry: PaymentEntry = {
      amount: addedAmount,
      mode:   payMode,
      type:   payType,
      note:   payNote.trim(),   // empty string, never undefined
      paidAt: new Date().toISOString(),
    };

    setSaving(true);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        paymentrecord:  newRecord,
        paymentStatus:  newRecord === 'paid' ? 'paid' : 'pending',
        amountPaid:     newPaid,
        paymentHistory: arrayUnion(entry),  // safe concurrent append
        updatedAt:      new Date(),
      });

      toast({
        title: '✅ Payment recorded',
        description: `₹${addedAmount.toLocaleString()} via ${payMode} — order is now ${newRecord}`,
      });

      setPayDialog({ open: false, order: null });
      setPartialAmount('');
      setPayNote('');
      setPayType('full');
      setPayMode('cash');
    } catch (err: any) {
      // Log actual Firestore error for debugging
      console.error('handleSavePayment Firestore error:', err?.code, err?.message, err);
      toast({
        title: 'Failed to save payment',
        description: `${err?.code ?? ''}: ${err?.message ?? 'Unknown error — check browser console'}`,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Reset to unpaid ───────────────────────────────────────────────────

  const handleMarkUnpaid = async (order: Order) => {
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        paymentrecord:  'unpaid',
        paymentStatus:  'pending',
        amountPaid:     0,
        paymentHistory: [],
        updatedAt:      new Date(),
      });
      toast({ title: 'Reset to unpaid' });
    } catch (err: any) {
      console.error('handleMarkUnpaid error:', err);
      toast({ title: 'Error', description: err?.message, variant: 'destructive' });
    }
  };

  const openPayDialog = (order: Order) => {
    setPayDialog({ open: true, order });
    setPayType('full');
    setPayMode('cash');
    setPartialAmount('');
    setPayNote('');
  };

  // ── Filter + stats ────────────────────────────────────────────────────

  const filtered = orders.filter(o => {
    const s = searchTerm.toLowerCase();
    const matchSearch =
      o.orderId?.toLowerCase().includes(s) ||
      o.customer?.name?.toLowerCase().includes(s) ||
      o.customer?.phone?.includes(s);
    const matchFilter = recordFilter === 'all' || getRecord(o) === recordFilter;
    return matchSearch && matchFilter;
  });

  const totalRevenue   = orders.reduce((s, o) => s + (o.pricing?.finalTotal ?? 0), 0);
  const totalCollected = orders.reduce((s, o) => s + getPaid(o), 0);
  const totalPending   = totalRevenue - totalCollected;
  const paidCount      = orders.filter(o => getRecord(o) === 'paid').length;
  const partialCount   = orders.filter(o => getRecord(o) === 'partial').length;
  const unpaidCount    = orders.filter(o => getRecord(o) === 'unpaid').length;

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Payment Records</h1>
        <Loading size="lg" className="py-20" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Payment Records</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Select value={recordFilter} onValueChange={setRecordFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString()}`,   color: '' },
          { label: 'Collected',     value: `₹${totalCollected.toLocaleString()}`, color: 'text-green-600' },
          { label: 'Pending',       value: `₹${totalPending.toLocaleString()}`,   color: 'text-red-600' },
          { label: 'Paid Orders',   value: paidCount,                              color: 'text-green-600' },
          { label: 'Partial',       value: partialCount,                           color: 'text-orange-600' },
          { label: 'Unpaid',        value: unpaidCount,                            color: 'text-red-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Order Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Pay Method</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(order => {
                const rec       = getRecord(order);
                const paid      = getPaid(order);
                const remaining = getRemaining(order);
                const total     = order.pricing?.finalTotal ?? 0;

                return (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setItemsDialog({ open: true, order })}
                  >

                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="font-medium">{order.customer?.name}</div>
                      <div className="text-xs text-muted-foreground">{order.customer?.phone}</div>
                    </TableCell>

                    {/* Stacked avatar images */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <div className="flex -space-x-2">
                          {(order.items ?? []).slice(0, 3).map((item, i) => (
                            <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 overflow-hidden shadow-sm">
                              {item.productDetails?.images?.[0] ? (
                                <img
                                  src={item.productDetails.images[0]}
                                  alt={item.productDetails?.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="h-3 w-3 text-gray-400" />
                                </div>
                              )}
                            </div>
                          ))}
                          {(order.items?.length ?? 0) > 3 && (
                            <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 shadow-sm">
                              +{(order.items?.length ?? 0) - 3}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {order.items?.length ?? 0}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="font-semibold">₹{total.toLocaleString()}</TableCell>

                    <TableCell>
                      <span className={paid > 0 ? 'text-green-700 font-semibold' : 'text-muted-foreground'}>
                        ₹{paid.toLocaleString()}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className={remaining > 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                        ₹{remaining.toLocaleString()}
                      </span>
                    </TableCell>

                    <TableCell>
                      <Badge className={`${recordColor(rec)} border text-xs`}>
                        {rec === 'paid'    && <CheckCircle2 className="h-3 w-3 mr-1 inline" />}
                        {rec === 'partial' && <AlertCircle  className="h-3 w-3 mr-1 inline" />}
                        {rec === 'unpaid'  && <Clock        className="h-3 w-3 mr-1 inline" />}
                        {rec === 'paid' ? 'Paid' : rec === 'partial' ? 'Partial' : 'Unpaid'}
                      </Badge>
                      {rec === 'partial' && total > 0 && (
                        <div className="mt-1 w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500 rounded-full"
                            style={{ width: `${Math.min(100, (paid / total) * 100)}%` }}
                          />
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs">
                        {order.paymentMethod?.replace(/_/g, ' ') ?? 'N/A'}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">
                      {order.createdAt?.toDate
                        ? order.createdAt.toDate().toLocaleDateString('en-IN')
                        : 'N/A'}
                    </TableCell>

                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        {rec !== 'paid' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPayDialog(order)}
                            className="text-green-700 border-green-300 hover:bg-green-50 h-8 px-2"
                          >
                            <Edit2 className="h-3.5 w-3.5 mr-1" />
                            Pay
                          </Button>
                        )}
                        {rec === 'paid' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkUnpaid(order)}
                            className="text-red-600 border-red-300 hover:bg-red-50 h-8 px-2 text-xs"
                          >
                            Reset
                          </Button>
                        )}
                        {(order.paymentHistory ?? []).length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setHistDialog({ open: true, order })}
                            className="h-8 w-8 p-0"
                            title="Payment history"
                          >
                            <History className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <IndianRupee className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">No payment records found</h3>
          <p className="text-muted-foreground">
            {searchTerm || recordFilter !== 'all' ? 'Try adjusting your filters' : 'Orders will appear here once placed'}
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Items Preview Modal — click any row to open
      ══════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={itemsDialog.open}
        onOpenChange={open => !open && setItemsDialog({ open: false, order: null })}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              {itemsDialog.order?.orderId} — Ordered Items
            </DialogTitle>
          </DialogHeader>

          {itemsDialog.order && (
            <div className="space-y-4 pt-1">

              {/* Customer + payment pill */}
              <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3 text-sm">
                <div>
                  <div className="font-semibold">{itemsDialog.order.customer?.name}</div>
                  <div className="text-muted-foreground text-xs">{itemsDialog.order.customer?.phone}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-base">₹{(itemsDialog.order.pricing?.finalTotal ?? 0).toLocaleString()}</div>
                  <Badge className={`${recordColor(getRecord(itemsDialog.order))} border text-xs mt-1`}>
                    {getRecord(itemsDialog.order) === 'paid' ? '✓ Paid' : getRecord(itemsDialog.order) === 'partial' ? '~ Partial' : '✗ Unpaid'}
                  </Badge>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                {(itemsDialog.order.items ?? []).length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-6">No items found for this order.</p>
                )}
                {(itemsDialog.order.items ?? []).map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 border rounded-xl bg-white hover:bg-gray-50 transition-colors">
                    {/* Image */}
                    <div className="w-16 h-16 rounded-lg overflow-hidden border bg-gray-50 flex-shrink-0">
                      {item.productDetails?.images?.[0] ? (
                        <img
                          src={item.productDetails.images[0]}
                          alt={item.productDetails?.name ?? 'Product'}
                          className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-6 w-6 text-gray-300" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {item.productDetails?.name ?? 'Unknown Product'}
                      </div>
                      {item.productDetails?.sku && (
                        <div className="text-xs text-muted-foreground">SKU: {item.productDetails.sku}</div>
                      )}
                      {item.productDetails?.dimensions && (
                        <div className="text-xs text-muted-foreground">{item.productDetails.dimensions}</div>
                      )}
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Qty {item.quantity} × ₹{(item.finalUnitPrice ?? item.unitPrice ?? 0).toLocaleString()}
                      </div>
                    </div>

                    {/* Line total */}
                    <div className="text-right flex-shrink-0">
                      <div className="font-semibold text-sm">₹{(item.lineTotal ?? 0).toLocaleString()}</div>
                      {(item.bulkDiscountPerUnit ?? 0) > 0 && (
                        <div className="text-xs text-green-600">-₹{item.bulkDiscountPerUnit} off</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pricing breakdown */}
              <div className="border-t pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>₹{(itemsDialog.order.pricing?.subtotal ?? 0).toLocaleString()}</span>
                </div>
                {(itemsDialog.order.pricing?.bulkDiscountTotal ?? 0) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Bulk Discount</span>
                    <span>-₹{itemsDialog.order.pricing!.bulkDiscountTotal!.toLocaleString()}</span>
                  </div>
                )}
                {(itemsDialog.order.pricing?.shippingCost ?? 0) > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Shipping</span>
                    <span>₹{itemsDialog.order.pricing!.shippingCost!.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-1.5 border-t">
                  <span>Total</span>
                  <span>₹{(itemsDialog.order.pricing?.finalTotal ?? 0).toLocaleString()}</span>
                </div>
                {getPaid(itemsDialog.order) > 0 && (
                  <>
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>Paid</span>
                      <span>- ₹{getPaid(itemsDialog.order).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-red-600 font-semibold">
                      <span>Still Remaining</span>
                      <span>₹{getRemaining(itemsDialog.order).toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Quick pay CTA */}
              {getRecord(itemsDialog.order) !== 'paid' && (
                <Button
                  className="w-full"
                  onClick={() => {
                    const o = itemsDialog.order!;
                    setItemsDialog({ open: false, order: null });
                    openPayDialog(o);
                  }}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Record Payment — ₹{getRemaining(itemsDialog.order).toLocaleString()} due
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════
          Record Payment Dialog
      ══════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={payDialog.open}
        onOpenChange={open => !open && setPayDialog({ open: false, order: null })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>

          {payDialog.order && (() => {
            const o         = payDialog.order;
            const total     = o.pricing?.finalTotal ?? 0;
            const paid      = getPaid(o);
            const remaining = total - paid;

            return (
              <div className="space-y-5 py-2">
                {/* Summary */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order:</span>
                    <span className="font-mono font-medium">{o.orderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="font-medium">{o.customer?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order Total:</span>
                    <span className="font-semibold">₹{total.toLocaleString()}</span>
                  </div>
                  {paid > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Already Paid:</span>
                      <span className="font-semibold">₹{paid.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-red-600 font-bold border-t pt-1.5 mt-1.5">
                    <span>Remaining:</span>
                    <span>₹{remaining.toLocaleString()}</span>
                  </div>
                </div>

                {/* Type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Payment Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['full', 'partial'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setPayType(t)}
                        className={`py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                          payType === t
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {t === 'full' ? `Full — ₹${remaining.toLocaleString()}` : 'Partial'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Partial amount */}
                {payType === 'partial' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Amount Paying Now</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                      <Input
                        className="pl-7"
                        placeholder={`Max ₹${remaining.toLocaleString()}`}
                        value={partialAmount}
                        onChange={e => setPartialAmount(e.target.value)}
                        type="number"
                        min={1}
                        max={remaining}
                      />
                    </div>
                    {partialAmount && !isNaN(parseFloat(partialAmount)) && (
                      <p className="text-xs text-orange-600">
                        Remaining after this: ₹{Math.max(0, remaining - parseFloat(partialAmount)).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Mode */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mode of Payment</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_MODES.map(m => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setPayMode(m.value)}
                        className={`flex items-center gap-2 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                          payMode === m.value
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {m.icon}{m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Note */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Note (optional)</label>
                  <Input
                    placeholder="e.g. UPI ref: 123456789"
                    value={payNote}
                    onChange={e => setPayNote(e.target.value)}
                  />
                </div>

                <Button className="w-full" onClick={handleSavePayment} disabled={saving}>
                  {saving ? 'Saving...' : 'Confirm Payment'}
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════
          Payment History Dialog
      ══════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={histDialog.open}
        onOpenChange={open => !open && setHistDialog({ open: false, order: null })}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment History — {histDialog.order?.orderId}</DialogTitle>
          </DialogHeader>
          {histDialog.order && (
            <div className="space-y-3 py-2">
              {(histDialog.order.paymentHistory ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">No payment history yet.</p>
              ) : (
                <div className="space-y-2">
                  {[...(histDialog.order.paymentHistory ?? [])].reverse().map((entry, i) => (
                    <div key={i} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg border text-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-md border">{modeIcon(entry.mode)}</div>
                        <div>
                          <div className="font-medium capitalize">{entry.mode} · {entry.type === 'full' ? 'Full' : 'Partial'}</div>
                          {entry.note && <div className="text-xs text-muted-foreground mt-0.5">{entry.note}</div>}
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {new Date(entry.paidAt).toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                      <div className="font-bold text-green-600 whitespace-nowrap">+₹{entry.amount.toLocaleString()}</div>
                    </div>
                  ))}
                  <div className="pt-2 border-t flex justify-between text-sm font-medium">
                    <span>Total Collected</span>
                    <span className="text-green-600">
                      ₹{getPaid(histDialog.order).toLocaleString()} / ₹{(histDialog.order.pricing?.finalTotal ?? 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};