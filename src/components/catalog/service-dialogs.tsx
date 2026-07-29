import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCatalogStore } from "@/lib/catalog/store";
import type { Service } from "@/lib/catalog/types";

const NONE = "__none__";

const emptyService = (categoryId: string): Omit<Service, "id"> => ({
  name: "",
  price: 0,
  categoryId,
  subsectionId: null,
  description: "",
  devices: "",
  profiles: "",
  delivery: "Inmediato (5 a 30 min)",
  warranty: "30 días",
  active: true,
  favorite: false,
});

export function ServiceFormDialog({
  open,
  onOpenChange,
  service,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  service: Service | null;
}) {
  const { catalog, saveService } = useCatalogStore();
  const [form, setForm] = useState<Omit<Service, "id"> & { id?: string }>(() =>
    emptyService(catalog.categories[0]?.id ?? "otros"),
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(service ? { ...service } : emptyService(catalog.categories[0]?.id ?? "otros"));
  }, [open, service, catalog.categories]);

  const category = catalog.categories.find((c) => c.id === form.categoryId);

  const submit = () => {
    if (!form.name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!Number.isFinite(form.price) || form.price < 0) {
      setError("El precio debe ser un número válido.");
      return;
    }
    saveService({ ...form, name: form.name.trim() });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{service ? "Editar servicio" : "Agregar servicio"}</DialogTitle>
          <DialogDescription>Catálogo: {catalog.name}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="sv-name">Nombre</Label>
            <Input
              id="sv-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sv-price">Precio (MXN)</Label>
              <Input
                id="sv-price"
                type="number"
                inputMode="decimal"
                value={String(form.price)}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Categoría</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => setForm({ ...form, categoryId: v, subsectionId: null })}
              >
                <SelectTrigger aria-label="Categoría">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {catalog.categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Subsección</Label>
            <Select
              value={form.subsectionId ?? NONE}
              onValueChange={(v) => setForm({ ...form, subsectionId: v === NONE ? null : v })}
              disabled={!category?.subsections.length}
            >
              <SelectTrigger aria-label="Subsección">
                <SelectValue placeholder="Sin subsección" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin subsección</SelectItem>
                {category?.subsections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sv-desc">Descripción</Label>
            <Textarea
              id="sv-desc"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sv-dev">Dispositivos</Label>
              <Input
                id="sv-dev"
                value={form.devices}
                onChange={(e) => setForm({ ...form, devices: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sv-prof">Perfiles</Label>
              <Input
                id="sv-prof"
                value={form.profiles}
                onChange={(e) => setForm({ ...form, profiles: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sv-del">Tiempo de entrega</Label>
              <Input
                id="sv-del"
                value={form.delivery}
                onChange={(e) => setForm({ ...form, delivery: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sv-war">Garantía</Label>
              <Input
                id="sv-war"
                value={form.warranty}
                onChange={(e) => setForm({ ...form, warranty: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2">
            <Label htmlFor="sv-active">Activo</Label>
            <Switch
              id="sv-active"
              checked={form.active}
              onCheckedChange={(v) => setForm({ ...form, active: v })}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CatalogSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { catalog, updateCatalog } = useCatalogStore();
  const [name, setName] = useState(catalog.name);
  const [subtitle, setSubtitle] = useState(catalog.subtitle);
  const [number, setNumber] = useState(catalog.whatsappNumber);
  const [template, setTemplate] = useState(catalog.whatsappTemplate);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(catalog.name);
    setSubtitle(catalog.subtitle);
    setNumber(catalog.whatsappNumber);
    setTemplate(catalog.whatsappTemplate);
    setError("");
  }, [open, catalog]);

  const submit = () => {
    if (!name.trim()) {
      setError("El nombre del catálogo es obligatorio.");
      return;
    }
    const digits = number.replace(/\D/g, "");
    if (digits && digits.length < 10) {
      setError("El número de WhatsApp debe tener al menos 10 dígitos.");
      return;
    }
    updateCatalog({
      name: name.trim(),
      subtitle: subtitle.trim(),
      whatsappNumber: digits,
      whatsappTemplate: template,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajustes del catálogo</DialogTitle>
          <DialogDescription>Nombre, subtítulo y configuración de WhatsApp.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="cat-name">Nombre del catálogo</Label>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cat-sub">Subtítulo</Label>
            <Input id="cat-sub" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cat-wa">Número de WhatsApp (con lada, solo dígitos)</Label>
            <Input
              id="cat-wa"
              inputMode="tel"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="5215512345678"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cat-tpl">Plantilla del mensaje</Label>
            <Textarea
              id="cat-tpl"
              rows={3}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Variables: {"{servicio}"} {"{precio}"} {"{detalles}"} {"{catalogo}"}
            </p>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
