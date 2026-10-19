import type { ProtectedDeliveryPrivate } from "@/lib/deliveries/types";
import type {
  CyberDocsIntegrationStatus,
  CyberDocsOrder,
  CyberDocsOrderEvent,
  CyberDocsOrderStatus,
  CyberDocsSource,
  CyberDocsStockOption,
  TelegramOrderBot,
} from "./types";
import { normalizeTelegramUsername, parseCyberDocsMessage } from "./parser";

type Row = Record<string, unknown>;
// Los tipos generados de v20.10 no incluyen aún la migración v20.11.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseDb = any;

async function authorize(value: string) {
  const { requireAdminCode } = await import("@/lib/notify/notify.server");
  await requireAdminCode(value);
}

async function database(): Promise<LooseDb> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Las tablas CyberDocs pertenecen a la migración v20.11. El tipo generado se actualiza
  // al aplicar la migración; este cast permite preparar el ZIP antes de desplegarla.
  return supabaseAdmin as LooseDb;
}

const str = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : value == null ? fallback : String(value);
const nullable = (value: unknown) => (typeof value === "string" && value ? value : null);

export function rowToCyberDocsOrder(row: Row): CyberDocsOrder {
  const parsed = row["parsed_payload"];
  return {
    id: str(row["id"]),
    cyberdocsOrderId: str(row["cyberdocs_order_id"]),
    source: str(row["source"]) as CyberDocsSource,
    sourceEventKey: str(row["source_event_key"]),
    sourceMessageId: str(row["source_message_id"]),
    sourceChatId: str(row["source_chat_id"]),
    businessConnectionId: str(row["business_connection_id"]),
    senderUsername: str(row["sender_username"]),
    sourceKey: str(row["source_key"], "cyberdocsmx_bot"),
    sourceLabel: str(row["source_label"], "CyberDocs"),
    rawMessage: str(row["raw_message"]),
    parsedPayload:
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, string>)
        : {},
    clientName: str(row["client_name"]),
    serviceName: str(row["service_name"]),
    contactLabel: str(row["contact_label"]),
    contactValue: str(row["contact_value"]),
    whatsapp: str(row["whatsapp"]),
    status: str(row["status"]) as CyberDocsOrderStatus,
    assignFromStock:
      typeof row["assign_from_stock"] === "boolean" ? Boolean(row["assign_from_stock"]) : null,
    stockItemId: nullable(row["stock_item_id"]),
    protectedDeliveryId: nullable(row["protected_delivery_id"]),
    protectedEnabled: row["protected_enabled"] !== false,
    notificationOrderId: nullable(row["notification_order_id"]),
    assignedAt: nullable(row["assigned_at"]),
    assignedBy: str(row["assigned_by"]),
    finalizedAt: nullable(row["finalized_at"]),
    finalizedBy: str(row["finalized_by"]),
    finalNotes: str(row["final_notes"]),
    deliveredOn: nullable(row["delivered_on"]),
    expiresOn: nullable(row["expires_on"]),
    renewalWarningDays: Number.isFinite(Number(row["renewal_warning_days"]))
      ? Number(row["renewal_warning_days"])
      : 3,
    renewalAlertedFor: nullable(row["renewal_alerted_for"]),
    renewalNotificationOrderId: nullable(row["renewal_notification_order_id"]),
    renewalStatus: str(row["renewal_status"]),
    createdAt: str(row["created_at"]),
    updatedAt: str(row["updated_at"]),
  };
}

export async function recordOrderEvent(
  orderId: string,
  action: string,
  actor: string,
  detail: string,
) {
  const db = await database();
  const { error } = await db.from("cyberdocs_order_events").insert({
    order_id: orderId,
    action,
    actor: actor.slice(0, 120),
    detail: detail.slice(0, 2000),
  });
  if (error) throw new Error(error.message);
}

async function updateIntegrationState(values: Row) {
  const db = await database();
  const { error } = await db
    .from("cyberdocs_integration_state")
    .upsert({ id: 1, ...values }, { onConflict: "id" });
  if (error) console.error("No se pudo actualizar el estado CyberDocs:", error.message);
}

export interface CyberDocsIngestInput {
  source: CyberDocsSource;
  eventKey: string;
  telegramUpdateId?: string;
  sourceMessageId?: string;
  sourceChatId?: string;
  businessConnectionId?: string;
  senderUsername?: string;
  sourceKey?: string;
  sourceLabel?: string;
  rawMessage: string;
  rawPayload: Record<string, unknown>;
}

export interface CyberDocsIngestResult {
  ok: boolean;
  ignored?: boolean;
  duplicate?: boolean;
  orderId?: string;
  reason?: string;
}

