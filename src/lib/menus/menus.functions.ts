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
  MenuSpace,
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
    allowedSpaces: z.number().int().min(1).max(50).default(1),
    planName: z.string().default("Plan base"),
    renewalPrice: z.number().min(0).default(0),
    billingDay: z.number().int().min(1).max(31).nullable().default(null),
    graceDays: z.number().int().min(0).max(7).default(1),
    contractStartedOn: z.string().default(() => new Date().toISOString().slice(0,10)),
    whatsappTemplate: z.string().default("Hola {cliente}, aquí tienes tu entrega: {link}"),
    suspensionMessage: z.string().default("Servicio no disponible. Contacta al administrador."),
  }),
});

const categorySchema = z.object({
  code,
  category: z.object({
    id: z.string().optional(),
    businessId: z.string().min(1),
    spaceId: z.string().uuid().nullable().default(null),
    parentId: z.string().uuid().nullable().default(null),
    name: z.string().min(1, "El nombre es obligatorio"),
    imageUrl: z.string().max(1000).default(""),
    hidden: z.boolean().default(false),
    sortIndex: z.number().int().default(0),
  }),
});

const itemSchema = z.object({
  code,
  item: z.object({
    id: z.string().optional(),
    businessId: z.string().min(1),
    spaceId: z.string().uuid().nullable().default(null),
    categoryId: z.string().nullable().default(null),
    name: z.string().min(1, "El nombre es obligatorio"),
    description: z.string().default(""),
    price: z.number().min(0, "El precio no puede ser negativo").default(0),
    priceText: z.string().default(""),
    imageUrl: z.string().default(""),
    whatsapp: z.string().default(""),
    whatsappMessage: z.string().default(""),
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
  .validator((d: unknown) => z.object({ code }).parse(d))
  .handler(async ({ data }): Promise<MenuBusiness[]> => {
    await gate(data.code);
    const { listBusinesses } = await import("./menus.server");
    return listBusinesses();
  });

/** Conteo de categorías y productos por negocio. */
export const menusCounts = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ code }).parse(d))
  .handler(async ({ data }): Promise<Record<string, { cats: number; items: number }>> => {
    await gate(data.code);
    const { countsByBusiness } = await import("./menus.server");
    return countsByBusiness();
  });

/** Menú completo de un negocio (categorías + productos). */
export const menusLoad = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ code, businessId: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<MenuData> => {
    await gate(data.code);
    const { loadMenu } = await import("./menus.server");
    return loadMenu(data.businessId);
  });

/** Crea o actualiza un negocio. */
export const menusSaveBusiness = createServerFn({ method: "POST" })
  .validator((d: unknown) => businessSchema.parse(d))
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
      allowed_spaces: b.allowedSpaces,
      plan_name: b.planName,
      renewal_price: b.renewalPrice,
      billing_day: b.billingDay,
      grace_days: b.graceDays,
      contract_started_on: b.contractStartedOn,
      whatsapp_template: b.whatsappTemplate,
      suspension_message: b.suspensionMessage,
    };
    const q = b.id
      ? supabaseAdmin.from("menu_businesses").update(payload).eq("id", b.id).select("*").single()
      : supabaseAdmin.from("menu_businesses").insert(payload).select("*").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    const saved = rowToBusiness(row as Record<string, unknown>);
    if (!b.id) {
      const baseSlug = saved.slug || `espacio-${saved.id.slice(0,8)}`;
      const { data: sp, error: spErr } = await supabaseAdmin.from("menu_spaces").insert({ business_id: saved.id, kind: "catalog", name: saved.name, subtitle: "Catálogo digital", image_url: saved.logoUrl, slug: baseSlug, hidden: false, sort_index: 0 }).select("id").single();
      if (!spErr && sp) {
        const { data: cat } = await supabaseAdmin.from("menu_categories").insert({ business_id: saved.id, space_id: sp.id, name: "General", sort_index: 0 }).select("id").single();
        await supabaseAdmin.from("menu_items").insert({ business_id: saved.id, space_id: sp.id, category_id: cat?.id ?? null, name: "Producto o servicio de ejemplo", description: "Edita esta tarjeta con la información del cliente.", price: 0, price_text: "Consultar", available: true, sort_index: 0 });
      }
    }
    return saved;
  });

