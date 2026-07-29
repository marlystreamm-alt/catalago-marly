import { MessageCircle, ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCatalogStore } from "@/lib/catalog/store";
import { useOrderQueue } from "@/lib/catalog/order-queue";
import { useOnline } from "@/hooks/use-online";
import {
  buildBulkWhatsappLink,
  buildBulkWhatsappMessage,
  formatMXN,
} from "@/lib/catalog/whatsapp";
import type { Service } from "@/lib/catalog/types";

/** Barra fija para pedir varias plataformas seleccionadas en un solo mensaje. */
export function BulkOrderBar({
  services,
  onClear,
}: {
  services: Service[];
  onClear: () => void;
}) {
  const { catalog } = useCatalogStore();
  const { enqueue } = useOrderQueue();
  const online = useOnline();

  if (!services.length) return null;
  const total = services.reduce((sum, s) => sum + s.price, 0);

  const handleOrder = async () => {
    const message = buildBulkWhatsappMessage(services, catalog);
    const link = buildBulkWhatsappLink(services, catalog);
    if (online) {
      window.open(link, "_blank", "noopener,noreferrer");
      onClear();
      return;
    }
    enqueue({
      catalogId: catalog.id,
      catalogName: catalog.name,
      serviceName: `${services.length} servicios seleccionados`,
      price: total,
      message,
      link,
    });
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      /* el pedido ya quedó en la cola aunque no se pueda copiar */
    }
    onClear();
  };

  return (
    <div className="sticky bottom-3 z-30 mt-4">
      <div className="card-soft flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-card p-3 shadow-lg">
        <ShoppingCart className="size-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          <strong className="text-card-foreground">{services.length}</strong> seleccionados ·{" "}
          <strong className="text-primary">{formatMXN(total)}</strong>
        </p>
        <Button size="sm" variant="outline" onClick={onClear}>
          <X className="size-4" />
          Quitar selección
        </Button>
        <Button size="sm" onClick={handleOrder}>
          <MessageCircle className="size-4" />
          {online ? "Pedir seleccionados" : "Guardar pedido"}
        </Button>
      </div>
    </div>
  );
}
