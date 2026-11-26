import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
const auth=z.object({code:z.string().min(4).max(200)});
async function authorized(code:string){await (await import("@/lib/notify/notify.server")).requireAdminCode(code);}
export const pricingLoad=createServerFn({method:"POST"}).validator((v:unknown)=>auth.parse(v)).handler(async({data})=>{await authorized(data.code);return (await import("./pricing.server")).listPricing();});
export const pricingSave=createServerFn({method:"POST"}).validator((v:unknown)=>auth.extend({key:z.string().max(240),name:z.string().trim().min(1).max(160),kind:z.string().max(80),months:z.number().int().min(1).max(1200),retailCents:z.number().int().positive().max(100000000).nullable(),resellerCents:z.number().int().positive().max(100000000).nullable(),version:z.string().nullable(),costCents:z.number().int().min(0).max(100000000).nullable().optional(),provider:z.string().max(160).optional(),image:z.string().max(2500000).optional(),description:z.string().max(1500).optional(),published:z.boolean().optional(),warrantyDays:z.number().int().min(0).max(365).optional(),automaticReplacement:z.boolean().optional()}).parse(v)).handler(async({data})=>{
  await authorized(data.code);
  const {pricingKey}=await import("./pricing");if(pricingKey(data.name,data.kind,data.months)!==data.key) throw new Error("El producto cambió; actualiza precios");
  const {opsDB}=await import("@/lib/workspace/operations.server");const db=opsDB(), payload={name:data.name,kind:data.kind,months:data.months,retail_cents:data.retailCents,reseller_cents:data.resellerCents,updated_at:new Date().toISOString(),...(data.costCents!==undefined?{cost_cents:data.costCents}:{}),...(data.provider!==undefined?{provider:data.provider}:{}),...(data.image!==undefined?{image:data.image}:{}),...(data.description!==undefined?{description:data.description}:{}),...(data.published!==undefined?{published:data.published}:{}),...(data.warrantyDays!==undefined?{warranty_days:data.warrantyDays}:{}),...(data.automaticReplacement!==undefined?{automatic_replacement:data.automaticReplacement}:{})};
  if(!data.retailCents&&!data.resellerCents&&data.published!==false) throw new Error("Escribe una tarifa o guarda como borrador");
  const r=data.version?await db.from("ma2_product_prices").update(payload).eq("product_key",data.key).eq("updated_at",data.version).select("product_key").maybeSingle():await db.from("ma2_product_prices").insert({...payload,product_key:data.key}).select("product_key").maybeSingle();
  if(r.error||!r.data) throw new Error("No se guardó el precio. Actualiza la lista y vuelve a intentar.");
  return (await import("./pricing.server")).listPricing();
});
