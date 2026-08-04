import { useMemo, useState } from "react";
import { AlertTriangle, MessageCircle, ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCatalogStore } from "@/lib/catalog/store";
import { useOrderQueue } from "@/lib/catalog/order-queue";
import { useOnline } from "@/hooks/use-online";
import {
  buildBulkWhatsappLink,
  buildBulkWhatsappMessage,
  formatMXN,
} from "@/lib/catalog/whatsapp";
import { recipientFromLink } from "@/lib/catalog/orders";
import type { Service } from "@/lib/catalog/types";

/** Barra fija para pedir varias plataformas seleccionadas en un solo mensaje. */
export function BulkOrderBar({
  services,
  snapshots = {},
  onClear,
}: {
  services: Service[];
  /** Precio que tenía cada servicio al seleccionarlo, para detectar cambios. */
  snapshots?: Record<string, number>;
  onClear: () => void;
}) {
  const { catalog } = useCatalogStore();
  const { enqueue } = useOrderQueue();
  const online = useOnline();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Validaciones: duplicados, servicios desactivados y precios que cambiaron.
  const check = useMemo(() => {
    const issues: string[] = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const valid: Service[] = [];

    for (const s of services) {
      if (seenIds.has(s.id)) {
        issues.push(`Duplicado omitido: ${s.name}`);
        continue;
      }
      seenIds.add(s.id);
      const nameKey = s.name.trim().toLowerCase();
      if (seenNames.has(nameKey)) {
        issues.push(`Servicio repetido con el mismo nombre: ${s.name}`);
        continue;
      }
      seenNames.add(nameKey);
      if (!s.active) {
        issues.push(`Desactivado, no se puede pedir: ${s.name}`);
        continue;
      }
      const before = snapshots[s.id];
      if (typeof before === "number" && before !== s.price) {
        issues.push(`Precio actualizado en ${s.name}: ${formatMXN(before)} → ${formatMXN(s.price)}`);
      }
      valid.push(s);
    }
    return { issues, valid, total: valid.reduce((sum, s) => sum + s.price, 0) };
  }, [services, snapshots]);

  if (!services.length) return null;

  const submit = async () => {
    const { valid, total } = check;
    if (!valid.length) return;
    const message = buildBulkWhatsappMessage(valid, catalog);
    const link = buildBulkWhatsappLink(valid, catalog);
    setConfirmOpen(false);
    if (online) {
      window.open(link, "_blank", "noopener,noreferrer");
      reportOrder({
        catalogId: catalog.id,
        catalogName: catalog.name,
        serviceName:
          valid.length === 1 ? valid[0].name : `${valid.length} servicios seleccionados`,
        total,
        items: valid.map((s) => ({ name: s.name, price: s.price })),
        message,
        link,
        recipient: recipientFromLink(link),
      });
      onClear();
      return;
    }
    enqueue({
      catalogId: catalog.id,
      catalogName: catalog.name,
      serviceName:
        valid.length === 1 ? valid[0].name : `${valid.length} servicios seleccionados`,
      price: total,
      message,
      link,
      items: valid.map((s) => ({ name: s.name, price: s.price })),
      recipient: recipientFromLink(link),
    });
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      /* el pedido ya quedó en la cola aunque no se pueda copiar */
    }
    onClear();
  };

  return (
    <>
      <div className="sticky bottom-3 z-30 mt-4">
        <div className="card-soft flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-card p-3 shadow-lg">
          <ShoppingCart className="size-4 shrink-0 text-primary" />
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            <strong className="text-card-foreground">{check.valid.length}</strong> válidos de{" "}
            {services.length} ·{" "}
            <strong className="text-primary">{formatMXN(check.total)}</strong>
            {check.issues.length ? (
              <span className="ml-1 inline-flex items-center gap-1 text-destructive">
                <AlertTriangle className="size-3.5" />
                {check.issues.length} aviso(s)
              </span>
            ) : null}
          </p>
          <Button size="sm" variant="outline" onClick={onClear}>
            <X className="size-4" />
            Quitar selección
          </Button>
          <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={!check.valid.length}>
            <MessageCircle className="size-4" />
            {online ? "Pedir seleccionados" : "Guardar pedido"}
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar pedido múltiple</DialogTitle>
            <DialogDescription>
              Revisa los servicios antes de {online ? "abrir WhatsApp" : "guardarlos en la cola"}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5 rounded-xl border border-border bg-muted/40 p-3 text-sm">
            {check.valid.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-muted-foreground">{s.name}</span>
                <span className="shrink-0 font-medium text-card-foreground">
                  {formatMXN(s.price)}
                </span>
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-2">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-bold text-primary">{formatMXN(check.total)}</span>
            </div>
          </div>

          {check.issues.length ? (
            <div className="grid gap-1 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
                <AlertTriangle className="size-4" />
                Avisos de la selección
              </p>
              {check.issues.map((issue) => (
                <p key={issue} className="text-xs text-destructive">
                  · {issue}
                </p>
              ))}
            </div>
          ) : null}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={!check.valid.length}>
              <MessageCircle className="size-4" />
              {online ? "Pedir por WhatsApp" : "Guardar en la cola"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
