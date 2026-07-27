import { Copy, Eye, EyeOff, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCatalogStore } from "@/lib/catalog/store";
import { buildWhatsappLink, formatMXN } from "@/lib/catalog/whatsapp";
import type { Service } from "@/lib/catalog/types";
import { ConfirmButton } from "./confirm-button";

export function ServiceCard({
  service,
  onEdit,
}: {
  service: Service;
  onEdit: (service: Service) => void;
}) {
  const { catalog, isAdmin, duplicateService, deleteService, toggleService } = useCatalogStore();
  const category = catalog.categories.find((c) => c.id === service.categoryId);
  const subsection = category?.subsections.find((s) => s.id === service.subsectionId);

  const meta = [
    service.devices ? `${service.devices} disp.` : null,
    service.profiles ? `${service.profiles} perfiles` : null,
    service.delivery,
    service.warranty ? `Garantía ${service.warranty}` : null,
  ].filter(Boolean) as string[];

  return (
    <article className="card-soft rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-card-foreground">{service.name}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {category ? <Badge variant="secondary">{category.name}</Badge> : null}
            {subsection ? <Badge variant="outline">{subsection.name}</Badge> : null}
            {!service.active ? <Badge variant="destructive">Oculto</Badge> : null}
          </div>
        </div>
        <p className="shrink-0 text-lg font-bold text-primary">{formatMXN(service.price)}</p>
      </div>

      {service.description ? (
        <p className="mt-2 text-sm text-muted-foreground">{service.description}</p>
      ) : null}

      {meta.length ? (
        <p className="mt-2 text-xs text-muted-foreground">{meta.join(" · ")}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild className="flex-1 min-w-[10rem]">
          <a
            href={buildWhatsappLink(service, catalog)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="size-4" />
            Pedir por WhatsApp
          </a>
        </Button>

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
