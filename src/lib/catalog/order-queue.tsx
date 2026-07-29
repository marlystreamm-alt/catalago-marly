import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useOnline } from "@/hooks/use-online";
import { loadOrders, saveOrders, type OrderStatus, type PendingOrder } from "./orders";

interface OrderQueueValue {
  orders: PendingOrder[];
  pending: PendingOrder[];
  enqueue: (order: Omit<PendingOrder, "id" | "at" | "status" | "attempts">) => void;
  remove: (id: string) => void;
  clear: () => void;
  clearSent: () => void;
  sendAll: () => void;
  sendOne: (id: string) => void;
  retryFailed: () => void;
  online: boolean;
}

const OrderQueueContext = createContext<OrderQueueValue | null>(null);

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ord-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

/** Un pedido sigue pendiente mientras no se haya enviado. */
export const isPending = (o: PendingOrder) => o.status === "cola" || o.status === "fallido";

export function OrderQueueProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const online = useOnline();
  const wasOffline = useRef(false);

  useEffect(() => {
    setOrders(loadOrders());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveOrders(orders);
  }, [orders, hydrated]);

  const patch = useCallback((id: string, changes: Partial<PendingOrder>) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...changes } : o)));
  }, []);

  /** Intenta abrir WhatsApp para cada pedido y va marcando su estado. */
  const sendOrders = useCallback(
    (list: PendingOrder[]) => {
      const targets = list.filter(isPending);
      if (!targets.length) return;

      if (!navigator.onLine) {
        const now = new Date().toISOString();
        targets.forEach((o) =>
          patch(o.id, {
            status: "fallido" as OrderStatus,
            attempts: o.attempts + 1,
            lastAttemptAt: now,
            error: "Sin conexión a internet",
          }),
        );
        toast.error("Sin conexión: los pedidos quedaron marcados como fallidos");
        return;
      }

      const ids = new Set(targets.map((o) => o.id));
      setOrders((prev) =>
        prev.map((o) => (ids.has(o.id) ? { ...o, status: "enviando" as OrderStatus } : o)),
      );

      let blocked = false;
      targets.forEach((order, index) => {
        window.setTimeout(() => {
          const at = new Date().toISOString();
          let win: Window | null = null;
          try {
            win = window.open(order.link, "_blank", "noopener,noreferrer");
          } catch {
            win = null;
          }
          if (win) {
            patch(order.id, {
              status: "enviado",
              attempts: order.attempts + 1,
              lastAttemptAt: at,
              error: undefined,
            });
          } else {
            patch(order.id, {
              status: "fallido",
              attempts: order.attempts + 1,
              lastAttemptAt: at,
              error: "El navegador bloqueó la ventana de WhatsApp",
            });
            if (!blocked) {
              blocked = true;
              toast.warning("Permite ventanas emergentes y reintenta los pedidos fallidos");
            }
          }
        }, index * 600);
      });

      toast.success(
        targets.length === 1
          ? "Enviando el pedido por WhatsApp…"
          : `Enviando ${targets.length} pedidos por WhatsApp…`,
      );
    },
    [patch],
  );

  // Al recuperar la conexión, la cola se envía sola por WhatsApp.
  useEffect(() => {
    if (!hydrated) return;
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      const queued = orders.filter(isPending);
      if (queued.length) sendOrders(queued);
    }
  }, [online, hydrated, orders, sendOrders]);

  const value = useMemo<OrderQueueValue>(
    () => ({
      orders,
      pending: orders.filter(isPending),
      enqueue: (order) => {
        setOrders((prev) => [
          { ...order, id: newId(), at: new Date().toISOString(), status: "cola", attempts: 0 },
          ...prev,
        ]);
        toast.success("Pedido guardado: se enviará solo al recuperar la conexión");
      },
      remove: (id) => setOrders((prev) => prev.filter((o) => o.id !== id)),
      clear: () => {
        setOrders([]);
        toast.success("Cola de pedidos vaciada");
      },
      clearSent: () => {
        setOrders((prev) => prev.filter((o) => o.status !== "enviado"));
        toast.success("Pedidos enviados quitados de la lista");
      },
      sendAll: () => sendOrders(orders.filter(isPending)),
      sendOne: (id) => {
        const found = orders.find((o) => o.id === id);
        if (found) sendOrders([found]);
      },
      retryFailed: () => sendOrders(orders.filter((o) => o.status === "fallido")),
      online,
    }),
    [orders, sendOrders, online],
  );

  return <OrderQueueContext.Provider value={value}>{children}</OrderQueueContext.Provider>;
}

export function useOrderQueue() {
  const ctx = useContext(OrderQueueContext);
  if (!ctx) throw new Error("useOrderQueue debe usarse dentro de OrderQueueProvider");
  return ctx;
}