/** Guarda los interruptores de un negocio. */
export const menusSetFeatures = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
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

/** Guarda usuario y contraseña elegidos manualmente por la administradora. */
export const menusSetCredentials = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({
      code,
      id: z.string().min(1),
      username: z.string().trim().min(3, "El usuario debe tener al menos 3 caracteres").max(60),
      password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").max(120),
    }).parse(d),
  )
  .handler(async ({ data }): Promise<{ username: string }> => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPassword, randomSalt } = await import("./menus.server");
    const username = data.username.trim().toLowerCase();
    const duplicate = await supabaseAdmin
      .from("menu_businesses")
      .select("id")
      .eq("access_username", username)
      .neq("id", data.id)
      .maybeSingle();
    if (duplicate.data) throw new Error("Ese usuario ya está asignado a otro cliente");
    const salt = randomSalt();
    const { error } = await supabaseAdmin
      .from("menu_businesses")
      .update({
        access_username: username,
        access_salt: salt,
        access_hash: await hashPassword(data.password, salt),
        access_updated_at: new Date().toISOString(),
        access_temp: false,
        access_suspended: false,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { username };
  });

/** Compatibilidad: ya no genera una contraseña fija; crea una aleatoria solo si algún flujo antiguo lo llama. */
export const menusGenerateAccess = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ code, id: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<{ password: string }> => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPassword, randomSalt } = await import("./menus.server");
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const password = Array.from(bytes).map((b) => (b % 36).toString(36)).join("");
    const salt = randomSalt();
    const { error } = await supabaseAdmin.from("menu_businesses").update({
      access_salt: salt,
      access_hash: await hashPassword(password, salt),
      access_updated_at: new Date().toISOString(),
      access_temp: false,
      access_suspended: false,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { password };
  });

/** Suspende, reactiva o borra el acceso del dueño. */
export const menusSetAccess = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        code,
        id: z.string().min(1),
        suspended: z.boolean().optional(),
        revoke: z.boolean().optional(),
      })
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
    const saved = rowToBusiness(row as Record<string, unknown>);
    if (data.suspended === true) {
      try {
        const { notifyAlexaEvent } = await import("@/lib/notify/notify.server");
        await notifyAlexaEvent("client_suspended", `Cliente suspendido: ${saved.name}.`);
      } catch (notifyError) {
        console.error("No se pudo avisar la suspensión del cliente:", notifyError);
      }
    }
    return saved;
  });

const spaceSchema = z.object({
  code,
  space: z.object({
    id: z.string().uuid().optional(),
    businessId: z.string().uuid(),
    kind: z.enum(["catalog", "menu", "directory", "marketplace"]).default("catalog"),
    name: z.string().min(1),
    subtitle: z.string().default(""),
    imageUrl: z.string().default(""),
    slug: z.string().default(""),
    hidden: z.boolean().default(false),
    sortIndex: z.number().int().default(0),
    noticeEnabled: z.boolean().default(false),
    noticeTitle: z.string().default(""),
    noticeMessage: z.string().default(""),
  }),
});

