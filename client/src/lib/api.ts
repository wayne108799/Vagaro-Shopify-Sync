import type { Stylist, Order, Settings } from "@shared/schema";

export async function getStylists(): Promise<Stylist[]> {
  const res = await fetch("/api/stylists");
  if (!res.ok) throw new Error("Failed to fetch stylists");
  return res.json();
}

export async function updateStylist(id: string, data: Partial<Stylist>): Promise<Stylist> {
  const res = await fetch(`/api/stylists/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update stylist");
  return res.json();
}

export async function getOrders(filters?: {
  stylistId?: string;
  status?: string;
  fromDate?: string;
}): Promise<Order[]> {
  const params = new URLSearchParams();
  if (filters?.stylistId) params.set("stylistId", filters.stylistId);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.fromDate) params.set("fromDate", filters.fromDate);
  
  const res = await fetch(`/api/orders?${params}`);
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json();
}

export async function getStylistStats(stylistId: string) {
  const res = await fetch(`/api/stylists/${stylistId}/stats`);
  if (!res.ok) throw new Error("Failed to fetch stylist stats");
  return res.json();
}

export async function getSettings(): Promise<Settings> {
  const res = await fetch("/api/settings");
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
}

export async function updateSettings(data: Partial<Settings>): Promise<Settings> {
  const res = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update settings");
  return res.json();
}

export async function getWebhookUrls(): Promise<{ vagaroWebhookUrl: string; shopifyWebhookUrl: string }> {
  const res = await fetch("/api/webhook-url");
  if (!res.ok) throw new Error("Failed to fetch webhook URLs");
  return res.json();
}

export async function syncStylistsFromVagaro(): Promise<{ message: string; stylists: any[]; businessId?: string }> {
  const res = await fetch("/api/vagaro/sync-stylists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to sync stylists from Vagaro");
  }
  return res.json();
}

export async function setStylistPin(stylistId: string, pin: string): Promise<{ message: string }> {
  const res = await fetch(`/api/stylists/${stylistId}/pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to set PIN");
  }
  return res.json();
}

export async function deleteStylist(stylistId: string): Promise<{ message: string }> {
  const res = await fetch(`/api/stylists/${stylistId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to delete stylist");
  }
  return res.json();
}

export interface CommissionTier {
  id?: string;
  stylistId?: string;
  tierLevel: number;
  salesThreshold: string;
  commissionRate: number;
}

export async function getCommissionTiers(stylistId: string): Promise<CommissionTier[]> {
  const res = await fetch(`/api/stylists/${stylistId}/commission-tiers`);
  if (!res.ok) throw new Error("Failed to fetch commission tiers");
  return res.json();
}

export async function setCommissionTiers(stylistId: string, tiers: Omit<CommissionTier, "id" | "stylistId">[]): Promise<CommissionTier[]> {
  const res = await fetch(`/api/stylists/${stylistId}/commission-tiers`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tiers }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to set commission tiers");
  }
  return res.json();
}