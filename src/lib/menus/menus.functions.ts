/** Funciones de servidor del panel de clientes (protegidas con el código del administrador). */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  MenuAdmin,
  MenuAuditEntry,
  MenuBackup,
  MenuBackupVersion,
  MenuBusiness,
  MenuCategory,
  MenuData,
  MenuItem,
} from "./types";

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
    const payload: {
      access_suspended?: boolean;
      access_hash?: string;
      access_salt?: string;
      access_updated_at?: string | null;
    } = {};
    if (typeof data.suspended === "boolean") payload.access_suspended = data.suspended;
    if (data.revoke) {
      payload.access_hash = "";
      payload.access_salt = "";
      payload.access_updated_at = null;
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
    const { logAudit } = await import("./menus.server");
    await logAudit({
      businessId: i.businessId,
      actorKind: "admin",
      actorName: "Administrador",
      action: i.id ? "edicion" : "creacion",
      target: i.name.trim(),
      field: i.id ? "Guardó el producto" : "Creó el producto",
      after: `$${i.price}${i.available ? "" : " · no disponible"}`,
    });
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

/* --------------------- Bitácora, respaldo y varios administradores -------------------- */

/** Historial de cambios de un negocio (quién, cuándo y qué cambió). */
export const menusAudit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ code, businessId: z.string().min(1), limit: z.number().int().min(1).max(500).default(200) }).parse(d),
  )
  .handler(async ({ data }): Promise<MenuAuditEntry[]> => {
    await gate(data.code);
    const { listAudit } = await import("./menus.server");
    return listAudit(data.businessId, data.limit);
  });

/** Respaldo JSON del catálogo de un negocio (queda guardado como versión). */
export const menusExport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code, businessId: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<MenuBackup> => {
    await gate(data.code);
    const { buildBackup, saveBackupVersion, logAudit } = await import("./menus.server");
    const backup = await buildBackup(data.businessId);
    const saved = await saveBackupVersion({
      businessId: data.businessId,
      origin: "export",
      label: "Exportación manual desde el panel",
      actorKind: "admin",
      actorName: "Administrador",
      payload: backup,
    });
    await logAudit({
      businessId: data.businessId,
      actorKind: "admin",
      actorName: "Administrador",
      action: "respaldo",
      target: "Catálogo",
      field: `Exportó respaldo v${saved.version} · origen: panel de administrador`,
      after: `resultado: ${backup.items.length} productos, ${backup.categories.length} categorías`,
    });
    return backup;
  });

const backupSchema = z.object({
  kind: z.literal("ma2-menu-backup").optional(),
  version: z.number().int().default(1),
  exportedAt: z.string().default(() => new Date().toISOString()),
  business: z
    .object({
      name: z.string().default(""),
      ownerName: z.string().default(""),
      whatsapp: z.string().default(""),
      address: z.string().default(""),
      logoUrl: z.string().default(""),
      notes: z.string().default(""),
    })
    .default({ name: "", ownerName: "", whatsapp: "", address: "", logoUrl: "", notes: "" }),
  categories: z.array(z.object({ name: z.string(), sortIndex: z.number().int().default(0) })).default([]),
  items: z
    .array(
      z.object({
        category: z.string().nullable().default(null),
        name: z.string().min(1),
        description: z.string().default(""),
        price: z.number().min(0).default(0),
        priceText: z.string().default(""),
        imageUrl: z.string().default(""),
        available: z.boolean().default(true),
        sortIndex: z.number().int().default(0),
      }),
    )
    .default([]),
});

/** Restaura un respaldo en un negocio (solo ese negocio; puede reemplazar o agregar). */
export const menusImport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        code,
        businessId: z.string().min(1),
        replace: z.boolean().default(true),
        origin: z.string().default("archivo JSON"),
        backup: backupSchema,
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ categories: number; items: number; resumen: string; snapshotVersion: number }> => {
    await gate(data.code);
    const { applyBackup } = await import("./menus.server");
    return applyBackup({
      businessId: data.businessId,
      backup: data.backup as MenuBackup,
      replace: data.replace,
      origin: data.origin,
      actorKind: "admin",
      actorName: "Administrador",
    });
  });