/** Guarda el evento original, deduplica el pedido y dispara un aviso genérico sin datos personales. */
export async function ingestCyberDocsOrder(
  input: CyberDocsIngestInput,
): Promise<CyberDocsIngestResult> {
  const db = await database();
  const eventKey = input.eventKey.trim().slice(0, 240);
  if (!eventKey) throw new Error("Falta la llave única del evento");

  const { data: previous } = await db
    .from("cyberdocs_webhook_events")
    .select("id,status,order_id")
    .eq("event_key", eventKey)
    .maybeSingle();
  if (previous) {
    return { ok: true, duplicate: true, orderId: nullable(previous.order_id) ?? undefined };
  }

  const { data: webhookRow, error: webhookError } = await db
    .from("cyberdocs_webhook_events")
    .insert({
      event_key: eventKey,
      source: input.source,
      telegram_update_id: input.telegramUpdateId || "",
      payload: input.rawPayload,
      status: "received",
    })
    .select("id")
    .single();
  if (webhookError) {
    if (webhookError.code === "23505") return { ok: true, duplicate: true };
    throw new Error(webhookError.message);
  }
  const webhookId = str(webhookRow?.id);
  const now = new Date().toISOString();
  await updateIntegrationState({
    last_event_at: now,
    ...(input.source.includes("fallback") ? { last_fallback_at: now } : {}),
    last_error: "",
  });

  const parsed = parseCyberDocsMessage(input.rawMessage);
  if (!parsed.isOrder || !parsed.orderId) {
    await db
      .from("cyberdocs_webhook_events")
      .update({
        status: "ignored",
        error_detail: "El mensaje no es un pedido CyberDocs reconocible",
        processed_at: now,
      })
      .eq("id", webhookId);
    return { ok: true, ignored: true, reason: "Mensaje sin pedido reconocible" };
  }

  const sourceKey = normalizeTelegramUsername(input.sourceKey || input.senderUsername) || "cyberdocsmx_bot";
  const sourceLabel = (input.sourceLabel || (sourceKey === "cyberdocsmx_bot" ? "CyberDocs" : input.senderUsername) || "Telegram").trim().slice(0, 80);
  const { data: known } = await db
    .from("cyberdocs_orders")
    .select("id")
    .eq("source_key", sourceKey)
    .eq("cyberdocs_order_id", parsed.orderId)
    .maybeSingle();
  if (known) {
    const orderId = str(known.id);
    await db
      .from("cyberdocs_webhook_events")
      .update({ status: "duplicate", order_id: orderId, processed_at: now })
      .eq("id", webhookId);
    await recordOrderEvent(
      orderId,
      "duplicate_received",
      "system",
      `Evento duplicado ignorado: ${eventKey}`,
    );
    return { ok: true, duplicate: true, orderId };
  }

  const { data: inserted, error: insertError } = await db
    .from("cyberdocs_orders")
    .insert({
      cyberdocs_order_id: parsed.orderId,
      source: input.source,
      source_event_key: eventKey,
      source_message_id: input.sourceMessageId || "",
      source_chat_id: input.sourceChatId || "",
      business_connection_id: input.businessConnectionId || "",
      sender_username: input.senderUsername || "",
      source_key: sourceKey,
      source_label: sourceLabel,
      raw_message: input.rawMessage.slice(0, 20_000),
      parsed_payload: parsed.fields,
      client_name: parsed.clientName,
      service_name: parsed.serviceName,
      contact_label: parsed.contactLabel,
      contact_value: parsed.contactValue,
      whatsapp: parsed.contactLabel === "WhatsApp" ? parsed.contactValue : "",
      status: "new",
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    if (insertError?.code === "23505") {
      const { data: raceWinner } = await db
        .from("cyberdocs_orders")
        .select("id")
        .eq("source_key", sourceKey)
        .eq("cyberdocs_order_id", parsed.orderId)
        .maybeSingle();
      const orderId = nullable(raceWinner?.id) ?? undefined;
      await db
        .from("cyberdocs_webhook_events")
        .update({ status: "duplicate", order_id: orderId || null, processed_at: now })
        .eq("id", webhookId);
      return { ok: true, duplicate: true, orderId };
    }
    await db
      .from("cyberdocs_webhook_events")
      .update({
        status: "error",
        error_detail: insertError?.message || "No se creó el pedido",
        processed_at: now,
      })
      .eq("id", webhookId);
    await updateIntegrationState({ last_error: insertError?.message || "No se creó el pedido" });
    throw new Error(insertError?.message || "No se pudo guardar el pedido CyberDocs");
  }

  let order = rowToCyberDocsOrder(inserted as Row);
  await recordOrderEvent(
    order.id,
    "order_received",
    "system",
    `Pedido recibido de ${sourceLabel} por ${input.source}`,
  );

  // Se crea un pedido genérico en el módulo de avisos. Cliente, contacto e ID externo
  // permanecen exclusivamente en el panel privado CyberDocs y nunca llegan a Alexa.
  try {
    const { data: notificationRow, error: notificationError } = await db
      .from("orders")
      .insert({
        catalog_id: `telegram-${sourceKey}`,
        catalog_name: sourceLabel,
        service_name: `Pedido nuevo de ${sourceLabel}`,
        total: 0,
        items: [{ name: `Pedido nuevo de ${sourceLabel}`, price: 0 }],
        message: `Pedido de ${sourceLabel} recibido. Revisa el panel privado de MA².`,
        link: "/?cyberdocs=1",
        recipient: "",
      })
      .select("*")
      .single();
    if (notificationError || !notificationRow)
      throw new Error(notificationError?.message || "No se creó el aviso");

    await db
      .from("cyberdocs_orders")
      .update({ notification_order_id: notificationRow.id })
      .eq("id", order.id);
    order = { ...order, notificationOrderId: str(notificationRow.id) };

    const notify = await import("@/lib/notify/notify.server");
    const settings = await notify.loadSettings();
    if (settings.enabled && notify.withinSchedule(settings)) {
      await notify.notifyOrder(notify.rowToOrder(notificationRow as Row), settings, false);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await recordOrderEvent(order.id, "notification_pending", "system", detail);
    await updateIntegrationState({ last_error: `Pedido guardado; aviso pendiente: ${detail}` });
  }

  await db
    .from("cyberdocs_webhook_events")
    .update({ status: "processed", order_id: order.id, processed_at: new Date().toISOString() })
    .eq("id", webhookId);
  await updateIntegrationState({ last_order_at: new Date().toISOString() });
  return { ok: true, orderId: order.id };
}

export async function listCyberDocsOrders(): Promise<CyberDocsOrder[]> {
  const db = await database();
  const { data, error } = await db
    .from("cyberdocs_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(250);
  if (error) throw new Error(error.message);
  return (data || []).map((row: Row) => rowToCyberDocsOrder(row));
}

export async function getCyberDocsOrder(id: string): Promise<CyberDocsOrder> {
  const db = await database();
  const { data, error } = await db.from("cyberdocs_orders").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Pedido CyberDocs no encontrado");
  return rowToCyberDocsOrder(data as Row);
}

export async function listCyberDocsOrderEvents(orderId: string): Promise<CyberDocsOrderEvent[]> {
  const db = await database();
  const { data, error } = await db
    .from("cyberdocs_order_events")
    .select("id,order_id,action,actor,detail,created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return (data || []).map((row: Row) => ({
    id: str(row.id),
    orderId: str(row.order_id),
    action: str(row.action),
    actor: str(row.actor),
    detail: str(row.detail),
    createdAt: str(row.created_at),
  }));
}

export async function listAvailableStock(): Promise<CyberDocsStockOption[]> {
  const stock = await import("@/lib/stock/stock.server");
  const items = await stock.listStock(null);
  return items
    .filter((item) => item.status === "available")
    .map((item) => ({
      id: item.id,
      platform: item.platform,
      accountType: item.accountType,
      username: item.username,
      provider: item.provider,
      catalogRef: item.catalogRef,
      expiresOn: item.expiresOn,
      notes: item.notes,
    }));
}

function ensureEditable(order: CyberDocsOrder) {
  if (["completed", "rejected", "cancelled"].includes(order.status)) {
    throw new Error("Este pedido ya está cerrado y sólo conserva su historial");
  }
}

export async function setStockDecision(orderId: string, assign: boolean, actor = "Administradora") {
  let order = await getCyberDocsOrder(orderId);
  ensureEditable(order);
  if (!assign && order.stockItemId) {
    order = await releaseStockAssignment(orderId, actor, "Decisión cambiada a procesar sin stock");
  }
  const db = await database();
  const { data, error } = await db
    .from("cyberdocs_orders")
    .update({ assign_from_stock: assign, status: "in_process" })
    .eq("id", orderId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "No se guardó la decisión");
  await recordOrderEvent(
    orderId,
    "stock_decision",
    actor,
    assign
      ? "Se permitirá asignar manualmente desde stock"
      : "El pedido se procesará sin usar stock",
  );
  return rowToCyberDocsOrder(data as Row);
}

export async function updateOrderWhatsApp(
  orderId: string,
  whatsapp: string,
  actor = "Administradora",
) {
  const order = await getCyberDocsOrder(orderId);
  const value = whatsapp.trim().slice(0, 40);
  const digits = value.replace(/\D/g, "");
  if (value && digits.length < 10) throw new Error("Escribe un WhatsApp válido de al menos 10 dígitos");
  const db = await database();
  const { data, error } = await db
    .from("cyberdocs_orders")
    .update({ whatsapp: value })
    .eq("id", orderId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "No se guardó el WhatsApp");
  await recordOrderEvent(
    orderId,
    "whatsapp_updated",
    actor,
    value
      ? `WhatsApp de entrega actualizado (${order.whatsapp ? "corregido" : "agregado"})`
      : "WhatsApp de entrega eliminado",
  );
  return rowToCyberDocsOrder(data as Row);
}

async function revokeDelivery(deliveryId: string, reason: string) {
  const delivery = await import("@/lib/deliveries/deliveries.server");
  const row = await delivery.getDeliveryRow(deliveryId);
  if (!row) return;
  const payload = await delivery.decryptPayload<ProtectedDeliveryPrivate>(str(row["detail"]));
  const now = new Date().toISOString();
  payload.status = "revoked";
  payload.updatedAt = now;
  payload.history = [
    ...(payload.history || []),
    { at: now, kind: "revoked" as const, detail: reason },
  ].slice(-100);
  await delivery.saveDeliveryRow(deliveryId, payload, "revoked");
}

export async function assignStockToOrder(input: {
  orderId: string;
  stockItemId: string;
  accessPassword: string;
  expiresAt: string;
  maxViews: number | null;
  notes: string;
  withPassword: boolean;
  attachment: { name: string; type: string; dataUrl: string } | null;
  actor?: string;
}) {
  const actor = input.actor || "Administradora";
  const order = await getCyberDocsOrder(input.orderId);
  ensureEditable(order);
  if (order.stockItemId)
    throw new Error("Este pedido ya tiene stock asignado; libéralo antes de cambiarlo");
  if (input.withPassword && input.accessPassword.trim().length < 4)
    throw new Error("La contraseña del documento protegido debe tener al menos 4 caracteres");
  if (new Date(input.expiresAt).getTime() <= Date.now())
    throw new Error("La vigencia del documento debe ser futura");

  const stockServer = await import("@/lib/stock/stock.server");
  const stockItems = await stockServer.listStock(null);
  const item = stockItems.find((candidate) => candidate.id === input.stockItemId);
  if (!item || item.status !== "available")
    throw new Error("La cuenta seleccionada ya no está disponible");

  const deliveryServer = await import("@/lib/deliveries/deliveries.server");
  const now = new Date().toISOString();
  const token = deliveryServer.randomToken();
  let insertedDelivery: {id:string;createdAt:string} | null = null;
  {
    const deliveryDraft: ProtectedDeliveryPrivate = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    platform: item.platform || order.serviceName || "CyberDocs",
    client: order.clientName,
    whatsapp: order.whatsapp || (order.contactLabel === "WhatsApp" ? order.contactValue : ""),
    username: item.username,
    password: item.password,
    link: item.panelUrl,
    panelUsername: item.panelUsername,
    panelPassword: item.panelPassword,
    accessPassword: input.withPassword ? input.accessPassword.trim() : "",
    platformMessage: "",
    passwordMessage: input.withPassword ? `Hola ${order.clientName || ""} 😊\nContraseña de tu documento protegido: ${input.accessPassword.trim()}` : "",
    notes: input.notes.trim() || item.notes || "⚠️ Soporte únicamente al número de WhatsApp 8443852364, evita perder garantía.",
    images: [],
    attachment: input.attachment ?? null,
    imageCount: 0,
    protectedWithPassword: input.withPassword,
    expiresAt: input.expiresAt,
    maxViews: input.maxViews,
    viewCount: 0,
    lastViewedAt: null,
    status: "active",
    token,
    history: [
      { at: now, kind: "created", detail: "Documento protegido creado desde un pedido CyberDocs" },
    ],
    };
    insertedDelivery = await deliveryServer.insertDelivery(deliveryDraft);
    deliveryDraft.id = insertedDelivery.id;
    deliveryDraft.createdAt = insertedDelivery.createdAt;
    await deliveryServer.saveDeliveryRow(insertedDelivery.id, deliveryDraft);
  }

  const snapshot = {
    status: item.status,
    client_name: item.clientName,
    client_whatsapp: item.clientWhatsapp,
    delivered_on: item.deliveredOn,
    related_order_id: item.relatedOrderId,
    protected_delivery_id: item.protectedDeliveryId || null,
  };
  const db = await database();
  const { data: reserved, error: reserveError } = await db
    .from("stock_items")
    .update({
      status: "assigned",
      client_name: order.clientName,
      client_whatsapp: order.whatsapp || (order.contactLabel === "WhatsApp" ? order.contactValue : ""),
      delivered_on: now.slice(0, 10),
      related_order_id: order.cyberdocsOrderId,
      protected_delivery_id: insertedDelivery?.id ?? null,
      updated_at: now,
    })
    .eq("id", item.id)
    .eq("status", "available")
    .select("id")
    .maybeSingle();
  if (reserveError || !reserved) {
    if (insertedDelivery) await revokeDelivery(
      insertedDelivery.id,
      "Asignación cancelada porque el stock dejó de estar disponible",
    );
    throw new Error(
      reserveError?.message || "La cuenta dejó de estar disponible durante la asignación",
    );
  }

  const { data, error } = await db
    .from("cyberdocs_orders")
    .update({
      status: "in_process",
      assign_from_stock: true,
      stock_item_id: item.id,
      stock_snapshot_before: snapshot,
      protected_delivery_id: insertedDelivery?.id ?? null,
      protected_enabled: true,
      assigned_at: now,
      assigned_by: actor,
    })
    .eq("id", order.id)
    .select("*")
    .single();
  if (error || !data) {
    await db
      .from("stock_items")
      .update({ ...snapshot, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    if (insertedDelivery) await revokeDelivery(
      insertedDelivery.id,
      "Asignación revertida por un error al guardar el pedido",
    );
    throw new Error(error?.message || "No se pudo terminar la asignación");
  }
  await stockServer.logStockHistory(
    item.id,
    null,
    "asignado_cyberdocs",
    `Asignación manual al pedido ${order.cyberdocsOrderId}`,
  );
  await recordOrderEvent(
    order.id,
    "stock_assigned",
    actor,
    insertedDelivery ? `Stock asignado al pedido y documento protegido ${insertedDelivery.id} creado ${input.withPassword ? "con contraseña" : "sin contraseña"}` : "Stock asignado al pedido",
  );
  const deliveryLink = insertedDelivery ? `/e/${insertedDelivery.id}?t=${encodeURIComponent(token)}` : "";
  const platformMessage = [`Hola ${order.clientName || ""} 😊 Te entrego ${item.platform || order.serviceName}.`, `Documento: ${deliveryLink}`, "⚠️ Soporte únicamente al número de WhatsApp 8443852364, evita perder garantía."].filter(Boolean).join("\n");
  const passwordMessage = input.withPassword ? `Hola ${order.clientName || ""} 😊\nContraseña de tu documento protegido: ${input.accessPassword.trim()}` : "";
  return { order: rowToCyberDocsOrder(data as Row), token, platformMessage, passwordMessage };
}

export async function createManualDeliveryForOrder(input: {
  orderId: string;
  deliveryType: "link" | "full" | "profile";
  platform: string;
  username: string;
  password: string;
  profilePin: string;
  link: string;
  panelUsername: string;
  panelPassword: string;
  accessPassword: string;
  withPassword: boolean;
  expiresAt: string;
  maxViews: number | null;
  notes: string;
  attachment: { name: string; type: string; dataUrl: string } | null;
  actor?: string;
}) {
  const actor = input.actor || "Administradora";
  const order = await getCyberDocsOrder(input.orderId);
  ensureEditable(order);
  if (order.stockItemId) throw new Error("Este pedido ya tiene una cuenta de stock asignada");
  if (order.protectedDeliveryId) throw new Error("Este pedido ya tiene un documento protegido");
  if (input.withPassword && input.accessPassword.trim().length < 4)
    throw new Error("La contraseña del documento protegido debe tener al menos 4 caracteres");
  if (new Date(input.expiresAt).getTime() <= Date.now()) throw new Error("La vigencia del documento debe ser futura");
  if (input.deliveryType === "link" && !input.link.trim()) throw new Error("Agrega el link de entrega");
  if (input.deliveryType !== "link" && !input.username.trim()) throw new Error("Agrega el correo o usuario");

  const deliveryServer = await import("@/lib/deliveries/deliveries.server");
  const now = new Date().toISOString();
  const token = deliveryServer.randomToken();
  const noteParts = [
    input.deliveryType === "profile" && input.profilePin.trim() ? `Perfil / PIN: ${input.profilePin.trim()}` : "",
    input.notes.trim(),
    "⚠️ Soporte únicamente al número de WhatsApp 8443852364, evita perder garantía.",
  ].filter(Boolean);
  const draft: ProtectedDeliveryPrivate = {
    id: crypto.randomUUID(), createdAt: now, updatedAt: now,
    platform: input.platform.trim() || order.serviceName || "Entrega",
    client: order.clientName,
    whatsapp: order.whatsapp || (order.contactLabel === "WhatsApp" ? order.contactValue : ""),
    username: input.deliveryType === "link" ? "" : input.username.trim(),
    password: input.deliveryType === "link" ? "" : input.password,
    link: input.link.trim(), panelUsername: input.panelUsername.trim(), panelPassword: input.panelPassword,
    accessPassword: input.withPassword ? input.accessPassword.trim() : "",
    platformMessage: "",
    passwordMessage: input.withPassword ? `Hola ${order.clientName || ""} 😊\nContraseña de tu documento protegido: ${input.accessPassword.trim()}` : "",
    notes: noteParts.join("\n"), images: [], attachment: input.attachment ?? null, imageCount: 0,
    protectedWithPassword: input.withPassword, expiresAt: input.expiresAt, maxViews: input.maxViews,
    viewCount: 0, lastViewedAt: null, status: "active", token,
    history: [{ at: now, kind: "created", detail: `Entrega manual ${input.deliveryType} creada desde pedido` }],
  };
  const inserted = await deliveryServer.insertDelivery(draft);
  draft.id = inserted.id; draft.createdAt = inserted.createdAt;
  await deliveryServer.saveDeliveryRow(inserted.id, draft);

  const db = await database();
  const { data, error } = await db.from("cyberdocs_orders").update({
    status: "in_process", assign_from_stock: false, stock_item_id: null,
    protected_delivery_id: inserted.id, protected_enabled: true,
    assigned_at: now, assigned_by: actor,
  }).eq("id", order.id).select("*").single();
  if (error || !data) {
    await revokeDelivery(inserted.id, "Entrega manual revertida por error al guardar el pedido");
    throw new Error(error?.message || "No se pudo guardar la entrega manual");
  }
  await recordOrderEvent(order.id, "manual_delivery", actor, `Entrega manual ${input.deliveryType} creada ${input.withPassword ? "con contraseña" : "sin contraseña"}`);
  const deliveryLink = `/e/${inserted.id}?t=${encodeURIComponent(token)}`;
  const platformMessage = [`Hola ${order.clientName || ""} 😊 Te entrego ${input.platform.trim() || order.serviceName}.`, `Documento: ${deliveryLink}`, "⚠️ Soporte únicamente al número de WhatsApp 8443852364, evita perder garantía."].join("\n");
  const passwordMessage = input.withPassword ? `Hola ${order.clientName || ""} 😊\nContraseña de tu documento protegido: ${input.accessPassword.trim()}` : "";
  return { order: rowToCyberDocsOrder(data as Row), token, platformMessage, passwordMessage };
}

export async function releaseStockAssignment(
  orderId: string,
  actor = "Administradora",
  reason = "Asignación liberada manualmente",
) {
  const order = await getCyberDocsOrder(orderId);
  ensureEditable(order);
  if (!order.stockItemId) return order;
  const db = await database();
  const { data: rawOrder } = await db
    .from("cyberdocs_orders")
    .select("stock_snapshot_before")
    .eq("id", order.id)
    .single();
  const snapshot =
    rawOrder?.stock_snapshot_before && typeof rawOrder.stock_snapshot_before === "object"
      ? rawOrder.stock_snapshot_before
      : { status: "available", client_name: "", client_whatsapp: "", delivered_on: null, related_order_id: "", protected_delivery_id: null };
  const { error: stockError } = await db
    .from("stock_items")
    .update({ ...snapshot, updated_at: new Date().toISOString() })
    .eq("id", order.stockItemId);
  if (stockError) throw new Error(stockError.message);
  if (order.protectedDeliveryId) await revokeDelivery(order.protectedDeliveryId, reason);

  const { data, error } = await db
    .from("cyberdocs_orders")
    .update({
      stock_item_id: null,
      stock_snapshot_before: null,
      protected_delivery_id: null,
      assigned_at: null,
      assigned_by: "",
      status: "in_process",
    })
    .eq("id", order.id)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "No se liberó la asignación");
  const stockServer = await import("@/lib/stock/stock.server");
  await stockServer.logStockHistory(
    order.stockItemId,
    null,
    "liberado_cyberdocs",
    `${reason} · pedido ${order.cyberdocsOrderId}`,
  );
  await recordOrderEvent(order.id, "stock_released", actor, reason);
  return rowToCyberDocsOrder(data as Row);
}

async function markNotificationAttended(notificationOrderId: string | null) {
  if (!notificationOrderId) return;
  const db = await database();
  await db
    .from("orders")
    .update({ status: "atendido", attended_at: new Date().toISOString() })
    .eq("id", notificationOrderId);
}

export async function finalizeCyberDocsOrder(
  orderId: string,
  notes: string,
  actor = "Administradora",
  pin?: string,
) {
  if (pin) await authorize(pin);
  const order = await getCyberDocsOrder(orderId);
  ensureEditable(order);
  const now = new Date().toISOString();
  const db = await database();
  const { data, error } = await db
    .from("cyberdocs_orders")
    .update({
      status: "completed",
      delivered_on: order.deliveredOn || now.slice(0, 10),
      finalized_at: now,
      finalized_by: actor,
      final_notes: notes.trim(),
    })
    .eq("id", order.id)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "No se pudo finalizar el pedido");
  await markNotificationAttended(order.notificationOrderId);
  await recordOrderEvent(
    order.id,
    "manually_completed",
    actor,
    notes.trim() || "Proceso finalizado con confirmación manual",
  );
  return rowToCyberDocsOrder(data as Row);
}

