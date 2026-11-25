import { createFileRoute, redirect } from "@tanstack/react-router";
import { CustomerStore } from "@/components/customer/customer-store";
export const Route = createFileRoute("/tienda/$slug")({
  ssr: false,
  beforeLoad: ({ params }) => {
    if (params.slug === "ma2") throw redirect({ to: "/", search: { cat: "clientes", vista: "inicio" } });
  },
  head: () => ({
    meta: [
      { title: "Mi cuenta y tienda · MA²" },
      { name: "robots", content: "noindex" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: () => {
    const { slug } = Route.useParams();
    return <CustomerStore key={slug} slug={slug} />;
  },
});
