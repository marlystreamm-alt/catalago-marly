import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function tier(){
  const ctx=await (await import("./customer.server")).customerContext("ma2");
  if(ctx.account.must_change)throw new Error("Actualiza tu contraseña para continuar");
  return ctx.account.price_tier==="reseller"?"reseller" as const:"retail" as const;
}
export const storefrontLoad=createServerFn({method:"POST"}).handler(async()=>{
  const role=await tier();
  const rows=await (await import("./pricing.server")).listPricing();
  const shop=await (await import("./customer.server")).customerShop("ma2");
  return {role,appearance:shop.appearance,products:rows.filter(r=>r.published===true&&(role==="reseller"?r.resellerCents:r.retailCents)!=null).map(r=>({key:r.key,name:r.name,kind:r.kind,months:r.months,priceCents:(role==="reseller"?r.resellerCents:r.retailCents)!,available:r.available,image:r.image||"",description:r.description||""}))};
});
export const storefrontRequest=createServerFn({method:"POST"}).validator((v:unknown)=>z.object({key:z.string().max(240),name:z.string().trim().min(2).max(120),email:z.string().email().max(160),phone:z.string().regex(/^\+?[0-9 ()-]{10,20}$/),requestId:z.string().uuid()}).parse(v)).handler(async({data})=>{
  const c = await import("./customer.server");
  const ctx = await c.customerContext("ma2");
  if (ctx.account.must_change) throw new Error("Actualiza tu contraseña para continuar");
  const {validWhatsApp,phoneNumber}=await import("@/lib/workspace/model");
  if(!validWhatsApp(data.phone))throw new Error("Escribe un WhatsApp válido con lada");
  const role = ctx.account.price_tier === "reseller" ? "reseller" : "retail";
  await c.customerThrottle("store-manual",data.phone.replace(/\D/g,""),8);
  const {purchaseRecordId}=await import("./purchase-identity.server");
  const {opsDB}=await import("@/lib/workspace/operations.server");
  const db=opsDB();
  const id=purchaseRecordId("public-order",data.requestId,ctx.client.id);
  const {data:created,error}=await db.rpc("ma2_buy_on_request", {
    p_id:id,p_client:ctx.client.id,p_product:data.key,p_tier:role,
    p_name:data.name,p_email:data.email,p_phone:phoneNumber(data.phone),
  });
  if(error)throw new Error(error.message);
  if(created){
    try {
      const {loadSettings,rowToOrder,notifyOrder,withinSchedule}=await import("@/lib/notify/notify.server");
      const settings=await loadSettings();
      if(settings.enabled&&withinSchedule(settings)){
        const {data:row}=await db.from("orders").select("*").eq("id",id).single();
        if(row)await notifyOrder(rowToOrder(row as Record<string,unknown>),settings,false);
      }
    }catch{ /* pedido y descuento guardados */ }
  }
  return {id};
});
