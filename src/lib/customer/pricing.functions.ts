import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
const auth=z.object({code:z.string().min(4).max(200)});
async function authorized(code:string){await (await import("@/lib/notify/notify.server")).requireAdminCode(code);}
export const pricingLoad=createServerFn({method:"POST"}).validator((v:unknown)=>auth.parse(v)).handler(async({data})=>{await authorized(data.code);return (await import("./pricing.server")).listPricing();});
export const pricingSave=createServerFn({method:"POST"}).validator((v:unknown)=>auth.extend({key:z.string().max(240),name:z.string().trim().min(1).max(160),kind:z.string().max(80),months:z.number().int().min(1).max(1200),retailCents:z.number().int().positive().max(100000000).nullable(),resellerCents:z.number().int().positive().max(100000000).nullable(),version:z.string().nullable()}).parse(v)).handler(async({data})=>{
  await authorized(data.code);
  const {pricingKey}=await import("./pricing");if(pricingKey(data.name,data.kind,data.months)!==data.key) throw new Error("El producto cambió; actualiza precios");
  const {opsDB}=await import("@/lib/workspace/operations.server");const db=opsDB(), payload={name:data.name,kind:data.kind,months:data.months,retail_cents:data.retailCents,reseller_cents:data.resellerCents,updated_at:new Date().toISOString()};
  if(!data.retailCents&&!data.resellerCents) throw new Error("Escribe al menos una tarifa");
  const r=data.version?await db.from("ma2_product_prices").update(payload).eq("product_key",data.key).eq("updated_at",data.version).select("product_key").maybeSingle():await db.from("ma2_product_prices").insert({...payload,product_key:data.key}).select("product_key").maybeSingle();
  if(r.error||!r.data) throw new Error("No se guardó el precio. Actualiza la lista y vuelve a intentar.");
  return (await import("./pricing.server")).listPricing();
});
