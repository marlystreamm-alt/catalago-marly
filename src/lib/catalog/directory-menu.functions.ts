import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const adminCode = z.string().min(4);
const code = () => Math.random().toString(36).slice(2, 8).toUpperCase() + Date.now().toString(36).slice(-3).toUpperCase();
const cleanSlug = (v: string) => v.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `menu-${Date.now()}`;

const listingRequest = z.object({
  catalogId: z.string().min(1),
  businessName: z.string().min(2).max(100),
  contactName: z.string().min(2).max(100),
  whatsapp: z.string().min(7).max(30),
  email: z.string().email().or(z.literal("")),
  description: z.string().max(900).default(""),
  category: z.string().max(100).default(""),
  schedule: z.string().max(200).default(""),
  address: z.string().max(300).default(""),
  mapUrl: z.string().max(700).default(""),
  image: z.string().max(2200000).default(""),
});

async function gate(value: string) {
  const { requireAdminCode } = await import("@/lib/notify/notify.server");
  await requireAdminCode(value);
}

/** Solicitud principal: dar de alta el negocio en el directorio. No incluye menú. */
export const directorySubmitRequest = createServerFn({ method: "POST" })
  .validator((d: unknown) => listingRequest.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lookup = code();
    const { data: row, error } = await supabaseAdmin.from("directory_menu_requests").insert({
      lookup_code: lookup,
      catalog_id: data.catalogId,
      service_id: "",
      service_name: data.businessName.trim(),
      business_name: data.businessName.trim(),
      contact_name: data.contactName.trim(),
      whatsapp: data.whatsapp.trim(),
      email: data.email.trim(),
      status: "directory_pending",
      directory_status: "pending",
      menu_status: "not_requested",
      directory_description: data.description.trim(),
      directory_category: data.category.trim(),
      directory_schedule: data.schedule.trim(),
      directory_address: data.address.trim(),
      directory_map_url: data.mapUrl.trim(),
      directory_image: data.image,
      payment_amount: 100,
      payment_months: 3,
    }).select("id,lookup_code,directory_status,menu_status").single();
    if (error) throw new Error(error.message);
    try {
      const { notifyAlexaEvent } = await import("@/lib/notify/notify.server");
      await notifyAlexaEvent("directory_request", `Nueva solicitud de directorio. Negocio: ${data.businessName.trim()}.`);
    } catch (notifyError) {
      console.error("No se pudo avisar la solicitud de directorio:", notifyError);
    }
    return row;
  });

/** El dueño solicita después el extra de menú usando el código de su alta. */
export const directoryRequestMenuExtra = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ lookupCode: z.string().min(5), serviceId: z.string().min(1), spaceType: z.enum(["catalog","menu","directory"]).default("menu") }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lookup = data.lookupCode.trim().toUpperCase();
    const { data: row, error } = await supabaseAdmin.from("directory_menu_requests")
      .select("id,directory_status,directory_service_id,menu_status,business_name")
      .eq("lookup_code", lookup)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Código de negocio no encontrado");
    if (row.directory_status !== "approved") throw new Error("El negocio todavía no está aprobado en el directorio");
    if (row.directory_service_id && row.directory_service_id !== data.serviceId) throw new Error("Ese código pertenece a otro negocio");
    const { error: upErr } = await supabaseAdmin.from("directory_menu_requests").update({
      menu_status: "requested",
      plan_space_type: data.spaceType,
      menu_requested_at: new Date().toISOString(),
      status: "menu_requested",
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    if (upErr) throw new Error(upErr.message);
    try {
      const { notifyAlexaEvent } = await import("@/lib/notify/notify.server");
      await notifyAlexaEvent("menu_extra_request", `Solicitud de espacio exclusivo. Negocio: ${row.business_name ?? "sin nombre"}.`);
    } catch (notifyError) {
      console.error("No se pudo avisar la solicitud de menú extra:", notifyError);
    }
    return { ok: true as const };
  });


