import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Package, Truck, Search, Trash2, FileText, Send, MapPin, Copy, Bell, Download } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { db } from '@/lib/firebase';
import { collection, doc, updateDoc, onSnapshot, query, orderBy, deleteDoc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loading } from '@/components/ui/loading';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  finalUnitPrice: number;
  lineTotal: number;
  bulkDiscountApplied?: any;
  bulkDiscountPerUnit: number;
  productDetails: {
    name: string;
    description: string;
    dimensions: string;
    images: string[];
    ingredients: string;
    instructions: string;
    originalPrice: number;
    salePrice: number;
    sku: string;
    weight: string;
    categoryId: string;
  };
}

interface Order {
  id: string;
  orderId: string;
  customer: {
    name: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      pincode: string;
      fullAddress: string;
    };
  };
  items: OrderItem[];
  paymentMethod: string;
  pricing: {
    subtotal: number;
    shippingCost: number;
    finalTotal: number;
    itemCount: number;
    bulkDiscountTotal: number;
  };
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  flags?: {
    isNewCustomer: boolean;
    priority: string;
    requiresVerification: boolean;
  };
  trackingNumber?: string;
  createdAt: any;
  updatedAt?: any;
}

export const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newOrderDialog, setNewOrderDialog] = useState<{ isOpen: boolean; order: Order | null; audio: HTMLAudioElement | null }>({
    isOpen: false,
    order: null,
    audio: null
  });
  const [gstDialog, setGstDialog] = useState<{ isOpen: boolean; order: Order | null; isGstEnabled: boolean; gstPercentage: string }>({
    isOpen: false,
    order: null,
    isGstEnabled: false,
    gstPercentage: '18'
  });
  const { toast } = useToast();

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];

      // Play notification sound for new orders
      if (!loading && ordersData.length > orders.length) {
        const audio = new Audio('/order.mp3');
        audio.loop = true;
        audio.play().catch(error => {
          console.log('Audio play failed:', error);
        });

        setNewOrderDialog({
          isOpen: true,
          order: ordersData[0],
          audio: audio
        });
      }

      setOrders(ordersData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [orders.length, loading]);

  const handleAcceptOrder = () => {
    if (newOrderDialog.audio) {
      newOrderDialog.audio.pause();
      newOrderDialog.audio.currentTime = 0;
    }
    setNewOrderDialog({ isOpen: false, order: null, audio: null });
  };

  const exportReconciliationReport = () => {
    const data: any[] = [];
    data.push(['Smart Cleaners Orders Report']);
    data.push([]);
    data.push([
      'Order ID', 'Order Creation Date', 'Order Status', 'Product Code/SKU', 'Quantity',
      'Customer Name', 'Mobile', 'Address', 'Pincode', 'City', 'State',
      'Payment Method', 'Unit Price', 'Delivery Fees', 'Tax', 'Invoice Total',
      'Weight (kg)', 'Dimensions (cm)', 'AWB Tracking', 'Discount/Coupon Applied'
    ]);

    orders.forEach(order => {
      const orderDate = order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-IN') : '';
      const items = order.items || [];

      items.forEach((item: any) => {
        data.push([
          order.orderId || '',
          orderDate,
          order.status?.toUpperCase() || '',
          item.productDetails?.sku || item.productId || '',
          item.quantity || 1,
          order.customer?.name || '',
          order.customer?.phone || '',
          order.customer?.address?.fullAddress || '',
          order.customer?.address?.pincode || '',
          order.customer?.address?.city || '',
          order.customer?.address?.state || '',
          order.paymentMethod?.replace('_', ' ')?.toUpperCase() || '',
          item.unitPrice || 0,
          order.pricing?.shippingCost || 0,
          order.pricing?.tax || 0, // Tax
          order.pricing?.finalTotal || 0,
          item.productDetails?.weight || '',
          item.productDetails?.dimensions || '',
          order.trackingNumber || '',
          item.bulkDiscountPerUnit > 0 ? (item.bulkDiscountPerUnit * item.quantity) : 0
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reconciliation Report');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Smartcleaners_orders_Report${new Date().getTime()}.xlsx`);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      processing: 'bg-purple-100 text-purple-800',
      shipped: 'bg-orange-100 text-orange-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPaymentStatusColor = (paymentMethod: string) => {
    const colors: Record<string, string> = {
      cash_on_delivery: 'bg-yellow-100 text-yellow-800',
      online: 'bg-green-100 text-green-800',
      card: 'bg-blue-100 text-blue-800'
    };
    return colors[paymentMethod] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-orange-100 text-orange-800',
      normal: 'bg-green-100 text-green-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: new Date()
      });
      toast({
        title: "Order updated",
        description: `Order status changed to ${newStatus}`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive"
      });
    }
  };

  const updateTrackingNumber = async (orderId: string) => {
    if (!trackingNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter a tracking number",
        variant: "destructive"
      });
      return;
    }
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        trackingNumber: trackingNumber,
        status: 'shipped',
        updatedAt: new Date()
      });
      toast({
        title: "Tracking updated",
        description: "Tracking number added and order marked as shipped"
      });
      setTrackingNumber('');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update tracking number",
        variant: "destructive"
      });
    }
  };

  const generateGoogleMapsLink = (address: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const generateBillPDF = (order: Order, gstPercentage: number = 0) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: "Error",
        description: "Please allow popups to generate bill",
        variant: "destructive"
      });
      return;
    }

    const finalTotalBeforeGst = order.pricing?.finalTotal || 0;
    const gstAmount = gstPercentage > 0 ? (finalTotalBeforeGst * gstPercentage) / 100 : 0;
    const finalTotalWithGst = finalTotalBeforeGst + gstAmount;

    const billHTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice - ${order.orderId}</title>
