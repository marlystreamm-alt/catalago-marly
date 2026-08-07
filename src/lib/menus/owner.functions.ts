/** Funciones del dueño del catálogo (modo "Mi menú"), validadas con su token de sesión. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { MenuCategory, MenuItem, OwnerData } from "./types";

const token = z.string().min(10);

export const ownerSignIn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().min(1).max(80), password: z.string().min(4).max(120) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ token: string; mustChangePassword: boolean }> => {
    const { ownerLogin } = await import("./menus.server");
    const { token: t, business } = await ownerLogin(data.slug, data.password);
    return { token: t, mustChangePassword: business.accessTemp };
  });

export const ownerLoad = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token }).parse(d))
  .handler(async ({ data }): Promise<OwnerData> => {
    const { requireOwner, loadMenu } = await import("./menus.server");
    const business = await requireOwner(data.token);
    const menu = await loadMenu(business.id);
    return { ...menu, features: business.features, mustChangePassword: business.accessTemp };
  });

export const ownerChangePassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token, password: z.string().min(6, "Mínimo 6 caracteres").max(120) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireOwner, hashPassword, randomSalt } = await import("./menus.server");
    const business = await requireOwner(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const salt = randomSalt();
    const { error } = await supabaseAdmin
      .from("menu_businesses")
      .update({
        access_salt: salt,
        access_hash: await hashPassword(data.password, salt),
        access_updated_at: new Date().toISOString(),
        access_temp: false,
      })
      .eq("id", business.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const ownerSaveBusiness = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
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
    const { requireOwner, requireFeature } = await import("./menus.server");
    const business = await requireOwner(data.token);
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
    return { ok: true as const };
  });

export const ownerSaveCategory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token,
        id: z.string().optional(),
        name: z.string().min(1).max(60),
        sortIndex: z.number().int().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<MenuCategory> => {
    const { requireOwner, requireFeature, rowToCategory } = await import("./menus.server");
    const business = await requireOwner(data.token);
    requireFeature(business, "edit_categories");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      business_id: business.id,
      name: data.name.trim(),
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
    return rowToCategory(row as Record<string, unknown>);
  });

export const ownerDeleteCategory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token, id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { requireOwner, requireFeature } = await import("./menus.server");
    const business = await requireOwner(data.token);
    requireFeature(business, "edit_categories");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("menu_categories")
      .delete()
      .eq("id", data.id)
      .eq("business_id", business.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const ownerSaveItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token,
        id: z.string().optional(),
        categoryId: z.string().nullable().default(null),
        name: z.string().min(1).max(80),
        description: z.string().max(400).default(""),
        price: z.number().min(0).default(0),
        priceText: z.string().max(40).default(""),
        imageUrl: z.string().max(500).default(""),
        available: z.boolean().default(true),
        sortIndex: z.number().int().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<MenuItem> => {
    const { requireOwner, requireFeature, rowToItem } = await import("./menus.server");
    const business = await requireOwner(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!data.id) {
      requireFeature(business, "add_items");
      const { data: row, error } = await supabaseAdmin
        .from("menu_items")
        .insert({
          business_id: business.id,
          category_id: data.categoryId,
          name: data.name.trim(),
          description: data.description,
          price: data.price,
          price_text: data.priceText,
          image_url: data.imageUrl,
          available: data.available,
          sort_index: data.sortIndex,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
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
    if (data.name.trim() !== prev.name || data.description !== prev.description)
      requireFeature(business, "edit_item_text");
    if (data.imageUrl !== prev.imageUrl) requireFeature(business, "edit_photos");
    if (data.available !== prev.available) requireFeature(business, "toggle_items");
    if (data.categoryId !== prev.categoryId) requireFeature(business, "edit_categories");

    const { data: row, error } = await supabaseAdmin
      .from("menu_items")
      .update({
        category_id: data.categoryId,
        name: data.name.trim(),
        description: data.description,
        price: data.price,
        price_text: data.priceText,
        image_url: data.imageUrl,
        available: data.available,
        sort_index: data.sortIndex,
      })
      .eq("id", data.id)
      .eq("business_id", business.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToItem(row as Record<string, unknown>);
  });

export const ownerDeleteItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token, id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { requireOwner, requireFeature } = await import("./menus.server");
    const business = await requireOwner(data.token);
    requireFeature(business, "delete_items");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("menu_items")
      .delete()
      .eq("id", data.id)
      .eq("business_id", business.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
