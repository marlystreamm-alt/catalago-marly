import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ProtectedDeliveryPrivate } from "@/lib/deliveries/types";
import type { CloudOrder } from "@/lib/notify/types";

const auth = z.object({ code: z.string().min(4).max(200) });
async function context(code: string) {
  const notify = await import("@/lib/notify/notify.server");
  await notify.requireAdminCode(code);
  return { notify, ops: await import("@/lib/workspace/operations.server") };
}

export const webOrderList = createServerFn({ method: "POST" }).validator((v: unknown) => auth.parse(v)).handler(async ({ data }) => {
  const { notify, ops } = await context(data.code);
  const db = ops.opsDB();
  const [paid, requests, imported, clients] = await Promise.all([
    db.from("ma2_customer_orders").select("id,client_id,title,amount_cents,expires_on,created_at").is("business_id", null).order("created_at", { ascending: false }).limit(250),
    db.from("orders").select("*").not("catalog_id", "like", "telegram-%").not("catalog_id", "like", "renewal-%").neq("catalog_id", "wallet-main").neq("catalog_id","customer-request").order("created_at", { ascending: false }).limit(250),
    db.from("cyberdocs_orders").select("id,notification_order_id,status").eq("source_key", "web_catalog"),
    ops.readRecords("clients"),
  ]);
  if (paid.error || requests.error || imported.error) throw new Error("No se pudieron consultar los pedidos de la página");
  const { purchaseRecordId } = await import("./purchase-identity.server");
  const ids = (paid.data || []).map((r: any) => purchaseRecordId("notice", r.id));
  const notice = ids.length ? await db.from("orders").select("id,status").in("id", ids).eq("catalog_id", "wallet-main") : { data: [], error: null };
  if (notice.error) throw new Error("No se pudo consultar el estado de los avisos");
  const requestIds = (requests.data || []).filter((r: any)=>r.catalog_id==="store-ma2").map((r: any)=>r.id);
  const debits = requestIds.length ? await db.from("ma2_wallet_entries").select("request_id").eq("kind","purchase").in("request_id",requestIds) : { data: [], error: null };
  if (debits.error) throw new Error("No se pudo consultar el pago de los pedidos");
  const paidRequests = new Set((debits.data || []).map(r=>String(r.request_id)));
  return {
    paid: (paid.data || []).map((r: any) => {
      const c = clients.find(x => x.id === r.client_id);
      return { id: String(r.id), title: String(r.title), total: Number(r.amount_cents) / 100, createdAt: String(r.created_at), expiresOn: r.expires_on as string | null, client: c?.title || "Cliente", whatsapp: c?.data.whatsapp || "", acknowledged: (notice.data || []).some((n: any) => n.id === purchaseRecordId("notice", r.id) && n.status === "atendido") };
    }) as { id:string;title:string;total:number;createdAt:string;expiresOn:string|null;client:string;whatsapp:string;acknowledged:boolean }[],
    requests: (requests.data || []).map((row: Record<string, unknown>) => {
      const o = notify.rowToOrder(row), linked = (imported.data || []).find((r: any) => r.notification_order_id === o.id);
      return { ...o, paidWithBalance: paidRequests.has(o.id), linkedId: linked?.id as string | undefined, linkedStatus: linked?.status as string | undefined };
    }) as (CloudOrder & {linkedId?: string; linkedStatus?: string})[],
  };
});

/** Read the immutable paid snapshot, never credentials of a different merchant or later stock assignment. */
export const webPaidDelivery = createServerFn({ method: "POST" }).validator((v: unknown) => auth.extend({ id: z.string().uuid(), protected: z.boolean() }).parse(v)).handler(async ({ data }) => {
  const { ops } = await context(data.code);
  const db = ops.opsDB();
  const { data: order, error } = await db.from("ma2_customer_orders").select("*").eq("id", data.id).is("business_id", null).maybeSingle();
  if (error || !order) throw new Error("Compra no disponible");
  const { businessToday } = await import("@/lib/stock/duration");
  if (order.expires_on && order.expires_on < businessToday()) throw new Error("La suscripción está vencida");
  const ds = await import("@/lib/deliveries/deliveries.server");
  const snapshot = order.detail as { username: string; password_cipher: string; profilePin?: string };
  const { password } = await ds.decryptPayload<{password:string}>(snapshot.password_cipher);
  if (!data.protected) return { text: [order.title, `Usuario: ${snapshot.username}`, `Contraseña: ${password}`, snapshot.profilePin ? `Perfil / PIN: ${snapshot.profilePin}` : ""].filter(Boolean).join("\n"), id: "", token: "", password: "" };
  // A stable document ID makes concurrent clicks and retries return the same document.
  const { purchaseRecordId } = await import("./purchase-identity.server");
  const documentId = purchaseRecordId("document", order.id);
  const now = new Date().toISOString();
  const client = await ops.readRecord(order.client_id).catch(() => null);
  const expiryLimit = order.expires_on ? Date.parse(`${order.expires_on}T23:59:59-06:00`) : Infinity;
  const payload: ProtectedDeliveryPrivate = { id: documentId, createdAt: now, updatedAt: now, platform: order.title, client: client?.title || "Cliente", whatsapp: client?.data.whatsapp || "", username: snapshot.username, password, link: "", notes: snapshot.profilePin ? `Perfil / PIN: ${snapshot.profilePin}` : "", images: [], attachment: null, expiresAt: new Date(Math.min(Date.now() + 7*86400000, expiryLimit)).toISOString(), maxViews: null, viewCount: 0, lastViewedAt: null, status: "active", imageCount: 0, protectedWithPassword: true, history: [{ at: now, kind: "created", detail: "Documento de compra con saldo" }], accessPassword: ds.randomToken().slice(0, 12), token: ds.randomToken() };
  const { error: createError } = await db.from("notification_log").upsert({ id: documentId, channel: "protected_delivery", kind: "delivery", attempt: 0, status: "active", detail: await ds.encryptPayload(payload) }, { onConflict: "id", ignoreDuplicates: true });
  if (createError) throw new Error("No se pudo preparar el documento");
  const row = await ds.getDeliveryRow(documentId);
  if (!row) throw new Error("No se pudo recuperar el documento");
  const saved = await ds.decryptPayload<ProtectedDeliveryPrivate>(String(row.detail));
  if (saved.status !== "active" || Date.parse(saved.expiresAt) <= Date.now()) throw new Error("El documento expiró o fue revocado; revisa Entregas protegidas");
  return { text: "", id: saved.id, token: saved.token, password: saved.accessPassword };
});

