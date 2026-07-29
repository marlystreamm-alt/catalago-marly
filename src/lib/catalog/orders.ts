import type { CatalogId } from "./types";

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
}

const KEY = "ma2-pedidos-v1";
const MAX_ORDERS = 50;

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadOrders(): PendingOrder[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((o): o is PendingOrder => !!o && typeof o === "object" && "message" in o)
      .slice(0, MAX_ORDERS);
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