export async function finalizeCyberDocsOrders(
  orderIds: string[],
  notes: string,
  actor = "Administradora",
  pin?: string,
) {
  if (pin) await authorize(pin);
  const uniqueIds = [...new Set(orderIds)].slice(0, 250);
  if (!uniqueIds.length) throw new Error("Selecciona al menos un pedido");

  const db = await database();
  const { data: existing, error: existingError } = await db
    .from("cyberdocs_orders")
    .select("id,status,notification_order_id")
    .in("id", uniqueIds);
  if (existingError) throw new Error(existingError.message);

  const editableRows = (existing || []).filter((row: Row) =>
    !["completed", "rejected", "cancelled"].includes(str(row["status"])),
  );
  const editableIds = editableRows.map((row: Row) => str(row["id"])).filter(Boolean);
  if (!editableIds.length) throw new Error("Los pedidos seleccionados ya estaban cerrados");

  const now = new Date().toISOString();
  const detail = notes.trim() || "Proceso finalizado con confirmación manual múltiple";
  const { data, error } = await db
    .from("cyberdocs_orders")
    .update({
      status: "completed",
      delivered_on: now.slice(0, 10),
      finalized_at: now,
      finalized_by: actor,
      final_notes: notes.trim(),
    })
    .in("id", editableIds)
    .select("*");
  if (error || !data) throw new Error(error?.message || "No se pudieron finalizar los pedidos");

  const notificationIds = editableRows
    .map((row: Row) => nullable(row["notification_order_id"]))
    .filter((id: string | null): id is string => Boolean(id));
  if (notificationIds.length) {
    const { error: notificationError } = await db
      .from("orders")
      .update({ status: "atendido", attended_at: now })
      .in("id", notificationIds);
    if (notificationError) throw new Error(notificationError.message);
  }

  const { error: historyError } = await db.from("cyberdocs_order_events").insert(
    editableIds.map((orderId: string) => ({
      order_id: orderId,
      action: "manually_completed_bulk",
      actor: actor.slice(0, 120),
      detail: detail.slice(0, 2000),
    })),
  );
  if (historyError) throw new Error(historyError.message);

  return {
    orders: (data as Row[]).map((row) => rowToCyberDocsOrder(row)),
    skipped: uniqueIds.length - editableIds.length,
  };
}

