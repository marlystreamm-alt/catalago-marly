import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  ArrowUpDown,
  FileDown,
  FileText,
  History,
  Link2,
  ShieldCheck,
  Plus,
  Search,
  Settings2,
  Star,
  Tags,
  WifiOff,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminBar } from "@/components/catalog/admin-bar";
import { CategoriesDialog } from "@/components/catalog/categories-dialog";
import { ServiceCard } from "@/components/catalog/service-card";
import {
  AuditDialog,
  CatalogVisibilityDialog,
  HistoryDialog,
} from "@/components/catalog/history-dialog";
import { PendingOrdersBar } from "@/components/catalog/pending-orders";
import { OrderQueueProvider } from "@/lib/catalog/order-queue";
import { downloadCsv, printPdf, stamp } from "@/lib/catalog/export";
import { toast } from "sonner";
import { CatalogSettingsDialog, ServiceFormDialog } from "@/components/catalog/service-dialogs";
import { CatalogProvider, useCatalogStore } from "@/lib/catalog/store";
import { ALL_CATEGORIES } from "@/lib/catalog/prefs";
import { useOnline } from "@/hooks/use-online";
import { CATALOG_IDS, type CatalogId, type Service, type SortMode } from "@/lib/catalog/types";

/** Enlaces públicos con filtros: /?cat=clientes&q=netflix&categoria=streaming&activos=1&fav=1&orden=precio */
const searchSchema = z.object({
  cat: fallback(z.string(), "").default(""),
  q: fallback(z.string(), "").default(""),
  categoria: fallback(z.string(), "").default(""),
  activos: fallback(z.string(), "").default(""),
  fav: fallback(z.string(), "").default(""),
  orden: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "MA² · Catálogos de servicios y trámites" },
      {
        name: "description",
        content:
          "Consulta los catálogos MA² de streaming, IA y trámites SAT, IMSS e INFONAVIT, y pide por WhatsApp al instante.",
      },
      { property: "og:title", content: "MA² · Catálogos de servicios y trámites" },
      {
        property: "og:description",
        content:
          "Streaming, IA y trámites oficiales con precios en MXN. Pide por WhatsApp en un toque.",
      },
    ],
  }),
  component: () => (
    <CatalogProvider>
      <OrderQueueProvider>
        <CatalogPage />
      </OrderQueueProvider>
    </CatalogProvider>
  ),
});

const ALL = ALL_CATEGORIES;

const SEARCH_HEADERS = [
  "Servicio",
  "Precio MXN",
  "Categoría",
  "Subsección",
  "Descripción",
  "Dispositivos",
  "Perfiles",
  "Entrega",
  "Garantía",
  "Estado",
  "Favorito",
];

