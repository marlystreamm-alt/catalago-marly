export const MODULES = [
  "clients",
  "reports",
  "questions",
  "providers",
  "notices",
  "faq",
  "referrals",
  "songs",
  "documents",
  "codes",
  "config",
  "requests",
] as const;
export type Module = (typeof MODULES)[number];
export type Payload = Record<string, string>;
export type OpsRecord = {
  id: string;
  module: Module;
  title: string;
  status: string;
  data: Payload;
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type Field = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "date" | "datetime-local" | "number" | "url" | "client" | "select";
  options?: string[];
  required?: boolean;
};
export const DEFINITIONS: Record<
  Module,
  {
    title: string;
    description: string;
    singular: string;
    icon: string;
    fields: Field[];
    statuses: string[];
  }
> = {
  clients: {
    title: "Clientes",
    description: "Tus contactos, saldos y enlaces privados de atención.",
    singular: "cliente",
    icon: "👥",
    fields: [
      { key: "whatsapp", label: "WhatsApp con lada", required: true },
      { key: "email", label: "Correo" },
      { key: "referrer", label: "Código de referido" },
      { key: "notes", label: "Notas", type: "textarea" },
    ],
    statuses: ["active", "inactive"],
  },
  reports: {
    title: "Reportes de cuentas",
    description: "Registra fallas, revisa evidencias y da seguimiento a las reposiciones.",
    singular: "reporte",
    icon: "🛠️",
    fields: [
      { key: "clientId", label: "Cliente", type: "client" },
      { key: "platform", label: "Plataforma", required: true },
      { key: "message", label: "Falla reportada", type: "textarea", required: true },
      { key: "reply", label: "Respuesta / solución", type: "textarea" },
      { key: "dueDate", label: "Fecha de seguimiento", type: "date" },
    ],
    statuses: ["pending", "in_progress", "resolved"],
  },
  questions: {
    title: "Dudas de clientes",
    description: "Responde aquí; el cliente ve la respuesta en su enlace de atención.",
    singular: "consulta",
    icon: "💬",
    fields: [
      { key: "clientId", label: "Cliente", type: "client", required: true },
      { key: "message", label: "Pregunta", type: "textarea", required: true },
      { key: "reply", label: "Tu respuesta", type: "textarea" },
    ],
    statuses: ["pending", "answered"],
  },
  providers: {
    title: "Proveedores",
    description: "Organiza contactos, plataformas y condiciones de tus proveedores.",
    singular: "proveedor",
    icon: "🤝",
    fields: [
      { key: "whatsapp", label: "WhatsApp" },
      { key: "platform", label: "Plataformas" },
      { key: "cost", label: "Costo de referencia", type: "number" },
      { key: "notes", label: "Condiciones / garantía", type: "textarea" },
    ],
    statuses: ["active", "inactive"],
  },
  notices: {
    title: "Avisos",
    description:
      "Mensajes para tus clientes. Puedes fijarlos y publicarlos en sus enlaces de atención.",
    singular: "aviso",
    icon: "📢",
    fields: [
      { key: "message", label: "Mensaje", type: "textarea", required: true },
      {
        key: "kind",
        label: "Tipo",
        type: "select",
        options: ["Información", "Promoción", "Urgente"],
      },
      { key: "expiresAt", label: "Retirar después de", type: "datetime-local" },
      { key: "pinned", label: "Fijar arriba", type: "select", options: ["No", "Sí"] },
      { key: "public", label: "Mostrar también en portada", type: "select", options: ["No", "Sí"] },
    ],
    statuses: ["active", "inactive"],
  },
  faq: {
    title: "Preguntas frecuentes",
    description: "Respuestas reutilizables para tus clientes.",
    singular: "respuesta frecuente",
    icon: "❓",
    fields: [{ key: "reply", label: "Respuesta", type: "textarea", required: true }],
    statuses: ["active", "inactive"],
  },
  referrals: {
    title: "Referidos",
    description: "Crea códigos y consulta los clientes que registraste con cada código.",
    singular: "código de referido",
    icon: "🎁",
    fields: [
      { key: "clientId", label: "Cliente que recomienda", type: "client" },
      { key: "code", label: "Código único", required: true },
      { key: "commission", label: "Comisión de referencia MXN", type: "number" },
      { key: "notes", label: "Condiciones", type: "textarea" },
    ],
    statuses: ["active", "inactive"],
  },
  songs: {
    title: "Música",
    description: "Guarda tus canciones y reproduce enlaces de YouTube desde tu biblioteca.",
    singular: "canción",
    icon: "🎵",
    fields: [
      { key: "url", label: "Enlace de YouTube", type: "url", required: true },
      { key: "artist", label: "Artista" },
    ],
    statuses: ["active", "favorite"],
  },
  documents: {
    title: "Bóveda de documentos",
    description: "Guarda archivos privados y asígnalos al cliente que corresponde.",
    singular: "documento",
    icon: "🗂️",
    fields: [
      { key: "clientId", label: "Cliente", type: "client" },
      { key: "notes", label: "Notas del documento", type: "textarea" },
      { key: "expiresAt", label: "Vigencia", type: "datetime-local" },
    ],
    statuses: ["active", "archived"],
  },
  codes: {
    title: "Panel de códigos",
    description: "Registra códigos recibidos, asigna un cliente y establece su vencimiento.",
    singular: "código",
    icon: "🔑",
    fields: [
      { key: "clientId", label: "Cliente autorizado", type: "client", required: true },
      { key: "platform", label: "Plataforma", required: true },
      { key: "account", label: "Correo de la cuenta" },
      { key: "value", label: "Código recibido", required: true },
      { key: "expiresAt", label: "Vence el", type: "datetime-local", required: true },
    ],
    statuses: ["active", "used", "expired"],
  },
  config: {
    title: "Configuración",
    description: "Contacto de soporte y mensajes que se muestran a tus clientes.",
    singular: "configuración",
    icon: "⚙️",
    fields: [
      { key: "whatsapp", label: "WhatsApp de soporte con lada" },
      { key: "facebook", label: "Facebook", type: "url" },
      { key: "instagram", label: "Instagram", type: "url" },
      { key: "telegram", label: "Telegram", type: "url" },
      { key: "message", label: "Mensaje de bienvenida", type: "textarea" },
      {
        key: "renewal",
        label: "Plantilla de renovación ({cliente}, {plataforma}, {fecha})",
        type: "textarea",
      },
    ],
    statuses: ["active"],
  },
  requests: {
    title: "Pedidos por encargo",
    description: "Gestiona solicitudes y registra su entrega para que el cliente pueda verla.",
    singular: "pedido",
    icon: "📝",
    fields: [
      { key: "clientId", label: "Cliente", type: "client" },
      { key: "platform", label: "Producto", required: true },
      { key: "amount", label: "Precio MXN", type: "number" },
      { key: "message", label: "Datos necesarios", type: "textarea" },
      { key: "deliveryUrl", label: "Enlace de entrega", type: "url" },
      { key: "reply", label: "Respuesta / indicaciones", type: "textarea" },
    ],
    statuses: ["pending", "in_progress", "completed", "cancelled"],
  },
};
export const STATUS: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
  pending: "Pendiente",
  in_progress: "En proceso",
  resolved: "Resuelto",
  answered: "Respondida",
  favorite: "Favorita",
  archived: "Archivado",
  used: "Utilizado",
  expired: "Vencido",
  completed: "Entregado",
  cancelled: "Cancelado",
};
export function validatePayload(module: Module, data: Payload) {
  const def = DEFINITIONS[module];
  for (const field of def.fields) {
    const value = data[field.key] || "";
    if (field.required && !value.trim()) throw new Error(`Completa ${field.label}`);
    if (field.type === "number" && value && (!Number.isFinite(Number(value)) || Number(value) < 0))
      throw new Error(`Revisa ${field.label}`);
    if (field.type === "url" && value && !/^https:\/\//i.test(value))
      throw new Error(`${field.label} debe comenzar con https://`);
    if (field.options && value && !field.options.includes(value))
      throw new Error(`Revisa ${field.label}`);
    if (
      ["date", "datetime-local"].includes(field.type || "") &&
      value &&
      Number.isNaN(Date.parse(value))
    )
      throw new Error(`Revisa ${field.label}`);
  }
  if (module === "clients" && !/^\+?[\d ()-]{10,25}$/.test(data.whatsapp || ""))
    throw new Error("Escribe el WhatsApp con lada");
  if (module === "songs" && !youtubeId(data.url || ""))
    throw new Error("Usa un enlace de video de YouTube válido");
}
export function youtubeId(raw: string) {
  try {
    const u = new URL(raw);
    const id =
      u.hostname === "youtu.be"
        ? u.pathname.slice(1)
        : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(u.hostname)
          ? u.searchParams.get("v") || u.pathname.match(/^\/(?:embed|shorts)\/([^/?]+)/)?.[1]
          : "";
    return id && /^[\w-]{11}$/.test(id) ? id : "";
  } catch {
    return "";
  }
}
export const money = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
export function phoneNumber(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 10) digits = "52" + digits;
  if (digits.startsWith("521") && digits.length === 13) digits = "52" + digits.slice(3);
  return digits;
}
