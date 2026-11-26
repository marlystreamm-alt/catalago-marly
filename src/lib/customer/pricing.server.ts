import { opsDB } from "@/lib/workspace/operations.server";
import { pricingKey, type PriceRow } from "./pricing";

type SavedPrice = { product_key: string; name: string; kind: string; months: number; retail_cents: number | null; reseller_cents: number | null; updated_at: string; cost_cents?:number|null; provider?:string; image?:string; description?:string; published?:boolean|null };
export async function savedPrices(): Promise<SavedPrice[]> {
  const rows:SavedPrice[]=[];
  for(let offset=0;;offset+=500){const {data,error}=await opsDB().from("ma2_product_prices").select("*").order("product_key").range(offset,offset+499);if(error)throw new Error("No se pudieron consultar las tarifas");rows.push(...(data||[]));if((data||[]).length<500)break;}
  return rows;
}

export async function listPricing(): Promise<PriceRow[]> {
  const db=opsDB();
  const saved=await savedPrices();
  const rows=new Map<string,PriceRow>();
  const ensure=(key:string,name:string,kind:string,months:number)=>{if(!rows.has(key)) rows.set(key,{key,name,kind,months,retailCents:null,resellerCents:null,available:0,source:"Inventario · sin publicar",version:null,published:false});return rows.get(key)!;};
  const today=(await import("@/lib/stock/duration")).businessToday();
  const parents=new Set<string>();
  for(let offset=0;;offset+=500) {const r=await db.from("stock_items").select("parent_stock_id").is("business_id",null).not("parent_stock_id","is",null).order("id").range(offset,offset+499);if(r.error)throw new Error("No se pudo comprobar el inventario");for(const item of r.data||[])parents.add(String(item.parent_stock_id));if((r.data||[]).length<500)break;}
  for(let offset=0;;offset+=500) {
    const r=await db.from("stock_items").select("id,platform,stock_kind,duration_months,sale_price,expires_on").is("business_id",null).eq("status","available").neq("account_type","split_parent").neq("username","").neq("password_cipher","").order("id").range(offset,offset+499);
    if(r.error) throw new Error("No se pudo consultar el inventario");
    for(const item of r.data||[]) {
      if(parents.has(String(item.id))||(item.expires_on && item.expires_on<today)) continue;
      const kind=String(item.stock_kind),months=Number(item.duration_months),name=String(item.platform).trim(),key=pricingKey(name,kind,months),row=ensure(key,name,kind,months);
      row.available++;
    }
    if((r.data||[]).length<500) break;
  }
  for(const p of saved) { const row=ensure(p.product_key,p.name,p.kind,p.months);row.retailCents=p.retail_cents;row.resellerCents=p.reseller_cents;row.source="Tienda web";row.version=p.updated_at;row.costCents=p.cost_cents;row.provider=p.provider;row.image=p.image||row.image;row.description=p.description||row.description;row.published=p.published===true; }
  return [...rows.values()].sort((a,b)=>b.available-a.available||a.name.localeCompare(b.name,"es")||a.kind.localeCompare(b.kind)||a.months-b.months);
}
