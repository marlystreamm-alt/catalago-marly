/** Tipos compartidos (cliente y servidor) del sistema de avisos de pedidos. */

export type AlexaProvider = "voicemonkey" | "virtualbuttons" | "webhook" | "custom";
export type AlexaMethod = "POST" | "GET";
export type WhatsappProvider = "twilio" | "whapi" | "greenapi";
export type AlexaEventKey =
  | "order_new"
  | "order_reminder"
  | "directory_request"
  | "menu_extra_request"
  | "payment_proof"
  | "client_suspended";

export type AlexaEventSettings = Record<AlexaEventKey, boolean>;

export const ALEXA_EVENT_TEXT: Record<AlexaEventKey, string> = {
  order_new: "Pedido / venta nueva",
  order_reminder: "Recordatorio de pedido pendiente",
  directory_request: "Solicitud nueva para el directorio",
  menu_extra_request: "Solicitud de menú digital extra",
  payment_proof: "Comprobante de pago recibido",
  client_suspended: "Cliente suspendido",
};

export const DEFAULT_ALEXA_EVENTS: AlexaEventSettings = {
  order_new: true,
  order_reminder: true,
  directory_request: true,
  menu_extra_request: true,
  payment_proof: true,
  client_suspended: true,
};

/** Configuración de avisos del administrador. */
export interface NotifySettings {
  enabled: boolean;
  channelPush: boolean;
  channelEmail: boolean;
  channelWhatsapp: boolean;
  channelAlexa: boolean;
  /** Dispara además una Rutina Trigger de Voice Monkey para acciones en Alexa app. */
  channelAlexaApp: boolean;
  email: string;
  whatsappNumber: string;
  whatsappProvider: WhatsappProvider;
  alexaProvider: AlexaProvider;
  /** Token de Voice Monkey o access code de Virtual Buttons. */
  alexaToken: string;
  /** ID de Speaker de Voice Monkey o número de botón de Virtual Buttons. */
  alexaDevice: string;
  /** ID de Routine Trigger de Voice Monkey para la rutina de la app Alexa. */
  alexaAppDevice: string;
  /** Endpoint para Webhook compatible o Integración personalizada. */
  alexaWebhookUrl: string;
  /** Secreto opcional que se envía como Authorization: Bearer. */
  alexaWebhookSecret: string;
  /** Método de la integración personalizada. */
  alexaMethod: AlexaMethod;
  /** Cuerpo editable para la integración personalizada. */
  alexaBodyTemplate: string;
  /** Qué eventos pueden disparar Alexa. */
  alexaEvents: AlexaEventSettings;
  /** Texto que Alexa dirá al llegar un pedido nuevo. Admite variables. */
  alexaOrderNewMessage: string;
  /** Texto que Alexa dirá al recordar un pedido aún pendiente. Admite variables. */
  alexaOrderReminderMessage: string;
  repeatEnabled: boolean;
  repeatMinutes: number;
  quietStart: string;
  quietEnd: string;
  autoOffMidnight: boolean;
  timezone: string;
  /** Escalamiento: avisar por otro canal si no se atiende a tiempo. */
  escalateEnabled: boolean;
  escalateMinutes: number;
  escalateChannel: EscalateChannel;
  /** true cuando ya existe un código de acceso configurado. */
  hasCode: boolean;
}

export type EscalateChannel = "push" | "email" | "whatsapp" | "alexa";

/** Dispositivo registrado para avisos push. */
export interface NotifyDevice {
  id: string;
  label: string;
  endpoint: string;
  active: boolean;
  createdAt: string;
}

/** Entrada del historial de avisos. */
export interface NotifyLogEntry {
  id: string;
  createdAt: string;
  orderId: string | null;
  channel: string;
  kind: string;
  attempt: number;
  status: string;
  detail: string;
}

export const CHANNEL_TEXT: Record<string, string> = {
  push: "Teléfono (push)",
  email: "Correo",
  whatsapp: "WhatsApp",
  alexa: "Alexa (Echo)",
  alexa_app: "Alexa app",
};

export const KIND_TEXT: Record<string, string> = {
  nuevo: "Pedido nuevo",
  recordatorio: "Recordatorio",
  escalamiento: "Escalamiento",
  prueba: "Prueba",
  evento: "Evento",
};

export const DEFAULT_SETTINGS: NotifySettings = {
  enabled: true,
  channelPush: true,
  channelEmail: false,
  channelWhatsapp: false,
  channelAlexa: false,
  channelAlexaApp: false,
  email: "",
  whatsappNumber: "",
  whatsappProvider: "twilio",
  alexaProvider: "voicemonkey",
  alexaToken: "",
  alexaDevice: "",
  alexaAppDevice: "",
  alexaWebhookUrl: "",
  alexaWebhookSecret: "",
  alexaMethod: "POST",
  alexaBodyTemplate: '{"message":"{message}","event":"{event}","source":"MA2"}',
  alexaEvents: { ...DEFAULT_ALEXA_EVENTS },
  alexaOrderNewMessage: "Tienes un nuevo pedido de {catalogo}. Revisa MA² Connect.",
  alexaOrderReminderMessage: "Tienes un pedido pendiente de {catalogo}. Revisa MA² Connect.",
  repeatEnabled: true,
  repeatMinutes: 15,
  quietStart: "08:00",
  quietEnd: "00:00",
  autoOffMidnight: true,
  timezone: "America/Monterrey",
  escalateEnabled: false,
  escalateMinutes: 30,
  escalateChannel: "whatsapp",
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
