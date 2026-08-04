/** Tipos compartidos (cliente y servidor) del sistema de avisos de pedidos. */

export type AlexaProvider = "notifyme" | "voicemonkey";

/** Configuración de avisos del administrador. */
export interface NotifySettings {
  enabled: boolean;
  channelPush: boolean;
  channelEmail: boolean;
  channelWhatsapp: boolean;
  channelAlexa: boolean;
  email: string;
  whatsappNumber: string;
  alexaProvider: AlexaProvider;
  alexaToken: string;
  alexaDevice: string;
  repeatEnabled: boolean;
  repeatMinutes: number;
  quietStart: string;
  quietEnd: string;
  autoOffMidnight: boolean;
  timezone: string;
  /** true cuando ya existe un código de acceso configurado. */
  hasCode: boolean;
}

export const DEFAULT_SETTINGS: NotifySettings = {
  enabled: true,
  channelPush: true,
  channelEmail: false,
  channelWhatsapp: false,
  channelAlexa: false,
  email: "",
  whatsappNumber: "",
  alexaProvider: "notifyme",
  alexaToken: "",
  alexaDevice: "",
  repeatEnabled: true,
  repeatMinutes: 15,
  quietStart: "08:00",
  quietEnd: "00:00",
  autoOffMidnight: true,
  timezone: "America/Monterrey",
  hasCode: false,
};

/** Pedido registrado en la nube. */
export interface CloudOrder {
  id: string;
  createdAt: string;
  catalogId: string;
  catalogName: string;
  serviceName: string;
  total: number;
  items: { name: string; price: number }[];
  message: string;
  link: string;
  recipient: string;
  status: "nuevo" | "atendido";
  notifiedAt: string | null;
  notifyAttempts: number;
  attendedAt: string | null;
}

/** Datos que el cliente envía al registrar un pedido. */
export interface OrderInput {
  catalogId: string;
  catalogName: string;
  serviceName: string;
  total: number;
  items: { name: string; price: number }[];
  message: string;
  link: string;
  recipient: string;
}

export const ORDER_STATUS_TEXT: Record<CloudOrder["status"], string> = {
  nuevo: "Pendiente",
  atendido: "Atendido",
};
