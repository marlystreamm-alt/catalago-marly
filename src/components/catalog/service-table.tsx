import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, MessageCircle, Pencil, Star, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCatalogStore } from "@/lib/catalog/store";
import { buildWhatsappLink, formatMXN } from "@/lib/catalog/whatsapp";
import type { Service } from "@/lib/catalog/types";

/** Vista de tabla: plataforma + precio, editable en línea para el administrador. */
export function ServiceTable({
  services,
  selectedIds = [],
  onToggleSelect,
}: {
  services: Service[];
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
}) {
  const { catalog, isAdmin, saveService, toggleService, toggleFavorite } = useCatalogStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftPrice, setDraftPrice] = useState("");

  useEffect(() => {
    if (!isAdmin) setEditingId(null);
  }, [isAdmin]);

  const startEdit = (s: Service) => {
    setEditingId(s.id);
    setDraftName(s.name);
    setDraftPrice(String(s.price));
  };

  const commit = (s: Service) => {
    const name = draftName.trim();
    const price = Number(draftPrice);
    if (!name) {
      toast.error("El nombre no puede quedar vacío");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Precio inválido: usa un número en MXN");
      return;
    }
    saveService({ ...s, name, price });
    setEditingId(null);
  };

  if (!services.length) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card/70 p-8 text-center text-sm text-muted-foreground">
        No hay servicios que coincidan con tu búsqueda.
      </p>
    );
  }

  return (
    <div className="card-soft overflow-hidden rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">Plataformas y precios de {catalog.name}</caption>
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left">
            {onToggleSelect ? <th className="w-8 p-2" aria-label="Seleccionar" /> : null}
            <th className="p-2 font-semibold">Plataforma</th>
            <th className="p-2 text-right font-semibold">Precio</th>
            <th className="w-24 p-2 text-right font-semibold">Acción</th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => {
            const editing = editingId === s.id;
            return (
              <tr key={s.id} className="border-b border-border last:border-0 align-middle">
                {onToggleSelect ? (
                  <td className="p-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={selectedIds.includes(s.id)}
                      aria-label={`Seleccionar ${s.name}`}
                      onChange={() => onToggleSelect(s.id)}
                    />
                  </td>
                ) : null}
                <td className="p-2">
                  {editing ? (
                    <Input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      aria-label={`Nombre de ${s.name}`}
                      className="h-8"
                    />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={s.favorite ? "Quitar de favoritos" : "Marcar como favorito"}
                        onClick={() => toggleFavorite(s.id)}
                      >
                        <Star
                          className={`size-4 ${s.favorite ? "fill-primary text-primary" : "text-muted-foreground"}`}
                        />
                      </button>
                      <span className="font-medium text-card-foreground">{s.name}</span>
                      {!s.active ? (
                        <span className="text-xs text-destructive">(oculto)</span>
                      ) : null}
                    </div>
                  )}
                </td>
                <td className="p-2 text-right">
                  {editing ? (
                    <Input
                      value={draftPrice}
                      inputMode="decimal"
                      onChange={(e) => setDraftPrice(e.target.value)}
                      aria-label={`Precio de ${s.name}`}
                      className="h-8 text-right"
                    />
                  ) : (
                    <span className="font-bold text-primary">{formatMXN(s.price)}</span>
                  )}
                </td>
                <td className="p-2">
                  <div className="flex items-center justify-end gap-1">
                    {isAdmin ? (
                      editing ? (
                        <>
                          <Button size="icon" variant="ghost" aria-label="Guardar" onClick={() => commit(s)}>
                            <Check className="size-4 text-primary" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Cancelar"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="size-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Editar ${s.name}`}
                            onClick={() => startEdit(s)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={s.active ? `Desactivar ${s.name}` : `Activar ${s.name}`}
                            onClick={() => toggleService(s.id)}
                          >
                            {s.active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </Button>
                        </>
                      )
                    ) : null}
                    {!editing ? (
                      <Button asChild size="icon" variant="ghost">
                        <a
                          href={buildWhatsappLink(s, catalog)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Pedir ${s.name} por WhatsApp`}
                        >
                          <MessageCircle className="size-4 text-primary" />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
