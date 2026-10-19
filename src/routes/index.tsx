import { copyText } from "@/lib/browser/clipboard";
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  FileDown,
  History,
  Link2,
  Plus,
  Pencil,
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
import { CategoriesDialog } from "@/components/catalog/categories-dialog";
import { ServiceCard } from "@/components/catalog/service-card";
import { InlineLoader, ServiceListSkeleton } from "@/components/catalog/service-skeletons";
import { HistoryDialog } from "@/components/catalog/history-dialog";
import { OrderQueueProvider } from "@/lib/catalog/order-queue";
import { buildMeta, downloadCsv, formatStamp, printPdf, stamp } from "@/lib/catalog/export";
import { buildCatalogLink } from "@/lib/catalog/links";
import { ServiceDetailDialog } from "@/components/catalog/service-detail-dialog";
import { BulkOrderBar } from "@/components/catalog/bulk-order-bar";

import { toast } from "sonner";
import { CatalogSettingsDialog, ServiceFormDialog } from "@/components/catalog/service-dialogs";
import { CatalogProvider, useCatalogStore } from "@/lib/catalog/store";
import { ALL_CATEGORIES } from "@/lib/catalog/prefs";
import { useOnline } from "@/hooks/use-online";
import { CatalogManager } from "@/components/catalog/catalog-manager";
import { CartDialog } from "@/components/catalog/cart-dialog";
import { DirectoryMenuRequestsDialog } from "@/components/catalog/directory-menu-requests-dialog";
import { DirectoryListingRequestDialog } from "@/components/catalog/directory-listing-request-dialog";

import { SessionAccess } from "@/components/catalog/session-access";

import { CATALOG_IDS, type CatalogId, type Service, type SortMode } from "@/lib/catalog/types";

