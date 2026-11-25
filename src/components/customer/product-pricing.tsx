import { useEffect,useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSavedCode } from "@/lib/notify/client";
import { pricingLoad,pricingSave } from "@/lib/customer/pricing.functions";
import { pricingKey,type PriceRow } from "@/lib/customer/pricing";
import { useCatalogStore } from "@/lib/catalog/store";

const label=(kind:string)=>kind==="profile"?"Perfil":kind==="complete"?"Cuenta completa":kind.startsWith("catalog-request-")?"Por encargo":kind.replace("catalog-","");
function PriceCard({row,busy,onSave}:{row:PriceRow;busy:boolean;onSave:(row:PriceRow,retail:string,reseller:string)=>void}) {
  const [retail,setRetail]=useState(row.retailCents==null?"":String(row.retailCents/100));
  const [reseller,setReseller]=useState(row.resellerCents==null?"":String(row.resellerCents/100));
  return <form className="seller-card space-y-3" onSubmit={e=>{e.preventDefault();onSave(row,retail,reseller);}}>
    <div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-bold">{row.name}</h3><p className="text-xs text-muted-foreground">{label(row.kind)} · {row.months} mes(es) · {row.source}</p></div><span className="seller-badge">{row.available} en stock</span></div>
    <div className="grid grid-cols-2 gap-2"><label className="seller-field min-w-0"><span>Cliente normal · MXN</span><Input type="number" min="0.01" step="0.01" max="1000000" value={retail} onChange={e=>setRetail(e.target.value)} placeholder="Sin configurar"/></label><label className="seller-field min-w-0"><span>Revendedor · MXN</span><Input type="number" min="0.01" step="0.01" max="1000000" value={reseller} onChange={e=>setReseller(e.target.value)} placeholder="Sin configurar"/></label></div>
    {row.resellerCents==null && <p className="text-xs text-muted-foreground">Sin tarifa de revendedor, este producto no se ofrece para compra con saldo a revendedores.</p>}
    <Button type="submit" size="sm" disabled={busy}>Guardar precios</Button><p className="text-[11px] text-muted-foreground">Los campos vacíos conservan la tarifa original, si existe.</p>
  </form>;
}
export function ProductPricing(){
  const store=useCatalogStore();
  const [rows,setRows]=useState<PriceRow[]>([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[query,setQuery]=useState(""),[onlyStock,setOnlyStock]=useState(false),[error,setError]=useState("");
  const [add,setAdd]=useState(false),[name,setName]=useState(""),[kind,setKind]=useState("profile"),[months,setMonths]=useState("1");
  const load=async()=>{setLoading(true);setError("");try{setRows(await pricingLoad({data:{code:getSavedCode()}}));}catch(e){setError(e instanceof Error?e.message:"No se pudieron cargar los precios");}finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);
  const save=async(row:PriceRow,retail:string,reseller:string)=>{const parse=(v:string)=>v.trim()?Math.round(Number(v)*100):null;const retailCents=parse(retail),resellerCents=parse(reseller);if((retailCents!==null&&(!Number.isSafeInteger(retailCents)||retailCents<=0))||(resellerCents!==null&&(!Number.isSafeInteger(resellerCents)||resellerCents<=0))||(!retailCents&&!resellerCents))return toast.error("Escribe al menos un precio válido");if(busy)return;setBusy(true);try{setRows(await pricingSave({data:{code:getSavedCode(),key:row.key,name:row.name,kind:row.kind,months:row.months,retailCents,resellerCents,version:row.version}}));store.applyCentralPrice(row.key,retailCents,resellerCents);toast.success("Tarifas guardadas");}catch(e){toast.error(e instanceof Error?e.message:"No se pudo guardar");}finally{setBusy(false);}};
  const filtered=rows.filter(r=>(!onlyStock||r.available>0)&&`${r.name} ${label(r.kind)}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-3"><section className="seller-card space-y-3"><h2 className="font-bold">Productos y precios</h2><p className="text-sm text-muted-foreground">Edita las dos tarifas sin duplicar cuentas. Los precios existentes del catálogo se conservan; si el inventario tiene un nombre o duración diferente, configúralo por separado para no confundir planes. Las tarifas guardadas aquí tienen prioridad sobre los precios anteriores.</p><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={loading||busy} onClick={()=>void load()}>Actualizar</Button><Button size="sm" onClick={()=>setAdd(!add)}>{add?"Cancelar":"Agregar producto"}</Button></div>
  {add&&<form className="grid gap-2 rounded-xl border p-3" onSubmit={e=>{e.preventDefault();const m=Number(months),n=name.trim(),key=pricingKey(n,kind,m);if(rows.some(r=>r.key===key)){setQuery(n);toast.error("Este producto ya está en la lista");return;}if(!n||!Number.isInteger(m)||m<1||m>1200)return;setRows(prev=>[{key,name:n,kind,months:m,retailCents:null,resellerCents:null,available:0,source:"Sin guardar",version:null},...prev]);setQuery(n);setOnlyStock(false);setAdd(false);}}><Input required value={name} maxLength={160} placeholder="Nombre exacto de la plataforma y plan" onChange={e=>setName(e.target.value)}/><select className="buyer-select" value={kind} onChange={e=>setKind(e.target.value)}><option value="profile">Perfil</option><option value="complete">Cuenta completa</option></select><label className="seller-field"><span>Duración en meses</span><Input required type="number" min="1" max="1200" value={months} onChange={e=>setMonths(e.target.value)}/></label><Button type="submit" size="sm">Preparar tarifas</Button></form>}
  <Input value={query} placeholder="Buscar producto o plan…" onChange={e=>setQuery(e.target.value)}/><label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={onlyStock} onChange={e=>setOnlyStock(e.target.checked)}/> Solo con stock disponible</label></section>
  {error&&<p role="alert" className="text-destructive text-sm">{error}</p>}{loading?<p>Consultando precios…</p>:<div className="grid gap-3 lg:grid-cols-2">{filtered.map(row=><PriceCard key={`${row.key}:${row.version??row.retailCents+":"+row.resellerCents}`} row={row} busy={busy} onSave={(r,a,b)=>void save(r,a,b)}/>)}</div>}</div>;
}
