import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ShopifyClient } from "./shopify";
import { VagaroClient } from "./vagaro";
import { insertStylistSchema, insertOrderSchema, insertSettingsSchema } from "@shared/schema";
import { z } from "zod";

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
      res.json(stylists);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stylists", async (req, res) => {
    try {
      const validated = insertStylistSchema.parse(req.body);
      const stylist = await storage.createStylist(validated);
      res.json(stylist);
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
      res.json(stylist);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
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
        const vagaroId = emp.employeeId.toString();
        vagaroIds.push(vagaroId);
        
        const stylist = await storage.upsertStylistByVagaroId(vagaroId, {
          name: `${emp.firstName} ${emp.lastName}`.trim(),
          role: emp.jobTitle || "Stylist",
          commissionRate: 40,
          vagaroId: vagaroId,
          enabled: true,
        });
        syncedStylists.push(stylist);
      }
      
      res.json({ 
        message: `Synced ${syncedStylists.length} stylists from Vagaro`,
        stylists: syncedStylists,
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
            if (employee) {
              employeeName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employeeName;
              employeeRole = employee.jobTitle || employeeRole;
              console.log(`[Vagaro Webhook] Found employee: ${employeeName}`);
            }
          }
          
          // Fetch real customer details
          if (customerId) {
            console.log(`[Vagaro Webhook] Fetching customer details for ${customerId}`);
            const customer = await vagaroClient.getCustomerById(customerId);
            if (customer) {
              customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customerName;
              customerEmail = customer.email;
              console.log(`[Vagaro Webhook] Found customer: ${customerName}, email: ${customerEmail}`);
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
          commissionRate: 40,
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

      // Calculate commission
      const commissionAmount = (totalAmount * stylist.commissionRate) / 100;

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

  return httpServer;
}