/** Versiones de respaldo guardadas de un negocio. */
export const menusBackups = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code, businessId: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<MenuBackupVersion[]> => {
    await gate(data.code);
    const { listBackups } = await import("./menus.server");
    return listBackups(data.businessId);
  });

/** Restaura el catálogo a una versión guardada (sin tocar otros negocios). */
export const menusRestoreBackup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        code,
        businessId: z.string().min(1),
        backupId: z.string().min(1),
        replace: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ categories: number; items: number; resumen: string; snapshotVersion: number }> => {
    await gate(data.code);
    const { applyBackup, getBackupPayload, listBackups } = await import("./menus.server");
    const payload = await getBackupPayload(data.backupId, data.businessId);
    const ficha = (await listBackups(data.businessId, 200)).find((b) => b.id === data.backupId);
    return applyBackup({
      businessId: data.businessId,
      backup: payload,
      replace: data.replace,
      origin: `versión guardada v${ficha?.version ?? "?"}`,
      actorKind: "admin",
      actorName: "Administrador",
    });
  });

/** Prende o apaga que el negocio tenga varios administradores. */
export const menusSetMultiAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ code, id: z.string().min(1), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data }): Promise<MenuBusiness> => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rowToBusiness, logAudit } = await import("./menus.server");
    const { data: row, error } = await supabaseAdmin
      .from("menu_businesses")
      .update({ multi_admin: data.enabled })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await logAudit({
      businessId: data.id,
      actorKind: "admin",
      actorName: "Administrador",
      action: "acceso",
      target: "Varios administradores",
      field: "Interruptor",
      after: data.enabled ? "encendido" : "apagado",
    });
    return rowToBusiness(row as Record<string, unknown>);
  });

/** Administradores adicionales de un negocio. */
export const menusAdminsList = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code, businessId: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<MenuAdmin[]> => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("menu_admins")
      .select("*")
      .eq("business_id", data.businessId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row["id"]),
        businessId: String(row["business_id"]),
        name: String(row["name"] ?? ""),
        suspended: Boolean(row["suspended"]),
        temp: Boolean(row["access_temp"]),
        lastLoginAt: row["last_login_at"] ? String(row["last_login_at"]) : null,
        createdAt: String(row["created_at"]),
      };
    });
  });

/** Agrega un administrador con su propia contraseña temporal. */
export const menusAddAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ code, businessId: z.string().min(1), name: z.string().min(1).max(60) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ password: string }> => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPassword, randomSalt, tempPassword, logAudit } = await import("./menus.server");
    const password = tempPassword();
    const salt = randomSalt();
    const { error } = await supabaseAdmin.from("menu_admins").insert({
      business_id: data.businessId,
      name: data.name.trim(),
      access_salt: salt,
      access_hash: await hashPassword(password, salt),
      access_temp: true,
    });
    if (error) throw new Error(error.message);
    await logAudit({
      businessId: data.businessId,
      actorKind: "admin",
      actorName: "Administrador",
      action: "acceso",
      target: data.name.trim(),
      field: "Agregó un administrador",
    });
    return { password };
  });

/** Suspende, reactiva, regenera contraseña o elimina un administrador adicional. */
export const menusSetAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        code,
        id: z.string().min(1),
        suspended: z.boolean().optional(),
        regenerate: z.boolean().optional(),
        remove: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ password?: string }> => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPassword, randomSalt, tempPassword } = await import("./menus.server");
    if (data.remove) {
      const { error } = await supabaseAdmin.from("menu_admins").delete().eq("id", data.id);
      if (error) throw new Error(error.message);
      return {};
    }
    const payload: {
      suspended?: boolean;
      access_salt?: string;
      access_hash?: string;
      access_temp?: boolean;
    } = {};
    if (typeof data.suspended === "boolean") payload.suspended = data.suspended;
    let password: string | undefined;
    if (data.regenerate) {
      password = tempPassword();
      const salt = randomSalt();
      payload.access_salt = salt;
      payload.access_hash = await hashPassword(password, salt);
      payload.access_temp = true;
    }
    const { error } = await supabaseAdmin.from("menu_admins").update(payload).eq("id", data.id);
    if (error) throw new Error(error.message);
    return password ? { password } : {};
  });