export async function updateOrderRenewal(input: {
  orderId: string;
  deliveredOn: string;
  expiresOn: string;
  warningDays: number;
  actor?: string;
}) {
  const actor = input.actor || "Administradora";
  const order = await getCyberDocsOrder(input.orderId);
  if (["rejected", "cancelled"].includes(order.status))
    throw new Error("No puedes programar renovación para un pedido rechazado o cancelado");
  if (input.deliveredOn && input.expiresOn && input.expiresOn < input.deliveredOn)
    throw new Error("La fecha de vencimiento no puede ser anterior a la entrega");

  const db = await database();
  if (order.renewalNotificationOrderId && order.expiresOn !== input.expiresOn) {
    await db
      .from("orders")
      .update({ status: "atendido", attended_at: new Date().toISOString() })
      .eq("id", order.renewalNotificationOrderId);
  }
  const expiryChanged = order.expiresOn !== (input.expiresOn || null);
  const { data, error } = await db
    .from("cyberdocs_orders")
    .update({
      delivered_on: input.deliveredOn || null,
      expires_on: input.expiresOn || null,
      renewal_warning_days: input.warningDays,
      ...(expiryChanged
        ? {
            renewal_alerted_for: null,
            renewal_notification_order_id: null,
            renewal_status: "",
          }
        : {}),
    })
    .eq("id", order.id)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "No se guardaron las fechas");

  if (order.stockItemId) {
    const stockDates: Row = {
      delivered_on: input.deliveredOn || null,
      expires_on: input.expiresOn || null,
      updated_at: new Date().toISOString(),
    };
    if (expiryChanged) {
      stockDates["renewal_status"] = "";
      stockDates["renewal_notified_at"] = null;
    }
    const { error: stockError } = await db
      .from("stock_items")
      .update(stockDates)
      .eq("id", order.stockItemId);
    if (stockError) throw new Error(stockError.message);
  }

  await recordOrderEvent(
    order.id,
    "renewal_dates_updated",
    actor,
    input.expiresOn
      ? `Entrega ${input.deliveredOn || "sin fecha"} · vence ${input.expiresOn} · aviso ${input.warningDays} día(s) antes`
      : "Fechas de renovación retiradas",
  );
  return rowToCyberDocsOrder(data as Row);
}

