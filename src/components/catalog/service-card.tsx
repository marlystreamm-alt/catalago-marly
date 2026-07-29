import { Copy, Eye, EyeOff, Info, Link2, MessageCircle, Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCatalogStore } from "@/lib/catalog/store";
import { buildWhatsappLink, buildWhatsappMessage, formatMXN } from "@/lib/catalog/whatsapp";
import { buildServiceLink } from "@/lib/catalog/links";
import { useOnline } from "@/hooks/use-online";
import { useOrderQueue } from "@/lib/catalog/order-queue";
import type { Service } from "@/lib/catalog/types";
import { ConfirmButton } from "./confirm-button";


export function ServiceCard({
  service,
  onEdit,
  onOpenDetail,
  selected,
  onToggleSelect,
}: {
  service: Service;
  onEdit: (service: Service) => void;
  onOpenDetail?: (id: string) => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const { catalog, isAdmin, duplicateService, deleteService, toggleService, toggleFavorite } =
    useCatalogStore();
  const online = useOnline();
  const { enqueue } = useOrderQueue();
  const category = catalog.categories.find((c) => c.id === service.categoryId);
  const subsection = category?.subsections.find((s) => s.id === service.subsectionId);


  const meta = [
    service.devices ? `${service.devices} disp.` : null,
    service.profiles ? `${service.profiles} perfiles` : null,
    service.delivery,
    service.warranty ? `Garantía ${service.warranty}` : null,
  ].filter(Boolean) as string[];

  return (
    <article
      className={`card-soft rounded-2xl border bg-card p-4 ${
        selected ? "border-primary ring-2 ring-primary/30" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {onToggleSelect ? (
            <input
              type="checkbox"
              className="mt-1 size-4 shrink-0 accent-primary"
              checked={!!selected}
              aria-label={`Seleccionar ${service.name}`}
              onChange={() => onToggleSelect(service.id)}
            />
          ) : null}
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-card-foreground">
              {service.name}
            </h3>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {category ? <Badge variant="secondary">{category.name}</Badge> : null}
              {subsection ? <Badge variant="outline">{subsection.name}</Badge> : null}
              {!service.active ? <Badge variant="destructive">Oculto</Badge> : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <p className="text-lg font-bold text-primary">{formatMXN(service.price)}</p>
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={service.favorite}
            aria-label={service.favorite ? "Quitar de favoritos" : "Marcar como favorito"}
            onClick={() => toggleFavorite(service.id)}
          >
            <Star
              className={`size-5 ${service.favorite ? "fill-primary text-primary" : "text-muted-foreground"}`}
            />
          </Button>
        </div>
      </div>

      {service.description ? (
        <p className="mt-2 text-sm text-muted-foreground">{service.description}</p>
      ) : null}

      {meta.length ? (
        <p className="mt-2 text-xs text-muted-foreground">{meta.join(" · ")}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {online ? (
          <Button asChild className="flex-1 min-w-[10rem]">
            <a href={buildWhatsappLink(service, catalog)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4" />
              Pedir por WhatsApp
            </a>
          </Button>
        ) : (
          <Button
            className="flex-1 min-w-[10rem]"
            onClick={async () => {
              const message = buildWhatsappMessage(service, catalog);
              enqueue({
                catalogId: catalog.id,
                catalogName: catalog.name,
                serviceName: service.name,
                price: service.price,
                message,
                link: buildWhatsappLink(service, catalog),
              });
              try {
                await navigator.clipboard.writeText(message);
              } catch {
                /* el pedido ya quedó en la cola aunque no se pueda copiar */
              }
            }}
          >
            <MessageCircle className="size-4" />
            Guardar pedido (sin conexión)
          </Button>
        )}

        <div className="flex flex-wrap gap-1.5">
          {onOpenDetail ? (
            <Button variant="outline" size="sm" onClick={() => onOpenDetail(service.id)}>
              <Info className="size-4" />
              Ver detalle
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const url = buildServiceLink(catalog.id, service.id);
              navigator.clipboard
                .writeText(url)
                .then(() => toast.success("Enlace del servicio copiado"))
                .catch(() => toast.error("No se pudo copiar el enlace"));
            }}
          >
            <Link2 className="size-4" />
            Compartir
          </Button>
        </div>



        {isAdmin ? (
          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" onClick={() => onEdit(service)}>
              <Pencil className="size-4" />
              Editar
            </Button>
            <Button variant="outline" size="sm" onClick={() => duplicateService(service.id)}>
              <Copy className="size-4" />
              Duplicar
            </Button>
            <Button variant="outline" size="sm" onClick={() => toggleService(service.id)}>
              {service.active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              {service.active ? "Desactivar" : "Activar"}
            </Button>
            <ConfirmButton
              title={`¿Eliminar ${service.name}?`}
              description="Esta acción no se puede deshacer."
              confirmLabel="Eliminar"
              onConfirm={() => deleteService(service.id)}
            >
              <Button variant="outline" size="sm">
                <Trash2 className="size-4 text-destructive" />
                Eliminar
              </Button>
            </ConfirmButton>
          </div>
        ) : null}
      </div>
    </article>
  );
}
