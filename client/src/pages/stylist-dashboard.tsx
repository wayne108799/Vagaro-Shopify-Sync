import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingUp, Scissors, LogOut } from "lucide-react";

interface StylistMe {
  id: string;
  name: string;
  role: string;
  commissionRate: number;
}

interface Stats {
  today: {
    sales: number;
    commission: number;
    tips: number;
    earnings: number;
    orders: number;
  };
  week: {
    sales: number;
    commission: number;
    tips: number;
    earnings: number;
    orders: number;
  };
}

interface Order {
  id: string;
  customerName: string;
  services: string[];
  totalAmount: string;
  commissionAmount: string;
  tipAmount: string;
  status: string;
  createdAt: string;
}

export default function StylistDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: me, isLoading: meLoading, error: meError } = useQuery<StylistMe>({
    queryKey: ["/api/stylist/me"],
    retry: false,
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/stylist/me/stats"],
    enabled: !!me,
    refetchInterval: 30000,
  });

  const { data: orders } = useQuery<Order[]>({
    queryKey: ["/api/stylist/me/orders"],
    enabled: !!me,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (meError) {
      setLocation("/stylist");
    }
  }, [meError, setLocation]);

  const handleLogout = async () => {
    try {
      await fetch("/api/stylist/logout", { method: "POST" });
      toast({ title: "Logged out", description: "See you next time!" });
      setLocation("/stylist");
    } catch (error) {
      setLocation("/stylist");
    }
  };

  if (meLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!me) {
    return null;
  }

  const recentOrders = orders?.slice(0, 10) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="text-welcome">
              Welcome, {me.name}!
            </h1>
            <p className="text-gray-600" data-testid="text-role">{me.role} • {me.commissionRate}% commission</p>
          </div>
          <Button variant="outline" onClick={handleLogout} data-testid="button-logout">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card data-testid="card-today-stats">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Sales</p>
                  <p className="text-2xl font-bold" data-testid="text-today-sales">
                    ${stats?.today.sales.toFixed(2) || "0.00"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Your Earnings</p>
                  <p className="text-2xl font-bold text-green-600" data-testid="text-today-earnings">
                    ${stats?.today.earnings.toFixed(2) || "0.00"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Commission</p>
                  <p className="text-lg" data-testid="text-today-commission">
                    ${stats?.today.commission.toFixed(2) || "0.00"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tips</p>
                  <p className="text-lg" data-testid="text-today-tips">
                    ${stats?.today.tips.toFixed(2) || "0.00"}
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">Appointments: <span className="font-medium" data-testid="text-today-orders">{stats?.today.orders || 0}</span></p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-week-stats">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Sales</p>
                  <p className="text-2xl font-bold" data-testid="text-week-sales">
                    ${stats?.week.sales.toFixed(2) || "0.00"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Your Earnings</p>
                  <p className="text-2xl font-bold text-purple-600" data-testid="text-week-earnings">
                    ${stats?.week.earnings.toFixed(2) || "0.00"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Commission</p>
                  <p className="text-lg" data-testid="text-week-commission">
                    ${stats?.week.commission.toFixed(2) || "0.00"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tips</p>
                  <p className="text-lg" data-testid="text-week-tips">
                    ${stats?.week.tips.toFixed(2) || "0.00"}
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">Appointments: <span className="font-medium" data-testid="text-week-orders">{stats?.week.orders || 0}</span></p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-recent-orders">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scissors className="w-5 h-5" />
              Recent Appointments
            </CardTitle>
            <CardDescription>Your latest completed services</CardDescription>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-gray-500 text-center py-8" data-testid="text-no-orders">No appointments yet</p>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                    data-testid={`order-row-${order.id}`}
                  >
                    <div>
                      <p className="font-medium" data-testid={`text-customer-${order.id}`}>{order.customerName}</p>
                      <p className="text-sm text-gray-500">{order.services.join(", ")}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(order.createdAt).toLocaleDateString()} at{" "}
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${order.totalAmount}</p>
                      <p className="text-sm text-green-600">+${order.commissionAmount}</p>
                      {parseFloat(order.tipAmount) > 0 && (
                        <p className="text-xs text-purple-600">+${order.tipAmount} tip</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
