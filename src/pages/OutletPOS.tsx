import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, addDoc, where, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loading } from '@/components/ui/loading';
import { Search, ShoppingCart, Plus, Minus, Trash2, Store, CreditCard, Banknote, Smartphone, CheckCircle2, Truck } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  images: string[];
  price: number;
  salePrice?: number;
  costPrice?: number;
  stock: number;
  sku: string;
  isActive: boolean;
}

interface CartItem extends Product {
  cartQuantity: number;
}

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash', icon: <Banknote className="h-4 w-4" /> },
  { value: 'upi', label: 'UPI', icon: <Smartphone className="h-4 w-4" /> },
  { value: 'card', label: 'Card', icon: <CreditCard className="h-4 w-4" /> },
  { value: 'cash_on_delivery', label: 'COD', icon: <Truck className="h-4 w-4" /> },
];

export const OutletPOS: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successOrder, setSuccessOrder] = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    fetchProductsAndCategories();
  }, []);

  const fetchProductsAndCategories = async () => {
    try {
      const qProducts = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(qProducts);
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];

      const categoriesSnapshot = await getDocs(collection(db, 'categories'));
      const categoriesData = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
      
      const categoriesMap = new Map();
      categoriesData.forEach(c => categoriesMap.set(c.id, c.name));

      const activeProducts = productsData
        .filter(p => p.isActive)
        .map(p => ({
          ...p,
          categoryName: categoriesMap.get(p.categoryId) || 'Unknown'
        }));

      setProducts(activeProducts);
      setCategories(categoriesData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching POS data:', error);
      toast({ title: 'Error loading products', variant: 'destructive' });
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, cartQuantity: item.cartQuantity + 1 } 
            : item
        );
      }
      return [...prev, { ...product, cartQuantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQ = item.cartQuantity + delta;
        return { ...item, cartQuantity: Math.max(1, newQ) };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const getEffectivePrice = (item: Product) => item.salePrice || item.price;
  
  const cartSubtotal = cart.reduce((sum, item) => sum + (getEffectivePrice(item) * item.cartQuantity), 0);
  const cartTotal = cartSubtotal; // Assuming no shipping for outlet orders

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast({ title: 'Cart is empty', variant: 'destructive' });
      return;
    }
    if (!customerName || !customerPhone) {
      toast({ title: 'Customer details required', description: 'Please enter customer name and phone', variant: 'destructive' });
      return;
    }

    if (paymentMode === 'cash_on_delivery' && !customerAddress) {
      toast({ title: 'Address required', description: 'Please enter a delivery address for COD orders', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Handle Customer Registration (if not exists)
      const usersRef = collection(db, 'users');
      const qUser = query(usersRef, where('phone', '==', customerPhone));
      const userSnap = await getDocs(qUser);
      let customerRefId = '';

      if (userSnap.empty) {
        const newUserRef = await addDoc(usersRef, {
          name: customerName,
          phone: customerPhone,
          email: '',
          address: { street: customerAddress, city: '', state: '', pincode: '', fullAddress: customerAddress || 'Outlet Walk-in' },
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          source: 'outlet'
        });
        customerRefId = newUserRef.id;
      } else {
        customerRefId = userSnap.docs[0].id;
        // Optionally update name if changed, but left simple for now
      }

      // 2. Format Order Items
      const orderItems = cart.map(item => ({
        productId: item.id,
        quantity: item.cartQuantity,
        unitPrice: item.price,
        finalUnitPrice: getEffectivePrice(item),
        costPrice: item.costPrice || 0,
        lineTotal: getEffectivePrice(item) * item.cartQuantity,
        bulkDiscountPerUnit: 0,
        productDetails: {
          name: item.name,
          sku: item.sku,
          images: item.images || []
        }
      }));

      // 3. Create Order
      const orderId = `OUT-${Date.now().toString().slice(-6)}`;
      const isCOD = paymentMode === 'cash_on_delivery';
      
      const newOrder = {
        orderId,
        customer: {
          name: customerName,
          phone: customerPhone,
          userId: customerRefId,
          address: { fullAddress: customerAddress || 'Outlet Walk-in' }
        },
        items: orderItems,
        paymentMethod: paymentMode,
        paymentStatus: isCOD ? 'pending' : 'paid',
        paymentrecord: isCOD ? 'unpaid' : 'paid',
        amountPaid: isCOD ? 0 : cartTotal,
        paymentHistory: isCOD ? [] : [{
          amount: cartTotal,
          mode: paymentMode,
          type: 'full',
          note: 'Outlet Point of Sale',
          paidAt: new Date().toISOString()
        }],
        pricing: {
          subtotal: cartSubtotal,
          shippingCost: 0,
          bulkDiscountTotal: 0,
          itemCount: cart.reduce((sum, item) => sum + item.cartQuantity, 0),
          finalTotal: cartTotal
        },
        status: isCOD ? 'pending' : 'delivered', // COD orders need to be shipped
        flags: {
          isOutletOrder: true,
          priority: 'normal',
          isNewCustomer: userSnap.empty
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await addDoc(collection(db, 'orders'), newOrder);

      toast({ title: 'Order Completed', description: `Order ${orderId} has been successfully created and paid.` });
      setSuccessOrder(orderId);
      
      // Reset Form
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setPaymentMode('cash');

    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({ title: 'Checkout Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Outlet POS</h1>
        <Loading size="lg" className="py-20" />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-6rem)]">
      
      {/* Left: Products Catalog */}
      <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
        <div className="flex items-center gap-3 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <Store className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">Outlet POS</h1>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search products..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 pb-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map(product => (
              <Card 
                key={product.id} 
                className="cursor-pointer hover:shadow-md transition-shadow hover:border-blue-300 overflow-hidden flex flex-col"
                onClick={() => addToCart(product)}
              >
                <div className="h-32 bg-gray-100 relative">
                  {product.images?.[0] ? (
                    <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-gray-400">No Image</div>
                  )}
                  {product.salePrice && (
                    <Badge className="absolute top-2 right-2 bg-red-500">Sale</Badge>
                  )}
                </div>
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-sm line-clamp-2" title={product.name}>{product.name}</h3>
                    <p className="text-xs text-muted-foreground">{product.sku}</p>
                  </div>
                  <div className="mt-2 font-bold text-blue-700">
                    ₹{getEffectivePrice(product).toLocaleString()}
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {filteredProducts.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
              No products found matching your search.
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart and Checkout */}
      <div className="w-full md:w-[400px] flex flex-col bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            <h2 className="font-semibold text-lg">Current Order</h2>
          </div>
          <Badge variant="secondary" className="bg-slate-700 text-white hover:bg-slate-600">
            {cart.reduce((s, i) => s + i.cartQuantity, 0)} Items
          </Badge>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {successOrder && cart.length === 0 && (
            <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-center mb-4">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
              <p className="font-semibold text-green-800">Order {successOrder} Successful!</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setSuccessOrder(null)}>Start New Order</Button>
            </div>
          )}

          {cart.length === 0 && !successOrder && (
            <div className="text-center py-10 text-muted-foreground flex flex-col items-center">
              <ShoppingCart className="h-12 w-12 text-gray-200 mb-3" />
              <p>Your cart is empty.</p>
              <p className="text-sm">Click products on the left to add.</p>
            </div>
          )}

          {cart.map(item => (
            <div key={item.id} className="flex items-center gap-3 border-b pb-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">₹{getEffectivePrice(item).toLocaleString()} each</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center border rounded-md">
                  <button className="px-2 py-1 hover:bg-gray-100" onClick={() => updateQuantity(item.id, -1)}><Minus className="h-3 w-3" /></button>
                  <span className="px-2 text-sm font-medium w-8 text-center">{item.cartQuantity}</span>
                  <button className="px-2 py-1 hover:bg-gray-100" onClick={() => updateQuantity(item.id, 1)}><Plus className="h-3 w-3" /></button>
                </div>
                <div className="font-bold text-sm w-16 text-right">
                  ₹{(getEffectivePrice(item) * item.cartQuantity).toLocaleString()}
                </div>
                <button className="text-red-400 hover:text-red-600 p-1" onClick={() => removeFromCart(item.id)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-gray-50 p-4 space-y-4 border-t">
          {/* Customer Details */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Customer Details</h3>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
              <Input placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
            </div>
            <Input 
              placeholder={paymentMode === 'cash_on_delivery' ? "Delivery Address (Required for COD)" : "Delivery Address (Optional)"} 
              value={customerAddress} 
              onChange={e => setCustomerAddress(e.target.value)} 
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Payment Mode</h3>
            <div className="flex gap-2">
              {PAYMENT_MODES.map(mode => (
                <Button 
                  key={mode.value}
                  type="button"
                  variant={paymentMode === mode.value ? 'default' : 'outline'}
                  className={`flex-1 ${paymentMode === mode.value ? 'bg-blue-600' : ''}`}
                  onClick={() => setPaymentMode(mode.value)}
                  size="sm"
                >
                  {mode.icon}
                  <span className="ml-2">{mode.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Totals & Action */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex justify-between text-muted-foreground text-sm">
              <span>Subtotal</span>
              <span>₹{cartSubtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-xl pt-1">
              <span>Total Pay</span>
              <span className="text-blue-700">₹{cartTotal.toLocaleString()}</span>
            </div>
          </div>

          <Button 
            className="w-full py-6 text-lg" 
            onClick={handleCheckout} 
            disabled={cart.length === 0 || isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Complete Checkout'}
          </Button>
        </div>
      </div>
    </div>
  );
};
