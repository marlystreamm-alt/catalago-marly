import { expiresAfterMonths, businessToday } from './duration';
import type { StockItem, StockStatus } from "./types";
import type { ProtectedDeliveryPrivate } from "@/lib/deliveries/types";
type Row = Record<string, unknown>;
async function admin(){ const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); return supabaseAdmin; }
const s=(v:unknown)=>typeof v === "string" ? v : "";
export async function rowToStock(row: Row): Promise<StockItem>{
  let password="";
  const cipher=s(row["password_cipher"]);
  if(cipher){ try { const d=await import("@/lib/deliveries/deliveries.server"); password=(await d.decryptPayload<{password:string}>(cipher)).password ?? ""; } catch { password=""; } }
  let panelPassword="";
  const panelCipher=s(row["panel_password_cipher"]);
  if(panelCipher){ try { const d=await import("@/lib/deliveries/deliveries.server"); panelPassword=(await d.decryptPayload<{password:string}>(panelCipher)).password ?? ""; } catch { panelPassword=""; } }
  return { durationMonths:Number(row["duration_months"]||1), startsOnSale:row["starts_on_sale"]!==false, id:s(row["id"]), businessId: row["business_id"] ? s(row["business_id"]) : null, platform:s(row["platform"]), accountType:s(row["account_type"]), stockKind:(s(row["stock_kind"]) === "profile" ? "profile" : "complete"), parentStockId:row["parent_stock_id"]?s(row["parent_stock_id"]):null, username:s(row["username"]), password, profilePin:s(row["profile_pin"]), panelUrl:s(row["panel_url"]), panelUsername:s(row["panel_username"]), panelPassword, provider:s(row["provider"]), catalogRef:s(row["catalog_ref"]), clientName:s(row["client_name"]), clientWhatsapp:s(row["client_whatsapp"]), status:s(row["status"]) as StockStatus, acquiredOn:row["acquired_on"]?s(row["acquired_on"]):null, deliveredOn:row["delivered_on"]?s(row["delivered_on"]):null, expiresOn:row["expires_on"]?s(row["expires_on"]):null, notes:s(row["notes"]), cost:Number(row["cost"]??0)||0, salePrice:Number(row["sale_price"]??0)||0, relatedOrderId:s(row["related_order_id"]), renewalStatus:s(row["renewal_status"]), renewalNotifiedAt:row["renewal_notified_at"]?s(row["renewal_notified_at"]):null, protectedDeliveryId:s(row["protected_delivery_id"]), createdAt:s(row["created_at"]), updatedAt:s(row["updated_at"]) };
}
export async function listStock(businessId: string | null){
 const db=await admin(); let q=db.from("stock_items").select("*").order("created_at",{ascending:false}); q=businessId ? q.eq("business_id",businessId) : q.is("business_id",null); const {data,error}=await q; if(error) throw new Error(error.message); const out=[] as StockItem[]; for(const r of data??[]) out.push(await rowToStock(r as Row)); return out;
}
export async function saveStock(item: Omit<StockItem,"createdAt"|"updatedAt">){
 if(!item.id && !item.acquiredOn) item={...item, acquiredOn:businessToday()};
 const db=await admin(); const d=await import("@/lib/deliveries/deliveries.server"); const payload={ duration_months:item.durationMonths||1, starts_on_sale:item.startsOnSale!==false, business_id:item.businessId, platform:item.platform, account_type:item.accountType, stock_kind:item.stockKind||"complete", parent_stock_id:item.parentStockId||null, username:item.username, password_cipher: item.password ? await d.encryptPayload({password:item.password}) : "", profile_pin:item.profilePin, panel_url:item.panelUrl, panel_username:item.panelUsername, panel_password_cipher: item.panelPassword ? await d.encryptPayload({password:item.panelPassword}) : "", provider:item.provider, catalog_ref:item.catalogRef, client_name:item.clientName, client_whatsapp:item.clientWhatsapp, status:item.status, acquired_on:item.acquiredOn||null, delivered_on:item.deliveredOn||null, expires_on:item.expiresOn||(item.startsOnSale===false?expiresAfterMonths(item.acquiredOn||businessToday(),item.durationMonths||1):null), notes:item.notes, cost:item.cost||0, sale_price:item.salePrice||0, related_order_id:item.relatedOrderId||"", renewal_status:item.renewalStatus||"", renewal_notified_at:item.renewalNotifiedAt||null, protected_delivery_id:item.protectedDeliveryId||null, updated_at:new Date().toISOString() };
 const q=item.id ? (item.businessId ? db.from("stock_items").update(payload).eq("id",item.id).eq("business_id",item.businessId) : db.from("stock_items").update(payload).eq("id",item.id).is("business_id",null)).select("*").single() : db.from("stock_items").insert(payload).select("*").single(); const {data,error}=await q; if(error) throw new Error(error.message); return rowToStock(data as Row);
}
export async function removeStock(id:string,businessId:string|null){ const db=await admin(); let q=db.from("stock_items").delete().eq("id",id); q=businessId?q.eq("business_id",businessId):q.is("business_id",null); const {data,error}=await q.select("id"); if(error) throw new Error(error.message); if(!data?.length) throw new Error("No se encontró el registro de stock para eliminar"); }

