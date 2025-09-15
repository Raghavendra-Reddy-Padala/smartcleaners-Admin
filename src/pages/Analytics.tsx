import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Users, Package, ShoppingCart, DollarSign, Calendar } from 'lucide-react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loading } from '@/components/ui/loading';

interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  totalCustomers: number;
  revenueGrowth: number;
  ordersGrowth: number;
  avgOrderValue: number;
  topProducts: Array<{
    name: string;
    sales: number;
    revenue: number;
  }>;
  topCategories: Array<{
    name: string;
    sales: number;
    revenue: number;
  }>;
  salesTrend: Array<{
    date: string;
    revenue: number;
    orders: number;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    amount: number;
    status: string;
    date: string;
  }>;
}

export const Analytics: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30days');
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      switch (timeRange) {
        case '7days':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30days':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90days':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1year':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      // Fetch orders
      const ordersQuery = query(
        collection(db, 'orders'),
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate),
        orderBy('createdAt', 'desc')
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      const orders = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // Fetch products
      const productsSnapshot = await getDocs(collection(db, 'products'));
      const products = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Fetch categories
      const categoriesSnapshot = await getDocs(collection(db, 'categories'));
      const categories = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Calculate analytics
      const totalRevenue = orders
        .filter(order => order.paymentStatus === 'paid')
        .reduce((sum, order) => sum + order.totalAmount, 0);

      const totalOrders = orders.length;
      const totalProducts = products.length;
      const uniqueCustomers = new Set(orders.map(order => order.customerId)).size;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Calculate growth (comparing with previous period)
      const previousPeriodStart = new Date(startDate);
      const previousPeriodEnd = new Date(startDate);
      const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      previousPeriodStart.setDate(previousPeriodStart.getDate() - daysDiff);

      const previousOrdersQuery = query(
        collection(db, 'orders'),
        where('createdAt', '>=', previousPeriodStart),
        where('createdAt', '<', startDate)
      );
      const previousOrdersSnapshot = await getDocs(previousOrdersQuery);
      const previousOrders = previousOrdersSnapshot.docs.map(doc => doc.data()) as any[];

      const previousRevenue = previousOrders
        .filter(order => order.paymentStatus === 'paid')
        .reduce((sum, order) => sum + order.totalAmount, 0);
      const previousOrderCount = previousOrders.length;

      const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
      const ordersGrowth = previousOrderCount > 0 ? ((totalOrders - previousOrderCount) / previousOrderCount) * 100 : 0;

      // Top products analysis
      const productSales = new Map();
      orders.forEach(order => {
        order.items?.forEach(item => {
          const current = productSales.get(item.productId) || { name: item.productName, sales: 0, revenue: 0 };
          current.sales += item.quantity;
          current.revenue += item.quantity * item.price;
          productSales.set(item.productId, current);
        });
      });

      const topProducts = Array.from(productSales.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Top categories analysis
      const categorySales = new Map();
      orders.forEach(order => {
        order.items?.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          if (product) {
            const category = categories.find(c => c.id === product.categoryId);
            if (category) {
              const current = categorySales.get(category.id) || { name: category.name, sales: 0, revenue: 0 };
              current.sales += item.quantity;
              current.revenue += item.quantity * item.price;
              categorySales.set(category.id, current);
            }
          }
        });
      });

      const topCategories = Array.from(categorySales.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Sales trend (daily data for the period)
      const salesTrendMap = new Map();
      orders.forEach(order => {
        if (order.paymentStatus === 'paid' && order.createdAt?.toDate) {
          const date = order.createdAt.toDate().toISOString().split('T')[0];
          const current = salesTrendMap.get(date) || { date, revenue: 0, orders: 0 };
          current.revenue += order.totalAmount;
          current.orders += 1;
          salesTrendMap.set(date, current);
        }
      });

      const salesTrend = Array.from(salesTrendMap.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-30); // Last 30 data points

      // Recent orders
      const recentOrders = orders
        .slice(0, 10)
        .map(order => ({
          id: order.id,
          orderNumber: order.orderNumber || `ORD-${order.id.slice(-6)}`,
          customerName: order.customerName,
          amount: order.totalAmount,
          status: order.status,
          date: order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : 'N/A'
        }));

      setAnalyticsData({
        totalRevenue,
        totalOrders,
        totalProducts,
        totalCustomers: uniqueCustomers,
        revenueGrowth,
        ordersGrowth,
        avgOrderValue,
        topProducts,
        topCategories,
        salesTrend,
        recentOrders
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'shipped': return 'bg-blue-100 text-blue-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-orange-100 text-orange-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Analytics</h1>
        </div>
        <Loading size="lg" className="py-20" />
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <div className="text-center py-20">
          <h3 className="text-lg font-medium mb-2">No analytics data available</h3>
          <p className="text-muted-foreground">
            Analytics will be available once you have orders and sales data
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">Last 7 days</SelectItem>
            <SelectItem value="30days">Last 30 days</SelectItem>
            <SelectItem value="90days">Last 90 days</SelectItem>
            <SelectItem value="1year">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analyticsData.totalRevenue)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {analyticsData.revenueGrowth >= 0 ? (
                <TrendingUp className="h-4 w-4 mr-1 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 mr-1 text-red-500" />
              )}
              <span className={analyticsData.revenueGrowth >= 0 ? 'text-green-500' : 'text-red-500'}>
                {Math.abs(analyticsData.revenueGrowth).toFixed(1)}%
              </span>
              <span className="ml-1">from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.totalOrders}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {analyticsData.ordersGrowth >= 0 ? (
                <TrendingUp className="h-4 w-4 mr-1 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 mr-1 text-red-500" />
              )}
              <span className={analyticsData.ordersGrowth >= 0 ? 'text-green-500' : 'text-red-500'}>
                {Math.abs(analyticsData.ordersGrowth).toFixed(1)}%
              </span>
              <span className="ml-1">from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.totalProducts}</div>
            <p className="text-xs text-muted-foreground">Active products in catalog</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">
              Avg. order value: {formatCurrency(analyticsData.avgOrderValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData.salesTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  formatter={(value, name) => [
                    name === 'revenue' ? formatCurrency(value as number) : value,
                    name === 'revenue' ? 'Revenue' : 'Orders'
                  ]}
                />
                <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} />
                <Line type="monotone" dataKey="orders" stroke="#82ca9d" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Categories */}
        <Card>
          <CardHeader>
            <CardTitle>Top Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analyticsData.topCategories}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="revenue"
                >
                  {analyticsData.topCategories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Products and Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analyticsData.topProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">{product.sales} sold</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(product.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analyticsData.recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{order.orderNumber}</p>
                    <p className="text-sm text-muted-foreground">{order.customerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(order.amount)}</p>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};