export async function markOrderRenewalContacted(orderId: string, actor = "Administradora") {
  const order = await getCyberDocsOrder(orderId);
  if (!order.expiresOn) throw new Error("Primero guarda la fecha de vencimiento");
  const now = new Date().toISOString();
  const db = await database();
  const { data, error } = await db
    .from("cyberdocs_orders")
    .update({ renewal_status: "Avisado por WhatsApp", renewal_alerted_for: order.expiresOn })
    .eq("id", order.id)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "No se registró el aviso de renovación");
  if (order.renewalNotificationOrderId) {
    await db
      .from("orders")
      .update({ status: "atendido", attended_at: now })
      .eq("id", order.renewalNotificationOrderId);
  }
  if (order.stockItemId) {
    await db
      .from("stock_items")
      .update({ renewal_status: "Avisado", renewal_notified_at: now, updated_at: now })
      .eq("id", order.stockItemId);
  }
  await recordOrderEvent(order.id, "renewal_whatsapp", actor, `Renovación ofrecida para ${order.expiresOn}`);
  return rowToCyberDocsOrder(data as Row);
}

export async function editFinalNotes(orderId: string, notes: string, actor = "Administradora", pin?: string) {
  if (pin) await authorize(pin);
  const order = await getCyberDocsOrder(orderId);
  if (order.status !== "completed") throw new Error("Solo puedes editar una entrega ya finalizada");
  const db = await database();
  const { data, error } = await db
    .from("cyberdocs_orders")
    .update({ final_notes: notes.trim(), updated_at: new Date().toISOString() })
    .eq("id", order.id)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "No se pudo editar la entrega");
  await recordOrderEvent(order.id, "final_notes_edited", actor, notes.trim() || "Nota final borrada");
  return rowToCyberDocsOrder(data as Row);
}

