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

type NewOrder = Omit<PendingOrder, "id" | "at" | "status" | "attempts">;

interface OrderQueueValue {
  orders: PendingOrder[];
  pending: PendingOrder[];
  enqueue: (order: NewOrder) => void;
  enqueueMany: (orders: NewOrder[]) => void;
  remove: (id: string) => void;
  clear: () => void;
  clearSent: () => void;
  sendAll: () => void;
  sendOne: (id: string) => void;
  retryFailed: () => void;
  importOrders: (list: PendingOrder[], mode: "merge" | "replace") => void;
  maxAttempts: number;
  setMaxAttempts: (value: number) => void;
  autoRetry: boolean;
  setAutoRetry: (value: boolean) => void;
  online: boolean;
}

const OrderQueueContext = createContext<OrderQueueValue | null>(null);

const CONFIG_KEY = "ma2-pedidos-config-v1";
export const MIN_ATTEMPTS = 1;
export const MAX_ATTEMPTS_LIMIT = 10;

interface QueueConfig {
  maxAttempts: number;
  autoRetry: boolean;
}

const DEFAULT_CONFIG: QueueConfig = { maxAttempts: 3, autoRetry: true };

function loadConfig(): QueueConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const p = JSON.parse(raw) as Partial<QueueConfig>;
    const n = Number(p.maxAttempts);
    return {
      maxAttempts: Number.isFinite(n)
        ? Math.min(MAX_ATTEMPTS_LIMIT, Math.max(MIN_ATTEMPTS, Math.round(n)))
        : DEFAULT_CONFIG.maxAttempts,
      autoRetry: p.autoRetry !== false,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: QueueConfig) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("No se pudo guardar la configuración de pedidos:", error);
  }
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ord-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

/** Un pedido sigue pendiente mientras no se haya enviado. */
export const isPending = (o: PendingOrder) => o.status === "cola" || o.status === "fallido";

export function OrderQueueProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [config, setConfig] = useState<QueueConfig>(DEFAULT_CONFIG);
  const [hydrated, setHydrated] = useState(false);
  const online = useOnline();
  const wasOffline = useRef(false);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    setOrders(loadOrders());
    setConfig(loadConfig());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveOrders(orders);
  }, [orders, hydrated]);

  useEffect(() => {
    if (hydrated) saveConfig(config);
  }, [config, hydrated]);

  const patch = useCallback((id: string, changes: Partial<PendingOrder>) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...changes } : o)));
  }, []);

  /** Intenta abrir WhatsApp para cada pedido y va marcando su estado. */
  const sendOrders = useCallback(
    (list: PendingOrder[], options?: { silent?: boolean }) => {
      const targets = list.filter(isPending);
      if (!targets.length) return;
      const silent = options?.silent === true;

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
            reportOrder({
              catalogId: order.catalogId,
              catalogName: order.catalogName,
              serviceName: order.serviceName,
              total: order.price,
              items: order.items ?? [{ name: order.serviceName, price: order.price }],
              message: order.message,
              link: order.link,
              recipient: order.recipient ?? "",
            });
            toast.success(`Enviado: ${order.serviceName}`);
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

      if (!silent) {
        toast.success(
          targets.length === 1
            ? "Enviando el pedido por WhatsApp…"
            : `Enviando ${targets.length} pedidos por WhatsApp…`,
        );
      }
    },
    [patch],
  );

  // Al recuperar la conexión, la cola (incluidos los fallidos con intentos
  // disponibles) se envía sola por WhatsApp.
  useEffect(() => {
    if (!hydrated) return;
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      if (!configRef.current.autoRetry) return;
      const queued = orders.filter(
        (o) => isPending(o) && o.attempts < configRef.current.maxAttempts,
      );
      if (queued.length) {
        toast.info(`Conexión recuperada: reintentando ${queued.length} pedido(s)`);
        sendOrders(queued, { silent: true });
      }
    }
  }, [online, hydrated, orders, sendOrders]);

  const value = useMemo<OrderQueueValue>(() => {
    const create = (order: NewOrder): PendingOrder => ({
      ...order,
      id: newId(),
      at: new Date().toISOString(),
      status: "cola",
      attempts: 0,
    });
    return {
      orders,
      pending: orders.filter(isPending),
      enqueue: (order) => {
        setOrders((prev) => [create(order), ...prev]);
        toast.success("Pedido guardado: se enviará solo al recuperar la conexión");
      },
      enqueueMany: (list) => {
        if (!list.length) return;
        setOrders((prev) => [...list.map(create), ...prev]);
        toast.success(`${list.length} pedido(s) guardados en la cola`);
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
      retryFailed: () => {
        const list = orders.filter(
          (o) => o.status === "fallido" && o.attempts < config.maxAttempts,
        );
        if (!list.length) {
          toast.info("No hay fallidos con intentos disponibles");
          return;
        }
        sendOrders(list);
      },
      importOrders: (list, mode) => {
        if (!list.length) return;
        setOrders((prev) => {
          if (mode === "replace") return list;
          const known = new Set(prev.map((o) => o.id));
          const added = list.filter((o) => !known.has(o.id));
          return [...added, ...prev];
        });
        toast.success(
          mode === "replace"
            ? `Historial restaurado con ${list.length} pedido(s)`
            : `${list.length} pedido(s) revisados para importar`,
        );
      },
      maxAttempts: config.maxAttempts,
      setMaxAttempts: (value) =>
        setConfig((prev) => ({
          ...prev,
          maxAttempts: Math.min(MAX_ATTEMPTS_LIMIT, Math.max(MIN_ATTEMPTS, Math.round(value))),
        })),
      autoRetry: config.autoRetry,
      setAutoRetry: (value) => setConfig((prev) => ({ ...prev, autoRetry: value })),
      online,
    };
  }, [orders, sendOrders, online, config]);

  return <OrderQueueContext.Provider value={value}>{children}</OrderQueueContext.Provider>;
}

export function useOrderQueue() {
  const ctx = useContext(OrderQueueContext);
  if (!ctx) throw new Error("useOrderQueue debe usarse dentro de OrderQueueProvider");
  return ctx;
}