function CatalogPage() {
  const {
    state,
    catalog,
    catalogId,
    setCatalogId,
    isAdmin,
    hydrated,
    visibleCatalogIds,
    prefs,
    setPrefs,
    resetPrefs,
  } = useCatalogStore();

  const online = useOnline();
  const [query, setQuery] = useState("");
  const { categoryFilter, onlyActive, onlyFavorites, sortMode } = prefs;
  const setCategoryFilter = (categoryFilter: string) => setPrefs({ categoryFilter });
  const setOnlyActive = (onlyActive: boolean) => setPrefs({ onlyActive });
  const setOnlyFavorites = (onlyFavorites: boolean) => setPrefs({ onlyFavorites });
  const setSortMode = (sortMode: SortMode) => setPrefs({ sortMode });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  // Los enlaces públicos con parámetros aplican catálogo y filtros al abrir.
  const search = Route.useSearch();
  const targetCatalog =
    search.cat && (CATALOG_IDS as string[]).includes(search.cat) ? (search.cat as CatalogId) : null;
  const appliedCatalog = useRef(false);
  const appliedPrefs = useRef(false);

  useEffect(() => {
    if (appliedCatalog.current || !hydrated) return;
    appliedCatalog.current = true;
    if (targetCatalog) setCatalogId(targetCatalog);
    if (search.q) setQuery(search.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Las preferencias se aplican cuando el catálogo del enlace ya está activo.
  useEffect(() => {
    if (appliedPrefs.current || !hydrated) return;
    if (targetCatalog && catalogId !== targetCatalog) return;
    appliedPrefs.current = true;
    const patch: Partial<typeof prefs> = {};
    if (search.categoria) patch.categoryFilter = search.categoria;
    if (search.activos) patch.onlyActive = search.activos === "1";
    if (search.fav) patch.onlyFavorites = search.fav === "1";
    if (["categoria", "precio", "nombre"].includes(search.orden))
      patch.sortMode = search.orden as SortMode;
    if (Object.keys(patch).length) setPrefs(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, catalogId]);


  const shareLink = () => {
    const params = new URLSearchParams({ cat: catalogId });
    if (query.trim()) params.set("q", query.trim());
    if (categoryFilter !== ALL) params.set("categoria", categoryFilter);
    if (onlyActive) params.set("activos", "1");
    if (onlyFavorites) params.set("fav", "1");
    if (sortMode !== "categoria") params.set("orden", sortMode);
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Enlace con filtros copiado"))
      .catch(() => toast.error("No se pudo copiar el enlace"));
  };

  const stats = useMemo(() => {
    const total = catalog.services.length;
    const activos = catalog.services.filter((s) => s.active).length;
    return {
      total,
      activos,
      ocultos: total - activos,
      categorias: catalog.categories.length,
      favoritos: catalog.services.filter((s) => s.favorite).length,
    };
  }, [catalog]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.services.filter((s) => {
      if (!isAdmin && !s.active) return false;
      if (onlyFavorites && !s.favorite) return false;
      if (onlyActive && !s.active) return false;
      if (categoryFilter !== ALL && s.categoryId !== categoryFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (catalog.categories.find((c) => c.id === s.categoryId)?.name ?? "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [catalog, query, categoryFilter, onlyActive, onlyFavorites, isAdmin]);

  const sorted = useMemo(() => {
    const list = [...visible];
    if (sortMode === "precio") list.sort((a, b) => a.price - b.price);
    if (sortMode === "nombre") list.sort((a, b) => a.name.localeCompare(b.name, "es-MX"));
    // Los favoritos siempre suben al inicio para encontrarlos más rápido.
    return list.sort((a, b) => Number(b.favorite) - Number(a.favorite));
  }, [visible, sortMode]);

  const grouped = useMemo(() => {
    return catalog.categories
      .map((category) => {
        const items = sorted.filter((s) => s.categoryId === category.id);
        const groups = [
          ...category.subsections.map((sub) => ({
            key: sub.id,
            title: sub.name,
            items: items.filter((s) => s.subsectionId === sub.id),
          })),
          {
            key: `${category.id}-general`,
            title: category.subsections.length ? "General" : "",
            items: items.filter(
              (s) => !s.subsectionId || !category.subsections.some((x) => x.id === s.subsectionId),
            ),
          },
        ].filter((g) => g.items.length > 0);
        return { category, groups, count: items.length };
      })
      .filter((g) => g.count > 0);
  }, [catalog, sorted]);

  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (query.trim())
      chips.push({ key: "q", label: `Búsqueda: "${query.trim()}"`, clear: () => setQuery("") });
    if (categoryFilter !== ALL) {
      const name = catalog.categories.find((c) => c.id === categoryFilter)?.name ?? "Categoría";
      chips.push({ key: "cat", label: name, clear: () => setPrefs({ categoryFilter: ALL }) });
    }
    if (onlyFavorites)
      chips.push({
        key: "fav",
        label: "Solo favoritos",
        clear: () => setPrefs({ onlyFavorites: false }),
      });
    if (isAdmin && onlyActive)
      chips.push({
        key: "act",
        label: "Solo activos",
        clear: () => setPrefs({ onlyActive: false }),
      });
    if (sortMode !== "categoria")
      chips.push({
        key: "sort",
        label: sortMode === "precio" ? "Orden: precio" : "Orden: nombre",
        clear: () => setPrefs({ sortMode: "categoria" }),
      });
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, categoryFilter, onlyFavorites, onlyActive, sortMode, isAdmin, catalog]);

  const searchRows = useMemo(
    () =>
      sorted.map((s) => [
        s.name,
        s.price,
        catalog.categories.find((c) => c.id === s.categoryId)?.name ?? "",
        catalog.categories
          .find((c) => c.id === s.categoryId)
          ?.subsections.find((x) => x.id === s.subsectionId)?.name ?? "",
        s.description,
        s.devices,
        s.profiles,
        s.delivery,
        s.warranty,
        s.active ? "Activo" : "Oculto",
        s.favorite ? "Sí" : "No",
      ]),
    [sorted, catalog],
  );

  const filtersSummary = activeFilters.length
    ? activeFilters.map((f) => f.label).join(" · ")
    : "Sin filtros aplicados";

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (service: Service) => {
    setEditing(service);
    setFormOpen(true);
  };

  return (
    <main className="app-gradient min-h-screen pb-16">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <header className="card-soft rounded-3xl border border-border bg-card/90 p-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.2em] text-primary">MA²</p>
              <h1 className="truncate text-2xl font-bold text-card-foreground">{catalog.name}</h1>
              <p className="text-sm text-muted-foreground">{catalog.subtitle}</p>
            </div>
            <AdminBar />
          </div>

          <nav
            className="mt-4 grid gap-1.5 rounded-2xl bg-muted p-1"
            style={{ gridTemplateColumns: `repeat(${visibleCatalogIds.length}, minmax(0, 1fr))` }}
          >
            {visibleCatalogIds.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setCatalogId(id)}
                aria-current={id === catalogId}
                className={`rounded-xl px-2 py-2 text-xs font-semibold transition-colors ${
                  id === catalogId
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {state.catalogs[id].name}
                {isAdmin && state.catalogs[id].hidden ? " (oculto)" : ""}
              </button>
            ))}
          </nav>
        </header>

        {!online ? (
          <div
            role="status"
            className="card-soft mt-4 flex items-start gap-2 rounded-2xl border border-border bg-card p-3 text-sm text-muted-foreground"
          >
            <WifiOff className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              Estás sin conexión. Puedes seguir navegando, buscando y filtrando tus catálogos; los
              pedidos por WhatsApp se copian al portapapeles para enviarlos al recuperar internet.
            </span>
          </div>
        ) : null}

        <PendingOrdersBar />

        <section className="mt-4 grid grid-cols-5 gap-2" aria-label="Estadísticas">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Activos" value={stats.activos} />
          <StatCard label="Categorías" value={stats.categorias} />
          <StatCard label="Ocultos" value={stats.ocultos} />
          <StatCard label="Favoritos" value={stats.favoritos} />
        </section>

        <section className="card-soft mt-4 rounded-2xl border border-border bg-card p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar servicio…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar servicio"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="flex-1 min-w-[10rem]" aria-label="Filtrar por categoría">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas las categorías</SelectItem>
                {catalog.categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
              <SelectTrigger className="flex-1 min-w-[10rem]" aria-label="Ordenar servicios">
                <ArrowUpDown className="size-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="categoria">Por categoría</SelectItem>
                <SelectItem value="precio">Por precio (menor a mayor)</SelectItem>
                <SelectItem value="nombre">Por nombre (A-Z)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch id="only-fav" checked={onlyFavorites} onCheckedChange={setOnlyFavorites} />
              <Label htmlFor="only-fav" className="flex items-center gap-1 text-sm">
                <Star className="size-3.5" />
                Favoritos
              </Label>
            </div>
            {isAdmin ? (
              <div className="flex items-center gap-2">
                <Switch id="only-active" checked={onlyActive} onCheckedChange={setOnlyActive} />
                <Label htmlFor="only-active" className="text-sm">
                  Solo activos
                </Label>
              </div>
            ) : null}
          </div>

          {activeFilters.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {activeFilters.map((f) => (
                <Badge key={f.key} variant="secondary" className="gap-1">
                  {f.label}
                  <button
                    type="button"
                    aria-label={`Quitar filtro ${f.label}`}
                    onClick={f.clear}
                    className="rounded-full p-0.5 hover:bg-background"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery("");
                  resetPrefs();
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
            <Button size="sm" variant="outline" onClick={shareLink}>
              <Link2 className="size-4" />
              Compartir enlace con filtros
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!sorted.length}
              onClick={() => {
                downloadCsv(`ma2-busqueda-${catalogId}-${stamp()}`, SEARCH_HEADERS, searchRows);
                toast.success("Búsqueda exportada en CSV");
              }}
            >
              <FileDown className="size-4" />
              Exportar búsqueda CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!sorted.length}
              onClick={() => {
                const ok = printPdf(
                  `${catalog.name} · Búsqueda`,
                  `${sorted.length} servicio(s) · ${filtersSummary}`,
                  SEARCH_HEADERS,
                  searchRows,
                );
                if (!ok) toast.error("Permite ventanas emergentes para generar el PDF");
              }}
            >
              <FileText className="size-4" />
              Exportar búsqueda PDF
            </Button>
          </div>

          {isAdmin ? (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
              <Button size="sm" onClick={openNew}>
                <Plus className="size-4" />
                Agregar servicio
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
                <Settings2 className="size-4" />
                Ajustes del catálogo
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCategoriesOpen(true)}>
                <Tags className="size-4" />
                Categorías
              </Button>
              <Button size="sm" variant="outline" onClick={() => setHistoryOpen(true)}>
                <History className="size-4" />
                Historial
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAuditOpen(true)}>
                <ShieldCheck className="size-4" />
                Bitácora
              </Button>
              <Button size="sm" variant="outline" onClick={() => setVisibilityOpen(true)}>
                <Settings2 className="size-4" />
                Mostrar catálogos
              </Button>
            </div>
          ) : null}
        </section>

        <div className="mt-5 grid gap-6">
          {sortMode !== "categoria" ? (
            sorted.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card/70 p-8 text-center text-sm text-muted-foreground">
                No hay servicios que coincidan con tu búsqueda.
              </p>
            ) : (
              <div className="grid gap-3">
                {sorted.map((service) => (
                  <ServiceCard key={service.id} service={service} onEdit={openEdit} />
                ))}
              </div>
            )
          ) : grouped.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card/70 p-8 text-center text-sm text-muted-foreground">
              No hay servicios que coincidan con tu búsqueda.
            </p>
          ) : (
            grouped.map(({ category, groups }) => (
              <section key={category.id}>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">{category.name}</h2>
                  <Badge variant="secondary">
                    {groups.reduce((n, g) => n + g.items.length, 0)}
                  </Badge>
                </div>
                {groups.map((group) => (
                  <div key={group.key} className="mt-3">
                    {group.title ? (
                      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                        {group.title}
                      </h3>
                    ) : null}
                    <div className="grid gap-3">
                      {group.items.map((service) => (
                        <ServiceCard key={service.id} service={service} onEdit={openEdit} />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            ))
          )}
        </div>
      </div>

      <ServiceFormDialog open={formOpen} onOpenChange={setFormOpen} service={editing} />
      <CatalogSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <CategoriesDialog open={categoriesOpen} onOpenChange={setCategoriesOpen} />
      <HistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
      <CatalogVisibilityDialog open={visibilityOpen} onOpenChange={setVisibilityOpen} />
      <AuditDialog open={auditOpen} onOpenChange={setAuditOpen} />
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-soft rounded-2xl border border-border bg-card px-2 py-3 text-center">
      <p className="text-xl font-bold text-primary">{value}</p>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
