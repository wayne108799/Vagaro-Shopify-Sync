import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const stylists = pgTable("stylists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  role: text("role").notNull(),
  commissionRate: integer("commission_rate").notNull(),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).default("0"),
  vagaroId: text("vagaro_id"),
  shopifyStaffId: text("shopify_staff_id"),
  pinHash: text("pin_hash"),
  enabled: boolean("enabled").notNull().default(true),
});

export const insertStylistSchema = createInsertSchema(stylists).omit({ id: true });
export type InsertStylist = z.infer<typeof insertStylistSchema>;
export type Stylist = typeof stylists.$inferSelect;

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shopifyOrderId: text("shopify_order_id"),
  shopifyDraftOrderId: text("shopify_draft_order_id"),
  vagaroAppointmentId: text("vagaro_appointment_id"),
  stylistId: varchar("stylist_id").notNull().references(() => stylists.id),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  services: jsonb("services").notNull().$type<string[]>(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  tipAmount: decimal("tip_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
});

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vagaroClientId: text("vagaro_client_id"),
  vagaroClientSecret: text("vagaro_client_secret"),
  vagaroMerchantId: text("vagaro_merchant_id"),
  vagaroBusinessId: text("vagaro_business_id"),
  vagaroRegion: text("vagaro_region").default("us"),
  shopifyStoreUrl: text("shopify_store_url"),
  shopifyAccessToken: text("shopify_access_token"),
  defaultOrderTag: text("default_order_tag").notNull().default("vagaro-sync"),
  taxSetting: text("tax_setting").notNull().default("auto"),
  emailCustomer: boolean("email_customer").notNull().default(true),
  syncOnBooked: boolean("sync_on_booked").notNull().default(true),
  syncOnUpdated: boolean("sync_on_updated").notNull().default(false),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

export const commissionTiers = pgTable("commission_tiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stylistId: varchar("stylist_id").notNull().references(() => stylists.id, { onDelete: "cascade" }),
  tierLevel: integer("tier_level").notNull(),
  salesThreshold: decimal("sales_threshold", { precision: 10, scale: 2 }).notNull(),
  commissionRate: integer("commission_rate").notNull(),
});

export const insertCommissionTierSchema = createInsertSchema(commissionTiers).omit({ id: true });
export type InsertCommissionTier = z.infer<typeof insertCommissionTierSchema>;
export type CommissionTier = typeof commissionTiers.$inferSelect;

export const timeEntries = pgTable("time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stylistId: varchar("stylist_id").notNull().references(() => stylists.id, { onDelete: "cascade" }),
  clockIn: timestamp("clock_in").notNull().defaultNow(),
  clockOut: timestamp("clock_out"),
  payPeriodStart: text("pay_period_start").notNull(),
  payPeriodEnd: text("pay_period_end").notNull(),
});

export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({ id: true });
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;