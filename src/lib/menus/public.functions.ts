/** Función pública para mostrar el menú de un negocio (sin código de administrador). */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { MenuData } from "./types";

export const menuPublicLoad = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }): Promise<MenuData | null> => {
    const { loadPublicMenu } = await import("./menus.server");
    return loadPublicMenu(data.slug.toLowerCase());
  });
