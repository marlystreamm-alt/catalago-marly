import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, BookOpen, Copy, CopyPlus, Eye, EyeOff, FolderPlus, ImagePlus, LayoutGrid, MapPinned, Save, Trash2, UsersRound, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ConfirmButton } from "./confirm-button";
import { useCatalogStore } from "@/lib/catalog/store";
import { SPACE_TYPE_LABELS, type SpaceType } from "@/lib/catalog/types";

const TYPES: Array<{ id: SpaceType; label: string; help: string; icon: typeof LayoutGrid }> = [
  { id: "catalog", label: "Catálogo", help: "Productos o servicios con categorías y subcategorías.", icon: LayoutGrid },
  { id: "menu", label: "Menú", help: "Platillos o productos con precio, foto, extras y disponibilidad.", icon: BookOpen },
  { id: "directory", label: "Directorio telefónico", help: "Fichas de personas o negocios con teléfono y contacto.", icon: MapPinned },
  { id: "provider", label: "Directorio de proveedores", help: "Fichas de proveedores con servicio, contacto y notas.", icon: UsersRound },
  { id: "marketplace", label: "Mercadito", help: "Productos nuevos o usados que el cliente puede publicar y vender por WhatsApp.", icon: Store },
];

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}


function SpaceEditorRow({ id, index, total }: { id: string; index: number; total: number }) {
  const { state, updateCatalogMeta, toggleCatalogHidden, moveCatalog, deleteCatalog, duplicateCatalog } = useCatalogStore();
  const item = state.catalogs[id];
  const [draftName, setDraftName] = useState(item.name);
  const [draftSubtitle, setDraftSubtitle] = useState(item.subtitle);
  const [draftType, setDraftType] = useState<SpaceType>(item.spaceType);

  useEffect(() => {
    setDraftName(item.name);
    setDraftSubtitle(item.subtitle);
    setDraftType(item.spaceType);
  }, [item.name, item.subtitle, item.spaceType]);

  const dirty = draftName.trim() !== item.name || draftSubtitle !== item.subtitle || draftType !== item.spaceType;
  return (
    <div className="grid gap-2 rounded-2xl border border-border bg-card p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_13rem]">
        <div className="grid gap-1">
          <Label>Nombre de la pestaña</Label>
          <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label>Tipo</Label>
          <Select value={draftType} onValueChange={(value) => setDraftType(value as SpaceType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="catalog">Catálogo</SelectItem>
              <SelectItem value="menu">Menú</SelectItem>
              <SelectItem value="directory">Directorio telefónico</SelectItem><SelectItem value="provider">Directorio de proveedores</SelectItem><SelectItem value="marketplace">Mercadito</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-1">
        <Label>Descripción o subtítulo</Label>
        <Input value={draftSubtitle} onChange={(e) => setDraftSubtitle(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" disabled={!dirty || !draftName.trim()} onClick={() => updateCatalogMeta(id, { name: draftName.trim(), subtitle: draftSubtitle, spaceType: draftType })}>
          <Save className="size-4" /> Guardar nombre y tipo
        </Button>
        {(item.spaceType === "directory" || item.spaceType === "provider") ? <div className="flex items-center gap-2 rounded-xl border px-3 py-1.5"><Switch checked={item.commercialFieldsEnabled !== false} onCheckedChange={(v) => updateCatalogMeta(id, { commercialFieldsEnabled: v })} /><span className="text-xs">Datos comerciales para clientes</span></div> : null}
        <Button size="sm" variant="outline" onClick={() => toggleCatalogHidden(id)}>
          {item.hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          {item.hidden ? "Mostrar" : "Ocultar"}
        </Button>
        <Button size="icon" variant="ghost" disabled={index === 0} aria-label="Mover arriba" onClick={() => moveCatalog(id, -1)}><ArrowUp className="size-4" /></Button>
        <Button size="icon" variant="ghost" disabled={index === total - 1} aria-label="Mover abajo" onClick={() => moveCatalog(id, 1)}><ArrowDown className="size-4" /></Button>
        <Button size="sm" variant="outline" onClick={() => duplicateCatalog(id)}><CopyPlus className="size-4" />Duplicar</Button>
        <Button size="sm" variant="outline" onClick={async () => {
          const url = `${window.location.origin}/?cat=${encodeURIComponent(id)}`;
          try { await navigator.clipboard.writeText(url); toast.success("Link para cliente copiado"); }
          catch { window.prompt("Copia este enlace", url); }
        }}><Copy className="size-4" />Enlace público</Button>
        <span className="ml-auto text-xs text-muted-foreground">{item.hidden ? "Oculto" : "Visible"}</span>
        <ConfirmButton title={`¿Eliminar ${item.name}?`} description="Se eliminarán sus tarjetas e historial. Debe quedar al menos un espacio." confirmLabel="Eliminar" onConfirm={() => deleteCatalog(id)}>
          <Button size="icon" variant="ghost" disabled={total <= 1} aria-label="Eliminar espacio"><Trash2 className="size-4 text-destructive" /></Button>
        </ConfirmButton>
      </div>
    </div>
  );
}

/** Un único administrador de espacios: crear, renombrar, ordenar, ocultar, compartir y eliminar. */
export function CatalogManager() {
  const { isAdmin, state, allCatalogIds, addCatalog, deleteCatalog, toggleCatalogHidden, updateCatalogMeta, moveCatalog } = useCatalogStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [spaceType, setSpaceType] = useState<SpaceType>("catalog");
  const [imageUrl, setImageUrl] = useState("");

  if (!isAdmin) return null;

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <FolderPlus className="size-4" />
        Espacios
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pestañas y espacios</DialogTitle>
            <DialogDescription>
              Aquí se administran todas las pestañas. Ya no hay una lista separada de pestañas antiguas y nuevas.
            </DialogDescription>
          </DialogHeader>

          <form
            className="grid gap-4 rounded-2xl border border-border bg-muted/20 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              addCatalog({ name, subtitle, spaceType, imageUrl });
              setName("");
              setSubtitle("");
              setSpaceType("catalog");
              setImageUrl("");
            }}
          >
            <div className="grid gap-2">
              <Label>Crear nuevo espacio</Label>
              <div className="grid gap-2 sm:grid-cols-4">
                {TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setSpaceType(type.id)}
                      className={`rounded-2xl border p-3 text-left transition ${spaceType === type.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}
                    >
                      <Icon className="mb-2 size-5 text-primary" />
                      <p className="text-sm font-semibold">{type.label}</p>
                      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{type.help}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="new-cat-name">Nombre del negocio o espacio</Label>
                <Input id="new-cat-name" value={name} placeholder="Mi negocio" onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Imagen principal o logo (opcional)</Label>
                <div className="flex items-center gap-2">
                  <Input type="file" accept="image/*" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 1_500_000) { alert("La imagen debe pesar menos de 1.5 MB"); e.currentTarget.value = ""; return; }
                    setImageUrl(await fileToDataUrl(file));
                  }} />
                  {imageUrl ? <img src={imageUrl} alt="Vista previa" className="size-12 rounded-xl border object-cover" /> : <ImagePlus className="size-5 text-muted-foreground" />}
                </div>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-cat-sub">Descripción o subtítulo</Label>
              <Textarea id="new-cat-sub" value={subtitle} placeholder="Describe brevemente este espacio" onChange={(e) => setSubtitle(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!name.trim()}>Crear {SPACE_TYPE_LABELS[spaceType]}</Button>
            </DialogFooter>
          </form>

          <div className="grid gap-2 border-t border-border pt-4">
            <div>
              <p className="text-sm font-semibold">Tus espacios</p>
              <p className="text-xs text-muted-foreground">Puedes renombrarlos, cambiar su tipo, ordenarlos, ocultarlos o eliminarlos desde aquí.</p>
            </div>

            {allCatalogIds.map((id, index) => (
              <SpaceEditorRow key={id} id={id} index={index} total={allCatalogIds.length} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
