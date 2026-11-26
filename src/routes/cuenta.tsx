import { createFileRoute, Navigate } from "@tanstack/react-router";
export const Route = createFileRoute("/cuenta")({
  component: () => <Navigate to="/tienda/$slug" params={{ slug: "ma2" }} search={{vista:"cuenta",q:"",sku:""}} />,
});
