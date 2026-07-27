import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, Settings2, Tags } from "lucide-react";
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
  CatalogSettingsDialog,
  ServiceFormDialog,
} from "@/components/catalog/service-dialogs";
import { CatalogProvider, useCatalogStore } from "@/lib/catalog/store";
import { CATALOG_IDS, type Service } from "@/lib/catalog/types";

export const Route = createFileRoute("/")({
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
      <CatalogPage />
    </CatalogProvider>
  ),
});

const ALL = "__all__";

function CatalogPage() {
  const { state, catalog, catalogId, setCatalogId, isAdmin } = useCatalogStore();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [onlyActive, setOnlyActive] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const stats = useMemo(() => {
    const total = catalog.services.length;
    const activos = catalog.services.filter((s) => s.active).length;
    return {
      total,
      activos,
      ocultos: total - activos,
      categorias: catalog.categories.length,
    };
  }, [catalog]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.services.filter((s) => {
      if (!isAdmin && !s.active) return false;
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
  }, [catalog, query, categoryFilter, onlyActive, isAdmin]);

  const grouped = useMemo(() => {
    return catalog.categories
      .map((category) => {
        const items = visible.filter((s) => s.categoryId === category.id);
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
  }, [catalog, visible]);

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

          <nav className="mt-4 grid grid-cols-3 gap-1.5 rounded-2xl bg-muted p-1">
            {CATALOG_IDS.map((id) => (
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
              </button>
            ))}
          </nav>
        </header>

        <section className="mt-4 grid grid-cols-4 gap-2" aria-label="Estadísticas">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Activos" value={stats.activos} />
          <StatCard label="Categorías" value={stats.categorias} />
          <StatCard label="Ocultos" value={stats.ocultos} />
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
            <div className="flex items-center gap-2">
              <Switch id="only-active" checked={onlyActive} onCheckedChange={setOnlyActive} />
              <Label htmlFor="only-active" className="text-sm">
                Solo activos
              </Label>
            </div>
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
            </div>
          ) : null}
        </section>

        <div className="mt-5 grid gap-6">
          {grouped.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card/70 p-8 text-center text-sm text-muted-foreground">
              No hay servicios que coincidan con tu búsqueda.
            </p>
          ) : (
            grouped.map(({ category, groups }) => (
              <section key={category.id}>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">{category.name}</h2>
                  <Badge variant="secondary">{groups.reduce((n, g) => n + g.items.length, 0)}</Badge>
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
