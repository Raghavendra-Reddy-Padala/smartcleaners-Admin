import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Trash2, Package, X } from 'lucide-react';
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
  price: number;
  imageUrl?: string;
  isActive: boolean;
}

interface ComboProduct {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

interface Combo {
  id: string;
  name: string;
  description: string;
  products: ComboProduct[];
  originalPrice: number;
  comboPrice: number;
  savings: number;
  imageUrl: string;
  isActive: boolean;
  isFeatured: boolean;
  validFrom?: any;
  validUntil?: any;
  createdAt: any;
}

export const ComboOrders: React.FC = () => {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    products: [] as ComboProduct[],
    comboPrice: 0,
    imageUrl: '',
    isActive: true,
    isFeatured: false,
    validFrom: '',
    validUntil: ''
  });
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Fetch combos
    const qCombos = query(collection(db, 'combos'), orderBy('createdAt', 'desc'));
    const unsubscribeCombos = onSnapshot(qCombos, (snapshot) => {
      const combosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Combo[];
      setCombos(combosData);
    });

    // Fetch products
    const qProducts = query(collection(db, 'products'), orderBy('name'));
    const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        price: doc.data().price,
        imageUrl: doc.data().images?.[0],
        isActive: doc.data().isActive
      })) as Product[];
      setProducts(productsData.filter(p => p.isActive));
      setLoading(false);
    });

    return () => {
      unsubscribeCombos();
      unsubscribeProducts();
    };
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setUploading(true);
        try {
          const imageUrl = await uploadImageToCloudinary(acceptedFiles[0]);
          setFormData(prev => ({ ...prev, imageUrl }));
          toast({
            title: "Image uploaded",
            description: "Combo image has been uploaded successfully"
          });
        } catch (error) {
          toast({
            title: "Upload failed",
            description: "Failed to upload image. Please try again.",
            variant: "destructive"
          });
        } finally {
          setUploading(false);
        }
      }
    }
  });

  const handleProductSelection = (productId: string, isSelected: boolean) => {
    if (isSelected) {
      const product = products.find(p => p.id === productId);
      if (product) {
        setFormData(prev => ({
          ...prev,
          products: [...prev.products, {
            productId: product.id,
            productName: product.name,
            quantity: 1,
            price: product.price
          }]
        }));
        setSelectedProducts(prev => [...prev, productId]);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        products: prev.products.filter(p => p.productId !== productId)
      }));
      setSelectedProducts(prev => prev.filter(id => id !== productId));
    }
  };

  const updateProductQuantity = (productId: string, quantity: number) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.map(p => 
        p.productId === productId ? { ...p, quantity } : p
      )
    }));
  };

  const removeProduct = (productId: string) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.filter(p => p.productId !== productId)
    }));
    setSelectedProducts(prev => prev.filter(id => id !== productId));
  };

  const calculateOriginalPrice = () => {
    return formData.products.reduce((total, product) => total + (product.price * product.quantity), 0);
  };

  const calculateSavings = () => {
    const originalPrice = calculateOriginalPrice();
    return originalPrice - formData.comboPrice;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (formData.products.length < 2) {
      toast({
        title: "Error",
        description: "A combo must have at least 2 products",
        variant: "destructive"
      });
      setSaving(false);
      return;
    }

    try {
      const originalPrice = calculateOriginalPrice();
      const savings = calculateSavings();

      const comboData = {
        ...formData,
        originalPrice,
        savings,
        comboPrice: Number(formData.comboPrice),
        validFrom: formData.validFrom ? new Date(formData.validFrom) : null,
        validUntil: formData.validUntil ? new Date(formData.validUntil) : null,
        createdAt: new Date()
      };

      if (editingCombo) {
        await updateDoc(doc(db, 'combos', editingCombo.id), {
          ...formData,
          originalPrice,
          savings,
          comboPrice: Number(formData.comboPrice),
          validFrom: formData.validFrom ? new Date(formData.validFrom) : null,
          validUntil: formData.validUntil ? new Date(formData.validUntil) : null,
          updatedAt: new Date()
        });
        toast({
          title: "Combo updated",
          description: "Combo has been updated successfully"
        });
      } else {
        await addDoc(collection(db, 'combos'), comboData);
        toast({
          title: "Combo created",
          description: "New combo has been created successfully"
        });
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save combo. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (combo: Combo) => {
    setEditingCombo(combo);
    setFormData({
      name: combo.name,
      description: combo.description,
      products: combo.products,
      comboPrice: combo.comboPrice,
      imageUrl: combo.imageUrl,
      isActive: combo.isActive,
      isFeatured: combo.isFeatured,
      validFrom: combo.validFrom ? combo.validFrom.toDate().toISOString().split('T')[0] : '',
      validUntil: combo.validUntil ? combo.validUntil.toDate().toISOString().split('T')[0] : ''
    });
    setSelectedProducts(combo.products.map(p => p.productId));
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this combo?')) {
      try {
        await deleteDoc(doc(db, 'combos', id));
        toast({
          title: "Combo deleted",
          description: "Combo has been deleted successfully"
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete combo. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      products: [],
      comboPrice: 0,
      imageUrl: '',
      isActive: true,
      isFeatured: false,
      validFrom: '',
      validUntil: ''
    });
    setSelectedProducts([]);
    setEditingCombo(null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Combo Orders</h1>
        <Loading size="lg" className="py-20" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Combo Orders</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Combo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCombo ? 'Edit Combo' : 'Create New Combo'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Combo Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Complete Kitchen Cleaning Kit"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comboPrice">Combo Price (₹)</Label>
                  <Input
                    id="comboPrice"
                    type="number"
                    value={formData.comboPrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, comboPrice: Number(e.target.value) }))}
                    placeholder="0"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe this combo package..."
                  rows={3}
                />
              </div>

              {/* Product Selection */}
              <div className="space-y-4">
                <Label>Select Products for Combo</Label>
                <div className="grid grid-cols-2 gap-4 max-h-60 overflow-y-auto border rounded-lg p-4">
                  {products.map((product) => (
                    <div key={product.id} className="flex items-center space-x-3">
                      <Checkbox
                        id={product.id}
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={(checked) => handleProductSelection(product.id, checked as boolean)}
                      />
                      <div className="flex-1">
                        <Label htmlFor={product.id} className="cursor-pointer">
                          {product.name} - ₹{product.price}
                        </Label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected Products */}
              {formData.products.length > 0 && (
                <div className="space-y-4">
                  <Label>Selected Products</Label>
                  <div className="space-y-2">
                    {formData.products.map((product) => (
                      <div key={product.productId} className="flex items-center gap-4 p-3 border rounded-lg">
                        <div className="flex-1">
                          <span className="font-medium">{product.productName}</span>
                          <span className="text-muted-foreground ml-2">₹{product.price}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label>Qty:</Label>
                          <Input
                            type="number"
                            min="1"
                            value={product.quantity}
                            onChange={(e) => updateProductQuantity(product.productId, Number(e.target.value))}
                            className="w-20"
                          />
                        </div>
                        <div className="text-sm font-medium">
                          ₹{(product.price * product.quantity).toLocaleString()}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => removeProduct(product.productId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  {/* Price Summary */}
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span>Original Price:</span>
                      <span className="line-through">₹{calculateOriginalPrice().toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span>Combo Price:</span>
                      <span className="font-bold">₹{formData.comboPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-green-600 font-medium">
                      <span>Savings:</span>
                      <span>₹{calculateSavings().toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Combo Image */}
              <div className="space-y-2">
                <Label>Combo Image</Label>
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
                      <p>Uploading image...</p>
                    </div>
                  ) : formData.imageUrl ? (
                    <div>
                      <img 
                        src={formData.imageUrl} 
                        alt="Combo" 
                        className="w-20 h-20 object-cover rounded-lg mx-auto mb-2"
                      />
                      <p className="text-sm text-muted-foreground">Click or drag to change image</p>
                    </div>
                  ) : (
                    <div>
                      <Package className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                      <p>Drag & drop an image here, or click to select</p>
                      <p className="text-sm text-muted-foreground">PNG, JPG, WebP up to 10MB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Validity Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="validFrom">Valid From</Label>
                  <Input
                    id="validFrom"
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) => setFormData(prev => ({ ...prev, validFrom: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="validUntil">Valid Until</Label>
                  <Input
                    id="validUntil"
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
                  />
                </div>
              </div>

              {/* Status Checkboxes */}
              <div className="flex items-center gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked as boolean }))}
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isFeatured"
                    checked={formData.isFeatured}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isFeatured: checked as boolean }))}
                  />
                  <Label htmlFor="isFeatured">Featured</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || uploading || formData.products.length < 2}>
                  {saving ? (
                    <>
                      <Loading size="sm" className="mr-2" />
                      Saving...
                    </>
                  ) : (
                    editingCombo ? 'Update Combo' : 'Create Combo'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Combos Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {combos.map((combo) => (
          <Card key={combo.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{combo.name}</CardTitle>
                <div className="flex gap-1">
                  <Badge variant={combo.isActive ? "default" : "secondary"}>
                    {combo.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {combo.isFeatured && (
                    <Badge variant="destructive">Featured</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {combo.imageUrl && (
                <img 
                  src={combo.imageUrl} 
                  alt={combo.name}
                  className="w-full h-32 object-cover rounded-lg mb-3"
                />
              )}
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {combo.description}
              </p>
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground line-through">₹{combo.originalPrice}</span>
                  <span className="font-bold text-lg">₹{combo.comboPrice}</span>
                </div>
                <div className="text-green-600 text-sm font-medium">
                  Save ₹{combo.savings} ({Math.round((combo.savings / combo.originalPrice) * 100)}% off)
                </div>
                <div className="text-sm text-muted-foreground">
                  {combo.products.length} products included
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(combo)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(combo.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {combos.length === 0 && (
        <div className="text-center py-20">
          <h3 className="text-lg font-medium mb-2">No combos yet</h3>
          <p className="text-muted-foreground mb-4">
            Create combo packages to offer bundled products at discounted prices
          </p>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create First Combo
          </Button>
        </div>
      )}
    </div>
  );
};