export const directoryRequestPilot = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ lookupCode: z.string().min(5), serviceId: z.string().min(1), spaceType: z.enum(["catalog","menu","directory"]) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lookup = data.lookupCode.trim().toUpperCase();
    const { data: row, error } = await supabaseAdmin.from("directory_menu_requests").select("id,directory_status,directory_service_id,business_name").eq("lookup_code", lookup).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Código de negocio no encontrado");
    if (row.directory_status !== "approved") throw new Error("El negocio todavía no está aprobado en el directorio");
    if (row.directory_service_id && row.directory_service_id !== data.serviceId) throw new Error("Ese código pertenece a otro negocio");
    const { error: upErr } = await supabaseAdmin.from("directory_menu_requests").update({ trial_status: "requested", trial_space_type: data.spaceType, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true as const };
  });

export const directoryAdminStartPilot = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ code: adminCode, id: z.string().uuid(), endsOn: z.string().min(10).max(10) }).parse(d))
  .handler(async ({ data }) => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req, error } = await supabaseAdmin.from("directory_menu_requests").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!req) throw new Error("Solicitud no encontrada");
    if (req.trial_status !== "requested") throw new Error("La prueba piloto no está solicitada");
    let slug = cleanSlug(req.business_name); let n = 2;
    while ((await supabaseAdmin.from("menu_businesses").select("id").eq("slug", slug).maybeSingle()).data) slug = `${cleanSlug(req.business_name)}-${n++}`;
    const { data: business, error: bErr } = await supabaseAdmin.from("menu_businesses").insert({ name:req.business_name, slug, owner_name:req.contact_name, whatsapp:req.whatsapp, address:req.directory_address ?? "", notes:"Prueba piloto gratis y sin compromiso", active:false, sort_index:999, logo_url:"", expires_on:data.endsOn, features:{}, access_username:"", access_salt:"", access_hash:"", access_temp:false, access_suspended:true, access_updated_at:new Date().toISOString(), allowed_spaces:1, plan_name:"Prueba piloto", renewal_price:100, grace_days:1, contract_started_on:new Date().toISOString().slice(0,10) }).select("id").single();
    if (bErr) throw new Error(bErr.message);
    const kind = req.trial_space_type || "catalog";
    const { data: space, error: spErr } = await supabaseAdmin.from("menu_spaces").insert({ business_id:business.id, kind, name:req.business_name, subtitle: kind === "menu" ? "Menú" : kind === "directory" ? "Directorio" : "Catálogo", image_url:"", slug:`${slug}-${kind}`, hidden:false, sort_index:0 }).select("id,slug").single();
    if (spErr) throw new Error(spErr.message);
    const { data: cat } = await supabaseAdmin.from("menu_categories").insert({ business_id:business.id, space_id:space.id, name:"Principal", sort_index:0 }).select("id").single();
    await supabaseAdmin.from("menu_items").insert({ business_id:business.id, space_id:space.id, category_id:cat?.id ?? null, name:"Tarjeta de ejemplo", description:"Edita esta tarjeta durante tu prueba piloto.", price:0, price_text:"Consultar", available:true, sort_index:0 });
    await supabaseAdmin.from("directory_menu_requests").update({ trial_status:"client_prepared", trial_ends_on:data.endsOn, trial_business_id:business.id, trial_url:`/${space.slug}`, updated_at:new Date().toISOString() }).eq("id", data.id);
    return { ok:true as const, businessId:business.id, trialUrl:`/${space.slug}` };
  });

export const directoryLookupRequest = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ lookupCode: z.string().min(5) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("directory_menu_requests")
      .select("lookup_code,business_name,directory_status,menu_status,payment_amount,payment_months,payment_instructions,payment_proof,menu_url,access_username,admin_note,directory_service_id,trial_status,trial_space_type,trial_ends_on,trial_url,plan_space_type")
      .eq("lookup_code", data.lookupCode.trim().toUpperCase()).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Solicitud no encontrada");
    return row;
  });

