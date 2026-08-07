/** Catálogo público de un negocio cliente: martgor.shop/{negocio} */
import { createFileRoute } from "@tanstack/react-router";
import { MenuMissing, PublicMenuView } from "@/components/menus/public-menu";
import { menuPublicLoad } from "@/lib/menus/public.functions";
import type { MenuData } from "@/lib/menus/types";

const RESERVED = new Set([
  "acceso",
  "mi-catalogo",
  "api",
  "m",
  "sitemap.xml",
  "robots.txt",
  "favicon.ico",
]);

export const Route = createFileRoute("/$slug")({
  loader: ({ params }) =>
    RESERVED.has(params.slug.toLowerCase())
      ? null
      : menuPublicLoad({ data: { slug: params.slug } }),
  head: ({ loaderData }) => {
    const name = loaderData?.business.name ?? "Catálogo no disponible";
    const title = loaderData ? `${name} — Catálogo digital` : "Catálogo no disponible";
    const description = loaderData
      ? `Consulta el catálogo de ${name} y haz tu pedido por WhatsApp en segundos.`
      : "Este catálogo no está disponible o el enlace cambió.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  errorComponent: () => <MenuMissing />,
  notFoundComponent: () => <MenuMissing />,
  component: PublicCatalog,
});

function PublicCatalog() {
  const data = Route.useLoaderData() as MenuData | null;
  if (!data) return <MenuMissing />;
  return <PublicMenuView data={data} />;
}
