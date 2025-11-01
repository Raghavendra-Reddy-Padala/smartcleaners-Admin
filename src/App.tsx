import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/login/LoginForm";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Dashboard } from "@/pages/Dashboard";
import { Categories } from "@/pages/Categories";
import { Products } from "@/pages/Products";
import { Orders } from "@/pages/Orders";
import { BulkOrders } from "@/pages/BulkOrders";
import { ComboOrders } from "@/pages/ComboOrders";
import { Analytics } from "@/pages/Analytics";
import { Settings } from "@/pages/Settings";
import { FullPageLoading } from "@/components/ui/loading";
import NotFound from "./pages/NotFound";
import { Customers } from "./pages/customers";

const queryClient = new QueryClient();

const AppContent = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <FullPageLoading />;
  }

  if (!currentUser) {
    return <LoginForm />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="categories" element={<Categories />} />
          <Route path="products" element={<Products />} />
          <Route path="orders" element={<Orders />} />
          <Route path="bulk-orders" element={<BulkOrders />} />
          <Route path="combo-orders" element={<ComboOrders />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="customers" element={<Customers />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
