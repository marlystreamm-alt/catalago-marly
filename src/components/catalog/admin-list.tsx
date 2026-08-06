import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  ImagePlus,
  Lock,
  Pencil,
  Plus,

  RotateCcw,
  Save,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findPlatform } from "@/lib/catalog/platforms";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmButton } from "./confirm-button";
import { useCatalogStore } from "@/lib/catalog/store";
import { displayPrice, formatMXN, serviceFacts } from "@/lib/catalog/whatsapp";
import { fileToCompressedDataUrl, isImageValue } from "@/lib/catalog/image";
import type { Service } from "@/lib/catalog/types";

type TabKey = "perfiles" | "completas" | "tramites";

const TABS: { key: TabKey; label: string }[] = [
  { key: "perfiles", label: "Perfiles" },
  { key: "completas", label: "Completas" },
  { key: "tramites", label: "Trámites" },
];

/** El precio se edita como texto libre; si aún no existe se parte del monto en MXN. */
const fromCatalog = (services: Service[]): Service[] =>
  services.map((s) => ({
    ...s,
    priceText: s.priceText ?? (s.price ? formatMXN(s.price) : ""),
  }));

const EXPANDED_KEY = "ma2-admin-expandidos-v1";

/** El estado expandido/colapsado de cada fila se recuerda por catálogo en el dispositivo. */
function loadExpanded(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(EXPANDED_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return {};
    const map: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(value)) map[key] = value.filter((v): v is string => typeof v === "string");
    }
    return map;
  } catch (error) {
    console.error("No se pudo leer el estado de las filas:", error);
    return {};
  }
}

function saveExpanded(map: Record<string, string[]>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EXPANDED_KEY, JSON.stringify(map));
  } catch (error) {
    console.error("No se pudo guardar el estado de las filas:", error);
  }
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

/** Campo de texto libre con etiqueta fija: acepta números, palabras, rangos y símbolos. */
function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <Input
        className="h-9"
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/** Control para insertar una imagen (archivo o URL) o un emoji para la tarjeta. */
function ImageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasImage = isImageValue(value);

  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-dashed border-border p-2">
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-xl">
        {hasImage ? (
          <img src={value} alt="Imagen del servicio" className="size-full object-cover" />
        ) : (
          <span>{value || "🖼️"}</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            onChange(await fileToCompressedDataUrl(file));
            toast.success("Imagen insertada");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "No se pudo insertar la imagen");
          }
        }}
      />
      <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
        <ImagePlus className="size-4" />
        Insertar imagen
      </Button>
      <Input
        className="h-9 min-w-[9rem] flex-1"
        type="text"
        aria-label="Imagen (URL) o emoji"
        placeholder="URL de imagen o emoji 🎬"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        <Button size="sm" variant="ghost" onClick={() => onChange("")}>
          Quitar
        </Button>
      ) : null}
    </div>
  );
}

/** Tarjeta de solo lectura que refleja cómo se verá el servicio en el catálogo público. */
function PreviewCard({ service, categoryName }: { service: Service; categoryName?: string }) {
  const meta = serviceFacts(service).map((f) => `${f.label}: ${f.value.trim()}`);
  return (
    <article className="card-soft w-[15rem] shrink-0 rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        {service.icon ? (
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-xl">
            {isImageValue(service.icon) ? (
              <img src={service.icon} alt="" className="size-full object-cover" />
            ) : (
              <span aria-hidden>{service.icon}</span>
            )}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold text-card-foreground">
            {service.name || "Sin nombre"}
          </h4>
          <div className="mt-1 flex flex-wrap gap-1">
            {categoryName ? (
              <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
                {categoryName}
              </span>
            ) : null}
            {!service.active ? (
              <span className="rounded-md bg-destructive px-1.5 py-0.5 text-[10px] text-destructive-foreground">
                Oculto
              </span>
            ) : null}
          </div>
        </div>
        <p className="shrink-0 text-sm font-bold text-primary">{displayPrice(service)}</p>
      </div>
      {(service.description || findPlatform(service.name)?.description) ? (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          {service.description || findPlatform(service.name)?.description}
        </p>
      ) : null}
      {meta.length ? (
        <p className="mt-1 line-clamp-3 text-[11px] text-muted-foreground">{meta.join(" · ")}</p>
      ) : null}
      <div className="mt-2 rounded-lg bg-primary/10 px-2 py-1 text-center text-[11px] font-medium text-primary">
        Pedir por WhatsApp
      </div>
    </article>
  );
}

