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
  users,
  stylists,
  orders,
  settings,
  commissionTiers,
  timeEntries
} from "@shared/schema";
import { eq, desc, and, gte, asc, isNull } from "drizzle-orm";

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
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
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
      return stylist?.commissionRate ?? 40;
    }
    
    let applicableRate = tiers[0]?.commissionRate ?? 40;
    for (const tier of tiers) {
      if (totalSales >= parseFloat(tier.salesThreshold)) {
        applicableRate = tier.commissionRate;
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
}

export const storage = new DatabaseStorage();