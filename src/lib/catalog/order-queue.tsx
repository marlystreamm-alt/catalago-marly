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
import { loadOrders, saveOrders, type PendingOrder } from "./orders";

interface OrderQueueValue {
  orders: PendingOrder[];
  enqueue: (order: Omit<PendingOrder, "id" | "at">) => void;
  remove: (id: string) => void;
  clear: () => void;
  sendAll: () => void;
  sendOne: (id: string) => void;
}

const OrderQueueContext = createContext<OrderQueueValue | null>(null);

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ord-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

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

  const sendOrders = useCallback((list: PendingOrder[]) => {
    if (!list.length) return;
    let blocked = false;
    list.forEach((order, index) => {
      window.setTimeout(() => {
        const win = window.open(order.link, "_blank", "noopener,noreferrer");
        if (!win && !blocked) {
          blocked = true;
          toast.warning("Permite ventanas emergentes para enviar los pedidos pendientes");
        }
      }, index * 600);
    });
    const ids = new Set(list.map((o) => o.id));
    setOrders((prev) => prev.filter((o) => !ids.has(o.id)));
    toast.success(
      list.length === 1
        ? "Pedido enviado por WhatsApp"
        : `${list.length} pedidos enviados por WhatsApp`,
    );
  }, []);

  // Al recuperar la conexión, la cola se envía sola por WhatsApp.
  useEffect(() => {
    if (!hydrated) return;
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current && orders.length) {
      wasOffline.current = false;
      sendOrders(orders);
    }
    wasOffline.current = false;
  }, [online, hydrated, orders, sendOrders]);

  const value = useMemo<OrderQueueValue>(
    () => ({
      orders,
      enqueue: (order) => {
        setOrders((prev) => [{ ...order, id: newId(), at: new Date().toISOString() }, ...prev]);
        toast.success("Pedido guardado: se enviará solo al recuperar la conexión");
      },
      remove: (id) => setOrders((prev) => prev.filter((o) => o.id !== id)),
      clear: () => {
        setOrders([]);
        toast.success("Cola de pedidos vaciada");
      },
      sendAll: () => sendOrders(orders),
      sendOne: (id) => {
        const found = orders.find((o) => o.id === id);
        if (found) sendOrders([found]);
      },
    }),
    [orders, sendOrders],
  );

  return <OrderQueueContext.Provider value={value}>{children}</OrderQueueContext.Provider>;
}

export function useOrderQueue() {
  const ctx = useContext(OrderQueueContext);
  if (!ctx) throw new Error("useOrderQueue debe usarse dentro de OrderQueueProvider");
  return ctx;
}
