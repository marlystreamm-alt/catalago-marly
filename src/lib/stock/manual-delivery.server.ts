import type { StockItem } from "./types";

interface DeliveryResult { id: string; token: string; client: string; whatsapp: string; platform: string }
interface ManualDeliveryInput {
  clientName: string;
  clientWhatsapp: string;
  stockExpiresOn: string | null;
  expiresAt: string;
  salePrice: number;
  relatedOrderId: string;
}

/** Claim stock before creating a document; concurrent clicks cannot sell it twice. */
export async function deliverAvailableStock(
  item: StockItem,
  input: ManualDeliveryInput,
  createDocument: () => Promise<DeliveryResult>,
) {
  if (!input.clientName.trim()) throw new Error("Escribe a quién se entrega el producto");
  if (item.status !== "available") throw new Error("Esta cuenta ya no está disponible; revisa su entrega en el historial");
  const now = new Date().toISOString();
  const deliveredOn = now.slice(0, 10);
  if (new Date(input.expiresAt).getTime() <= Date.now()) throw new Error("La vigencia del documento debe ser futura");
  if (input.stockExpiresOn && input.stockExpiresOn < deliveredOn) throw new Error("El vencimiento no puede ser anterior a la entrega");
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const scope = (query: any) => item.businessId ? query.eq("business_id", item.businessId) : query.is("business_id", null);
  const { data: reserved, error } = await scope(db.from("stock_items").update({
    status: "assigned", client_name: input.clientName.trim(), client_whatsapp: input.clientWhatsapp.trim(),
    delivered_on: deliveredOn, expires_on: input.stockExpiresOn || null,
    sale_price: input.salePrice, related_order_id: input.relatedOrderId || "",
    protected_delivery_id: null, updated_at: now,
  }).eq("id", item.id).eq("status", "available").eq("updated_at", item.updatedAt))
    .select("id").maybeSingle();
  if (error || !reserved) throw new Error(error?.message || "La cuenta cambió o ya fue entregada. Actualiza el stock antes de continuar.");

  let result: DeliveryResult | undefined;
  try {
    result = await createDocument();
    const { data: linked, error: linkError } = await scope(db.from("stock_items")
      .update({ protected_delivery_id: result.id, updated_at: new Date().toISOString() })
      .eq("id", item.id).eq("status", "assigned").is("protected_delivery_id", null))
      .select("id").maybeSingle();
    if (linkError || !linked) throw new Error(linkError?.message || "No se pudo asociar el documento al stock");
  } catch (cause) {
    if (result) {
      const delivery = await import("@/lib/deliveries/deliveries.server");
      const row = await delivery.getDeliveryRow(result.id);
      if (row) {
        const payload = await delivery.decryptPayload<any>(String(row["detail"] || ""));
        payload.status = "revoked";
        await delivery.saveDeliveryRow(result.id, payload, "revoked");
      }
    }
    const { error: restoreError } = await scope(db.from("stock_items").update({
      status: item.status, client_name: item.clientName, client_whatsapp: item.clientWhatsapp,
      delivered_on: item.deliveredOn, expires_on: item.expiresOn, sale_price: item.salePrice,
      related_order_id: item.relatedOrderId, protected_delivery_id: item.protectedDeliveryId || null,
      updated_at: new Date().toISOString(),
    }).eq("id", item.id).eq("updated_at", now).is("protected_delivery_id", null));
    if (restoreError) throw new Error("La entrega no terminó y requiere revisión en stock: " + restoreError.message);
    throw cause;
  }
  // A history outage must not report a successful delivery as failed and invite a duplicate retry.
  try {
    const { logStockHistory } = await import("./stock.server");
    await logStockHistory(item.id, item.businessId, "entregado", `Entrega protegida creada para ${input.clientName.trim()}`);
  } catch { /* the stock/document link is already committed */ }
  return result;
}
