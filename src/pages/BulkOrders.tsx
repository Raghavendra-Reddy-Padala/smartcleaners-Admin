import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Users, Package } from 'lucide-react';
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

export const BulkOrders: React.FC = () => {
  const [bulkPricings, setBulkPricings] = useState<BulkPricing[]>([]);
  const [wholesaleAccounts, setWholesaleAccounts] = useState<WholesaleAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPricingDialogOpen, setIsPricingDialogOpen] = useState(false);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [editingPricing, setEditingPricing] = useState<BulkPricing | null>(null);
  const [editingAccount, setEditingAccount] = useState<WholesaleAccount | null>(null);
  const [activeTab, setActiveTab] = useState<'pricing' | 'accounts'>('pricing');
  
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

  const { toast } = useToast();

  useEffect(() => {
    // Fetch bulk pricing
    const qPricing = query(collection(db, 'bulkPricing'), orderBy('createdAt', 'desc'));
    const unsubscribePricing = onSnapshot(qPricing, (snapshot) => {
      const pricingData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BulkPricing[];
      setBulkPricings(pricingData);
    });

    // Fetch wholesale accounts
    const qAccounts = query(collection(db, 'wholesaleAccounts'), orderBy('createdAt', 'desc'));
    const unsubscribeAccounts = onSnapshot(qAccounts, (snapshot) => {
      const accountsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WholesaleAccount[];
      setWholesaleAccounts(accountsData);
      setLoading(false);
    });

    return () => {
      unsubscribePricing();
      unsubscribeAccounts();
    };
  }, []);

  const handlePricingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const pricingData = {
        ...pricingFormData,
        createdAt: new Date()
      };

      if (editingPricing) {
        await updateDoc(doc(db, 'bulkPricing', editingPricing.id), {
          ...pricingFormData,
          updatedAt: new Date()
        });
        toast({
          title: "Pricing updated",
          description: "Bulk pricing has been updated successfully"
        });
      } else {
        await addDoc(collection(db, 'bulkPricing'), pricingData);
        toast({
          title: "Pricing created",
          description: "New bulk pricing has been created successfully"
        });
      }

      setIsPricingDialogOpen(false);
      resetPricingForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save pricing. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const accountData = {
        ...accountFormData,
        discountRate: Number(accountFormData.discountRate),
        creditLimit: Number(accountFormData.creditLimit),
        createdAt: new Date()
      };

      if (editingAccount) {
        await updateDoc(doc(db, 'wholesaleAccounts', editingAccount.id), {
          ...accountFormData,
          discountRate: Number(accountFormData.discountRate),
          creditLimit: Number(accountFormData.creditLimit),
          updatedAt: new Date()
        });
        toast({
          title: "Account updated",
          description: "Wholesale account has been updated successfully"
        });
      } else {
        await addDoc(collection(db, 'wholesaleAccounts'), accountData);
        toast({
          title: "Account created",
          description: "New wholesale account has been created successfully"
        });
      }

      setIsAccountDialogOpen(false);
      resetAccountForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save account. Please try again.",
        variant: "destructive"
      });
    }
  };

  const addPricingTier = () => {
    setPricingFormData(prev => ({
      ...prev,
      tiers: [...prev.tiers, { minQuantity: 0, discountPercentage: 0 }]
    }));
  };

  const removePricingTier = (index: number) => {
    setPricingFormData(prev => ({
      ...prev,
      tiers: prev.tiers.filter((_, i) => i !== index)
    }));
  };

  const updatePricingTier = (index: number, field: keyof BulkPricingTier, value: number | undefined) => {
    setPricingFormData(prev => ({
      ...prev,
      tiers: prev.tiers.map((tier, i) => 
        i === index ? { ...tier, [field]: value } : tier
      )
    }));
  };

  const resetPricingForm = () => {
    setPricingFormData({
      name: '',
      description: '',
      tiers: [{ minQuantity: 10, discountPercentage: 5 }],
      isActive: true
    });
    setEditingPricing(null);
  };

  const resetAccountForm = () => {
    setAccountFormData({
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
    setEditingAccount(null);
  };

  const handleEditPricing = (pricing: BulkPricing) => {
    setEditingPricing(pricing);
    setPricingFormData({
      name: pricing.name,
      description: pricing.description,
      tiers: pricing.tiers,
      isActive: pricing.isActive
    });
    setIsPricingDialogOpen(true);
  };

  const handleEditAccount = (account: WholesaleAccount) => {
    setEditingAccount(account);
    setAccountFormData({
      companyName: account.companyName,
      contactPerson: account.contactPerson,
      email: account.email,
      phone: account.phone,
      address: account.address,
      gstNumber: account.gstNumber || '',
      discountRate: account.discountRate,
      creditLimit: account.creditLimit,
      paymentTerms: account.paymentTerms,
      isActive: account.isActive
    });
    setIsAccountDialogOpen(true);
  };

  const handleDeletePricing = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this pricing tier?')) {
      try {
        await deleteDoc(doc(db, 'bulkPricing', id));
        toast({
          title: "Pricing deleted",
          description: "Bulk pricing has been deleted successfully"
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete pricing. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this wholesale account?')) {
      try {
        await deleteDoc(doc(db, 'wholesaleAccounts', id));
        toast({
          title: "Account deleted",
          description: "Wholesale account has been deleted successfully"
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete account. Please try again.",
          variant: "destructive"
        });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Bulk Orders Management</h1>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
        <Button
          variant={activeTab === 'pricing' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('pricing')}
        >
          <Package className="h-4 w-4 mr-2" />
          Bulk Pricing
        </Button>
        <Button
          variant={activeTab === 'accounts' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('accounts')}
        >
          <Users className="h-4 w-4 mr-2" />
          Wholesale Accounts
        </Button>
      </div>

      {/* Bulk Pricing Tab */}
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
                  <DialogTitle>
                    {editingPricing ? 'Edit Pricing Tier' : 'Add New Pricing Tier'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handlePricingSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Pricing Name</Label>
                    <Input
                      id="name"
                      value={pricingFormData.name}
                      onChange={(e) => setPricingFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Standard Bulk Pricing"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={pricingFormData.description}
                      onChange={(e) => setPricingFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Description of the pricing tier..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Pricing Tiers</Label>
                      <Button type="button" size="sm" onClick={addPricingTier}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Tier
                      </Button>
                    </div>
                    
                    {pricingFormData.tiers.map((tier, index) => (
                      <div key={index} className="grid grid-cols-4 gap-2 items-end">
                        <div>
                          <Label>Min Quantity</Label>
                          <Input
                            type="number"
                            value={tier.minQuantity}
                            onChange={(e) => updatePricingTier(index, 'minQuantity', Number(e.target.value))}
                            placeholder="10"
                          />
                        </div>
                        <div>
                          <Label>Max Quantity</Label>
                          <Input
                            type="number"
                            value={tier.maxQuantity || ''}
                            onChange={(e) => updatePricingTier(index, 'maxQuantity', e.target.value ? Number(e.target.value) : undefined)}
                            placeholder="Optional"
                          />
                        </div>
                        <div>
                          <Label>Discount %</Label>
                          <Input
                            type="number"
                            value={tier.discountPercentage}
                            onChange={(e) => updatePricingTier(index, 'discountPercentage', Number(e.target.value))}
                            placeholder="5"
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => removePricingTier(index)}
                          disabled={pricingFormData.tiers.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isActivePricing"
                      checked={pricingFormData.isActive}
                      onChange={(e) => setPricingFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="rounded"
                    />
                    <Label htmlFor="isActivePricing">Pricing tier is active</Label>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsPricingDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingPricing ? 'Update Pricing' : 'Create Pricing'}
                    </Button>
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
                    <Badge variant={pricing.isActive ? "default" : "secondary"}>
                      {pricing.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{pricing.description}</p>
                  <div className="space-y-2">
                    <h4 className="font-medium">Pricing Tiers:</h4>
                    {pricing.tiers.map((tier, index) => (
                      <div key={index} className="text-sm bg-muted p-2 rounded">
                        {tier.minQuantity}+ items: {tier.discountPercentage}% off
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditPricing(pricing)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeletePricing(pricing.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Wholesale Accounts Tab */}
      {activeTab === 'accounts' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Wholesale Accounts</h2>
            <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setIsAccountDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Wholesale Account
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingAccount ? 'Edit Wholesale Account' : 'Add New Wholesale Account'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAccountSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input
                        id="companyName"
                        value={accountFormData.companyName}
                        onChange={(e) => setAccountFormData(prev => ({ ...prev, companyName: e.target.value }))}
                        placeholder="Company Name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactPerson">Contact Person</Label>
                      <Input
                        id="contactPerson"
                        value={accountFormData.contactPerson}
                        onChange={(e) => setAccountFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                        placeholder="Contact Person"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={accountFormData.email}
                        onChange={(e) => setAccountFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="email@company.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={accountFormData.phone}
                        onChange={(e) => setAccountFormData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+91 9876543210"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={accountFormData.address}
                      onChange={(e) => setAccountFormData(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Complete company address..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gstNumber">GST Number</Label>
                      <Input
                        id="gstNumber"
                        value={accountFormData.gstNumber}
                        onChange={(e) => setAccountFormData(prev => ({ ...prev, gstNumber: e.target.value }))}
                        placeholder="GST Number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="discountRate">Discount Rate (%)</Label>
                      <Input
                        id="discountRate"
                        type="number"
                        value={accountFormData.discountRate}
                        onChange={(e) => setAccountFormData(prev => ({ ...prev, discountRate: Number(e.target.value) }))}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="creditLimit">Credit Limit (₹)</Label>
                      <Input
                        id="creditLimit"
                        type="number"
                        value={accountFormData.creditLimit}
                        onChange={(e) => setAccountFormData(prev => ({ ...prev, creditLimit: Number(e.target.value) }))}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paymentTerms">Payment Terms</Label>
                    <Input
                      id="paymentTerms"
                      value={accountFormData.paymentTerms}
                      onChange={(e) => setAccountFormData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                      placeholder="30 days"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isActiveAccount"
                      checked={accountFormData.isActive}
                      onChange={(e) => setAccountFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="rounded"
                    />
                    <Label htmlFor="isActiveAccount">Account is active</Label>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsAccountDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingAccount ? 'Update Account' : 'Create Account'}
                    </Button>
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
                        <div>
                          <div className="font-medium">{account.companyName}</div>
                          <div className="text-sm text-muted-foreground">{account.gstNumber}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{account.contactPerson}</div>
                          <div className="text-sm text-muted-foreground">{account.email}</div>
                          <div className="text-sm text-muted-foreground">{account.phone}</div>
                        </div>
                      </TableCell>
                      <TableCell>{account.discountRate}%</TableCell>
                      <TableCell>₹{account.creditLimit.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={account.isActive ? "default" : "secondary"}>
                          {account.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditAccount(account)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteAccount(account.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty States */}
      {activeTab === 'pricing' && bulkPricings.length === 0 && (
        <div className="text-center py-20">
          <h3 className="text-lg font-medium mb-2">No bulk pricing tiers yet</h3>
          <p className="text-muted-foreground mb-4">
            Create pricing tiers to offer discounts for bulk purchases
          </p>
          <Button onClick={() => setIsPricingDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Pricing Tier
          </Button>
        </div>
      )}

      {activeTab === 'accounts' && wholesaleAccounts.length === 0 && (
        <div className="text-center py-20">
          <h3 className="text-lg font-medium mb-2">No wholesale accounts yet</h3>
          <p className="text-muted-foreground mb-4">
            Add wholesale accounts to manage B2B customers
          </p>
          <Button onClick={() => setIsAccountDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Account
          </Button>
        </div>
      )}
    </div>
  );
};