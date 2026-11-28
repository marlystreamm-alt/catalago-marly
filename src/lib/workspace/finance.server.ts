import { cyberdocCut, cyberdocRate } from "../cyberdocs/rates";
import {opsDB,readRecords,walletEntries} from "./operations.server";
import {financeToday,type FinanceAccount,type FinanceMove,type FinanceSource,type FinanceDebt} from "./finance";
async function all(table:string,columns:string,filter?:(q:any)=>any){const out:any[]=[];for(let i=0;;i+=500){let q=opsDB().from(table).select(columns).order("id");if(filter)q=filter(q);const r=await q.range(i,i+499);if(r.error)throw Error("No se pudieron cargar las finanzas");out.push(...(r.data||[]));if((r.data||[]).length<500)return out;}}
export async function financeSnapshot(){
 const [accounts,moves,cuts,debts,clients,wallet,shops,orders,stock,bankEvents,webRequests,webDeliveries,cyberdocDeliveries]=await Promise.all([
 all("ma2_finance_accounts","*"),all("ma2_finance_moves","*"),all("ma2_finance_cuts","*",q=>q.is("deleted_at",null)),all("ma2_finance_debts","*"),readRecords("clients"),walletEntries(),all("ma2_customer_accounts","id,client_id,business_id"),all("ma2_customer_orders","id,stock_id,amount_cents,title,created_at",q=>q.is("business_id",null)),all("stock_items","id,platform,cost,sale_price,acquired_on,delivered_on,parent_stock_id,related_order_id,status",q=>q.is("business_id",null)),all("ma2_recharge_events","id,request_id,received_at,amount_cents,reference,tracking,transfer_key,finance_key,finance_direction,verified,status,reason,source_key",q=>q.or("finance_direction.not.is.null,and(verified.eq.true,status.in.(review,credited))")),
 all("orders","id",q=>q.eq("catalog_id","store-ma2")),
 all("cyberdocs_orders","id,notification_order_id",q=>q.eq("source_key","web_catalog")),
 all("cyberdocs_orders","id,service_name,finalized_at",q=>q.eq("source_key","cyberdocsmx_bot")
   .eq("status","completed").gte("finalized_at","2026-11-28T04:00:00Z"))]);
 const excluded=new Set(shops.filter(s=>s.business_id).map(s=>s.client_id));const main=new Set(clients.filter(c=>!excluded.has(c.id)&&(!c.data.shopId||c.data.shopId==="main")).map(c=>c.id));for(const s of shops)if(!s.business_id)main.add(s.client_id);const mainWallet=wallet.filter(w=>main.has(w.client_id));const orderIds=new Set(orders.map(o=>String(o.id)));const soldStock=new Set(orders.map(o=>o.stock_id));const parents=new Set(stock.map(s=>s.parent_stock_id).filter(Boolean));
 const date=(v:string)=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Monterrey",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(v));
 const webRequestIds = new Set(webRequests.map(order => String(order.id)));
 const webRequestPurchases = mainWallet.filter(entry =>
   entry.kind === "purchase" && entry.amount_cents < 0 && webRequestIds.has(entry.request_id));
 const paidRequestIds = new Set(webRequestPurchases.map(entry => entry.request_id));
 for (const delivery of webDeliveries) {
   if (!paidRequestIds.has(delivery.notification_order_id)) continue;
   orderIds.add(String(delivery.id));
 }
 const currentCut = cyberdocCut(new Date().toISOString());
 const cyberdocCuts = new Map<string, {date:string; amount:number; count:number; missing:string[]}>();
 for (const delivery of cyberdocDeliveries) {
   orderIds.add(String(delivery.id));
   const day = cyberdocCut(delivery.finalized_at);
   const cut = cyberdocCuts.get(day) ?? {date:day, amount:0, count:0, missing:[]};
   cut.count++;
   const amount = cyberdocRate(delivery.service_name);
   if (amount === undefined) cut.missing.push(delivery.service_name);
   else cut.amount += amount;
   cyberdocCuts.set(day, cut);
 }
 const cyberdocPayouts = [...cyberdocCuts.values()].sort((a,b)=>b.date.localeCompare(a.date)).map(cut => {
   const key = `cyberdoc-cut:${cut.date}`;
   const payment = moves.find(move=>move.source_key===key && !move.voided_at);
   return {...cut,key,closed:cut.date<currentCut,paidOn:payment?.occurred_on as string | undefined};
 });
 const bankByTransfer = new Map<string, typeof bankEvents>();
 for (const event of bankEvents) {
   const kind = event.finance_direction || "income";
   const transfer = event.finance_key || event.transfer_key || event.source_key;
   const key = `bank-mail:${kind}:${transfer}`;
   const group = bankByTransfer.get(key) || [];
   group.push(event);
   bankByTransfer.set(key, group);
 }
 const sources: FinanceSource[] = [];
 const incompleteBankNotices = [];
 for (const [key, events] of bankByTransfer) {
   const event = events.slice().sort((a,b) => a.received_at.localeCompare(b.received_at) || a.id.localeCompare(b.id))[0];
   const kind = event.finance_direction === "expense" ? "expense" : "income";
   const amounts = [...new Set(events.map(notice => Number(notice.amount_cents)).filter(amount => amount > 0))];
   if (amounts.length !== 1) {
     incompleteBankNotices.push({key, kind, date: date(event.received_at), issue: amounts.length ? "Importes contradictorios" : "Importe sin identificar"});
     continue;
   }
   const creditedEvents = events.filter(notice=>notice.status==="credited");
   const requestIds = new Set(creditedEvents.flatMap(notice=>[notice.request_id, notice.id]).filter(Boolean));
   const legacyKeys = mainWallet.filter(w=>w.kind==="recharge" && requestIds.has(w.request_id)).map(w=>`recharge:${w.id}`);
   const reference = creditedEvents[0]?.reference || event.reference;
   sources.push({
     key, bankTransfer: event.finance_key || event.transfer_key || event.source_key, legacyKeys, kind,
     amount: amounts[0], date: date(event.received_at), receivedAt: event.received_at,
     category: kind === "income" ? "Ingreso por correo" : "Salida por correo",
     title: kind === "expense" ? "Transferencia enviada" : creditedEvents.length ? "Recarga acreditada" : "Depósito recibido",
     reference,
   });
 }
 const linkedWallet = new Set(sources.flatMap(source=>source.legacyKeys || []));
 for (const entry of mainWallet) {
   if (entry.kind !== "recharge" || entry.amount_cents <= 0 || linkedWallet.has(`recharge:${entry.id}`)) continue;
   sources.push({key:`recharge:${entry.id}`,kind:"income",amount:Number(entry.amount_cents),date:date(entry.created_at),category:"Recarga de cliente",title:entry.note||"Recarga registrada"});
 }
 for(const s of stock){if(!s.parent_stock_id&&s.acquired_on&&Number(s.cost)>0)sources.push({key:`stock-cost:${s.id}`,kind:"expense",amount:Math.round(Number(s.cost)*100),date:s.acquired_on,category:"Compra de stock",title:s.platform});if(!parents.has(s.id)&&s.delivered_on&&Number(s.sale_price)>0&&!soldStock.has(s.id)&&!paidRequestIds.has(String(s.related_order_id))&&!orderIds.has(String(s.related_order_id)))sources.push({key:`direct-sale:${s.id}:${s.delivered_on}`,kind:"income",amount:Math.round(Number(s.sale_price)*100),date:s.delivered_on,category:"Venta directa",title:s.platform});}
 return {cyberdocPayouts,incompleteBankNotices,accounts:accounts as FinanceAccount[],moves:moves as FinanceMove[],cuts:cuts as {id:string;account_id:string;cut_on:string;expected_cents:number;counted_cents:number|null;automatic:boolean;confirmed_at:string|null;income_cents:number|null;expense_cents:number|null;transfer_in_cents:number|null;transfer_out_cents:number|null;excluded_move_ids?:string[]}[],debts:debts as FinanceDebt[],sources,webRequestPurchases:webRequestPurchases.map(entry=>({date:date(entry.created_at),amount:-Number(entry.amount_cents)})),orders:orders.map(o=>({id:String(o.id),title:String(o.title),amount:Number(o.amount_cents),date:date(o.created_at),cost:(()=>{const s=stock.find(s=>s.id===o.stock_id);return s&&!s.parent_stock_id&&!parents.has(s.id)&&s.cost!=null&&Number(s.cost)>0?Math.round(Number(s.cost)*100):null;})()})),walletBalance:mainWallet.filter(w=>!["credit","repayment"].includes(w.kind)).reduce((n,w)=>n+Number(w.amount_cents),0),today:financeToday()};
}