export async function closeCyberDocsOrder(
  orderId: string,
  status: "rejected" | "cancelled",
  reason: string,
  actor = "Administradora",
) {
  let order = await getCyberDocsOrder(orderId);
  ensureEditable(order);
  if (order.stockItemId)
    order = await releaseStockAssignment(
      order.id,
      actor,
      `Asignación liberada al marcar el pedido como ${status}`,
    );
  else if (order.protectedDeliveryId)
    await revokeDelivery(order.protectedDeliveryId, `Documento revocado al marcar el pedido como ${status}`);
  const now = new Date().toISOString();
  const db = await database();
  const { data, error } = await db
    .from("cyberdocs_orders")
    .update({ status, finalized_at: now, finalized_by: actor, final_notes: reason.trim() })
    .eq("id", order.id)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "No se pudo cerrar el pedido");
  await markNotificationAttended(order.notificationOrderId);
  await recordOrderEvent(
    order.id,
    status === "rejected" ? "manually_rejected" : "manually_cancelled",
    actor,
    reason.trim() || status,
  );
  return rowToCyberDocsOrder(data as Row);
}

export async function getProtectedDeliveryTokenForOrder(orderId: string) {
  const order = await getCyberDocsOrder(orderId);
  if (!order.protectedDeliveryId)
    throw new Error("Este pedido todavía no tiene documento protegido");
  const delivery = await import("@/lib/deliveries/deliveries.server");
  const row = await delivery.getDeliveryRow(order.protectedDeliveryId);
  if (!row) throw new Error("El documento protegido ya no existe");
  const payload = await delivery.decryptPayload<ProtectedDeliveryPrivate>(str(row["detail"]));
  return { id: order.protectedDeliveryId, token: payload.token, status: payload.status, accessPassword: payload.accessPassword ?? "" };
}

