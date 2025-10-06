import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Image as ImageIcon } from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { useToast } from "@/hooks/use-toast";
import { Loading } from "@/components/ui/loading";
import { useDropzone } from "react-dropzone";

interface Category {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  isActive: boolean;
  serialNo: number | null;
  createdAt: any;
}

export const Categories: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    imageUrl: "",
    isActive: true,
    serialNo: null as number | null,
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const q = query(collection(db, "categories"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const categoriesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Category[];

      // Sort: items with serialNo first (sorted by serialNo), then items without serialNo (sorted by createdAt)
      const sorted = categoriesData.sort((a, b) => {
        const aSerial = a.serialNo ?? Infinity; // treat nulls as Infinity → go last
        const bSerial = b.serialNo ?? Infinity;

        // Sort by serial number if both have values
        if (aSerial !== bSerial) return aSerial - bSerial;

        // If both have same or null serialNo, sort by createdAt (latest first)
        return (
          (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
        );
      });

      setCategories(sorted);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".webp"],
    },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setUploading(true);
        try {
          const imageUrl = await uploadImageToCloudinary(acceptedFiles[0]);
          setFormData((prev) => ({ ...prev, imageUrl }));
          toast({
            title: "Image uploaded",
            description: "Category image has been uploaded successfully",
          });
        } catch (error) {
          toast({
            title: "Upload failed",
            description: "Failed to upload image. Please try again.",
            variant: "destructive",
          });
        } finally {
          setUploading(false);
        }
      }
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const categoryData = {
        ...formData,
        serialNo:
          formData.serialNo !== null && formData.serialNo !== 0
            ? Number(formData.serialNo)
            : null,
        createdAt: new Date(),
      };

      if (editingCategory) {
        await updateDoc(doc(db, "categories", editingCategory.id), {
          name: formData.name,
          description: formData.description,
          imageUrl: formData.imageUrl,
          isActive: formData.isActive,
          serialNo:
            formData.serialNo !== null && formData.serialNo !== 0
              ? Number(formData.serialNo)
              : null,
          updatedAt: new Date(),
        });
        toast({
          title: "Category updated",
          description: "Category has been updated successfully",
        });
      } else {
        await addDoc(collection(db, "categories"), categoryData);
        toast({
          title: "Category created",
          description: "New category has been created successfully",
        });
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save category. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description,
      imageUrl: category.imageUrl,
      isActive: category.isActive,
      serialNo: category.serialNo,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this category?")) {
      try {
        await deleteDoc(doc(db, "categories", id));
        toast({
          title: "Category deleted",
          description: "Category has been deleted successfully",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete category. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      imageUrl: "",
      isActive: true,
      serialNo: null,
    });
    setEditingCategory(null);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Categories</h1>
        <Loading size="lg" className="py-20" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Categories</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Edit Category" : "Add New Category"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Category Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="e.g., Floor Cleaners"
                    required
                    className="admin-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serialNo">Serial Number</Label>
                  <Input
                    id="serialNo"
                    type="number"
                    value={formData.serialNo === null ? "" : formData.serialNo}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        serialNo:
                          e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    placeholder="e.g., 1, 2, 3..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        isActive: e.target.checked,
                      }))
                    }
                    className="rounded"
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Category description..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Category Image</Label>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    isDragActive
                      ? "border-primary bg-primary-light"
                      : "hover:border-primary/50"
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
                        alt="Category"
                        className="w-20 h-20 object-cover rounded-lg mx-auto mb-2"
                      />
                      <p className="text-sm text-muted-foreground">
                        Click or drag to change image
                      </p>
                    </div>
                  ) : (
                    <div>
                      <ImageIcon className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                      <p>Drag & drop an image here, or click to select</p>
                      <p className="text-sm text-muted-foreground">
                        PNG, JPG, WebP up to 10MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDialogClose}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || uploading}>
                  {saving ? (
                    <>
                      <Loading size="sm" className="mr-2" />
                      Saving...
                    </>
                  ) : editingCategory ? (
                    "Update Category"
                  ) : (
                    "Create Category"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => (
          <Card key={category.id} className="dashboard-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {category.serialNo !== null && (
                    <Badge variant="outline" className="text-xs">
                      #{category.serialNo}
                    </Badge>
                  )}
                  <CardTitle className="text-lg">{category.name}</CardTitle>
                </div>
                <Badge variant={category.isActive ? "default" : "secondary"}>
                  {category.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {category.imageUrl && (
                <img
                  src={category.imageUrl}
                  alt={category.name}
                  className="w-full h-32 object-cover rounded-lg mb-3"
                />
              )}
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {category.description}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(category)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(category.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-20">
          <h3 className="text-lg font-medium mb-2">No categories yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first category to start organizing your products
          </p>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Category
          </Button>
        </div>
      )}
    </div>
  );
};
