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