import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Package, Truck, Search, Trash2, FileText, Send, MapPin, Copy } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { db } from '@/lib/firebase';
import { collection, doc, updateDoc, onSnapshot, query, orderBy, deleteDoc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loading } from '@/components/ui/loading';

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
  const { toast } = useToast();

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      setOrders(ordersData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

  const generateBillPDF = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: "Error",
        description: "Please allow popups to generate bill",
        variant: "destructive"
      });
      return;
    }

    const billHTML = `<!DOCTYPE html><html><head><title>Invoice - ${order.orderId}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:40px;color:#333;background:#fff}.invoice-container{max-width:800px;margin:0 auto}.header{text-align:center;margin-bottom:30px;border-bottom:3px solid #2563eb;padding-bottom:20px}.company-name{font-size:32px;font-weight:700;color:#2563eb;margin-bottom:5px}.invoice-title{font-size:24px;color:#666;margin-top:10px}.section{margin:25px 0}.section-title{font-size:16px;font-weight:700;color:#2563eb;margin-bottom:10px;border-bottom:2px solid #e5e7eb;padding-bottom:5px}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.info-label{font-size:12px;color:#666;margin-bottom:3px}.info-value{font-size:14px;font-weight:500}.badge{display:inline-block;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:500;margin-top:5px}.badge-new{background:#dbeafe;color:#1e40af}table{width:100%;border-collapse:collapse;margin-top:15px}th{background:#f3f4f6;padding:12px;text-align:left;font-size:13px;font-weight:600;border-bottom:2px solid #2563eb}td{padding:12px;border-bottom:1px solid #e5e7eb;font-size:13px}.item-name{font-weight:500}.item-details{font-size:11px;color:#666;margin-top:2px}.text-right{text-align:right}.pricing-summary{margin-top:30px;background:#f9fafb;padding:20px;border-radius:8px}.pricing-row{display:flex;justify-content:space-between;padding:8px 0;font-size:14px}.pricing-row.discount{color:#16a34a}.pricing-row.total{font-size:18px;font-weight:700;border-top:2px solid #2563eb;margin-top:10px;padding-top:15px}.footer{margin-top:40px;text-align:center;color:#666;font-size:12px;padding-top:20px;border-top:1px solid #e5e7eb}@media print{body{padding:20px}.no-print{display:none}}</style></head><body><div class="invoice-container"><div class="header"><div class="company-name">Smart Cleaners</div><div style="font-size:14px;color:#666;margin-top:5px">Nizampet,Hyderabad,Telanagana - 123456<br>Phone: +91 90146 32639 | Email:smartcleaner.shop@gmail.com</div><div class="invoice-title">INVOICE</div></div><div class="section"><div class="info-grid"><div class="info-block"><div class="info-label">Invoice Number:</div><div class="info-value">${order.orderId}</div></div><div class="info-block"><div class="info-label">Invoice Date:</div><div class="info-value">${order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-IN') : 'N/A'}</div></div><div class="info-block"><div class="info-label">Payment Method:</div><div class="info-value">${order.paymentMethod.replace('_', ' ').toUpperCase()}</div></div><div class="info-block"><div class="info-label">Order Status:</div><div class="info-value">${order.status.toUpperCase()}</div></div></div></div><div class="section"><div class="section-title">Bill To</div><div class="info-value">${order.customer?.name}</div><div style="font-size:13px;color:#666;margin-top:5px">Phone: ${order.customer?.phone}<br>${order.customer?.address?.fullAddress}</div>${order.flags?.isNewCustomer ? '<div class="badge badge-new">New Customer</div>' : ''}</div><div class="section"><div class="section-title">Order Items</div><table><thead><tr><th>Item</th><th>SKU</th><th class="text-right">Qty</th><th class="text-right">Unit Price</th><th class="text-right">Discount</th><th class="text-right">Total</th></tr></thead><tbody>${order.items?.map(item => `<tr><td><div class="item-name">${item.productDetails?.name}</div><div class="item-details">${item.productDetails?.dimensions} | ${item.productDetails?.weight}</div></td><td>${item.productDetails?.sku}</td><td class="text-right">${item.quantity}</td><td class="text-right">₹${item.unitPrice.toLocaleString()}</td><td class="text-right">${item.bulkDiscountPerUnit > 0 ? `₹${item.bulkDiscountPerUnit.toLocaleString()}` : '-'}</td><td class="text-right">₹${item.lineTotal?.toLocaleString()}</td></tr>`).join('')}</tbody></table></div><div class="pricing-summary"><div class="pricing-row"><span>Subtotal (${order.pricing?.itemCount} items):</span><span>₹${order.pricing?.subtotal?.toLocaleString()}</span></div>${order.pricing?.bulkDiscountTotal > 0 ? `<div class="pricing-row discount"><span>Bulk Discount:</span><span>-₹${order.pricing.bulkDiscountTotal.toLocaleString()}</span></div>` : ''}<div class="pricing-row"><span>Shipping Cost:</span><span>₹${order.pricing?.shippingCost?.toLocaleString() || '0'}</span></div><div class="pricing-row total"><span>Total Amount:</span><span>₹${order.pricing?.finalTotal?.toLocaleString()}</span></div></div>${order.trackingNumber ? `<div class="section"><div class="section-title">Shipping Information</div><div class="info-label">Tracking Number:</div><div class="info-value">${order.trackingNumber}</div></div>` : ''}<div class="footer"><p><strong>Thank you for your business!</strong></p><p style="margin-top:10px">For any queries, contact us at smartcleaners.shop@gmail.com or +91 9014632639</p></div><div class="no-print" style="margin-top:30px;text-align:center"><button onclick="window.print()" style="padding:12px 24px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;margin-right:10px">Print Invoice</button><button onclick="window.close()" style="padding:12px 24px;background:#6b7280;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer">Close</button></div></div></body></html>`;

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
                      <Button size="sm" variant="outline" onClick={() => generateBillPDF(order)} title="Generate PDF Bill">
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

              <div className="flex gap-4">
                <Card className="flex-1">
                  <CardHeader>
                    <CardTitle className="text-lg">Send Bill to Customer</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button onClick={() => generateBillPDF(selectedOrder)} className="flex-1">
                        <FileText className="h-4 w-4 mr-2" />
                        Generate PDF
                      </Button>
                      <Button onClick={() => sendBillToCustomer(selectedOrder)} variant="outline" className="flex-1">
                        <Send className="h-4 w-4 mr-2" />
                        Send via WhatsApp
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="flex-1">
                  <CardHeader>
                    <CardTitle className="text-lg">Share Location</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button onClick={() => window.open(generateGoogleMapsLink(selectedOrder.customer?.address?.fullAddress), '_blank')} className="flex-1">
                        <MapPin className="h-4 w-4 mr-2" />
                        Open Maps
                      </Button>
                      <Button onClick={() => copyToClipboard(generateGoogleMapsLink(selectedOrder.customer?.address?.fullAddress), 'Maps link')} variant="outline" className="flex-1">
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Link
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {selectedOrder.status !== 'shipped' && selectedOrder.status !== 'delivered' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Add Tracking Number</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter tracking number"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                      />
                      <Button onClick={() => updateTrackingNumber(selectedOrder.id)}>
                        <Truck className="h-4 w-4 mr-2" />
                        Ship Order
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};