/** Crea o actualiza una pestaña del cliente respetando el límite contratado. */
export const menusSaveSpace = createServerFn({ method: "POST" })
  .validator((d: unknown) => spaceSchema.parse(d))
  .handler(async ({ data }): Promise<MenuSpace> => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rowToSpace } = await import("./menus.server");
    const sp = data.space;
    if (!sp.id) {
      const [{ data: biz }, { count }] = await Promise.all([
        supabaseAdmin.from("menu_businesses").select("allowed_spaces").eq("id", sp.businessId).single(),
        supabaseAdmin.from("menu_spaces").select("id", { count: "exact", head: true }).eq("business_id", sp.businessId),
      ]);
      const allowed = Number((biz as Record<string, unknown> | null)?.["allowed_spaces"] ?? 1);
      if ((count ?? 0) >= allowed) throw new Error(`Este cliente tiene ${allowed} pestaña(s) autorizada(s). Aumenta su contratación para agregar otra.`);
    }
    const baseSlug = (sp.slug || sp.name).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `espacio-${Date.now()}`;
    let slug = baseSlug;
    if (!sp.id) {
      let n = 2;
      while ((await supabaseAdmin.from("menu_spaces").select("id").eq("slug", slug).maybeSingle()).data) slug = `${baseSlug}-${n++}`;
    }
    const payload = { business_id: sp.businessId, kind: sp.kind, name: sp.name.trim(), subtitle: sp.subtitle, image_url: sp.imageUrl, slug, hidden: sp.hidden, sort_index: sp.sortIndex, notice_enabled: sp.noticeEnabled, notice_title: sp.noticeTitle, notice_message: sp.noticeMessage, updated_at: new Date().toISOString() };
    const q = sp.id ? supabaseAdmin.from("menu_spaces").update(payload).eq("id", sp.id).select("*").single() : supabaseAdmin.from("menu_spaces").insert(payload).select("*").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    if (!sp.id) {
      const saved = rowToSpace(row as Record<string, unknown>);
      const categoryName = sp.kind === "menu" ? "Platillos" : sp.kind === "directory" ? "Negocios" : "General";
      const { data: cat } = await supabaseAdmin.from("menu_categories").insert({ business_id: sp.businessId, space_id: saved.id, name: categoryName, sort_index: 0 }).select("id").single();
      await supabaseAdmin.from("menu_items").insert({ business_id: sp.businessId, space_id: saved.id, category_id: cat?.id ?? null, name: sp.kind === "menu" ? "Platillo de ejemplo" : sp.kind === "directory" ? "Negocio de ejemplo" : "Producto o servicio de ejemplo", description: "Edita esta tarjeta con tu información.", price: 0, price_text: sp.kind === "directory" ? "" : "Consultar", available: true, sort_index: 0 });
    }
    return rowToSpace(row as Record<string, unknown>);
  });

export const menusDeleteSpace = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ code, id: z.string().uuid(), businessId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("menu_spaces").select("id", { count: "exact", head: true }).eq("business_id", data.businessId);
    if ((count ?? 0) <= 1) throw new Error("El cliente debe conservar al menos una pestaña.");
    const { error } = await supabaseAdmin.from("menu_spaces").delete().eq("id", data.id).eq("business_id", data.businessId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Elimina un negocio con todo su catálogo. */
export const menusDeleteBusiness = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ code, id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("menu_businesses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Crea o actualiza una categoría. */
export const menusSaveCategory = createServerFn({ method: "POST" })
  .validator((d: unknown) => categorySchema.parse(d))
  .handler(async ({ data }): Promise<MenuCategory> => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rowToCategory } = await import("./menus.server");
    const c = data.category;
    const payload = { business_id: c.businessId, space_id: c.spaceId, parent_id: c.parentId, name: c.name.trim(), image_url: c.imageUrl, hidden: c.hidden, sort_index: c.sortIndex };
    const q = c.id
      ? supabaseAdmin.from("menu_categories").update(payload).eq("id", c.id).select("*").single()
      : supabaseAdmin.from("menu_categories").insert(payload).select("*").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return rowToCategory(row as Record<string, unknown>);
  });

