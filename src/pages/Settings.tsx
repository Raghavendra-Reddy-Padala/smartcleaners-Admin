import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Save, Shield, Bell, Mail, Store, User, Key, Database } from 'lucide-react';
import { db } from '@/lib/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loading } from '@/components/ui/loading';

interface StoreSettings {
  storeName: string;
  storeDescription: string;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  currency: string;
  timezone: string;
  taxRate: number;
  shippingCost: number;
  freeShippingThreshold: number;
}

interface NotificationSettings {
  emailNotifications: boolean;
  orderNotifications: boolean;
  stockAlerts: boolean;
  dailyReports: boolean;
  marketingEmails: boolean;
}

interface SecuritySettings {
  twoFactorAuth: boolean;
  sessionTimeout: number;
  passwordExpiry: number;
  loginAttempts: number;
}

export const Settings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('store');
  const { currentUser, logout } = useAuth();
  const { toast } = useToast();

  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    storeName: 'Smart Cleaners',
    storeDescription: 'Premium quality cleaning products for every home and business',
    storeAddress: '123 Cleaning Street, Mumbai, Maharashtra 400001',
    storePhone: '+91 9876543210',
    storeEmail: 'admin@smartcleaners.in',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    taxRate: 18,
    shippingCost: 50,
    freeShippingThreshold: 500
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    orderNotifications: true,
    stockAlerts: true,
    dailyReports: false,
    marketingEmails: false
  });

  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    twoFactorAuth: false,
    sessionTimeout: 30,
    passwordExpiry: 90,
    loginAttempts: 5
  });

  const [adminProfile, setAdminProfile] = useState({
    displayName: 'Smart Cleaners Admin',
    email: 'admin@smartcleaners.in',
    phone: '+91 9876543210',
    role: 'Super Administrator'
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Load store settings
      const storeDoc = await getDoc(doc(db, 'settings', 'store'));
      if (storeDoc.exists()) {
        setStoreSettings({ ...storeSettings, ...storeDoc.data() });
      }

      // Load notification settings
      const notificationDoc = await getDoc(doc(db, 'settings', 'notifications'));
      if (notificationDoc.exists()) {
        setNotificationSettings({ ...notificationSettings, ...notificationDoc.data() });
      }

      // Load security settings
      const securityDoc = await getDoc(doc(db, 'settings', 'security'));
      if (securityDoc.exists()) {
        setSecuritySettings({ ...securitySettings, ...securityDoc.data() });
      }

      // Load admin profile
      if (currentUser) {
        setAdminProfile({
          displayName: currentUser.displayName || 'Smart Cleaners Admin',
          email: currentUser.email || 'admin@smartcleaners.in',
          phone: '+91 9876543210',
          role: 'Super Administrator'
        });
      }

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveStoreSettings = async () => {
    try {
      setSaving(true);
      await setDoc(doc(db, 'settings', 'store'), {
        ...storeSettings,
        updatedAt: new Date(),
        updatedBy: currentUser?.uid
      });
      toast({
        title: "Settings saved",
        description: "Store settings have been updated successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save store settings",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const saveNotificationSettings = async () => {
    try {
      setSaving(true);
      await setDoc(doc(db, 'settings', 'notifications'), {
        ...notificationSettings,
        updatedAt: new Date(),
        updatedBy: currentUser?.uid
      });
      toast({
        title: "Settings saved",
        description: "Notification settings have been updated successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save notification settings",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const saveSecuritySettings = async () => {
    try {
      setSaving(true);
      await setDoc(doc(db, 'settings', 'security'), {
        ...securitySettings,
        updatedAt: new Date(),
        updatedBy: currentUser?.uid
      });
      toast({
        title: "Settings saved",
        description: "Security settings have been updated successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save security settings",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Loading size="lg" className="py-20" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Button onClick={handleLogout} variant="outline">
          Logout
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="store" className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            Store
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
        </TabsList>

        {/* Store Settings */}
        <TabsContent value="store" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Store Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="storeName">Store Name</Label>
                  <Input
                    id="storeName"
                    value={storeSettings.storeName}
                    onChange={(e) => setStoreSettings(prev => ({ ...prev, storeName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storeEmail">Store Email</Label>
                  <Input
                    id="storeEmail"
                    type="email"
                    value={storeSettings.storeEmail}
                    onChange={(e) => setStoreSettings(prev => ({ ...prev, storeEmail: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="storeDescription">Store Description</Label>
                <Textarea
                  id="storeDescription"
                  value={storeSettings.storeDescription}
                  onChange={(e) => setStoreSettings(prev => ({ ...prev, storeDescription: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="storePhone">Phone Number</Label>
                  <Input
                    id="storePhone"
                    value={storeSettings.storePhone}
                    onChange={(e) => setStoreSettings(prev => ({ ...prev, storePhone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={storeSettings.currency}
                    onChange={(e) => setStoreSettings(prev => ({ ...prev, currency: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="storeAddress">Store Address</Label>
                <Textarea
                  id="storeAddress"
                  value={storeSettings.storeAddress}
                  onChange={(e) => setStoreSettings(prev => ({ ...prev, storeAddress: e.target.value }))}
                  rows={3}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    value={storeSettings.taxRate}
                    onChange={(e) => setStoreSettings(prev => ({ ...prev, taxRate: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shippingCost">Shipping Cost (₹)</Label>
                  <Input
                    id="shippingCost"
                    type="number"
                    value={storeSettings.shippingCost}
                    onChange={(e) => setStoreSettings(prev => ({ ...prev, shippingCost: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="freeShippingThreshold">Free Shipping Above (₹)</Label>
                  <Input
                    id="freeShippingThreshold"
                    type="number"
                    value={storeSettings.freeShippingThreshold}
                    onChange={(e) => setStoreSettings(prev => ({ ...prev, freeShippingThreshold: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveStoreSettings} disabled={saving}>
                  {saving ? (
                    <>
                      <Loading size="sm" className="mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Store Settings
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="emailNotifications">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive email notifications for important events</p>
                  </div>
                  <Switch
                    id="emailNotifications"
                    checked={notificationSettings.emailNotifications}
                    onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, emailNotifications: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="orderNotifications">Order Notifications</Label>
                    <p className="text-sm text-muted-foreground">Get notified when new orders are placed</p>
                  </div>
                  <Switch
                    id="orderNotifications"
                    checked={notificationSettings.orderNotifications}
                    onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, orderNotifications: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="stockAlerts">Stock Alerts</Label>
                    <p className="text-sm text-muted-foreground">Receive alerts when products are running low</p>
                  </div>
                  <Switch
                    id="stockAlerts"
                    checked={notificationSettings.stockAlerts}
                    onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, stockAlerts: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="dailyReports">Daily Reports</Label>
                    <p className="text-sm text-muted-foreground">Receive daily sales and analytics reports</p>
                  </div>
                  <Switch
                    id="dailyReports"
                    checked={notificationSettings.dailyReports}
                    onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, dailyReports: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="marketingEmails">Marketing Emails</Label>
                    <p className="text-sm text-muted-foreground">Receive promotional and marketing updates</p>
                  </div>
                  <Switch
                    id="marketingEmails"
                    checked={notificationSettings.marketingEmails}
                    onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, marketingEmails: checked }))}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveNotificationSettings} disabled={saving}>
                  {saving ? (
                    <>
                      <Loading size="sm" className="mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Notification Settings
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security & Privacy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="twoFactorAuth">Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                  </div>
                  <Switch
                    id="twoFactorAuth"
                    checked={securitySettings.twoFactorAuth}
                    onCheckedChange={(checked) => setSecuritySettings(prev => ({ ...prev, twoFactorAuth: checked }))}
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                    <Input
                      id="sessionTimeout"
                      type="number"
                      value={securitySettings.sessionTimeout}
                      onChange={(e) => setSecuritySettings(prev => ({ ...prev, sessionTimeout: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="passwordExpiry">Password Expiry (days)</Label>
                    <Input
                      id="passwordExpiry"
                      type="number"
                      value={securitySettings.passwordExpiry}
                      onChange={(e) => setSecuritySettings(prev => ({ ...prev, passwordExpiry: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loginAttempts">Max Login Attempts</Label>
                    <Input
                      id="loginAttempts"
                      type="number"
                      value={securitySettings.loginAttempts}
                      onChange={(e) => setSecuritySettings(prev => ({ ...prev, loginAttempts: Number(e.target.value) }))}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveSecuritySettings} disabled={saving}>
                  {saving ? (
                    <>
                      <Loading size="sm" className="mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Security Settings
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Settings */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Admin Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{adminProfile.displayName}</h3>
                  <p className="text-sm text-muted-foreground">{adminProfile.email}</p>
                  <Badge variant="secondary">{adminProfile.role}</Badge>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={adminProfile.displayName}
                    onChange={(e) => setAdminProfile(prev => ({ ...prev, displayName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profileEmail">Email</Label>
                  <Input
                    id="profileEmail"
                    type="email"
                    value={adminProfile.email}
                    disabled
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="profilePhone">Phone</Label>
                  <Input
                    id="profilePhone"
                    value={adminProfile.phone}
                    onChange={(e) => setAdminProfile(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={adminProfile.role}
                    disabled
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Database Configuration
                </h4>
                <div className="bg-muted p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium">Firebase Project ID:</p>
                      <p className="text-muted-foreground">smartcleaners5</p>
                    </div>
                    <div>
                      <p className="font-medium">Cloudinary Cloud:</p>
                      <p className="text-muted-foreground">djyny0qqn</p>
                    </div>
                    <div>
                      <p className="font-medium">Environment:</p>
                      <Badge variant="outline">Production</Badge>
                    </div>
                    <div>
                      <p className="font-medium">Last Backup:</p>
                      <p className="text-muted-foreground">Today, 2:00 AM</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={handleLogout}>
                  Logout
                </Button>
                <Button disabled>
                  <Save className="h-4 w-4 mr-2" />
                  Save Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};