export const directoryUploadProof = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ lookupCode: z.string().min(5), proof: z.string().min(20).max(2200000) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("directory_menu_requests").update({
      payment_proof: data.proof,
      menu_status: "proof_uploaded",
      status: "menu_proof_uploaded",
      updated_at: new Date().toISOString(),
    }).eq("lookup_code", data.lookupCode.trim().toUpperCase()).in("menu_status", ["payment_pending", "proof_uploaded"])
      .select("business_name").maybeSingle();
    if (error) throw new Error(error.message);
    try {
      const { notifyAlexaEvent } = await import("@/lib/notify/notify.server");
      await notifyAlexaEvent("payment_proof", `Comprobante de pago recibido${row?.business_name ? ` de ${row.business_name}` : ""}.`);
    } catch (notifyError) {
      console.error("No se pudo avisar el comprobante:", notifyError);
    }
    return { ok: true as const };
  });

export const directoryAdminList = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ code: adminCode, catalogId: z.string().optional() }).parse(d))
  .handler(async ({ data }) => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("directory_menu_requests").select("*").order("created_at", { ascending: false });
    if (data.catalogId) q = q.eq("catalog_id", data.catalogId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Aprueba solo el alta en directorio y enlaza la tarjeta creada en el catálogo local. */
export const directoryAdminApproveListing = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ code: adminCode, id: z.string().uuid(), serviceId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req, error } = await supabaseAdmin.from("directory_menu_requests").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!req) throw new Error("Solicitud no encontrada");
    const { error: upErr } = await supabaseAdmin.from("directory_menu_requests").update({
      directory_status: "approved",
      directory_service_id: data.serviceId,
      directory_approved_at: new Date().toISOString(),
      service_id: data.serviceId,
      status: "directory_active",
      updated_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (upErr) throw new Error(upErr.message);
    return {
      id: req.id,
      serviceId: data.serviceId,
      businessName: req.business_name,
      description: req.directory_description ?? "",
      category: req.directory_category ?? "",
      schedule: req.directory_schedule ?? "",
      address: req.directory_address ?? "",
      mapUrl: req.directory_map_url ?? "",
      contactName: req.contact_name ?? "",
      whatsapp: req.whatsapp ?? "",
      image: req.directory_image ?? "",
    };
  });

