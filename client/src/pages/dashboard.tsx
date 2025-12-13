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
  Key,
  Trash2,
  Layers,
  Clock,
  Plus,
  Pencil,
  FileText,
  Ban,
  RotateCcw,
  Percent,
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getStylists, getOrders, getStylistStats, getSettings, updateSettings, updateStylist, getWebhookUrls, syncStylistsFromVagaro, setStylistPin, deleteStylist, getCommissionTiers, setCommissionTiers, type CommissionTier, getAdminTimeEntries, createAdminTimeEntry, updateAdminTimeEntry, deleteAdminTimeEntry, getTimeclockReport, type TimeEntry, type TimeclockReportEntry, getCommissionReport, getAdminOrders, createManualOrder, voidOrder, restoreOrder, getCommissionAdjustments, createCommissionAdjustment, deleteCommissionAdjustment, type CommissionReportEntry, type CommissionAdjustment } from "@/lib/api";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedStylistId, setSelectedStylistId] = useState("");
  const [vagaroBusinessId, setVagaroBusinessId] = useState<string | null>(null);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinStylistId, setPinStylistId] = useState<string | null>(null);
  const [pinStylistName, setPinStylistName] = useState<string>("");
  const [pinValue, setPinValue] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteStylistId, setDeleteStylistId] = useState<string | null>(null);
  const [deleteStylistName, setDeleteStylistName] = useState<string>("");
  const [tiersDialogOpen, setTiersDialogOpen] = useState(false);
  const [tiersStylistId, setTiersStylistId] = useState<string | null>(null);
  const [tiersStylistName, setTiersStylistName] = useState<string>("");
  const [editingTiers, setEditingTiers] = useState<Omit<CommissionTier, "id" | "stylistId">[]>([]);
  const [timeclockStartDate, setTimeclockStartDate] = useState(() => {
    const today = new Date();
    const day = today.getDate();
    if (day <= 15) {
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    } else {
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-16`;
    }
  });
  const [timeclockEndDate, setTimeclockEndDate] = useState(() => {
    const today = new Date();
    const day = today.getDate();
    if (day <= 15) {
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-15`;
    } else {
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
    }
  });
  const [timeclockStylistFilter, setTimeclockStylistFilter] = useState("all");
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [entryForm, setEntryForm] = useState({ stylistId: "", clockIn: "", clockOut: "" });
  const [deleteEntryDialogOpen, setDeleteEntryDialogOpen] = useState(false);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [reportingSubTab, setReportingSubTab] = useState<"timeclock" | "commissions" | "sales">("timeclock");
  const [manualOrderDialogOpen, setManualOrderDialogOpen] = useState(false);
  const [manualOrderForm, setManualOrderForm] = useState({ stylistId: "", customerName: "", services: "", totalAmount: "", tipAmount: "", notes: "" });
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidOrderId, setVoidOrderId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({ stylistId: "", amount: "", reason: "" });
  const [showVoidedOrders, setShowVoidedOrders] = useState(false);
  const [hideDisabledStylists, setHideDisabledStylists] = useState(true);
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

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["admin-time-entries", timeclockStartDate, timeclockEndDate, timeclockStylistFilter],
    queryFn: () => getAdminTimeEntries({ 
      startDate: timeclockStartDate, 
      endDate: timeclockEndDate,
      stylistId: timeclockStylistFilter === "all" ? undefined : timeclockStylistFilter 
    }),
    enabled: activeTab === "reporting" && reportingSubTab === "timeclock",
  });

  const { data: timeclockReport = [] } = useQuery({
    queryKey: ["timeclock-report", timeclockStartDate, timeclockEndDate, timeclockStylistFilter],
    queryFn: () => getTimeclockReport(timeclockStartDate, timeclockEndDate, timeclockStylistFilter === "all" ? undefined : timeclockStylistFilter),
    enabled: activeTab === "reporting" && reportingSubTab === "timeclock",
  });

  const { data: commissionReport = [] } = useQuery({
    queryKey: ["commission-report", timeclockStartDate, timeclockEndDate, timeclockStylistFilter],
    queryFn: () => getCommissionReport(timeclockStartDate, timeclockEndDate, timeclockStylistFilter === "all" ? undefined : timeclockStylistFilter),
    enabled: activeTab === "reporting" && reportingSubTab === "commissions",
  });

  const { data: adminOrders = [] } = useQuery({
    queryKey: ["admin-orders", timeclockStartDate, timeclockEndDate, timeclockStylistFilter, showVoidedOrders],
    queryFn: () => getAdminOrders({
      startDate: timeclockStartDate,
      endDate: timeclockEndDate,
      stylistId: timeclockStylistFilter === "all" ? undefined : timeclockStylistFilter,
      includeVoided: showVoidedOrders,
    }),
    enabled: activeTab === "reporting" && reportingSubTab === "sales",
  });

  const { data: commissionAdjustments = [] } = useQuery({
    queryKey: ["commission-adjustments", timeclockStartDate, timeclockEndDate, timeclockStylistFilter],
    queryFn: () => getCommissionAdjustments({
      periodStart: timeclockStartDate,
      periodEnd: timeclockEndDate,
      stylistId: timeclockStylistFilter === "all" ? undefined : timeclockStylistFilter,
    }),
    enabled: activeTab === "reporting" && reportingSubTab === "commissions",
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
      if (data.businessId) {
        setVagaroBusinessId(data.businessId);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to sync stylists");
    },
  });

  const setPinMutation = useMutation({
    mutationFn: ({ id, pin }: { id: string; pin: string }) => setStylistPin(id, pin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stylists"] });
      toast.success("PIN set successfully");
      setPinDialogOpen(false);
      setPinValue("");
      setPinStylistId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to set PIN");
    },
  });

  const openPinDialog = (stylistId: string, stylistName: string) => {
    setPinStylistId(stylistId);
    setPinStylistName(stylistName);
    setPinValue("");
    setPinDialogOpen(true);
  };

  const deleteStylistMutation = useMutation({
    mutationFn: (id: string) => deleteStylist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stylists"] });
      toast.success("Stylist removed successfully");
      setDeleteDialogOpen(false);
      setDeleteStylistId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove stylist");
    },
  });

  const openDeleteDialog = (stylistId: string, stylistName: string) => {
    setDeleteStylistId(stylistId);
    setDeleteStylistName(stylistName);
    setDeleteDialogOpen(true);
  };

  const setTiersMutation = useMutation({
    mutationFn: ({ id, tiers }: { id: string; tiers: Omit<CommissionTier, "id" | "stylistId">[] }) => 
      setCommissionTiers(id, tiers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stylists"] });
      toast.success("Commission tiers saved");
      setTiersDialogOpen(false);
      setTiersStylistId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save commission tiers");
    },
  });

  const openTiersDialog = async (stylistId: string, stylistName: string) => {
    setTiersStylistId(stylistId);
    setTiersStylistName(stylistName);
    try {
      const existingTiers = await getCommissionTiers(stylistId);
      if (existingTiers.length > 0) {
        setEditingTiers(existingTiers.map(t => ({
          tierLevel: t.tierLevel,
          salesThreshold: t.salesThreshold,
          commissionRate: t.commissionRate,
        })));
      } else {
        setEditingTiers([
          { tierLevel: 1, salesThreshold: "0", commissionRate: "35" },
          { tierLevel: 2, salesThreshold: "5000", commissionRate: "40" },
          { tierLevel: 3, salesThreshold: "10000", commissionRate: "45" },
          { tierLevel: 4, salesThreshold: "20000", commissionRate: "50" },
          { tierLevel: 5, salesThreshold: "30000", commissionRate: "55" },
        ]);
      }
    } catch {
      setEditingTiers([
        { tierLevel: 1, salesThreshold: "0", commissionRate: "35" },
        { tierLevel: 2, salesThreshold: "5000", commissionRate: "40" },
        { tierLevel: 3, salesThreshold: "10000", commissionRate: "45" },
        { tierLevel: 4, salesThreshold: "20000", commissionRate: "50" },
        { tierLevel: 5, salesThreshold: "30000", commissionRate: "55" },
      ]);
    }
    setTiersDialogOpen(true);
  };

  const updateTier = (index: number, field: "salesThreshold" | "commissionRate", value: string) => {
    setEditingTiers(prev => prev.map((tier, i) => 
      i === index ? { ...tier, [field]: value } : tier
    ));
  };

  const createEntryMutation = useMutation({
    mutationFn: (data: { stylistId: string; clockIn: string; clockOut?: string }) => createAdminTimeEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["timeclock-report"] });
      toast.success("Time entry created");
      setEntryDialogOpen(false);
      setEntryForm({ stylistId: "", clockIn: "", clockOut: "" });
    },
    onError: (error: any) => toast.error(error.message || "Failed to create entry"),
  });

  const updateEntryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { clockIn?: string; clockOut?: string | null } }) => updateAdminTimeEntry(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["timeclock-report"] });
      toast.success("Time entry updated");
      setEntryDialogOpen(false);
      setEditingEntry(null);
    },
    onError: (error: any) => toast.error(error.message || "Failed to update entry"),
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (id: string) => deleteAdminTimeEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["timeclock-report"] });
      toast.success("Time entry deleted");
      setDeleteEntryDialogOpen(false);
      setDeleteEntryId(null);
    },
    onError: (error: any) => toast.error(error.message || "Failed to delete entry"),
  });

  const createManualOrderMutation = useMutation({
    mutationFn: createManualOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["commission-report"] });
      toast.success("Manual order created");
      setManualOrderDialogOpen(false);
      setManualOrderForm({ stylistId: "", customerName: "", services: "", totalAmount: "", tipAmount: "", notes: "" });
    },
    onError: (error: any) => toast.error(error.message || "Failed to create order"),
  });

  const voidOrderMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => voidOrder(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["commission-report"] });
      toast.success("Order voided");
      setVoidDialogOpen(false);
      setVoidOrderId(null);
      setVoidReason("");
    },
    onError: (error: any) => toast.error(error.message || "Failed to void order"),
  });

  const restoreOrderMutation = useMutation({
    mutationFn: restoreOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["commission-report"] });
      toast.success("Order restored");
    },
    onError: (error: any) => toast.error(error.message || "Failed to restore order"),
  });

  const createAdjustmentMutation = useMutation({
    mutationFn: createCommissionAdjustment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["commission-report"] });
      toast.success("Adjustment created");
      setAdjustmentDialogOpen(false);
      setAdjustmentForm({ stylistId: "", amount: "", reason: "" });
    },
    onError: (error: any) => toast.error(error.message || "Failed to create adjustment"),
  });

  const deleteAdjustmentMutation = useMutation({
    mutationFn: deleteCommissionAdjustment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["commission-report"] });
      toast.success("Adjustment deleted");
    },
    onError: (error: any) => toast.error(error.message || "Failed to delete adjustment"),
  });

  const openEntryDialog = (entry?: TimeEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setEntryForm({
        stylistId: entry.stylistId,
        clockIn: format(new Date(entry.clockIn), "yyyy-MM-dd'T'HH:mm"),
        clockOut: entry.clockOut ? format(new Date(entry.clockOut), "yyyy-MM-dd'T'HH:mm") : "",
      });
    } else {
      setEditingEntry(null);
      setEntryForm({ stylistId: stylists[0]?.id || "", clockIn: "", clockOut: "" });
    }
    setEntryDialogOpen(true);
  };

  const handleEntrySave = () => {
    if (!entryForm.stylistId || !entryForm.clockIn) {
      toast.error("Stylist and clock-in time are required");
      return;
    }
    if (editingEntry) {
      updateEntryMutation.mutate({
        id: editingEntry.id,
        data: {
          clockIn: new Date(entryForm.clockIn).toISOString(),
          clockOut: entryForm.clockOut ? new Date(entryForm.clockOut).toISOString() : null,
        },
      });
    } else {
      createEntryMutation.mutate({
        stylistId: entryForm.stylistId,
        clockIn: new Date(entryForm.clockIn).toISOString(),
        clockOut: entryForm.clockOut ? new Date(entryForm.clockOut).toISOString() : undefined,
      });
    }
  };

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
          <Button 
            variant={activeTab === "reporting" ? "secondary" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => setActiveTab("reporting")}
            data-testid="tab-reporting"
          >
            <FileText className="mr-2 w-4 h-4" /> Reporting
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
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Stylist Management</CardTitle>
                        <CardDescription>Manage staff members, PINs, and commission rates</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="hide-disabled" className="text-sm text-muted-foreground">Hide disabled</Label>
                        <Switch
                          id="hide-disabled"
                          checked={hideDisabledStylists}
                          onCheckedChange={setHideDisabledStylists}
                          data-testid="switch-hide-disabled"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {stylists.filter(s => !hideDisabledStylists || s.enabled).map((stylist) => (
                        <div key={stylist.id} className="flex flex-col gap-3 p-4 border rounded-lg" data-testid={`stylist-row-${stylist.id}`}>
                          <div className="flex items-center justify-between">
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
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openPinDialog(stylist.id, stylist.name)}
                                data-testid={`button-set-pin-${stylist.id}`}
                              >
                                <Key className="w-3 h-3 mr-1" />
                                {stylist.pinHash ? "Change PIN" : "Set PIN"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openTiersDialog(stylist.id, stylist.name)}
                                data-testid={`button-set-tiers-${stylist.id}`}
                              >
                                <Layers className="w-3 h-3 mr-1" />
                                Tiers
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => openDeleteDialog(stylist.id, stylist.name)}
                                data-testid={`button-delete-${stylist.id}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-7">
                            <span className="text-xs text-muted-foreground">Base Commission:</span>
                            <Input 
                              className="w-20 h-8" 
                              value={stylist.commissionRate} 
                              type="number"
                              step="0.01"
                              onChange={(e) => 
                                updateStylistMutation.mutate({ 
                                  id: stylist.id, 
                                  data: { commissionRate: e.target.value } 
                                })
                              }
                              data-testid={`input-commission-${stylist.id}`}
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                            <span className="text-xs text-muted-foreground ml-2">(Used when no tiers are set)</span>
                          </div>
                        </div>
                      ))}
                      {stylists.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No stylists found. Sync from Vagaro or add manually.
                        </p>
                      )}
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
                        <div className="pt-2 space-y-3">
                          <div className="p-3 bg-muted/50 rounded-lg border" data-testid="vagaro-business-id-info">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-muted-foreground">Business ID</p>
                                <p className="font-mono text-sm font-medium" data-testid="text-vagaro-business-id">{settings.vagaroMerchantId}</p>
                              </div>
                              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">Connected</Badge>
                            </div>
                          </div>
                          <Button 
                            onClick={() => syncStylistsMutation.mutate()}
                            disabled={syncStylistsMutation.isPending}
                            data-testid="button-sync-stylists"
                          >
                            <RefreshCw className={`w-4 h-4 mr-2 ${syncStylistsMutation.isPending ? 'animate-spin' : ''}`} />
                            {syncStylistsMutation.isPending ? "Syncing..." : "Sync Stylists from Vagaro"}
                          </Button>
                          <p className="text-xs text-muted-foreground">
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

            {/* REPORTING TAB */}
            {activeTab === "reporting" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <div className="flex gap-1 bg-muted p-1 rounded-lg">
                    <Button
                      variant={reportingSubTab === "timeclock" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setReportingSubTab("timeclock")}
                      data-testid="subtab-timeclock"
                    >
                      <Clock className="w-4 h-4 mr-2" /> Timeclock
                    </Button>
                    <Button
                      variant={reportingSubTab === "commissions" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setReportingSubTab("commissions")}
                      data-testid="subtab-commissions"
                    >
                      <Percent className="w-4 h-4 mr-2" /> Commissions
                    </Button>
                    <Button
                      variant={reportingSubTab === "sales" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setReportingSubTab("sales")}
                      data-testid="subtab-sales"
                    >
                      <DollarSign className="w-4 h-4 mr-2" /> Sales
                    </Button>
                  </div>
                  <div className="flex-1" />
                  <div className="flex flex-wrap gap-4">
                    <div className="space-y-1">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={timeclockStartDate}
                        onChange={(e) => setTimeclockStartDate(e.target.value)}
                        data-testid="input-reporting-start"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={timeclockEndDate}
                        onChange={(e) => setTimeclockEndDate(e.target.value)}
                        data-testid="input-reporting-end"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Stylist</Label>
                      <Select value={timeclockStylistFilter} onValueChange={setTimeclockStylistFilter}>
                        <SelectTrigger className="w-[180px]" data-testid="select-reporting-stylist">
                          <SelectValue placeholder="All stylists" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All stylists</SelectItem>
                          {stylists.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {reportingSubTab === "timeclock" && (
                  <>
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>Timeclock Entries</CardTitle>
                            <CardDescription>View and manage stylist time entries</CardDescription>
                          </div>
                          <Button onClick={() => openEntryDialog()} data-testid="button-add-entry">
                            <Plus className="w-4 h-4 mr-2" /> Add Entry
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Stylist</TableHead>
                              <TableHead>Clock In</TableHead>
                              <TableHead>Clock Out</TableHead>
                              <TableHead>Duration</TableHead>
                              <TableHead className="w-[100px]">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {timeEntries.map((entry) => {
                              const stylist = stylists.find(s => s.id === entry.stylistId);
                              const clockIn = new Date(entry.clockIn);
                              const clockOut = entry.clockOut ? new Date(entry.clockOut) : null;
                              const durationMs = clockOut ? clockOut.getTime() - clockIn.getTime() : Date.now() - clockIn.getTime();
                              const hours = Math.floor(durationMs / (1000 * 60 * 60));
                              const mins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                              return (
                                <TableRow key={entry.id} data-testid={`entry-row-${entry.id}`}>
                                  <TableCell>{stylist?.name || 'Unknown'}</TableCell>
                                  <TableCell>{format(clockIn, "PPp")}</TableCell>
                                  <TableCell>{clockOut ? format(clockOut, "PPp") : <Badge variant="outline">Active</Badge>}</TableCell>
                                  <TableCell>{hours}h {mins}m</TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button variant="ghost" size="sm" onClick={() => openEntryDialog(entry)} data-testid={`button-edit-entry-${entry.id}`}>
                                        <Pencil className="w-4 h-4" />
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={() => { setDeleteEntryId(entry.id); setDeleteEntryDialogOpen(true); }} data-testid={`button-delete-entry-${entry.id}`}>
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {timeEntries.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                  No time entries for this period
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Pay Period Report</CardTitle>
                        <CardDescription>Hours and earnings summary for {timeclockStartDate} to {timeclockEndDate}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Stylist</TableHead>
                              <TableHead className="text-right">Total Hours</TableHead>
                              <TableHead className="text-right">Hourly Rate</TableHead>
                              <TableHead className="text-right">Total Earnings</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {timeclockReport.map((row) => (
                              <TableRow key={row.stylistId} data-testid={`report-row-${row.stylistId}`}>
                                <TableCell className="font-medium">{row.stylistName}</TableCell>
                                <TableCell className="text-right">{row.totalHours.toFixed(2)}h</TableCell>
                                <TableCell className="text-right">${parseFloat(row.hourlyRate).toFixed(2)}/hr</TableCell>
                                <TableCell className="text-right font-bold">${row.totalEarnings.toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                            {timeclockReport.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                  No data for this period
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </>
                )}

                {reportingSubTab === "commissions" && (
                  <>
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>Commission Report</CardTitle>
                            <CardDescription>Sales and commission summary for {timeclockStartDate} to {timeclockEndDate}</CardDescription>
                          </div>
                          <Button onClick={() => { setAdjustmentForm({ stylistId: timeclockStylistFilter !== "all" ? timeclockStylistFilter : (stylists[0]?.id || ""), amount: "", reason: "" }); setAdjustmentDialogOpen(true); }} data-testid="button-add-adjustment">
                            <Plus className="w-4 h-4 mr-2" /> Add Adjustment
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Stylist</TableHead>
                              <TableHead className="text-right">Orders</TableHead>
                              <TableHead className="text-right">Gross Sales</TableHead>
                              <TableHead className="text-right">Voided</TableHead>
                              <TableHead className="text-right">Net Sales</TableHead>
                              <TableHead className="text-right">Rate</TableHead>
                              <TableHead className="text-right">Commission</TableHead>
                              <TableHead className="text-right">Adjustments</TableHead>
                              <TableHead className="text-right">Tips</TableHead>
                              <TableHead className="text-right font-bold">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {commissionReport.map((row) => (
                              <TableRow key={row.stylistId} data-testid={`commission-row-${row.stylistId}`}>
                                <TableCell className="font-medium">{row.stylistName}</TableCell>
                                <TableCell className="text-right">{row.orderCount}</TableCell>
                                <TableCell className="text-right">${row.totalSales.toFixed(2)}</TableCell>
                                <TableCell className="text-right text-muted-foreground">${row.voidedSales.toFixed(2)}</TableCell>
                                <TableCell className="text-right">${row.netSales.toFixed(2)}</TableCell>
                                <TableCell className="text-right">{row.commissionRate}%</TableCell>
                                <TableCell className="text-right">${row.baseCommission.toFixed(2)}</TableCell>
                                <TableCell className="text-right">{row.adjustments >= 0 ? '+' : ''}${row.adjustments.toFixed(2)}</TableCell>
                                <TableCell className="text-right text-green-600">${row.totalTips.toFixed(2)}</TableCell>
                                <TableCell className="text-right font-bold text-primary">${row.totalCommission.toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                            {commissionReport.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                                  No data for this period
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Commission Adjustments</CardTitle>
                        <CardDescription>Manual adjustments for the selected period</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Stylist</TableHead>
                              <TableHead>Reason</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead>Created</TableHead>
                              <TableHead className="w-[80px]">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {commissionAdjustments.map((adj) => {
                              const stylist = stylists.find(s => s.id === adj.stylistId);
                              return (
                                <TableRow key={adj.id} data-testid={`adjustment-row-${adj.id}`}>
                                  <TableCell>{stylist?.name || 'Unknown'}</TableCell>
                                  <TableCell>{adj.reason}</TableCell>
                                  <TableCell className={`text-right font-medium ${parseFloat(adj.amount) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                                    {parseFloat(adj.amount) >= 0 ? '+' : ''}${parseFloat(adj.amount).toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground text-xs">{format(new Date(adj.createdAt), "PPp")}</TableCell>
                                  <TableCell>
                                    <Button variant="ghost" size="sm" onClick={() => deleteAdjustmentMutation.mutate(adj.id)} data-testid={`button-delete-adjustment-${adj.id}`}>
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {commissionAdjustments.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                  No adjustments for this period
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </>
                )}

                {reportingSubTab === "sales" && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Sales Management</CardTitle>
                          <CardDescription>View, void, and manage orders</CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="showVoided"
                              checked={showVoidedOrders}
                              onCheckedChange={(checked) => setShowVoidedOrders(!!checked)}
                              data-testid="checkbox-show-voided"
                            />
                            <Label htmlFor="showVoided" className="text-sm">Show voided</Label>
                          </div>
                          <Button onClick={() => { setManualOrderForm({ stylistId: timeclockStylistFilter !== "all" ? timeclockStylistFilter : (stylists[0]?.id || ""), customerName: "", services: "", totalAmount: "", tipAmount: "", notes: "" }); setManualOrderDialogOpen(true); }} data-testid="button-add-manual-order">
                            <Plus className="w-4 h-4 mr-2" /> Add Manual Order
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Stylist</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Services</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Tip</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {adminOrders.map((order) => {
                            const stylist = stylists.find(s => s.id === order.stylistId);
                            const isVoided = !!(order as any).voidedAt;
                            return (
                              <TableRow key={order.id} className={isVoided ? "opacity-50" : ""} data-testid={`sales-order-row-${order.id}`}>
                                <TableCell className="font-mono text-xs">{(order as any).isManual ? 'MANUAL' : order.vagaroAppointmentId}</TableCell>
                                <TableCell className="text-muted-foreground text-xs">{format(new Date(order.createdAt), "PPp")}</TableCell>
                                <TableCell>{stylist?.name || 'Unknown'}</TableCell>
                                <TableCell>{order.customerName}</TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {order.services.slice(0, 2).map((s, i) => (
                                      <Badge key={i} variant="secondary" className="font-normal text-xs">{s}</Badge>
                                    ))}
                                    {order.services.length > 2 && <Badge variant="outline" className="text-xs">+{order.services.length - 2}</Badge>}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">${parseFloat(order.totalAmount).toFixed(2)}</TableCell>
                                <TableCell className="text-right text-green-600">{parseFloat(order.tipAmount) > 0 ? `$${parseFloat(order.tipAmount).toFixed(2)}` : '-'}</TableCell>
                                <TableCell>
                                  {isVoided ? (
                                    <Badge variant="destructive">Voided</Badge>
                                  ) : (order as any).isManual ? (
                                    <Badge variant="outline">Manual</Badge>
                                  ) : (
                                    <Badge variant="secondary">{order.status}</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {isVoided ? (
                                    <Button variant="ghost" size="sm" onClick={() => restoreOrderMutation.mutate(order.id)} data-testid={`button-restore-order-${order.id}`}>
                                      <RotateCcw className="w-4 h-4 text-green-600" />
                                    </Button>
                                  ) : (
                                    <Button variant="ghost" size="sm" onClick={() => { setVoidOrderId(order.id); setVoidReason(""); setVoidDialogOpen(true); }} data-testid={`button-void-order-${order.id}`}>
                                      <Ban className="w-4 h-4 text-destructive" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {adminOrders.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                No orders for this period
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

          </main>
        </ScrollArea>
      </div>

      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Time Entry" : "Add Time Entry"}</DialogTitle>
            <DialogDescription>
              {editingEntry ? "Update the clock in/out times" : "Create a new time entry for a stylist"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {!editingEntry && (
              <div className="space-y-2">
                <Label>Stylist</Label>
                <Select value={entryForm.stylistId} onValueChange={(v) => setEntryForm(f => ({ ...f, stylistId: v }))}>
                  <SelectTrigger data-testid="select-entry-stylist">
                    <SelectValue placeholder="Select stylist" />
                  </SelectTrigger>
                  <SelectContent>
                    {stylists.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Clock In</Label>
              <Input
                type="datetime-local"
                value={entryForm.clockIn}
                onChange={(e) => setEntryForm(f => ({ ...f, clockIn: e.target.value }))}
                data-testid="input-entry-clockin"
              />
            </div>
            <div className="space-y-2">
              <Label>Clock Out (leave empty if still working)</Label>
              <Input
                type="datetime-local"
                value={entryForm.clockOut}
                onChange={(e) => setEntryForm(f => ({ ...f, clockOut: e.target.value }))}
                data-testid="input-entry-clockout"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEntrySave} disabled={createEntryMutation.isPending || updateEntryMutation.isPending} data-testid="button-save-entry">
              {createEntryMutation.isPending || updateEntryMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteEntryDialogOpen} onOpenChange={setDeleteEntryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this time entry. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteEntryId && deleteEntryMutation.mutate(deleteEntryId)}
              data-testid="button-confirm-delete-entry"
            >
              {deleteEntryMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set PIN for {pinStylistName}</DialogTitle>
            <DialogDescription>
              Enter a 4-digit PIN that this stylist will use to log in to their dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="pin">PIN (4+ digits)</Label>
            <Input
              id="pin"
              type="password"
              placeholder="Enter PIN"
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
              maxLength={6}
              data-testid="input-pin"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinDialogOpen(false)} data-testid="button-cancel-pin">
              Cancel
            </Button>
            <Button 
              onClick={() => pinStylistId && setPinMutation.mutate({ id: pinStylistId, pin: pinValue })}
              disabled={pinValue.length < 4 || setPinMutation.isPending}
              data-testid="button-save-pin"
            >
              {setPinMutation.isPending ? "Saving..." : "Save PIN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteStylistName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this stylist from the system. Their order history will be preserved but they will no longer appear in the stylist list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteStylistId && deleteStylistMutation.mutate(deleteStylistId)}
              data-testid="button-confirm-delete"
            >
              {deleteStylistMutation.isPending ? "Removing..." : "Remove Stylist"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={tiersDialogOpen} onOpenChange={setTiersDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Commission Tiers for {tiersStylistName}</DialogTitle>
            <DialogDescription>
              Set up to 5 commission tiers based on sales thresholds. When total sales reach each threshold, the stylist earns the corresponding commission rate.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Tier</TableHead>
                  <TableHead>Sales Threshold ($)</TableHead>
                  <TableHead>Commission Rate (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editingTiers.map((tier, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">Level {tier.tierLevel}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={tier.salesThreshold}
                        onChange={(e) => updateTier(index, "salesThreshold", e.target.value)}
                        placeholder="0"
                        data-testid={`input-tier-threshold-${index}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={tier.commissionRate}
                          onChange={(e) => updateTier(index, "commissionRate", e.target.value)}
                          placeholder="40"
                          className="w-20"
                          data-testid={`input-tier-rate-${index}`}
                        />
                        <span className="text-muted-foreground">%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">
              Example: If Tier 2 threshold is $5,000 and rate is 45%, the stylist earns 45% commission once their total sales reach $5,000.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTiersDialogOpen(false)} data-testid="button-cancel-tiers">
              Cancel
            </Button>
            <Button 
              onClick={() => tiersStylistId && setTiersMutation.mutate({ id: tiersStylistId, tiers: editingTiers })}
              disabled={setTiersMutation.isPending}
              data-testid="button-save-tiers"
            >
              {setTiersMutation.isPending ? "Saving..." : "Save Tiers"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manualOrderDialogOpen} onOpenChange={setManualOrderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Manual Order</DialogTitle>
            <DialogDescription>
              Create a manual sales entry that wasn't captured from Vagaro
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Stylist</Label>
              <Select value={manualOrderForm.stylistId} onValueChange={(v) => setManualOrderForm(f => ({ ...f, stylistId: v }))}>
                <SelectTrigger data-testid="select-manual-order-stylist">
                  <SelectValue placeholder="Select stylist" />
                </SelectTrigger>
                <SelectContent>
                  {stylists.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input
                value={manualOrderForm.customerName}
                onChange={(e) => setManualOrderForm(f => ({ ...f, customerName: e.target.value }))}
                placeholder="Customer name"
                data-testid="input-manual-order-customer"
              />
            </div>
            <div className="space-y-2">
              <Label>Services (comma separated)</Label>
              <Input
                value={manualOrderForm.services}
                onChange={(e) => setManualOrderForm(f => ({ ...f, services: e.target.value }))}
                placeholder="Haircut, Color, etc."
                data-testid="input-manual-order-services"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={manualOrderForm.totalAmount}
                  onChange={(e) => setManualOrderForm(f => ({ ...f, totalAmount: e.target.value }))}
                  placeholder="0.00"
                  data-testid="input-manual-order-amount"
                />
              </div>
              <div className="space-y-2">
                <Label>Tip Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={manualOrderForm.tipAmount}
                  onChange={(e) => setManualOrderForm(f => ({ ...f, tipAmount: e.target.value }))}
                  placeholder="0.00"
                  data-testid="input-manual-order-tip"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={manualOrderForm.notes}
                onChange={(e) => setManualOrderForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Additional notes"
                data-testid="input-manual-order-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOrderDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createManualOrderMutation.mutate({
                stylistId: manualOrderForm.stylistId,
                customerName: manualOrderForm.customerName,
                services: manualOrderForm.services ? manualOrderForm.services.split(",").map(s => s.trim()) : undefined,
                totalAmount: manualOrderForm.totalAmount,
                tipAmount: manualOrderForm.tipAmount || undefined,
                notes: manualOrderForm.notes || undefined,
              })}
              disabled={!manualOrderForm.stylistId || !manualOrderForm.customerName || !manualOrderForm.totalAmount || createManualOrderMutation.isPending}
              data-testid="button-save-manual-order"
            >
              {createManualOrderMutation.isPending ? "Creating..." : "Create Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will void the order and exclude it from commission calculations. You can restore it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Reason for voiding</Label>
            <Input
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="e.g., Customer refund, Duplicate entry"
              data-testid="input-void-reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => voidOrderId && voidOrderMutation.mutate({ id: voidOrderId, reason: voidReason })}
              disabled={!voidReason}
              data-testid="button-confirm-void"
            >
              {voidOrderMutation.isPending ? "Voiding..." : "Void Order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={adjustmentDialogOpen} onOpenChange={setAdjustmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Commission Adjustment</DialogTitle>
            <DialogDescription>
              Add a manual adjustment to a stylist's commission for the current pay period
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Stylist</Label>
              <Select value={adjustmentForm.stylistId} onValueChange={(v) => setAdjustmentForm(f => ({ ...f, stylistId: v }))}>
                <SelectTrigger data-testid="select-adjustment-stylist">
                  <SelectValue placeholder="Select stylist" />
                </SelectTrigger>
                <SelectContent>
                  {stylists.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (use negative for deductions)</Label>
              <Input
                type="number"
                step="0.01"
                value={adjustmentForm.amount}
                onChange={(e) => setAdjustmentForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="50.00 or -25.00"
                data-testid="input-adjustment-amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                value={adjustmentForm.reason}
                onChange={(e) => setAdjustmentForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="e.g., Bonus, Product sales, Correction"
                data-testid="input-adjustment-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustmentDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createAdjustmentMutation.mutate({
                stylistId: adjustmentForm.stylistId,
                periodStart: timeclockStartDate,
                periodEnd: timeclockEndDate,
                amount: adjustmentForm.amount,
                reason: adjustmentForm.reason,
              })}
              disabled={!adjustmentForm.stylistId || !adjustmentForm.amount || !adjustmentForm.reason || createAdjustmentMutation.isPending}
              data-testid="button-save-adjustment"
            >
              {createAdjustmentMutation.isPending ? "Creating..." : "Add Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}