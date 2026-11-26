import { businessToday, expiresAfterMonths } from "./duration";
import type { DeliveryAttachment, ProtectedDeliveryPrivate } from "@/lib/deliveries/types";
type Input={requestId:string;itemId:string;clientId?:string;clientName:string;clientWhatsapp:string;stockExpiresOn:string|null;salePrice:number;accessPassword:string;expiresAt:string;maxViews:number|null;notes:string;attachment:DeliveryAttachment|null;images:string[]};

/** One transaction reserves stock, debits the wallet and saves the delivery and client history. */
export async function deliverManualWithWallet(input:Input){
 const ops=await import("@/lib/workspace/operations.server"),ds=await import("@/lib/deliveries/deliveries.server");
 const cents=Math.round(input.salePrice*100);
 if(cents<=0||cents>100000000||Math.abs(input.salePrice*100-cents)>1e-6)throw new Error("Indica un precio de venta válido, mayor a cero.");
 const clientId=input.clientId||(await (await import("@/lib/customer/remember-client.server")).rememberOrderClient(input.clientName,input.clientWhatsapp));
 if(!clientId)throw new Error("Selecciona un cliente o registra su nombre y WhatsApp válido.");
 const client=await ops.readRecord(clientId);
 if(client.module!=="clients"||client.status!=="active"||(client.data.shopId&&client.data.shopId!=="main"))throw new Error("Cliente no disponible");
 const item=(await (await import("./stock.server")).listStock(null)).find(x=>x.id===input.itemId);
 if(!item)throw new Error("Registro no encontrado");
 const saved=async()=>{
   const record=await ops.readRecord(input.requestId);
   if(record.module!=="requests"||record.data.clientId!==clientId||record.data.manualStockId!==item.id||Number(record.data.amount)!==cents/100)throw new Error("La referencia ya fue utilizada.");
   const row=await ds.getDeliveryRow(input.requestId);
   if(!row)throw new Error("Entrega registrada; consulta el historial del cliente.");
   const payload=await ds.decryptPayload<ProtectedDeliveryPrivate>(String(row.detail));
   return {id:input.requestId,token:payload.token,client:client.title,whatsapp:client.data.whatsapp||"",platform:item.platform};
 };
 if(item.relatedOrderId===input.requestId&&item.protectedDeliveryId===input.requestId)return saved();
 if(item.status!=="available")throw new Error("La cuenta ya no está disponible.");
 const today=businessToday(),expiry=input.stockExpiresOn||item.expiresOn||expiresAfterMonths(today,item.durationMonths||1);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(expiry)||expiry<today||Date.parse(input.expiresAt)<=Date.now())throw new Error("Revisa las fechas de vigencia.");
 if(input.accessPassword&&input.accessPassword.length<4)throw new Error("La contraseña de protección debe tener al menos cuatro caracteres.");
 const now=new Date().toISOString(),phone=client.data.whatsapp||"",token=ds.randomToken();
 const document:ProtectedDeliveryPrivate={id:input.requestId,createdAt:now,updatedAt:now,platform:item.platform,client:client.title,whatsapp:phone,username:item.username,password:item.password,link:item.panelUrl,panelUsername:item.panelUsername,panelPassword:item.panelPassword,accessPassword:input.accessPassword,protectedWithPassword:Boolean(input.accessPassword),notes:[item.profilePin?`Perfil / PIN: ${item.profilePin}`:"",input.notes||item.notes].filter(Boolean).join("\n"),images:input.images,attachment:input.attachment,imageCount:input.images.length,expiresAt:input.expiresAt,maxViews:input.maxViews,viewCount:0,lastViewedAt:null,status:"active",token,history:[{at:now,kind:"created",detail:"Entrega manual pagada con saldo"}]};
 const url=`https://martgor.shop/e/${input.requestId}?t=${encodeURIComponent(token)}`;
 const payload=await ds.encryptPayload({clientId,platform:item.platform,amount:String(cents/100),deliveryUrl:url,reply:"Entrega manual pagada con saldo",manualStockId:item.id});
 const {error}=await ops.opsDB().rpc("ma2_manual_wallet_delivery",{p_request:input.requestId,p_client:clientId,p_client_version:client.version,p_stock:item.id,p_stock_version:item.updatedAt,p_name:client.title,p_phone:phone,p_cents:cents,p_expiry:expiry,p_title:item.platform,p_payload:payload,p_document:await ds.encryptPayload(document)});
 if(error)throw new Error(error.message||"No se pudo completar la entrega.");
 return saved();
}
