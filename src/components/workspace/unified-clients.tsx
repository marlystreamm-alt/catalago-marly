import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {getSavedCode} from "@/lib/notify/client";
import {copyText} from "@/lib/browser/clipboard";
import {mainClientHistory,customerManageActive,customerManageCredit,customerManageReset} from "@/lib/customer/manage.functions";
import {buildClientHistories,recentClientAssignment,type HistoryData} from "@/lib/customer/client-history";
import {money,STATUS,type OpsRecord} from "@/lib/workspace/model";
import {deliveryDateKey} from "@/lib/stock/delivery-sort";
import {businessToday} from "@/lib/stock/duration";
import {ResourcePanel,errorText,type Entry} from "./resource-panel";

const empty:HistoryData={accounts:[],purchases:[],stock:[],released:[],orders:[],replacements:[]};
export function UnifiedClients({records,entries,reload,onAssign,onWallet}:{records:OpsRecord[];entries:Entry[];reload:()=>Promise<void>;onAssign:(id:string)=>void;onWallet:(id:string)=>void}){
 const [data,setData]=useState<HistoryData|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[temporary,setTemporary]=useState<{id:string;password:string}|null>(null);
 const requests=useRef(new Map<string,string>());
 const refresh=useCallback(async()=>{try{setData(await mainClientHistory({data:{code:getSavedCode()}}));setError("");}catch(e){setError(errorText(e));}},[]);
 useEffect(()=>{void refresh();},[refresh]);
 const refreshAll=async()=>{await Promise.all([reload(),refresh()]);};
 const run=async(fn:()=>Promise<void>)=>{if(busy)return;setBusy(true);try{await fn();await refreshAll();}catch(e){toast.error(errorText(e));}finally{setBusy(false);}};
 const histories=useMemo(()=>buildClientHistories(records,data||empty),[records,data]);
 const unlinked=data?data.orders.length-[...histories.values()].reduce((count,h)=>count+h.rows.filter(r=>r.id.startsWith("order:")).length,0):0;
 return <div className="space-y-3">
 {error&&<p role="alert" className="text-sm text-destructive">{error} · <Button size="sm" variant="outline" onClick={()=>void refresh()}>Reintentar</Button></p>}
 {!data&&!error&&<p className="text-xs text-muted-foreground">Cargando historial y origen de clientes…</p>}
 {unlinked>0&&<p className="text-xs text-muted-foreground">{unlinked} pedidos sin cliente identificado. Se conservan en Pedidos; revisa su WhatsApp para vincularlos.</p>}
 <ResourcePanel module="clients" records={records} entries={entries} reload={refreshAll} onAssign={onAssign} onWallet={onWallet}
 clientOrigin={data?record=>[...(histories.get(record.id)?.origins||[])]:undefined}
 clientActivity={data?record=>recentClientAssignment(record.createdAt,histories.get(record.id)?.rows||[],businessToday()):undefined}
 clientMatch={(record,query)=>Boolean(histories.get(record.id)?.accounts.some(a=>String(a.email).toLowerCase().includes(query.toLowerCase())))}
 clientExtras={record=>{const h=histories.get(record.id);if(!h)return null;const wallet=entries.filter(e=>e.client_id===record.id&&(e.kind!=="purchase"||Boolean(e.note.startsWith("Pedido web por encargo · ")&&!data?.orders.some(o=>o.notification_order_id===e.request_id)&&!data?.purchases.some(p=>p.id===e.request_id)))).map(e=>({id:`wallet:${e.id}`,title:e.kind==="recharge"?"Recarga":e.kind==="refund"?"Reembolso":e.kind==="credit"?"Crédito":e.kind==="repayment"?"Abono de crédito":e.kind==="purchase"?"Compra web por encargo":"Movimiento de saldo",date:e.created_at,kind:"Saldo",detail:e.note,amount:Number(e.amount_cents)/100,expires:null}));const timeline=[...h.rows,...wallet].sort((a,b)=>deliveryDateKey(b.date).localeCompare(deliveryDateKey(a.date)));return <div className="mt-3 space-y-2">
 <details className="seller-disclosure"><summary><span className="flex-1 text-sm font-semibold">Historial de cliente</span><span className="seller-badge">{timeline.length}</span></summary><div className="seller-disclosure-body space-y-2">{!data?<p className="text-xs text-muted-foreground">Historial aún no disponible.</p>:!timeline.length?<p className="text-xs text-muted-foreground">Sin movimientos registrados.</p>:timeline.map(row=><article key={row.id} className="rounded-lg border p-2 text-sm"><div className="flex gap-2 justify-between"><strong className="min-w-0 break-words">{row.title}</strong>{typeof row.amount==="number"&&Number.isFinite(row.amount)&&<b className="shrink-0">{money(row.amount)}</b>}</div><p className="text-xs text-muted-foreground">{row.kind} · {row.date?deliveryDateKey(row.date).slice(0,10).split("-").reverse().join("/"):"Sin fecha"}{row.expires?` · Vence ${row.expires}`:""}</p><p className="text-xs break-words">{STATUS[row.detail]||row.detail}</p></article>)}</div></details>
 {h.accounts.map(a=><details key={a.id} className="seller-disclosure"><summary><span className="min-w-0 flex-1 text-sm font-semibold">🌎 Acceso web</span><span className="seller-badge">{a.active?"Activo":"Suspendido"}</span></summary><div className="seller-disclosure-body space-y-3"><p className="text-sm break-all">{a.email}</p>{a.must_change&&<p className="text-xs">Cambio de contraseña pendiente</p>}{temporary&&temporary.id===a.id&&<div className="rounded-lg border p-2"><p className="text-xs">Contraseña temporal · solo para el titular</p><code className="break-all">{temporary.password}</code><Button size="sm" variant="outline" onClick={()=>void copyText(temporary.password)}>Copiar</Button><Button size="sm" variant="ghost" onClick={()=>setTemporary(null)}>Ocultar</Button></div>}
 <form className="space-y-2" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget),amount=Number(f.get("amount")),note=String(f.get("note")||"");if(!confirm(`¿Confirmas que verificaste el pago de ${money(amount)}?`))return;void run(async()=>{const key=`${a.id}:${amount}:${note}`;const requestId=requests.current.get(key)||crypto.randomUUID();requests.current.set(key,requestId);await customerManageCredit({data:{code:getSavedCode(),accountId:a.id,amount,note,requestId}});toast.success("Saldo acreditado");});}}><Input name="amount" type="number" min="0.01" max="1000000" step="0.01" required placeholder="Abono verificado MXN"/><Input name="note" minLength={3} maxLength={400} required placeholder="Referencia de pago / motivo"/><Button size="sm" disabled={busy||!a.active}>Confirmar abono</Button></form>
 <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={()=>{if(confirm("¿Verificaste la identidad? Se cerrarán sus sesiones y se creará una contraseña temporal."))void run(async()=>{const r=await customerManageReset({data:{code:getSavedCode(),accountId:a.id}});setTemporary({id:a.id,password:r.password});});}}>Recuperar acceso</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>{if(confirm(a.active?"¿Suspender acceso?":"¿Reactivar acceso?"))void run(async()=>{await customerManageActive({data:{code:getSavedCode(),accountId:a.id,active:!a.active}});});}}>{a.active?"Suspender":"Reactivar"}</Button></div></div></details>)}
 </div>;}}/>
 </div>;
}
