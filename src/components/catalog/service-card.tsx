import { copyText } from "@/lib/browser/clipboard";
import {
  Copy,
  Eye,
  EyeOff,
  Info,
  Link2,
  MessageCircle,
  Pencil,
  ShoppingCart,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
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
import { addToCart } from "@/lib/catalog/cart";
import { DirectoryMenuRequestDialog } from "./directory-menu-request-dialog";

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
  const {
    catalog,
    isAdmin,
    isClient,
    can,
    prefs,
    duplicateService,
    deleteService,
    toggleService,
    toggleFavorite,
  } = useCatalogStore();
  const online = useOnline();
  const allowWhatsapp = prefs.showWhatsapp && (!isClient || can("usarWhatsapp"));
  const allowFavorites = !isClient || can("usarFavoritos");
  const { enqueue } = useOrderQueue();
  const category = catalog.categories.find((c) => c.id === service.categoryId);
  const subsection = category?.subsections.find((s) => s.id === service.subsectionId);

  // Etiqueta fija + valor; los campos vacíos no se muestran.
  const facts = serviceFacts(service, catalog);
  const media = resolveServiceMedia(service);

  if (!isAdmin && !isClient) {
    const isDirectory = catalog.spaceType === "directory" || catalog.spaceType === "provider";
    return (
      <article data-public-service-card className="ma2-themed-card group flex min-w-0 flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-border/70 bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
        <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
          {media.icon && isImageValue(media.icon) ? (
            <img
              src={media.icon}
              alt={service.name}
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid size-full place-items-center text-7xl" aria-hidden>
              {media.icon || "🛍️"}
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col p-2.5 sm:p-4">
          <h3 className="break-words text-[15px] font-bold leading-tight text-card-foreground sm:text-lg">{service.name}</h3>
          <p className="mt-2 text-xl font-bold tracking-tight text-primary sm:text-2xl">
            {displayPrice(service)}
          </p>
          <div className="mt-auto grid grid-cols-1 gap-2 pt-3">
            {!isDirectory ? (
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="h-auto min-h-11 min-w-0 gap-1 whitespace-normal rounded-full px-2 py-2 text-xs leading-tight sm:text-sm"
                onClick={() => {
                  addToCart(service, catalog.id);
                  toast.success("Agregado al carrito");
                }}
              >
                <ShoppingCart className="size-4 shrink-0" />
                Agregar al carrito
              </Button>
            ) : null}
            {allowWhatsapp &&
            (catalog.whatsappNumber || (service.personalWhatsappEnabled && service.whatsapp)) ? (
              <Button asChild size="lg" className="h-auto min-h-11 min-w-0 gap-1 whitespace-normal rounded-full px-2 py-2 text-xs leading-tight sm:text-sm">
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
                      recipient: (service.personalWhatsappEnabled && service.whatsapp
                        ? service.whatsapp
                        : catalog.whatsappNumber || ""
                      ).replace(/\D/g, ""),
                    })
                  }
                >
                  <MessageCircle className="size-4 shrink-0" />
                  {isDirectory ? "WhatsApp" : "Pedir por WhatsApp"}
                </a>
              </Button>
            ) : null}
            {onOpenDetail && showDetail ? (
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="h-auto min-h-11 min-w-0 gap-1 whitespace-normal rounded-full px-2 py-2 text-xs leading-tight sm:text-sm"
                onClick={() => onOpenDetail(service.id)}
              >
                <Info className="size-4 shrink-0" />
                Ver más
              </Button>
            ) : null}
          </div>
          {isDirectory && (service.mapsUrl ?? service.vigencia)?.trim() ? (
            <Button asChild variant="ghost" className="mt-2 w-full rounded-full">
              <a
                href={(service.mapsUrl ?? service.vigencia)!.trim()}
                target="_blank"
                rel="noreferrer"
              >
                🗺️ Ver ubicación
              </a>
            </Button>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article
      className={`ma2-themed-card card-soft group relative overflow-hidden rounded-3xl border bg-card p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg sm:p-5 ${
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
            {allowFavorites ? (
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
            ) : null}
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
            {service.favorite ? <Badge className="rounded-full font-medium">Favorito</Badge> : null}
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
        {!(catalog.spaceType === "directory" || catalog.spaceType === "provider") ? (
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="flex-1 min-w-[10rem] rounded-full"
            onClick={() => {
              addToCart(service, catalog.id);
              toast.success("Agregado al carrito");
            }}
          >
            <ShoppingCart className="size-4" />
            Agregar al carrito
          </Button>
        ) : (
          <>
            {(service.mapsUrl ?? service.vigencia)?.trim() ? (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="flex-1 min-w-[10rem] rounded-full"
              >
                <a
                  href={(service.mapsUrl ?? service.vigencia)!.trim()}
                  target="_blank"
                  rel="noreferrer"
                >
                  🗺️ Ver ubicación
                </a>
              </Button>
            ) : null}
            {service.linkedMenuUrl ? (
              <Button asChild size="lg" className="flex-1 min-w-[10rem] rounded-full">
                <a href={service.linkedMenuUrl} target="_blank" rel="noreferrer">
                  <Sparkles className="size-4" />✨ Visita su espacio
                </a>
              </Button>
            ) : null}
            {!isAdmin ? <DirectoryMenuRequestDialog catalog={catalog} service={service} /> : null}
          </>
        )}
        {allowWhatsapp &&
        (catalog.whatsappNumber ||
          ((catalog.spaceType === "directory" || catalog.spaceType === "provider") &&
            service.personalWhatsappEnabled &&
            service.whatsapp)) ? (
          online ? (
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
                {catalog.spaceType === "directory" || catalog.spaceType === "provider"
                  ? "WhatsApp"
                  : "Pedir por WhatsApp"}
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
                  await copyText(message);
                } catch {
                  /* el pedido ya quedó en la cola aunque no se pueda copiar */
                }
              }}
            >
              <MessageCircle className="size-4" />
              Guardar pedido (sin conexión)
            </Button>
          )
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {onOpenDetail && showDetail ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => onOpenDetail(service.id)}
            >
              <Info className="size-4" />
              Ver más
            </Button>
          ) : null}
          {showShare ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                const url = buildServiceLink(catalog.id, service.id);
                copyText(url)
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
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => onEdit(service)}
            >
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
