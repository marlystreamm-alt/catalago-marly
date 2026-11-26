import type { CyberDocsOrder } from "@/lib/cyberdocs/types";

/** Web purchases routed through the CyberDocs fulfillment interface retain the web buyer's reference. */
export async function referenceForWebOrder(order:CyberDocsOrder){
  if(order.sourceKey!=="web_catalog"||!order.notificationOrderId)return "";
  const ops=await import("@/lib/workspace/operations.server");
  const paid=await ops.opsDB().from("ma2_wallet_entries").select("client_id").eq("request_id",order.notificationOrderId).eq("kind","purchase").maybeSingle();
  if(paid.error||!paid.data)return "";
  const client=await ops.readRecord(paid.data.client_id);
  return client.module==="clients"&&(!client.data.shopId||client.data.shopId==="main")?client.clientReference||"":"";
}

export async function referenceForStock(itemId:string){
  const ops=await import("@/lib/workspace/operations.server");
  const db=ops.opsDB();
  const result=await db.from("stock_items").select("related_order_id").eq("id",itemId).is("business_id",null).maybeSingle();
  const id=String(result.data?.related_order_id||"");
  if(result.error||!/^[-\da-f]{36}$/i.test(id))return "";
  const order=await db.from("cyberdocs_orders").select("source_key,notification_order_id").eq("id",id).maybeSingle();
  if(order.error)return "";
  if(order.data){
    if(order.data.source_key!=="web_catalog")return "";
    const linked=await (await import("@/lib/cyberdocs/cyberdocs.server")).getCyberDocsOrder(id);
    return referenceForWebOrder(linked);
  }
  const paid=await db.from("ma2_customer_orders").select("client_id").eq("id",id).is("business_id",null).maybeSingle();
  if(paid.error)return "";
  if(paid.data)return (await ops.readRecord(paid.data.client_id)).clientReference||"";
  const request=await ops.readRecord(id).catch(()=>null);
  if(request?.module==="requests"&&(request.data.manualStockId===itemId||request.data.comboStockIds?.includes(itemId))){
    return (await ops.readRecord(request.data.clientId)).clientReference||"";
  }
  return "";
}