function publicBaseUrl() {
  return (process.env["MA2_PUBLIC_URL"] || process.env["URL"] || "").trim().replace(/\/$/, "");
}

function expectedWebhookUrl() {
  const base = publicBaseUrl();
  return base ? `${base}/api/integrations/cyberdocs/telegram` : "";
}

function allowedBotsFromState(state: Row | null | undefined): TelegramOrderBot[] {
  const primaryUsername = normalizeTelegramUsername(
    process.env["CYBERDOCS_BOT_USERNAME"] || str(state?.["cyberdocs_username"]) || "cyberdocsmx_bot",
  );
  const result: TelegramOrderBot[] = [{ username: primaryUsername, label: "CyberDocs" }];
  const raw = state?.["additional_telegram_bots"];
  if (Array.isArray(raw)) {
    for (const value of raw) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const row = value as Row;
      const username = normalizeTelegramUsername(str(row["username"]));
      const label = str(row["label"]).trim().slice(0, 80);
      if (!username || !label || result.some((bot) => bot.username === username)) continue;
      result.push({ username, label });
    }
  }
  return result;
}

export async function getAllowedTelegramBots(): Promise<TelegramOrderBot[]> {
  const db = await database();
  const { data, error } = await db
    .from("cyberdocs_integration_state")
    .select("cyberdocs_username,additional_telegram_bots")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return allowedBotsFromState(data as Row | null);
}

