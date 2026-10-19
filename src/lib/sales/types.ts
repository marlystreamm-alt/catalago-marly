export interface SalesPlan { id: string; name: string; monthly: number; description: string; }
export interface SalesConfig {
  enabled: boolean;
  demoMinutes: 20 | 30 | 60;
  paymentInstructions: string;
  plans: SalesPlan[];
  updatedAt: string;
}
export type SaleStatus = "pending" | "paid" | "active" | "suspended" | "cancelled";
export interface SaleRequest {
  id: string; createdAt: string; reference: string; customerName: string; whatsapp: string;
  businessName: string; planId: string; planName: string; amount: number; status: SaleStatus;
  receiptDataUrl: string; notes: string;
}
export interface DemoAccess { id: string; token: string; createdAt: string; expiresAt: string; minutes: number; label: string; }