<style>
  @page { margin: 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    color: #222;
    background: #fff;
    padding: 40px;
    font-size: 13px;
    line-height: 1.5;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .inv { max-width: 780px; margin: 0 auto; }

  /* ── HEADER ── */
  .hdr { display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 2px solid #2563eb; margin-bottom: 24px; }
  .hdr-left { display: flex; align-items: center; gap: 14px; }
  .hdr-logo { height: 56px; width: auto; object-fit: contain; }
  .hdr-co { font-size: 22px; font-weight: 700; color: #2563eb; }
  .hdr-addr { font-size: 11px; color: #555; margin-top: 4px; line-height: 1.5; }
  .hdr-right { text-align: right; }
  .hdr-inv { font-size: 28px; font-weight: 800; color: #2563eb; letter-spacing: 2px; }
  .hdr-id { font-size: 12px; color: #555; margin-top: 4px; }

  /* ── INFO ROW ── */
  .info-row { display: flex; gap: 20px; margin-bottom: 22px; }
  .info-box { flex: 1; border: 1px solid #ddd; border-radius: 6px; padding: 14px 16px; }
  .info-box h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #2563eb; font-weight: 700; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
  .info-line { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
  .info-line .lbl { color: #777; }
  .info-line .val { font-weight: 600; color: #222; }

  /* ── BILL TO ── */
  .bill-to { border: 1px solid #ddd; border-left: 3px solid #2563eb; border-radius: 6px; padding: 14px 16px; margin-bottom: 22px; }
  .bill-to h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #2563eb; font-weight: 700; margin-bottom: 8px; }
  .bill-to .name { font-size: 15px; font-weight: 700; color: #1a1a1a; }
  .bill-to .addr { font-size: 12px; color: #555; margin-top: 4px; line-height: 1.6; }
  .new-badge { display: inline-block; margin-top: 6px; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; border: 1px solid #2563eb; color: #2563eb; }

  /* ── TABLE ── */
  table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  thead th {
    background: transparent;
    border-top: 2px solid #2563eb;
    border-bottom: 2px solid #2563eb;
    padding: 10px 12px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #111;
    text-align: left;
  }
  thead th.r { text-align: right; }
  tbody td {
    padding: 10px 12px;
    font-size: 12px;
    color: #333;
    border-bottom: 1px solid #eee;
    vertical-align: top;
  }
  tbody td.r { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr:last-child td { border-bottom: 2px solid #2563eb; }
  .td-name { font-weight: 600; color: #111; }
  .td-sub { font-size: 10px; color: #999; margin-top: 1px; }

  /* ── TOTALS ── */
  .totals-wrap { display: flex; justify-content: flex-end; margin-top: 16px; margin-bottom: 24px; }
  .totals { width: 320px; }
  .tot-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #444; }
  .tot-row + .tot-row { border-top: 1px solid #f0f0f0; }
  .tot-row.disc { color: #16a34a; }
  .tot-row.gst-row { color: #7c3aed; }
  .tot-grand {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
    padding: 12px 14px;
    border: 2px solid #2563eb;
    border-radius: 6px;
    background: transparent;
  }
  .tot-grand .tot-lbl { font-size: 13px; font-weight: 700; color: #111; }
  .tot-grand .tot-val { font-size: 20px; font-weight: 800; color: #111; }

  /* ── TRACKING ── */
  .track { border: 1px solid #ddd; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px; }
  .track h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #16a34a; font-weight: 700; margin-bottom: 4px; }
  .track .num { font-size: 14px; font-weight: 700; color: #166534; letter-spacing: 1px; }

  /* ── FOOTER ── */
  .ftr { text-align: center; padding-top: 16px; border-top: 1px solid #ddd; color: #888; font-size: 11px; }
  .ftr strong { color: #2563eb; }

  /* ── ACTIONS ── */
  .actions { text-align: center; margin-top: 24px; }
  .actions button { padding: 10px 24px; border: none; border-radius: 5px; font-size: 13px; font-weight: 600; cursor: pointer; margin: 0 6px; }
  .btn-p { background: #2563eb; color: #fff; }
  .btn-c { background: #e5e7eb; color: #333; }
  @media print { .actions { display: none; } body { padding: 0; } }
</style>
</head>
<body>
<div class="inv">

  <div class="hdr">
    <div class="hdr-left">
      <img src="${window.location.origin}/logo.png" alt="Logo" class="hdr-logo">
      <div>
        <div class="hdr-co">Smart Cleaners</div>
        <div class="hdr-addr">Bapu Nagar, Chintal, Hyderabad - 500054<br>+91 90146 32639 | smartcleaner.shop@gmail.com</div>
      </div>
    </div>
    <div class="hdr-right">
      <div class="hdr-inv">INVOICE</div>
      <div class="hdr-id">${order.orderId}</div>
    </div>
  </div>

  <div class="info-row">
    <div class="info-box">
      <h4>Invoice Details</h4>
      <div class="info-line"><span class="lbl">Date</span><span class="val">${order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</span></div>
      <div class="info-line"><span class="lbl">Status</span><span class="val">${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span></div>
      <div class="info-line"><span class="lbl">Payment</span><span class="val">${order.paymentMethod.replace('_', ' ').toUpperCase()}</span></div>
      ${gstPercentage > 0 ? `<div class="info-line"><span class="lbl">GST</span><span class="val" style="color:#7c3aed">${gstPercentage}%</span></div>` : ''}
    </div>
    <div class="info-box">
      <h4>Bill To</h4>
      <div style="font-size:14px;font-weight:700;color:#111;margin-bottom:4px">${order.customer?.name}</div>
      <div style="font-size:11px;color:#555;line-height:1.6">${order.customer?.phone}<br>${order.customer?.address?.fullAddress}</div>
      ${order.flags?.isNewCustomer ? '<span class="new-badge">New Customer</span>' : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>SKU</th>
        <th class="r">Qty</th>
        <th class="r">Price</th>
        <th class="r">Disc.</th>
        <th class="r">Total</th>
      </tr>
    </thead>
    <tbody>
      ${order.items?.map(item => `<tr>
        <td><div class="td-name">${item.productDetails?.name}</div><div class="td-sub">${item.productDetails?.dimensions || ''}${item.productDetails?.weight ? ' | ' + item.productDetails.weight : ''}</div></td>
        <td>${item.productDetails?.sku || '-'}</td>
        <td class="r">${item.quantity}</td>
        <td class="r">\u20b9${item.unitPrice.toLocaleString('en-IN')}</td>
        <td class="r">${item.bulkDiscountPerUnit > 0 ? '<span style="color:#16a34a">-\u20b9' + item.bulkDiscountPerUnit.toLocaleString('en-IN') + '</span>' : '-'}</td>
        <td class="r" style="font-weight:600">\u20b9${item.lineTotal?.toLocaleString('en-IN')}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals">
      <div class="tot-row"><span>Subtotal (${order.pricing?.itemCount} items)</span><span>\u20b9${order.pricing?.subtotal?.toLocaleString('en-IN')}</span></div>
      ${order.pricing?.bulkDiscountTotal > 0 ? `<div class="tot-row disc"><span>Bulk Discount</span><span>-\u20b9${order.pricing.bulkDiscountTotal.toLocaleString('en-IN')}</span></div>` : ''}
      <div class="tot-row"><span>Shipping</span><span>\u20b9${order.pricing?.shippingCost?.toLocaleString('en-IN') || '0'}</span></div>
      ${gstPercentage > 0 ? `<div class="tot-row gst-row"><span>GST (${gstPercentage}%)</span><span>\u20b9${gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>` : ''}
      <div class="tot-grand">
        <span class="tot-lbl">Total Amount</span>
        <span class="tot-val">\u20b9${finalTotalWithGst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
      </div>
    </div>
  </div>

  ${order.trackingNumber ? `<div class="track"><h4>Shipping</h4><div class="num">${order.trackingNumber}</div></div>` : ''}

  <div class="ftr">
    <p><strong>Thank you for your business!</strong></p>
    <p style="margin-top:4px">Questions? smartcleaners.shop@gmail.com | +91 9014632639</p>
  </div>

  <div class="actions">
    <button class="btn-p" onclick="window.print()">Print / Save PDF</button>
    <button class="btn-c" onclick="window.close()">Close</button>
  </div>

</div>
</body>
</html>`;

    printWindow.document.write(billHTML);
    printWindow.document.close();
    toast({
      title: "Bill Generated",
      description: "Invoice opened. You can print or save as PDF."
    });
  };

  const sendBillToCustomer = (order: Order) => {
    const message = `Hello ${order.customer?.name},\n\nThank you for your order!\n\nOrder ID: ${order.orderId}\nTotal Amount: ₹${order.pricing?.finalTotal?.toLocaleString()}\nPayment: ${order.paymentMethod.replace('_', ' ')}\n\nYour invoice is ready. Click the link to view details.\n\nStatus: ${order.status}${order.trackingNumber ? `\nTracking: ${order.trackingNumber}` : ''}\n\nThank you!`;
    const whatsappNumber = order.customer?.phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/91${whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    toast({
      title: "WhatsApp Opened",
      description: "Send bill to customer via WhatsApp"
    });
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedOrderIds(checked ? filteredOrders.map(o => o.id) : []);
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    setSelectedOrderIds(prev => checked ? [...prev, orderId] : prev.filter(id => id !== orderId));
  };

  const deleteSelectedOrders = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedOrderIds.forEach(id => batch.delete(doc(db, 'orders', id)));
      await batch.commit();
      toast({
        title: "Orders deleted",
        description: `Successfully deleted ${selectedOrderIds.length} order(s)`
      });
      setSelectedOrderIds([]);
      setIsDeleteConfirmOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete orders",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteSingleOrder = async (orderId: string) => {
    try {
      await deleteDoc(doc(db, 'orders', orderId));
      toast({
        title: "Order deleted",
        description: "Order successfully deleted"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete order",
        variant: "destructive"
      });
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.phone.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Orders</h1>
        <Loading size="lg" className="py-20" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Orders</h1>
        <div className="flex items-center gap-4">
          {selectedOrderIds.length > 0 && (
            <Button variant="destructive" onClick={() => setIsDeleteConfirmOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected ({selectedOrderIds.length})
            </Button>
          )}
          <Button variant="outline" onClick={exportReconciliationReport} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search orders..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-64" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {orders.filter(o => o.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Shipped Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {orders.filter(o => o.status === 'shipped').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">New Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {orders.filter(o => o.flags?.isNewCustomer).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ₹{orders.reduce((sum, o) => sum + (o.pricing?.finalTotal || 0), 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox checked={filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length} onCheckedChange={handleSelectAll} />
                </TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Checkbox checked={selectedOrderIds.includes(order.id)} onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)} />
                  </TableCell>
                  <TableCell className="font-medium">{order.orderId}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{order.customer?.name}</div>
                      <div className="text-sm text-muted-foreground">{order.customer?.phone}</div>
                      {order.flags?.isNewCustomer && (
                        <Badge variant="outline" className="mt-1 text-xs">New Customer</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{order.items?.length || 0} items</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">₹{(order.pricing?.finalTotal || 0).toLocaleString()}</div>
                      {order.pricing?.bulkDiscountTotal > 0 && (
                        <div className="text-xs text-green-600">Discount: ₹{order.pricing.bulkDiscountTotal}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                      <Select value={order.status} onValueChange={(value) => updateOrderStatus(order.id, value)}>
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="shipped">Shipped</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getPaymentStatusColor(order.paymentMethod)}>
                      {order.paymentMethod.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getPriorityColor(order.flags?.priority || 'normal')}>
                      {order.flags?.priority || 'normal'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-IN') : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setSelectedOrder(order); setIsDetailsOpen(true); }} title="View Details">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setGstDialog({ isOpen: true, order, isGstEnabled: false, gstPercentage: '18' })} title="Generate PDF Bill">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => deleteSingleOrder(order.id)} title="Delete Order">
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filteredOrders.length === 0 && (
        <div className="text-center py-20">
          <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">No orders found</h3>
          <p className="text-muted-foreground">
            {searchTerm || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Orders will appear here when customers make purchases'}
          </p>
        </div>
      )}

      {/* New Order Notification Dialog */}
      <Dialog open={newOrderDialog.isOpen} onOpenChange={(open) => !open && handleAcceptOrder()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Bell className="h-6 w-6 text-green-600 animate-bounce" />
              New Order Received! 🎉
            </DialogTitle>
          </DialogHeader>
          {newOrderDialog.order && (
            <div className="space-y-4 py-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Order ID:</span>
                    <span className="text-sm font-bold">{newOrderDialog.order.orderId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Customer:</span>
                    <span className="text-sm font-bold">{newOrderDialog.order.customer?.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Phone:</span>
                    <span className="text-sm">{newOrderDialog.order.customer?.phone}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Amount:</span>
                    <span className="text-lg font-bold text-green-600">
                      ₹{newOrderDialog.order.pricing?.finalTotal?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Items:</span>
                    <span className="text-sm">{newOrderDialog.order.items?.length || 0} item(s)</span>
                  </div>
                </div>
              </div>
              <Button
                onClick={handleAcceptOrder}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6 text-lg"
              >
                Accept Order
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Are you sure you want to delete {selectedOrderIds.length} order(s)? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)} disabled={isDeleting}>Cancel</Button>
              <Button variant="destructive" onClick={deleteSelectedOrders} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete Orders'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={gstDialog.isOpen} onOpenChange={(isOpen) => setGstDialog(prev => ({ ...prev, isOpen }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="gst-enable"
                checked={gstDialog.isGstEnabled}
                onCheckedChange={(checked) => setGstDialog(prev => ({ ...prev, isGstEnabled: checked as boolean }))}
              />
              <label htmlFor="gst-enable" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Apply GST to this invoice
              </label>
            </div>
            {gstDialog.isGstEnabled && (
              <div className="space-y-2">
                <label className="text-sm font-medium">GST Percentage (%)</label>
                <Input
                  type="number"
                  value={gstDialog.gstPercentage}
                  onChange={(e) => setGstDialog(prev => ({ ...prev, gstPercentage: e.target.value }))}
                  placeholder="e.g. 18"
                  min="0"
                  max="100"
                />
              </div>
            )}
            <Button
              onClick={() => {
                if (gstDialog.order) {
                  generateBillPDF(gstDialog.order, gstDialog.isGstEnabled ? parseFloat(gstDialog.gstPercentage) || 0 : 0);
                  setGstDialog(prev => ({ ...prev, isOpen: false }));
                }
              }}
              className="w-full"
            >
              Generate PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details - {selectedOrder?.orderId}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Order Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge className={getStatusColor(selectedOrder.status)}>{selectedOrder.status}</Badge>
                    {selectedOrder.trackingNumber && (
                      <div className="mt-2">
                        <p className="text-sm text-muted-foreground">Tracking Number:</p>
                        <p className="font-medium">{selectedOrder.trackingNumber}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Payment Method</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge className={getPaymentStatusColor(selectedOrder.paymentMethod)}>
                      {selectedOrder.paymentMethod.replace('_', ' ')}
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Priority</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge className={getPriorityColor(selectedOrder.flags?.priority || 'normal')}>
                      {selectedOrder.flags?.priority || 'normal'}
                    </Badge>
                    {selectedOrder.flags?.requiresVerification && (
                      <div className="mt-2">
                        <Badge variant="outline" className="text-orange-600">Requires Verification</Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Customer Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium">{selectedOrder.customer?.name}</p>
                      <p className="text-sm text-muted-foreground">{selectedOrder.customer?.phone}</p>
                      {selectedOrder.flags?.isNewCustomer && (
                        <Badge variant="outline" className="mt-2">New Customer</Badge>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Delivery Address:</p>
                      <p className="text-sm mb-2">{selectedOrder.customer?.address?.fullAddress}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => window.open(generateGoogleMapsLink(selectedOrder.customer?.address?.fullAddress), '_blank')}>
                          <MapPin className="h-4 w-4 mr-2" />
                          Open in Maps
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(generateGoogleMapsLink(selectedOrder.customer?.address?.fullAddress), 'Maps link')}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Link
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Order Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Final Price</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.items?.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.productDetails?.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {item.productDetails?.dimensions} | {item.productDetails?.weight}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{item.productDetails?.sku}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>₹{item.unitPrice}</TableCell>
                          <TableCell>
                            ₹{item.finalUnitPrice}
                            {item.bulkDiscountPerUnit > 0 && (
                              <div className="text-xs text-green-600">(-₹{item.bulkDiscountPerUnit})</div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">₹{item.lineTotal?.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-3">Pricing Breakdown</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal ({selectedOrder.pricing?.itemCount} items):</span>
                        <span>₹{selectedOrder.pricing?.subtotal?.toLocaleString()}</span>
                      </div>
                      {selectedOrder.pricing?.bulkDiscountTotal > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Bulk Discount:</span>
                          <span>-₹{selectedOrder.pricing.bulkDiscountTotal.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Shipping Cost:</span>
                        <span>₹{selectedOrder.pricing?.shippingCost?.toLocaleString() || '0'}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg pt-2 border-t">
                        <span>Total Amount:</span>
                        <span>₹{selectedOrder.pricing?.finalTotal?.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>



            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};