export const directoryAdminRejectListing = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ code: adminCode, id: z.string().uuid(), note: z.string().default("") }).parse(d))
  .handler(async ({ data }) => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("directory_menu_requests").update({
      directory_status: "rejected", status: "directory_rejected", admin_note: data.note, updated_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Solo después de que el dueño pidió el extra se le envían datos de pago. */
export const directoryAdminRequestMenuPayment = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ code: adminCode, id: z.string().uuid(), paymentInstructions: z.string().min(3).max(1000) }).parse(d))
  .handler(async ({ data }) => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("directory_menu_requests").update({
      menu_status: "payment_pending", payment_instructions: data.paymentInstructions, status: "menu_payment_pending", updated_at: new Date().toISOString(),
    }).eq("id", data.id).eq("menu_status", "requested");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const directoryAdminRejectMenu = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ code: adminCode, id: z.string().uuid(), note: z.string().default("") }).parse(d))
  .handler(async ({ data }) => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("directory_menu_requests").update({
      menu_status: "rejected", admin_note: data.note, status: "directory_active", updated_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Valida el pago y PREPARA el registro en Mis clientes. No lo activa ni concede permisos. */
export const directoryAdminPrepareClient = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ code: adminCode, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req, error: reqErr } = await supabaseAdmin.from("directory_menu_requests").select("*").eq("id", data.id).maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Error("Solicitud no encontrada");
    if (req.menu_status !== "proof_uploaded") throw new Error("Primero debe recibirse el comprobante");
    if (req.menu_business_id) return { ok: true as const, businessId: req.menu_business_id, serviceId: req.directory_service_id, businessName: req.business_name };

    let slug = cleanSlug(req.business_name); let n = 2;
    while ((await supabaseAdmin.from("menu_businesses").select("id").eq("slug", slug).maybeSingle()).data) slug = `${cleanSlug(req.business_name)}-${n++}`;
    const start = new Date(); const expiry = new Date(start); expiry.setMonth(expiry.getMonth() + 3);
    const lockedFeatures = {
      show_prices: false, show_photos: false, show_descriptions: false, show_whatsapp: false, show_address: false,
      edit_prices: false, edit_item_text: false, edit_photos: false, add_items: false, delete_items: false,
      edit_categories: false, toggle_items: false, edit_business: false, per_item_whatsapp: false,
      stock_manager: false, stock_add: false, stock_edit: false, stock_delete: false, stock_assign: false,
      stock_view_password: false, stock_export: false, protected_deliveries: false, notices: false,
    };
    const { data: business, error: bErr } = await supabaseAdmin.from("menu_businesses").insert({
      name: req.business_name,
      slug,
      owner_name: req.contact_name,
      whatsapp: req.whatsapp,
      address: req.directory_address ?? "",
      notes: "Solicitud de menú extra desde Agenda · pago validado · pendiente de configurar y activar en Mis clientes",
      active: false,
      sort_index: 999,
      logo_url: "",
      expires_on: expiry.toISOString().slice(0, 10),
      features: lockedFeatures,
      access_username: "",
      access_salt: "",
      access_hash: "",
      access_temp: false,
      access_suspended: true,
      access_updated_at: new Date().toISOString(),
      allowed_spaces: 1,
      plan_name: `Espacio exclusivo ${req.plan_space_type || "menu"} · 3 meses`,
      renewal_price: 100,
      grace_days: 1,
      contract_started_on: start.toISOString().slice(0, 10),
    }).select("id").single();
    if (bErr) throw new Error(bErr.message);

    const { data: space, error: spErr } = await supabaseAdmin.from("menu_spaces").insert({
      business_id: business.id, kind: (req.plan_space_type || "menu"), name: req.business_name, subtitle: req.plan_space_type === "catalog" ? "Catálogo" : req.plan_space_type === "directory" ? "Directorio" : "Menú digital", image_url: "", slug: `${slug}-${req.plan_space_type || "menu"}`, hidden: false, sort_index: 0,
    }).select("id,slug").single();
    if (spErr) throw new Error(spErr.message);
    const { data: cat } = await supabaseAdmin.from("menu_categories").insert({ business_id: business.id, space_id: space.id, name: "Productos", sort_index: 0 }).select("id").single();
    await supabaseAdmin.from("menu_items").insert({ business_id: business.id, space_id: space.id, category_id: cat?.id ?? null, name: "Producto de ejemplo", description: "Edita o elimina esta tarjeta cuando actives los permisos del cliente.", price: 0, price_text: "Consultar", available: true, sort_index: 0 });

    await supabaseAdmin.from("directory_menu_requests").update({
      menu_status: "client_prepared",
      status: "menu_client_prepared",
      menu_business_id: business.id,
      menu_url: `/${space.slug}`,
      payment_confirmed_at: new Date().toISOString(),
      client_prepared_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", data.id);

    return { ok: true as const, businessId: business.id, serviceId: req.directory_service_id, businessName: req.business_name };
  });

/** Después de configurar/activar al cliente en Mis clientes, publica el enlace en su tarjeta del directorio. */
export const directoryAdminPublishMenuLink = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ code: adminCode, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await gate(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req, error } = await supabaseAdmin.from("directory_menu_requests").select("menu_business_id,menu_url,directory_service_id,business_name").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!req?.menu_business_id || !req.menu_url) throw new Error("Primero prepara el cliente desde la solicitud");
    const { data: business, error: bErr } = await supabaseAdmin.from("menu_businesses").select("active,access_suspended,access_username").eq("id", req.menu_business_id).maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!business?.active || business.access_suspended || !business.access_username) throw new Error("Todavía falta activar la cuenta, asignar acceso y permisos desde Mis clientes");
    await supabaseAdmin.from("directory_menu_requests").update({ menu_status: "active", status: "menu_active", access_username: business.access_username, updated_at: new Date().toISOString() }).eq("id", data.id);
    return { ok: true as const, menuUrl: req.menu_url, serviceId: req.directory_service_id, businessName: req.business_name };
  });
