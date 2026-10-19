/** Funciones del dueño del catálogo (modo "Mi menú"), validadas con su token de sesión. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { MenuCategory, MenuItem, MenuSpace, OwnerData } from "./types";

const token = z.string().min(10);

export const ownerSignIn = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ username: z.string().min(1).max(80), password: z.string().min(4).max(120) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ token: string; mustChangePassword: boolean }> => {
    const { ownerLogin } = await import("./menus.server");
    const { token: t, mustChange } = await ownerLogin(data.username, data.password);
    return { token: t, mustChangePassword: mustChange };
  });

export const ownerLoad = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ token }).parse(d))
  .handler(async ({ data }): Promise<OwnerData> => {
    const { requireOwnerCtx, loadMenu } = await import("./menus.server");
    const { business, actor, kind } = await requireOwnerCtx(data.token);
    const menu = await loadMenu(business.id);
    return {
      ...menu,
      features: business.features,
      mustChangePassword: kind === "dueno" ? business.accessTemp : false,
      actorName: actor,
    };
  });

export const ownerSignOut = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ token }).parse(d))
  .handler(async ({ data }) => {
    const { ownerLogout } = await import("./menus.server");
    await ownerLogout(data.token);
    return { ok: true as const };
  });

export const ownerChangePassword = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ token, password: z.string().min(6, "Mínimo 6 caracteres").max(120) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireOwnerCtx, hashPassword, randomSalt, logAudit } = await import("./menus.server");
    const { business, actor, kind, adminId } = await requireOwnerCtx(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const salt = randomSalt();
    const hash = await hashPassword(data.password, salt);
    const error =
      kind === "equipo"
        ? (
            await supabaseAdmin
              .from("menu_admins")
              .update({ access_salt: salt, access_hash: hash, access_temp: false })
              .eq("id", adminId)
          ).error
        : (
            await supabaseAdmin
              .from("menu_businesses")
              .update({
                access_salt: salt,
                access_hash: hash,
                access_updated_at: new Date().toISOString(),
                access_temp: false,
              })
              .eq("id", business.id)
          ).error;
    if (error) throw new Error(error.message);
    await logAudit({
      businessId: business.id,
      actorKind: kind,
      actorName: actor,
      action: "acceso",
      target: "Contraseña",
      field: "Cambió su contraseña",
    });
    return { ok: true as const };
  });

export const ownerSaveBusiness = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        token,
        name: z.string().min(1).max(80),
        whatsapp: z.string().max(40).default(""),
        address: z.string().max(160).default(""),
        logoUrl: z.string().max(500).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireOwnerCtx, requireFeature, logAudit } = await import("./menus.server");
    const { business, actor, kind } = await requireOwnerCtx(data.token);
    requireFeature(business, "edit_business");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("menu_businesses")
      .update({
        name: data.name.trim(),
        whatsapp: data.whatsapp,
        address: data.address,
        logo_url: data.logoUrl,
      })
      .eq("id", business.id);
    if (error) throw new Error(error.message);
    const changes: [string, string, string][] = [];
    if (data.name.trim() !== business.name)
      changes.push(["Nombre", business.name, data.name.trim()]);
    if (data.whatsapp !== business.whatsapp)
      changes.push(["WhatsApp", business.whatsapp, data.whatsapp]);
    if (data.address !== business.address)
      changes.push(["Dirección", business.address, data.address]);
    if (data.logoUrl !== business.logoUrl)
      changes.push(["Logo", business.logoUrl ? "sí" : "no", data.logoUrl ? "sí" : "no"]);
    for (const [field, before, after] of changes)
      await logAudit({
        businessId: business.id,
        actorKind: kind,
        actorName: actor,
        action: "negocio",
        target: business.name,
        field,
        before,
        after,
      });
    return { ok: true as const };
  });

export const ownerSaveSpace = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({
    token,
    id: z.string().uuid().optional(),
    kind: z.enum(["catalog", "menu", "directory", "marketplace"]),
    name: z.string().min(1).max(80),
    subtitle: z.string().max(180).default(""),
    imageUrl: z.string().default(""),
    slug: z.string().default(""),
    hidden: z.boolean().default(false),
    sortIndex: z.number().int().default(0),
    noticeEnabled: z.boolean().default(false),
    noticeTitle: z.string().max(80).default(""),
    noticeMessage: z.string().max(500).default(""),
  }).parse(d))
  .handler(async ({ data }): Promise<MenuSpace> => {
    const { requireOwnerCtx, rowToSpace } = await import("./menus.server");
    const { business } = await requireOwnerCtx(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!data.id) {
      const { count } = await supabaseAdmin.from("menu_spaces").select("id", { count: "exact", head: true }).eq("business_id", business.id);
      if ((count ?? 0) >= business.allowedSpaces) throw new Error(`Tu contratación permite ${business.allowedSpaces} pestaña(s). Solicita una pestaña adicional al administrador.`);
    }
    let slug = (data.slug || data.name).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `espacio-${Date.now()}`;
    if (!data.id) { let n = 2; while ((await supabaseAdmin.from("menu_spaces").select("id").eq("slug", slug).maybeSingle()).data) slug = `${slug}-${n++}`; }
    const payload = { business_id: business.id, kind: data.kind, name: data.name.trim(), subtitle: data.subtitle, image_url: data.imageUrl, slug, hidden: data.hidden, sort_index: data.sortIndex, notice_enabled: business.features.notices ? data.noticeEnabled : false, notice_title: business.features.notices ? data.noticeTitle : "", notice_message: business.features.notices ? data.noticeMessage : "", updated_at: new Date().toISOString() };
    const q = data.id ? supabaseAdmin.from("menu_spaces").update(payload).eq("id", data.id).eq("business_id", business.id).select("*").single() : supabaseAdmin.from("menu_spaces").insert(payload).select("*").single();
    const { data: row, error } = await q; if (error) throw new Error(error.message);
    if (!data.id) {
      const saved = rowToSpace(row as Record<string, unknown>);
      const cname = data.kind === "menu" ? "Platillos" : data.kind === "directory" ? "Negocios" : data.kind === "marketplace" ? "Productos" : "General";
      const { data: cat } = await supabaseAdmin.from("menu_categories").insert({ business_id: business.id, space_id: saved.id, name: cname, sort_index: 0 }).select("id").single();
      await supabaseAdmin.from("menu_items").insert({ business_id: business.id, space_id: saved.id, category_id: cat?.id ?? null, name: data.kind === "menu" ? "Platillo de ejemplo" : data.kind === "directory" ? "Negocio de ejemplo" : data.kind === "marketplace" ? "Producto de ejemplo" : "Producto o servicio de ejemplo", description: "Edita esta tarjeta con tu información.", price: 0, price_text: data.kind === "directory" ? "" : "Consultar", available: true, sort_index: 0 });
    }
    return rowToSpace(row as Record<string, unknown>);
  });

export const ownerDeleteSpace = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ token, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireOwnerCtx } = await import("./menus.server");
    const { business } = await requireOwnerCtx(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("menu_spaces").select("id", { count: "exact", head: true }).eq("business_id", business.id);
    if ((count ?? 0) <= 1) throw new Error("Debes conservar al menos una pestaña.");
    const { error } = await supabaseAdmin.from("menu_spaces").delete().eq("id", data.id).eq("business_id", business.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const ownerSaveCategory = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        token,
        id: z.string().optional(),
        spaceId: z.string().uuid(),
        parentId: z.string().uuid().nullable().default(null),
        name: z.string().min(1).max(60),
        imageUrl: z.string().max(1000).default(""),
        hidden: z.boolean().default(false),
        sortIndex: z.number().int().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<MenuCategory> => {
    const { requireOwnerCtx, requireFeature, rowToCategory, logAudit } =
      await import("./menus.server");
    const { business, actor, kind } = await requireOwnerCtx(data.token);
    requireFeature(business, "edit_categories");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      business_id: business.id,
      space_id: data.spaceId,
      parent_id: data.parentId,
      name: data.name.trim(),
      image_url: data.imageUrl,
      hidden: data.hidden,
      sort_index: data.sortIndex,
    };
    const q = data.id
      ? supabaseAdmin
          .from("menu_categories")
          .update(payload)
          .eq("id", data.id)
          .eq("business_id", business.id)
          .select("*")
          .single()
      : supabaseAdmin.from("menu_categories").insert(payload).select("*").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    await logAudit({
      businessId: business.id,
      actorKind: kind,
      actorName: actor,
      action: data.id ? "categoria" : "creacion",
      target: data.name.trim(),
      field: data.id ? "Editó la categoría" : "Creó la categoría",
    });
    return rowToCategory(row as Record<string, unknown>);
  });

export const ownerDeleteCategory = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ token, id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { requireOwnerCtx, requireFeature, logAudit } = await import("./menus.server");
    const { business, actor, kind } = await requireOwnerCtx(data.token);
    requireFeature(business, "edit_categories");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prev } = await supabaseAdmin
      .from("menu_categories")
      .select("name")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin
      .from("menu_categories")
      .delete()
      .eq("id", data.id)
      .eq("business_id", business.id);
    if (error) throw new Error(error.message);
    await logAudit({
      businessId: business.id,
      actorKind: kind,
      actorName: actor,
      action: "eliminacion",
      target: String((prev as { name?: string } | null)?.name ?? "Categoría"),
      field: "Eliminó la categoría",
    });
    return { ok: true as const };
  });

export const ownerSaveItem = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        token,
        id: z.string().optional(),
        spaceId: z.string().uuid(),
        categoryId: z.string().nullable().default(null),
        name: z.string().min(1).max(80),
        description: z.string().max(400).default(""),
        price: z.number().min(0).default(0),
        priceText: z.string().default(""),
        imageUrl: z.string().default(""),
        whatsapp: z.string().max(40).default(""),
        whatsappMessage: z.string().max(240).default(""),
        available: z.boolean().default(true),
        condition: z.enum(["new","used"]).default("new"),
        sortIndex: z.number().int().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<MenuItem> => {
    const { requireOwnerCtx, requireFeature, rowToItem, logAudit } = await import("./menus.server");
    const { business, actor, kind } = await requireOwnerCtx(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!data.id) {
      requireFeature(business, "add_items");
      const { data: row, error } = await supabaseAdmin
        .from("menu_items")
        .insert({
          business_id: business.id,
          space_id: data.spaceId,
          category_id: data.categoryId,
          name: data.name.trim(),
          description: data.description,
          price: data.price,
          price_text: data.priceText,
          image_url: data.imageUrl,
          whatsapp: data.whatsapp,
          whatsapp_message: data.whatsappMessage,
          available: data.available,
          item_condition: data.condition,
          sort_index: data.sortIndex,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      await logAudit({
        businessId: business.id,
        actorKind: kind,
        actorName: actor,
        action: "creacion",
        target: data.name.trim(),
        field: "Creó el producto",
      });
      return rowToItem(row as Record<string, unknown>);
    }

    const { data: current } = await supabaseAdmin
      .from("menu_items")
      .select("*")
      .eq("id", data.id)
      .eq("business_id", business.id)
      .maybeSingle();
    if (!current) throw new Error("Producto no encontrado");
    const prev = rowToItem(current as Record<string, unknown>);

    if (data.price !== prev.price || data.priceText !== prev.priceText)
      requireFeature(business, "edit_prices");
    if (data.name.trim() !== prev.name || data.description !== prev.description || data.condition !== (prev.condition ?? "new"))
      requireFeature(business, "edit_item_text");
    if (data.imageUrl !== prev.imageUrl) requireFeature(business, "edit_photos");
    if (data.whatsapp !== prev.whatsapp || data.whatsappMessage !== prev.whatsappMessage) requireFeature(business, "per_item_whatsapp");
    if (data.available !== prev.available) requireFeature(business, "toggle_items");
    if (data.categoryId !== prev.categoryId || data.spaceId !== prev.spaceId) requireFeature(business, "edit_categories");

    const { data: row, error } = await supabaseAdmin
      .from("menu_items")
      .update({
        space_id: data.spaceId,
        category_id: data.categoryId,
        name: data.name.trim(),
        description: data.description,
        price: data.price,
        price_text: data.priceText,
        image_url: data.imageUrl,
        whatsapp: data.whatsapp,
        whatsapp_message: data.whatsappMessage,
        available: data.available,
        item_condition: data.condition,
        sort_index: data.sortIndex,
      })
      .eq("id", data.id)
      .eq("business_id", business.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const changes: [string, string, string, string][] = [];
    if (data.price !== prev.price)
      changes.push(["precio", "Precio", `$${prev.price}`, `$${data.price}`]);
    if (data.priceText !== prev.priceText)
      changes.push(["precio", "Precio en texto", prev.priceText, data.priceText]);
    if (data.name.trim() !== prev.name)
      changes.push(["edicion", "Nombre", prev.name, data.name.trim()]);
    if (data.description !== prev.description)
      changes.push(["edicion", "Descripción", prev.description, data.description]);
    if (data.imageUrl !== prev.imageUrl)
      changes.push(["edicion", "Foto", prev.imageUrl ? "sí" : "no", data.imageUrl ? "sí" : "no"]);
    if (data.available !== prev.available)
      changes.push([
        "estado",
        "Disponible",
        prev.available ? "sí" : "no",
        data.available ? "sí" : "no",
      ]);
    for (const [action, field, before, after] of changes)
      await logAudit({
        businessId: business.id,
        actorKind: kind,
        actorName: actor,
        action,
        target: data.name.trim(),
        field,
        before,
        after,
      });

    return rowToItem(row as Record<string, unknown>);
  });

export const ownerDeleteItem = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ token, id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { requireOwnerCtx, requireFeature, logAudit } = await import("./menus.server");
    const { business, actor, kind } = await requireOwnerCtx(data.token);
    requireFeature(business, "delete_items");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prev } = await supabaseAdmin
      .from("menu_items")
      .select("name")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin
      .from("menu_items")
      .delete()
      .eq("id", data.id)
      .eq("business_id", business.id);
    if (error) throw new Error(error.message);
    await logAudit({
      businessId: business.id,
      actorKind: kind,
      actorName: actor,
      action: "eliminacion",
      target: String((prev as { name?: string } | null)?.name ?? "Producto"),
      field: "Eliminó el producto",
    });
    return { ok: true as const };
  });
