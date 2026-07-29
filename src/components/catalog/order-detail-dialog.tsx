import { Copy, Download, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
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
import {
  ORDER_STATUS_LABELS,
  downloadTextFile,
  recipientFromLink,
  type PendingOrder,
} from "@/lib/catalog/orders";
import { formatMXN } from "@/lib/catalog/whatsapp";

/** Detalle completo de un pedido de la cola con opciones de copiar/descargar. */
export function OrderDetailDialog({
  order,
  open,
  onOpenChange,
  maxAttempts,
}: {
  order: PendingOrder | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  maxAttempts: number;
}) {
  if (!order) return null;

  const recipient = order.recipient || recipientFromLink(order.link) || "Sin número configurado";
  const items = order.items?.length ? order.items : [{ name: order.serviceName, price: order.price }];

  const copyMessage = () => {
    navigator.clipboard
      .writeText(order.message)
      .then(() => toast.success("Mensaje copiado"))
      .catch(() => toast.error("No se pudo copiar el mensaje"));
  };

  const downloadMessage = () => {
    const text = [
      `Pedido: ${order.serviceName}`,
      `Catálogo: ${order.catalogName}`,
      `Fecha: ${new Date(order.at).toLocaleString("es-MX")}`,
      `Estado: ${ORDER_STATUS_LABELS[order.status]} (${order.attempts}/${maxAttempts} intentos)`,
      `Destinatario: ${recipient}`,
      `Total: ${formatMXN(order.price)}`,
      "",
      "Servicios incluidos:",
      ...items.map((i) => `- ${i.name}: ${formatMXN(i.price)}`),
      "",
      "Mensaje:",
      order.message,
    ].join("\n");
    downloadTextFile(`ma2-pedido-${order.id}.txt`, text, "text/plain");
    toast.success("Pedido descargado");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-4" />
            Detalle del pedido
          </DialogTitle>
          <DialogDescription>
            Servicios incluidos, precio, destinatario y el mensaje exacto que se envía por WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{order.catalogName}</Badge>
          <Badge variant="outline">{ORDER_STATUS_LABELS[order.status]}</Badge>
          <Badge variant="outline">
            Intentos {order.attempts}/{maxAttempts}
          </Badge>
        </div>

        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="size-4 text-primary" />
          Destinatario: <strong className="text-card-foreground">{recipient}</strong>
        </p>

        <div className="grid gap-1.5 rounded-xl border border-border bg-muted/40 p-3 text-sm">
          {items.map((item, i) => (
            <div key={`${item.name}-${i}`} className="flex items-start justify-between gap-3">
              <span className="min-w-0 text-muted-foreground">{item.name}</span>
              <span className="shrink-0 font-medium text-card-foreground">
                {formatMXN(item.price)}
              </span>
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-2">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-bold text-primary">{formatMXN(order.price)}</span>
          </div>
        </div>

        <div>
          <p className="mb-1 text-sm font-semibold text-card-foreground">Mensaje enviado</p>
          <p className="whitespace-pre-line rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            {order.message}
          </p>
        </div>

        {order.error ? (
          <p className="text-xs font-medium text-destructive">{order.error}</p>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={copyMessage}>
            <Copy className="size-4" />
            Copiar mensaje
          </Button>
          <Button variant="outline" onClick={downloadMessage}>
            <Download className="size-4" />
            Descargar
          </Button>
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
