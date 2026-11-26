import { createFileRoute } from "@tanstack/react-router";
import { Storefront } from "@/components/customer/storefront";
import { MAIN_STORE_VIEWS, type MainStoreView } from "@/lib/catalog/links";
import { CustomerStore } from "@/components/customer/customer-store";
export const Route = createFileRoute("/tienda/$slug")({
  ssr: false,
  validateSearch: (s:Record<string,unknown>) => ({ vista:MAIN_STORE_VIEWS.includes(s.vista as MainStoreView)?s.vista as MainStoreView:undefined,q:typeof s.q==="string"?s.q:"",sku:typeof s.sku==="string"?s.sku:"" }),
  head: () => ({
    meta: [
      { title: "Mi cuenta y tienda · MA²" },
      { name: "robots", content: "noindex" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: () => {
    const { slug } = Route.useParams();
    const {vista,q,sku}=Route.useSearch();
    if(slug==="ma2"&&!vista)return <Storefront/>;
    return <CustomerStore key={slug+vista+q+sku} slug={slug} initialView={vista} initialQuery={q} initialSku={sku}/>;
  },
});
