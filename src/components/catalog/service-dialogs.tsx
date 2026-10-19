import { ImageLibraryPicker } from "@/components/catalog/image-library-picker";
import { useEffect, useRef, useState } from "react";
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
import { isImageValue } from "@/lib/catalog/image";
import { saveLibraryImage } from "@/lib/image-library";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const NONE = "__none__";

const emptyService = (categoryId: string): Omit<Service, "id"> => ({
  name: "",
  price: 0,
  categoryId,
  subsectionId: null,
  description: "",
  devices: "",
  profiles: "",
  delivery: "",
  warranty: "",
  active: true,
  favorite: false,
  whatsapp: "",
  personalWhatsappEnabled: false,
  whatsappMessage: "",
  serviceDays: "",
  businessHours: "",
  address: "",
  mapsUrl: "",
  homeDelivery: false,
  paymentMethods: [],
  customFields: [],
});

type Errors = Partial<
  Record<
    "name" | "price" | "devices" | "profiles" | "delivery" | "warranty" | "description",
    string
  >
>;

/** Solo el nombre es obligatorio; los demás campos son texto libre y pueden ir vacíos. */
export function validateService(form: Omit<Service, "id">): Errors {
  const errors: Errors = {};
  const name = form.name.trim();
  if (!name) errors.name = "El nombre es obligatorio.";
  else if (name.length > 80) errors.name = "Máximo 80 caracteres.";

  const price = Number(form.price);
  if (!Number.isFinite(price)) errors.price = "Escribe un precio válido en MXN.";
  else if (price < 0) errors.price = "El precio no puede ser negativo.";

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
  const photoInputRef = useRef<HTMLInputElement>(null);

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
          <DialogTitle>{service ? "Editar" : "Agregar"} {catalog.spaceType === "menu" ? "platillo o producto" : catalog.spaceType === "directory" ? "contacto" : catalog.spaceType === "provider" ? "proveedor" : catalog.spaceType === "marketplace" ? "producto" : "producto o servicio"}</DialogTitle>
          <DialogDescription>Catálogo: {catalog.name}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="sv-name">{catalog.spaceType === "menu" ? "Nombre del platillo o producto" : catalog.spaceType === "directory" ? "Nombre del contacto" : catalog.spaceType === "provider" ? "Nombre del proveedor" : catalog.spaceType === "marketplace" ? "Producto" : "Nombre"} *</Label>
            <Input
              id="sv-name"
              aria-invalid={!!errors.name}
              className={errors.name ? invalid : undefined}
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
            />
            <FieldError message={errors.name} />
          </div>
          {catalog.spaceType === "catalog" && (catalog.sectionTabs?.length ?? 0) > 0 ? (
            <div className="grid gap-1.5">
              <Label>Sección del catálogo</Label>
              <Select value={form.sectionId ?? catalog.sectionTabs?.[0]?.id ?? ""} onValueChange={(v) => update({ sectionId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona sección" /></SelectTrigger>
                <SelectContent>{(catalog.sectionTabs ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sv-price">Precio (MXN)</Label>
              <Input
                id="sv-price"
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
            <Label>{catalog.spaceType === "menu" ? "Subcategoría / sección" : "Subsección"}</Label>
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
          {catalog.spaceType === "marketplace" ? <div className="grid gap-1.5"><Label>Estado</Label><Select value={form.plan || "Nuevo"} onValueChange={(v)=>update({plan:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Nuevo">Nuevo</SelectItem><SelectItem value="Usado">Usado</SelectItem></SelectContent></Select></div> : null}
          <div className="grid gap-1.5">
            <Label htmlFor="sv-desc">{catalog.spaceType === "menu" ? "Descripción / ingredientes" : catalog.spaceType === "directory" ? "Descripción del negocio" : "Descripción"}</Label>
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
          <div className="grid gap-2 rounded-2xl border border-border bg-muted/25 p-3">
            <Label>Fotografía de la tarjeta</Label>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.currentTarget.value = "";
                if (!file) return;
                try {
                  const saved = await saveLibraryImage(file);
                  update({ icon: saved.dataUrl });
                  toast.success("Fotografía guardada en Supabase");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "No se pudo cargar la fotografía");
                }
              }}
            />
            <Input value={form.icon ?? ""} onChange={(e) => update({ icon: e.target.value })} placeholder="Pega aquí un link de imagen o usa la galería" />
              <ImageLibraryPicker current={form.icon ?? ""} onSelect={(url) => update({ icon: url })} />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => photoInputRef.current?.click()}>
                <ImagePlus className="size-4" />
                Subir desde galería
              </Button>
              {form.icon ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => update({ icon: "" })}>
                  <Trash2 className="size-4" />
                  Quitar foto
                </Button>
              ) : null}
            </div>
            {form.icon ? (
              <div className="flex items-center gap-3">
                <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted text-3xl">
                  {isImageValue(form.icon) ? <img src={form.icon} alt="Vista previa" className="size-full object-cover" /> : <span>{form.icon}</span>}
                </div>
                <p className="text-xs text-muted-foreground">Esta fotografía será la que aparezca en la tarjeta pública.</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">En teléfono se abrirá el selector de fotos/galería del dispositivo.</p>
            )}
          </div>
          {catalog.spaceType === "catalog" && ["clientes", "cyberdoc", "revendedores"].includes(catalog.id) ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label htmlFor="sv-dev">Dispositivos</Label><Input id="sv-dev" value={form.devices} onChange={(e) => update({ devices: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label htmlFor="sv-prof">Perfiles</Label><Input id="sv-prof" value={form.profiles} onChange={(e) => update({ profiles: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label htmlFor="sv-del">Tiempo de entrega</Label><Input id="sv-del" value={form.delivery} onChange={(e) => update({ delivery: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label htmlFor="sv-war">Garantía</Label><Input id="sv-war" value={form.warranty} onChange={(e) => update({ warranty: e.target.value })} /></div>
            </div>
          ) : catalog.spaceType === "menu" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Presentación / extras</Label><Input value={form.plan ?? ""} onChange={(e) => update({ plan: e.target.value })} placeholder="Tamaño, extras…" /></div>
              <div className="grid gap-1.5"><Label>Tiempo de preparación</Label><Input value={form.delivery} onChange={(e) => update({ delivery: e.target.value })} placeholder="15 min…" /></div>
              <div className="col-span-2 grid gap-1.5"><Label>Disponibilidad / horario</Label><Input value={form.vigencia ?? ""} onChange={(e) => update({ vigencia: e.target.value })} placeholder="Disponible hoy, 9:00–18:00…" /></div>
            </div>
          ) : ((catalog.spaceType === "directory" || catalog.spaceType === "provider") && catalog.commercialFieldsEnabled !== false) ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>{catalog.spaceType === "provider" ? "Servicio / especialidad" : "Categoría / tipo"}</Label><Input value={form.plan ?? ""} onChange={(e) => update({ plan: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>{catalog.spaceType === "provider" ? "Teléfono / contacto" : "Teléfono"}</Label><Input value={form.users ?? ""} onChange={(e) => update({ users: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Días de servicio</Label><Input value={form.serviceDays ?? ""} onChange={(e) => update({ serviceDays: e.target.value })} placeholder="Martes a domingo" /></div>
              <div className="grid gap-1.5"><Label>Horario</Label><Input value={form.businessHours ?? form.delivery ?? ""} onChange={(e) => update({ businessHours: e.target.value, delivery: "" })} placeholder="8:45 am - 1:30 pm" /></div>
              <div className="grid gap-1.5"><Label>📍 Dirección</Label><Input value={form.address ?? form.requirements ?? ""} onChange={(e) => update({ address: e.target.value, requirements: "" })} placeholder="Calle, número, colonia…" /></div>
              <div className="grid gap-1.5"><Label>🗺️ Ubicación en Maps</Label><Input value={form.mapsUrl ?? form.vigencia ?? ""} onChange={(e) => update({ mapsUrl: e.target.value, vigencia: "" })} placeholder="https://maps.google.com/…" /></div>
              <div className="col-span-2 grid gap-2 rounded-2xl border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div><Label>🛵 Servicio a domicilio</Label><p className="text-xs text-muted-foreground">Actívalo únicamente si el negocio cuenta con entrega a domicilio.</p></div>
                  <Switch checked={form.homeDelivery === true} onCheckedChange={(v) => update({ homeDelivery: v })} />
                </div>
                <div>
                  <Label>Métodos de pago</Label>
                  <p className="mb-2 text-xs text-muted-foreground">Activa solo los que acepta este negocio.</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      ["cash", "💵 Efectivo"],
                      ["transfer", "📲 Transferencia"],
                      ["card", "💳 Tarjeta"],
                    ].map(([key, label]) => {
                      const methods = form.paymentMethods ?? [];
                      const enabled = methods.includes(key as "cash" | "transfer" | "card");
                      return <label key={key} className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
                        <span>{label}</span>
                        <Switch checked={enabled} onCheckedChange={(v) => update({ paymentMethods: v ? [...methods, key as "cash" | "transfer" | "card"] : methods.filter((m) => m !== key) })} />
                      </label>;
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Tipo / modalidad</Label><Input value={form.plan ?? ""} onChange={(e) => update({ plan: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Entrega / disponibilidad</Label><Input value={form.delivery} onChange={(e) => update({ delivery: e.target.value })} /></div>
              <div className="col-span-2 grid gap-1.5"><Label>Vigencia / duración</Label><Input value={form.vigencia ?? ""} onChange={(e) => update({ vigencia: e.target.value })} /></div>
            </div>
          )}
          <div className="grid gap-2 rounded-2xl border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <div><Label>Campos adicionales</Label><p className="text-xs text-muted-foreground">Agrega los espacios que necesite esta tarjeta.</p></div>
              <Button type="button" size="sm" variant="outline" onClick={() => update({ customFields: [...(form.customFields ?? []), { id: `cf-${Date.now()}`, label: "", value: "", visible: true }] })}><Plus className="size-4" />Agregar campo</Button>
            </div>
            {(form.customFields ?? []).map((field, index) => (
              <div key={field.id} className="grid gap-2 rounded-xl border bg-card p-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center">
                <Input placeholder="Nombre del campo" value={field.label} onChange={(e) => update({ customFields: (form.customFields ?? []).map((x,i) => i===index ? {...x,label:e.target.value} : x) })} />
                <Input placeholder="Contenido" value={field.value} onChange={(e) => update({ customFields: (form.customFields ?? []).map((x,i) => i===index ? {...x,value:e.target.value} : x) })} />
                <label className="flex items-center gap-2 text-xs"><Switch checked={field.visible !== false} onCheckedChange={(v) => update({ customFields: (form.customFields ?? []).map((x,i) => i===index ? {...x,visible:v} : x) })} />Mostrar</label>
                <Button type="button" size="icon" variant="ghost" onClick={() => update({ customFields: (form.customFields ?? []).filter((_,i) => i!==index) })}><Trash2 className="size-4" /></Button>
              </div>
            ))}
          </div>
          {(catalog.spaceType === "directory" || catalog.spaceType === "provider") ? <div className="grid gap-3 rounded-2xl border border-border bg-muted/30 p-3 sm:grid-cols-2">
            <div className="sm:col-span-2 flex items-center justify-between rounded-xl border bg-card px-3 py-2">
              <div><Label>Enlazar WhatsApp de esta tarjeta</Label><p className="text-xs text-muted-foreground">Actívalo para que esta persona o proveedor tenga su propio botón de WhatsApp.</p></div>
              <Switch checked={form.personalWhatsappEnabled === true} onCheckedChange={(v) => update({ personalWhatsappEnabled: v })} />
            </div>
            {form.personalWhatsappEnabled ? <>
              <div className="grid gap-1.5">
                <Label htmlFor="sv-wa">Número de WhatsApp de esta tarjeta</Label>
                <Input id="sv-wa" inputMode="tel" value={form.whatsapp ?? ""} placeholder="521844…" onChange={(e) => update({ whatsapp: e.target.value })} />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="sv-wa-msg">Mensaje de esta ficha</Label>
                <Textarea id="sv-wa-msg" rows={2} value={form.whatsappMessage ?? ""} placeholder="Hola, vi tu ficha en el directorio…" onChange={(e) => update({ whatsappMessage: e.target.value })} />
              </div>
            </> : null}
          </div> : null}
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
  const { catalog, isAdmin, updateCatalog, prefs, setPrefs } = useCatalogStore();
  const [name, setName] = useState(catalog.name);
  const [subtitle, setSubtitle] = useState(catalog.subtitle);
  const [number, setNumber] = useState(catalog.whatsappNumber);
  const [template, setTemplate] = useState(catalog.whatsappTemplate);
  const [individualWhatsappEnabled, setIndividualWhatsappEnabled] = useState(catalog.individualWhatsappEnabled);
  const [themeMode, setThemeMode] = useState(prefs.themeMode);
  const [accentColor, setAccentColor] = useState(prefs.accentColor);
  const [backgroundStyle, setBackgroundStyle] = useState(prefs.backgroundStyle);
  const [errors, setErrors] = useState<{ name?: string; number?: string; template?: string }>({});

  useEffect(() => {
    if (!open) return;
    setName(catalog.name);
    setSubtitle(catalog.subtitle);
    setNumber(catalog.whatsappNumber);
    setTemplate(catalog.whatsappTemplate);
    setIndividualWhatsappEnabled(catalog.individualWhatsappEnabled);
    setThemeMode(prefs.themeMode);
    setAccentColor(prefs.accentColor);
    setBackgroundStyle(prefs.backgroundStyle);
    setErrors({});
  }, [open, catalog, prefs.themeMode, prefs.accentColor, prefs.backgroundStyle]);

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
      individualWhatsappEnabled: false,
    });
    setPrefs({ themeMode, accentColor, backgroundStyle });
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

          <div className="rounded-2xl border border-border bg-muted/30 p-3">
            <div className="mb-3">
              <p className="text-sm font-semibold">Apariencia</p>
              <p className="text-xs text-muted-foreground">
                Recuperado de la versión independiente de Mis Clientes. Se guarda por catálogo en este dispositivo.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Modo</Label>
                <Select value={themeMode} onValueChange={(v) => setThemeMode(v as "claro" | "oscuro")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claro">Modo claro</SelectItem>
                    <SelectItem value="oscuro">Modo oscuro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cat-accent">Color principal</Label>
                <Input
                  id="cat-accent"
                  type="color"
                  className="h-10 p-1"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Fondo</Label>
                <Select value={backgroundStyle} onValueChange={(v) => setBackgroundStyle(v as "degradado" | "solido" | "suave")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="degradado">Fondo degradado</SelectItem>
                    <SelectItem value="solido">Fondo sólido</SelectItem>
                    <SelectItem value="suave">Fondo suave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                className="sm:col-span-2"
                onClick={() => {
                  setThemeMode("claro");
                  setAccentColor("#8b5cf6");
                  setBackgroundStyle("degradado");
                }}
              >
                Restablecer diseño
              </Button>
            </div>
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
