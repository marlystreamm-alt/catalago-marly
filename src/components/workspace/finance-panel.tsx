import {useEffect,useRef,useState} from "react";
import {RefreshCw} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {getSavedCode} from "@/lib/notify/client";
import {cashBalance,cashTotals,financeToday,financeClock,canIncludePrevious,movesForCut} from "@/lib/workspace/finance";
import {financeLoad,financeAddAccount,financeAddMove,financeReconcile,financeVoid,financeAddDebt,financeCut,financeConfirmCut,financeDeleteCut,financeLinkManual,financeMoveToToday} from "@/lib/workspace/finance.functions";
import {RechargePanel} from "@/components/recharges/recharge-panel";
import {exportRows} from "./resource-panel";
import {toast} from "sonner";
const money=(c:number)=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(c/100);
const cent=(v:FormDataEntryValue|null)=>Math.round(Number(v)*100);
type Snapshot=Awaited<ReturnType<typeof financeLoad>>;
type CutSelection = { account: string; date: string; counted: number; excluded: string[]; reviewed: string[] };

function CutEditor({ accounts, moves, initialAccount, initialDay, fixed = false, busy, save }:{
  accounts: Snapshot["accounts"]; moves: Snapshot["moves"]; initialAccount: string; initialDay: string;
  fixed?: boolean; busy: boolean; save: (selection: CutSelection) => void;
}) {
  const [accountId, setAccount] = useState(initialAccount);
  const [day, setDay] = useState(initialDay);
  const [omitted, setOmitted] = useState<string[]>([]);
  const account = accounts.find(item=>item.id===accountId);
  const candidates = movesForCut(moves,accountId,day);
  const excluded = candidates.filter(move=>omitted.includes(move.id)).map(move=>move.id);
  const expected = account ? cashBalance(account,moves.filter(move=>!excluded.includes(move.id)),day) : null;
  return <form className="space-y-3" onSubmit={event=>{
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    save({account:accountId,date:day,counted:cent(values.get("counted")),excluded,reviewed:candidates.map(move=>move.id)});
  }}>
    {!fixed && <div className="grid gap-2 sm:grid-cols-2">
      <label className="seller-field"><span>Cuenta del corte</span><select required className="buyer-select" value={accountId} onChange={event=>{setAccount(event.target.value);setOmitted([]);}}>
        <option value="">Seleccionar cuenta</option>{accounts.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label className="seller-field"><span>Fecha del corte</span><Input required type="date" value={day} max={financeToday()} onChange={event=>{setDay(event.target.value);setOmitted([]);}} /></label>
    </div>}
    {account && day && <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">Movimientos que entran en el corte</legend>
      {candidates.length ? candidates.map(move=><label key={move.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
        <input type="checkbox" checked={!omitted.includes(move.id)} onChange={event=>{
          const include = event.currentTarget.checked;
          setOmitted(previous=>include ? previous.filter(id=>id!==move.id) : [...previous,move.id]);
        }} />
        <span className="min-w-0 flex-1 break-words">{move.category}{move.note ? ` · ${move.note}` : ""}</span>
        <b>{move.kind==="expense" || move.kind==="transfer" && move.account_id===accountId ? "−" : "+"}{money(Number(move.amount_cents))}</b>
      </label>) : <p className="text-sm text-muted-foreground">Sin movimientos para esta fecha.</p>}
      <p className="text-sm">Saldo esperado: <b>{money(expected ?? 0)}</b></p>
    </fieldset>}
    <label className="seller-field"><span>Saldo real contado</span><Input required name="counted" type="number" step="0.01" inputMode="decimal"/></label>
    <Button size="sm" disabled={busy || !account || !day}>{fixed ? "Confirmar corte" : "Guardar corte"}</Button>
  </form>;
}

export function FinancePanel({summaryContent}:{summaryContent?:React.ReactNode}={}){
 const [data,setData]=useState<Snapshot|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[tab,setTab]=useState("summary"),[kind,setKind]=useState<"income"|"expense"|"transfer">("income"),[from,setFrom]=useState(financeToday().slice(0,7)+"-01"),[to,setTo]=useState(financeToday()),[account,setAccount]=useState("");
 const pending=useRef(new Map<string,string>());
 const [clock,setClock]=useState(()=>financeClock());
 const lastDay=useRef(clock.day);
 useEffect(()=>{
   const previous=lastDay.current;
   if(previous===clock.day)return;
   lastDay.current=clock.day;
   setTo(value=>value===previous?clock.day:value);
   setFrom(value=>value===previous.slice(0,7)+"-01"?clock.day.slice(0,7)+"-01":value);
 },[clock.day]);
 useEffect(()=>{const timer=setInterval(()=>setClock(financeClock()),15000);return ()=>clearInterval(timer);},[]);
 const run=async(fn:()=>Promise<Snapshot>)=>{if(busy)return false;setBusy(true);setError("");try{const next=await fn();setData(next);if(!account&&next.accounts.length)setAccount(next.accounts[0].id);return true;}catch(e){const msg=e instanceof Error?e.message:"No se pudo completar";setError(msg);toast.error(msg);return false;}finally{setBusy(false);}};
 const code=()=>getSavedCode();useEffect(()=>{void run(()=>financeLoad({data:{code:code()}}));},[]);
 useEffect(()=>{if(busy || (tab !== 'pending' && !(tab === 'cuts' && clock.reconciling)))return;let active=true;const timer=setInterval(()=>{void financeLoad({data:{code:getSavedCode()}}).then(next=>{if(active)setData(next)}).catch(()=>{});},30000);return ()=>{active=false;clearInterval(timer)};},[clock.reconciling,busy,tab]);
 if(!data)return <section className="seller-card"><p>{error||"Cargando finanzas…"}</p><Button disabled={busy} onClick={()=>void run(()=>financeLoad({data:{code:code()}}))}>Actualizar</Button></section>;
 const totals=cashTotals(data.moves,from,to),period=(date:string)=>date>=from&&date<=to,orders=data.orders.filter(o=>period(o.date)),recargas=data.sources.filter(s=>(s.key.startsWith("recharge:")||s.legacyKeys?.length)&&period(s.date)).reduce((n,s)=>n+s.amount,0),pendingDebts=data.debts.filter(d=>!data.moves.some(m=>!m.voided_at&&m.source_key===`debt:${d.id}`));
 // The first confirmed cut is the fixed start of the reconciliation view.
 const reconciliationStart = "2026-11-25";
 const lastCut = data.cuts.filter(c => c.confirmed_at).map(c => c.cut_on).sort().at(-1);
 const reconciledDates = new Map(data.moves
   .filter(move => !move.voided_at && move.source_key)
   .map(move => [move.source_key, move.occurred_on]));
 const matchedDate = (source: Snapshot["sources"][number]) =>
   reconciledDates.get(source.key) ?? source.legacyKeys?.map(key=>reconciledDates.get(key)).find(Boolean);
 const pendingSources = data.sources.filter(source=>source.bankTransfer && !matchedDate(source));
 const historical = data.sources.filter(source=>source.date>=reconciliationStart && lastCut && source.date<=lastCut && !source.bankTransfer && !matchedDate(source));
 const reconciled = data.sources.flatMap(source => {
   const date = matchedDate(source);
   return date ? [{ ...source, date }] : [];
 });
 const fields=(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();return new FormData(e.currentTarget);};const chooseAccount=(name="account")=><select required name={name} className="buyer-select" defaultValue={account}>{data.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>;
 const reconcile=(key:string,date:string,includePrevious=false)=>{if(!account)return toast.error("Selecciona la cuenta en la que se movió el dinero");if(!confirm(includePrevious?"¿Autorizas incluir este pago en el corte del día anterior?":"¿Confirmas que este importe efectivamente entró o salió de la cuenta seleccionada y aún no lo registraste?"))return;void run(()=>financeReconcile({data:{code:code(),sourceKey:key,account,date,includePrevious}}));};
 return <div className="space-y-3">
  <div className="seller-tabs !my-0">
    {[["summary","Resumen"],["moves","Movimientos"],["accounts","Cuentas"],["pending","Conciliación"],["cuts","Cortes"]].map(([value,label]) =>
      <button type="button" key={value} aria-pressed={tab===value} className={tab===value?"active":""} onClick={()=>setTab(value)}>
        {label}{value==="pending"?` (${pendingSources.length})`:""}
      </button>
    )}
  </div>
  <div className="flex items-start gap-2">
    <details className="seller-disclosure min-w-0 flex-1">
      <summary className="text-sm font-medium">Período <span className="text-xs text-muted-foreground">{from} – {to}</span></summary>
      <div className="seller-disclosure-body grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="seller-field"><span>Desde</span><Input className="seller-date-field" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
        <label className="seller-field"><span>Hasta</span><Input className="seller-date-field" type="date" value={to} max={financeToday()} onChange={e=>setTo(e.target.value)}/></label>
      </div>
    </details>
    <Button size="icon" variant="ghost" disabled={busy} aria-label="Actualizar saldos" onClick={()=>void run(()=>financeLoad({data:{code:code()}}))}><RefreshCw /></Button>
  </div>
  {tab === "summary" && <Button type="button" size="sm" variant="outline" onClick={() => setTab("moves")}>Registrar movimiento manual</Button>}
  {["pending","reconciled","history"].includes(tab) && <div className="flex flex-wrap gap-2">
    {[["pending","Por conciliar"],["reconciled","Conciliados"],["history","Historial anterior"]].map(([id,label])=>
      <Button type="button" key={id} size="sm" variant={tab===id?"default":"outline"} onClick={()=>setTab(id)}>{label}</Button>)}
  </div>}
  {["cuts","cyberdoc"].includes(tab) && <div className="flex gap-2">
    <Button size="sm" variant={tab==="cuts"?"default":"outline"} onClick={()=>setTab("cuts")}>Cortes de caja</Button>
    <Button size="sm" variant={tab==="cyberdoc"?"default":"outline"} onClick={()=>setTab("cyberdoc")}>Cyberdoc</Button>
  </div>}
  {tab === "summary" && summaryContent}
  {error&&<p role="alert" className="text-destructive text-sm">{error}</p>}
 {tab==="summary"&&<><div className="grid grid-cols-2 gap-3"><article className="seller-card"><p>Entradas de dinero</p><strong className="text-xl text-emerald-700">{money(totals.income)}</strong></article><article className="seller-card"><p>Salidas de dinero</p><strong className="text-xl text-rose-600">{money(totals.expense)}</strong></article><article className="seller-card"><p>Flujo neto del período</p><strong className="text-xl">{money(totals.net)}</strong></article><article className="seller-card"><p>Saldo total de cuentas</p><strong className="text-xl">{money(data.accounts.reduce((n,a)=>n+cashBalance(a,data.moves,to),0))}</strong></article></div><details className="seller-disclosure"><summary className="text-sm font-semibold">Tienda web · Ventas y saldo de clientes</summary><div className="seller-disclosure-body space-y-2"><p>Compras con saldo · Entrega automática: <b>{money(orders.reduce((n,o)=>n+o.amount,0))}</b></p><p>Pedidos web con saldo · Entrega manual: <b>{money(data.webRequestPurchases.filter(order => period(order.date)).reduce((sum, order) => sum + order.amount, 0))}</b></p><p>Recargas registradas: <b>{money(recargas)}</b></p><p>Saldo aún disponible de clientes: <b>{money(data.walletBalance)}</b></p><p className="text-xs text-muted-foreground">Las compras con saldo no son una segunda entrada de efectivo. El saldo de clientes no es utilidad; el flujo de caja tampoco equivale a ganancia.</p><Button variant="outline" onClick={()=>exportRows(data.moves.filter(m=>period(m.occurred_on)).map(m=>({Fecha:m.occurred_on,Tipo:m.kind,Categoría:m.category,Importe:Number(m.amount_cents)/100,Cuenta:data.accounts.find(a=>a.id===m.account_id)?.name,Destino:data.accounts.find(a=>a.id===m.to_account_id)?.name,Nota:m.note,Referencia:m.reference,Anulado:m.voided_at?"Sí":"No"})),"finanzas-ma2")}>Exportar a CSV / Excel</Button></div></details><details className="seller-disclosure"><summary className="text-sm font-semibold">Margen estimado de compras con saldo</summary><div className="seller-disclosure-body space-y-2"><p>{money(orders.filter(o=>o.cost!=null).reduce((n,o)=>n+o.amount-Number(o.cost),0))}</p><p className="text-xs text-muted-foreground">{orders.filter(o=>o.cost==null).length} compras sin costo individual fiable no se incluyen. No es utilidad neta.</p>{orders.map(o=><div key={o.id} className="flex justify-between gap-2 border-b py-2 text-sm"><span>{o.title}</span><span>{money(o.amount)}{o.cost!=null?` · margen ${money(o.amount-o.cost)}`:""}</span></div>)}</div></details></>}
 {tab==="accounts"&&<><form className="seller-card space-y-3" onSubmit={e=>{const f=fields(e);void run(()=>financeAddAccount({data:{code:code(),name:String(f.get("name")),opening:cent(f.get("opening"))}}));}}><h3 className="font-bold">Agregar cuenta de efectivo o banco</h3><Input required name="name" placeholder="Efectivo, BBVA, Mercado Pago…" maxLength={80}/><label className="seller-field"><span>Saldo inicial antes de tus movimientos registrados</span><Input required name="opening" type="number" step="0.01" defaultValue="0"/></label><Button disabled={busy}>Guardar cuenta</Button></form>{data.accounts.map(a=><article key={a.id} className="seller-card flex justify-between"><b>{a.name}</b><strong>{money(cashBalance(a,data.moves,to))}</strong></article>)}</>}
 {tab==="moves"&&<><form className="seller-card space-y-3" onSubmit={e=>{const form=e.currentTarget,f=fields(e),key=JSON.stringify([kind,...f.entries()]),requestId=pending.current.get(key)||crypto.randomUUID();pending.current.set(key,requestId);void run(()=>financeAddMove({data:{code:code(),requestId,kind,account:String(f.get("account")),toAccount:kind==="transfer"?String(f.get("toAccount")):null,amount:cent(f.get("amount")),date:String(f.get("date")||"")||undefined,category:String(f.get("category")),note:String(f.get("note")||""),reference:String(f.get("reference")||"")}})).then(ok=>{if(ok){pending.current.delete(key);form.reset();toast.success("Movimiento guardado");}});}}><h3 className="font-bold">Registrar movimiento</h3><select className="buyer-select" value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="income">Entrada</option><option value="expense">Salida</option><option value="transfer">Transferencia entre cuentas</option></select>{chooseAccount()}{kind==="transfer"&&chooseAccount("toAccount")}<Input required name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" aria-label="Importe en pesos" placeholder="Importe MXN"/><label className="seller-field"><span>Fecha del movimiento · hoy por defecto</span><Input name="date" type="date" max={financeToday()}/></label><Input required name="category" maxLength={100} placeholder="Categoría: proveedor, dominio, venta…"/><Input name="reference" placeholder="Folio o referencia de pago"/><Input name="note" placeholder="Notas"/><Button disabled={busy||!data.accounts.length}>Guardar movimiento</Button>{!data.accounts.length&&<p>Primero agrega una cuenta en Mis cuentas.</p>}</form>{data.moves.filter(m=>period(m.occurred_on)).sort((a,b)=>b.occurred_on.localeCompare(a.occurred_on)).map(m=><article key={m.id} className="seller-card flex justify-between gap-2"><div><b>{m.category}</b><p className="text-xs text-muted-foreground">{m.occurred_on} · {data.accounts.find(a=>a.id===m.account_id)?.name} · {m.note}</p>{m.voided_at?<span>Anulado</span>:<Button size="sm" variant="ghost" disabled={busy} onClick={()=>{if(confirm("¿Anular este movimiento? Se conservará en el historial."))void run(()=>financeVoid({data:{code:code(),moveId:m.id}}));}}>Anular</Button>}{!m.voided_at&&!m.source_key&&m.occurred_on!==clock.day&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>{
   if(confirm(`¿Cambiar este movimiento del ${m.occurred_on} al ${clock.day}?`))void run(()=>financeMoveToToday({data:{code:code(),moveId:m.id}}));
 }}>Mover a hoy</Button>}</div><b>{m.kind==="expense"?"−":m.kind==="income"?"+":"↔"}{money(Number(m.amount_cents))}</b></article>)}</>}
 {tab==="pending"&&<section className="seller-card space-y-3">
   <div className="flex flex-wrap items-center justify-between gap-2">
     <h3 className="font-bold">Entradas y salidas detectadas por correo</h3>
   </div>
   <details className="seller-disclosure">
     <summary>Conexión de correo</summary>
     <div className="seller-disclosure-body"><RechargePanel records={[]} settingsOnly onChanged={async()=>{await run(()=>financeLoad({data:{code:code()}}));}} /></div>
   </details>
   <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
     <span>Entradas por conciliar <b>{money(pendingSources.filter(source=>source.kind==="income").reduce((sum,source)=>sum+source.amount,0))}</b></span>
     <span>Salidas por conciliar <b>{money(pendingSources.filter(source=>source.kind==="expense").reduce((sum,source)=>sum+source.amount,0))}</b></span>
   </div>
   <Button size="sm" variant="ghost" onClick={()=>setTab("moves")}>Registrar movimiento manual</Button>
   {clock.reconciling && <p className="text-sm text-muted-foreground">Hasta las 12:30 a. m. puedes autorizar pagos de medianoche en el corte del {clock.previous}.</p>}
   <label className="seller-field"><span>Cuenta del movimiento</span><select className="buyer-select" value={account} onChange={e=>setAccount(e.target.value)}>
     <option value="">Seleccionar cuenta</option>{data.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
   </select></label>
   {pendingSources.sort((a,b)=>b.date.localeCompare(a.date)).map(source=>{
     const matching = data.moves.filter(move=>!move.voided_at && !move.source_key && move.kind===source.kind &&
       move.account_id===account && Number(move.amount_cents)===source.amount);
     return <article key={source.key} className="space-y-2 rounded-xl border p-3">
       <div className="flex flex-wrap justify-between gap-2">
         <div>
           <b>{source.title}</b>
           <p className="text-xs text-muted-foreground">{source.date}{source.reference ? ` · Referencia ${source.reference}` : ""}</p>
           <b>{source.kind==="expense"?"−":"+"}{money(source.amount)}</b>
         </div>
         <Button size="sm" disabled={busy||!account} onClick={()=>reconcile(source.key,source.date)}>Conciliar {source.kind==="expense"?"salida":"entrada"}</Button>
       </div>
       {source.kind==="income"&&canIncludePrevious(source.receivedAt)&&<Button size="sm" variant="outline" disabled={busy||!account} onClick={()=>reconcile(source.key,source.date,true)}>Autorizar para el corte anterior</Button>}
       <details className="seller-disclosure">
         <summary>Ya lo registré manualmente</summary>
         <form className="seller-disclosure-body flex flex-wrap gap-2" onSubmit={event=>{
           const values=fields(event);
           void run(()=>financeLinkManual({data:{code:code(),sourceKey:source.key,account,moveId:String(values.get("move"))}}));
         }}>
           {matching.length ? <><select required name="move" defaultValue="" className="buyer-select" aria-label="Movimiento manual a vincular">
             <option value="">Seleccionar movimiento</option>{matching.map(move=><option key={move.id} value={move.id}>{move.occurred_on} · {move.category}{move.reference?` · ${move.reference}`:""}</option>)}
           </select><Button size="sm" disabled={busy}>Vincular sin duplicar</Button></> :
             <p className="text-sm text-muted-foreground">{account?"No hay un movimiento manual del mismo tipo e importe en esta cuenta.":"Selecciona primero la cuenta del movimiento."}</p>}
         </form>
       </details>
     </article>;
   })}
   {!pendingSources.length && <p>No hay avisos bancarios pendientes.</p>}
   {data.incompleteBankNotices.map(notice=><p key={notice.key} className="rounded-xl border p-3 text-sm">
     {notice.kind==="expense"?"Salida":"Entrada"} · {notice.date} · {notice.issue}
   </p>)}
 </section>}
 {(tab==="history"||tab==="reconciled")&&<section className="seller-card space-y-3"><h3 className="font-bold">{tab==="history"?"Historial anterior al último corte":"Movimientos conciliados"}</h3>{tab==="history"&&<p className="text-sm">Desde el 25 de noviembre de 2026. Último corte confirmado: {lastCut||"Sin corte confirmado"}.</p>}{!(tab==="history"?historical:reconciled).length&&<p>No hay registros en este periodo.</p>}{(tab==="history"?historical:reconciled).slice().sort((a,b)=>b.date.localeCompare(a.date)).map(s=><article key={s.key} className="rounded-xl border p-3"><b>{s.category}</b><p>{s.title} · {s.date}</p><b>{money(s.amount)}</b></article>)}</section>}
 {tab==="debts"&&<><form className="seller-card space-y-3" onSubmit={e=>{const f=fields(e);void run(()=>financeAddDebt({data:{code:code(),kind:String(f.get("kind")) as "receivable"|"payable",name:String(f.get("name")),amount:cent(f.get("amount")),due:String(f.get("due")||"")||null,note:String(f.get("note")||"")}}));}}><h3 className="font-bold">Registrar deuda</h3><select className="buyer-select" name="kind"><option value="payable">Debo pagar</option><option value="receivable">Me deben</option></select><Input required name="name" placeholder="Cliente o proveedor"/><Input required name="amount" type="number" min="0.01" step="0.01" placeholder="Importe MXN"/><Input name="due" type="date"/><Input name="note" placeholder="Nota"/><Button disabled={busy}>Guardar deuda</Button></form><section className="seller-card space-y-3"><p>Por cobrar: <b>{money(pendingDebts.filter(d=>d.kind==="receivable").reduce((n,d)=>n+Number(d.amount_cents),0))}</b> · Por pagar: <b>{money(pendingDebts.filter(d=>d.kind==="payable").reduce((n,d)=>n+Number(d.amount_cents),0))}</b></p><select className="buyer-select" value={account} onChange={e=>setAccount(e.target.value)}><option value="">Cuenta para liquidar</option>{data.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>{data.debts.map(d=><article key={d.id} className="rounded-xl border p-3"><div className="flex justify-between"><b>{d.name}</b><b>{money(Number(d.amount_cents))}</b></div><p className="text-xs">{d.kind==="payable"?"Por pagar":"Por cobrar"} · {d.due_on||"Sin vencimiento"}</p>{pendingDebts.some(p=>p.id===d.id)?<Button size="sm" disabled={busy||!account} onClick={()=>reconcile(`debt:${d.id}`,financeToday())}>Liquidar</Button>:<span>Liquidada</span>}</article>)}</section></>}
 {tab === "cyberdoc" && <section className="seller-card space-y-3">
   <h3 className="font-bold">Cortes de Cyberdoc</h3>
   <p className="text-sm text-muted-foreground">Cierre a las 10:00 p. m. de Saltillo. Registra el depósito cuando aparezca en Klar.</p>
   {!data.cyberdocPayouts.length && <p>No hay entregas para los nuevos cortes.</p>}
   {data.cyberdocPayouts.map(cut => {
     const klar = data.accounts.find(a => a.name.trim().toLowerCase() === "klar");
     return <article key={cut.key} className="space-y-2 rounded-xl border p-3">
       <div className="flex flex-wrap justify-between gap-2"><b>{cut.date} · {cut.count} entregas</b><b>{money(cut.amount)}</b></div>
       <p className="text-sm">{cut.paidOn ? "Depositado en Klar · " + cut.paidOn : cut.closed ? "Por cobrar" : "Corte en curso"}</p>
       {!!cut.missing.length && <p className="text-sm text-amber-700">Falta tarifa para {cut.missing.length} entregas: {[...new Set(cut.missing)].join(", ")}</p>}
       {cut.closed && !cut.paidOn && !cut.missing.length && klar && <form className="flex flex-wrap items-end gap-2" onSubmit={e => {
         const values = fields(e);
         void run(() => financeReconcile({data:{code:code(),sourceKey:cut.key,account:klar.id,
           date:String(values.get("depositDate")),confirmedAmount:cent(values.get("depositAmount"))}}));
       }}>
         <label className="seller-field"><span>Fecha del depósito</span><Input name="depositDate" type="date" required defaultValue={financeToday()} max={financeToday()}/></label>
         <label className="seller-field"><span>Importe recibido en Klar</span><Input name="depositAmount" type="number" required min="0.01" step="0.01" inputMode="decimal"/></label>
         <Button size="sm" disabled={busy}>Registrar depósito</Button>
       </form>}
     </article>;
   })}
 </section>}
 {tab==="cuts"&&<>
   <section className="seller-card space-y-2">
     <h3 className="font-bold">Corte diario</h3>
     <p className="text-sm">El borrador se prepara a las 12:30 a. m. Elige qué movimientos entran antes de confirmarlo.</p>
     <Button variant="outline" size="sm" onClick={()=>setTab("pending")}>Ir a conciliación ({pendingSources.length})</Button>
   </section>
   <details className="seller-disclosure">
     <summary>Crear o rehacer corte manual</summary>
     <div className="seller-disclosure-body"><CutEditor accounts={data.accounts} moves={data.moves} initialAccount={account} initialDay={clock.previous} busy={busy}
       save={selection=>void run(()=>financeCut({data:{code:code(),...selection}}))}/></div>
   </details>
   {[...data.cuts].sort((a,b)=>b.cut_on.localeCompare(a.cut_on)).map(cut=><article key={cut.id} className="seller-card space-y-2">
     <div className="flex flex-wrap justify-between gap-2">
       <b>{data.accounts.find(a=>a.id===cut.account_id)?.name} · {cut.cut_on}</b>
       <span className="seller-badge">{cut.automatic?"Automático":"Manual"} · {cut.confirmed_at?"Confirmado":"Pendiente"}</span>
     </div>
     {cut.counted_cents===null ? <CutEditor accounts={data.accounts} moves={data.moves} initialAccount={cut.account_id} initialDay={cut.cut_on} fixed busy={busy}
       save={({counted,excluded,reviewed})=>void run(()=>financeConfirmCut({data:{code:code(),cutId:cut.id,counted,excluded,reviewed}}))}/> : <>
       {cut.income_cents!==null&&<div className="grid grid-cols-2 gap-2 text-sm">
         <p>Entradas: <b>{money(Number(cut.income_cents))}</b></p><p>Salidas: <b>{money(Number(cut.expense_cents))}</b></p>
         <p>Flujo neto: <b>{money(Number(cut.income_cents)-Number(cut.expense_cents))}</b></p>
         <p>Transferencias: {money(Number(cut.transfer_in_cents)-Number(cut.transfer_out_cents))}</p>
       </div>}
       <p>Esperado: {money(Number(cut.expected_cents))} · Contado: {money(Number(cut.counted_cents))}</p>
       <p>Diferencia: {money(Number(cut.counted_cents)-Number(cut.expected_cents))}</p>
       {!!cut.excluded_move_ids?.length && <p className="text-sm text-muted-foreground">Movimientos excluidos: {cut.excluded_move_ids.length}</p>}
     </>}
     <Button size="sm" variant="outline" disabled={busy} onClick={()=>{
       if(confirm("¿Eliminar este corte? Los movimientos y los pagos quedarán registrados."))void run(()=>financeDeleteCut({data:{code:code(),cutId:cut.id}}));
     }}>Eliminar corte</Button>
   </article>)}
 </>}
 <details className="seller-disclosure">
   <summary>Deudas</summary>
   <div className="seller-disclosure-body"><Button size="sm" variant="outline" onClick={()=>setTab("debts")}>Ver deudas</Button></div>
 </details>
 </div>;
}
