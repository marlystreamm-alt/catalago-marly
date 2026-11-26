import {createServerFn} from "@tanstack/react-start";
import {z} from "zod";
import type {ProtectedDeliveryPrivate} from "@/lib/deliveries/types";
const auth=z.object({code:z.string().min(4).max(1000)});
const kind=z.enum(["profile","complete"]);
async function gate(code:string){await (await import("@/lib/notify/notify.server")).requireAdminCode(code);}
export const comboStockLoad=createServerFn({method:"POST"}).validator((v:unknown)=>auth.extend({kind}).parse(v)).handler(async({data})=>{
 await gate(data.code);
 const db=(await import("@/lib/workspace/operations.server")).opsDB();
 const {data:rows,error}=await db.from("stock_items").select("id,platform,stock_kind,account_type,parent_stock_id,duration_months,sale_price,expires_on,status,updated_at,username,password_cipher").is("business_id",null).order("platform");
 if(error)throw new Error("No se pudo consultar el stock");
 const parents=new Set((rows||[]).map((r:any)=>r.parent_stock_id));
 const today=(await import("./duration")).businessToday();
 const prices=new Map((await (await import("@/lib/customer/pricing.server")).savedPrices()).map(r=>[r.product_key,r]));
 const {pricingKey}=await import("@/lib/customer/pricing");
 return (rows||[]).filter((r:any)=>r.status==="available"&&r.username&&r.password_cipher&&r.stock_kind===data.kind&&r.account_type!=="split_parent"&&!parents.has(r.id)&&(!r.expires_on||r.expires_on>=today)).map((r:any)=>({id:String(r.id),platform:String(r.platform),type:String(r.account_type),months:Number(r.duration_months),expires:r.expires_on as string|null,version:String(r.updated_at),price:Number(r.sale_price)>0?Number(r.sale_price):Number(prices.get(pricingKey(r.platform,r.stock_kind,r.duration_months))?.retail_cents||0)/100 as number})) as {id:string;platform:string;type:string;months:number;expires:string|null;version:string;price:number}[];
});
export const comboAssign=createServerFn({method:"POST"}).validator((v:unknown)=>auth.extend({requestId:z.string().uuid(),clientId:z.string().uuid(),title:z.string().trim().min(2).max(140),kind,protected:z.boolean(),items:z.array(z.object({id:z.string().uuid(),version:z.string().datetime({offset:true}),price:z.number().finite().min(0).max(1000000)})).min(2).max(20)}).parse(v)).handler(async({data})=>{
 await gate(data.code);
 const ops=await import("@/lib/workspace/operations.server"),ds=await import("@/lib/deliveries/deliveries.server"),db=ops.opsDB();
 const client=await ops.readRecord(data.clientId);
 if(client.module!=="clients"||client.status!=="active"||(client.data.shopId&&client.data.shopId!=="main"))throw new Error("Cliente no disponible");
 const ids=data.items.map(i=>i.id).sort();
 if(new Set(ids).size!==ids.length)throw new Error("No repitas una cuenta");
 const existing=await ops.readRecord(data.requestId).catch(()=>null);
 if(existing){if(existing.module!=="requests"||existing.data.clientId!==client.id||existing.data.comboStockIds!==JSON.stringify(ids))throw new Error("Solicitud ya utilizada");return {id:existing.id,text:existing.data.reply||"",url:existing.data.deliveryUrl||""};}
 const {data:raw,error}=await db.from("stock_items").select("*").in("id",ids).is("business_id",null);
 if(error||raw?.length!==ids.length)throw new Error("No se encontraron todas las cuentas");
 const stock=await Promise.all(raw.map((r:any)=>(import("./stock.server")).then(s=>s.rowToStock(r))));
 const today=(await import("./duration")).businessToday();
 if(stock.some(s=>s.status!=="available"||s.stockKind!==data.kind||!s.username||!s.password||s.updatedAt!==data.items.find(i=>i.id===s.id)?.version||Boolean(s.expiresOn&&s.expiresOn<today)))throw new Error("Una cuenta ya no está disponible. Actualiza el inventario.");
 const lines=stock.map(s=>[s.platform+" · "+s.accountType,"Usuario: "+s.username,"Contraseña: "+s.password,s.profilePin?"Perfil / PIN: "+s.profilePin:""].filter(Boolean).join("\n")).join("\n\n");
 const now=new Date().toISOString(),phone=client.data.whatsapp||"",total=data.items.reduce((n,i)=>n+Math.round(i.price*100),0)/100;
 let url="",reply=lines,document:string|null=null;
 if(data.protected){
  const token=ds.randomToken(),accessPassword=ds.randomToken().slice(0,12);
  const payload:ProtectedDeliveryPrivate={id:data.requestId,createdAt:now,updatedAt:now,platform:data.title,client:client.title,whatsapp:phone,username:"",password:"",link:"",notes:lines,images:[],attachment:null,expiresAt:new Date(Date.now()+7*86400000).toISOString(),maxViews:null,viewCount:0,lastViewedAt:null,status:"active",imageCount:0,protectedWithPassword:true,history:[{at:now,kind:"created",detail:"Combo desde inventario"}],accessPassword,token};
  document=await ds.encryptPayload(payload);url="https://martgor.shop/e/"+data.requestId+"?t="+encodeURIComponent(token);reply="Documento: "+url+"\nContraseña: "+accessPassword;
 }
 const payload=await ds.encryptPayload({clientId:client.id,platform:data.title,amount:String(total),message:stock.map(s=>s.platform).join(" · "),reply,deliveryUrl:url,comboStockIds:JSON.stringify(ids)});
 const {error:assignError}=await db.rpc("ma2_assign_stock_combo",{p_request:data.requestId,p_client:client.id,p_client_version:client.version,p_name:client.title,p_phone:phone,p_title:data.title,p_kind:data.kind,p_items:data.items,p_payload:payload,p_document:document});
 if(assignError)throw new Error(assignError.message||"No se pudo asignar el combo");
 const saved=await ops.readRecord(data.requestId);
 return {id:saved.id,text:saved.data.reply||"",url:saved.data.deliveryUrl||""};
});
export const comboCopyCredentials=createServerFn({method:"POST"}).validator((v:unknown)=>auth.extend({id:z.string().uuid()}).parse(v)).handler(async({data})=>{
 await gate(data.code);
 const record=await (await import("@/lib/workspace/operations.server")).readRecord(data.id);
 if(record.module!=="requests"||record.status!=="completed"||!record.data.comboStockIds)throw new Error("Combo no disponible");
 if(!record.data.deliveryUrl)return record.data.reply||"";
 const ds=await import("@/lib/deliveries/deliveries.server"),row=await ds.getDeliveryRow(record.id);
 if(!row)throw new Error("Documento no disponible");
 const doc=await ds.decryptPayload<ProtectedDeliveryPrivate>(String(row.detail||""));
 return doc.notes;
});
