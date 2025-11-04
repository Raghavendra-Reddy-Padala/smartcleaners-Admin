import React, { useEffect, useState } from 'react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { 
  Package, 
  ShoppingCart, 
  DollarSign, 
  Users,
  TrendingUp,
  AlertTriangle,
  Calendar,
  TrendingDown
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Loading } from '@/components/ui/loading';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  totalCategories: number;
  lowStockProducts: number;
  pendingOrders: number;
  totalProfit: number;
  avgOrderValue: number;
  newCustomers: number;
}

interface Order {
  id: string;
  orderId: string;
  customer: {
    name: string;
    phone: string;
    address: any;
  };
  items: any[];
  paymentMethod: string;
  pricing: {
    subtotal: number;
    shippingCost: number;
    finalTotal: number;
    itemCount: number;
    bulkDiscountTotal: number;
  };
  status: string;
  flags?: {
    isNewCustomer: boolean;
    priority: string;
    requiresVerification: boolean;
  };
  createdAt: any;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalCategories: 0,
    lowStockProducts: 0,
    pendingOrders: 0,
    totalProfit: 0,
    avgOrderValue: 0,
    newCustomers: 0
  });
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [orderStatusData, setOrderStatusData] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        // Fetch products
        const productsSnapshot = await getDocs(collection(db, 'products'));
        const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Fetch categories
        const categoriesSnapshot = await getDocs(collection(db, 'categories'));
        
        // Fetch orders
        const ordersSnapshot = await getDocs(collection(db, 'orders'));
        const orders: Order[] = ordersSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as Order));

        // Calculate revenue from pricing.finalTotal
        const totalRevenue = orders.reduce((sum, order) => {
          return sum + (order.pricing?.finalTotal || 0);
        }, 0);

        // Calculate profit (revenue - cost estimation: 60% of subtotal as cost)
        const totalProfit = orders.reduce((sum, order) => {
          const cost = (order.pricing?.subtotal || 0) * 0.8; // Assuming 40% profit margin
          return sum + ((order.pricing?.finalTotal || 0) - cost);
        }, 0);

        // Average order value
        const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

        // Count new customers
        const newCustomers = orders.filter(order => 
          order.flags?.isNewCustomer === true
        ).length;

        // Pending orders
        const pendingOrders = orders.filter(order => 
          order.status === 'pending' || order.status === 'processing'
        ).length;

        // Low stock products
        const lowStockProducts = products.filter((product: any) => 
          (product.stock || 0) < 10
        ).length;

        // Order status breakdown
        const statusCounts = orders.reduce((acc: any, order) => {
          acc[order.status] = (acc[order.status] || 0) + 1;
          return acc;
        }, {});

        const statusData = Object.keys(statusCounts).map(status => ({
          name: status.charAt(0).toUpperCase() + status.slice(1),
          value: statusCounts[status]
        }));

        // Weekly data (last 7 days)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (6 - i));
          return date;
        });

        const weeklyStats = last7Days.map(date => {
          const dayOrders = orders.filter(order => {
            const orderDate = order.createdAt?.toDate?.() || new Date(order.createdAt);
            return orderDate.toDateString() === date.toDateString();
          });

          const revenue = dayOrders.reduce((sum, order) => 
            sum + (order.pricing?.finalTotal || 0), 0
          );

          return {
            day: date.toLocaleDateString('en-IN', { weekday: 'short' }),
            revenue: Math.round(revenue),
            orders: dayOrders.length
          };
        });

        // Monthly data (last 6 months)
        const last6Months = Array.from({ length: 6 }, (_, i) => {
          const date = new Date();
          date.setMonth(date.getMonth() - (5 - i));
          return date;
        });

        const monthlyStats = last6Months.map(date => {
          const monthOrders = orders.filter(order => {
            const orderDate = order.createdAt?.toDate?.() || new Date(order.createdAt);
            return orderDate.getMonth() === date.getMonth() && 
                   orderDate.getFullYear() === date.getFullYear();
          });

          const revenue = monthOrders.reduce((sum, order) => 
            sum + (order.pricing?.finalTotal || 0), 0
          );

          const profit = monthOrders.reduce((sum, order) => {
            const cost = (order.pricing?.subtotal || 0) * 0.6;
            return sum + ((order.pricing?.finalTotal || 0) - cost);
          }, 0);

          return {
            month: date.toLocaleDateString('en-IN', { month: 'short' }),
            revenue: Math.round(revenue),
            profit: Math.round(profit),
            orders: monthOrders.length
          };
        });

        setStats({
          totalProducts: products.length,
          totalOrders: orders.length,
          totalRevenue,
          totalCategories: categoriesSnapshot.size,
          lowStockProducts,
          pendingOrders,
          totalProfit,
          avgOrderValue,
          newCustomers
        });

        setOrderStatusData(statusData);
        setWeeklyData(weeklyStats);
        setMonthlyData(monthlyStats);

      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Loading size="lg" className="py-20" />
      </div>
    );
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="text-sm text-muted-foreground">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue"
          value={`₹${stats.totalRevenue.toLocaleString('en-IN')}`}
          icon={DollarSign}
          change="+8%"
          trend="up"
        />
        <MetricCard
          title="Total Profit"
          value={`₹${stats.totalProfit.toLocaleString('en-IN')}`}
          icon={TrendingUp}
          change="+12%"
          trend="up"
        />
        <MetricCard
          title="Total Orders"
          value={stats.totalOrders}
          icon={ShoppingCart}
          change="+5%"
          trend="up"
        />
        <MetricCard
          title="Avg Order Value"
          value={`₹${Math.round(stats.avgOrderValue).toLocaleString('en-IN')}`}
          icon={Calendar}
          change="+3%"
          trend="up"
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Products"
          value={stats.totalProducts}
          icon={Package}
          change="+12%"
          trend="up"
        />
        <MetricCard
          title="Categories"
          value={stats.totalCategories}
          icon={Users}
          change="0%"
          trend="neutral"
        />
        <MetricCard
          title="New Customers"
          value={stats.newCustomers}
          icon={Users}
          change="+15%"
          trend="up"
        />
        <MetricCard
          title="Pending Orders"
          value={stats.pendingOrders}
          icon={TrendingDown}
          change={stats.pendingOrders > 0 ? "Action required" : "All processed"}
          trend={stats.pendingOrders > 0 ? "down" : "up"}
        />
      </div>

      {/* Alert Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MetricCard
          title="Low Stock Products"
          value={stats.lowStockProducts}
          icon={AlertTriangle}
          change={stats.lowStockProducts > 0 ? "Needs attention" : "All good"}
          trend={stats.lowStockProducts > 0 ? "down" : "up"}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Weekly Revenue & Orders */}
        <div className="bg-card rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Weekly Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="revenue" fill="#8884d8" name="Revenue (₹)" />
              <Bar yAxisId="right" dataKey="orders" fill="#82ca9d" name="Orders" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Order Status Distribution */}
        <div className="bg-card rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Order Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={orderStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {orderStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Revenue & Profit Trend */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Monthly Revenue & Profit Trend</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="#8884d8" 
              strokeWidth={2}
              name="Revenue (₹)"
              dot={{ r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="profit" 
              stroke="#82ca9d" 
              strokeWidth={2}
              name="Profit (₹)"
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Orders Trend */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Monthly Orders Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="orders" fill="#0088FE" name="Orders" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};