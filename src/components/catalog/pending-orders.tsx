import { useState } from "react";
import { Clock, Send, Trash2, X } from "lucide-react";
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

/** Aviso y detalle de los pedidos guardados mientras no hubo internet. */
export function PendingOrdersBar() {
  const { orders, sendAll, sendOne, remove, clear } = useOrderQueue();
  const online = useOnline();
  const [open, setOpen] = useState(false);

  if (!orders.length) return null;

  return (
    <>
      <div className="card-soft mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <Clock className="size-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          Tienes <strong className="text-card-foreground">{orders.length}</strong> pedido(s) en
          cola.{" "}
          {online
            ? "Se enviarán por WhatsApp automáticamente."
            : "Se enviarán solos al recuperar la conexión."}
        </p>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Ver pedidos
        </Button>
        {online ? (
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
              Pedidos pendientes
            </DialogTitle>
            <DialogDescription>
              Guardados sin conexión. Al volver el internet se abren solos en WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            {orders.map((o) => (
              <div key={o.id} className="rounded-xl border border-border bg-muted/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-card-foreground">
                      {o.serviceName}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{o.catalogName}</Badge>
                      <Badge variant="outline">{formatMXN(o.price)}</Badge>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(o.at)}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{o.message}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button size="sm" onClick={() => sendOne(o.id)} disabled={!online}>
                    <Send className="size-4" />
                    Enviar
                  </Button>
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
              title="¿Vaciar la cola de pedidos?"
              description="Se eliminarán todos los pedidos guardados sin enviarlos."
              confirmLabel="Vaciar"
              onConfirm={clear}
            >
              <Button variant="outline" size="sm">
                <Trash2 className="size-4 text-destructive" />
                Vaciar cola
              </Button>
            </ConfirmButton>
            <Button onClick={() => setOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
