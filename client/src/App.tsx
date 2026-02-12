import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import AdminLogin from "@/pages/admin-login";
import StylistLogin from "@/pages/stylist-login";
import StylistDashboard from "@/pages/stylist-dashboard";
import NotFound from "@/pages/not-found";

function isShopifyEmbed() {
  const params = new URLSearchParams(window.location.search);
  return !!(params.get("shop") || params.get("host") || params.get("hmac") || window.top !== window.self);
}

function ProtectedDashboard() {
  const shopifyEmbed = isShopifyEmbed();

  const { data: admin, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "me"],
    queryFn: async () => {
      const res = await fetch("/api/admin/me", { credentials: "include" });
      if (!res.ok) throw new Error("Not authenticated");
      return res.json();
    },
    retry: false,
  });

  const { data: shopifyAuth, isLoading: shopifyAuthLoading } = useQuery({
    queryKey: ["admin", "shopify-auth"],
    queryFn: async () => {
      const params = new URLSearchParams(window.location.search);
      const shop = params.get("shop") || "";
      const host = params.get("host") || "";
      const res = await fetch(`/api/admin/shopify-auth?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Shopify auth failed");
      const data = await res.json();
      await refetch();
      return data;
    },
    enabled: shopifyEmbed && !admin && !isLoading,
    retry: false,
  });

  if (isLoading || (shopifyEmbed && shopifyAuthLoading && !admin)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error || !admin) {
    return <AdminLogin />;
  }

  return <Dashboard />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={ProtectedDashboard} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/stylist" component={StylistLogin} />
      <Route path="/stylist/dashboard" component={StylistDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;