/** Elimina una categoría (sus productos quedan sin categoría). */
export const menusDeleteCategory = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ code, id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("menu_categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Crea o actualiza un producto. */
export const menusSaveItem = createServerFn({ method: "POST" })
  .validator((d: unknown) => itemSchema.parse(d))
  .handler(async ({ data }): Promise<MenuItem> => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rowToItem } = await import("./menus.server");
    const i = data.item;
    const payload = {
      business_id: i.businessId,
      space_id: i.spaceId,
      category_id: i.categoryId,
      name: i.name.trim(),
      description: i.description,
      price: i.price,
      price_text: i.priceText,
      image_url: i.imageUrl,
      whatsapp: i.whatsapp,
      whatsapp_message: i.whatsappMessage,
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
  .validator((d: unknown) => z.object({ code, id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("menu_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Registra una renovación manual conservando el día de corte original. */
export const menusRenewContract = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ code, id: z.string().uuid(), amount: z.number().min(0).default(0), note: z.string().max(300).default("") }).parse(d))
  .handler(async ({ data }) => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rowToBusiness } = await import("./menus.server");
    const { data: row } = await supabaseAdmin.from("menu_businesses").select("*").eq("id", data.id).single();
    if (!row) throw new Error("Cliente no encontrado");
    const b = rowToBusiness(row as Record<string, unknown>);
    const old = b.expiresOn;
    const anchor = old ? new Date(`${old}T12:00:00`) : new Date();
    const billing = b.billingDay || anchor.getDate();
    let y = anchor.getFullYear(), m = anchor.getMonth() + 1;
    const today = new Date(); today.setHours(0,0,0,0);
    let next: Date;
    do {
      if (m > 11) { y++; m = 0; }
      const last = new Date(y, m + 1, 0).getDate();
      next = new Date(y, m, Math.min(billing, last), 12);
      m++;
    } while (next.getTime() <= today.getTime());
    const newExpires = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,"0")}-${String(next.getDate()).padStart(2,"0")}`;
    const { data: savedRow, error } = await supabaseAdmin.from("menu_businesses").update({ expires_on: newExpires, billing_day: billing, active: true, access_suspended: false }).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("contract_renewals").insert({ business_id: data.id, previous_expires_on: old, new_expires_on: newExpires, amount: data.amount, note: data.note });
    return rowToBusiness(savedRow as Record<string, unknown>);
  });

/* --------------------- Bitácora, respaldo y varios administradores -------------------- */

/** Historial de cambios de un negocio (quién, cuándo y qué cambió). */
export const menusAudit = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        code,
        businessId: z.string().min(1),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<MenuAuditEntry[]> => {
    await gate(data.code);
    const { listAudit } = await import("./menus.server");
    return listAudit(data.businessId, data.limit);
  });

/** Respaldo JSON del catálogo de un negocio (queda guardado como versión). */
export const menusExport = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ code, businessId: z.string().min(1) }).parse(d))
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
  categories: z
    .array(z.object({ name: z.string(), sortIndex: z.number().int().default(0) }))
    .default([]),
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
  .validator((d: unknown) =>
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
  .handler(
    async ({
      data,
    }): Promise<{
      categories: number;
      items: number;
      resumen: string;
      snapshotVersion: number;
    }> => {
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
    },
  );

/** Versiones de respaldo guardadas de un negocio. */
export const menusBackups = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ code, businessId: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<MenuBackupVersion[]> => {
    await gate(data.code);
    const { listBackups } = await import("./menus.server");
    return listBackups(data.businessId);
  });

/** Restaura el catálogo a una versión guardada (sin tocar otros negocios). */
export const menusRestoreBackup = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        code,
        businessId: z.string().min(1),
        backupId: z.string().min(1),
        replace: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      categories: number;
      items: number;
      resumen: string;
      snapshotVersion: number;
    }> => {
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
    },
  );

/** Prende o apaga que el negocio tenga varios administradores. */
export const menusSetMultiAdmin = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
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
  .validator((d: unknown) => z.object({ code, businessId: z.string().min(1) }).parse(d))
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
  .validator((d: unknown) =>
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
  .validator((d: unknown) =>
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
