export type CyberDocsOrderStatus =
  "new" | "in_process" | "completed" | "rejected" | "cancelled" | "error";

export type CyberDocsSource =
  "telegram_business" | "telegram_message" | "webhook_fallback" | "manual_fallback";

export interface TelegramOrderBot {
  username: string;
  label: string;
}

export interface CyberDocsOrder {
  id: string;
  cyberdocsOrderId: string;
  source: CyberDocsSource;
  sourceEventKey: string;
  sourceMessageId: string;
  sourceChatId: string;
  businessConnectionId: string;
  senderUsername: string;
  sourceKey: string;
  sourceLabel: string;
  rawMessage: string;
  parsedPayload: Record<string, string>;
  clientName: string;
  serviceName: string;
  contactLabel: string;
  contactValue: string;
  whatsapp: string;
  status: CyberDocsOrderStatus;
  assignFromStock: boolean | null;
  stockItemId: string | null;
  protectedDeliveryId: string | null;
  protectedEnabled: boolean;
  notificationOrderId: string | null;
  assignedAt: string | null;
  assignedBy: string;
  finalizedAt: string | null;
  finalizedBy: string;
  finalNotes: string;
  deliveredOn: string | null;
  expiresOn: string | null;
  renewalWarningDays: number;
  renewalAlertedFor: string | null;
  renewalNotificationOrderId: string | null;
  renewalStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface CyberDocsOrderEvent {
  id: string;
  orderId: string;
  action: string;
  actor: string;
  detail: string;
  createdAt: string;
}

export interface CyberDocsStockOption {
  id: string;
  platform: string;
  accountType: string;
  username: string;
  provider: string;
  catalogRef: string;
  expiresOn: string | null;
  notes: string;
}

export interface CyberDocsIntegrationStatus {
  connectionRequired: true;
  receivingRequired: true;
  telegramTokenConfigured: boolean;
  webhookSecretConfigured: boolean;
  fallbackSecretConfigured: boolean;
  publicUrlConfigured: boolean;
  webhookRegistered: boolean;
  webhookUrl: string;
  pendingUpdateCount: number;
  webhookError: string;
  lastEventAt: string | null;
  lastOrderAt: string | null;
  lastFallbackAt: string | null;
  lastError: string;
  expectedCyberDocsUsername: string;
  allowedBots: TelegramOrderBot[];
}

export interface ParsedCyberDocsOrder {
  isOrder: boolean;
  orderId: string;
  clientName: string;
  serviceName: string;
  contactLabel: string;
  contactValue: string;
  fields: Record<string, string>;
}

export const CYBERDOCS_STATUS_TEXT: Record<CyberDocsOrderStatus, string> = {
  new: "Nuevo",
  in_process: "En proceso",
  completed: "Entregada",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  error: "Con error",
};
