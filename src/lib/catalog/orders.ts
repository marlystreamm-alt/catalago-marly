import type { CatalogId } from "./types";

/** Estados posibles de un pedido en la cola. */
export type OrderStatus = "cola" | "enviando" | "enviado" | "fallido";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  cola: "En cola",
  enviando: "Enviando",
  enviado: "Enviado",
  fallido: "Fallido",
};

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
}

const KEY = "ma2-pedidos-v1";
const MAX_ORDERS = 50;

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

const normalize = (o: Partial<PendingOrder>, i: number): PendingOrder => ({
  id: String(o.id ?? `ord-${i}`),
  at: String(o.at ?? new Date().toISOString()),
  catalogId: (o.catalogId ?? "clientes") as CatalogId,
  catalogName: String(o.catalogName ?? ""),
  serviceName: String(o.serviceName ?? "Servicio"),
  price: Number.isFinite(Number(o.price)) ? Number(o.price) : 0,
  message: String(o.message ?? ""),
  link: String(o.link ?? ""),
  status: (["cola", "enviando", "enviado", "fallido"] as string[]).includes(String(o.status))
    ? (o.status as OrderStatus)
    : "cola",
  attempts: Number.isFinite(Number(o.attempts)) ? Number(o.attempts) : 0,
  lastAttemptAt: typeof o.lastAttemptAt === "string" ? o.lastAttemptAt : undefined,
  error: typeof o.error === "string" ? o.error : undefined,
});

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
