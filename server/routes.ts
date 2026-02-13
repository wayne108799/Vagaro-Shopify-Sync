import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, getPayPeriod } from "./storage";
import { ShopifyClient } from "./shopify";
import { VagaroClient } from "./vagaro";
import { insertStylistSchema, insertOrderSchema, insertSettingsSchema, type Stylist } from "@shared/schema";
import { z } from "zod";

declare module "express-session" {
  interface SessionData {
    adminId?: string;
    adminUsername?: string;
    stylistId?: string;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.adminId) {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  next();
}

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

  app.post("/api/stylists", requireAdmin, async (req, res) => {
    try {
      const validated = insertStylistSchema.parse(req.body);
      const stylist = await storage.createStylist(validated);
      res.json(sanitizeStylist(stylist));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/stylists/:id", requireAdmin, async (req, res) => {
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

  app.delete("/api/stylists/:id", requireAdmin, async (req, res) => {
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

  app.put("/api/stylists/:id/commission-tiers", requireAdmin, async (req, res) => {
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

  app.patch("/api/settings", requireAdmin, async (req, res) => {
    try {
      const settingsData = await storage.upsertSettings(req.body);
      res.json(settingsData);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Sync stylists from Vagaro
  app.post("/api/vagaro/sync-stylists", requireAdmin, async (_req, res) => {
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
      const webhookData = req.body;
      const payload = webhookData.payload || webhookData;
      
      // Check for cancellation or deletion events - Vagaro can send these in various ways
      const eventType = webhookData.event || webhookData.eventType || payload.event || payload.eventType || "";
      const appointmentStatus = payload.status || payload.appointmentStatus || "";
      // Vagaro also sends action field in Appointment object
      const appointmentAction = payload.action || payload.Action || 
                                (payload.Appointment?.Action) || (payload.Appointment?.action) || 
                                webhookData.action || "";
      const isCanceled = eventType.toLowerCase().includes("cancel") || 
                         eventType.toLowerCase().includes("delete") ||
                         appointmentStatus.toLowerCase() === "canceled" ||
                         appointmentStatus.toLowerCase() === "cancelled" ||
                         appointmentStatus.toLowerCase() === "deleted" ||
                         appointmentAction.toLowerCase() === "cancel" ||
                         appointmentAction.toLowerCase() === "delete" ||
                         appointmentAction.toLowerCase() === "cancelled" ||
                         appointmentAction.toLowerCase() === "canceled";
      
      const appointmentId = payload.appointmentId || webhookData.id;
      
      // Handle cancellation/deletion - update order status and delete Shopify draft
      if (isCanceled && appointmentId) {
        console.log(`[Vagaro Webhook] Processing cancellation for appointment ${appointmentId}`);
        const existing = await storage.getOrderByVagaroId(appointmentId);
        
        if (existing) {
          // Delete draft order from Shopify if it exists
          if (existing.shopifyDraftOrderId && settings?.shopifyStoreUrl && settings?.shopifyAccessToken) {
            try {
              const shopifyClient = new ShopifyClient(settings);
              await shopifyClient.deleteDraftOrder(existing.shopifyDraftOrderId);
              console.log(`[Vagaro Webhook] Deleted Shopify draft order: ${existing.shopifyDraftOrderId}`);
            } catch (shopifyError: any) {
              console.log(`[Vagaro Webhook] Could not delete Shopify draft: ${shopifyError.message}`);
            }
          }
          
          // Update order status to canceled (keep in database)
          const newStatus = eventType.toLowerCase().includes("delete") ? "deleted" : "canceled";
          await storage.updateOrder(existing.id, { 
            status: newStatus,
            shopifyDraftOrderId: null, // Clear the draft order reference
          });
          console.log(`[Vagaro Webhook] Updated order ${existing.id} status to: ${newStatus}`);
          return res.json({ message: `Order ${newStatus}`, orderId: existing.id });
        } else {
          console.log(`[Vagaro Webhook] No existing order found for canceled appointment ${appointmentId}`);
          return res.json({ message: "No order to cancel" });
        }
      }
      
      // Check if this is an update to an existing appointment
      const existingOrder = appointmentId ? await storage.getOrderByVagaroId(appointmentId) : null;
      const isUpdate = !!existingOrder;
      
      // For non-cancellation events, check sync settings
      if (!isUpdate && !settings?.syncOnBooked) {
        console.log("[Vagaro Webhook] Sync disabled in settings (new appointment)");
        return res.json({ message: "Sync disabled" });
      }
      if (isUpdate && !settings?.syncOnUpdated) {
        console.log("[Vagaro Webhook] Update sync disabled in settings");
        return res.json({ message: "Update sync disabled" });
      }
      
      // Extract data from Vagaro's actual payload structure - check multiple locations
      // Vagaro sends data in different formats for online vs in-app bookings
      const appointment = payload.Appointment || payload.appointment || payload;
      const services = appointment.Services || appointment.services || payload.Services || [];
      const firstService = services[0] || {};
      
      const serviceProviderId = payload.serviceProviderId || payload.employeeId || 
                                 appointment.ServiceProviderId || appointment.serviceProviderId ||
                                 appointment.EmployeeId || appointment.employeeId ||
                                 firstService.ServiceProviderId || firstService.serviceProviderId ||
                                 firstService.EmployeeId || firstService.employeeId;
      const totalAmount = parseFloat(
        payload.amount || payload.totalAmount || 
        appointment.TotalAmount || appointment.totalAmount ||
        appointment.Amount || appointment.amount ||
        firstService.Price || firstService.price || "0"
      );
      const serviceTitle = payload.serviceTitle || payload.serviceName || 
                           appointment.ServiceTitle || appointment.serviceTitle ||
                           firstService.ServiceTitle || firstService.serviceTitle ||
                           firstService.Name || firstService.name || "Service";
      const customerId = payload.customerId || appointment.CustomerId || appointment.customerId;
      const businessId = payload.businessId || appointment.BusinessId || appointment.businessId;

      // Skip personal time blocks / blocked time - requires BOTH no customer AND keyword match
      const blockedKeywords = ['personal time', 'block', 'break', 'lunch', 'off', 'not available', 'closed', 'meeting', 'admin'];
      const hasBlockedKeyword = serviceTitle && blockedKeywords.some(kw => serviceTitle.toLowerCase().includes(kw));
      const isBlockedTime = !customerId && hasBlockedKeyword;
      if (isBlockedTime) {
        console.log(`[Vagaro Webhook] Skipping personal time / blocked time: "${serviceTitle}", customerId: ${customerId}`);
        return res.json({ message: "Skipped: personal time or blocked slot" });
      }
      
      // Also skip if there's absolutely no customer (no customerId at all) and no meaningful service
      if (!customerId && (!serviceTitle || serviceTitle === "Service")) {
        console.log(`[Vagaro Webhook] Skipping: no customer and no service title`);
        return res.json({ message: "Skipped: no customer data" });
      }
      
      // Skip if there's no service provider / stylist ID
      if (!serviceProviderId) {
        console.log(`[Vagaro Webhook] Skipping: no serviceProviderId in payload`);
        return res.json({ message: "Skipped: no stylist identifier" });
      }
      
      console.log(`[Vagaro Webhook] Extracted: serviceProviderId=${serviceProviderId}, totalAmount=${totalAmount}, serviceTitle=${serviceTitle}`);
      
      // Extract actual appointment date/time from Vagaro payload - check multiple locations
      const appointmentDateStr = payload.startDateTime || payload.appointmentDate || 
                                  payload.scheduledDate || payload.startTime ||
                                  appointment.StartDateTime || appointment.startDateTime ||
                                  appointment.AppointmentDate || appointment.appointmentDate ||
                                  appointment.ScheduledDate || appointment.scheduledDate ||
                                  firstService.StartDateTime || firstService.startDateTime ||
                                  webhookData.startDateTime;
      let appointmentDate = new Date();
      if (appointmentDateStr) {
        const parsed = new Date(appointmentDateStr);
        if (!isNaN(parsed.getTime())) {
          appointmentDate = parsed;
          console.log(`[Vagaro Webhook] Extracted appointment date: ${appointmentDate.toISOString()}`);
        }
      } else {
        console.log(`[Vagaro Webhook] No appointment date found in payload, using current date`);
      }
      
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
      let customerPhone: string | undefined = undefined;

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
              customerPhone = (customer as any).phone || (customer as any).mobilePhone || (customer as any).cellPhone;
              console.log(`[Vagaro Webhook] Final customer name: ${customerName}, email: ${customerEmail}, phone: ${customerPhone}`);
            }
          }
        }
      } catch (apiError: any) {
        console.log(`[Vagaro Webhook] Could not fetch API details, using webhook data: ${apiError.message}`);
      }
      
      // Find stylist by Vagaro ID (serviceProviderId) - check ALL stylists first (enabled or not)
      const allStylists = await storage.getStylists();
      let stylist = allStylists.find(s => s.vagaroId === serviceProviderId);
      
      if (stylist) {
        // Stylist exists - update name if needed but PRESERVE their enabled status
        if (stylist.name.startsWith('Stylist ') && !employeeName.startsWith('Stylist ')) {
          console.log(`[Vagaro Webhook] Updating stylist name from ${stylist.name} to ${employeeName}`);
          stylist = await storage.upsertStylistByVagaroId(serviceProviderId, {
            name: employeeName,
            role: employeeRole,
            commissionRate: stylist.commissionRate,
            vagaroId: serviceProviderId,
            enabled: stylist.enabled,
          });
        }
        console.log(`[Vagaro Webhook] Using existing stylist: ${stylist.name} (enabled: ${stylist.enabled})`);

        // Skip syncing for disabled stylists
        if (!stylist.enabled) {
          console.log(`[Vagaro Webhook] Skipping sync for disabled stylist: ${stylist.name}`);
          return res.json({ message: `Skipped: stylist ${stylist.name} is disabled` });
        }
      } else {
        // Stylist doesn't exist at all - create new one
        console.log(`[Vagaro Webhook] Stylist ${serviceProviderId} not found, creating: ${employeeName}`);
        stylist = await storage.upsertStylistByVagaroId(serviceProviderId, {
          name: employeeName,
          role: employeeRole,
          commissionRate: "40",
          vagaroId: serviceProviderId,
          enabled: true,
        });
        console.log(`[Vagaro Webhook] Created stylist: ${stylist.name}`);
      }

      // Check if order already exists
      const existing = await storage.getOrderByVagaroId(appointmentId);
      if (existing) {
        return res.json({ message: "Order already synced", orderId: existing.id });
      }

      // Calculate pay period sales for this stylist to determine tier (exclude voided orders)
      const payPeriod = getPayPeriod(new Date());
      const periodOrders = await storage.getOrdersForPeriod(payPeriod.start, payPeriod.end, stylist.id, false);
      const periodSales = periodOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0);
      
      // Get applicable commission rate based on tiers (or fall back to base rate)
      const commissionRate = await storage.getApplicableCommissionRate(stylist.id, periodSales);
      const commissionAmount = (totalAmount * commissionRate) / 100;

      // Create draft order in Shopify with product matching
      let shopifyDraftOrderId: string | undefined;
      let productTags: string[] = [];
      let variantId: string | undefined;
      
      if (settings.shopifyStoreUrl && settings.shopifyAccessToken) {
        const shopifyClient = new ShopifyClient(settings);
        
        // Find or create Shopify product for the service
        try {
          console.log(`[Vagaro Webhook] Ensuring Shopify product exists for: ${serviceTitle}`);
          const product = await shopifyClient.ensureServiceProduct(
            serviceTitle, 
            totalAmount.toString(),
            []
          );
          console.log(`[Vagaro Webhook] Using product: ${product.title} (${product.id})`);
          productTags = product.tags;
          if (product.variants.length > 0) {
            variantId = product.variants[0].id;
            console.log(`[Vagaro Webhook] Using variant: ${variantId}`);
          }
        } catch (productError: any) {
          console.log(`[Vagaro Webhook] Product ensure error: ${productError.message}`);
        }
        
        // Combine product tags with default tags
        const orderTags = [
          settings.defaultOrderTag,
          `stylist:${stylist.name}`,
          ...productTags,
        ];
        
        const draftOrder = await shopifyClient.createDraftOrder({
          customerName: customerName,
          customerEmail: customerEmail,
          customerPhone: customerPhone,
          lineItems: [{
            variantId: variantId,
            title: serviceTitle,
            price: totalAmount.toString(),
            quantity: 1,
          }],
          tags: orderTags,
          note: `Vagaro Appointment #${appointmentId}`,
          stylistName: stylist.name,
          stylistId: stylist.id,
        });
        
        shopifyDraftOrderId = draftOrder.id;
        console.log(`[Vagaro Webhook] Created Shopify draft order: ${draftOrder.name} (${shopifyDraftOrderId})`);
      }

      // Create or update order in database
      let order;
      if (isUpdate && existingOrder) {
        // Update existing order with new data
        order = await storage.updateOrder(existingOrder.id, {
          customerName: customerName,
          customerEmail: customerEmail,
          serviceName: serviceTitle,
          services: [serviceTitle],
          totalAmount: totalAmount.toFixed(2),
          commissionAmount: commissionAmount.toFixed(2),
          appointmentDate: appointmentDate,
        });
        console.log(`[Vagaro Webhook] Order updated: ${existingOrder.id}`);
        res.json({ message: "Order updated", order, businessId });
      } else {
        // Create new order
        order = await storage.createOrder({
          vagaroAppointmentId: appointmentId,
          shopifyDraftOrderId: shopifyDraftOrderId,
          shopifyProductVariantId: variantId || null,
          stylistId: stylist.id,
          stylistName: stylist.name,
          customerName: customerName,
          customerEmail: customerEmail,
          serviceName: serviceTitle,
          services: [serviceTitle],
          totalAmount: totalAmount.toFixed(2),
          tipAmount: "0",
          commissionAmount: commissionAmount.toFixed(2),
          status: "draft",
          appointmentDate: appointmentDate,
        });
        console.log(`[Vagaro Webhook] Order created: ${order.id}`);
        res.json({ message: "Order created", order, businessId });
      }
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Shopify webhook endpoint for order updates (handles orders/create when draft is paid)
  app.post("/api/webhooks/shopify", async (req, res) => {
    try {
      const shopifyOrder = req.body;
      console.log("[Shopify Webhook] Received:", JSON.stringify(shopifyOrder, null, 2));
      
      // Check if this order came from a draft order
      const sourceName = shopifyOrder.source_name;
      const isFromDraft = sourceName === "draft_order" || sourceName === "shopify_draft_order";
      
      // Find order by Shopify order ID first, then by draft order ID
      const allOrders = await storage.getOrders({});
      let order = allOrders.find(o => o.shopifyOrderId === shopifyOrder.id.toString());
      
      // If not found by order ID and this came from a draft, try to find by draft order ID
      if (!order && isFromDraft) {
        // The draft order ID might be in tags or we need to match by other criteria
        // Try matching by customer email and recent draft orders
        const customerEmail = shopifyOrder.email;
        const draftOrders = allOrders.filter(o => 
          o.status === "draft" && 
          o.shopifyDraftOrderId && 
          o.customerEmail === customerEmail
        );
        
        if (draftOrders.length === 1) {
          order = draftOrders[0];
          console.log(`[Shopify Webhook] Matched draft order by email: ${order.id}`);
        } else if (draftOrders.length > 1) {
          // Try to match by total amount as secondary criteria
          const orderTotal = parseFloat(shopifyOrder.total_price || "0");
          order = draftOrders.find(o => Math.abs(parseFloat(o.totalAmount) - orderTotal) < 0.01);
          if (order) {
            console.log(`[Shopify Webhook] Matched draft order by total: ${order.id}`);
          }
        }
      }
      
      if (!order) {
        console.log("[Shopify Webhook] No matching order found");
        return res.json({ message: "Order not found" });
      }

      // Extract actual values from the paid order
      const newTotalAmount = parseFloat(shopifyOrder.total_price || shopifyOrder.subtotal_price || "0");
      const tipAmount = parseFloat(shopifyOrder.current_total_tip_set?.shop_money?.amount || shopifyOrder.total_tip_received || "0");
      
      // Extract the POS staff member who processed the sale
      const posUserId = shopifyOrder.user_id;
      let processedByStylist = null;
      if (posUserId) {
        console.log(`[Shopify Webhook] Order processed by POS user ID: ${posUserId}`);
        // Try to find stylist by Shopify staff ID
        const allStylists = await storage.getStylists();
        processedByStylist = allStylists.find(s => s.shopifyStaffId === posUserId.toString());
        if (processedByStylist) {
          console.log(`[Shopify Webhook] Matched to stylist: ${processedByStylist.name}`);
        }
      }
      
      // Extract services from line items
      const lineItems = shopifyOrder.line_items || [];
      const services = lineItems.map((item: any) => item.title || item.name);
      
      // Recalculate commission based on new total
      const stylist = await storage.getStylist(order.stylistId);
      let commissionAmount = parseFloat(order.commissionAmount);
      
      if (stylist && newTotalAmount !== parseFloat(order.totalAmount)) {
        // Get applicable commission rate and recalculate
        const payPeriod = getPayPeriod(new Date());
        const periodOrders = await storage.getOrdersForPeriod(payPeriod.start, payPeriod.end, stylist.id, false);
        const periodSales = periodOrders
          .filter(o => o.id !== order!.id) // Exclude current order
          .reduce((sum, o) => sum + parseFloat(o.totalAmount), 0);
        
        const commissionRate = await storage.getApplicableCommissionRate(stylist.id, periodSales + newTotalAmount);
        commissionAmount = (newTotalAmount * commissionRate) / 100;
        console.log(`[Shopify Webhook] Recalculated commission: $${commissionAmount.toFixed(2)} at ${commissionRate}%`);
      }
      
      // Update order with actual payment info
      await storage.updateOrder(order.id, {
        status: "paid",
        totalAmount: newTotalAmount.toFixed(2),
        tipAmount: tipAmount.toFixed(2),
        commissionAmount: commissionAmount.toFixed(2),
        services: services.length > 0 ? services : order.services,
        paidAt: new Date(),
        shopifyOrderId: shopifyOrder.id.toString(),
      });

      console.log(`[Shopify Webhook] Order ${order.id} updated - Total: $${newTotalAmount.toFixed(2)}, Tip: $${tipAmount.toFixed(2)}, Commission: $${commissionAmount.toFixed(2)}`);
      res.json({ message: "Order updated", orderId: order.id });
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
  app.post("/api/stylists/:id/pin", requireAdmin, async (req, res) => {
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
  app.get("/api/admin/timeclock/entries", requireAdmin, async (req, res) => {
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
  app.post("/api/admin/timeclock/entries", requireAdmin, async (req, res) => {
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
  app.patch("/api/admin/timeclock/entries/:id", requireAdmin, async (req, res) => {
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
  app.delete("/api/admin/timeclock/entries/:id", requireAdmin, async (req, res) => {
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
  app.get("/api/admin/timeclock/report", requireAdmin, async (req, res) => {
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
  app.post("/api/admin/orders", requireAdmin, async (req, res) => {
    try {
      const { stylistId, customerName, services, totalAmount, tipAmount, notes } = req.body;
      if (!stylistId || !customerName || !totalAmount) {
        return res.status(400).json({ error: "stylistId, customerName, and totalAmount are required" });
      }
      
      const stylistOrders = await storage.getOrders({ stylistId });
      const totalSales = stylistOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0);
      const commissionRate = await storage.getApplicableCommissionRate(stylistId, totalSales);
      const commissionAmount = (parseFloat(totalAmount) * commissionRate) / 100;
      
      const stylistData = await storage.getStylist(stylistId);
      const order = await storage.createOrder({
        stylistId,
        stylistName: stylistData?.name || null,
        customerName,
        customerEmail: null,
        serviceName: services?.[0] || "Manual Sale",
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
  app.post("/api/admin/orders/:id/void", requireAdmin, async (req, res) => {
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
  app.post("/api/admin/orders/:id/restore", requireAdmin, async (req, res) => {
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
  app.get("/api/admin/orders", requireAdmin, async (req, res) => {
    try {
      const { startDate, endDate, stylistId, includeVoided, excludeDisabled } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }
      const orders = await storage.getOrdersForPeriod(
        startDate as string,
        endDate as string,
        stylistId as string | undefined,
        includeVoided === "true",
        excludeDisabled !== "false"
      );
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Appointments - get all appointments with status filtering (includes canceled/deleted)
  app.get("/api/admin/appointments", requireAdmin, async (req, res) => {
    try {
      const { startDate, endDate, stylistId, status } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }
      
      // Get all orders including canceled/deleted
      const allOrders = await storage.getAllAppointments(
        startDate as string,
        endDate as string,
        stylistId as string | undefined,
        status as string | undefined
      );
      res.json(allOrders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Appointments - cancel an appointment
  app.post("/api/admin/appointments/:id/cancel", requireAdmin, async (req, res) => {
    try {
      const { reason } = req.body;
      const order = await storage.updateOrder(req.params.id, { 
        status: "canceled",
        shopifyDraftOrderId: null,
      });
      if (!order) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      res.json(order);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Appointments - restore a canceled/deleted appointment
  app.post("/api/admin/appointments/:id/restore", requireAdmin, async (req, res) => {
    try {
      const order = await storage.updateOrder(req.params.id, { 
        status: "draft",
      });
      if (!order) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      res.json(order);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Appointments - update appointment date
  app.patch("/api/admin/appointments/:id", requireAdmin, async (req, res) => {
    try {
      const { appointmentDate } = req.body;
      if (!appointmentDate) {
        return res.status(400).json({ error: "appointmentDate is required" });
      }
      const order = await storage.updateOrder(req.params.id, { 
        appointmentDate: new Date(appointmentDate),
      });
      if (!order) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      res.json(order);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Commission Adjustments - list
  app.get("/api/admin/commission-adjustments", requireAdmin, async (req, res) => {
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
  app.post("/api/admin/commission-adjustments", requireAdmin, async (req, res) => {
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
  app.patch("/api/admin/commission-adjustments/:id", requireAdmin, async (req, res) => {
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
  app.delete("/api/admin/commission-adjustments/:id", requireAdmin, async (req, res) => {
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
  app.get("/api/admin/commission-report", requireAdmin, async (req, res) => {
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

  // Check if any admin users exist
  app.get("/api/admin/has-users", async (_req, res) => {
    try {
      const hasUsers = await storage.hasAnyUsers();
      res.json({ hasUsers });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin authentication
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const crypto = await import("crypto");
      const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
      if (passwordHash !== user.password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      req.session.adminId = user.id;
      req.session.adminUsername = user.username;
      res.json({ message: "Login successful", user: { id: user.id, username: user.username } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/admin/me", async (req, res) => {
    try {
      if (!req.session.adminId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.adminId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ id: user.id, username: user.username });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/shopify-auth", async (req, res) => {
    try {
      const { shop, host } = req.query;
      if (!shop && !host) {
        return res.status(400).json({ error: "Not a Shopify embedded request" });
      }

      const settings = await storage.getSettings();
      if (!settings || !settings.shopifyStoreUrl) {
        return res.status(403).json({ error: "Shopify store not configured in settings" });
      }

      const configuredShop = settings.shopifyStoreUrl
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .replace('.myshopify.com', '')
        .toLowerCase();

      let verified = false;

      if (shop) {
        const shopParam = (shop as string).replace('.myshopify.com', '').toLowerCase();
        if (shopParam === configuredShop) {
          verified = true;
        } else {
          console.log(`[Admin] Shopify auth rejected - shop mismatch: ${shopParam} vs ${configuredShop}`);
          return res.status(403).json({ error: "Shop does not match configured store" });
        }
      }

      if (!verified && host) {
        try {
          const decoded = Buffer.from(host as string, 'base64').toString('utf-8');
          if (decoded.includes(configuredShop) || decoded.includes('admin.shopify.com')) {
            verified = true;
          }
        } catch (e) {}
      }

      if (!verified) {
        console.log(`[Admin] Shopify auth rejected - could not verify shop=${shop} host=${host}`);
        return res.status(403).json({ error: "Could not verify Shopify origin" });
      }

      const users = await storage.getAllUsers();
      if (!users || users.length === 0) {
        return res.status(404).json({ error: "No admin users exist" });
      }

      const adminUser = users[0];
      req.session.adminId = adminUser.id;
      req.session.adminUsername = adminUser.username;
      console.log(`[Admin] Auto-authenticated via Shopify embed for shop: ${shop}`);
      res.json({ message: "Authenticated via Shopify", user: { id: adminUser.id, username: adminUser.username } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // POS Extension API Endpoints
  // ========================================
  
  // CORS middleware for POS endpoints
  const posCorsMW = (req: Request, res: Response, next: NextFunction) => {
    // Get allowed origins from settings or use default
    const allowedOrigins = [
      'https://pos.shopify.com',
      'https://admin.shopify.com',
      process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '',
    ].filter(Boolean);
    
    const origin = req.headers.origin;
    if (origin && allowedOrigins.some(allowed => origin.includes('shopify') || origin === allowed)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
  };
  
  // Handle CORS preflight for all POS endpoints
  app.options("/api/pos/*", posCorsMW, (_req, res) => {
    res.status(204).end();
  });
  
  // Basic token validation for POS endpoints
  const validatePosToken = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("[POS API] Missing or invalid authorization header");
      return res.status(401).json({ error: "Authorization required" });
    }
    
    const token = authHeader.substring(7);
    if (!token || token.length < 10) {
      console.log("[POS API] Invalid token format");
      return res.status(401).json({ error: "Invalid token" });
    }
    
    next();
  };
  
  // Get pending appointments for POS extension (no auth required for POS extensions)
  app.get("/api/pos/pending-appointments", posCorsMW, async (req, res) => {
    try {
      const shopifyStaffId = req.query.staffId as string | undefined;
      console.log(`[POS API] Fetching pending appointments for staff: ${shopifyStaffId || 'all'}`);
      
      // Filter by today's date by default, or use query param
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const filterDate = req.query.date 
        ? new Date(req.query.date as string) 
        : today;
      filterDate.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(filterDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Check if this staff member is a linked stylist
      const allStylists = await storage.getStylists();
      const linkedStylist = shopifyStaffId 
        ? allStylists.find(s => s.shopifyStaffId === shopifyStaffId)
        : null;
      
      const stylistMap = new Map(allStylists.map(s => [s.id, s.name]));
      
      // Get orders for today
      const allOrders = await storage.getOrders({ fromDate: filterDate });
      
      const pendingAppointments = allOrders
        .filter(order => {
          const orderDate = order.appointmentDate || order.createdAt;
          const isToday = orderDate && orderDate >= filterDate && orderDate <= endOfDay;
          const isDraft = order.status === 'draft';
          
          // If staff is a linked stylist, only show their appointments
          // If staff is not linked (manager/owner), show all appointments
          const matchesStylist = linkedStylist 
            ? order.stylistId === linkedStylist.id 
            : true;
          
          return isDraft && isToday && matchesStylist;
        })
        .map(order => ({
          id: order.id,
          customerName: order.customerName,
          serviceName: order.serviceName || order.services?.[0] || 'Service',
          stylistName: order.stylistName || stylistMap.get(order.stylistId) || 'Unknown',
          stylistId: order.stylistId,
          amount: order.totalAmount,
          date: order.appointmentDate || order.createdAt,
          shopifyDraftOrderId: order.shopifyDraftOrderId,
          shopifyProductVariantId: order.shopifyProductVariantId || null,
        }));
      
      console.log(`[POS API] Found ${pendingAppointments.length} pending appointments for ${filterDate.toDateString()} (stylist: ${linkedStylist?.name || 'all'})`);
      res.json({ 
        appointments: pendingAppointments,
        date: filterDate.toISOString().split('T')[0],
        viewMode: linkedStylist ? 'stylist' : 'manager',
        stylistName: linkedStylist?.name || null
      });
    } catch (error: any) {
      console.error("[POS API] Error fetching appointments:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Mark appointment as loaded to cart (for tracking)
  app.post("/api/pos/mark-loaded/:id", posCorsMW, async (req, res) => {
    try {
      const orderId = req.params.id;
      // Update order to mark it as loaded to POS cart
      const order = await storage.updateOrder(orderId, { 
        status: 'pending_checkout' 
      });
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      console.log(`[POS API] Marked order ${orderId} as loaded to cart`);
      res.json({ success: true, order });
    } catch (error: any) {
      console.error("[POS API] Error marking order:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get stylist summary by Shopify staff ID for POS extension
  app.get("/api/pos/stylist-summary", posCorsMW, async (req, res) => {
    try {
      const shopifyStaffId = req.query.staffId as string;
      console.log(`[POS API] Fetching stylist summary for staff ID: ${shopifyStaffId}`);
      
      if (!shopifyStaffId) {
        return res.status(400).json({ error: "staffId query parameter required" });
      }
      
      // Find stylist by Shopify staff ID
      const allStylists = await storage.getStylists();
      const stylist = allStylists.find(s => s.shopifyStaffId === shopifyStaffId);
      
      if (!stylist) {
        console.log(`[POS API] No stylist found for staff ID: ${shopifyStaffId}`);
        return res.json({ 
          found: false,
          message: "Stylist not linked to this POS account",
          availableStylists: allStylists
            .filter(s => s.enabled && !s.name.startsWith('Stylist Unknown'))
            .map(s => ({
              id: s.id,
              name: s.name,
              hasShopifyLink: false
            }))
        });
      }
      
      // Get today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      // Get current pay period
      const payPeriod = getPayPeriod(new Date());
      
      // Get today's orders for this stylist
      const todayOrders = await storage.getOrders({
        stylistId: stylist.id,
        fromDate: today
      });
      
      const paidToday = todayOrders.filter(o => o.status === 'paid' && !o.voidedAt);
      const pendingToday = todayOrders.filter(o => o.status === 'draft');
      
      // Calculate today's earnings
      const todaySales = paidToday.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0);
      const todayTips = paidToday.reduce((sum, o) => sum + parseFloat(o.tipAmount), 0);
      const todayCommission = paidToday.reduce((sum, o) => sum + parseFloat(o.commissionAmount), 0);
      
      // Get pay period stats
      const periodOrders = await storage.getOrdersForPeriod(payPeriod.start, payPeriod.end, stylist.id, false);
      const periodSales = periodOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0);
      const periodTips = periodOrders.reduce((sum, o) => sum + parseFloat(o.tipAmount), 0);
      const periodCommission = periodOrders.reduce((sum, o) => sum + parseFloat(o.commissionAmount), 0);
      
      // Get hours worked this period
      const periodHours = await storage.getPayPeriodHours(stylist.id, payPeriod.start, payPeriod.end);
      const hourlyEarnings = periodHours * parseFloat(stylist.hourlyRate || "0");
      
      // Get current commission rate
      const commissionRate = await storage.getApplicableCommissionRate(stylist.id, periodSales);
      
      // Get open time entry (is clocked in?)
      const openTimeEntry = await storage.getOpenTimeEntry(stylist.id);
      
      res.json({
        found: true,
        stylist: {
          id: stylist.id,
          name: stylist.name,
          role: stylist.role,
          commissionRate: commissionRate,
          hourlyRate: stylist.hourlyRate,
          isClockedIn: !!openTimeEntry,
          clockInTime: openTimeEntry?.clockIn || null
        },
        today: {
          sales: todaySales.toFixed(2),
          tips: todayTips.toFixed(2),
          commission: todayCommission.toFixed(2),
          totalEarnings: (todayCommission + todayTips).toFixed(2),
          paidOrders: paidToday.length,
          pendingOrders: pendingToday.length
        },
        payPeriod: {
          start: payPeriod.start,
          end: payPeriod.end,
          sales: periodSales.toFixed(2),
          tips: periodTips.toFixed(2),
          commission: periodCommission.toFixed(2),
          hourlyEarnings: hourlyEarnings.toFixed(2),
          hoursWorked: periodHours,
          totalEarnings: (periodCommission + periodTips + hourlyEarnings).toFixed(2),
          orderCount: periodOrders.length
        },
        pendingAppointments: pendingToday.map(o => ({
          id: o.id,
          customerName: o.customerName,
          serviceName: o.serviceName || o.services?.[0] || 'Service',
          amount: o.totalAmount,
          shopifyProductVariantId: o.shopifyProductVariantId
        }))
      });
    } catch (error: any) {
      console.error("[POS API] Error fetching stylist summary:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Link stylist to Shopify staff ID
  app.post("/api/pos/link-stylist", posCorsMW, async (req, res) => {
    try {
      const { stylistId, shopifyStaffId } = req.body;
      
      console.log(`[POS API] Link request: stylistId=${stylistId}, shopifyStaffId=${shopifyStaffId}`);
      
      if (!stylistId) {
        return res.status(400).json({ error: "stylistId is required" });
      }
      
      const linkId = shopifyStaffId || `device-${Date.now()}`;
      
      // Clear any existing link to this staff ID from other stylists
      const allStylists = await storage.getStylists();
      for (const s of allStylists) {
        if (s.shopifyStaffId === linkId && s.id !== stylistId) {
          await storage.updateStylist(s.id, { shopifyStaffId: null });
          console.log(`[POS API] Cleared old link from stylist ${s.name}`);
        }
      }
      
      const stylist = await storage.updateStylist(stylistId, { shopifyStaffId: linkId });
      if (!stylist) {
        return res.status(404).json({ error: "Stylist not found" });
      }
      
      console.log(`[POS API] Linked stylist ${stylist.name} to ID: ${linkId}`);
      res.json({ success: true, stylist: { id: stylist.id, name: stylist.name }, linkId });
    } catch (error: any) {
      console.error("[POS API] Error linking stylist:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POS Clock In
  app.post("/api/pos/clock-in", posCorsMW, async (req, res) => {
    try {
      const { staffId } = req.body;
      
      if (!staffId) {
        return res.status(400).json({ error: "staffId is required" });
      }
      
      const allStylists = await storage.getStylists();
      const stylist = allStylists.find(s => s.shopifyStaffId === staffId);
      
      if (!stylist) {
        return res.status(404).json({ error: "Stylist not found for this POS account" });
      }
      
      // Check if already clocked in
      const currentEntry = await storage.getOpenTimeEntry(stylist.id);
      if (currentEntry) {
        return res.status(400).json({ error: "Already clocked in", clockedInAt: currentEntry.clockIn });
      }
      
      const entry = await storage.clockIn(stylist.id);
      console.log(`[POS API] ${stylist.name} clocked in at ${entry.clockIn}`);
      res.json({ success: true, clockedIn: true, clockInTime: entry.clockIn });
    } catch (error: any) {
      console.error("[POS API] Clock in error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // POS Clock Out
  app.post("/api/pos/clock-out", posCorsMW, async (req, res) => {
    try {
      const { staffId } = req.body;
      
      if (!staffId) {
        return res.status(400).json({ error: "staffId is required" });
      }
      
      const allStylists = await storage.getStylists();
      const stylist = allStylists.find(s => s.shopifyStaffId === staffId);
      
      if (!stylist) {
        return res.status(404).json({ error: "Stylist not found for this POS account" });
      }
      
      const entry = await storage.clockOut(stylist.id);
      if (!entry) {
        return res.status(400).json({ error: "Not currently clocked in" });
      }
      
      const clockIn = new Date(entry.clockIn).getTime();
      const clockOut = new Date(entry.clockOut!).getTime();
      const hoursWorked = ((clockOut - clockIn) / (1000 * 60 * 60)).toFixed(2);
      
      console.log(`[POS API] ${stylist.name} clocked out - worked ${hoursWorked} hours`);
      res.json({ success: true, clockedIn: false, hoursWorked, entry });
    } catch (error: any) {
      console.error("[POS API] Clock out error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // POS Clock Status
  app.get("/api/pos/clock-status", posCorsMW, async (req, res) => {
    try {
      const staffId = req.query.staffId as string;
      
      if (!staffId) {
        return res.status(400).json({ error: "staffId query parameter required" });
      }
      
      const allStylists = await storage.getStylists();
      const stylist = allStylists.find(s => s.shopifyStaffId === staffId);
      
      if (!stylist) {
        return res.json({ found: false });
      }
      
      const currentEntry = await storage.getOpenTimeEntry(stylist.id);
      
      if (currentEntry) {
        const clockIn = new Date(currentEntry.clockIn);
        const now = new Date();
        const hoursWorked = ((now.getTime() - clockIn.getTime()) / (1000 * 60 * 60)).toFixed(2);
        
        res.json({ 
          found: true,
          clockedIn: true, 
          clockInTime: currentEntry.clockIn,
          hoursWorked
        });
      } else {
        res.json({ found: true, clockedIn: false });
      }
    } catch (error: any) {
      console.error("[POS API] Clock status error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin endpoint to clear all POS staff links
  app.post("/api/admin/clear-pos-links", requireAdmin, async (req, res) => {
    try {
      const allStylists = await storage.getStylists();
      let cleared = 0;
      for (const s of allStylists) {
        if (s.shopifyStaffId) {
          await storage.updateStylist(s.id, { shopifyStaffId: null });
          cleared++;
        }
      }
      console.log(`[Admin] Cleared ${cleared} POS staff links`);
      res.json({ success: true, cleared });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin registration (first user only)
  app.post("/api/admin/register", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      const hasUsers = await storage.hasAnyUsers();
      if (hasUsers) {
        return res.status(403).json({ error: "Admin already exists. Contact existing admin." });
      }
      const crypto = await import("crypto");
      const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
      const user = await storage.createUser({ username, password: passwordHash });
      req.session.adminId = user.id;
      req.session.adminUsername = user.username;
      res.json({ message: "Admin created successfully", user: { id: user.id, username: user.username } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}