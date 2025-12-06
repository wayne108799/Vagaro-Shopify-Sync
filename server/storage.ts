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
  users,
  stylists,
  orders,
  settings
} from "@shared/schema";
import { eq, desc, and, gte } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getStylists(): Promise<Stylist[]>;
  getStylist(id: string): Promise<Stylist | undefined>;
  createStylist(stylist: InsertStylist): Promise<Stylist>;
  updateStylist(id: string, data: Partial<InsertStylist>): Promise<Stylist | undefined>;
  
  getOrders(filters?: { stylistId?: string; status?: string; fromDate?: Date }): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrderByVagaroId(vagaroId: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, data: Partial<InsertOrder>): Promise<Order | undefined>;
  
  getSettings(): Promise<Settings | undefined>;
  upsertSettings(settingsData: Partial<InsertSettings>): Promise<Settings>;
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

  async createStylist(stylist: InsertStylist): Promise<Stylist> {
    const result = await db.insert(stylists).values(stylist).returning();
    return result[0];
  }

  async updateStylist(id: string, data: Partial<InsertStylist>): Promise<Stylist | undefined> {
    const result = await db.update(stylists).set(data).where(eq(stylists.id, id)).returning();
    return result[0];
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
    const updateData = data.services ? { ...data, services: data.services as any } : data;
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
}

export const storage = new DatabaseStorage();