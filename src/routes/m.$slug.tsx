/** Menú público de una clienta: comprueba su suscripción antes de mostrar el catálogo. */
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ServiceCard } from "@/components/catalog/service-card";
import { ServiceListSkeleton } from "@/components/catalog/service-skeletons";
import { OrderQueueProvider } from "@/lib/catalog/order-queue";
import { CatalogProvider, useCatalogStore } from "@/lib/catalog/store";
import { subsPublicState, type PublicMenuState } from "@/lib/subs/subs.functions";

export const Route = createFileRoute("/m/$slug")({
  loader: async ({ params }): Promise<PublicMenuState> =>
    subsPublicState({ data: { slug: params.slug } }).catch(() => ({
      found: false,
      businessName: "",
      status: "" as const,
      catalogId: "",
    })),
  head: ({ loaderData }) => {
    const name = loaderData?.businessName || "Menú digital";
    return {
      meta: [
        { title: `${name} · Menú digital` },
        {
          name: "description",
          content: `Consulta el menú de ${name} con precios actualizados y pide por WhatsApp en un toque.`,
        },
        { property: "og:title", content: `${name} · Menú digital` },
        {
          property: "og:description",
          content: `Menú digital de ${name}: precios actualizados y pedidos por WhatsApp.`,
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: MenuRoute,
});

function MenuRoute() {
  const data = Route.useLoaderData();

  if (!data.found) {
    return (
      <Notice
        title="Este menú no existe"
        text="Revisa el enlace o comunícate con el propietario del negocio."
      />
    );
  }

  if (data.status !== "activo" && data.status !== "por_vencer") {
    return (
      <Notice
        title="Este menú está temporalmente suspendido"
        text="Para reactivarlo, comunícate con el propietario del negocio."
        business={data.businessName}
      />
    );
  }

  return (
    <CatalogProvider>
      <OrderQueueProvider>
        <PublicMenu businessName={data.businessName} catalogId={data.catalogId} />
      </OrderQueueProvider>
    </CatalogProvider>
  );
}

function PublicMenu({ businessName, catalogId }: { businessName: string; catalogId: string }) {
  const { state, hydrated } = useCatalogStore();
  const [query, setQuery] = useState("");
  const catalog = state.catalogs[catalogId] ?? Object.values(state.catalogs)[0];

  const services = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (catalog?.services ?? [])
      .filter((s) => s.active)
      .filter((s) => (q ? `${s.name} ${s.description}`.toLowerCase().includes(q) : true));
  }, [catalog, query]);

  return (
    <main className="mx-auto w-full max-w-2xl px-3 py-5 lg:max-w-5xl">
      <header className="card-soft rounded-3xl border border-border bg-card p-4">
        <h1 className="text-2xl font-black tracking-tight">{businessName}</h1>
        <p className="text-sm text-muted-foreground">{catalog?.subtitle ?? "Catálogo de servicios"}</p>
      </header>

      <div className="card-soft mt-4 rounded-2xl border border-border bg-card p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 rounded-full pl-9 text-base"
            placeholder="Buscar en el menú…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar en el menú"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {!hydrated ? (
          <ServiceListSkeleton count={4} />
        ) : services.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/70 p-8 text-center text-sm text-muted-foreground">
            No hay resultados para tu búsqueda.
          </p>
        ) : (
          services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onEdit={() => undefined}
              showDetail
              showShare={false}
            />
          ))
        )}
      </div>
    </main>
  );
}

function Notice({
  title,
  text,
  business,
}: {
  title: string;
  text: string;
  business?: string;
}) {
  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md items-center px-4">
      <section className="card-soft w-full rounded-3xl border border-border bg-card p-6 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted">
          <Lock className="size-6 text-muted-foreground" />
        </span>
        {business ? (
          <p className="mt-4 text-sm font-semibold text-muted-foreground">{business}</p>
        ) : null}
        <h1 className="mt-1 text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{text}</p>
        <Link
          to="/"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Ir al catálogo MA²
        </Link>
      </section>
    </main>
  );
}