export const webAcknowledgePaid = createServerFn({ method: "POST" }).validator((v: unknown) => auth.extend({ id: z.string().uuid() }).parse(v)).handler(async ({ data }) => {
  const { ops } = await context(data.code);
  const db = ops.opsDB();
  const { data: purchase, error } = await db.from("ma2_customer_orders").select("id").eq("id", data.id).is("business_id", null).maybeSingle();
  if (error || !purchase) throw new Error("Compra no disponible");
  const { purchaseRecordId } = await import("./purchase-identity.server");
  const id = purchaseRecordId("notice", data.id);
  const result = await db.from("orders").upsert({ id, catalog_id: "wallet-main", catalog_name: "Tienda MA²", service_name: "Compra con saldo", status: "atendido", attended_at: new Date().toISOString() }, { onConflict: "id", ignoreDuplicates: false });
  if (result.error) throw new Error("No se pudo marcar el aviso atendido");
  return { ok: true };
});

export const webPrepareCatalog = createServerFn({ method: "POST" }).validator((v: unknown) => auth.extend({ id: z.string().uuid(), name: z.string().trim().min(2).max(160), whatsapp: z.string().max(40), confirmedPayment: z.literal(true), protected: z.boolean() }).parse(v)).handler(async ({ data }) => {
  const { ops, notify } = await context(data.code);
  const db = ops.opsDB();
  const { data: raw, error } = await db.from("orders").select("*").eq("id", data.id).maybeSingle();
  if (error || !raw || /^(telegram-|renewal-|wallet-main$)/.test(raw.catalog_id)) throw new Error("Solicitud de catálogo no disponible");
  const order = notify.rowToOrder(raw);
  if (order.status !== "nuevo") throw new Error("Esta solicitud ya fue atendida");
  const { normalizedClientPhone, rememberOrderClient } = await import("./remember-client.server");
  const phone = normalizedClientPhone(data.whatsapp);
  if (!phone) throw new Error("Escribe el WhatsApp del comprador, no el de la tienda");
  // Cart orders with several units need explicit item-level handling, not a single stock assignment.
  const units = order.items.length === 1 ? /^\s*(\d+)\s*[x×]/i.exec(order.items[0].name) : null;
  if (order.items.length !== 1 || (units && Number(units[1]) !== 1)) throw new Error("Este pedido contiene varios productos. Atiéndelos individualmente desde Inventario.");
  const service = order.items[0].name.replace(/^\s*1\s*[x×]\s*/i, "").trim();
  const { isOnRequestMessage, requestEmail } = await import("@/lib/catalog/on-request");
  const onRequest = isOnRequestMessage(order.message);
  const email = requestEmail(order.message);
  const external = `web:${order.id}`;
  const { error: insertError } = await db.from("cyberdocs_orders").upsert({ cyberdocs_order_id: external, source: "manual_fallback", source_event_key: external, source_key: "web_catalog", source_label: onRequest ? "Por encargo" : "Página web", raw_message: order.message, parsed_payload: { servicio: service, ...(onRequest? {modalidad:"Por encargo"}:{}), ...(email? {correo:email}:{}) }, client_name: data.name, service_name: service, contact_label: "WhatsApp", contact_value: phone, whatsapp: phone, notification_order_id: order.id, status: "new" }, { onConflict: "source_event_key", ignoreDuplicates: true });
  if (insertError) throw new Error("No se pudo preparar el pedido");
  const { data: linked, error: linkError } = await db.from("cyberdocs_orders").select("id,protected_delivery_id,status").eq("source_event_key", external).maybeSingle();
  if (linkError || !linked) throw new Error("No se pudo recuperar el pedido preparado");
  await rememberOrderClient(data.name, phone);
  const cyber = await import("@/lib/cyberdocs/cyberdocs.server");
  if (linked.protected_delivery_id || linked.status === "completed") return { id: String(linked.id), automatic: true,delivered:linked.status==="completed" };
  if (onRequest) return {id:String(linked.id),automatic:false,delivered:false};
  const { businessToday } = await import("@/lib/stock/duration");
  const stock = await (await import("@/lib/stock/stock.server")).listStock(null);
  const item = (await import("./order-stock-match")).matchOrderStock(service, stock, businessToday());
  // Do not guess between full accounts and profiles; the admin can choose in the existing order flow.
  if (!item) return { id: String(linked.id), automatic: false,delivered:false };
  const ds = await import("@/lib/deliveries/deliveries.server");
  const result = await cyber.assignStockToOrder({ orderId: String(linked.id), stockItemId: item.id, withPassword: true, accessPassword: ds.randomToken().slice(0,12), expiresAt: new Date(Date.now()+7*86400000).toISOString(), maxViews: null, notes: "", salePrice: order.total, attachment: null });
  const after=await db.from("cyberdocs_orders").select("status").eq("id",linked.id).maybeSingle();
  return { id: String(linked.id), automatic: !result.completionError, delivered:after.data?.status==="completed" };
});
