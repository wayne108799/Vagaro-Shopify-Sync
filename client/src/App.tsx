import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
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
  const [state, setState] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    async function checkAuth() {
      try {
        const meRes = await fetch("/api/admin/me", { credentials: "include" });
        if (meRes.ok) {
          setState("authenticated");
          return;
        }
      } catch (e) {}

      if (isShopifyEmbed()) {
        try {
          const params = new URLSearchParams(window.location.search);
          const shop = params.get("shop") || "";
          const host = params.get("host") || "";
          const authRes = await fetch(
            `/api/admin/shopify-auth?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`,
            { credentials: "include" }
          );
          if (authRes.ok) {
            setState("authenticated");
            return;
          }
        } catch (e) {}
      }

      setState("unauthenticated");
    }

    checkAuth();
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    );
  }

  if (state === "unauthenticated") {
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
