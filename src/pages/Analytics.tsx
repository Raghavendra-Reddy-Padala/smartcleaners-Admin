import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Clock, User, Phone, MapPin, AlertCircle, CheckCircle2, Beaker } from 'lucide-react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loading } from '@/components/ui/loading';

interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  finalUnitPrice: number;
  lineTotal: number;
  productDetails: {
    name: string;
    description: string;
    dimensions: string;
    images: string[];
    ingredients: string;
    instructions: string;
    sku: string;
    weight: string;
  };
}

interface Order {
  id: string;
  orderId: string;
  customer: {
    name: string;
    phone: string;
    address: {
      fullAddress: string;
    };
  };
  items: OrderItem[];
  status: string;
  flags?: {
    isNewCustomer: boolean;
    priority: string;
  };
  createdAt: any;
}

interface ProductSummary {
  productId: string;
  name: string;
  sku: string;
  totalQuantity: number;
  image: string;
  weight: string;
}

export const Analytics: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('today');
  const { toast } = useToast();

  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      where('status', 'in', ['pending', 'confirmed']),
      orderBy('createdAt', 'asc')
    );

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

  const markAsProcessing = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'processing',
        updatedAt: new Date()
      });
      toast({
        title: "Order Updated",
        description: "Order marked as processing",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update order",
        variant: "destructive"
      });
    }
  };

  const getFilteredOrders = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    return orders.filter(order => {
      if (!order.createdAt?.toDate) return true;
      const orderDate = order.createdAt.toDate();
      
      switch (dateFilter) {
        case 'today':
          return orderDate >= today;
        case 'week':
          return orderDate >= weekAgo;
        case 'all':
        default:
          return true;
      }
    });
  };

  const filteredOrders = getFilteredOrders();

  // Calculate product summary
  const productSummary: ProductSummary[] = [];
  const productMap = new Map();

  filteredOrders.forEach(order => {
    order.items?.forEach(item => {
      const existing = productMap.get(item.productId);
      if (existing) {
        existing.totalQuantity += item.quantity;
      } else {
        productMap.set(item.productId, {
          productId: item.productId,
          name: item.productDetails.name,
          sku: item.productDetails.sku,
          totalQuantity: item.quantity,
          image: item.productDetails.images?.[0] || '',
          weight: item.productDetails.weight
        });
      }
    });
  });

  productMap.forEach(value => productSummary.push(value));

  const totalItemsToday = filteredOrders.reduce((sum, order) => 
    sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
  );

  const newCustomerOrders = filteredOrders.filter(order => order.flags?.isNewCustomer).length;
  const priorityOrders = filteredOrders.filter(order => order.flags?.priority === 'high').length;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Production Dashboard</h1>
        <Loading size="lg" className="py-20" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Production Dashboard</h1>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Pending</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Pending Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{filteredOrders.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Orders to prepare</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Beaker className="h-4 w-4" />
              Total Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{totalItemsToday}</div>
            <p className="text-xs text-muted-foreground mt-1">Products to prepare</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              New Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{newCustomerOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">First time orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Priority Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{priorityOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">Urgent orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Product Summary */}
      {productSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Products to Prepare</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {productSummary.map(product => (
                <div key={product.productId} className="text-center p-3 bg-slate-50 rounded-lg border">
                  <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-white flex items-center justify-center overflow-hidden">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="h-8 w-8 text-gray-400" />
                    )}
                  </div>
                  <p className="font-bold text-sm">{product.name}</p>
                  <p className="text-xs text-muted-foreground mb-1">{product.weight}</p>
                  <Badge variant="secondary" className="text-xs">
                    {product.totalQuantity}x needed
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Orders to Prepare</h2>
        
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="py-20 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-medium mb-2">All caught up!</h3>
              <p className="text-muted-foreground">No pending orders to prepare right now.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredOrders.map(order => (
              <Card key={order.id} className="overflow-hidden">
                <CardHeader className="bg-slate-50 pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{order.orderId}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={order.status === 'pending' ? 'destructive' : 'default'}>
                          {order.status}
                        </Badge>
                        {order.flags?.isNewCustomer && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            New Customer
                          </Badge>
                        )}
                        {order.flags?.priority === 'high' && (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            Priority
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {order.createdAt?.toDate ? 
                          order.createdAt.toDate().toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'N/A'}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-4">
                  {/* Customer Info */}
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-start gap-2 mb-2">
                      <User className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{order.customer?.name}</p>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {order.customer?.phone}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        {order.customer?.address?.fullAddress}
                      </p>
                    </div>
                  </div>

                  {/* Products to Prepare */}
                  <div className="space-y-3">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="flex gap-3 p-3 border rounded-lg bg-white">
                        <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          {item.productDetails.images?.[0] ? (
                            <img 
                              src={item.productDetails.images[0]} 
                              alt={item.productDetails.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-8 w-8 text-gray-400" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div>
                              <h4 className="font-semibold text-sm">{item.productDetails.name}</h4>
                              <p className="text-xs text-muted-foreground">SKU: {item.productDetails.sku}</p>
                            </div>
                            <Badge className="bg-orange-100 text-orange-800 text-sm font-bold flex-shrink-0">
                              {item.quantity}x
                            </Badge>
                          </div>
                          
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Size:</span>
                              <span>{item.productDetails.weight}</span>
                              <span>•</span>
                              <span>{item.productDetails.dimensions}</span>
                            </div>
                            
                            {item.productDetails.instructions && (
                              <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                                <p className="font-medium text-yellow-800 text-xs mb-1">Instructions:</p>
                                <p className="text-xs text-yellow-700">{item.productDetails.instructions}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Button */}
                  <div className="mt-4 pt-4 border-t">
                    <Button 
                      className="w-full" 
                      onClick={() => markAsProcessing(order.id)}
                      variant="default"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark as Processing
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};