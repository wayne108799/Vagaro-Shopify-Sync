import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, getPayPeriod } from "./storage";
import { ShopifyClient } from "./shopify";
import { VagaroClient } from "./vagaro";
import { insertStylistSchema, insertOrderSchema, insertSettingsSchema, type Stylist } from "@shared/schema";
import { z } from "zod";

function sanitizeStylist(stylist: Stylist) {
  const { pinHash, ...rest } = stylist;
  return rest;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Webhook URL endpoint
  app.get("/api/webhook-url", (_req, res) => {
    const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DEPLOYMENT_URL;
    if (domain) {
      res.json({ 
        vagaroWebhookUrl: `https://${domain}/api/webhooks/vagaro`,
        shopifyWebhookUrl: `https://${domain}/api/webhooks/shopify`
      });
    } else {
      res.json({ 
        vagaroWebhookUrl: `${_req.protocol}://${_req.get('host')}/api/webhooks/vagaro`,
        shopifyWebhookUrl: `${_req.protocol}://${_req.get('host')}/api/webhooks/shopify`
      });
    }
  });

  // Stylists endpoints
  app.get("/api/stylists", async (_req, res) => {
    try {
      const stylists = await storage.getStylists();
      res.json(stylists.map(sanitizeStylist));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stylists", async (req, res) => {
    try {
      const validated = insertStylistSchema.parse(req.body);
      const stylist = await storage.createStylist(validated);
      res.json(sanitizeStylist(stylist));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/stylists/:id", async (req, res) => {
    try {
      const stylist = await storage.updateStylist(req.params.id, req.body);
      if (!stylist) {
        return res.status(404).json({ error: "Stylist not found" });
      }
      res.json(sanitizeStylist(stylist));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/stylists/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteStylist(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Stylist not found" });
      }
      res.json({ message: "Stylist deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Commission tiers endpoints
  app.get("/api/stylists/:id/commission-tiers", async (req, res) => {
    try {
      const tiers = await storage.getCommissionTiers(req.params.id);
      res.json(tiers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/stylists/:id/commission-tiers", async (req, res) => {
    try {
      const { tiers } = req.body;
      if (!Array.isArray(tiers)) {
        return res.status(400).json({ error: "Tiers must be an array" });
      }
      const result = await storage.setCommissionTiers(req.params.id, tiers);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Orders endpoints
  app.get("/api/orders", async (req, res) => {
    try {
      const filters: any = {};
      
      if (req.query.stylistId) {
        filters.stylistId = req.query.stylistId as string;
      }
      if (req.query.status) {
        filters.status = req.query.status as string;
      }
      if (req.query.fromDate) {
        filters.fromDate = new Date(req.query.fromDate as string);
      }
      
      const orders = await storage.getOrders(filters);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Settings endpoints
  app.get("/api/settings", async (_req, res) => {
    try {
      const settingsData = await storage.getSettings();
      if (!settingsData) {
        return res.json({
          vagaroClientId: null,
          vagaroClientSecret: null,
          vagaroMerchantId: null,
          vagaroRegion: "us",
          shopifyStoreUrl: null,
          shopifyAccessToken: null,
          defaultOrderTag: "vagaro-sync",
          taxSetting: "auto",
          emailCustomer: true,
          syncOnBooked: true,
          syncOnUpdated: false,
        });
      }
      res.json(settingsData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/settings", async (req, res) => {
    try {
      const settingsData = await storage.upsertSettings(req.body);
      res.json(settingsData);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Sync stylists from Vagaro
  app.post("/api/vagaro/sync-stylists", async (_req, res) => {
    try {
      const settingsData = await storage.getSettings();
      if (!settingsData?.vagaroClientId || !settingsData?.vagaroClientSecret) {
        return res.status(400).json({ error: "Vagaro credentials not configured" });
      }

      const vagaroClient = new VagaroClient(settingsData);
      const businessId = await vagaroClient.getBusinessId();
      const employees = await vagaroClient.getEmployees();
      
      const syncedStylists = [];
      const vagaroIds: string[] = [];
      
      for (const emp of employees) {
        const vagaroId = (emp.employeeId || emp.serviceProviderId || '').toString();
        vagaroIds.push(vagaroId);
        
        const firstName = emp.employeeFirstName || emp.firstName || '';
        const lastName = emp.employeeLastName || emp.lastName || '';
        const stylist = await storage.upsertStylistByVagaroId(vagaroId, {
          name: `${firstName} ${lastName}`.trim() || 'Unknown',
          role: emp.jobTitle || "Stylist",
          commissionRate: "40",
          vagaroId: vagaroId,
          enabled: true,
        });
        syncedStylists.push(stylist);
      }
      
      res.json({ 
        message: `Synced ${syncedStylists.length} stylists from Vagaro`,
        stylists: syncedStylists.map(sanitizeStylist),
        businessId: businessId
      });
    } catch (error: any) {
      console.error("Vagaro sync error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vagaro webhook endpoint
  app.post("/api/webhooks/vagaro", async (req, res) => {
    try {
      console.log("[Vagaro Webhook] Received payload:", JSON.stringify(req.body, null, 2));
      console.log("[Vagaro Webhook] Headers:", JSON.stringify(req.headers, null, 2));
      
      const settings = await storage.getSettings();
      if (!settings?.syncOnBooked) {
        console.log("[Vagaro Webhook] Sync disabled in settings");
        return res.json({ message: "Sync disabled" });
      }

      const webhookData = req.body;
      const payload = webhookData.payload || webhookData;
      
      // Extract data from Vagaro's actual payload structure
      const serviceProviderId = payload.serviceProviderId || payload.employeeId;
      const appointmentId = payload.appointmentId || webhookData.id;
      const totalAmount = parseFloat(payload.amount || payload.totalAmount || "0");
      const serviceTitle = payload.serviceTitle || payload.serviceName || "Service";
      const customerId = payload.customerId;
      const businessId = payload.businessId;
      
      console.log(`[Vagaro Webhook] Processing appointment ${appointmentId} for service provider ${serviceProviderId}`);
      
      // Always store the latest businessId from webhook
      if (businessId && settings.vagaroBusinessId !== businessId) {
        console.log(`[Vagaro Webhook] Updating businessId in settings: ${businessId}`);
        await storage.upsertSettings({ vagaroBusinessId: businessId });
      }

      // Try to fetch real employee and customer data from Vagaro API
      let employeeName = `Stylist ${serviceProviderId?.substring(0, 8) || 'Unknown'}`;
      let employeeRole = payload.serviceCategory || "Stylist";
      let customerName = `Customer ${customerId?.substring(0, 8) || 'Unknown'}`;
      let customerEmail: string | undefined = undefined;

      try {
        if (settings.vagaroClientId && settings.vagaroClientSecret && settings.vagaroMerchantId) {
          const vagaroClient = new VagaroClient({
            ...settings,
            vagaroBusinessId: businessId || settings.vagaroBusinessId,
          });
          
          // Fetch real employee details
          if (serviceProviderId) {
            console.log(`[Vagaro Webhook] Fetching employee details for ${serviceProviderId}`);
            const employee = await vagaroClient.getEmployeeById(serviceProviderId);
            console.log(`[Vagaro Webhook] Employee API response:`, JSON.stringify(employee));
            if (employee) {
              const firstName = (employee as any).employeeFirstName || (employee as any).firstName || '';
              const lastName = (employee as any).employeeLastName || (employee as any).lastName || '';
              console.log(`[Vagaro Webhook] Extracted names: firstName="${firstName}", lastName="${lastName}"`);
              if (firstName || lastName) {
                employeeName = `${firstName} ${lastName}`.trim();
              }
              employeeRole = (employee as any).jobTitle || employeeRole;
              console.log(`[Vagaro Webhook] Final employee name: ${employeeName}`);
            }
          }
          
          // Fetch real customer details
          if (customerId) {
            console.log(`[Vagaro Webhook] Fetching customer details for ${customerId}`);
            const customer = await vagaroClient.getCustomerById(customerId);
            console.log(`[Vagaro Webhook] Customer API response:`, JSON.stringify(customer));
            if (customer) {
              const firstName = (customer as any).customerFirstName || (customer as any).firstName || '';
              const lastName = (customer as any).customerLastName || (customer as any).lastName || '';
              console.log(`[Vagaro Webhook] Extracted customer names: firstName="${firstName}", lastName="${lastName}"`);
              if (firstName || lastName) {
                customerName = `${firstName} ${lastName}`.trim();
              }
              customerEmail = (customer as any).email;
              console.log(`[Vagaro Webhook] Final customer name: ${customerName}, email: ${customerEmail}`);
            }
          }
        }
      } catch (apiError: any) {
        console.log(`[Vagaro Webhook] Could not fetch API details, using webhook data: ${apiError.message}`);
      }
      
      // Find stylist by Vagaro ID (serviceProviderId)
      const allStylists = await storage.getStylists();
      let stylist = allStylists.find(s => s.vagaroId === serviceProviderId && s.enabled);
      
      // If stylist not found, create with real name from API
      if (!stylist) {
        console.log(`[Vagaro Webhook] Stylist ${serviceProviderId} not found, creating: ${employeeName}`);
        stylist = await storage.upsertStylistByVagaroId(serviceProviderId, {
          name: employeeName,
          role: employeeRole,
          commissionRate: "40",
          vagaroId: serviceProviderId,
          enabled: true,
        });
        console.log(`[Vagaro Webhook] Created stylist: ${stylist.name}`);
      } else if (stylist.name.startsWith('Stylist ') && !employeeName.startsWith('Stylist ')) {
        // Update stylist with real name if we have it
        console.log(`[Vagaro Webhook] Updating stylist name from ${stylist.name} to ${employeeName}`);
        stylist = await storage.upsertStylistByVagaroId(serviceProviderId, {
          name: employeeName,
          role: employeeRole,
          commissionRate: stylist.commissionRate,
          vagaroId: serviceProviderId,
          enabled: stylist.enabled,
        });
      }

      // Check if order already exists
      const existing = await storage.getOrderByVagaroId(appointmentId);
      if (existing) {
        return res.json({ message: "Order already synced", orderId: existing.id });
      }

      // Calculate total sales for this stylist to determine tier
      const stylistOrders = await storage.getOrders({ stylistId: stylist.id });
      const totalSales = stylistOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0);
      
      // Get applicable commission rate based on tiers (or fall back to base rate)
      const commissionRate = await storage.getApplicableCommissionRate(stylist.id, totalSales);
      const commissionAmount = (totalAmount * commissionRate) / 100;

      // Create draft order in Shopify
      let shopifyDraftOrderId: string | undefined;
      
      if (settings.shopifyStoreUrl && settings.shopifyAccessToken) {
        const shopifyClient = new ShopifyClient(settings);
        const draftOrder = await shopifyClient.createDraftOrder({
          customerName: customerName,
          customerEmail: customerEmail,
          lineItems: [{
            title: serviceTitle,
            price: totalAmount.toString(),
            quantity: 1,
          }],
          tags: [settings.defaultOrderTag, `stylist:${stylist.name}`],
          note: `Vagaro Appointment #${appointmentId}`,
        });
        
        shopifyDraftOrderId = draftOrder.id;
      }

      // Create order in database
      const order = await storage.createOrder({
        vagaroAppointmentId: appointmentId,
        shopifyDraftOrderId,
        stylistId: stylist.id,
        customerName: customerName,
        customerEmail: customerEmail,
        services: [serviceTitle],
        totalAmount: totalAmount.toFixed(2),
        tipAmount: "0",
        commissionAmount: commissionAmount.toFixed(2),
        status: "draft",
      });

      console.log(`[Vagaro Webhook] Order created: ${order.id}`);
      res.json({ message: "Order created", order, businessId });
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Shopify webhook endpoint for order updates
  app.post("/api/webhooks/shopify", async (req, res) => {
    try {
      const shopifyOrder = req.body;
      
      // Find order by Shopify order ID
      const allOrders = await storage.getOrders({});
      const order = allOrders.find(o => o.shopifyOrderId === shopifyOrder.id.toString());
      
      if (!order) {
        return res.json({ message: "Order not found" });
      }

      // Update order with payment info
      const tipAmount = parseFloat(shopifyOrder.current_total_tip_set?.shop_money?.amount || "0");
      
      await storage.updateOrder(order.id, {
        status: "paid",
        tipAmount: tipAmount.toFixed(2),
        paidAt: new Date(),
        shopifyOrderId: shopifyOrder.id.toString(),
      });

      res.json({ message: "Order updated" });
    } catch (error: any) {
      console.error("Shopify webhook error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Stats endpoint for stylist earnings
  app.get("/api/stylists/:id/stats", async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const paidOrders = await storage.getOrders({
        stylistId: req.params.id,
        status: "paid",
        fromDate: today,
      });

      const totalSales = paidOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0);
      const totalCommission = paidOrders.reduce((sum, o) => sum + parseFloat(o.commissionAmount), 0);
      const totalTips = paidOrders.reduce((sum, o) => sum + parseFloat(o.tipAmount), 0);

      res.json({
        totalSales: totalSales.toFixed(2),
        totalCommission: totalCommission.toFixed(2),
        totalTips: totalTips.toFixed(2),
        totalEarnings: (totalCommission + totalTips).toFixed(2),
        orderCount: paidOrders.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Stylist PIN management (admin)
  app.post("/api/stylists/:id/pin", async (req, res) => {
    try {
      const { pin } = req.body;
      if (!pin || pin.length < 4) {
        return res.status(400).json({ error: "PIN must be at least 4 digits" });
      }
      const crypto = await import("crypto");
      const pinHash = crypto.createHash("sha256").update(pin).digest("hex");
      const stylist = await storage.setStylistPin(req.params.id, pinHash);
      if (!stylist) {
        return res.status(404).json({ error: "Stylist not found" });
      }
      res.json({ message: "PIN set successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Stylist login
  app.post("/api/stylist/login", async (req, res) => {
    try {
      const { stylistId, pin } = req.body;
      if (!stylistId || !pin) {
        return res.status(400).json({ error: "Stylist ID and PIN are required" });
      }
      const stylist = await storage.getStylist(stylistId);
      if (!stylist || !stylist.pinHash) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const crypto = await import("crypto");
      const pinHash = crypto.createHash("sha256").update(pin).digest("hex");
      if (pinHash !== stylist.pinHash) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      req.session.stylistId = stylist.id;
      res.json({ message: "Login successful", stylist: { id: stylist.id, name: stylist.name, role: stylist.role } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Stylist logout
  app.post("/api/stylist/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current logged-in stylist
  app.get("/api/stylist/me", async (req, res) => {
    try {
      if (!req.session.stylistId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const stylist = await storage.getStylist(req.session.stylistId);
      if (!stylist) {
        return res.status(404).json({ error: "Stylist not found" });
      }
      res.json({ id: stylist.id, name: stylist.name, role: stylist.role, commissionRate: stylist.commissionRate });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get stats for logged-in stylist
  app.get("/api/stylist/me/stats", async (req, res) => {
    try {
      if (!req.session.stylistId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());

      const [todayOrders, weekOrders] = await Promise.all([
        storage.getOrders({ stylistId: req.session.stylistId, fromDate: today }),
        storage.getOrders({ stylistId: req.session.stylistId, fromDate: weekStart }),
      ]);

      const todayStats = {
        sales: todayOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0),
        commission: todayOrders.reduce((sum, o) => sum + parseFloat(o.commissionAmount), 0),
        tips: todayOrders.reduce((sum, o) => sum + parseFloat(o.tipAmount), 0),
        orders: todayOrders.length,
      };

      const weekStats = {
        sales: weekOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0),
        commission: weekOrders.reduce((sum, o) => sum + parseFloat(o.commissionAmount), 0),
        tips: weekOrders.reduce((sum, o) => sum + parseFloat(o.tipAmount), 0),
        orders: weekOrders.length,
      };

      res.json({
        today: { ...todayStats, earnings: todayStats.commission + todayStats.tips },
        week: { ...weekStats, earnings: weekStats.commission + weekStats.tips },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get orders for logged-in stylist
  app.get("/api/stylist/me/orders", async (req, res) => {
    try {
      if (!req.session.stylistId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const orders = await storage.getOrders({ stylistId: req.session.stylistId });
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Timeclock - clock in
  app.post("/api/stylist/timeclock/clock-in", async (req, res) => {
    try {
      if (!req.session.stylistId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const existingEntry = await storage.getOpenTimeEntry(req.session.stylistId);
      if (existingEntry) {
        return res.status(400).json({ error: "Already clocked in" });
      }
      const entry = await storage.clockIn(req.session.stylistId);
      res.json(entry);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Timeclock - clock out
  app.post("/api/stylist/timeclock/clock-out", async (req, res) => {
    try {
      if (!req.session.stylistId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const entry = await storage.clockOut(req.session.stylistId);
      if (!entry) {
        return res.status(400).json({ error: "Not clocked in" });
      }
      res.json(entry);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Timeclock - get status (open entry + current period hours)
  app.get("/api/stylist/timeclock/status", async (req, res) => {
    try {
      if (!req.session.stylistId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const payPeriod = getPayPeriod(new Date());
      const [openEntry, hours] = await Promise.all([
        storage.getOpenTimeEntry(req.session.stylistId),
        storage.getPayPeriodHours(req.session.stylistId, payPeriod.start, payPeriod.end),
      ]);
      res.json({
        isClockedIn: !!openEntry,
        clockedInAt: openEntry?.clockIn || null,
        payPeriod,
        hoursThisPeriod: hours,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Timeclock - get all entries with filters
  app.get("/api/admin/timeclock/entries", async (req, res) => {
    try {
      const filters: { stylistId?: string; startDate?: string; endDate?: string } = {};
      if (req.query.stylistId) filters.stylistId = req.query.stylistId as string;
      if (req.query.startDate) filters.startDate = req.query.startDate as string;
      if (req.query.endDate) filters.endDate = req.query.endDate as string;
      
      const entries = await storage.getAllTimeEntries(filters);
      res.json(entries);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Timeclock - create entry
  app.post("/api/admin/timeclock/entries", async (req, res) => {
    try {
      const { stylistId, clockIn, clockOut } = req.body;
      if (!stylistId || !clockIn) {
        return res.status(400).json({ error: "stylistId and clockIn are required" });
      }
      const clockInDate = new Date(clockIn);
      const payPeriod = getPayPeriod(clockInDate);
      const entry = await storage.createTimeEntry({
        stylistId,
        clockIn: clockInDate,
        clockOut: clockOut ? new Date(clockOut) : undefined,
        payPeriodStart: payPeriod.start,
        payPeriodEnd: payPeriod.end,
      });
      res.json(entry);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Timeclock - update entry
  app.patch("/api/admin/timeclock/entries/:id", async (req, res) => {
    try {
      const { clockIn, clockOut } = req.body;
      const updateData: any = {};
      if (clockIn) {
        updateData.clockIn = new Date(clockIn);
        const payPeriod = getPayPeriod(updateData.clockIn);
        updateData.payPeriodStart = payPeriod.start;
        updateData.payPeriodEnd = payPeriod.end;
      }
      if (clockOut !== undefined) {
        updateData.clockOut = clockOut ? new Date(clockOut) : null;
      }
      const entry = await storage.updateTimeEntry(req.params.id, updateData);
      if (!entry) {
        return res.status(404).json({ error: "Entry not found" });
      }
      res.json(entry);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Timeclock - delete entry
  app.delete("/api/admin/timeclock/entries/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteTimeEntry(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Entry not found" });
      }
      res.json({ message: "Entry deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Timeclock - get report
  app.get("/api/admin/timeclock/report", async (req, res) => {
    try {
      const { startDate, endDate, stylistId } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }
      const report = await storage.getTimeclockReport(
        startDate as string,
        endDate as string,
        stylistId as string | undefined
      );
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Manual Orders - create a manual sale
  app.post("/api/admin/orders", async (req, res) => {
    try {
      const { stylistId, customerName, services, totalAmount, tipAmount, notes } = req.body;
      if (!stylistId || !customerName || !totalAmount) {
        return res.status(400).json({ error: "stylistId, customerName, and totalAmount are required" });
      }
      
      const stylistOrders = await storage.getOrders({ stylistId });
      const totalSales = stylistOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0);
      const commissionRate = await storage.getApplicableCommissionRate(stylistId, totalSales);
      const commissionAmount = (parseFloat(totalAmount) * commissionRate) / 100;
      
      const order = await storage.createOrder({
        stylistId,
        customerName,
        customerEmail: null,
        services: services || ["Manual Sale"],
        totalAmount: parseFloat(totalAmount).toFixed(2),
        tipAmount: parseFloat(tipAmount || "0").toFixed(2),
        commissionAmount: commissionAmount.toFixed(2),
        status: "paid",
        isManual: true,
        notes,
        paidAt: new Date(),
      });
      res.json(order);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Orders - void an order
  app.post("/api/admin/orders/:id/void", async (req, res) => {
    try {
      const { reason } = req.body;
      if (!reason) {
        return res.status(400).json({ error: "Reason is required" });
      }
      const order = await storage.voidOrder(req.params.id, reason);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Orders - restore a voided order
  app.post("/api/admin/orders/:id/restore", async (req, res) => {
    try {
      const order = await storage.restoreOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Orders - get orders for period
  app.get("/api/admin/orders", async (req, res) => {
    try {
      const { startDate, endDate, stylistId, includeVoided } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }
      const orders = await storage.getOrdersForPeriod(
        startDate as string,
        endDate as string,
        stylistId as string | undefined,
        includeVoided === "true"
      );
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Commission Adjustments - list
  app.get("/api/admin/commission-adjustments", async (req, res) => {
    try {
      const filters: { stylistId?: string; periodStart?: string; periodEnd?: string } = {};
      if (req.query.stylistId) filters.stylistId = req.query.stylistId as string;
      if (req.query.periodStart) filters.periodStart = req.query.periodStart as string;
      if (req.query.periodEnd) filters.periodEnd = req.query.periodEnd as string;
      
      const adjustments = await storage.getCommissionAdjustments(filters);
      res.json(adjustments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Commission Adjustments - create
  app.post("/api/admin/commission-adjustments", async (req, res) => {
    try {
      const { stylistId, periodStart, periodEnd, amount, reason, orderId } = req.body;
      if (!stylistId || !periodStart || !periodEnd || amount === undefined || !reason) {
        return res.status(400).json({ error: "stylistId, periodStart, periodEnd, amount, and reason are required" });
      }
      const adjustment = await storage.createCommissionAdjustment({
        stylistId,
        periodStart,
        periodEnd,
        amount: parseFloat(amount).toFixed(2),
        reason,
        orderId: orderId || null,
      });
      res.json(adjustment);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Commission Adjustments - update
  app.patch("/api/admin/commission-adjustments/:id", async (req, res) => {
    try {
      const adjustment = await storage.updateCommissionAdjustment(req.params.id, req.body);
      if (!adjustment) {
        return res.status(404).json({ error: "Adjustment not found" });
      }
      res.json(adjustment);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Commission Adjustments - delete
  app.delete("/api/admin/commission-adjustments/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCommissionAdjustment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Adjustment not found" });
      }
      res.json({ message: "Adjustment deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Commission Report
  app.get("/api/admin/commission-report", async (req, res) => {
    try {
      const { startDate, endDate, stylistId } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }
      const report = await storage.getCommissionReport(
        startDate as string,
        endDate as string,
        stylistId as string | undefined
      );
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}