export async function saveAdditionalTelegramBots(bots: TelegramOrderBot[]) {
  const db = await database();
  const primary = normalizeTelegramUsername(process.env["CYBERDOCS_BOT_USERNAME"] || "cyberdocsmx_bot");
  const cleaned: TelegramOrderBot[] = [];
  for (const bot of bots) {
    const username = normalizeTelegramUsername(bot.username);
    const label = bot.label.trim().slice(0, 80);
    if (!username || !label || username === primary || cleaned.some((item) => item.username === username)) continue;
    cleaned.push({ username, label });
  }
  const { error } = await db
    .from("cyberdocs_integration_state")
    .upsert({ id: 1, additional_telegram_bots: cleaned }, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return getCyberDocsIntegrationStatus();
}

async function telegramApi(method: string, body?: Record<string, unknown>) {
  const token = (process.env["TELEGRAM_BOT_TOKEN"] || "").trim();
  if (!token) throw new Error("Falta TELEGRAM_BOT_TOKEN en los secretos del servidor");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12_000),
  });
  const json = (await response.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
    result?: unknown;
  } | null;
  if (!response.ok || !json?.ok)
    throw new Error(json?.description || `Telegram respondió ${response.status}`);
  return json.result;
}

export async function registerCyberDocsWebhook() {
  const url = expectedWebhookUrl();
  const secret = (process.env["TELEGRAM_WEBHOOK_SECRET"] || "").trim();
  if (!url) throw new Error("Falta MA2_PUBLIC_URL en los secretos del servidor");
  if (!/^https:\/\//i.test(url))
    throw new Error("MA2_PUBLIC_URL debe ser una dirección HTTPS pública");
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(secret)) {
    throw new Error(
      "TELEGRAM_WEBHOOK_SECRET debe tener 16 a 256 caracteres seguros: letras, números, _ o -",
    );
  }
  await telegramApi("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: [
      "business_connection",
      "business_message",
      "edited_business_message",
      "message",
      "edited_message",
    ],
    drop_pending_updates: false,
    max_connections: 20,
  });
  await updateIntegrationState({ last_error: "" });
  return getCyberDocsIntegrationStatus();
}

export async function getCyberDocsIntegrationStatus(): Promise<CyberDocsIntegrationStatus> {
  const db = await database();
  const { data } = await db
    .from("cyberdocs_integration_state")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  const tokenConfigured = Boolean((process.env["TELEGRAM_BOT_TOKEN"] || "").trim());
  const webhookSecretConfigured = Boolean((process.env["TELEGRAM_WEBHOOK_SECRET"] || "").trim());
  const fallbackSecretConfigured = Boolean((process.env["CYBERDOCS_FALLBACK_SECRET"] || "").trim());
  const publicUrlConfigured = Boolean(publicBaseUrl());
  const targetUrl = expectedWebhookUrl();
  let webhookRegistered = false;
  let webhookUrl = "";
  let pendingUpdateCount = 0;
  let webhookError = "";
  if (tokenConfigured) {
    try {
      const info = (await telegramApi("getWebhookInfo")) as Row;
      webhookUrl = str(info?.url);
      pendingUpdateCount = Number(info?.pending_update_count || 0);
      webhookError = str(info?.last_error_message);
      webhookRegistered = Boolean(targetUrl && webhookUrl === targetUrl);
    } catch (error) {
      webhookError = error instanceof Error ? error.message : String(error);
    }
  }
  return {
    connectionRequired: true,
    receivingRequired: true,
    telegramTokenConfigured: tokenConfigured,
    webhookSecretConfigured,
    fallbackSecretConfigured,
    publicUrlConfigured,
    webhookRegistered,
    webhookUrl,
    pendingUpdateCount,
    webhookError,
    lastEventAt: nullable(data?.last_event_at),
    lastOrderAt: nullable(data?.last_order_at),
    lastFallbackAt: nullable(data?.last_fallback_at),
    lastError: str(data?.last_error),
    expectedCyberDocsUsername: (process.env["CYBERDOCS_BOT_USERNAME"] || "cyberdocsmx_bot").replace(
      /^@/,
      "",
    ),
    allowedBots: allowedBotsFromState(data as Row | null),
  };
}

export async function buildCyberDocsBackup() {
  const db = await database();
  const [state, orders, events, webhooks] = await Promise.all([
    db.from("cyberdocs_integration_state").select("*").eq("id", 1).maybeSingle(),
    db.from("cyberdocs_orders").select("*").order("created_at", { ascending: false }).limit(2000),
    db
      .from("cyberdocs_order_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10_000),
    db
      .from("cyberdocs_webhook_events")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(5000),
  ]);
  for (const result of [state, orders, events, webhooks]) {
    if (result.error) throw new Error(result.error.message);
  }
  return {
    kind: "ma2-cyberdocs-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    warning: "Contiene datos privados. Guardar cifrado y no compartir.",
    integration: state.data,
    orders: orders.data || [],
    orderEvents: events.data || [],
    webhookEvents: webhooks.data || [],
  };
}
