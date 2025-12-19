import { db } from "../db";
import { 
  type User, 
  type InsertUser,
  type Stylist,
  type InsertStylist,
  type Order,
  type InsertOrder,
  type Settings,
  type InsertSettings,
  type CommissionTier,
  type InsertCommissionTier,
  type TimeEntry,
  type InsertTimeEntry,
  type CommissionAdjustment,
  type InsertCommissionAdjustment,
  users,
  stylists,
  orders,
  settings,
  commissionTiers,
  timeEntries,
  commissionAdjustments
} from "@shared/schema";
import { eq, desc, and, gte, lte, asc, isNull, sql } from "drizzle-orm";

function getPayPeriod(date: Date) {
  const day = date.getDate();
  const year = date.getFullYear();
  const month = date.getMonth();
  if (day <= 15) {
    return {
      start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      end: `${year}-${String(month + 1).padStart(2, '0')}-15`
    };
  } else {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return {
      start: `${year}-${String(month + 1).padStart(2, '0')}-16`,
      end: `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`
    };
  }
}

export { getPayPeriod };

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  hasAnyUsers(): Promise<boolean>;
  
  getStylists(): Promise<Stylist[]>;
  getStylist(id: string): Promise<Stylist | undefined>;
  getStylistByName(name: string): Promise<Stylist | undefined>;
  createStylist(stylist: InsertStylist): Promise<Stylist>;
  updateStylist(id: string, data: Partial<InsertStylist>): Promise<Stylist | undefined>;
  setStylistPin(id: string, pinHash: string): Promise<Stylist | undefined>;
  upsertStylistByVagaroId(vagaroId: string, data: InsertStylist): Promise<Stylist>;
  deleteStylistsNotInList(vagaroIds: string[]): Promise<void>;
  deleteStylist(id: string): Promise<boolean>;
  
  getOrders(filters?: { stylistId?: string; status?: string; fromDate?: Date }): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrderByVagaroId(vagaroId: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, data: Partial<InsertOrder>): Promise<Order | undefined>;
  
  getSettings(): Promise<Settings | undefined>;
  upsertSettings(settingsData: Partial<InsertSettings>): Promise<Settings>;
  
  getCommissionTiers(stylistId: string): Promise<CommissionTier[]>;
  setCommissionTiers(stylistId: string, tiers: Omit<InsertCommissionTier, "stylistId">[]): Promise<CommissionTier[]>;
  getApplicableCommissionRate(stylistId: string, totalSales: number): Promise<number>;
  
  getOpenTimeEntry(stylistId: string): Promise<TimeEntry | undefined>;
  clockIn(stylistId: string): Promise<TimeEntry>;
  clockOut(stylistId: string): Promise<TimeEntry | undefined>;
  getTimeEntries(stylistId: string, payPeriodStart: string, payPeriodEnd: string): Promise<TimeEntry[]>;
  getPayPeriodHours(stylistId: string, payPeriodStart: string, payPeriodEnd: string): Promise<number>;
  
  getAllTimeEntries(filters?: { stylistId?: string; startDate?: string; endDate?: string }): Promise<TimeEntry[]>;
  createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: string, data: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined>;
  deleteTimeEntry(id: string): Promise<boolean>;
  getTimeclockReport(startDate: string, endDate: string, stylistId?: string): Promise<{ stylistId: string; stylistName: string; totalHours: number; hourlyRate: string; totalEarnings: number }[]>;
  
  voidOrder(id: string, reason: string): Promise<Order | undefined>;
  restoreOrder(id: string): Promise<Order | undefined>;
  getOrdersForPeriod(startDate: string, endDate: string, stylistId?: string, includeVoided?: boolean, excludeDisabledStylists?: boolean): Promise<Order[]>;
  
  getCommissionAdjustments(filters?: { stylistId?: string; periodStart?: string; periodEnd?: string }): Promise<CommissionAdjustment[]>;
  createCommissionAdjustment(data: InsertCommissionAdjustment): Promise<CommissionAdjustment>;
  updateCommissionAdjustment(id: string, data: Partial<InsertCommissionAdjustment>): Promise<CommissionAdjustment | undefined>;
  deleteCommissionAdjustment(id: string): Promise<boolean>;
  
  getCommissionReport(startDate: string, endDate: string, stylistId?: string): Promise<{
    stylistId: string;
    stylistName: string;
    totalSales: number;
    voidedSales: number;
    netSales: number;
    commissionRate: number;
    baseCommission: number;
    adjustments: number;
    totalCommission: number;
    totalTips: number;
    orderCount: number;
  }[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(sql`lower(${users.username}) = lower(${username})`).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async hasAnyUsers(): Promise<boolean> {
    const result = await db.select({ id: users.id }).from(users).limit(1);
    return result.length > 0;
  }

  async getStylists(): Promise<Stylist[]> {
    return await db.select().from(stylists).orderBy(stylists.name);
  }

  async getStylist(id: string): Promise<Stylist | undefined> {
    const result = await db.select().from(stylists).where(eq(stylists.id, id)).limit(1);
    return result[0];
  }

  async getStylistByName(name: string): Promise<Stylist | undefined> {
    const result = await db.select().from(stylists).where(eq(stylists.name, name)).limit(1);
    return result[0];
  }

  async createStylist(stylist: InsertStylist): Promise<Stylist> {
    const result = await db.insert(stylists).values(stylist).returning();
    return result[0];
  }

  async updateStylist(id: string, data: Partial<InsertStylist>): Promise<Stylist | undefined> {
    const result = await db.update(stylists).set(data).where(eq(stylists.id, id)).returning();
    return result[0];
  }

  async setStylistPin(id: string, pinHash: string): Promise<Stylist | undefined> {
    const result = await db.update(stylists).set({ pinHash }).where(eq(stylists.id, id)).returning();
    return result[0];
  }

  async upsertStylistByVagaroId(vagaroId: string, data: InsertStylist): Promise<Stylist> {
    const existing = await db.select().from(stylists).where(eq(stylists.vagaroId, vagaroId)).limit(1);
    
    if (existing[0]) {
      const result = await db.update(stylists).set(data).where(eq(stylists.id, existing[0].id)).returning();
      return result[0];
    } else {
      const result = await db.insert(stylists).values(data).returning();
      return result[0];
    }
  }

  async deleteStylistsNotInList(vagaroIds: string[]): Promise<void> {
    if (vagaroIds.length === 0) return;
    const allStylists = await this.getStylists();
    for (const stylist of allStylists) {
      if (stylist.vagaroId && !vagaroIds.includes(stylist.vagaroId)) {
        await db.delete(stylists).where(eq(stylists.id, stylist.id));
      }
    }
  }

  async getOrders(filters?: { stylistId?: string; status?: string; fromDate?: Date }): Promise<Order[]> {
    let query = db.select().from(orders);
    
    const conditions = [];
    if (filters?.stylistId) {
      conditions.push(eq(orders.stylistId, filters.stylistId));
    }
    if (filters?.status) {
      conditions.push(eq(orders.status, filters.status));
    }
    if (filters?.fromDate) {
      conditions.push(gte(orders.createdAt, filters.fromDate));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(orders.createdAt));
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return result[0];
  }

  async getOrderByVagaroId(vagaroId: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.vagaroAppointmentId, vagaroId)).limit(1);
    return result[0];
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const orderData = {
      ...order,
      services: order.services as any,
    };
    const result = await db.insert(orders).values(orderData).returning();
    return result[0];
  }

  async updateOrder(id: string, data: Partial<InsertOrder>): Promise<Order | undefined> {
    const updateData: any = { ...data };
    if (data.services) {
      updateData.services = data.services;
    }
    const result = await db.update(orders).set(updateData).where(eq(orders.id, id)).returning();
    return result[0];
  }

  async getSettings(): Promise<Settings | undefined> {
    const result = await db.select().from(settings).limit(1);
    return result[0];
  }

  async upsertSettings(settingsData: Partial<InsertSettings>): Promise<Settings> {
    const existing = await this.getSettings();
    
    if (existing) {
      const result = await db.update(settings).set(settingsData).where(eq(settings.id, existing.id)).returning();
      return result[0];
    } else {
      const result = await db.insert(settings).values(settingsData as InsertSettings).returning();
      return result[0];
    }
  }

  async deleteStylist(id: string): Promise<boolean> {
    const result = await db.delete(stylists).where(eq(stylists.id, id)).returning();
    return result.length > 0;
  }

  async getCommissionTiers(stylistId: string): Promise<CommissionTier[]> {
    return await db.select().from(commissionTiers)
      .where(eq(commissionTiers.stylistId, stylistId))
      .orderBy(asc(commissionTiers.tierLevel));
  }

  async setCommissionTiers(stylistId: string, tiers: Omit<InsertCommissionTier, "stylistId">[]): Promise<CommissionTier[]> {
    await db.delete(commissionTiers).where(eq(commissionTiers.stylistId, stylistId));
    
    if (tiers.length === 0) {
      return [];
    }
    
    const tiersWithStylistId = tiers.map(tier => ({
      ...tier,
      stylistId,
    }));
    
    const result = await db.insert(commissionTiers).values(tiersWithStylistId).returning();
    return result;
  }

  async getApplicableCommissionRate(stylistId: string, totalSales: number): Promise<number> {
    const tiers = await this.getCommissionTiers(stylistId);
    
    if (tiers.length === 0) {
      const stylist = await this.getStylist(stylistId);
      return parseFloat(stylist?.commissionRate ?? "40");
    }
    
    let applicableRate = parseFloat(tiers[0]?.commissionRate ?? "40");
    for (const tier of tiers) {
      if (totalSales >= parseFloat(tier.salesThreshold)) {
        applicableRate = parseFloat(tier.commissionRate);
      }
    }
    
    return applicableRate;
  }

  async getOpenTimeEntry(stylistId: string): Promise<TimeEntry | undefined> {
    const result = await db.select().from(timeEntries)
      .where(and(eq(timeEntries.stylistId, stylistId), isNull(timeEntries.clockOut)))
      .limit(1);
    return result[0];
  }

  async clockIn(stylistId: string): Promise<TimeEntry> {
    const payPeriod = getPayPeriod(new Date());
    const result = await db.insert(timeEntries).values({
      stylistId,
      payPeriodStart: payPeriod.start,
      payPeriodEnd: payPeriod.end,
    }).returning();
    return result[0];
  }

  async clockOut(stylistId: string): Promise<TimeEntry | undefined> {
    const openEntry = await this.getOpenTimeEntry(stylistId);
    if (!openEntry) return undefined;
    
    const result = await db.update(timeEntries)
      .set({ clockOut: new Date() })
      .where(eq(timeEntries.id, openEntry.id))
      .returning();
    return result[0];
  }

  async getTimeEntries(stylistId: string, payPeriodStart: string, payPeriodEnd: string): Promise<TimeEntry[]> {
    return await db.select().from(timeEntries)
      .where(and(
        eq(timeEntries.stylistId, stylistId),
        eq(timeEntries.payPeriodStart, payPeriodStart),
        eq(timeEntries.payPeriodEnd, payPeriodEnd)
      ))
      .orderBy(desc(timeEntries.clockIn));
  }

  async getPayPeriodHours(stylistId: string, payPeriodStart: string, payPeriodEnd: string): Promise<number> {
    const allEntries = await db.select().from(timeEntries)
      .where(eq(timeEntries.stylistId, stylistId))
      .orderBy(desc(timeEntries.clockIn));
    
    let totalMs = 0;
    const periodStart = new Date(payPeriodStart + "T00:00:00").getTime();
    const periodEnd = new Date(payPeriodEnd + "T23:59:59.999").getTime();
    
    for (const entry of allEntries) {
      const clockIn = new Date(entry.clockIn).getTime();
      const clockOut = entry.clockOut ? new Date(entry.clockOut).getTime() : Date.now();
      
      if (clockOut < periodStart || clockIn > periodEnd) {
        continue;
      }
      
      const effectiveStart = Math.max(clockIn, periodStart);
      const effectiveEnd = Math.min(clockOut, periodEnd);
      
      if (effectiveEnd > effectiveStart) {
        totalMs += effectiveEnd - effectiveStart;
      }
    }
    
    return Math.round((totalMs / (1000 * 60 * 60)) * 100) / 100;
  }

  async getAllTimeEntries(filters?: { stylistId?: string; startDate?: string; endDate?: string }): Promise<TimeEntry[]> {
    const conditions = [];
    
    if (filters?.stylistId) {
      conditions.push(eq(timeEntries.stylistId, filters.stylistId));
    }
    if (filters?.startDate) {
      conditions.push(gte(timeEntries.clockIn, new Date(filters.startDate + "T00:00:00")));
    }
    if (filters?.endDate) {
      conditions.push(lte(timeEntries.clockIn, new Date(filters.endDate + "T23:59:59.999")));
    }
    
    let query = db.select().from(timeEntries);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(timeEntries.clockIn));
  }

  async createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry> {
    const result = await db.insert(timeEntries).values(data).returning();
    return result[0];
  }

  async updateTimeEntry(id: string, data: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    const result = await db.update(timeEntries).set(data).where(eq(timeEntries.id, id)).returning();
    return result[0];
  }

  async deleteTimeEntry(id: string): Promise<boolean> {
    const result = await db.delete(timeEntries).where(eq(timeEntries.id, id)).returning();
    return result.length > 0;
  }

  async getTimeclockReport(startDate: string, endDate: string, stylistId?: string): Promise<{ stylistId: string; stylistName: string; totalHours: number; hourlyRate: string; totalEarnings: number }[]> {
    const allStylists = await this.getStylists();
    const filteredStylists = stylistId 
      ? allStylists.filter(s => s.id === stylistId) 
      : allStylists.filter(s => s.enabled);
    
    const results = [];
    
    for (const stylist of filteredStylists) {
      const hours = await this.getPayPeriodHours(stylist.id, startDate, endDate);
      const hourlyRate = stylist.hourlyRate || "0";
      const totalEarnings = hours * parseFloat(hourlyRate);
      
      results.push({
        stylistId: stylist.id,
        stylistName: stylist.name,
        totalHours: hours,
        hourlyRate,
        totalEarnings: Math.round(totalEarnings * 100) / 100,
      });
    }
    
    return results;
  }

  async voidOrder(id: string, reason: string): Promise<Order | undefined> {
    const result = await db.update(orders)
      .set({ voidedAt: new Date(), voidReason: reason })
      .where(eq(orders.id, id))
      .returning();
    return result[0];
  }

  async restoreOrder(id: string): Promise<Order | undefined> {
    const result = await db.update(orders)
      .set({ voidedAt: null, voidReason: null })
      .where(eq(orders.id, id))
      .returning();
    return result[0];
  }

  async getOrdersForPeriod(startDate: string, endDate: string, stylistId?: string, includeVoided: boolean = false, excludeDisabledStylists: boolean = false): Promise<Order[]> {
    const conditions = [
      gte(orders.createdAt, new Date(startDate + "T00:00:00")),
      lte(orders.createdAt, new Date(endDate + "T23:59:59.999")),
    ];
    
    if (stylistId) {
      conditions.push(eq(orders.stylistId, stylistId));
    }
    
    if (!includeVoided) {
      conditions.push(isNull(orders.voidedAt));
    }
    
    let result = await db.select().from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt));
    
    if (excludeDisabledStylists && !stylistId) {
      const enabledStylists = await this.getStylists();
      const enabledIds = new Set(enabledStylists.filter(s => s.enabled).map(s => s.id));
      result = result.filter(o => enabledIds.has(o.stylistId));
    }
    
    return result;
  }

  async getCommissionAdjustments(filters?: { stylistId?: string; periodStart?: string; periodEnd?: string }): Promise<CommissionAdjustment[]> {
    const conditions = [];
    
    if (filters?.stylistId) {
      conditions.push(eq(commissionAdjustments.stylistId, filters.stylistId));
    }
    if (filters?.periodStart) {
      conditions.push(eq(commissionAdjustments.periodStart, filters.periodStart));
    }
    if (filters?.periodEnd) {
      conditions.push(eq(commissionAdjustments.periodEnd, filters.periodEnd));
    }
    
    let query = db.select().from(commissionAdjustments);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(commissionAdjustments.createdAt));
  }

  async createCommissionAdjustment(data: InsertCommissionAdjustment): Promise<CommissionAdjustment> {
    const result = await db.insert(commissionAdjustments).values(data).returning();
    return result[0];
  }

  async updateCommissionAdjustment(id: string, data: Partial<InsertCommissionAdjustment>): Promise<CommissionAdjustment | undefined> {
    const result = await db.update(commissionAdjustments).set(data).where(eq(commissionAdjustments.id, id)).returning();
    return result[0];
  }

  async deleteCommissionAdjustment(id: string): Promise<boolean> {
    const result = await db.delete(commissionAdjustments).where(eq(commissionAdjustments.id, id)).returning();
    return result.length > 0;
  }

  async getCommissionReport(startDate: string, endDate: string, stylistId?: string): Promise<{
    stylistId: string;
    stylistName: string;
    totalSales: number;
    voidedSales: number;
    netSales: number;
    commissionRate: number;
    baseCommission: number;
    adjustments: number;
    totalCommission: number;
    totalTips: number;
    orderCount: number;
  }[]> {
    const allStylists = await this.getStylists();
    const filteredStylists = stylistId 
      ? allStylists.filter(s => s.id === stylistId) 
      : allStylists.filter(s => s.enabled);
    
    const results = [];
    
    for (const stylist of filteredStylists) {
      const periodOrders = await this.getOrdersForPeriod(startDate, endDate, stylist.id, true);
      const adjustmentsList = await this.getCommissionAdjustments({ 
        stylistId: stylist.id, 
        periodStart: startDate, 
        periodEnd: endDate 
      });
      
      const activeOrders = periodOrders.filter(o => !o.voidedAt);
      const voidedOrders = periodOrders.filter(o => o.voidedAt);
      
      const totalSales = periodOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0);
      const voidedSales = voidedOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0);
      const netSales = activeOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0);
      const totalTips = activeOrders.reduce((sum, o) => sum + parseFloat(o.tipAmount), 0);
      
      const commissionRate = await this.getApplicableCommissionRate(stylist.id, netSales);
      const baseCommission = activeOrders.reduce((sum, o) => sum + parseFloat(o.commissionAmount), 0);
      const adjustmentsTotal = adjustmentsList.reduce((sum, a) => sum + parseFloat(a.amount), 0);
      
      results.push({
        stylistId: stylist.id,
        stylistName: stylist.name,
        totalSales: Math.round(totalSales * 100) / 100,
        voidedSales: Math.round(voidedSales * 100) / 100,
        netSales: Math.round(netSales * 100) / 100,
        commissionRate,
        baseCommission: Math.round(baseCommission * 100) / 100,
        adjustments: Math.round(adjustmentsTotal * 100) / 100,
        totalCommission: Math.round((baseCommission + adjustmentsTotal) * 100) / 100,
        totalTips: Math.round(totalTips * 100) / 100,
        orderCount: activeOrders.length,
      });
    }
    
    return results;
  }
}

export const storage = new DatabaseStorage();