/** Change only renewal metadata, never overwrite credentials, price or assignment from an old UI snapshot. */
export async function updateMainRenewal(id:string,version:string,expiresOn?:string){
 const db=await admin();
 const row=await db.from("stock_items").select("id,status,client_name,delivered_on,expires_on,updated_at").eq("id",id).is("business_id",null).maybeSingle();
 if(row.error||!row.data||row.data.updated_at!==version||row.data.status==="available"||(!row.data.client_name&&!row.data.delivered_on))throw new Error("El servicio cambió o ya no está asignado. Actualiza la lista.");
 const now=new Date().toISOString();
 let changes:{renewal_notified_at:string|null;updated_at:string;expires_on?:string;status?:string;renewal_status?:string}={renewal_notified_at:now,updated_at:now};
 if(expiresOn!==undefined){
   const date=new Date(`${expiresOn}T12:00:00Z`);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)||Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==expiresOn||expiresOn<=businessToday()||(row.data.expires_on&&expiresOn<=row.data.expires_on))throw new Error("Elige una fecha posterior a hoy y al vencimiento actual.");
   if(!["assigned","expiring","expired"].includes(row.data.status))throw new Error("Resuelve la reposición antes de renovar el servicio.");
   changes={expires_on:expiresOn,status:"assigned",renewal_status:"Renovado",renewal_notified_at:null,updated_at:now};
 }
 const result=await db.from("stock_items").update(changes).eq("id",id).eq("updated_at",version).is("business_id",null).select("id").maybeSingle();
 if(result.error||!result.data)throw new Error("El servicio cambió. Actualiza la lista e inténtalo de nuevo.");
 await logStockHistory(id,null,expiresOn?"renovado":"avisado",expiresOn?`Vence: ${expiresOn}`:"Recordatorio marcado como enviado");
 return {ok:true as const};
}

/** Return an unsold expired unit to inventory after the administrator verifies access. */
export async function reactivateUnsoldStock(id:string,version:string,expiresOn:string){
  const db=await admin();
  const today=businessToday();
  const date=new Date(expiresOn+"T12:00:00Z");
  if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==expiresOn||expiresOn<=today) throw new Error("Indica una vigencia futura");
  const row=await db.from("stock_items").select("id,status,account_type,client_name,delivered_on,related_order_id,protected_delivery_id,expires_on,updated_at").eq("id",id).is("business_id",null).maybeSingle();
  if(row.error||!row.data||row.data.updated_at!==version||!["available","expired"].includes(row.data.status)||row.data.account_type==="split_parent"||row.data.client_name||row.data.delivered_on||row.data.related_order_id||row.data.protected_delivery_id||!(row.data.status==="expired"||row.data.expires_on&&row.data.expires_on<=today))
    throw new Error("La cuenta cambió o tiene una entrega vinculada. Revisa el inventario.");
  const children=await db.from("stock_items").select("id").eq("parent_stock_id",id).limit(1);
  if(children.error||children.data?.length)throw new Error("Esta cuenta contiene perfiles. Revisa sus vigencias individuales.");
  const result=await db.from("stock_items").update({status:"available",expires_on:expiresOn,updated_at:new Date().toISOString(),renewal_status:"Acceso verificado",renewal_notified_at:null}).eq("id",id).eq("updated_at",version).is("business_id",null).select("id").maybeSingle();
  if(result.error||!result.data)throw new Error("La cuenta cambió. Actualiza e inténtalo de nuevo.");
  await logStockHistory(id,null,"reactivado",`Acceso verificado · vence ${expiresOn}`);
  return {ok:true};
}

