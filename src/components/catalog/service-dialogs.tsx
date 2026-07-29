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

type Errors = Partial<
  Record<"name" | "price" | "devices" | "profiles" | "delivery" | "warranty" | "description", string>
>;

/** Validaciones de negocio para el formulario de servicio. */
export function validateService(form: Omit<Service, "id">): Errors {
  const errors: Errors = {};
  const name = form.name.trim();
  if (!name) errors.name = "El nombre es obligatorio.";
  else if (name.length > 80) errors.name = "Máximo 80 caracteres.";

  const price = Number(form.price);
  if (!Number.isFinite(price)) errors.price = "Escribe un precio válido en MXN.";
  else if (price <= 0) errors.price = "El precio debe ser mayor a $0.00 MXN.";
  else if (price > 100000) errors.price = "El precio no puede superar $100,000 MXN.";
  else if (Math.round(price * 100) !== price * 100)
    errors.price = "Usa como máximo dos decimales (centavos).";

  const numField = (value: string, label: string) => {
    const v = value.trim();
    if (!v) return undefined;
    if (!/^\d+$/.test(v)) return `${label} debe ser un número entero.`;
    const n = Number(v);
    if (n < 1 || n > 50) return `${label} debe estar entre 1 y 50.`;
    return undefined;
  };
  errors.devices = numField(form.devices, "Dispositivos");
  errors.profiles = numField(form.profiles, "Perfiles");

  if (!form.delivery.trim()) errors.delivery = "Indica el tiempo de entrega.";
  if (!form.warranty.trim()) errors.warranty = "Indica la garantía.";
  if (form.description.length > 300) errors.description = "Máximo 300 caracteres.";

  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as Errors;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs font-medium text-destructive">
      {message}
    </p>
  );
}

const invalid = "border-destructive focus-visible:ring-destructive/40";

