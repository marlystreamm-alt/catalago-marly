import type { CatalogId } from "./types";

/** Estados posibles de un pedido en la cola. */
export type OrderStatus = "cola" | "enviando" | "enviado" | "fallido";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  cola: "En cola",
  enviando: "Enviando",
  enviado: "Enviado",
  fallido: "Fallido",
};

/** Servicio incluido dentro de un pedido (útil para pedidos múltiples). */
export interface OrderItem {
  name: string;
  price: number;
}

/** Pedido guardado mientras no hay internet, para enviarlo al recuperar conexión. */
export interface PendingOrder {
  id: string;
  at: string;
  catalogId: CatalogId;
  catalogName: string;
  serviceName: string;
  price: number;
  message: string;
  link: string;
  status: OrderStatus;
  attempts: number;
  lastAttemptAt?: string;
  error?: string;
  /** Desglose de los servicios incluidos en el pedido. */
  items?: OrderItem[];
  /** Número de WhatsApp al que se enviará el pedido. */
  recipient?: string;
}

const KEY = "ma2-pedidos-v1";
const MAX_ORDERS = 50;

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Obtiene el número destinatario desde el enlace wa.me del pedido. */
export function recipientFromLink(link: string) {
  const match = /wa\.me\/(\d+)/.exec(link || "");
  return match ? match[1] : "";
}

const normalizeItems = (raw: unknown): OrderItem[] | undefined => {
  if (!Array.isArray(raw)) return undefined;
  const items = raw
    .filter((i): i is Partial<OrderItem> => !!i && typeof i === "object")
    .map((i) => ({
      name: String(i.name ?? "Servicio"),
      price: Number.isFinite(Number(i.price)) ? Number(i.price) : 0,
    }));
  return items.length ? items : undefined;
};

const normalize = (o: Partial<PendingOrder>, i: number): PendingOrder => {
  const link = String(o.link ?? "");
  return {
    id: String(o.id ?? `ord-${i}`),
    at: String(o.at ?? new Date().toISOString()),
    catalogId: (o.catalogId ?? "clientes") as CatalogId,
    catalogName: String(o.catalogName ?? ""),
    serviceName: String(o.serviceName ?? "Servicio"),
    price: Number.isFinite(Number(o.price)) ? Number(o.price) : 0,
    message: String(o.message ?? ""),
    link,
    status: (["cola", "enviando", "enviado", "fallido"] as string[]).includes(String(o.status))
      ? (o.status as OrderStatus)
      : "cola",
    attempts: Number.isFinite(Number(o.attempts)) ? Number(o.attempts) : 0,
    lastAttemptAt: typeof o.lastAttemptAt === "string" ? o.lastAttemptAt : undefined,
    error: typeof o.error === "string" ? o.error : undefined,
    items: normalizeItems(o.items),
    recipient:
      typeof o.recipient === "string" && o.recipient ? o.recipient : recipientFromLink(link),
  };
};

export function loadOrders(): PendingOrder[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((o): o is Partial<PendingOrder> => !!o && typeof o === "object" && "message" in o)
      .slice(0, MAX_ORDERS)
      .map(normalize)
      // Un pedido que quedó "enviando" al cerrar la app vuelve a la cola.
      .map((o) => (o.status === "enviando" ? { ...o, status: "cola" as OrderStatus } : o));
  } catch (error) {
    console.error("No se pudieron leer los pedidos pendientes:", error);
    return [];
  }
}

export function saveOrders(orders: PendingOrder[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(orders.slice(0, MAX_ORDERS)));
  } catch (error) {
    console.error("No se pudieron guardar los pedidos pendientes:", error);
  }
}

/** Respaldo JSON del historial de pedidos con su estado y reintentos. */
export interface OrdersBackup {
  app: "ma2-pedidos";
  version: 1;
  exportedAt: string;
  count: number;
  orders: PendingOrder[];
}

export function buildOrdersBackup(orders: PendingOrder[]): OrdersBackup {
  return {
    app: "ma2-pedidos",
    version: 1,
    exportedAt: new Date().toISOString(),
    count: orders.length,
    orders,
  };
}

/** Lee un respaldo JSON y devuelve los pedidos válidos que contiene. */
export function parseOrdersBackup(text: string): PendingOrder[] {
  const parsed: unknown = JSON.parse(text);
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as OrdersBackup).orders)
      ? (parsed as OrdersBackup).orders
      : null;
  if (!list) throw new Error("El archivo no contiene una lista de pedidos");
  const valid = list.filter(
    (o): o is Partial<PendingOrder> => !!o && typeof o === "object" && "message" in o,
  );
  if (!valid.length) throw new Error("El archivo no contiene pedidos válidos");
  return valid.slice(0, MAX_ORDERS).map(normalize);
}

/** Descarga un archivo de texto/JSON desde el navegador. */
export function downloadTextFile(filename: string, content: string, type = "application/json") {
  if (!isBrowser()) return;
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
