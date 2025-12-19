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

function ProtectedDashboard() {
  const { data: admin, isLoading, error } = useQuery({
    queryKey: ["admin", "me"],
    queryFn: async () => {
      const res = await fetch("/api/admin/me");
      if (!res.ok) throw new Error("Not authenticated");
      return res.json();
    },
    retry: false,
  });

  if (isLoading) {
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