export async function logStockHistory(stockId:string,businessId:string|null,action:string,detail:string){
 const db=await admin(); const {error}=await db.from("stock_history").insert({stock_id:stockId,business_id:businessId,action,detail}); if(error) throw new Error(error.message);
}

export async function reviewStock(id: string, businessId: string | null, version: string, action: "nonrenewal" | "release" | "expire", expiresOn?: string) {
  const db = await admin();
  let query = db.from("stock_items").select("id,updated_at,protected_delivery_id,status,expires_on").eq("id", id);
  query = businessId ? query.eq("business_id", businessId) : query.is("business_id", null);
  const { data, error } = await query.maybeSingle();
  if (error || !data || data.updated_at !== version) throw new Error("La cuenta cambió. Actualiza el inventario.");
  const closing = action !== "nonrenewal" || data.status === "expired" || Boolean(data.expires_on && data.expires_on < businessToday());
  const ds = await import("@/lib/deliveries/deliveries.server");
  let document: string | null = null;
  if (closing && data.protected_delivery_id) {
    const row = await ds.getDeliveryRow(data.protected_delivery_id);
    if (row) {
      const payload = await ds.decryptPayload<ProtectedDeliveryPrivate>(String(row.detail));
      const now = new Date().toISOString();
      document = await ds.encryptPayload({ ...payload, status: "revoked", updatedAt: now,
        history: [...payload.history, { at: now, kind: "revoked", detail: "Cuenta sin renovación" }].slice(-100) });
    }
  }
  const {opsDB}=await import("@/lib/workspace/operations.server");
  const result = await opsDB().rpc("ma2_review_stock", { p_id: id, p_business: businessId, p_version: version, p_action: action, p_expiry: expiresOn || null, p_document: document });
  if (result.error) throw new Error(result.error.message);
  return { status: String(result.data) };
}

export async function expireStockReviews() {
  const db = await admin();
  const {data,error}=await db.from("stock_items").select("id,business_id,updated_at").eq("status","review").lt("expires_on",businessToday()).limit(100);
  if(error)throw new Error(error.message);
  for(const item of data||[]){
    try{await reviewStock(item.id,item.business_id,item.updated_at,"expire");}
    catch(error){console.error("No se pudo concluir revisión de stock",item.id,error);}
  }
}
export async function listStockHistory(stockId:string,businessId:string|null){
 const db=await admin(); let q=db.from("stock_history").select("*").eq("stock_id",stockId).order("created_at",{ascending:false}).limit(100);
 q=businessId?q.eq("business_id",businessId):q.is("business_id",null); const {data,error}=await q; if(error) throw new Error(error.message);
 return (data??[]).map((r:any)=>({id:String(r.id),action:String(r.action??""),detail:String(r.detail??""),createdAt:String(r.created_at??"")}));
}

export async function convertStockProfiles(id:string,businessId:string|null,count:number){
 const db=await admin();
 const {data,error}=await db.rpc("ma2_stock_convert_profiles",{p_id:id,p_business:businessId,p_count:count});
 if(error)throw new Error(error.message);
 return {count:Number(data)};
}

export async function verifyStockFamily(root: string, members: {id:string;version:string}[], active: boolean, expiry?: string) {
  const db = await admin();
  const {data, error} = await db.from("stock_items").select("id,protected_delivery_id")
    .in("id", members.map(row => row.id)).is("business_id", null);
  if (error || data.length !== members.length) throw new Error("La lista de perfiles cambió. Actualiza la lista.");
  const ds = await import("@/lib/deliveries/deliveries.server");
  const documents = new Map<string,string>();
  for (const {protected_delivery_id:id} of data) {
    if (!id || documents.has(id)) continue;
    const row = await ds.getDeliveryRow(id);
    if (!row) continue;
    const payload = await ds.decryptPayload<ProtectedDeliveryPrivate>(String(row.detail));
    const now = new Date().toISOString();
    documents.set(id, await ds.encryptPayload({...payload,status:"revoked",updatedAt:now,
      history:[...payload.history,{at:now,kind:"revoked",detail:"Cuenta revisada tras vencer"}].slice(-100)}));
  }
  const {opsDB} = await import("@/lib/workspace/operations.server");
  const result = await opsDB().rpc("ma2_verify_stock_family", {
    p_root:root,p_members:members.map(row=>({...row,document:documents.get(data.find(item=>item.id===row.id)?.protected_delivery_id||"")})),
    p_action:active?"verified_release":"verified_invalid",p_expiry:expiry||null,
  });
  if (result.error) throw new Error(result.error.message);
  return {ok:true};
}