/** Enlaces públicos con filtros: /?cat=clientes&q=netflix&categoria=streaming&activos=1&fav=1&orden=precio */
const searchSchema = z.object({
  cat: fallback(z.string(), "").default(""),
  q: fallback(z.string(), "").default(""),
  categoria: fallback(z.string(), "").default(""),
  // Los valores llegan como número (1/0) desde la URL, por eso se convierten a texto.
  activos: fallback(z.coerce.string(), "").default(""),
  fav: fallback(z.coerce.string(), "").default(""),
  orden: fallback(z.string(), "").default(""),
  /** Servicio específico: abre su detalle listo para pedir por WhatsApp. */
  svc: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "MA² · Catálogos de servicios y trámites" },
      { name: "ma2-build", content: "v20.62-tanstack-cve-2026-102989" },
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
    canEdit,
    isClient,
    can,
    clientSession,
    hydrated,
    visibleCatalogIds,
    prefs,
    setPrefs,
    resetPrefs,
  } = useCatalogStore();

  const online = useOnline();
  const [query, setQuery] = useState("");
  const {
    categoryFilter,
    onlyActive,
    onlyFavorites,
    sortMode,
    showDetail,
    showShare,
    showWhatsapp,
  } = prefs;

  const effectiveShowDetail = showDetail && (!isClient || can("usarDetalles"));
  const effectiveShowShare = isAdmin || isClient ? true : showShare;
  const effectiveShowWhatsapp = showWhatsapp && (!isClient || can("usarWhatsapp"));
  const effectiveFavorites = !isClient || can("usarFavoritos");

  const legacyGrouping = ["clientes", "cyberdoc", "revendedores"].includes(catalog.id);
  // Las secciones superiores son navegación pública real para cualquier espacio tipo Catálogo.
  // Ya no dependen del id histórico (clientes/cyberdoc/revendedores), porque los espacios pueden renombrarse o crearse.
  const publicSectionGrouping = catalog.spaceType === "catalog";
  const sectionTabs = useMemo(
    () => catalog.sectionTabs?.length
      ? catalog.sectionTabs.filter((t) => !t.hidden)
      : [
          { id: "perfiles", name: catalog.sectionLabels?.perfiles || "Perfiles" },
          { id: "completas", name: catalog.sectionLabels?.completas || "Completas" },
          { id: "tramites", name: catalog.sectionLabels?.tramites || "Trámites" },
        ],
    [catalog.sectionTabs, catalog.sectionLabels],
  );
  const [publicSection, setPublicSection] = useState("");

  const serviceSection = (service: Service) => {
    if (service.sectionId && sectionTabs.some((t) => t.id === service.sectionId)) return service.sectionId;
    const category = catalog.categories.find((c) => c.id === service.categoryId);
    const sub = category?.subsections.find((x) => x.id === service.subsectionId)?.name.toLowerCase() ?? "";
    const plan = (service.plan ?? "").toLowerCase();
    if (sectionTabs.some((t) => t.id === "perfiles") && (sub.includes("perfil") || plan.includes("perfil"))) return "perfiles";
    if (sectionTabs.some((t) => t.id === "completas") && (sub.includes("complet") || plan.includes("complet"))) return "completas";
    if (legacyGrouping && sectionTabs.some((t) => t.id === "tramites")) return "tramites";
    return sectionTabs[0]?.id ?? "";
  };

  useEffect(() => {
    if (!publicSectionGrouping) {
      if (publicSection) setPublicSection("");
      return;
    }
    if (!sectionTabs.some((t) => t.id === publicSection)) setPublicSection(sectionTabs[0]?.id ?? "");
  }, [catalog.id, publicSectionGrouping, sectionTabs, publicSection]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", prefs.themeMode === "oscuro");
    root.style.setProperty("--ma2-user-accent", prefs.accentColor);
    root.style.setProperty("--primary", prefs.accentColor);
    root.style.setProperty("--ring", prefs.accentColor);
    root.style.setProperty("--sidebar-primary", prefs.accentColor);
    return () => {
      // No limpiamos el tema al desmontar: evita parpadeos al cambiar de ruta.
    };
  }, [prefs.themeMode, prefs.accentColor]);

  const selectedIds = prefs.markedIds;
  const setSelectedIds = (updater: string[] | ((prev: string[]) => string[])) => {
    const next = typeof updater === "function" ? updater(prefs.markedIds) : updater;
    setPrefs({ markedIds: next });
  };
  // Precio que tenía cada servicio al seleccionarlo, para avisar si cambió.
  const [snapshots, setSnapshots] = useState<Record<string, number>>({});
  const toggleSelect = (id: string) => {
    const price = catalog.services.find((s) => s.id === id)?.price;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setSnapshots((prev) => {
      const next = { ...prev };
      if (selectedIds.includes(id)) delete next[id];
      else if (typeof price === "number") next[id] = price;
      return next;
    });
  };
  const clearSelection = () => {
    setSelectedIds([]);
    setSnapshots({});
  };
  // Al cambiar de catálogo solo se limpian las instantáneas de precio; las marcas se conservan.
  useEffect(() => {
    setSnapshots({});
  }, [catalogId]);
  const setCategoryFilter = (categoryFilter: string) => setPrefs({ categoryFilter });
  const setOnlyActive = (onlyActive: boolean) => setPrefs({ onlyActive });
  const setOnlyFavorites = (onlyFavorites: boolean) => setPrefs({ onlyFavorites });
  const setSortMode = (sortMode: SortMode) => setPrefs({ sortMode });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Loader breve al buscar o cambiar filtros para que la lista nunca "parpadee" vacía.
  const [refreshing, setRefreshing] = useState(false);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setRefreshing(true);
    const t = setTimeout(() => setRefreshing(false), 260);
    return () => clearTimeout(t);
  }, [query, categoryFilter, onlyActive, onlyFavorites, sortMode, catalogId]);

  // Los enlaces públicos con parámetros aplican catálogo y filtros al abrir.
  const search = Route.useSearch();
  const targetCatalog =
    search.cat && (CATALOG_IDS as string[]).includes(search.cat) ? (search.cat as CatalogId) : null;
  const appliedCatalog = useRef(false);
  const appliedPrefs = useRef(false);
  const appliedService = useRef(false);

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

  // ?svc=<id> abre el detalle del servicio listo para pedir por WhatsApp.
  useEffect(() => {
    if (appliedService.current || !hydrated || !search.svc) return;
    if (targetCatalog && catalogId !== targetCatalog) return;
    appliedService.current = true;
    const found = catalog.services.find((s) => s.id === search.svc);
    if (found) setDetailId(found.id);
    else toast.error("El servicio del enlace ya no está disponible");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, catalogId, catalog]);

  const detailService = useMemo(
    () => catalog.services.find((s) => s.id === detailId) ?? null,
    [catalog.services, detailId],
  );

  const shareLink = () => {
    const url = buildCatalogLink(catalogId);
    copyText(url)
      .then(() => toast.success(`Enlace público de ${catalog.name} copiado`))
      .catch(() => toast.error("No se pudo copiar el enlace público"));
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
      if (!isAdmin && !can("verOcultos") && !s.active) return false;
      if (effectiveFavorites && onlyFavorites && !s.favorite) return false;
      if (onlyActive && !s.active) return false;
      if (categoryFilter !== ALL && s.categoryId !== categoryFilter) return false;
      if (publicSectionGrouping && publicSection && serviceSection(s) !== publicSection) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (catalog.categories.find((c) => c.id === s.categoryId)?.name ?? "")
          .toLowerCase()
          .includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, query, categoryFilter, onlyActive, onlyFavorites, isAdmin, isClient, publicSectionGrouping, publicSection, sectionTabs]);

  const sorted = useMemo(() => {
    const list = [...visible];
    if (sortMode === "precio") list.sort((a, b) => a.price - b.price);
    if (sortMode === "nombre") list.sort((a, b) => a.name.localeCompare(b.name, "es-MX"));
    // En el orden por categoría se conserva el orden manual definido desde administración.
    return list;
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

  // Metadatos de auditoría que acompañan cada exportación de la búsqueda.
  const exportMeta = useMemo(
    () =>
      buildMeta([
        { label: "Catálogo", value: catalog.name },
        { label: "Búsqueda", value: query.trim() || "(vacía)" },
        {
          label: "Categoría",
          value:
            categoryFilter === ALL
              ? "Todas"
              : (catalog.categories.find((c) => c.id === categoryFilter)?.name ?? categoryFilter),
        },
        { label: "Solo activos", value: onlyActive ? "Sí" : "No" },
        { label: "Solo favoritos", value: onlyFavorites ? "Sí" : "No" },
        {
          label: "Orden",
          value:
            sortMode === "precio"
              ? "Precio (menor a mayor)"
              : sortMode === "nombre"
                ? "Nombre (A-Z)"
                : "Categoría",
        },
        { label: "Filtros aplicados", value: filtersSummary },
        { label: "Resultados exportados", value: String(sorted.length) },
      ]),
    [
      catalog,
      query,
      categoryFilter,
      onlyActive,
      onlyFavorites,
      sortMode,
      filtersSummary,
      sorted.length,
    ],
  );

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (service: Service) => {
    setEditing(service);
    setFormOpen(true);
  };

  return (
    <main
      className={`min-h-screen pb-24 ${
        prefs.backgroundStyle === "solido"
          ? "app-solid"
          : prefs.backgroundStyle === "suave"
            ? "app-soft"
            : "app-gradient"
      }`}
    >
      <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-4 sm:py-6 lg:max-w-6xl lg:px-8">
        <header id="ma2-catalog-workspace" className="card-soft rounded-3xl border border-border bg-card/90 p-3.5 backdrop-blur sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {catalog.imageUrl ? (
                <img src={catalog.imageUrl} alt="" className="size-14 shrink-0 rounded-2xl border border-border object-cover sm:size-16" />
              ) : null}
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-[0.2em] text-primary">MA²</p>
                <h1 className="text-xl font-bold leading-tight text-balance text-card-foreground sm:text-2xl">
                  {catalog.name}
                </h1>
                <p className="text-[13px] leading-snug text-muted-foreground sm:text-sm">
                  {catalog.subtitle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 [&_button]:rounded-xl">
              <SessionAccess
                onAddService={openNew}
                onCatalogSettings={() => setSettingsOpen(true)}
                onCategories={() => setCategoriesOpen(true)}
                onHistory={() => setHistoryOpen(true)}
                exportDisabled={!sorted.length}
                onExportCsv={() => {
                  downloadCsv(
                    `ma2-busqueda-${catalogId}-${stamp()}`,
                    SEARCH_HEADERS,
                    searchRows,
                    exportMeta,
                  );
                  toast.success("Búsqueda exportada en CSV");
                }}
                onExportPdf={() => {
                  const ok = printPdf(
                    `${catalog.name} · Búsqueda`,
                    `${sorted.length} servicio(s) · ${filtersSummary} · ${formatStamp()}`,
                    SEARCH_HEADERS,
                    searchRows,
                    exportMeta,
                  );
                  if (!ok) toast.error("Permite ventanas emergentes para generar el PDF");
                }}
              />
              {effectiveShowShare ? (
                <Button type="button" size="sm" variant="outline" className="h-10 rounded-xl" onClick={shareLink}>
                  <Link2 className="size-4" /> Compartir
                </Button>
              ) : null}
            </div>
          </div>

          {isAdmin ? (
            <nav
              className="mt-4 grid gap-1.5 rounded-2xl bg-muted p-1"
              style={{ gridTemplateColumns: `repeat(${visibleCatalogIds.length}, minmax(0, 1fr))` }}
              aria-label="Catálogos de administración"
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
                  {state.catalogs[id].hidden ? " (oculto)" : ""}
                </button>
              ))}
            </nav>
          ) : null}
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

        {!isAdmin ? (
          <section
            className="card-soft mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-3"
            aria-label="Resumen público"
          >
            <div className="rounded-xl bg-muted/40 px-3 py-2 text-center">
              <span className="block text-xs font-medium text-muted-foreground">Servicios activos</span>
              <span className="text-xl font-bold text-primary">{stats.activos}</span>
            </div>
            <div className="rounded-xl bg-muted/40 px-3 py-2 text-center">
              <span className="block text-xs font-medium text-muted-foreground">Favoritos</span>
              <span className="text-xl font-bold text-primary">{stats.favoritos}</span>
            </div>
          </section>
        ) : null}

        {isClient ? (
          <div className="card-soft mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm">
            <p className="font-semibold text-foreground">
              Estás en el menú de {clientSession?.business}
            </p>
            <p className="text-xs text-muted-foreground">
              Solo puedes cambiar lo que MA² habilitó para tu cuenta. Tu acceso vence el{" "}
              {clientSession?.expiresOn}.
            </p>
          </div>
        ) : null}

        <section className="card-soft mt-4 rounded-2xl border border-border bg-card p-3">
          <div className="mb-2 flex flex-wrap justify-end gap-2">
            {(catalog.spaceType === "directory" || catalog.spaceType === "provider") && !isAdmin ? <DirectoryListingRequestDialog catalog={catalog} /> : null}
            {catalog.spaceType !== "directory" ? <CartDialog /> : null}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 rounded-full pl-9 text-base"
              placeholder="Buscar servicio…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar servicio"
            />
          </div>
          {refreshing ? (
            <div className="mt-2">
              <InlineLoader />
            </div>
          ) : null}
        </section>

        {canEdit ? (
          <div className="mt-3 grid gap-3">
            <section className="card-soft rounded-3xl border border-border bg-card p-3 sm:p-4">
              {isAdmin ? (
                <div className="mb-3 grid grid-cols-5 gap-1.5" aria-label="Estadísticas">
                  <StatCard label="Total" value={stats.total} />
                  <StatCard label="Activos" value={stats.activos} />
                  <StatCard label="Categorías" value={stats.categorias} />
                  <StatCard label="Ocultos" value={stats.ocultos} />
                  <StatCard label="Favoritos" value={stats.favoritos} />
                </div>
              ) : null}

              <div className="grid gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Filtros y vista
                  </p>
                  {activeFilters.length ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => {
                        setQuery("");
                        resetPrefs();
                      }}
                    >
                      Limpiar filtros
                    </Button>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-10 w-full" aria-label="Filtrar por categoría">
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
                    <SelectTrigger className="h-10 w-full" aria-label="Ordenar servicios">
                      <ArrowUpDown className="size-4 shrink-0 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="categoria">Por categoría</SelectItem>
                      <SelectItem value="precio">Por precio (menor a mayor)</SelectItem>
                      <SelectItem value="nombre">Por nombre (A-Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {effectiveFavorites ? (
                    <div className="flex min-h-10 items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2">
                      <Label htmlFor="only-fav" className="flex items-center gap-1.5 text-sm">
                        <Star className="size-3.5" />
                        Favoritos
                      </Label>
                      <Switch id="only-fav" checked={onlyFavorites} onCheckedChange={setOnlyFavorites} />
                    </div>
                  ) : <div />}
                  {isAdmin ? (
                    <div className="flex min-h-10 items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2">
                      <Label htmlFor="only-active" className="text-sm">
                        Solo activos
                      </Label>
                      <Switch id="only-active" checked={onlyActive} onCheckedChange={setOnlyActive} />
                    </div>
                  ) : null}
                </div>

                {activeFilters.length ? (
                  <div className="flex flex-wrap items-center gap-1.5">
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
                  </div>
                ) : null}
              </div>
            </section>

            {isAdmin ? (
              <section className="card-soft rounded-3xl border border-border bg-card p-3 sm:p-4">
                <div className="mb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Administrar catálogo</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Acciones agrupadas para mantener esta pantalla limpia.</p>
                </div>
                <div className="grid gap-2">
                  <details className="rounded-2xl border border-border bg-muted/20 p-2">
                    <summary className="cursor-pointer list-none rounded-xl px-2 py-2 text-sm font-semibold">Editar catálogo</summary>
                    <div className="mt-2 grid grid-cols-2 gap-2 px-1 pb-1 sm:grid-cols-3">
                      <Button size="sm" onClick={openNew}><Plus className="size-4" />Agregar</Button>
                      <Button size="sm" variant="outline" onClick={() => setCategoriesOpen(true)}><Tags className="size-4" />Categorías</Button>
                      <CatalogManager />
                      <DirectoryMenuRequestsDialog />
                    </div>
                  </details>

                  <details className="rounded-2xl border border-border bg-muted/20 p-2">
                    <summary className="cursor-pointer list-none rounded-xl px-2 py-2 text-sm font-semibold">Configuración del catálogo</summary>
                    <div className="mt-2 grid gap-3 px-1 pb-1">
                      <Button size="sm" variant="outline" className="justify-start" onClick={() => setSettingsOpen(true)}><Settings2 className="size-4" />Nombre, apariencia y WhatsApp</Button>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <label className="flex min-h-11 items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm"><span>Ver detalles</span><Switch checked={showDetail} onCheckedChange={(v) => setPrefs({ showDetail: v })} /></label>
                        <label className="flex min-h-11 items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm"><span>Compartir</span><Switch checked={showShare} onCheckedChange={(v) => setPrefs({ showShare: v })} /></label>
                        <label className="flex min-h-11 items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm"><span>Pedir por WhatsApp</span><Switch checked={showWhatsapp} onCheckedChange={(v) => setPrefs({ showWhatsapp: v })} /></label>
                      </div>
                    </div>
                  </details>

                </div>
              </section>
            ) : null}
          </div>
        ) : null}

        {publicSectionGrouping && sectionTabs.length ? (
          <section className="mt-5 rounded-2xl bg-muted/70 p-2" aria-label="Secciones del catálogo">
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(sectionTabs.length, 1), 4)}, minmax(0, 1fr))` }}>
              {sectionTabs.map((section) => {
                const count = catalog.services.filter((service) => {
                  if (!isAdmin && !can("verOcultos") && !service.active) return false;
                  return serviceSection(service) === section.id;
                }).length;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setPublicSection(section.id)}
                    aria-current={publicSection === section.id}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                      publicSection === section.id
                        ? "bg-card text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
                    }`}
                  >
                    {section.name} ({count})
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="mt-5 grid min-w-0 max-w-full gap-6">
          {!hydrated ? (
            <ServiceListSkeleton count={5} />
          ) : refreshing ? (
            <ServiceListSkeleton count={3} label="Actualizando resultados…" />
          ) : sortMode !== "categoria" ? (
            sorted.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card/70 p-8 text-center text-sm text-muted-foreground">
                No hay servicios que coincidan con tu búsqueda.
              </p>
            ) : (
              <div className={!isAdmin && !isClient ? "grid grid-cols-2 gap-2 sm:gap-3" : "grid gap-3 lg:grid-cols-2 xl:grid-cols-3"}>
                {sorted.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    onEdit={openEdit}
                    onOpenDetail={setDetailId}
                    selected={selectedIds.includes(service.id)}
                    onToggleSelect={toggleSelect}
                    showDetail={effectiveShowDetail}
                    showShare={effectiveShowShare}
                  />
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
                    <div className={!isAdmin && !isClient ? "grid grid-cols-2 gap-2 sm:gap-3" : "grid gap-3 lg:grid-cols-2 xl:grid-cols-3"}>
                      {group.items.map((service) => (
                        <ServiceCard
                          key={service.id}
                          service={service}
                          onEdit={openEdit}
                          onOpenDetail={setDetailId}
                          selected={selectedIds.includes(service.id)}
                          onToggleSelect={toggleSelect}
                          showDetail={effectiveShowDetail}
                          showShare={effectiveShowShare}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            ))
          )}
        </div>

        {effectiveShowWhatsapp ? (
          <BulkOrderBar
            services={catalog.services.filter((s) => selectedIds.includes(s.id))}
            onClear={() => setSelectedIds([])}
          />
        ) : null}
      </div>

      <ServiceFormDialog open={formOpen} onOpenChange={setFormOpen} service={editing} />
      <CatalogSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <CategoriesDialog open={categoriesOpen} onOpenChange={setCategoriesOpen} />
      <HistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
      <ServiceDetailDialog
        service={detailService}
        open={!!detailService}
        onOpenChange={(v) => {
          if (!v) setDetailId(null);
        }}
      />
      <BackNav />
    </main>
  );
}

/** Botones visibles para regresar arriba del catálogo o a la pantalla anterior. */
function BackNav() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <div className="fixed bottom-4 left-3 z-40 flex gap-2 sm:left-6">
      {typeof window !== "undefined" && window.history.length > 1 ? (
        <Button
          variant="outline"
          size="sm"
          className="rounded-full bg-card shadow-lg"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="size-4" />
          Atrás
        </Button>
      ) : null}
      <Button
        size="sm"
        className="rounded-full shadow-lg"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <ArrowUp className="size-4" />
        Arriba
      </Button>
    </div>
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
