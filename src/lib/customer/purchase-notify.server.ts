import { purchaseRecordId } from "./purchase-identity.server";

/** The wallet transaction already validated and reserved the exact stock item. */
export async function notifyPaidPurchase(id: string, businessId: string | null) {
  if (businessId) return; // Do not send another merchant's sales to the main administrator.
  const notify = await import("@/lib/notify/notify.server");
  const db = await notify.admin();
  const {data:purchase,error:purchaseError}=await (await import("@/lib/workspace/operations.server")).opsDB().from("ma2_customer_orders").select("title,amount_cents").eq("id",id).is("business_id",null).maybeSingle();
  if(purchaseError||!purchase)throw new Error("Compra no disponible");
  // Stable domain-separated UUID: retries cannot create another notice.
  const { data, error } = await db.from("orders").upsert({ id: purchaseRecordId("notice", id), catalog_id: "wallet-main", catalog_name: "Página web MA²", service_name: String(purchase.title), total: Number(purchase.amount_cents)/100, items: [{ name: String(purchase.title), price: Number(purchase.amount_cents)/100 }], message: "Origen: Página web. Compra con saldo confirmada y entregada automáticamente.", link: "/?cat=pedidos", recipient: "" }, { onConflict: "id", ignoreDuplicates: true }).select("*").maybeSingle();
  if (error) throw new Error("No se pudo registrar el aviso de compra");
  if (!data) return;
  const settings = await notify.loadSettings();
  if (settings.enabled && notify.withinSchedule(settings)) await notify.notifyOrder(notify.rowToOrder(data as Record<string, unknown>), settings);
}
