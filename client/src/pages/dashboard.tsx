import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Activity, 
  ArrowRightLeft, 
  Calendar,
  LayoutDashboard, 
  Settings, 
  Store, 
  RefreshCw,
  Wallet,
  TrendingUp,
  DollarSign,
  Copy,
  Link,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { getStylists, getOrders, getStylistStats, getSettings, updateSettings, updateStylist, getWebhookUrls, syncStylistsFromVagaro } from "@/lib/api";
import { format } from "date-fns";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedStylistId, setSelectedStylistId] = useState("");
  const queryClient = useQueryClient();

  const { data: stylists = [] } = useQuery({
    queryKey: ["stylists"],
    queryFn: getStylists,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: () => getOrders({}),
  });

  const { data: stats } = useQuery({
    queryKey: ["stylist-stats", selectedStylistId],
    queryFn: () => getStylistStats(selectedStylistId),
    enabled: !!selectedStylistId && activeTab === "commissions",
  });

  const { data: stylistOrders = [] } = useQuery({
    queryKey: ["stylist-orders", selectedStylistId],
    queryFn: () => getOrders({ stylistId: selectedStylistId, status: "paid" }),
    enabled: !!selectedStylistId && activeTab === "commissions",
  });

  const { data: webhookUrls } = useQuery({
    queryKey: ["webhook-urls"],
    queryFn: getWebhookUrls,
    enabled: activeTab === "connections",
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const updateSettingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings updated successfully");
    },
    onError: () => {
      toast.error("Failed to update settings");
    },
  });

  const updateStylistMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateStylist(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stylists"] });
      toast.success("Stylist updated");
    },
  });

  const syncStylistsMutation = useMutation({
    mutationFn: syncStylistsFromVagaro,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["stylists"] });
      toast.success(data.message);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to sync stylists");
    },
  });

  useEffect(() => {
    if (stylists.length > 0 && !selectedStylistId) {
      setSelectedStylistId(stylists[0].id);
    }
  }, [stylists, selectedStylistId]);

  const selectedStylist = stylists.find(s => s.id === selectedStylistId);
  const isConnectedVagaro = !!(settings?.vagaroClientId && settings?.vagaroClientSecret && settings?.vagaroMerchantId);
  const isConnectedShopify = !!(settings?.shopifyStoreUrl && settings?.shopifyAccessToken);

  const todayOrders = orders.filter(o => {
    const orderDate = new Date(o.createdAt);
    const today = new Date();
    return orderDate.toDateString() === today.toDateString();
  });

  const successfulOrders = todayOrders.filter(o => o.status === "paid" || o.shopifyDraftOrderId);
  const failedOrders = todayOrders.filter(o => !o.shopifyDraftOrderId && o.status === "draft");
  const successRate = todayOrders.length > 0 ? (successfulOrders.length / todayOrders.length) * 100 : 100;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r bg-card hidden md:flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center gap-2 font-bold text-lg">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            SyncMaster
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground mb-2 px-4 uppercase tracking-wider">Admin</div>
          <Button 
            variant={activeTab === "overview" ? "secondary" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => setActiveTab("overview")}
            data-testid="tab-overview"
          >
            <LayoutDashboard className="mr-2 w-4 h-4" /> Overview
          </Button>
          <Button 
            variant={activeTab === "connections" ? "secondary" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => setActiveTab("connections")}
            data-testid="tab-connections"
          >
            <Store className="mr-2 w-4 h-4" /> Connections
          </Button>
          <Button 
            variant={activeTab === "configuration" ? "secondary" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => setActiveTab("configuration")}
            data-testid="tab-configuration"
          >
            <Settings className="mr-2 w-4 h-4" /> Configuration
          </Button>
          <Button 
            variant={activeTab === "logs" ? "secondary" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => setActiveTab("logs")}
            data-testid="tab-logs"
          >
            <Activity className="mr-2 w-4 h-4" /> Activity Logs
          </Button>
          
          <div className="text-xs font-semibold text-muted-foreground mt-6 mb-2 px-4 uppercase tracking-wider">Stylist Portal</div>
          <Button 
            variant={activeTab === "commissions" ? "secondary" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => setActiveTab("commissions")}
            data-testid="tab-commissions"
          >
            <Wallet className="mr-2 w-4 h-4" /> My Earnings
          </Button>
        </nav>
        <div className="p-4 border-t">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <span className="font-medium text-xs">JS</span>
            </div>
            <div className="text-sm">
              <div className="font-medium">Jane Salon</div>
              <div className="text-xs text-muted-foreground">Admin</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b bg-card/50 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-10">
          <h1 className="font-semibold text-lg capitalize">{activeTab === "commissions" ? "My Earnings" : activeTab}</h1>
          <div className="flex items-center gap-4">
            {activeTab === "commissions" && selectedStylist && (
              <Select value={selectedStylistId} onValueChange={setSelectedStylistId}>
                <SelectTrigger className="w-[200px]" data-testid="select-stylist">
                  <SelectValue placeholder="Select Stylist View" />
                </SelectTrigger>
                <SelectContent>
                  {stylists.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} (View As)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
              <div className={`w-2 h-2 rounded-full ${isConnectedVagaro && isConnectedShopify ? 'bg-green-500' : 'bg-amber-500'}`}></div>
              {isConnectedVagaro && isConnectedShopify ? 'System Operational' : 'Setup Required'}
            </div>
          </div>
        </header>

        <ScrollArea className="flex-1">
          <main className="p-6 max-w-6xl mx-auto space-y-8">
            
            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Syncs (24h)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-total-syncs">{todayOrders.length}</div>
                      <p className="text-xs text-muted-foreground mt-1">Appointments processed</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600" data-testid="stat-success-rate">{successRate.toFixed(1)}%</div>
                      <p className="text-xs text-muted-foreground mt-1">{failedOrders.length} errors</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Next Sync</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">Real-time</div>
                      <p className="text-xs text-muted-foreground mt-1">Listening for webhooks</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="md:col-span-1">
                    <CardHeader>
                      <CardTitle>Connection Status</CardTitle>
                      <CardDescription>Manage your integration points</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-[hsl(14,100%,57%)]/10 flex items-center justify-center text-[hsl(14,100%,57%)]">
                            <Calendar className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-medium">Vagaro</div>
                            <div className="text-xs text-muted-foreground">Source</div>
                          </div>
                        </div>
                        {isConnectedVagaro ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200" data-testid="badge-vagaro-connected">Connected</Badge>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setActiveTab("connections")} data-testid="button-connect-vagaro">Connect</Button>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-[hsl(149,34%,42%)]/10 flex items-center justify-center text-[hsl(149,34%,42%)]">
                            <Store className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-medium">Shopify</div>
                            <div className="text-xs text-muted-foreground">Destination</div>
                          </div>
                        </div>
                        {isConnectedShopify ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200" data-testid="badge-shopify-connected">Connected</Badge>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setActiveTab("connections")} data-testid="button-connect-shopify">Connect</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="md:col-span-1">
                    <CardHeader>
                      <CardTitle>Recent Activity</CardTitle>
                      <CardDescription>Latest sync events</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {orders.slice(0, 4).map((order) => (
                          <div key={order.id} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0" data-testid={`activity-${order.id}`}>
                            <div className={`mt-1 w-2 h-2 rounded-full ${order.shopifyDraftOrderId ? 'bg-green-500' : 'bg-red-500'}`} />
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Appointment #{order.vagaroAppointmentId}</span>
                                <span className="text-xs text-muted-foreground">{format(new Date(order.createdAt), "p")}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {order.shopifyDraftOrderId ? `Draft Order ${order.shopifyDraftOrderId} created` : "Failed to create draft order"}
                              </p>
                            </div>
                          </div>
                        ))}
                        {orders.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-8">No activity yet</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* CONFIGURATION TAB */}
            {activeTab === "configuration" && settings && (
              <div className="space-y-6 max-w-3xl">
                <Card>
                  <CardHeader>
                    <CardTitle>Sync Triggers</CardTitle>
                    <CardDescription>Define when the sync should happen</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between space-x-2">
                      <div className="space-y-0.5">
                        <Label className="text-base">Appointment Booked</Label>
                        <p className="text-sm text-muted-foreground">
                          Trigger when a new appointment is confirmed in Vagaro
                        </p>
                      </div>
                      <Switch 
                        checked={settings.syncOnBooked} 
                        onCheckedChange={(checked) => updateSettingsMutation.mutate({ syncOnBooked: checked })}
                        data-testid="switch-sync-booked"
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between space-x-2">
                      <div className="space-y-0.5">
                        <Label className="text-base">Appointment Updated</Label>
                        <p className="text-sm text-muted-foreground">
                          Update draft order if appointment details change
                        </p>
                      </div>
                      <Switch 
                        checked={settings.syncOnUpdated}
                        onCheckedChange={(checked) => updateSettingsMutation.mutate({ syncOnUpdated: checked })}
                        data-testid="switch-sync-updated"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Stylist Filtering</CardTitle>
                    <CardDescription>Only sync appointments for specific staff members</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {stylists.map((stylist) => (
                        <div key={stylist.id} className="flex items-center justify-between space-x-3 space-y-0">
                          <div className="flex items-start space-x-3">
                            <Checkbox 
                              id={stylist.id} 
                              checked={stylist.enabled}
                              onCheckedChange={(checked) => 
                                updateStylistMutation.mutate({ id: stylist.id, data: { enabled: checked as boolean } })
                              }
                              data-testid={`checkbox-stylist-${stylist.id}`}
                            />
                            <div className="grid gap-1.5 leading-none">
                              <label
                                htmlFor={stylist.id}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {stylist.name}
                              </label>
                              <p className="text-xs text-muted-foreground">
                                {stylist.role}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Commission:</span>
                            <Input 
                              className="w-16 h-8" 
                              value={stylist.commissionRate} 
                              type="number"
                              onChange={(e) => 
                                updateStylistMutation.mutate({ 
                                  id: stylist.id, 
                                  data: { commissionRate: parseInt(e.target.value) } 
                                })
                              }
                              data-testid={`input-commission-${stylist.id}`}
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Shopify Draft Order Settings</CardTitle>
                    <CardDescription>Configure how the draft order is created</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2">
                      <Label>Default Order Tag</Label>
                      <Input 
                        placeholder="e.g. vagaro-sync" 
                        value={settings.defaultOrderTag} 
                        onChange={(e) => updateSettingsMutation.mutate({ defaultOrderTag: e.target.value })}
                        data-testid="input-order-tag"
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label>Tax Settings</Label>
                      <Select 
                        value={settings.taxSetting}
                        onValueChange={(value) => updateSettingsMutation.mutate({ taxSetting: value })}
                      >
                        <SelectTrigger data-testid="select-tax-setting">
                          <SelectValue placeholder="Select tax handling" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Automatic (Shopify Default)</SelectItem>
                          <SelectItem value="exempt">Tax Exempt</SelectItem>
                          <SelectItem value="manual">Manual Rate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center space-x-2 mt-4">
                      <Checkbox 
                        id="email-customer" 
                        checked={settings.emailCustomer}
                        onCheckedChange={(checked) => updateSettingsMutation.mutate({ emailCustomer: checked as boolean })}
                        data-testid="checkbox-email-customer"
                      />
                      <label
                        htmlFor="email-customer"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Email invoice to customer automatically
                      </label>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* CONNECTIONS TAB */}
            {activeTab === "connections" && settings && (
              <div className="space-y-6 max-w-3xl">
                <Card className={isConnectedVagaro ? "border-green-200 bg-green-50/30 dark:bg-green-900/10" : ""}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded bg-[hsl(14,100%,57%)]/10 flex items-center justify-center text-[hsl(14,100%,57%)]">
                          <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                          <CardTitle>Vagaro</CardTitle>
                          <CardDescription>Source of appointments and customer data</CardDescription>
                        </div>
                      </div>
                      {isConnectedVagaro && <Badge className="bg-green-500 hover:bg-green-600">Connected</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      <div className="grid gap-2">
                        <Label>Client ID</Label>
                        <Input 
                          placeholder="Enter your Vagaro Client ID" 
                          value={settings.vagaroClientId || ""}
                          onChange={(e) => updateSettingsMutation.mutate({ vagaroClientId: e.target.value })}
                          data-testid="input-vagaro-client-id"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Client Secret</Label>
                        <Input 
                          type="password"
                          placeholder="Enter your Vagaro Client Secret" 
                          value={settings.vagaroClientSecret || ""}
                          onChange={(e) => updateSettingsMutation.mutate({ vagaroClientSecret: e.target.value })}
                          data-testid="input-vagaro-client-secret"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Region</Label>
                        <Select 
                          value={settings.vagaroRegion || "us"}
                          onValueChange={(value) => updateSettingsMutation.mutate({ vagaroRegion: value })}
                        >
                          <SelectTrigger data-testid="select-vagaro-region">
                            <SelectValue placeholder="Select region" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="us">US (us)</SelectItem>
                            <SelectItem value="us02">US West (us02)</SelectItem>
                            <SelectItem value="ca">Canada (ca)</SelectItem>
                            <SelectItem value="uk">United Kingdom (uk)</SelectItem>
                            <SelectItem value="au">Australia (au)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Merchant ID</Label>
                        <Input 
                          placeholder="Enter your Vagaro Merchant ID" 
                          value={settings.vagaroMerchantId || ""}
                          onChange={(e) => updateSettingsMutation.mutate({ vagaroMerchantId: e.target.value })}
                          data-testid="input-vagaro-merchant-id"
                        />
                        <p className="text-xs text-muted-foreground">
                          Your Merchant ID is required to sync stylists from Vagaro
                        </p>
                      </div>
                      {isConnectedVagaro && (
                        <div className="pt-2">
                          <Button 
                            onClick={() => syncStylistsMutation.mutate()}
                            disabled={syncStylistsMutation.isPending}
                            data-testid="button-sync-stylists"
                          >
                            <RefreshCw className={`w-4 h-4 mr-2 ${syncStylistsMutation.isPending ? 'animate-spin' : ''}`} />
                            {syncStylistsMutation.isPending ? "Syncing..." : "Sync Stylists from Vagaro"}
                          </Button>
                          <p className="text-xs text-muted-foreground mt-2">
                            Import your team members directly from your Vagaro account
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className={isConnectedShopify ? "border-green-200 bg-green-50/30 dark:bg-green-900/10" : ""}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded bg-[hsl(149,34%,42%)]/10 flex items-center justify-center text-[hsl(149,34%,42%)]">
                          <Store className="w-6 h-6" />
                        </div>
                        <div>
                          <CardTitle>Shopify</CardTitle>
                          <CardDescription>Where draft orders will be created</CardDescription>
                        </div>
                      </div>
                      {isConnectedShopify && <Badge className="bg-green-500 hover:bg-green-600">Connected</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      <div className="grid gap-2">
                        <Label>Store URL</Label>
                        <div className="flex items-center">
                          <Input 
                            placeholder="your-store" 
                            className="rounded-r-none" 
                            value={settings.shopifyStoreUrl?.replace('.myshopify.com', '') || ""}
                            onChange={(e) => updateSettingsMutation.mutate({ shopifyStoreUrl: `${e.target.value}.myshopify.com` })}
                            data-testid="input-shopify-store"
                          />
                          <div className="bg-muted border border-l-0 rounded-r-md px-3 py-2 text-sm text-muted-foreground">.myshopify.com</div>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Admin API Access Token</Label>
                        <Input 
                          type="password" 
                          placeholder="shpat_..." 
                          value={settings.shopifyAccessToken || ""}
                          onChange={(e) => updateSettingsMutation.mutate({ shopifyAccessToken: e.target.value })}
                          data-testid="input-shopify-token"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <Link className="w-6 h-6" />
                      </div>
                      <div>
                        <CardTitle>Webhook URLs</CardTitle>
                        <CardDescription>Configure these URLs in your Vagaro and Shopify settings</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      <div className="grid gap-2">
                        <Label>Vagaro Webhook URL</Label>
                        <div className="flex items-center gap-2">
                          <Input 
                            readOnly
                            value={webhookUrls?.vagaroWebhookUrl || "Loading..."}
                            className="font-mono text-xs bg-muted"
                            data-testid="input-vagaro-webhook-url"
                          />
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={() => webhookUrls && copyToClipboard(webhookUrls.vagaroWebhookUrl, "Vagaro webhook URL")}
                            data-testid="button-copy-vagaro-webhook"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Use this URL in your Vagaro developer settings for appointment notifications</p>
                      </div>
                      <div className="grid gap-2">
                        <Label>Shopify Webhook URL</Label>
                        <div className="flex items-center gap-2">
                          <Input 
                            readOnly
                            value={webhookUrls?.shopifyWebhookUrl || "Loading..."}
                            className="font-mono text-xs bg-muted"
                            data-testid="input-shopify-webhook-url"
                          />
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={() => webhookUrls && copyToClipboard(webhookUrls.shopifyWebhookUrl, "Shopify webhook URL")}
                            data-testid="button-copy-shopify-webhook"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Use this URL in Shopify for order payment notifications</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            
             {/* LOGS TAB */}
             {activeTab === "logs" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Activity Logs</CardTitle>
                      <CardDescription>Detailed history of all sync attempts</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["orders"] })} data-testid="button-refresh-logs">
                      <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <div className="grid grid-cols-5 gap-4 p-4 border-b bg-muted/50 font-medium text-sm">
                      <div className="col-span-1">Time</div>
                      <div className="col-span-1">Status</div>
                      <div className="col-span-1">Source Event</div>
                      <div className="col-span-2">Result</div>
                    </div>
                    <div className="divide-y">
                      {orders.map((order) => (
                        <div key={order.id} className="grid grid-cols-5 gap-4 p-4 text-sm hover:bg-muted/30 transition-colors" data-testid={`log-${order.id}`}>
                          <div className="col-span-1 font-mono text-xs text-muted-foreground flex items-center">
                            {format(new Date(order.createdAt), "PPp")}
                          </div>
                          <div className="col-span-1 flex items-center">
                            <Badge variant="outline" className={order.shopifyDraftOrderId ? "text-green-600 border-green-200 bg-green-50" : "text-red-600 border-red-200 bg-red-50"}>
                              {order.shopifyDraftOrderId ? "success" : "failed"}
                            </Badge>
                          </div>
                          <div className="col-span-1 font-medium">Appointment #{order.vagaroAppointmentId}</div>
                          <div className="col-span-2 text-muted-foreground">
                            {order.shopifyDraftOrderId ? `Draft Order ${order.shopifyDraftOrderId} created` : "Failed to create draft order"}
                          </div>
                        </div>
                      ))}
                      {orders.length === 0 && (
                        <div className="p-8 text-center text-sm text-muted-foreground">No logs yet</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* COMMISSIONS TAB */}
            {activeTab === "commissions" && selectedStylist && stats && (
              <div className="space-y-6">
                {/* Stylist Header */}
                <div className="flex flex-col md:flex-row gap-6 justify-between md:items-center bg-primary/5 p-6 rounded-xl border border-primary/10">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xl font-bold border-2 border-background shadow-sm">
                      {selectedStylist.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold" data-testid="text-stylist-name">{selectedStylist.name}</h2>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Badge variant="secondary" className="font-normal">{selectedStylist.role}</Badge>
                        <span>•</span>
                        <span className="text-sm">Commission Rate: <span className="font-semibold text-foreground">{selectedStylist.commissionRate}%</span></span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="text-right px-4 py-2 bg-background rounded-lg border shadow-sm">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Today's Tips</div>
                      <div className="text-xl font-bold text-green-600" data-testid="stat-tips">${stats.totalTips}</div>
                    </div>
                    <div className="text-right px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow-sm">
                      <div className="text-xs opacity-80 uppercase tracking-wider font-semibold">Est. Payout</div>
                      <div className="text-xl font-bold" data-testid="stat-payout">${stats.totalEarnings}</div>
                    </div>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid md:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Service Sales</CardTitle>
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-sales">${stats.totalSales}</div>
                      <p className="text-xs text-muted-foreground mt-1">Last 24 hours</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Commission Earned</CardTitle>
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary" data-testid="stat-commission">${stats.totalCommission}</div>
                      <p className="text-xs text-muted-foreground mt-1">Based on {selectedStylist.commissionRate}% rate</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Tips Collected</CardTitle>
                      <Wallet className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600" data-testid="stat-tips-card">${stats.totalTips}</div>
                      <p className="text-xs text-muted-foreground mt-1">100% passthrough</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Sales Table */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Recent Paid Orders</CardTitle>
                        <CardDescription>Sales processed through Shopify</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Services</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right text-green-600">Tip</TableHead>
                          <TableHead className="text-right font-bold text-primary">Your Cut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stylistOrders.map((order) => (
                          <TableRow key={order.id} data-testid={`order-row-${order.id}`}>
                            <TableCell className="font-mono text-xs font-medium">{order.vagaroAppointmentId}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{format(new Date(order.createdAt), "PPp")}</TableCell>
                            <TableCell>{order.customerName}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {order.services.map((s, i) => (
                                  <Badge key={i} variant="secondary" className="font-normal text-xs">{s}</Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">${parseFloat(order.totalAmount).toFixed(2)}</TableCell>
                            <TableCell className="text-right text-green-600 font-medium">
                              {parseFloat(order.tipAmount) > 0 ? `+$${parseFloat(order.tipAmount).toFixed(2)}` : '-'}
                            </TableCell>
                            <TableCell className="text-right font-bold text-primary">
                              ${(parseFloat(order.commissionAmount) + parseFloat(order.tipAmount)).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {stylistOrders.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No paid orders yet
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}

          </main>
        </ScrollArea>
      </div>
    </div>
  );
}