import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ShopifyClient } from "./shopify";
import { insertStylistSchema, insertOrderSchema, insertSettingsSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
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

  // Vagaro webhook endpoint
  app.post("/api/webhooks/vagaro", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      if (!settings?.syncOnBooked) {
        return res.json({ message: "Sync disabled" });
      }

      const appointment = req.body;
      
      // Find stylist by Vagaro ID
      const allStylists = await storage.getStylists();
      const stylist = allStylists.find(s => s.vagaroId === appointment.employeeId && s.enabled);
      
      if (!stylist) {
        return res.json({ message: "Stylist not enabled for sync" });
      }

      // Check if order already exists
      const existing = await storage.getOrderByVagaroId(appointment.id);
      if (existing) {
        return res.json({ message: "Order already synced", orderId: existing.id });
      }

      // Calculate commission
      const totalAmount = parseFloat(appointment.totalAmount || "0");
      const commissionAmount = (totalAmount * stylist.commissionRate) / 100;

      // Create draft order in Shopify
      let shopifyDraftOrderId: string | undefined;
      
      if (settings.shopifyStoreUrl && settings.shopifyAccessToken) {
        const shopifyClient = new ShopifyClient(settings);
        const draftOrder = await shopifyClient.createDraftOrder({
          customerName: appointment.customerName,
          customerEmail: appointment.customerEmail,
          lineItems: appointment.services?.map((service: any) => ({
            title: service.name,
            price: service.price,
            quantity: 1,
          })) || [],
          tags: [settings.defaultOrderTag, `stylist:${stylist.name}`],
          note: `Vagaro Appointment #${appointment.id}`,
        });
        
        shopifyDraftOrderId = draftOrder.id;
      }

      // Create order in database
      const order = await storage.createOrder({
        vagaroAppointmentId: appointment.id,
        shopifyDraftOrderId,
        stylistId: stylist.id,
        customerName: appointment.customerName,
        customerEmail: appointment.customerEmail,
        services: appointment.services?.map((s: any) => s.name) || [],
        totalAmount: totalAmount.toFixed(2),
        tipAmount: "0",
        commissionAmount: commissionAmount.toFixed(2),
        status: "draft",
      });

      res.json({ message: "Order created", order });
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