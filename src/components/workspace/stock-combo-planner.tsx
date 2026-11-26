import {useEffect,useState} from "react";
import {pricingLoad} from "@/lib/customer/pricing.functions";
import {getSavedCode} from "@/lib/notify/client";
import {Button} from "@/components/ui/button";
import type {PriceRow} from "@/lib/customer/pricing";
export function StockComboPlanner(){
 const [rows,setRows]=useState<PriceRow[]>([]),[selection,setSelection]=useState<Record<string,number>>({}),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 const load=async()=>{setLoading(true);setError("");try{const r=await pricingLoad({data:{code:getSavedCode()}});setRows(r.filter(p=>p.available>0&&(p.kind==="profile"||p.kind==="complete")));}catch(e){setError(e instanceof Error?e.message:"No se pudo consultar el inventario");}finally{setLoading(false);}};
 useEffect(()=>{void load()},[]);
 const chosen=rows.filter(r=>selection[r.key]>0),max=chosen.length?Math.min(...chosen.map(r=>Math.floor(r.available/selection[r.key]))):0;
 return <section className="seller-card space-y-4"><h2 className="font-bold text-lg">Preparar combo con stock</h2><p className="text-sm text-muted-foreground">Selecciona variantes disponibles para comprobar cuántos paquetes puedes armar. Esta preparación no reserva ni descuenta cuentas.</p><Button variant="outline" onClick={()=>void load()} disabled={loading}>Actualizar stock</Button>{error&&<p role="alert">{error}</p>}{loading?<p>Consultando inventario…</p>:rows.map(r=><label key={r.key} className="flex items-center justify-between gap-3 rounded-xl border p-3"><span><strong>{r.name}</strong><small className="block text-muted-foreground">{r.kind==="profile"?"Perfil":"Completa"} · {r.months} mes(es) · {r.available} disponibles</small></span><input aria-label={`Cantidad de ${r.name}`} className="w-20 p-2 border" type="number" min={0} max={r.available} value={selection[r.key]||0} onChange={e=>setSelection(s=>({...s,[r.key]:Math.max(0,Math.min(r.available,Math.floor(Number(e.target.value)||0)))}))}/></label>)}<div className="rounded-xl bg-muted p-3"><strong>Combos posibles: {max}</strong><p className="text-sm">Precio por separado: {new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(chosen.reduce((n,r)=>n+(r.retailCents||0)*selection[r.key],0)/100)}</p></div><p className="text-xs text-muted-foreground">La publicación y cobro automático de combos aún no están habilitados.</p></section>;
}
