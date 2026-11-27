import {useEffect,useRef,useState} from "react";
import {comboAssign,comboStockLoad} from "@/lib/stock/combo.functions";
import {getSavedCode} from "@/lib/notify/client";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {copyText} from "@/lib/browser/clipboard";
import {money,type OpsRecord} from "@/lib/workspace/model";
import {toast} from "sonner";
type Row=Awaited<ReturnType<typeof comboStockLoad>>[number];
export function StockComboPlanner({initialKind="profile",records=[],onDelivered}:{initialKind?:"profile"|"complete";records?:OpsRecord[];onDelivered?:()=>void}={}){
 const [kind,setKind]=useState(initialKind),[rows,setRows]=useState<Row[]>([]),[selection,setSelection]=useState<Record<string,number>>({}),[error,setError]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[client,setClient]=useState(""),[title,setTitle]=useState(""),[protect,setProtect]=useState(true),[result,setResult]=useState<{text:string;url:string}|null>(null);
 const request=useRef("");
 const load=async()=>{setLoading(true);setError("");try{setRows(await comboStockLoad({data:{code:getSavedCode(),kind}}));}catch(e){setError(e instanceof Error?e.message:"No se pudo consultar el inventario");}finally{setLoading(false);}};
 useEffect(()=>{setSelection({});void load()},[kind]);
 const chosen=rows.filter(r=>Object.hasOwn(selection,r.id)),total=chosen.reduce((n,r)=>n+Math.round(selection[r.id]*100),0)/100;
 const clients=records.filter(r=>r.module==="clients"&&r.status==="active"&&(!r.data.shopId||r.data.shopId==="main"));
 return <section className="seller-card space-y-4"><h2 className="font-bold text-lg">Armar y entregar combo</h2><p className="text-sm text-muted-foreground">Selecciona cuentas reales del inventario, el cliente y el precio de cada unidad. Se asignarán juntas y quedarán registradas en Entregas.</p>
 <div className="seller-tabs"><button disabled={busy} className={kind==="profile"?"active":""} onClick={()=>setKind("profile")}>Combos perfiles</button><button disabled={busy} className={kind==="complete"?"active":""} onClick={()=>setKind("complete")}>Combos completas</button></div>
 <Button variant="outline" onClick={()=>void load()} disabled={loading||busy}>Actualizar stock</Button>
 {error&&<p role="alert" className="text-destructive">{error}</p>}
 {loading?<p>Consultando inventario…</p>:rows.length?rows.map(r=><div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><label className="flex flex-1 items-center gap-2"><input type="checkbox" disabled={busy} checked={Object.hasOwn(selection,r.id)} onChange={e=>setSelection(s=>{const n={...s};if(e.target.checked)n[r.id]=r.price;else delete n[r.id];return n;})}/><span><strong>{r.platform}</strong><small className="block text-muted-foreground">{r.type} · {r.months} mes(es) · #{r.id.slice(-6)}</small></span></label>{Object.hasOwn(selection,r.id)&&<label className="seller-field w-28"><span>Precio MXN</span><Input type="number" min={0} max={1000000} step=".01" disabled={busy} value={selection[r.id]} onChange={e=>setSelection(s=>({...s,[r.id]:Number(e.target.value)}))}/></label>}</div>):<p>No hay cuentas disponibles de esta modalidad.</p>}
 <form className="space-y-3" onSubmit={async e=>{e.preventDefault();if(busy||chosen.length<2||chosen.length>20)return;if(!confirm("¿Asignar "+chosen.length+" cuentas al cliente por "+money(total)+"? El saldo de la tienda no se modificará."))return;if(!request.current)request.current=crypto.randomUUID();setBusy(true);setError("");try{const r=await comboAssign({data:{code:getSavedCode(),requestId:request.current,clientId:client,title,kind,protected:protect,items:chosen.map(r=>({id:r.id,version:r.version,price:selection[r.id]}))}});setResult(r);request.current="";setSelection({});await load();toast.success("Combo entregado");}catch(e){setError(e instanceof Error?e.message:"No se pudo asignar");}finally{setBusy(false);}}}>
 <div className="rounded-xl bg-muted p-3"><strong>{chosen.length} cuentas · {money(total)}</strong><p className="text-xs">El precio es el total de las unidades seleccionadas.</p></div>
 <label className="seller-field"><span>Nombre del combo</span><Input value={title} onChange={e=>setTitle(e.target.value)} minLength={2} maxLength={140} required disabled={busy} placeholder="Combo Disney + Prime"/></label>
 <label className="seller-field"><span>Cliente</span><select value={client} onChange={e=>setClient(e.target.value)} required disabled={busy}><option value="">Seleccionar cliente</option>{clients.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
 <label className="flex items-center gap-2"><input type="checkbox" checked={protect} disabled={busy} onChange={e=>setProtect(e.target.checked)}/> Entrega con documento protegido</label>
 <Button type="submit" disabled={busy||loading||chosen.length<2||chosen.length>20||!client||title.trim().length<2}>{busy?"Asignando…":"Asignar combo al cliente"}</Button>
 </form>
 {result&&<div className="rounded-xl border p-3 space-y-2"><strong>Entrega registrada</strong><p>El cliente podrá consultar el combo en sus compras.</p><Button onClick={()=>void copyText(result.text)}>Copiar entrega</Button>{onDelivered&&<Button variant="outline" onClick={onDelivered}>Ir a Entregas</Button>}</div>}
 </section>;
}
