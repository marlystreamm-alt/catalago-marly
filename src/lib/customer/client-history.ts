import {phoneNumber,type OpsRecord} from "../workspace/model.ts";
import {deliveryDateKey} from "../stock/delivery-sort.ts";

export type ClientOrigin = "web"|"cyberdoc"|"manual";
export const ORIGIN_LABELS={web:"🌎 Tienda web",cyberdoc:"🔗 Cyberdoc",manual:"🌻 Manual"} as const;
export type ClientHistoryRow={id:string;title:string;date:string;kind:string;detail:string;amount?:number;expires?:string|null};
export type HistoryData={accounts:any[];purchases:any[];stock:any[];released:any[];orders:any[];replacements:any[]};
export function buildClientHistories(records:OpsRecord[],data:HistoryData){
 const contacts=records.filter(r=>r.module==="clients"&&(!r.data.shopId||r.data.shopId==="main"));
 const histories=new Map(contacts.map(c=>[c.id,{origins:new Set<ClientOrigin>(),rows:[] as ClientHistoryRow[],accounts:[] as any[]}]));
 const phone=(value:string)=>{const n=phoneNumber(value||"");return /^\d{11,15}$/.test(n)?n:"";};
 const byPhone=new Map<string,string[]>();
 for(const c of contacts){const p=phone(c.data.whatsapp);if(p)byPhone.set(p,[...(byPhone.get(p)||[]),c.id]);if(/cyberdoc/i.test(c.data.notes||""))histories.get(c.id)!.origins.add("cyberdoc");}
 const contactId=(value:string)=>{const ids=byPhone.get(phone(value))||[];return ids.length===1?ids[0]:undefined;};
 const add=(id:string|undefined,row:ClientHistoryRow,origin?:ClientOrigin)=>{const h=id?histories.get(id):undefined;if(!h)return;if(origin)h.origins.add(origin);if(!h.rows.some(r=>r.id===row.id))h.rows.push(row);};
 const purchaseById=new Map(data.purchases.map(p=>[p.id,p]));
 const orderById=new Map(data.orders.map(o=>[o.id,o]));
 for(const a of data.accounts){const h=histories.get(a.client_id);if(h){h.origins.add("web");h.accounts.push(a);}}
 for(const p of data.purchases)add(p.client_id,{id:`purchase:${p.id}`,title:p.title,date:p.created_at,kind:"Compra web",detail:"Entregada",amount:Number(p.amount_cents)/100,expires:p.expires_on},"web");
 const requestById=new Map(records.filter(r=>r.module==="requests").map(r=>[r.id,r]));
 for(const o of data.orders){const linked=data.stock.find(s=>s.related_order_id===o.id);const id=requestById.get(o.notification_order_id)?.data.clientId||contactId(o.whatsapp)||(!o.whatsapp?contactId(linked?.client_whatsapp):undefined);const origin=o.source_key==="web_catalog"?"web":"cyberdoc";add(id,{id:`order:${o.id}`,title:o.service_name,date:o.finalized_at||o.delivered_on||o.assigned_at||o.created_at,kind:origin==="web"?"Pedido web":"Pedido Cyberdoc",detail:o.status==="completed"?"Entregado":o.status==="in_process"&&o.stock_item_id?"Asignada · pendiente de entrega":o.status==="in_process"?"En proceso":o.status==="cancelled"?"Cancelado":o.status==="rejected"?"Rechazado":"Pendiente",expires:o.expires_on},origin);}
 const linkedRequests=new Set<string>();
 for(const s of data.stock){if(purchaseById.has(s.related_order_id)||orderById.has(s.related_order_id))continue;const id=requestById.get(s.related_order_id)?.data.clientId||contactId(s.client_whatsapp);if(!id)continue;if(s.related_order_id)linkedRequests.add(s.related_order_id);add(id,{id:`stock:${s.id}:${s.delivered_on}`,title:`${s.platform} · ${s.account_type||"Cuenta"}`,date:s.delivered_on,kind:"Cuenta entregada",detail:s.status,amount:Number(s.sale_price),expires:s.expires_on});}
 for(const s of data.released){const id=contactId(s.client_whatsapp);if(!id)continue;if(data.purchases.some(p=>p.client_id===id&&p.stock_id===s.stock_id&&deliveryDateKey(p.created_at).startsWith(s.delivered_on))||data.orders.some(o=>o.stock_item_id===s.stock_id&&contactId(o.whatsapp)===id&&deliveryDateKey(o.delivered_on||o.finalized_at).startsWith(s.delivered_on)))continue;add(id,{id:`released:${s.id}`,title:`${s.platform} · ${s.account_type||"Cuenta"}`,date:s.delivered_on,kind:"Cuenta anterior",detail:"Historial de entrega",amount:Number(s.sale_price),expires:s.expires_on});}
 for(const r of records){if(!["requests","reports","questions"].includes(r.module)||!r.data.clientId)continue;if(r.module==="requests"&&(linkedRequests.has(r.id)||data.orders.some(o=>o.notification_order_id===r.id)))continue;add(r.data.clientId,{id:`record:${r.id}`,title:r.title,date:r.updatedAt||r.createdAt,kind:r.module==="reports"?"Reporte":r.module==="questions"?"Consulta":r.data.comboStockIds?"Combo":"Solicitud / entrega",detail:r.module==="reports"&&r.data.reply?`${r.status} · ${r.data.reply}`:r.status,amount:r.module==="requests"&&r.data.amount?Number(r.data.amount):undefined});}
 for(const r of data.replacements){const p=purchaseById.get(r.purchase_id);if(p)add(p.client_id,{id:`replacement:${r.report_id}`,title:p.title,date:r.created_at,kind:"Reposición",detail:"Cambio de cuenta sin cobro",expires:p.expires_on});}
 for(const h of histories.values()){if(!h.origins.size)h.origins.add("manual");h.rows.sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));}
 return histories;
}

/** Informational only: never changes access, tariff, wallet or assignment permissions. */
export function recentClientAssignment(createdAt:string,rows:ClientHistoryRow[],today:string){
 const assignments=rows.filter(r=>["Compra web","Cuenta entregada","Cuenta anterior","Reposición"].includes(r.kind)||(["Pedido web","Pedido Cyberdoc","Solicitud / entrega","Combo"].includes(r.kind)&&["Entregado","completed","Asignada · pendiente de entrega"].includes(r.detail)));
 const last=[deliveryDateKey(createdAt),...assignments.map(r=>deliveryDateKey(r.date))].filter(d=>!d.startsWith("9999")).sort().at(-1)?.slice(0,10);
 if(!last)return true;
 const [y,m,d]=today.split("-").map(Number),previous=new Date(Date.UTC(y,m-2,1));
 const days=new Date(Date.UTC(previous.getUTCFullYear(),previous.getUTCMonth()+1,0)).getUTCDate();
 const cutoff=new Date(Date.UTC(previous.getUTCFullYear(),previous.getUTCMonth(),Math.min(d,days))).toISOString().slice(0,10);
 return last>=cutoff;
}
