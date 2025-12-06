import { useState } from "react";
import { useForm } from "react-hook-form";
import { 
  Activity, 
  ArrowRightLeft, 
  CheckCircle2, 
  ChevronRight, 
  LayoutDashboard, 
  Settings, 
  Store, 
  Users, 
  AlertCircle,
  RefreshCw,
  LogOut,
  Calendar
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

// Mock Data
const STYLISTS = [
  { id: "s1", name: "Sarah Jenkins", role: "Senior Stylist" },
  { id: "s2", name: "Michael Chen", role: "Colorist" },
  { id: "s3", name: "Jessica Wu", role: "Junior Stylist" },
  { id: "s4", name: "David Miller", role: "Barber" },
];

const RECENT_LOGS = [
  { id: "evt_1234", time: "2 mins ago", event: "Appointment #9982", status: "success", detail: "Draft Order #D-1024 created" },
  { id: "evt_1233", time: "15 mins ago", event: "Appointment #9981", status: "success", detail: "Draft Order #D-1023 created" },
  { id: "evt_1232", time: "1 hour ago", event: "Appointment #9980", status: "failed", detail: "Customer email missing" },
  { id: "evt_1231", time: "3 hours ago", event: "Appointment #9979", status: "success", detail: "Draft Order #D-1022 created" },
];

export default function Dashboard() {
  const [isConnectedVagaro, setIsConnectedVagaro] = useState(false);
  const [isConnectedShopify, setIsConnectedShopify] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

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
          <Button 
            variant={activeTab === "overview" ? "secondary" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => setActiveTab("overview")}
          >
            <LayoutDashboard className="mr-2 w-4 h-4" /> Overview
          </Button>
          <Button 
            variant={activeTab === "connections" ? "secondary" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => setActiveTab("connections")}
          >
            <Store className="mr-2 w-4 h-4" /> Connections
          </Button>
          <Button 
            variant={activeTab === "configuration" ? "secondary" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => setActiveTab("configuration")}
          >
            <Settings className="mr-2 w-4 h-4" /> Configuration
          </Button>
          <Button 
            variant={activeTab === "logs" ? "secondary" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => setActiveTab("logs")}
          >
            <Activity className="mr-2 w-4 h-4" /> Activity Logs
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
          <h1 className="font-semibold text-lg capitalize">{activeTab}</h1>
          <div className="flex items-center gap-4">
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
                      <div className="text-2xl font-bold">24</div>
                      <p className="text-xs text-muted-foreground mt-1">+12% from yesterday</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">98.5%</div>
                      <p className="text-xs text-muted-foreground mt-1">1 error requiring attention</p>
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
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">Connected</Badge>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setIsConnectedVagaro(true)}>Connect</Button>
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
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">Connected</Badge>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setIsConnectedShopify(true)}>Connect</Button>
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
                        {RECENT_LOGS.map((log) => (
                          <div key={log.id} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                            <div className={`mt-1 w-2 h-2 rounded-full ${log.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{log.event}</span>
                                <span className="text-xs text-muted-foreground">{log.time}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{log.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* CONFIGURATION TAB */}
            {activeTab === "configuration" && (
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
                      <Switch defaultChecked />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between space-x-2">
                      <div className="space-y-0.5">
                        <Label className="text-base">Appointment Updated</Label>
                        <p className="text-sm text-muted-foreground">
                          Update draft order if appointment details change
                        </p>
                      </div>
                      <Switch />
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
                      {STYLISTS.map((stylist) => (
                        <div key={stylist.id} className="flex items-start space-x-3 space-y-0">
                          <Checkbox id={stylist.id} defaultChecked={["s1", "s2"].includes(stylist.id)} />
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
                      <Input placeholder="e.g. vagaro-sync" defaultValue="vagaro-sync" />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label>Tax Settings</Label>
                      <Select defaultValue="auto">
                        <SelectTrigger>
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
                      <Checkbox id="email-customer" defaultChecked />
                      <label
                        htmlFor="email-customer"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Email invoice to customer automatically
                      </label>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-4">
                  <Button variant="outline">Discard Changes</Button>
                  <Button>Save Configuration</Button>
                </div>
              </div>
            )}

            {/* CONNECTIONS TAB */}
            {activeTab === "connections" && (
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
                    {!isConnectedVagaro ? (
                      <div className="space-y-4">
                        <div className="grid gap-2">
                          <Label>API Key</Label>
                          <Input type="password" placeholder="Enter your Vagaro API Key" />
                        </div>
                        <div className="grid gap-2">
                          <Label>Business ID</Label>
                          <Input placeholder="Your Vagaro Business ID" />
                        </div>
                        <Button onClick={() => setIsConnectedVagaro(true)} className="w-full bg-[hsl(14,100%,57%)] hover:bg-[hsl(14,100%,50%)] text-white">Connect Vagaro</Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                          Connected to <span className="font-medium text-foreground">Jane Salon (ID: 88291)</span>
                        </div>
                        <div className="flex gap-3">
                          <Button variant="outline" size="sm">Test Connection</Button>
                          <Button variant="destructive" size="sm" onClick={() => setIsConnectedVagaro(false)}>Disconnect</Button>
                        </div>
                      </div>
                    )}
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
                    {!isConnectedShopify ? (
                      <div className="space-y-4">
                        <div className="grid gap-2">
                          <Label>Store URL</Label>
                          <div className="flex items-center">
                            <Input placeholder="your-store" className="rounded-r-none" />
                            <div className="bg-muted border border-l-0 rounded-r-md px-3 py-2 text-sm text-muted-foreground">.myshopify.com</div>
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label>Admin API Access Token</Label>
                          <Input type="password" placeholder="shpat_..." />
                        </div>
                        <Button onClick={() => setIsConnectedShopify(true)} className="w-full bg-[hsl(149,34%,42%)] hover:bg-[hsl(149,34%,35%)] text-white">Connect Shopify</Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                          Connected to <span className="font-medium text-foreground">jane-salon.myshopify.com</span>
                        </div>
                        <div className="flex gap-3">
                          <Button variant="outline" size="sm">Test Connection</Button>
                          <Button variant="destructive" size="sm" onClick={() => setIsConnectedShopify(false)}>Disconnect</Button>
                        </div>
                      </div>
                    )}
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
                    <Button variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
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
                      {RECENT_LOGS.map((log) => (
                        <div key={log.id} className="grid grid-cols-5 gap-4 p-4 text-sm hover:bg-muted/30 transition-colors">
                          <div className="col-span-1 font-mono text-xs text-muted-foreground flex items-center">{log.time}</div>
                          <div className="col-span-1 flex items-center">
                            <Badge variant="outline" className={log.status === 'success' ? "text-green-600 border-green-200 bg-green-50" : "text-red-600 border-red-200 bg-red-50"}>
                              {log.status}
                            </Badge>
                          </div>
                          <div className="col-span-1 font-medium">{log.event}</div>
                          <div className="col-span-2 text-muted-foreground">{log.detail}</div>
                        </div>
                      ))}
                      {/* Add more mock logs for the logs tab specifically */}
                      <div className="grid grid-cols-5 gap-4 p-4 text-sm hover:bg-muted/30 transition-colors">
                        <div className="col-span-1 font-mono text-xs text-muted-foreground flex items-center">5 hours ago</div>
                        <div className="col-span-1 flex items-center"><Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">success</Badge></div>
                        <div className="col-span-1 font-medium">Appointment #9978</div>
                        <div className="col-span-2 text-muted-foreground">Draft Order #D-1021 created</div>
                      </div>
                       <div className="grid grid-cols-5 gap-4 p-4 text-sm hover:bg-muted/30 transition-colors">
                        <div className="col-span-1 font-mono text-xs text-muted-foreground flex items-center">Yesterday</div>
                        <div className="col-span-1 flex items-center"><Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">success</Badge></div>
                        <div className="col-span-1 font-medium">Appointment #9977</div>
                        <div className="col-span-2 text-muted-foreground">Draft Order #D-1020 created</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

          </main>
        </ScrollArea>
      </div>
    </div>
  );
}