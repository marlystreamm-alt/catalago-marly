import { purchaseRecordId } from "./purchase-identity.server";

/** The wallet transaction already validated and reserved the exact stock item. */
export async function notifyPaidPurchase(id: string, businessId: string | null) {
  if (businessId) return; // Do not send another merchant's sales to the main administrator.
  const notify = await import("@/lib/notify/notify.server");
  const db = await notify.admin();
  // Stable domain-separated UUID: retries cannot create another notice.
  const { data, error } = await db.from("orders").upsert({ id: purchaseRecordId("notice", id), catalog_id: "wallet-main", catalog_name: "Tienda MA²", service_name: "Nueva compra con saldo", total: 0, items: [{ name: "Compra pagada", price: 0 }], message: "Compra con saldo confirmada. Revisa Pedidos en MA².", link: "/?cat=pedidos", recipient: "" }, { onConflict: "id", ignoreDuplicates: true }).select("*").maybeSingle();
  if (error) throw new Error("No se pudo registrar el aviso de compra");
  if (!data) return;
  const settings = await notify.loadSettings();
  if (settings.enabled && notify.withinSchedule(settings)) await notify.notifyOrder(notify.rowToOrder(data as Record<string, unknown>), settings);
}
