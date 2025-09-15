import React, { useEffect, useState } from 'react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { 
  Package, 
  ShoppingCart, 
  DollarSign, 
  Users,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { Loading } from '@/components/ui/loading';

interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  totalCategories: number;
  lowStockProducts: number;
  pendingOrders: number;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalCategories: 0,
    lowStockProducts: 0,
    pendingOrders: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        // Fetch products count
        const productsSnapshot = await getDocs(collection(db, 'products'));
        const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Fetch categories count
        const categoriesSnapshot = await getDocs(collection(db, 'categories'));
        
        // Fetch orders count and revenue
        const ordersSnapshot = await getDocs(collection(db, 'orders'));
        const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const totalRevenue = orders.reduce((sum: number, order: any) => {
          return sum + (order.totalAmount || 0);
        }, 0);

        const pendingOrders = orders.filter((order: any) => 
          order.status === 'pending' || order.status === 'processing'
        ).length;

        const lowStockProducts = products.filter((product: any) => 
          (product.stock || 0) < 10
        ).length;

        setStats({
          totalProducts: products.length,
          totalOrders: orders.length,
          totalRevenue,
          totalCategories: categoriesSnapshot.size,
          lowStockProducts,
          pendingOrders
        });
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
          title="Total Products"
          value={stats.totalProducts}
          icon={Package}
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
          title="Total Revenue"
          value={`₹${stats.totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          change="+8%"
          trend="up"
        />
        <MetricCard
          title="Categories"
          value={stats.totalCategories}
          icon={Users}
          change="0%"
          trend="neutral"
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
        <MetricCard
          title="Pending Orders"
          value={stats.pendingOrders}
          icon={TrendingUp}
          change={stats.pendingOrders > 0 ? "Action required" : "All processed"}
          trend={stats.pendingOrders > 0 ? "down" : "up"}
        />
      </div>

      {/* Quick Actions */}
      <div className="dashboard-card p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a 
            href="/products" 
            className="p-4 rounded-lg border border-border hover:bg-accent-light transition-colors text-center"
          >
            <Package className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="font-medium">Add Product</p>
          </a>
          <a 
            href="/categories" 
            className="p-4 rounded-lg border border-border hover:bg-accent-light transition-colors text-center"
          >
            <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="font-medium">Manage Categories</p>
          </a>
          <a 
            href="/orders" 
            className="p-4 rounded-lg border border-border hover:bg-accent-light transition-colors text-center"
          >
            <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="font-medium">View Orders</p>
          </a>
          <a 
            href="/analytics" 
            className="p-4 rounded-lg border border-border hover:bg-accent-light transition-colors text-center"
          >
            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="font-medium">Analytics</p>
          </a>
        </div>
      </div>
    </div>
  );
};