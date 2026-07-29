import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOrderQueue } from "@/lib/catalog/order-queue";
import { ORDER_STATUS_LABELS, type OrderStatus, type PendingOrder } from "@/lib/catalog/orders";
import { formatMXN } from "@/lib/catalog/whatsapp";
import { useOnline } from "@/hooks/use-online";
import { ConfirmButton } from "./confirm-button";

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  cola: "bg-muted text-muted-foreground",
  enviando: "bg-primary/15 text-primary",
  enviado: "bg-emerald-500/15 text-emerald-700",
  fallido: "bg-destructive/15 text-destructive",
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const Icon =
    status === "enviado"
      ? CheckCircle2
      : status === "fallido"
        ? AlertTriangle
        : status === "enviando"
          ? Loader2
          : Clock;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      <Icon className={`size-3.5 ${status === "enviando" ? "animate-spin" : ""}`} />
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

/** Aviso y detalle de los pedidos guardados mientras no hubo internet. */
export function PendingOrdersBar() {
  const { orders, pending, sendAll, sendOne, remove, clear, clearSent, retryFailed } =
    useOrderQueue();
  const online = useOnline();
  const [open, setOpen] = useState(false);

  const counts = useMemo(() => {
    const base: Record<OrderStatus, number> = { cola: 0, enviando: 0, enviado: 0, fallido: 0 };
    orders.forEach((o) => {
      base[o.status] += 1;
    });
    return base;
  }, [orders]);

  if (!orders.length) return null;

  return (
    <>
      <div className="card-soft mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <Clock className="size-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          {pending.length ? (
            <>
              Tienes <strong className="text-card-foreground">{pending.length}</strong> pedido(s)
              pendiente(s).{" "}
              {online
                ? "Se envían por WhatsApp automáticamente."
                : "Se enviarán solos al recuperar la conexión."}
            </>
          ) : (
            <>Todos tus pedidos fueron enviados por WhatsApp.</>
          )}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(counts) as OrderStatus[])
            .filter((s) => counts[s] > 0)
            .map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <StatusBadge status={s} />
                <span className="text-xs text-muted-foreground">{counts[s]}</span>
              </span>
            ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Ver pedidos
        </Button>
        {online && pending.length ? (
          <Button size="sm" onClick={sendAll}>
            <Send className="size-4" />
            Enviar ahora
          </Button>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="size-4" />
              Estado de tus pedidos
            </DialogTitle>
            <DialogDescription>
              En cola, enviando, enviado o fallido. Puedes reintentar manualmente al recuperar la
              conexión.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={retryFailed}
              disabled={!online || counts.fallido === 0}
              variant="outline"
            >
              <RotateCw className="size-4" />
              Reintentar fallidos ({counts.fallido})
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={clearSent}
              disabled={counts.enviado === 0}
            >
              <CheckCircle2 className="size-4" />
              Quitar enviados
            </Button>
          </div>

          <div className="grid gap-2">
            {orders.map((o: PendingOrder) => (
              <div key={o.id} className="rounded-xl border border-border bg-muted/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-card-foreground">
                      {o.serviceName}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={o.status} />
                      <Badge variant="secondary">{o.catalogName}</Badge>
                      <Badge variant="outline">{formatMXN(o.price)}</Badge>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(o.at)}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{o.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Intentos: {o.attempts}
                  {o.lastAttemptAt ? ` · Último: ${formatDate(o.lastAttemptAt)}` : ""}
                </p>
                {o.status === "fallido" && o.error ? (
                  <p className="mt-1 text-xs font-medium text-destructive">{o.error}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {o.status === "enviado" ? null : (
                    <Button
                      size="sm"
                      onClick={() => sendOne(o.id)}
                      disabled={!online || o.status === "enviando"}
                    >
                      {o.status === "fallido" ? (
                        <RotateCw className="size-4" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      {o.status === "fallido" ? "Reintentar" : "Enviar"}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => remove(o.id)}>
                    <X className="size-4" />
                    Quitar
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <ConfirmButton
              title="¿Vaciar la lista de pedidos?"
              description="Se eliminarán todos los pedidos, incluidos los que no se han enviado."
              confirmLabel="Vaciar"
              onConfirm={clear}
            >
              <Button variant="outline" size="sm">
                <Trash2 className="size-4 text-destructive" />
                Vaciar lista
              </Button>
            </ConfirmButton>
            <Button onClick={() => setOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
