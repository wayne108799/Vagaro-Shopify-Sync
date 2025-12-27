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
  commissionRate: string;
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

export interface TimeclockStatus {
  isClockedIn: boolean;
  clockedInAt: string | null;
  payPeriod: { start: string; end: string };
  hoursThisPeriod: number;
}

export async function getTimeclockStatus(): Promise<TimeclockStatus> {
  const res = await fetch("/api/stylist/timeclock/status");
  if (!res.ok) throw new Error("Failed to fetch timeclock status");
  return res.json();
}

export async function clockIn(): Promise<any> {
  const res = await fetch("/api/stylist/timeclock/clock-in", { method: "POST" });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to clock in");
  }
  return res.json();
}

export async function clockOut(): Promise<any> {
  const res = await fetch("/api/stylist/timeclock/clock-out", { method: "POST" });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to clock out");
  }
  return res.json();
}

export interface TimeEntry {
  id: string;
  stylistId: string;
  clockIn: string;
  clockOut: string | null;
  payPeriodStart: string;
  payPeriodEnd: string;
}

export async function getAdminTimeEntries(filters?: {
  stylistId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<TimeEntry[]> {
  const params = new URLSearchParams();
  if (filters?.stylistId) params.set("stylistId", filters.stylistId);
  if (filters?.startDate) params.set("startDate", filters.startDate);
  if (filters?.endDate) params.set("endDate", filters.endDate);
  
  const res = await fetch(`/api/admin/timeclock/entries?${params}`);
  if (!res.ok) throw new Error("Failed to fetch time entries");
  return res.json();
}

export async function createAdminTimeEntry(data: {
  stylistId: string;
  clockIn: string;
  clockOut?: string;
}): Promise<TimeEntry> {
  const res = await fetch("/api/admin/timeclock/entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to create time entry");
  }
  return res.json();
}

export async function updateAdminTimeEntry(id: string, data: {
  clockIn?: string;
  clockOut?: string | null;
}): Promise<TimeEntry> {
  const res = await fetch(`/api/admin/timeclock/entries/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to update time entry");
  }
  return res.json();
}

export async function deleteAdminTimeEntry(id: string): Promise<{ message: string }> {
  const res = await fetch(`/api/admin/timeclock/entries/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to delete time entry");
  }
  return res.json();
}

export interface TimeclockReportEntry {
  stylistId: string;
  stylistName: string;
  totalHours: number;
  hourlyRate: string;
  totalEarnings: number;
}

export async function getTimeclockReport(
  startDate: string,
  endDate: string,
  stylistId?: string
): Promise<TimeclockReportEntry[]> {
  const params = new URLSearchParams();
  params.set("startDate", startDate);
  params.set("endDate", endDate);
  if (stylistId) params.set("stylistId", stylistId);
  
  const res = await fetch(`/api/admin/timeclock/report?${params}`);
  if (!res.ok) throw new Error("Failed to fetch timeclock report");
  return res.json();
}

export interface CommissionReportEntry {
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
}

export async function getCommissionReport(
  startDate: string,
  endDate: string,
  stylistId?: string
): Promise<CommissionReportEntry[]> {
  const params = new URLSearchParams();
  params.set("startDate", startDate);
  params.set("endDate", endDate);
  if (stylistId) params.set("stylistId", stylistId);
  
  const res = await fetch(`/api/admin/commission-report?${params}`);
  if (!res.ok) throw new Error("Failed to fetch commission report");
  return res.json();
}

export async function getAdminOrders(filters: {
  startDate: string;
  endDate: string;
  stylistId?: string;
  includeVoided?: boolean;
}): Promise<Order[]> {
  const params = new URLSearchParams();
  params.set("startDate", filters.startDate);
  params.set("endDate", filters.endDate);
  if (filters.stylistId) params.set("stylistId", filters.stylistId);
  if (filters.includeVoided) params.set("includeVoided", "true");
  
  const res = await fetch(`/api/admin/orders?${params}`);
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json();
}

export async function createManualOrder(data: {
  stylistId: string;
  customerName: string;
  services?: string[];
  totalAmount: string;
  tipAmount?: string;
  notes?: string;
}): Promise<Order> {
  const res = await fetch("/api/admin/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to create order");
  }
  return res.json();
}

export async function voidOrder(id: string, reason: string): Promise<Order> {
  const res = await fetch(`/api/admin/orders/${id}/void`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to void order");
  }
  return res.json();
}

export async function restoreOrder(id: string): Promise<Order> {
  const res = await fetch(`/api/admin/orders/${id}/restore`, {
    method: "POST",
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to restore order");
  }
  return res.json();
}

export interface CommissionAdjustment {
  id: string;
  stylistId: string;
  periodStart: string;
  periodEnd: string;
  amount: string;
  reason: string;
  orderId: string | null;
  createdAt: string;
}

export async function getCommissionAdjustments(filters?: {
  stylistId?: string;
  periodStart?: string;
  periodEnd?: string;
}): Promise<CommissionAdjustment[]> {
  const params = new URLSearchParams();
  if (filters?.stylistId) params.set("stylistId", filters.stylistId);
  if (filters?.periodStart) params.set("periodStart", filters.periodStart);
  if (filters?.periodEnd) params.set("periodEnd", filters.periodEnd);
  
  const res = await fetch(`/api/admin/commission-adjustments?${params}`);
  if (!res.ok) throw new Error("Failed to fetch adjustments");
  return res.json();
}

export async function createCommissionAdjustment(data: {
  stylistId: string;
  periodStart: string;
  periodEnd: string;
  amount: string;
  reason: string;
  orderId?: string;
}): Promise<CommissionAdjustment> {
  const res = await fetch("/api/admin/commission-adjustments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to create adjustment");
  }
  return res.json();
}

export async function deleteCommissionAdjustment(id: string): Promise<{ message: string }> {
  const res = await fetch(`/api/admin/commission-adjustments/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to delete adjustment");
  }
  return res.json();
}

export async function getAppointments(filters: {
  startDate: string;
  endDate: string;
  stylistId?: string;
  status?: string;
}): Promise<Order[]> {
  const params = new URLSearchParams();
  params.set("startDate", filters.startDate);
  params.set("endDate", filters.endDate);
  if (filters.stylistId) params.set("stylistId", filters.stylistId);
  if (filters.status) params.set("status", filters.status);
  
  const res = await fetch(`/api/admin/appointments?${params}`);
  if (!res.ok) throw new Error("Failed to fetch appointments");
  return res.json();
}

export async function cancelAppointment(id: string, reason?: string): Promise<Order> {
  const res = await fetch(`/api/admin/appointments/${id}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to cancel appointment");
  }
  return res.json();
}

export async function restoreAppointment(id: string): Promise<Order> {
  const res = await fetch(`/api/admin/appointments/${id}/restore`, {
    method: "POST",
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to restore appointment");
  }
  return res.json();
}

export async function updateAppointmentDate(id: string, appointmentDate: string): Promise<Order> {
  const res = await fetch(`/api/admin/appointments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appointmentDate }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to update appointment date");
  }
  return res.json();
}