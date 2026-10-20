import type { DeliveryAttachment, ProtectedDeliveryPrivate } from "@/lib/deliveries/types";

export interface LinkedStockDelivery {
  itemId: string;
  relatedOrderId: string;
  accessPassword: string;
  expiresAt: string;
  maxViews: number | null;
  notes: string;
  stockExpiresOn: string | null;
  salePrice: number;
  attachment: DeliveryAttachment | null;
  images?: string[];
}

/** Reuse Cyberdoc's assignment path so orders and stock share one document. */
export async function deliverLinkedOrder(input: LinkedStockDelivery) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const orders = await import("@/lib/cyberdocs/cyberdocs.server");
  const deliveries = await import("@/lib/deliveries/deliveries.server");
  const reference = input.relatedOrderId.trim();
  // Resolve against the authorized administrator's orders, never a client catalog.
  const order = (await orders.listCyberDocsOrders()).find(
    (row) => row.id === reference || row.cyberdocsOrderId === reference,
  );
  if (!order) throw new Error("No se encontró el pedido de Cyberdoc seleccionado");
  if (["rejected", "cancelled"].includes(order.status)) {
    throw new Error("No puedes entregar un pedido cancelado o rechazado");
  }
  if (order.stockItemId && order.stockItemId !== input.itemId) {
    throw new Error("Este pedido ya tiene otra cuenta asignada");
  }

  let deliveryId = order.protectedDeliveryId;
  let token = "";
  if (deliveryId) {
    if (order.stockItemId !== input.itemId) {
      throw new Error("El pedido ya tiene una entrega manual; revísala desde Cyberdoc");
    }
    const row = await deliveries.getDeliveryRow(deliveryId);
    if (!row) throw new Error("No se encontró el documento del pedido");
    const payload = await deliveries.decryptPayload<ProtectedDeliveryPrivate>(String(row["detail"] || ""));
    if (payload.status !== "active") throw new Error("El documento del pedido no está activo");
    // Retry a completed/partially completed delivery without creating a second link.
    token = payload.token;
  } else {
    if (order.status === "completed") throw new Error("Este pedido ya fue entregado");
    const assigned = await orders.assignStockToOrder({
      orderId: order.id,
      stockItemId: input.itemId,
      accessPassword: input.accessPassword,
      withPassword: Boolean(input.accessPassword),
      expiresAt: input.expiresAt,
      maxViews: input.maxViews,
      notes: input.notes,
      attachment: input.attachment,
      images: input.images,
    });
    deliveryId = assigned.order.protectedDeliveryId;
    token = assigned.token;
  }
  if (!deliveryId) throw new Error("No se pudo enlazar el documento al pedido");

  if (order.status !== "completed") {
    await orders.updateOrderRenewal({
      orderId: order.id,
      deliveredOn: order.deliveredOn || new Date().toISOString().slice(0, 10),
      expiresOn: input.stockExpiresOn || "",
      warningDays: order.renewalWarningDays || 3,
    });
    const { error } = await db.from("stock_items")
      .update({ sale_price: input.salePrice, updated_at: new Date().toISOString() })
      .eq("id", input.itemId).is("business_id", null);
    if (error) throw new Error(error.message);
    await orders.finalizeCyberDocsOrder(order.id, input.notes || "Entregado desde el gestor de stock");
  }
  return {
    id: deliveryId,
    token,
    client: order.clientName,
    whatsapp: order.whatsapp || (order.contactLabel === "WhatsApp" ? order.contactValue : ""),
    platform: order.serviceName,
  };
}
