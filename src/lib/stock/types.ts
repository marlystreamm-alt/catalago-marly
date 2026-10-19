export type StockStatus = "available" | "assigned" | "expiring" | "expired" | "client_replacement" | "provider_replacement";
export const STOCK_STATUS_LABELS: Record<StockStatus,string> = {
  available: "Disponible", assigned: "Asignada", expiring: "Por vencer", expired: "Caducada", client_replacement: "Reposición cliente", provider_replacement: "Reposición proveedor",
};
export type StockItem = {
  id: string;
  businessId: string | null;
  platform: string;
  accountType: string;
  stockKind: "complete" | "profile";
  parentStockId: string | null;
  username: string;
  password: string;
  profilePin: string;
  panelUrl: string;
  panelUsername: string;
  panelPassword: string;
  provider: string;
  catalogRef: string;
  clientName: string;
  clientWhatsapp: string;
  status: StockStatus;
  acquiredOn: string | null;
  deliveredOn: string | null;
  expiresOn: string | null;
  notes: string;
  cost: number;
  salePrice: number;
  relatedOrderId: string;
  renewalStatus: string;
  renewalNotifiedAt: string | null;
  protectedDeliveryId: string;
  createdAt: string;
  updatedAt: string;
};