export function ServiceFormDialog({
  open,
  onOpenChange,
  service,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  service: Service | null;
}) {
  const { catalog, isAdmin, saveService } = useCatalogStore();
  const [form, setForm] = useState<Omit<Service, "id"> & { id?: string }>(() =>
    emptyService(catalog.categories[0]?.id ?? "otros"),
  );
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setTouched(false);
    setForm(service ? { ...service } : emptyService(catalog.categories[0]?.id ?? "otros"));
  }, [open, service, catalog.categories]);

  const category = catalog.categories.find((c) => c.id === form.categoryId);

  const update = (patch: Partial<Omit<Service, "id">>) => {
    const next = { ...form, ...patch };
    setForm(next);
    if (touched) setErrors(validateService(next));
  };

  const submit = () => {
    const found = validateService(form);
    setTouched(true);
    setErrors(found);
    if (Object.keys(found).length) return;
    saveService({ ...form, name: form.name.trim(), price: Number(form.price) });
    onOpenChange(false);
  };

  if (!isAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{service ? "Editar servicio" : "Agregar servicio"}</DialogTitle>
          <DialogDescription>Catálogo: {catalog.name}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="sv-name">Nombre *</Label>
            <Input
              id="sv-name"
              aria-invalid={!!errors.name}
              className={errors.name ? invalid : undefined}
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
            />
            <FieldError message={errors.name} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sv-price">Precio (MXN) *</Label>
              <Input
                id="sv-price"
                type="number"
                min="1"
                step="0.01"
                inputMode="decimal"
                aria-invalid={!!errors.price}
                className={errors.price ? invalid : undefined}
                value={String(form.price)}
                onChange={(e) => update({ price: Number(e.target.value) })}
              />
              <FieldError message={errors.price} />
            </div>
            <div className="grid gap-1.5">
              <Label>Categoría</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => update({ categoryId: v, subsectionId: null })}
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
              onValueChange={(v) => update({ subsectionId: v === NONE ? null : v })}
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
              maxLength={320}
              aria-invalid={!!errors.description}
              className={errors.description ? invalid : undefined}
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
            />
            <FieldError message={errors.description} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sv-dev">Dispositivos</Label>
              <Input
                id="sv-dev"
                inputMode="numeric"
                placeholder="1"
                aria-invalid={!!errors.devices}
                className={errors.devices ? invalid : undefined}
                value={form.devices}
                onChange={(e) => update({ devices: e.target.value })}
              />
              <FieldError message={errors.devices} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sv-prof">Perfiles</Label>
              <Input
                id="sv-prof"
                inputMode="numeric"
                placeholder="1"
                aria-invalid={!!errors.profiles}
                className={errors.profiles ? invalid : undefined}
                value={form.profiles}
                onChange={(e) => update({ profiles: e.target.value })}
              />
              <FieldError message={errors.profiles} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sv-del">Tiempo de entrega *</Label>
              <Input
                id="sv-del"
                aria-invalid={!!errors.delivery}
                className={errors.delivery ? invalid : undefined}
                value={form.delivery}
                onChange={(e) => update({ delivery: e.target.value })}
              />
              <FieldError message={errors.delivery} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sv-war">Garantía *</Label>
              <Input
                id="sv-war"
                aria-invalid={!!errors.warranty}
                className={errors.warranty ? invalid : undefined}
                value={form.warranty}
                onChange={(e) => update({ warranty: e.target.value })}
              />
              <FieldError message={errors.warranty} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2">
            <Label htmlFor="sv-active">Activo</Label>
            <Switch
              id="sv-active"
              checked={form.active}
              onCheckedChange={(v) => update({ active: v })}
            />
          </div>
          {touched && Object.keys(errors).length ? (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              Revisa los campos marcados antes de guardar.
            </p>
          ) : null}
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
  const { catalog, isAdmin, updateCatalog } = useCatalogStore();
  const [name, setName] = useState(catalog.name);
  const [subtitle, setSubtitle] = useState(catalog.subtitle);
  const [number, setNumber] = useState(catalog.whatsappNumber);
  const [template, setTemplate] = useState(catalog.whatsappTemplate);
  const [errors, setErrors] = useState<{ name?: string; number?: string; template?: string }>({});

  useEffect(() => {
    if (!open) return;
    setName(catalog.name);
    setSubtitle(catalog.subtitle);
    setNumber(catalog.whatsappNumber);
    setTemplate(catalog.whatsappTemplate);
    setErrors({});
  }, [open, catalog]);

  const submit = () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = "El nombre del catálogo es obligatorio.";
    else if (name.trim().length > 40) next.name = "Máximo 40 caracteres.";
    const digits = number.replace(/\D/g, "");
    if (!digits) next.number = "Escribe el número de WhatsApp con lada.";
    else if (digits.length < 10 || digits.length > 15)
      next.number = "El número debe tener entre 10 y 15 dígitos.";
    if (!template.trim()) next.template = "La plantilla no puede quedar vacía.";
    else if (!template.includes("{servicio}"))
      next.template = "La plantilla debe incluir la variable {servicio}.";

    setErrors(next);
    if (Object.keys(next).length) return;

    updateCatalog({
      name: name.trim(),
      subtitle: subtitle.trim(),
      whatsappNumber: digits,
      whatsappTemplate: template,
    });
    onOpenChange(false);
  };

  if (!isAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajustes del catálogo</DialogTitle>
          <DialogDescription>Nombre, subtítulo y configuración de WhatsApp.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="cat-name">Nombre del catálogo *</Label>
            <Input
              id="cat-name"
              aria-invalid={!!errors.name}
              className={errors.name ? invalid : undefined}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <FieldError message={errors.name} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cat-sub">Subtítulo</Label>
            <Input id="cat-sub" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cat-wa">Número de WhatsApp (con lada, solo dígitos) *</Label>
            <Input
              id="cat-wa"
              inputMode="tel"
              aria-invalid={!!errors.number}
              className={errors.number ? invalid : undefined}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="5215512345678"
            />
            <FieldError message={errors.number} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cat-tpl">Plantilla del mensaje *</Label>
            <Textarea
              id="cat-tpl"
              rows={3}
              aria-invalid={!!errors.template}
              className={errors.template ? invalid : undefined}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            />
            <FieldError message={errors.template} />
            <p className="text-xs text-muted-foreground">
              Variables: {"{servicio}"} {"{precio}"} {"{detalles}"} {"{catalogo}"}
            </p>
          </div>
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
