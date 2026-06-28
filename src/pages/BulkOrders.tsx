import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Users, Package, ShoppingBag, Upload, X, ImageIcon, Star } from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loading } from '@/components/ui/loading';
import { uploadImageToCloudinary } from '@/lib/cloudinary';

interface BulkPricingTier {
  minQuantity: number;
  maxQuantity?: number;
  discountPercentage: number;
}

interface WholesaleAccount {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  gstNumber?: string;
  discountRate: number;
  creditLimit: number;
  paymentTerms: string;
  isActive: boolean;
  createdAt: any;
}

interface BulkPricing {
  id: string;
  name: string;
  description: string;
  tiers: BulkPricingTier[];
  isActive: boolean;
  createdAt: any;
}

interface BulkProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  image: string;
  priceRange: string;
  moq: number;
  unit: string;
  features: string[];
  isActive: boolean;
  createdAt: any;
}

const generateSlug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const BulkOrders: React.FC = () => {
  const [bulkPricings, setBulkPricings] = useState<BulkPricing[]>([]);
  const [wholesaleAccounts, setWholesaleAccounts] = useState<WholesaleAccount[]>([]);
  const [bulkProducts, setBulkProducts] = useState<BulkProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPricingDialogOpen, setIsPricingDialogOpen] = useState(false);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [editingPricing, setEditingPricing] = useState<BulkPricing | null>(null);
  const [editingAccount, setEditingAccount] = useState<WholesaleAccount | null>(null);
  const [editingProduct, setEditingProduct] = useState<BulkProduct | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'pricing' | 'accounts'>('products');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [featuresInput, setFeaturesInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pricingFormData, setPricingFormData] = useState({
    name: '',
    description: '',
    tiers: [{ minQuantity: 10, maxQuantity: undefined, discountPercentage: 5 }] as BulkPricingTier[],
    isActive: true
  });

  const [accountFormData, setAccountFormData] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    gstNumber: '',
    discountRate: 0,
    creditLimit: 0,
    paymentTerms: '30 days',
    isActive: true
  });

  const [productFormData, setProductFormData] = useState({
    name: '',
    slug: '',
    description: '',
    category: '',
    image: '',
    priceRange: '',
    moq: 50,
    unit: 'Litre',
    features: [] as string[],
    isActive: true
  });

  const { toast } = useToast();

  useEffect(() => {
    const qPricing = query(collection(db, 'bulkPricing'), orderBy('createdAt', 'desc'));
    const unsubscribePricing = onSnapshot(qPricing, (snapshot) => {
      const pricingData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BulkPricing[];
      setBulkPricings(pricingData);
    });

    const qAccounts = query(collection(db, 'wholesaleAccounts'), orderBy('createdAt', 'desc'));
    const unsubscribeAccounts = onSnapshot(qAccounts, (snapshot) => {
      const accountsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as WholesaleAccount[];
      setWholesaleAccounts(accountsData);
    });

    const qProducts = query(collection(db, 'bulkProducts'), orderBy('createdAt', 'desc'));
    const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BulkProduct[];
      setBulkProducts(productsData);
      setLoading(false);
    });

    return () => {
      unsubscribePricing();
      unsubscribeAccounts();
      unsubscribeProducts();
    };
  }, []);

  // ─── Image Upload ─────────────────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadImageToCloudinary(file);
      setProductFormData(prev => ({ ...prev, image: url }));
      toast({ title: 'Image uploaded', description: 'Product image uploaded successfully' });
    } catch {
      toast({ title: 'Upload failed', description: 'Could not upload image. Try again.', variant: 'destructive' });
    } finally {
      setUploadingImage(false);
    }
  };

  // ─── Product CRUD ─────────────────────────────────────────────────────────
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productFormData.image) {
      toast({ title: 'Image required', description: 'Please upload a product image.', variant: 'destructive' });
      return;
    }
    try {
      const data = { ...productFormData, createdAt: new Date() };
      if (editingProduct) {
        await updateDoc(doc(db, 'bulkProducts', editingProduct.id), { ...productFormData, updatedAt: new Date() });
        toast({ title: 'Product updated', description: 'Bulk product updated successfully' });
      } else {
        await addDoc(collection(db, 'bulkProducts'), data);
        toast({ title: 'Product added', description: 'New bulk product added successfully' });
      }
      setIsProductDialogOpen(false);
      resetProductForm();
    } catch {
      toast({ title: 'Error', description: 'Failed to save product.', variant: 'destructive' });
    }
  };

  const handleEditProduct = (product: BulkProduct) => {
    setEditingProduct(product);
    setProductFormData({
      name: product.name,
      slug: product.slug,
      description: product.description,
      category: product.category,
      image: product.image,
      priceRange: product.priceRange,
      moq: product.moq,
      unit: product.unit,
      features: product.features || [],
      isActive: product.isActive
    });
    setFeaturesInput((product.features || []).join('\n'));
    setIsProductDialogOpen(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm('Delete this bulk product?')) {
      try {
        await deleteDoc(doc(db, 'bulkProducts', id));
        toast({ title: 'Product deleted', description: 'Bulk product removed' });
      } catch {
        toast({ title: 'Error', description: 'Failed to delete product.', variant: 'destructive' });
      }
    }
  };

  const resetProductForm = () => {
    setProductFormData({ name: '', slug: '', description: '', category: '', image: '', priceRange: '', moq: 50, unit: 'Litre', features: [], isActive: true });
    setFeaturesInput('');
    setEditingProduct(null);
  };

  // ─── Pricing CRUD ─────────────────────────────────────────────────────────
  const handlePricingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPricing) {
        await updateDoc(doc(db, 'bulkPricing', editingPricing.id), { ...pricingFormData, updatedAt: new Date() });
        toast({ title: 'Pricing updated' });
      } else {
        await addDoc(collection(db, 'bulkPricing'), { ...pricingFormData, createdAt: new Date() });
        toast({ title: 'Pricing created' });
      }
      setIsPricingDialogOpen(false);
      resetPricingForm();
    } catch {
      toast({ title: 'Error', description: 'Failed to save pricing.', variant: 'destructive' });
    }
  };

  const addPricingTier = () => setPricingFormData(prev => ({ ...prev, tiers: [...prev.tiers, { minQuantity: 0, discountPercentage: 0 }] }));
  const removePricingTier = (index: number) => setPricingFormData(prev => ({ ...prev, tiers: prev.tiers.filter((_, i) => i !== index) }));
  const updatePricingTier = (index: number, field: keyof BulkPricingTier, value: number | undefined) => {
    setPricingFormData(prev => ({ ...prev, tiers: prev.tiers.map((tier, i) => i === index ? { ...tier, [field]: value } : tier) }));
  };

  const resetPricingForm = () => {
    setPricingFormData({ name: '', description: '', tiers: [{ minQuantity: 10, discountPercentage: 5 }], isActive: true });
    setEditingPricing(null);
  };

  const handleEditPricing = (pricing: BulkPricing) => {
    setEditingPricing(pricing);
    setPricingFormData({ name: pricing.name, description: pricing.description, tiers: pricing.tiers, isActive: pricing.isActive });
    setIsPricingDialogOpen(true);
  };

  const handleDeletePricing = async (id: string) => {
    if (window.confirm('Delete this pricing tier?')) {
      try {
        await deleteDoc(doc(db, 'bulkPricing', id));
        toast({ title: 'Pricing deleted' });
      } catch {
        toast({ title: 'Error', description: 'Failed to delete pricing.', variant: 'destructive' });
      }
    }
  };

  // ─── Account CRUD ─────────────────────────────────────────────────────────
  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = { ...accountFormData, discountRate: Number(accountFormData.discountRate), creditLimit: Number(accountFormData.creditLimit), createdAt: new Date() };
      if (editingAccount) {
        await updateDoc(doc(db, 'wholesaleAccounts', editingAccount.id), { ...data });
        toast({ title: 'Account updated' });
      } else {
        await addDoc(collection(db, 'wholesaleAccounts'), data);
        toast({ title: 'Account created' });
      }
      setIsAccountDialogOpen(false);
      resetAccountForm();
    } catch {
      toast({ title: 'Error', description: 'Failed to save account.', variant: 'destructive' });
    }
  };

  const resetAccountForm = () => {
    setAccountFormData({ companyName: '', contactPerson: '', email: '', phone: '', address: '', gstNumber: '', discountRate: 0, creditLimit: 0, paymentTerms: '30 days', isActive: true });
    setEditingAccount(null);
  };

  const handleEditAccount = (account: WholesaleAccount) => {
    setEditingAccount(account);
    setAccountFormData({ companyName: account.companyName, contactPerson: account.contactPerson, email: account.email, phone: account.phone, address: account.address, gstNumber: account.gstNumber || '', discountRate: account.discountRate, creditLimit: account.creditLimit, paymentTerms: account.paymentTerms, isActive: account.isActive });
    setIsAccountDialogOpen(true);
  };

  const handleDeleteAccount = async (id: string) => {
    if (window.confirm('Delete this wholesale account?')) {
      try {
        await deleteDoc(doc(db, 'wholesaleAccounts', id));
        toast({ title: 'Account deleted' });
      } catch {
        toast({ title: 'Error', description: 'Failed to delete account.', variant: 'destructive' });
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Bulk Orders Management</h1>
        <Loading size="lg" className="py-20" />
      </div>
    );
  }

  const tabs = [
    { key: 'products', label: 'Bulk Products', icon: ShoppingBag, count: bulkProducts.length },
    { key: 'pricing', label: 'Bulk Pricing', icon: Package, count: bulkPricings.length },
    { key: 'accounts', label: 'Wholesale Accounts', icon: Users, count: wholesaleAccounts.length },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bulk Orders Management</h1>
          <p className="text-muted-foreground mt-1">Manage your B2B product catalog, pricing tiers &amp; wholesale accounts</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <Button
            key={key}
            variant={activeTab === key ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(key)}
            className="gap-2"
          >
            <Icon className="h-4 w-4" />
            {label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === key ? 'bg-white/20' : 'bg-muted-foreground/20'}`}>
              {count}
            </span>
          </Button>
        ))}
      </div>

      {/* ─── BULK PRODUCTS TAB ─────────────────────────────────────────────── */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Bulk Order Products Catalog</h2>
            <Dialog open={isProductDialogOpen} onOpenChange={(open) => { setIsProductDialogOpen(open); if (!open) resetProductForm(); }}>
              <DialogTrigger asChild>
                <Button onClick={() => setIsProductDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Bulk Product
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingProduct ? 'Edit Bulk Product' : 'Add New Bulk Product'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleProductSubmit} className="space-y-4">
                  {/* Name & Slug */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="prod-name">Product Name *</Label>
                      <Input
                        id="prod-name"
                        value={productFormData.name}
                        onChange={(e) => setProductFormData(prev => ({
                          ...prev,
                          name: e.target.value,
                          slug: generateSlug(e.target.value)
                        }))}
                        placeholder="e.g. Glass Cleaner 5L"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prod-slug">URL Slug *</Label>
                      <Input
                        id="prod-slug"
                        value={productFormData.slug}
                        onChange={(e) => setProductFormData(prev => ({ ...prev, slug: e.target.value }))}
                        placeholder="glass-cleaner-5l"
                        required
                      />
                    </div>
                  </div>

                  {/* Category */}
                  <div className="space-y-2">
                    <Label htmlFor="prod-category">Category *</Label>
                    <Input
                      id="prod-category"
                      value={productFormData.category}
                      onChange={(e) => setProductFormData(prev => ({ ...prev, category: e.target.value }))}
                      placeholder="e.g. Glass Cleaner, Floor Cleaner, Air Freshener"
                      required
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="prod-desc">Description *</Label>
                    <Textarea
                      id="prod-desc"
                      value={productFormData.description}
                      onChange={(e) => setProductFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Detailed product description for the catalog page..."
                      rows={4}
                      required
                    />
                  </div>

                  {/* Price Range & MOQ */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="prod-price">Price Range *</Label>
                      <Input
                        id="prod-price"
                        value={productFormData.priceRange}
                        onChange={(e) => setProductFormData(prev => ({ ...prev, priceRange: e.target.value }))}
                        placeholder="e.g. ₹120 - ₹180 per litre"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prod-moq">MOQ (units) *</Label>
                      <Input
                        id="prod-moq"
                        type="number"
                        value={productFormData.moq}
                        onChange={(e) => setProductFormData(prev => ({ ...prev, moq: Number(e.target.value) }))}
                        placeholder="50"
                        required
                      />
                    </div>
                  </div>

                  {/* Unit */}
                  <div className="space-y-2">
                    <Label htmlFor="prod-unit">Unit</Label>
                    <Input
                      id="prod-unit"
                      value={productFormData.unit}
                      onChange={(e) => setProductFormData(prev => ({ ...prev, unit: e.target.value }))}
                      placeholder="e.g. Litre, Piece, Box, kg"
                    />
                  </div>

                  {/* Features */}
                  <div className="space-y-2">
                    <Label htmlFor="prod-features">Key Features (one per line)</Label>
                    <Textarea
                      id="prod-features"
                      value={featuresInput}
                      onChange={(e) => {
                        setFeaturesInput(e.target.value);
                        setProductFormData(prev => ({
                          ...prev,
                          features: e.target.value.split('\n').map(f => f.trim()).filter(Boolean)
                        }));
                      }}
                      placeholder={"Streak-free formula\nISO certified\nSuitable for commercial use"}
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">Each line becomes a feature bullet point</p>
                  </div>

                  {/* Image Upload */}
                  <div className="space-y-2">
                    <Label>Product Image *</Label>
                    <div
                      className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {productFormData.image ? (
                        <div className="relative">
                          <img src={productFormData.image} alt="Preview" className="h-32 w-full object-contain rounded" />
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            className="absolute top-1 right-1 h-6 w-6"
                            onClick={(e) => { e.stopPropagation(); setProductFormData(prev => ({ ...prev, image: '' })); }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : uploadingImage ? (
                        <div className="py-4 flex flex-col items-center gap-2">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                          <p className="text-sm text-muted-foreground">Uploading...</p>
                        </div>
                      ) : (
                        <div className="py-4 flex flex-col items-center gap-2">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Click to upload product image</p>
                          <p className="text-xs text-muted-foreground">JPG, PNG, WebP</p>
                        </div>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </div>

                  {/* Active toggle */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="prod-active"
                      checked={productFormData.isActive}
                      onChange={(e) => setProductFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="rounded"
                    />
                    <Label htmlFor="prod-active">Product is visible on website</Label>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsProductDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={uploadingImage}>
                      {editingProduct ? 'Update Product' : 'Add Product'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {bulkProducts.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
              <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No bulk products yet</h3>
              <p className="text-muted-foreground mb-4">Add products to your B2B catalog — they'll appear on the website at /bulk-orders</p>
              <Button onClick={() => setIsProductDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Product
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bulkProducts.map((product) => (
                <Card key={product.id} className="overflow-hidden group">
                  <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge variant={product.isActive ? 'default' : 'secondary'}>
                        {product.isActive ? 'Active' : 'Hidden'}
                      </Badge>
                    </div>
                    {product.category && (
                      <div className="absolute top-2 left-2">
                        <Badge variant="outline" className="bg-white/80 backdrop-blur-sm text-xs">
                          {product.category}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h3 className="font-semibold text-base leading-tight">{product.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-muted rounded-md p-2">
                        <div className="text-xs text-muted-foreground">Price Range</div>
                        <div className="font-semibold text-primary text-xs">{product.priceRange || '—'}</div>
                      </div>
                      <div className="bg-muted rounded-md p-2">
                        <div className="text-xs text-muted-foreground">Min. Order</div>
                        <div className="font-semibold text-xs">{product.moq} {product.unit}</div>
                      </div>
                    </div>
                    {product.features?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {product.features.slice(0, 3).map((f, i) => (
                          <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {f}
                          </span>
                        ))}
                        {product.features.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{product.features.length - 3} more</span>
                        )}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Slug: <code className="bg-muted px-1 rounded">/bulk-orders/{product.slug}</code>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEditProduct(product)}>
                        <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleDeleteProduct(product.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── PRICING TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'pricing' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Bulk Pricing Tiers</h2>
            <Dialog open={isPricingDialogOpen} onOpenChange={setIsPricingDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setIsPricingDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Pricing Tier
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingPricing ? 'Edit Pricing Tier' : 'Add New Pricing Tier'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handlePricingSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Pricing Name</Label>
                    <Input id="name" value={pricingFormData.name} onChange={(e) => setPricingFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g., Standard Bulk Pricing" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" value={pricingFormData.description} onChange={(e) => setPricingFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="Description..." rows={3} />
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Pricing Tiers</Label>
                      <Button type="button" size="sm" onClick={addPricingTier}><Plus className="h-4 w-4 mr-1" />Add Tier</Button>
                    </div>
                    {pricingFormData.tiers.map((tier, index) => (
                      <div key={index} className="grid grid-cols-4 gap-2 items-end">
                        <div><Label>Min Qty</Label><Input type="number" value={tier.minQuantity} onChange={(e) => updatePricingTier(index, 'minQuantity', Number(e.target.value))} /></div>
                        <div><Label>Max Qty</Label><Input type="number" value={tier.maxQuantity || ''} onChange={(e) => updatePricingTier(index, 'maxQuantity', e.target.value ? Number(e.target.value) : undefined)} placeholder="Optional" /></div>
                        <div><Label>Discount %</Label><Input type="number" value={tier.discountPercentage} onChange={(e) => updatePricingTier(index, 'discountPercentage', Number(e.target.value))} /></div>
                        <Button type="button" size="sm" variant="outline" onClick={() => removePricingTier(index)} disabled={pricingFormData.tiers.length === 1}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="isActivePricing" checked={pricingFormData.isActive} onChange={(e) => setPricingFormData(prev => ({ ...prev, isActive: e.target.checked }))} className="rounded" />
                    <Label htmlFor="isActivePricing">Pricing tier is active</Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsPricingDialogOpen(false)}>Cancel</Button>
                    <Button type="submit">{editingPricing ? 'Update Pricing' : 'Create Pricing'}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bulkPricings.map((pricing) => (
              <Card key={pricing.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{pricing.name}</CardTitle>
                    <Badge variant={pricing.isActive ? 'default' : 'secondary'}>{pricing.isActive ? 'Active' : 'Inactive'}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{pricing.description}</p>
                  <div className="space-y-2">
                    <h4 className="font-medium">Pricing Tiers:</h4>
                    {pricing.tiers.map((tier, index) => (
                      <div key={index} className="text-sm bg-muted p-2 rounded">{tier.minQuantity}+ items: {tier.discountPercentage}% off</div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button size="sm" variant="outline" onClick={() => handleEditPricing(pricing)}><Edit className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => handleDeletePricing(pricing.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {bulkPricings.length === 0 && (
            <div className="text-center py-20"><h3 className="text-lg font-medium mb-2">No bulk pricing tiers yet</h3><Button onClick={() => setIsPricingDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Add First Pricing Tier</Button></div>
          )}
        </div>
      )}

      {/* ─── ACCOUNTS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'accounts' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Wholesale Accounts</h2>
            <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setIsAccountDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Wholesale Account</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingAccount ? 'Edit Wholesale Account' : 'Add New Wholesale Account'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAccountSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="companyName">Company Name</Label><Input id="companyName" value={accountFormData.companyName} onChange={(e) => setAccountFormData(prev => ({ ...prev, companyName: e.target.value }))} required /></div>
                    <div className="space-y-2"><Label htmlFor="contactPerson">Contact Person</Label><Input id="contactPerson" value={accountFormData.contactPerson} onChange={(e) => setAccountFormData(prev => ({ ...prev, contactPerson: e.target.value }))} required /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={accountFormData.email} onChange={(e) => setAccountFormData(prev => ({ ...prev, email: e.target.value }))} required /></div>
                    <div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" value={accountFormData.phone} onChange={(e) => setAccountFormData(prev => ({ ...prev, phone: e.target.value }))} required /></div>
                  </div>
                  <div className="space-y-2"><Label htmlFor="address">Address</Label><Textarea id="address" value={accountFormData.address} onChange={(e) => setAccountFormData(prev => ({ ...prev, address: e.target.value }))} rows={3} /></div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2"><Label htmlFor="gstNumber">GST Number</Label><Input id="gstNumber" value={accountFormData.gstNumber} onChange={(e) => setAccountFormData(prev => ({ ...prev, gstNumber: e.target.value }))} /></div>
                    <div className="space-y-2"><Label htmlFor="discountRate">Discount Rate (%)</Label><Input id="discountRate" type="number" value={accountFormData.discountRate} onChange={(e) => setAccountFormData(prev => ({ ...prev, discountRate: Number(e.target.value) }))} /></div>
                    <div className="space-y-2"><Label htmlFor="creditLimit">Credit Limit (₹)</Label><Input id="creditLimit" type="number" value={accountFormData.creditLimit} onChange={(e) => setAccountFormData(prev => ({ ...prev, creditLimit: Number(e.target.value) }))} /></div>
                  </div>
                  <div className="space-y-2"><Label htmlFor="paymentTerms">Payment Terms</Label><Input id="paymentTerms" value={accountFormData.paymentTerms} onChange={(e) => setAccountFormData(prev => ({ ...prev, paymentTerms: e.target.value }))} /></div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="isActiveAccount" checked={accountFormData.isActive} onChange={(e) => setAccountFormData(prev => ({ ...prev, isActive: e.target.checked }))} className="rounded" />
                    <Label htmlFor="isActiveAccount">Account is active</Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsAccountDialogOpen(false)}>Cancel</Button>
                    <Button type="submit">{editingAccount ? 'Update Account' : 'Create Account'}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Credit Limit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wholesaleAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div className="font-medium">{account.companyName}</div>
                        <div className="text-sm text-muted-foreground">{account.gstNumber}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{account.contactPerson}</div>
                        <div className="text-sm text-muted-foreground">{account.email}</div>
                        <div className="text-sm text-muted-foreground">{account.phone}</div>
                      </TableCell>
                      <TableCell>{account.discountRate}%</TableCell>
                      <TableCell>₹{account.creditLimit.toLocaleString()}</TableCell>
                      <TableCell><Badge variant={account.isActive ? 'default' : 'secondary'}>{account.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEditAccount(account)}><Edit className="h-4 w-4" /></Button>
                          <Button size="sm" variant="outline" onClick={() => handleDeleteAccount(account.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {wholesaleAccounts.length === 0 && (
            <div className="text-center py-20"><h3 className="text-lg font-medium mb-2">No wholesale accounts yet</h3><Button onClick={() => setIsAccountDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Add First Account</Button></div>
          )}
        </div>
      )}
    </div>
  );
};