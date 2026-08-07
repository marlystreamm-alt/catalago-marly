/** Enlace antiguo /m/{negocio}: redirige al enlace nuevo /{negocio}. */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/m/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/$slug", params: { slug: params.slug }, replace: true });
  },
});
