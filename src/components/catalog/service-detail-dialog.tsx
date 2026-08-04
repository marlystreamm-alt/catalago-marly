import { ArrowLeft, Link2, MessageCircle, Star } from "lucide-react";
import { toast } from "sonner";
import { reportOrder } from "@/lib/notify/client";
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
import { useCatalogStore } from "@/lib/catalog/store";
import {
  buildWhatsappLink,
  buildWhatsappMessage,
  displayPrice,
  serviceFacts,
} from "@/lib/catalog/whatsapp";
import { useOnline } from "@/hooks/use-online";
import { useOrderQueue } from "@/lib/catalog/order-queue";
import { buildServiceLink } from "@/lib/catalog/links";
import type { Service } from "@/lib/catalog/types";
import { isImageValue } from "@/lib/catalog/image";
import { resolveServiceMedia } from "@/lib/catalog/platforms";

/**
 * Detalle de un servicio, listo para "Pedir por WhatsApp".
 * Se abre solo cuando el enlace público trae el parámetro ?svc=<id>.
 */
export function ServiceDetailDialog({
  service,
  open,
  onOpenChange,
}: {
  service: Service | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { catalog } = useCatalogStore();
  const online = useOnline();
  const { enqueue } = useOrderQueue();

  if (!service) return null;

  const media = resolveServiceMedia(service);
  const category = catalog.categories.find((c) => c.id === service.categoryId);
  const subsection = category?.subsections.find((s) => s.id === service.subsectionId);
  const rows: [string, string][] = [
    ["Catálogo", catalog.name],
    ["Categoría", category?.name ?? "—"],
    ["Subsección", subsection?.name ?? "—"],
    ...serviceFacts(service).map((f) => [f.label, f.value.trim()] as [string, string]),
    ["Estado", service.active ? "Disponible" : "No disponible"],
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-md">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={() => {
              onOpenChange(false);
              if (window.history.length > 1) window.history.back();
            }}
          >
            <ArrowLeft className="size-4" />
            Atrás
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
          >
            Volver al catálogo
          </Button>
        </div>
        {media.icon ? (
          <div className="flex h-40 items-center justify-center overflow-hidden rounded-2xl bg-muted text-6xl ring-1 ring-border/60">
            {isImageValue(media.icon) ? (
              <img
                src={media.icon}
                alt={service.name}
                className="size-full object-cover"
                loading="lazy"
              />
            ) : (
              <span aria-hidden>{media.icon}</span>
            )}
          </div>
        ) : null}

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl tracking-tight">
            {service.name}
            {service.favorite ? <Star className="size-4 fill-primary text-primary" /> : null}
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            {media.description || "Detalle del servicio seleccionado."}
          </DialogDescription>
        </DialogHeader>

        <p className="text-4xl font-bold tracking-tight text-primary">{displayPrice(service)}</p>

        <dl className="grid gap-2 rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium text-card-foreground">{value}</dd>
            </div>
          ))}
        </dl>

        {!service.active ? (
          <Badge variant="destructive" className="w-fit rounded-full">
            Este servicio está oculto en el catálogo
          </Badge>
        ) : null}


        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => {
              const url = buildServiceLink(catalog.id, service.id);
              navigator.clipboard
                .writeText(url)
                .then(() => toast.success("Enlace del servicio copiado"))
                .catch(() => toast.error("No se pudo copiar el enlace"));
            }}
          >
            <Link2 className="size-4" />
            Copiar enlace
          </Button>
          {online ? (
            <Button asChild size="lg" className="flex-1 rounded-full shadow-sm">
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
              className="flex-1 rounded-full shadow-sm"
              onClick={() => {
                enqueue({
                  catalogId: catalog.id,
                  catalogName: catalog.name,
                  serviceName: service.name,
                  price: service.price,
                  message: buildWhatsappMessage(service, catalog),
                  link: buildWhatsappLink(service, catalog),
                });
              }}
            >
              <MessageCircle className="size-4" />
              Guardar pedido (sin conexión)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
