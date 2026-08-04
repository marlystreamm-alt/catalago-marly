import { Copy, Eye, EyeOff, Info, Link2, MessageCircle, Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCatalogStore } from "@/lib/catalog/store";
import {
  buildWhatsappLink,
  buildWhatsappMessage,
  displayPrice,
  serviceFacts,
} from "@/lib/catalog/whatsapp";
import { buildServiceLink } from "@/lib/catalog/links";
import { useOnline } from "@/hooks/use-online";
import { useOrderQueue } from "@/lib/catalog/order-queue";
import { reportOrder } from "@/lib/notify/client";
import type { Service } from "@/lib/catalog/types";
import { isImageValue } from "@/lib/catalog/image";
import { resolveServiceMedia } from "@/lib/catalog/platforms";
import { ConfirmButton } from "./confirm-button";


export function ServiceCard({
  service,
  onEdit,
  onOpenDetail,
  selected,
  onToggleSelect,
  showDetail = true,
  showShare = true,
}: {
  service: Service;
  onEdit: (service: Service) => void;
  onOpenDetail?: (id: string) => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  showDetail?: boolean;
  showShare?: boolean;
}) {
  const { catalog, isAdmin, duplicateService, deleteService, toggleService, toggleFavorite } =
    useCatalogStore();
  const online = useOnline();
  const { enqueue } = useOrderQueue();
  const category = catalog.categories.find((c) => c.id === service.categoryId);
  const subsection = category?.subsections.find((s) => s.id === service.subsectionId);


  // Etiqueta fija + valor; los campos vacíos no se muestran.
  const facts = serviceFacts(service);
  const media = resolveServiceMedia(service);

  return (
    <article
      className={`card-soft group relative overflow-hidden rounded-3xl border bg-card p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg sm:p-5 ${
        selected ? "border-primary ring-2 ring-primary/30" : "border-border/70"
      } ${!service.active ? "opacity-80" : ""}`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        {onToggleSelect ? (
          <input
            type="checkbox"
            className="mt-2 size-4 shrink-0 accent-primary"
            checked={!!selected}
            aria-label={`Seleccionar ${service.name}`}
            onChange={() => onToggleSelect(service.id)}
          />
        ) : null}

        {media.icon ? (
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted text-3xl ring-1 ring-border/60 sm:size-24 sm:text-4xl">
            {isImageValue(media.icon) ? (
              <img
                src={media.icon}
                alt={service.name}
                loading="lazy"
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <span aria-hidden>{media.icon}</span>
            )}
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 text-[15px] font-semibold leading-tight tracking-tight text-balance text-card-foreground sm:text-lg">
              {service.name}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="-mr-1.5 -mt-1 shrink-0 rounded-full transition-transform hover:scale-110"
              aria-pressed={service.favorite}
              aria-label={service.favorite ? "Quitar de favoritos" : "Marcar como favorito"}
              onClick={() => toggleFavorite(service.id)}
            >
              <Star
                className={`size-5 ${service.favorite ? "fill-primary text-primary" : "text-muted-foreground"}`}
              />
            </Button>
          </div>

          <p className="mt-1 text-xl font-bold tracking-tight text-primary sm:text-2xl">
            {displayPrice(service)}
          </p>


          <div className="mt-2 flex flex-wrap gap-1.5">
            {category ? (
              <Badge variant="secondary" className="rounded-full font-medium">
                {category.name}
              </Badge>
            ) : null}
            {subsection ? (
              <Badge variant="outline" className="rounded-full font-medium">
                {subsection.name}
              </Badge>
            ) : null}
            {service.favorite ? (
              <Badge className="rounded-full font-medium">Favorito</Badge>
            ) : null}
            {!service.active ? (
              <Badge variant="destructive" className="rounded-full font-medium">
                Oculto
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {media.description ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{media.description}</p>
      ) : null}

      {facts.length ? (
        <dl className="mt-3 grid gap-1.5 rounded-2xl bg-muted/50 p-3 text-xs sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.label} className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="text-right font-medium text-card-foreground">{f.value.trim()}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {online ? (
          <Button asChild size="lg" className="flex-1 min-w-[10rem] rounded-full shadow-sm">
            <a
              href={buildWhatsappLink(service, catalog)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                reportOrder({
                  catalogId: catalog.id,
                  catalogName: catalog.name,
                  serviceName: service.name,
                  total: service.price,
                  items: [{ name: service.name, price: service.price }],
                  message: buildWhatsappMessage(service, catalog),
                  link: buildWhatsappLink(service, catalog),
                  recipient: (catalog.whatsappNumber || "").replace(/\D/g, ""),
                })
              }
            >
              <MessageCircle className="size-4" />
              Pedir por WhatsApp
            </a>
          </Button>
        ) : (
          <Button
            size="lg"
            className="flex-1 min-w-[10rem] rounded-full shadow-sm"
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
          {onOpenDetail && showDetail ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => onOpenDetail(service.id)}
            >
              <Info className="size-4" />
              Ver detalle
            </Button>
          ) : null}
          {showShare ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
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
          ) : null}
        </div>

        {isAdmin ? (
          <div className="mt-1 flex w-full flex-wrap gap-1.5 border-t border-border/60 pt-3">
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => onEdit(service)}>
              <Pencil className="size-4" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => duplicateService(service.id)}
            >
              <Copy className="size-4" />
              Duplicar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => toggleService(service.id)}
            >
              {service.active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              {service.active ? "Desactivar" : "Activar"}
            </Button>
            <ConfirmButton
              title={`¿Eliminar ${service.name}?`}
              description="Esta acción no se puede deshacer."
              confirmLabel="Eliminar"
              onConfirm={() => deleteService(service.id)}
            >
              <Button variant="outline" size="sm" className="rounded-full">
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
