import { opsDB } from "@/lib/workspace/operations.server";
import type { AppState } from "@/lib/catalog/types";
import { catalogPriceVariant, pricingKey, type PriceRow } from "./pricing";

type SavedPrice = { product_key: string; name: string; kind: string; months: number; retail_cents: number | null; reseller_cents: number | null; updated_at: string };
export async function savedPrices(): Promise<SavedPrice[]> {
  const rows:SavedPrice[]=[];
  for(let offset=0;;offset+=500){const {data,error}=await opsDB().from("ma2_product_prices").select("*").order("product_key").range(offset,offset+499);if(error)throw new Error("No se pudieron consultar las tarifas");rows.push(...(data||[]));if((data||[]).length<500)break;}
  return rows;
}

export function overlayPrices(state: AppState, saved: SavedPrice[]): AppState {
  const byKey = new Map(saved.map(p=>[p.product_key,p]));
  const catalogs={...state.catalogs};
  for(const [id, field] of [["clientes","retail_cents"],["revendedores","reseller_cents"]] as const) {
    const catalog=catalogs[id]; if(!catalog) continue;
    const counts=new Map<string,number>();
    for(const service of catalog.services) { const key=catalogPriceVariant(service).key;counts.set(key,(counts.get(key)||0)+1); }
    catalogs[id]={...catalog,services:catalog.services.map(service=>{
      const key=catalogPriceVariant(service).key, cents=byKey.get(key)?.[field];
      return counts.get(key)===1 && cents!=null?{...service,price:cents/100,priceText:undefined}:service;
    })};
  }
  return {...state,catalogs};
}

export async function listPricing(): Promise<PriceRow[]> {
  const db=opsDB();
  const [catalog,saved]=await Promise.all([db.from("catalog_app_state").select("state").eq("id",1).maybeSingle(),savedPrices()]);
  if(catalog.error) throw new Error("No se pudo consultar el catálogo");
  const state=catalog.data?.state as AppState|undefined;
  const rows=new Map<string,PriceRow>();
  const ensure=(key:string,name:string,kind:string,months:number)=>{if(!rows.has(key)) rows.set(key,{key,name,kind,months,retailCents:null,resellerCents:null,available:0,source:"catálogo",version:null});return rows.get(key)!;};
  const counts=new Map<string,number>();
  for(const [id,field] of [["clientes","retailCents"],["revendedores","resellerCents"]] as const) {
    for(const card of state?.catalogs[id]?.services||[]) {
      if(!card.active) continue;
      const {key,kind,months}=catalogPriceVariant(card),row=ensure(key,card.name,kind,months);
      const countKey=id+":"+key,count=(counts.get(countKey)||0)+1;counts.set(countKey,count);
      row[field]=count===1&&Number.isFinite(card.price)&&card.price>0&&!card.priceText?.trim()?Math.round(card.price*100):null;
      if(count>1) row.source="Revisar duplicados del catálogo";
    }
  }
  const stockPrices=new Map<string,Set<number>>();
  const today=(await import("@/lib/stock/duration")).businessToday();
  const parents=new Set<string>();
  for(let offset=0;;offset+=500) {const r=await db.from("stock_items").select("parent_stock_id").is("business_id",null).not("parent_stock_id","is",null).order("id").range(offset,offset+499);if(r.error)throw new Error("No se pudo comprobar el inventario");for(const item of r.data||[])parents.add(String(item.parent_stock_id));if((r.data||[]).length<500)break;}
  for(let offset=0;;offset+=500) {
    const r=await db.from("stock_items").select("id,platform,stock_kind,duration_months,sale_price,expires_on").is("business_id",null).eq("status","available").neq("account_type","split_parent").neq("username","").neq("password_cipher","").order("id").range(offset,offset+499);
    if(r.error) throw new Error("No se pudo consultar el inventario");
    for(const item of r.data||[]) {
      if(parents.has(String(item.id))||(item.expires_on && item.expires_on<today)) continue;
      const kind=String(item.stock_kind),months=Number(item.duration_months),name=String(item.platform).trim(),key=pricingKey(name,kind,months),row=ensure(key,name,kind,months);
      row.available++; if(!stockPrices.has(key)) stockPrices.set(key,new Set());
      if(Number(item.sale_price)>0) stockPrices.get(key)!.add(Math.round(Number(item.sale_price)*100));
    }
    if((r.data||[]).length<500) break;
  }
  for(const [key,prices] of stockPrices) { const row=rows.get(key)!;if(row.retailCents==null&&prices.size===1){row.retailCents=[...prices][0];row.source="Precio de inventario";} }
  for(const p of saved) { const row=ensure(p.product_key,p.name,p.kind,p.months);row.retailCents=p.retail_cents??row.retailCents;row.resellerCents=p.reseller_cents??row.resellerCents;row.source="Tarifa centralizada";row.version=p.updated_at; }
  return [...rows.values()].sort((a,b)=>b.available-a.available||a.name.localeCompare(b.name,"es")||a.kind.localeCompare(b.kind)||a.months-b.months);
}
