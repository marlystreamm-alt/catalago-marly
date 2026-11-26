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
  const role=await tier(), c=await import("./customer.server");
  await c.customerThrottle("store-manual",data.phone.replace(/\D/g,""),8);
  const product=(await (await import("./pricing.server")).savedPrices()).find(p=>p.product_key===data.key&&p.published===true&&p.kind.startsWith("catalog-request-"));
  const cents=role==="reseller"?product?.reseller_cents:product?.retail_cents;
  if(!product||!cents)throw new Error("Producto no disponible");
  const {admin,loadSettings,rowToOrder,notifyOrder,withinSchedule}=await import("@/lib/notify/notify.server");
  const {purchaseRecordId}=await import("./purchase-identity.server");
  const id=purchaseRecordId("public-order",data.requestId,"store-ma2");
  const db=await admin();
  const {data:row,error}=await db.from("orders").upsert({id,catalog_id:"store-ma2",catalog_name:"Tienda web MA²",service_name:product.name,total:cents/100,items:[{name:product.name,price:cents/100}],message:`Modalidad: Por encargo\nCliente: ${data.name}\nCorreo del cliente: ${data.email}\nWhatsApp del cliente: ${data.phone}\nEntrega manual · confirmar pago`,link:"/tienda/ma2",recipient:""},{onConflict:"id",ignoreDuplicates:true}).select("*").maybeSingle();
  if(error)throw new Error("No se pudo registrar el pedido");
  if(row){try{const settings=await loadSettings();if(settings.enabled&&withinSchedule(settings))await notifyOrder(rowToOrder(row as Record<string,unknown>),settings,false);}catch{ /* pedido guardado */ }}
  return {id};
});
