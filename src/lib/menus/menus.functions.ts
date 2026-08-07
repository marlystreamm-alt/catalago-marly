/** Funciones de servidor del panel de clientes (protegidas con el código del administrador). */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { MenuBusiness, MenuCategory, MenuData, MenuItem } from "./types";

const code = z.string().min(4);

const featuresSchema = z.record(z.string(), z.boolean());

const businessSchema = z.object({
  code,
  business: z.object({
    id: z.string().optional(),
    slug: z.string().default(""),
    name: z.string().min(1, "El nombre es obligatorio"),
    ownerName: z.string().default(""),
    whatsapp: z.string().default(""),
    address: z.string().default(""),
    notes: z.string().default(""),
    active: z.boolean().default(true),
    sortIndex: z.number().int().default(0),
    logoUrl: z.string().default(""),
    expiresOn: z.string().nullable().default(null),
  }),
});

const categorySchema = z.object({
  code,
  category: z.object({
    id: z.string().optional(),
    businessId: z.string().min(1),
    name: z.string().min(1, "El nombre es obligatorio"),
    sortIndex: z.number().int().default(0),
  }),
});

const itemSchema = z.object({
  code,
  item: z.object({
    id: z.string().optional(),
    businessId: z.string().min(1),
    categoryId: z.string().nullable().default(null),
    name: z.string().min(1, "El nombre es obligatorio"),
    description: z.string().default(""),
    price: z.number().min(0, "El precio no puede ser negativo").default(0),
    priceText: z.string().default(""),
    imageUrl: z.string().default(""),
    available: z.boolean().default(true),
    sortIndex: z.number().int().default(0),
  }),
});

async function gate(value: string) {
  const { requireAdminCode } = await import("@/lib/notify/notify.server");
  await requireAdminCode(value);
}

/** Lista de negocios (catálogos vendidos). */
export const menusList = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code }).parse(d))
  .handler(async ({ data }): Promise<MenuBusiness[]> => {
    await gate(data.code);
    const { listBusinesses } = await import("./menus.server");
    return listBusinesses();
  });

/** Conteo de categorías y productos por negocio. */
export const menusCounts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code }).parse(d))
  .handler(async ({ data }): Promise<Record<string, { cats: number; items: number }>> => {
    await gate(data.code);
    const { countsByBusiness } = await import("./menus.server");
    return countsByBusiness();
  });

/** Menú completo de un negocio (categorías + productos). */
export const menusLoad = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code, businessId: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<MenuData> => {
    await gate(data.code);
    const { loadMenu } = await import("./menus.server");
    return loadMenu(data.businessId);
  });

/** Crea o actualiza un negocio. */
export const menusSaveBusiness = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => businessSchema.parse(d))
  .handler(async ({ data }): Promise<MenuBusiness> => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rowToBusiness } = await import("./menus.server");
    const b = data.business;
    const payload = {
      name: b.name.trim(),
      slug: b.slug
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
      owner_name: b.ownerName,
      whatsapp: b.whatsapp,
      address: b.address,
      notes: b.notes,
      active: b.active,
      sort_index: b.sortIndex,
      logo_url: b.logoUrl,
      expires_on: b.expiresOn && b.expiresOn.trim() ? b.expiresOn : null,
    };
    const q = b.id
      ? supabaseAdmin.from("menu_businesses").update(payload).eq("id", b.id).select("*").single()
      : supabaseAdmin.from("menu_businesses").insert(payload).select("*").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return rowToBusiness(row as Record<string, unknown>);
  });

/** Guarda los interruptores de un negocio. */
export const menusSetFeatures = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ code, id: z.string().min(1), features: featuresSchema }).parse(d),
  )
  .handler(async ({ data }): Promise<MenuBusiness> => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rowToBusiness, parseFeatures } = await import("./menus.server");
    const { data: row, error } = await supabaseAdmin
      .from("menu_businesses")
      .update({ features: parseFeatures(data.features) })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToBusiness(row as Record<string, unknown>);
  });

/** Genera una contraseña temporal para el dueño y la devuelve una sola vez. */
export const menusGenerateAccess = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code, id: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<{ password: string }> => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPassword, randomSalt, tempPassword } = await import("./menus.server");
    const password = tempPassword();
    const salt = randomSalt();
    const { error } = await supabaseAdmin
      .from("menu_businesses")
      .update({
        access_salt: salt,
        access_hash: await hashPassword(password, salt),
        access_updated_at: new Date().toISOString(),
        access_temp: true,
        access_suspended: false,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { password };
  });

/** Suspende, reactiva o borra el acceso del dueño. */
export const menusSetAccess = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ code, id: z.string().min(1), suspended: z.boolean().optional(), revoke: z.boolean().optional() })
      .parse(d),
  )
  .handler(async ({ data }): Promise<MenuBusiness> => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rowToBusiness } = await import("./menus.server");
    const payload: Record<string, unknown> = {};
    if (typeof data.suspended === "boolean") payload["access_suspended"] = data.suspended;
    if (data.revoke) {
      payload["access_hash"] = "";
      payload["access_salt"] = "";
      payload["access_updated_at"] = null;
    }
    const { data: row, error } = await supabaseAdmin
      .from("menu_businesses")
      .update(payload)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToBusiness(row as Record<string, unknown>);
  });

/** Elimina un negocio con todo su catálogo. */
export const menusDeleteBusiness = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code, id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("menu_businesses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Crea o actualiza una categoría. */
export const menusSaveCategory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => categorySchema.parse(d))
  .handler(async ({ data }): Promise<MenuCategory> => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rowToCategory } = await import("./menus.server");
    const c = data.category;
    const payload = { business_id: c.businessId, name: c.name.trim(), sort_index: c.sortIndex };
    const q = c.id
      ? supabaseAdmin.from("menu_categories").update(payload).eq("id", c.id).select("*").single()
      : supabaseAdmin.from("menu_categories").insert(payload).select("*").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return rowToCategory(row as Record<string, unknown>);
  });

/** Elimina una categoría (sus productos quedan sin categoría). */
export const menusDeleteCategory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code, id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("menu_categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Crea o actualiza un producto. */
export const menusSaveItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => itemSchema.parse(d))
  .handler(async ({ data }): Promise<MenuItem> => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rowToItem } = await import("./menus.server");
    const i = data.item;
    const payload = {
      business_id: i.businessId,
      category_id: i.categoryId,
      name: i.name.trim(),
      description: i.description,
      price: i.price,
      price_text: i.priceText,
      image_url: i.imageUrl,
      available: i.available,
      sort_index: i.sortIndex,
    };
    const q = i.id
      ? supabaseAdmin.from("menu_items").update(payload).eq("id", i.id).select("*").single()
      : supabaseAdmin.from("menu_items").insert(payload).select("*").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return rowToItem(row as Record<string, unknown>);
  });

/** Elimina un producto. */
export const menusDeleteItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code, id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("menu_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
