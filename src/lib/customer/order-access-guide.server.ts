import { purchaseRecordId } from "@/lib/customer/purchase-identity.server";
import { opsDB } from "@/lib/workspace/operations.server";
import { decryptPayload, encryptPayload, getDeliveryRow } from "@/lib/deliveries/deliveries.server";
import type { ProtectedDeliveryPrivate } from "@/lib/deliveries/types";
import { businessToday } from "@/lib/stock/duration";

const channel = "order_access_guide";
const guideId = (id: string) => purchaseRecordId("document", id, channel);

export async function saveOrderAccessGuide(orderId: string, images: string[]) {
  const { error } = await opsDB().from("notification_log").upsert({
    id: guideId(orderId), channel, kind: "guide", attempt: 0, status: "active",
    detail: await encryptPayload({ images }),
  }, { onConflict: "id" });
  if (error) throw new Error("No se pudieron guardar las imágenes de la guía");
}

export async function readWebOrderDelivery(clientId: string, orderId: string) {
  const db = opsDB();
  const { data: payment, error: paymentError } = await db.from("ma2_wallet_entries")
    .select("note").eq("request_id", orderId).eq("client_id", clientId).eq("kind", "purchase").maybeSingle();
  if (paymentError || !payment?.note.startsWith("Pedido web por encargo · ")) throw new Error("Entrega no disponible");

  const [order, request] = await Promise.all([
    db.from("cyberdocs_orders").select("id, protected_delivery_id, expires_on")
      .eq("notification_order_id", orderId).eq("source_key", "web_catalog").eq("status", "completed").maybeSingle(),
    db.from("orders").select("service_name").eq("id", orderId).eq("catalog_id", "store-ma2").maybeSingle(),
  ]);
  if (request.error || !request.data || order.error || !order.data) throw new Error("Entrega no disponible");
  if (order.data.expires_on && order.data.expires_on < businessToday())
    throw new Error("La entrega venció. Contacta a soporte para renovar");

  const { data: stored, error } = await db.from("notification_log")
    .select("detail").eq("id", guideId(order.data.id)).eq("channel", channel).maybeSingle();
  if (error) throw new Error("No se pudo consultar la guía de ingreso");
  const images = stored ? (await decryptPayload<{images: string[]}>(String(stored.detail))).images : [];
  const row = order.data.protected_delivery_id ? await getDeliveryRow(order.data.protected_delivery_id) : null;
  const saved = row?.status === "active" ? await decryptPayload<ProtectedDeliveryPrivate>(String(row["detail"])) : null;
  const payload = saved?.status === "active" && (!saved.expiresAt || Date.parse(saved.expiresAt) > Date.now()) ? saved : null;
  const link = payload?.link?.trim() || "";
  const title = String(request.data.service_name);
  const invitation = /canva.*invitaci[oó]n/i.test(title);
  return {
    id: orderId, title, username: payload?.username || "", password: payload?.password || "",
    profilePin: payload?.notes?.match(/^Perfil \/ PIN:\s*(.*)$/im)?.[1] || "", expiresOn: order.data.expires_on as string | null,
    link: /^https?:\/\//i.test(link) ? link : "",
    notes: payload?.notes || (invitation ? "Revisa el correo que usaste en tu pedido, incluida la carpeta de spam, y acepta la invitación de Canva." : !payload && !images.length ? "Contacta a soporte para consultar los datos de acceso." : ""),
    guides: (images.length ? images : payload?.images || []).slice(0, 2).map((image, i)=>({title:`Paso ${i+1}`,image})),
  };
}
