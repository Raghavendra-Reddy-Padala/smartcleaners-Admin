import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Edit, 
  Save, 
  X, 
  Search,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Layers,
  RefreshCw,
  Filter,
  Download
} from 'lucide-react';
import { Loading } from '@/components/ui/loading';

interface Product {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName?: string;
  images: string[];
  price: number;
  salePrice?: number;
  stock: number;
  sku: string;
  isActive: boolean;
  weight?: string;
  dimensions?: string;
  ingredients?: string;
  instructions?: string;
  serialNo: number | null;
  createdAt: any;
}

interface Category {
  id: string;
  name: string;
}

interface InventoryStats {
  totalProducts: number;
  totalStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalUnits: number;
}

export const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStock, setEditStock] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStock, setFilterStock] = useState<string>('all');
  const [stats, setStats] = useState<InventoryStats>({
    totalProducts: 0,
    totalStockValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalUnits: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [products]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch categories
      const categoriesSnapshot = await getDocs(collection(db, 'categories'));
      const categoriesData = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Category));
      setCategories(categoriesData);

      // Fetch products
      const productsSnapshot = await getDocs(collection(db, 'products'));
      const productsData = productsSnapshot.docs.map(doc => {
        const data = doc.data();
        const category = categoriesData.find(c => c.id === data.categoryId);
        return {
          id: doc.id,
          ...data,
          categoryName: category?.name || 'Unknown'
        } as Product;
      });

      // Sort by serial number
      productsData.sort((a, b) => {
        if (a.serialNo === null && b.serialNo === null) return 0;
        if (a.serialNo === null) return 1;
        if (b.serialNo === null) return -1;
        return a.serialNo - b.serialNo;
      });

      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const totalProducts = products.length;
    const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
    const totalStockValue = products.reduce((sum, p) => {
      const price = p.salePrice || p.price;
      return sum + (price * p.stock);
    }, 0);
    const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= 10).length;
    const outOfStockCount = products.filter(p => p.stock === 0).length;

    setStats({
      totalProducts,
      totalStockValue,
      lowStockCount,
      outOfStockCount,
      totalUnits
    });
  };

  const handleEditStock = (product: Product) => {
    setEditingId(product.id);
    setEditStock(product.stock);
  };

  const handleSaveStock = async (productId: string) => {
    try {
      const productRef = doc(db, 'products', productId);
      await updateDoc(productRef, {
        stock: editStock,
        updatedAt: Timestamp.now()
      });

      // Update local state
      setProducts(products.map(p => 
        p.id === productId ? { ...p, stock: editStock } : p
      ));

      setEditingId(null);
      setEditStock(0);
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('Failed to update stock. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditStock(0);
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: 'Out of Stock', color: 'bg-red-500', textColor: 'text-red-700' };
    if (stock <= 10) return { label: 'Low Stock', color: 'bg-orange-500', textColor: 'text-orange-700' };
    return { label: 'In Stock', color: 'bg-green-500', textColor: 'text-green-700' };
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = filterCategory === 'all' || product.categoryId === filterCategory;
    
    const matchesStock = filterStock === 'all' ||
                        (filterStock === 'out' && product.stock === 0) ||
                        (filterStock === 'low' && product.stock > 0 && product.stock <= 10) ||
                        (filterStock === 'in' && product.stock > 10);

    return matchesSearch && matchesCategory && matchesStock;
  });

  const exportToCSV = () => {
    const headers = ['SKU', 'Product Name', 'Category', 'Stock', 'Price', 'Sale Price', 'Stock Value'];
    const rows = filteredProducts.map(p => [
      p.sku,
      p.name,
      p.categoryName,
      p.stock,
      p.price,
      p.salePrice || '-',
      (p.salePrice || p.price) * p.stock
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Inventory Management</h1>
        <Loading size="lg" className="py-20" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and manage your product stock levels
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Products</p>
              <p className="text-2xl font-bold mt-1">{stats.totalProducts}</p>
            </div>
            <Package className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Units</p>
              <p className="text-2xl font-bold mt-1">{stats.totalUnits.toLocaleString()}</p>
            </div>
            <Layers className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Stock Value</p>
              <p className="text-2xl font-bold mt-1">₹{stats.totalStockValue.toLocaleString('en-IN')}</p>
            </div>
            <DollarSign className="h-8 w-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Low Stock</p>
              <p className="text-2xl font-bold mt-1 text-orange-600">{stats.lowStockCount}</p>
            </div>
            <TrendingDown className="h-8 w-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Out of Stock</p>
              <p className="text-2xl font-bold mt-1 text-red-600">{stats.outOfStockCount}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by product name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="w-full md:w-48">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Stock Filter */}
          <div className="w-full md:w-48">
            <select
              value={filterStock}
              onChange={(e) => setFilterStock(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Stock Levels</option>
              <option value="in">In Stock (10+)</option>
              <option value="low">Low Stock (1-10)</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b">
              <tr>
                <th className="text-left p-4 font-semibold">Product</th>
                <th className="text-left p-4 font-semibold">SKU</th>
                <th className="text-left p-4 font-semibold">Category</th>
                <th className="text-left p-4 font-semibold">Volume/Weight</th>
                <th className="text-center p-4 font-semibold">Stock</th>
                <th className="text-left p-4 font-semibold">Status</th>
                <th className="text-right p-4 font-semibold">Unit Price</th>
                <th className="text-right p-4 font-semibold">Stock Value</th>
                <th className="text-center p-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-muted-foreground">
                    No products found
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const status = getStockStatus(product.stock);
                  const isEditing = editingId === product.id;
                  const unitPrice = product.salePrice || product.price;
                  const stockValue = unitPrice * product.stock;

                  return (
                    <tr key={product.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                            {product.images && product.images.length > 0 ? (
                              <img 
                                src={product.images[0]} 
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium line-clamp-1">{product.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {product.description}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="font-mono">
                          {product.sku}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">{product.categoryName}</span>
                      </td>
                      <td className="p-4">
                        <div className="bg-blue-50 border border-blue-200 rounded px-2 py-1 text-xs font-medium text-blue-700 inline-block">
                          {product.weight || 'N/A'}
                        </div>
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-2">
                            <input
                              type="number"
                              value={editStock}
                              onChange={(e) => setEditStock(parseInt(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                              min="0"
                            />
                          </div>
                        ) : (
                          <div className="text-center">
                            <span className="text-lg font-bold">{product.stock}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge className={`${status.color} text-white`}>
                          {status.label}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <div>
                          <p className="font-semibold">₹{unitPrice.toLocaleString('en-IN')}</p>
                          {product.salePrice && (
                            <p className="text-xs text-muted-foreground line-through">
                              ₹{product.price.toLocaleString('en-IN')}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <p className="font-semibold text-purple-600">
                          ₹{stockValue.toLocaleString('en-IN')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {product.stock} × ₹{unitPrice}
                        </p>
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveStock(product.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditStock(product)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredProducts.length} of {products.length} products
          </p>
          <p className="text-sm font-medium">
            Total filtered stock value: ₹
            {filteredProducts.reduce((sum, p) => 
              sum + ((p.salePrice || p.price) * p.stock), 0
            ).toLocaleString('en-IN')}
          </p>
        </div>
      </div>
    </div>
  );
};