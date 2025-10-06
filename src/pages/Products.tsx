import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Image as ImageIcon } from 'lucide-react';
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
import { uploadImageToCloudinary } from '@/lib/cloudinary';
import { useToast } from '@/hooks/use-toast';
import { Loading } from '@/components/ui/loading';
import { useDropzone } from 'react-dropzone';

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

export const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    images: [] as string[],
    price: 0,
    salePrice: 0,
    stock: 0,
    sku: '',
    weight: '',
    dimensions: '',
    ingredients: '',
    instructions: '',
    isActive: true,
    serialNo: null as number | null
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Fetch products
    const qProducts = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribeProducts = onSnapshot(qProducts, async (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      
      // Fetch category names
      const categoriesSnapshot = await getDocs(collection(db, 'categories'));
      const categoriesMap = new Map();
      categoriesSnapshot.docs.forEach(doc => {
        categoriesMap.set(doc.id, doc.data().name);
      });
      
      const productsWithCategories = productsData.map(product => ({
        ...product,
        categoryName: categoriesMap.get(product.categoryId) || 'Unknown'
      }));
      
      // Sort: items with serialNo first (sorted by serialNo), then items without serialNo (sorted by createdAt)
      const sorted = productsWithCategories.sort((a, b) => {
  const aSerial = a.serialNo ?? Infinity; // null treated as Infinity
  const bSerial = b.serialNo ?? Infinity;
  if (aSerial !== bSerial) return aSerial - bSerial;

  // If both have null or same serialNo, fallback to latest createdAt
  return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
});

      
      setProducts(sorted);
      setLoading(false);
    });

    // Fetch categories for dropdown
    const qCategories = query(collection(db, 'categories'), orderBy('name'));
    const unsubscribeCategories = onSnapshot(qCategories, (snapshot) => {
      const categoriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      })) as Category[];
      setCategories(categoriesData);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeCategories();
    };
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 5,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setUploading(true);
        try {
          const uploadPromises = acceptedFiles.map(file => uploadImageToCloudinary(file));
          const imageUrls = await Promise.all(uploadPromises);
          setFormData(prev => ({ 
            ...prev, 
            images: [...prev.images, ...imageUrls] 
          }));
          toast({
            title: "Images uploaded",
            description: `${imageUrls.length} image(s) uploaded successfully`
          });
        } catch (error) {
          toast({
            title: "Upload failed",
            description: "Failed to upload images. Please try again.",
            variant: "destructive"
          });
        } finally {
          setUploading(false);
        }
      }
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const productData = {
        ...formData,
        price: Number(formData.price),
        salePrice: formData.salePrice ? Number(formData.salePrice) : null,
        stock: Number(formData.stock),
        serialNo: formData.serialNo !== null && formData.serialNo !== 0 ? Number(formData.serialNo) : null,
        createdAt: new Date()
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), {
          name: formData.name,
          description: formData.description,
          categoryId: formData.categoryId,
          images: formData.images,
          price: Number(formData.price),
          salePrice: formData.salePrice ? Number(formData.salePrice) : null,
          stock: Number(formData.stock),
          sku: formData.sku,
          weight: formData.weight,
          dimensions: formData.dimensions,
          ingredients: formData.ingredients,
          instructions: formData.instructions,
          isActive: formData.isActive,
          serialNo: formData.serialNo !== null && formData.serialNo !== 0 ? Number(formData.serialNo) : null,
          updatedAt: new Date()
        });
        toast({
          title: "Product updated",
          description: "Product has been updated successfully"
        });
      } else {
        await addDoc(collection(db, 'products'), productData);
        toast({
          title: "Product created",
          description: "New product has been created successfully"
        });
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save product. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      categoryId: product.categoryId,
      images: product.images || [],
      price: product.price,
      salePrice: product.salePrice || 0,
      stock: product.stock,
      sku: product.sku,
      weight: product.weight || '',
      dimensions: product.dimensions || '',
      ingredients: product.ingredients || '',
      instructions: product.instructions || '',
      isActive: product.isActive,
      serialNo: product.serialNo
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteDoc(doc(db, 'products', id));
        toast({
          title: "Product deleted",
          description: "Product has been deleted successfully"
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete product. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      categoryId: '',
      images: [],
      price: 0,
      salePrice: 0,
      stock: 0,
      sku: '',
      weight: '',
      dimensions: '',
      ingredients: '',
      instructions: '',
      isActive: true,
      serialNo: null
    });
    setEditingProduct(null);
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Products</h1>
        <Loading size="lg" className="py-20" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Products</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Premium Floor Cleaner"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                    placeholder="e.g., PFC-001"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.categoryId} onValueChange={(value) => setFormData(prev => ({ ...prev, categoryId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serialNo">Serial Number</Label>
                  <Input
                    id="serialNo"
                    type="number"
                    value={formData.serialNo === null ? '' : formData.serialNo}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      serialNo: e.target.value === '' ? null : Number(e.target.value)
                    }))}
                    placeholder="e.g., 1, 2, 3..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Product description..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (₹)</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: Number(e.target.value) }))}
                    placeholder="0"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salePrice">Sale Price (₹)</Label>
                  <Input
                    id="salePrice"
                    type="number"
                    value={formData.salePrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, salePrice: Number(e.target.value) }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Stock Quantity</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData(prev => ({ ...prev, stock: Number(e.target.value) }))}
                    placeholder="0"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight</Label>
                  <Input
                    id="weight"
                    value={formData.weight}
                    onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                    placeholder="e.g., 500ml, 1kg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dimensions">Dimensions</Label>
                  <Input
                    id="dimensions"
                    value={formData.dimensions}
                    onChange={(e) => setFormData(prev => ({ ...prev, dimensions: e.target.value }))}
                    placeholder="e.g., 15x8x25 cm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ingredients">Ingredients</Label>
                <Textarea
                  id="ingredients"
                  value={formData.ingredients}
                  onChange={(e) => setFormData(prev => ({ ...prev, ingredients: e.target.value }))}
                  placeholder="List of ingredients..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Usage Instructions</Label>
                <Textarea
                  id="instructions"
                  value={formData.instructions}
                  onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                  placeholder="How to use this product..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Product Images</Label>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    isDragActive ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                  }`}
                >
                  <input {...getInputProps()} />
                  {uploading ? (
                    <div>
                      <Loading size="md" className="mb-2" />
                      <p>Uploading images...</p>
                    </div>
                  ) : (
                    <div>
                      <ImageIcon className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                      <p>Drag & drop images here, or click to select</p>
                      <p className="text-sm text-muted-foreground">PNG, JPG, WebP up to 10MB (max 5 images)</p>
                    </div>
                  )}
                </div>
                
                {formData.images.length > 0 && (
                  <div className="grid grid-cols-5 gap-2 mt-4">
                    {formData.images.map((image, index) => (
                      <div key={index} className="relative">
                        <img 
                          src={image} 
                          alt={`Product ${index + 1}`} 
                          className="w-full h-20 object-cover rounded-lg"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                          onClick={() => removeImage(index)}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="isActive">Product is active</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || uploading}>
                  {saving ? (
                    <>
                      <Loading size="sm" className="mr-2" />
                      Saving...
                    </>
                  ) : (
                    editingProduct ? 'Update Product' : 'Create Product'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <Card key={product.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {product.serialNo !== null && (
                    <Badge variant="outline" className="text-xs">
                      #{product.serialNo}
                    </Badge>
                  )}
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                </div>
                <Badge variant={product.isActive ? "default" : "secondary"}>
                  {product.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{product.categoryName}</p>
            </CardHeader>
            <CardContent>
              {product.images && product.images.length > 0 && (
                <img 
                  src={product.images[0]} 
                  alt={product.name}
                  className="w-full h-32 object-cover rounded-lg mb-3"
                />
              )}
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {product.description}
              </p>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold">₹{product.price}</p>
                  {product.salePrice && (
                    <p className="text-sm text-green-600">Sale: ₹{product.salePrice}</p>
                  )}
                </div>
                <Badge variant={product.stock > 0 ? "default" : "destructive"}>
                  Stock: {product.stock}
                </Badge>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(product)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(product.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center py-20">
          <h3 className="text-lg font-medium mb-2">No products yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first product to start building your inventory
          </p>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Product
          </Button>
        </div>
      )}
    </div>
  );
};