import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
export const activateMonthlyShop = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z.object({ code: z.string().min(4).max(200), saleId: z.string().uuid() }).parse(v),
  )
  .handler(async ({ data }) => {
    await (await import("@/lib/notify/notify.server")).requireAdminCode(data.code);
    const { opsDB } = await import("@/lib/workspace/operations.server"),
      db = opsDB();
    const existing = await db
      .from("ma2_shop_licenses")
      .select("business_id")
      .eq("sale_request_id", data.saleId)
      .maybeSingle();
    if (existing.error) throw new Error("No se pudo comprobar la contratación");
    if (existing.data) {
      const b = await db
        .from("menu_businesses")
        .select("slug,access_username")
        .eq("id", existing.data.business_id)
        .single();
      if (b.error) throw new Error("Tienda no disponible");
      return {
        slug: String(b.data.slug),
        username: String(b.data.access_username),
        password: "",
        created: false,
      };
    }
    const r = await db
      .from("notification_log")
      .select("detail,status")
      .eq("id", data.saleId)
      .eq("channel", "ma2_sale")
      .maybeSingle();
    if (r.error || !r.data || r.data.status !== "paid")
      throw new Error("Confirma el pago antes de crear la tienda");
    const { decryptPayload } = await import("@/lib/deliveries/deliveries.server"),
      sale = await decryptPayload<import("@/lib/sales/types").SaleRequest>(r.data.detail),
      { randomSalt, hashPassword } = await import("@/lib/menus/menus.server");
    const salt = randomSalt(),
      password = "MA2-" + crypto.randomUUID().replaceAll("-", "").slice(0, 20),
      slug =
        (sale.businessName
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 45) || "tienda") +
        "-" +
        data.saleId.slice(0, 8);
    const { DEFAULT_FEATURES } = await import("@/lib/menus/types");
    const isPro = sale.planId === "pro";
    const features = {
      ...DEFAULT_FEATURES,
      edit_prices: true,
      edit_item_text: true,
      edit_photos: true,
      add_items: true,
      delete_items: true,
      edit_categories: true,
      toggle_items: true,
      edit_business: true,
      stock_manager: true,
      stock_add: true,
      stock_edit: true,
      stock_delete: true,
      stock_assign: true,
      stock_view_password: true,
      stock_export: true,
      protected_deliveries: false,
      notices: true,
    };
    const saved = await db.rpc("ma2_activate_shop", {
      p_sale: data.saleId,
      p_name: sale.businessName,
      p_owner: sale.customerName,
      p_whatsapp: sale.whatsapp,
      p_plan: sale.planName,
      p_monthly: sale.amount,
      p_slug: slug,
      p_username: slug,
      p_hash: await hashPassword(password, salt),
      p_salt: salt,
      p_features: features,
    });
    if (saved.error)
      throw new Error("No se pudo activar. Revisa si ya aparece en Negocios antes de reintentar");
    if (isPro) {
      const enabled = await db.from("menu_businesses").update({ multi_admin: true }).eq("id", saved.data.businessId);
      if (enabled.error) throw new Error("Tienda creada; falta habilitar el equipo PRO");
    }
    return {
      slug,
      username: slug,
      password: saved.data.created ? password : "",
      created: Boolean(saved.data.created),
    };
  });