/** Campos que la clienta puede tocar, según sus permisos. */
const EDITABLE_FIELDS: { perm: Parameters<ReturnType<typeof useCatalogStore>["can"]>[0]; label: string }[] = [
  { perm: "editNombre", label: "Nombre" },
  { perm: "editPrecio", label: "Precio" },
  { perm: "editDescripcion", label: "Descripción" },
  { perm: "editImagen", label: "Imagen" },
  { perm: "editDetalles", label: "Detalles" },
  { perm: "editEstado", label: "Activar/ocultar" },
  { perm: "agregarServicio", label: "Agregar" },
  { perm: "eliminarServicio", label: "Eliminar" },
];

/** Etiqueta pequeña que marca un campo como editable o bloqueado. */
function FieldFlag({ editable, show }: { editable: boolean; show: boolean }) {
  if (!show) return null;
  return editable ? (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
      <Pencil className="size-3" />
      Editable
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      <Lock className="size-3" />
      Bloqueado
    </span>
  );
}

/** Estilo de campo bloqueado: fondo apagado y borde punteado. */
const lockedStyle = (editable: boolean) =>
  editable ? "" : "border-dashed bg-muted/60 text-muted-foreground";


export function AdminList() {
  const { catalog, canEdit, can, replaceServices, isClient } = useCatalogStore();
  const [tab, setTab] = useState<TabKey>("perfiles");
  const [rows, setRows] = useState<Service[]>(() => fromCatalog(catalog.services));
  const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "activos" | "ocultos">("todos");
  const [selected, setSelected] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(true);
  const [expandedMap, setExpandedMap] = useState<Record<string, string[]>>(() => loadExpanded());
  const expanded = expandedMap[catalog.id] ?? [];
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // La lista siempre parte de los mismos datos del catálogo público.
  useEffect(() => {
    if (dirtyRef.current) return;
    setRows(fromCatalog(catalog.services));
  }, [catalog.services, catalog.id]);

  // Recupera lo guardado al montar (evita desajustes de hidratación en SSR).
  useEffect(() => {
    setExpandedMap(loadExpanded());
  }, []);

  useEffect(() => {
    setDirty(false);
    setSelected([]);
    setRows(fromCatalog(catalog.services));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog.id]);

  const tabOf = (s: Service): TabKey => {
    const category = catalog.categories.find((c) => c.id === s.categoryId);
    const sub = category?.subsections.find((x) => x.id === s.subsectionId)?.name.toLowerCase() ?? "";
    const plan = (s.plan ?? "").toLowerCase();
    if (sub.includes("perfil") || plan.includes("perfil")) return "perfiles";
    if (sub.includes("complet") || plan.includes("complet")) return "completas";
    return "tramites";
  };

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((s) => {
      if (tabOf(s) !== tab) return false;
      if (statusFilter === "activos" && !s.active) return false;
      if (statusFilter === "ocultos" && s.active) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        (s.plan ?? "").toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, tab, query, statusFilter, catalog.categories]);

  const counts = useMemo(() => {
    const base: Record<TabKey, number> = { perfiles: 0, completas: 0, tramites: 0 };
    rows.forEach((s) => (base[tabOf(s)] += 1));
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, catalog.categories]);

  if (!canEdit) return null;

  const patch = (id: string, changes: Partial<Service>) => {
    setDirty(true);
    setRows((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)));
  };

  const move = (id: string, dir: -1 | 1) => {
    setDirty(true);
    setRows((prev) => {
      const index = prev.findIndex((s) => s.id === id);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const addRow = () => {
    const category = catalog.categories[0];
    const sub =
      category?.subsections.find((x) =>
        tab === "perfiles"
          ? x.name.toLowerCase().includes("perfil")
          : tab === "completas"
            ? x.name.toLowerCase().includes("complet")
            : false,
      ) ?? null;
    const row: Service = {
      id: newId(),
      name: "",
      price: 0,
      priceText: "",
      categoryId: category?.id ?? "otros",
      subsectionId: sub?.id ?? null,
      description: "",
      devices: "",
      profiles: "",
      users: "",
      delivery: "",
      warranty: "",
      vigencia: "",
      requirements: "",
      plan: tab === "perfiles" ? "Perfil" : tab === "completas" ? "Completa" : "",
      icon: "",
      active: true,
      favorite: false,
    };
    setDirty(true);
    setRows((prev) => [row, ...prev]);
  };

  const duplicateRow = (id: string) => {
    setDirty(true);
    setRows((prev) => {
      const index = prev.findIndex((s) => s.id === id);
      if (index < 0) return prev;
      const copy: Service = { ...prev[index], id: newId(), name: `${prev[index].name} (copia)` };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const removeRows = (ids: string[]) => {
    setDirty(true);
    setRows((prev) => prev.filter((s) => !ids.includes(s.id)));
    setSelected((prev) => prev.filter((id) => !ids.includes(id)));
  };

  const setActive = (ids: string[], active: boolean) => {
    setDirty(true);
    setRows((prev) => prev.map((s) => (ids.includes(s.id) ? { ...s, active } : s)));
  };

  const saveAll = () => {
    const withoutName = rows.filter((s) => !s.name.trim());
    if (withoutName.length) {
      toast.error("Cada servicio necesita un nombre antes de guardar");
      return;
    }
    const clean = rows.map((s) => {
      const text = (s.priceText ?? "").trim();
      const numeric = Number(text.replace(/[^\d.,-]/g, "").replace(/,/g, ""));
      return {
        ...s,
        name: s.name.trim(),
        priceText: text || undefined,
        price: text && Number.isFinite(numeric) ? numeric : s.price,
      };
    });
    replaceServices(clean, `Se guardaron ${clean.length} servicio(s) desde la vista lista`);
    setDirty(false);
    toast.success("Cambios guardados");
  };

  const discard = () => {
    setRows(fromCatalog(catalog.services));
    setSelected([]);
    setDirty(false);
    toast.success("Cambios descartados");
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleExpand = (id: string) =>
    setExpandedMap((prev) => {
      const current = prev[catalog.id] ?? [];
      const next = {
        ...prev,
        [catalog.id]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
      };
      saveExpanded(next);
      return next;
    });

  return (
    <section className="grid min-w-0 max-w-full gap-3" aria-label="Vista lista del administrador">
      <div className="grid gap-1.5 rounded-2xl bg-muted p-1 sm:grid-cols-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-current={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-xl px-2 py-2 text-xs font-semibold transition-colors ${
              tab === t.key
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      {isClient ? (
        <div className="card-soft grid gap-2 rounded-2xl border border-primary/25 bg-primary/5 p-3">
          <p className="text-xs font-semibold text-foreground">Qué puedes editar en tu menú</p>
          <div className="flex flex-wrap gap-1.5">
            {EDITABLE_FIELDS.map((f) => (
              <span
                key={f.perm}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${
                  can(f.perm)
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground line-through decoration-muted-foreground/50"
                }`}
              >
                {can(f.perm) ? <Pencil className="size-3" /> : <Lock className="size-3" />}
                {f.label}
              </span>
            ))}
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Los campos con candado están bloqueados por MA². Aunque los veas, no se guardarán
            cambios en ellos.
          </p>
        </div>
      ) : null}



      <div className="card-soft flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar en la lista…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar en la lista"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-[10rem]" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="activos">Solo activos</SelectItem>
            <SelectItem value="ocultos">Solo desactivados</SelectItem>
          </SelectContent>
        </Select>
        {can("agregarServicio") ? (
          <Button size="sm" variant="outline" onClick={addRow}>
            <Plus className="size-4" />
            Agregar fila
          </Button>
        ) : null}
        {can("editEstado") ? (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={!selected.length}
              onClick={() => setActive(selected, true)}
            >
              <Eye className="size-4" />
              Activar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!selected.length}
              onClick={() => setActive(selected, false)}
            >
              <EyeOff className="size-4" />
              Desactivar
            </Button>
          </>
        ) : null}
        {can("eliminarServicio") ? (
        <ConfirmButton
          title={`¿Eliminar ${selected.length} servicio(s)?`}
          description="Se quitarán de la lista y del catálogo al guardar los cambios."
          confirmLabel="Eliminar"
          onConfirm={() => removeRows(selected)}
        >
          <Button size="sm" variant="outline" disabled={!selected.length}>
            <Trash2 className="size-4 text-destructive" />
            Eliminar seleccionados
          </Button>
        </ConfirmButton>
        ) : null}
        <Button size="sm" variant="outline" onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {showPreview ? "Ocultar vista previa" : "Ver vista previa"}
        </Button>
      </div>

      {showPreview ? (
        <div
          className="card-soft min-w-0 max-w-full overflow-hidden rounded-2xl border border-border bg-card/70 p-3"
          aria-label="Vista previa en tarjetas"
        >
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            Vista previa en vivo ({visibleRows.length}) — se actualiza mientras editas
          </p>
          {visibleRows.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin servicios que mostrar.</p>
          ) : (
            <div className="flex snap-x gap-3 overflow-x-auto pb-1">
              {visibleRows.map((s) => (
                <PreviewCard
                  key={s.id}
                  service={s}
                  categoryName={catalog.categories.find((c) => c.id === s.categoryId)?.name}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}


      <div className="grid min-w-0 max-w-full gap-3">
        {visibleRows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/70 p-8 text-center text-sm text-muted-foreground">
            No hay servicios en esta pestaña con los filtros actuales.
          </p>
        ) : (
          visibleRows.map((s) => (
            <article
              key={s.id}
              className={`card-soft rounded-2xl border bg-card p-3 ${
                selected.includes(s.id) ? "border-primary ring-2 ring-primary/30" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-primary"
                  checked={selected.includes(s.id)}
                  aria-label={`Seleccionar ${s.name || "servicio"}`}
                  onChange={() => toggleSelect(s.id)}
                />
                <button
                  type="button"
                  aria-label={s.favorite ? "Quitar destacado" : "Destacar"}
                  onClick={() => patch(s.id, { favorite: !s.favorite })}
                  className="shrink-0 p-1"
                >
                  <Star
                    className={`size-4 ${s.favorite ? "fill-primary text-primary" : "text-muted-foreground"}`}
                  />
                </button>
                <div className="relative min-w-0 flex-1">
                  <Input
                    className={`h-9 w-full min-w-0 font-semibold ${lockedStyle(can("editNombre"))}`}
                    type="text"
                    aria-label="Nombre"
                    title={can("editNombre") ? undefined : "Campo bloqueado por permisos"}
                    placeholder={tab === "tramites" ? "Nombre del trámite" : "Nombre de plataforma"}
                    value={s.name}
                    readOnly={!can("editNombre")}
                    onChange={(e) => patch(s.id, { name: e.target.value })}
                  />
                  {isClient && !can("editNombre") ? (
                    <Lock className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  ) : null}
                </div>
                {can("verPrecios") ? (
                  <div className="relative w-24 shrink-0">
                    <Input
                      className={`h-9 w-full text-right font-semibold text-primary ${lockedStyle(can("editPrecio"))}`}
                      type="text"
                      aria-label="Precio"
                      title={can("editPrecio") ? undefined : "Campo bloqueado por permisos"}
                      placeholder="$45"
                      value={s.priceText ?? ""}
                      readOnly={!can("editPrecio")}
                      onChange={(e) => patch(s.id, { priceText: e.target.value })}
                    />
                    {isClient && !can("editPrecio") ? (
                      <Lock className="pointer-events-none absolute left-1.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    ) : null}
                  </div>
                ) : null}

                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0"
                  aria-label={expanded.includes(s.id) ? "Ocultar más datos" : "Más datos"}
                  aria-expanded={expanded.includes(s.id)}
                  onClick={() => toggleExpand(s.id)}
                >
                  <ChevronDown
                    className={`size-4 transition-transform ${expanded.includes(s.id) ? "rotate-180" : ""}`}
                  />
                </Button>
              </div>

              {expanded.includes(s.id) ? (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    {can("editImagen") ? (
                      <ImageField value={s.icon ?? ""} onChange={(icon) => patch(s.id, { icon })} />
                    ) : isClient ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                        <Lock className="size-3" />
                        Imagen bloqueada
                      </span>
                    ) : null}



                    {can("editEstado") ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => patch(s.id, { active: !s.active })}
                      >
                        {s.active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        {s.active ? "Desactivar" : "Activar"}
                      </Button>
                    ) : null}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Subir"
                      onClick={() => move(s.id, -1)}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Bajar"
                      onClick={() => move(s.id, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    {can("agregarServicio") ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Duplicar fila"
                        onClick={() => duplicateRow(s.id)}
                      >
                        <Copy className="size-4" />
                      </Button>
                    ) : null}
                    {can("eliminarServicio") ? (
                    <ConfirmButton
                      title={`¿Eliminar ${s.name || "este servicio"}?`}
                      description="Se quitará al guardar los cambios."
                      confirmLabel="Eliminar"
                      onConfirm={() => removeRows([s.id])}
                    >
                      <Button size="icon" variant="ghost" aria-label="Eliminar fila">
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </ConfirmButton>
                    ) : null}
                  </div>

                  {can("editDetalles") ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {tab === "tramites" ? (
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium text-muted-foreground">Categoría</span>
                        <Select
                          value={s.categoryId}
                          onValueChange={(v) => patch(s.id, { categoryId: v })}
                        >
                          <SelectTrigger className="h-9">
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
                      </label>
                    ) : (
                      <TextField
                        label={tab === "completas" ? "Tipo de cuenta o plan" : "Plan o modalidad"}
                        value={s.plan ?? ""}
                        onChange={(v) => patch(s.id, { plan: v })}
                        placeholder="Completa, 1 perfil…"
                      />
                    )}
                    <TextField
                      label="Tiempo de entrega"
                      value={s.delivery}
                      onChange={(v) => patch(s.id, { delivery: v })}
                      placeholder="20 a 25 min…"
                    />
                    {tab !== "tramites" ? (
                      <>
                        <TextField
                          label="Dispositivos"
                          value={s.devices}
                          onChange={(v) => patch(s.id, { devices: v })}
                          placeholder="3 a 4, Sin límite…"
                        />
                        <TextField
                          label="Perfiles"
                          value={s.profiles}
                          onChange={(v) => patch(s.id, { profiles: v })}
                          placeholder="1 perfil, Completa…"
                        />
                        <TextField
                          label="Usuarios"
                          value={s.users ?? ""}
                          onChange={(v) => patch(s.id, { users: v })}
                          placeholder="1, 2 a 4…"
                        />
                      </>
                    ) : (
                      <TextField
                        label="Requisitos"
                        value={s.requirements ?? ""}
                        onChange={(v) => patch(s.id, { requirements: v })}
                        placeholder="CURP, correo…"
                      />
                    )}
                    <TextField
                      label="Garantía"
                      value={s.warranty}
                      onChange={(v) => patch(s.id, { warranty: v })}
                      placeholder="25 días, Reimpresión 7 días…"
                    />
                    {tab !== "tramites" ? (
                      <TextField
                        label="Vigencia o duración"
                        value={s.vigencia ?? ""}
                        onChange={(v) => patch(s.id, { vigencia: v })}
                        placeholder="25 días…"
                      />
                    ) : null}
                  </div>
                  ) : null}

                  {can("verDescripciones") ? (
                  <label className="mt-2 grid gap-1 text-xs">
                    <span className="flex items-center gap-2 font-medium text-muted-foreground">
                      {tab === "tramites" ? "Descripción corta" : "Descripción"}
                      <FieldFlag editable={can("editDescripcion")} show={isClient} />
                    </span>
                    <Textarea
                      rows={3}
                      className={lockedStyle(can("editDescripcion"))}
                      value={s.description}
                      placeholder={
                        findPlatform(s.name)?.description ??
                        "Escribe la descripción que verán tus clientes…"
                      }
                      readOnly={!can("editDescripcion")}
                      onChange={(e) => patch(s.id, { description: e.target.value })}
                    />

                    {findPlatform(s.name) && !s.description.trim() ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          Sin texto propio se muestra la descripción sugerida.
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-full text-[11px]"
                          onClick={() =>
                            patch(s.id, {
                              description: findPlatform(s.name)?.description ?? "",
                            })
                          }
                        >
                          Usar sugerida y editar
                        </Button>
                      </div>
                    ) : null}
                    {s.description.trim() ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-fit rounded-full text-[11px]"
                        onClick={() => patch(s.id, { description: "" })}
                      >
                        Quitar descripción personalizada
                      </Button>
                    ) : null}
                  </label>
                  ) : null}
                </>
              ) : null}
            </article>
          ))
        )}
      </div>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
        <Button onClick={saveAll} disabled={!dirty}>
          <Save className="size-4" />
          Guardar todos los cambios
        </Button>
        <Button variant="outline" onClick={discard} disabled={!dirty}>
          <RotateCcw className="size-4" />
          Descartar
        </Button>
        <Label className="text-xs text-muted-foreground">
          {dirty ? "Tienes cambios sin guardar" : "Todo guardado"} · {visibleRows.length} fila(s) en
          pantalla
        </Label>
      </div>
    </section>
  );
}
