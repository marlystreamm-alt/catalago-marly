import {opsDB,readRecords,walletEntries} from "./operations.server";
import {financeToday,type FinanceAccount,type FinanceMove,type FinanceSource,type FinanceDebt} from "./finance";
async function all(table:string,columns:string,filter?:(q:any)=>any){const out:any[]=[];for(let i=0;;i+=500){let q=opsDB().from(table).select(columns).order("id");if(filter)q=filter(q);const r=await q.range(i,i+499);if(r.error)throw Error("No se pudieron cargar las finanzas");out.push(...(r.data||[]));if((r.data||[]).length<500)return out;}}
export async function financeSnapshot(){
 const [accounts,moves,cuts,debts,clients,wallet,shops,orders,stock,bankEvents,webRequests,webDeliveries]=await Promise.all([
 all("ma2_finance_accounts","*"),all("ma2_finance_moves","*"),all("ma2_finance_cuts","*",q=>q.is("deleted_at",null)),all("ma2_finance_debts","*"),readRecords("clients"),walletEntries(),all("ma2_customer_accounts","id,client_id,business_id"),all("ma2_customer_orders","id,stock_id,amount_cents,title,created_at",q=>q.is("business_id",null)),all("stock_items","id,platform,cost,sale_price,acquired_on,delivered_on,parent_stock_id,related_order_id,status",q=>q.is("business_id",null)),all("ma2_recharge_events","id,request_id,received_at,amount_cents",q=>q.eq("status","credited")),
 all("orders","id",q=>q.eq("catalog_id","store-ma2")),
 all("cyberdocs_orders","id,notification_order_id",q=>q.eq("source_key","web_catalog"))]);
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
 const bankByRequest=new Map(bankEvents.map(e=>[e.request_id||e.id,e]));
 const sources:FinanceSource[]=[];for(const w of mainWallet)if(w.kind==="recharge"&&w.amount_cents>0){const event=bankByRequest.get(w.request_id),receivedAt=event?.received_at||w.created_at;sources.push({key:`recharge:${w.id}`,kind:"income",amount:Number(event?.amount_cents??w.amount_cents),date:date(receivedAt),receivedAt,category:"Recarga de cliente",title:w.note||"Recarga confirmada"});}
 for(const s of stock){if(!s.parent_stock_id&&s.acquired_on&&Number(s.cost)>0)sources.push({key:`stock-cost:${s.id}`,kind:"expense",amount:Math.round(Number(s.cost)*100),date:s.acquired_on,category:"Compra de stock",title:s.platform});if(!parents.has(s.id)&&s.delivered_on&&Number(s.sale_price)>0&&!soldStock.has(s.id)&&!paidRequestIds.has(String(s.related_order_id))&&!orderIds.has(String(s.related_order_id)))sources.push({key:`direct-sale:${s.id}:${s.delivered_on}`,kind:"income",amount:Math.round(Number(s.sale_price)*100),date:s.delivered_on,category:"Venta directa",title:s.platform});}
 return {accounts:accounts as FinanceAccount[],moves:moves as FinanceMove[],cuts:cuts as {id:string;account_id:string;cut_on:string;expected_cents:number;counted_cents:number|null;automatic:boolean;confirmed_at:string|null;income_cents:number|null;expense_cents:number|null;transfer_in_cents:number|null;transfer_out_cents:number|null}[],debts:debts as FinanceDebt[],sources,webRequestPurchases:webRequestPurchases.map(entry=>({date:date(entry.created_at),amount:-Number(entry.amount_cents)})),orders:orders.map(o=>({id:String(o.id),title:String(o.title),amount:Number(o.amount_cents),date:date(o.created_at),cost:(()=>{const s=stock.find(s=>s.id===o.stock_id);return s&&!s.parent_stock_id&&!parents.has(s.id)&&s.cost!=null&&Number(s.cost)>0?Math.round(Number(s.cost)*100):null;})()})),walletBalance:mainWallet.filter(w=>!["credit","repayment"].includes(w.kind)).reduce((n,w)=>n+Number(w.amount_cents),0),today:financeToday()};
}
