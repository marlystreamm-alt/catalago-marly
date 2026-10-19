export type DeliveryStatus = "active" | "suspended" | "revoked";

export interface DeliveryAttachment {
  name: string;
  type: string;
  dataUrl: string;
}

export interface ProtectedDelivery {
  id: string;
  createdAt: string;
  updatedAt: string;
  platform: string;
  client: string;
  whatsapp: string;
  username: string;
  notes: string;
  images: string[];
  attachment: DeliveryAttachment | null;
  expiresAt: string;
  maxViews: number | null;
  viewCount: number;
  lastViewedAt: string | null;
  status: DeliveryStatus;
  imageCount: number;
  protectedWithPassword: boolean;
  history: DeliveryHistoryEntry[];
}

export interface ProtectedDeliveryPrivate extends ProtectedDelivery {
  /** Contraseña/código que se entrega al cliente para la plataforma. */
  password: string;
  /** Link que forma parte del contenido protegido. */
  link: string;
  /** Usuario del panel del proveedor. */
  panelUsername?: string;
  /** Contraseña del panel del proveedor. */
  panelPassword?: string;
  /** Máximo dos imágenes, guardadas dentro del payload cifrado. */
  images: string[];
  attachment: DeliveryAttachment | null;
  /** Contraseña para abrir esta entrega protegida. */
  accessPassword: string;
  /** Mensaje que se entrega en la plataforma junto con el link protegido. */
  platformMessage?: string;
  /** Mensaje que se manda por WhatsApp con la contraseña de protección. */
  passwordMessage?: string;
  token: string;
}

export type ProtectedDeliveryAdminView = Omit<ProtectedDeliveryPrivate, "token">;

export interface DeliveryHistoryEntry {
  at: string;
  kind: "created" | "opened" | "password_viewed" | "edited" | "whatsapp" | "suspended" | "reactivated" | "revoked";
  detail: string;
}

export interface DeliveryPublicView {
  id: string;
  platform: string;
  client: string;
  username: string;
  password: string;
  link: string;
  panelUsername: string;
  panelPassword: string;
  notes: string;
  images: string[];
  attachment: DeliveryAttachment | null;
  expiresAt: string;
  remainingViews: number | null;
  viewCount: number;
}
