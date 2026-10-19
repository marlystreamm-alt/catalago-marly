/** Función pública para mostrar el menú de un negocio (sin código de administrador). */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const menuPublicLoad = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { loadPublicMenu } = await import("./menus.server");
    return loadPublicMenu(data.slug.toLowerCase());
  });
