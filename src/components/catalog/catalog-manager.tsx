import { useState } from "react";
import { FolderPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmButton } from "./confirm-button";
import { useCatalogStore } from "@/lib/catalog/store";
import { CATALOG_IDS } from "@/lib/catalog/types";

/** Alta, baja y visibilidad de catálogos (solo administrador). */
export function CatalogManager() {
  const { isAdmin, state, allCatalogIds, addCatalog, deleteCatalog, toggleCatalogHidden } =
    useCatalogStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");

  if (!isAdmin) return null;

  const extras = allCatalogIds.filter((id) => !CATALOG_IDS.includes(id));

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <FolderPlus className="size-4" />
        Catálogos
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Catálogos</DialogTitle>
            <DialogDescription>
              Crea catálogos adicionales y decide cuáles ve el público.
            </DialogDescription>
          </DialogHeader>

          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              addCatalog({ name, subtitle });
              setName("");
              setSubtitle("");
              setOpen(false);
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="new-cat-name">Nombre</Label>
              <Input
                id="new-cat-name"
                value={name}
                placeholder="Mayoreo"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-cat-sub">Subtítulo</Label>
              <Input
                id="new-cat-sub"
                value={subtitle}
                placeholder="Precios especiales"
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!name.trim()}>
                Crear catálogo
              </Button>
            </DialogFooter>
          </form>

          {extras.length ? (
            <div className="grid gap-2 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">Catálogos creados por ti</p>
              {extras.map((id) => (
                <div key={id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm">{state.catalogs[id].name}</span>
                  <ConfirmButton
                    title={`¿Eliminar ${state.catalogs[id].name}?`}
                    description="Se borrarán sus servicios e historial."
                    confirmLabel="Eliminar"
                    onConfirm={() => deleteCatalog(id)}
                  >
                    <Button size="icon" variant="ghost" aria-label="Eliminar catálogo">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </ConfirmButton>
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid gap-2 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground">
              Mostrar u ocultar al público
            </p>
            {allCatalogIds.map((id) => (
              <div
                key={id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-card-foreground">
                    {state.catalogs[id].name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {state.catalogs[id].hidden ? "Oculto al público" : "Visible al público"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={state.catalogs[id].hidden ? "default" : "outline"}
                  className="shrink-0 rounded-xl"
                  onClick={() => toggleCatalogHidden(id)}
                >
                  {state.catalogs[id].hidden ? "Mostrar" : "Ocultar"}
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
