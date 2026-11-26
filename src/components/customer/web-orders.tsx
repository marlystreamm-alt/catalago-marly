import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { webOrderList, webPaidDelivery, webAcknowledgePaid, webPrepareCatalog } from "@/lib/customer/order-management.functions";
import { getSavedCode } from "@/lib/notify/client";
import { copyText } from "@/lib/browser/clipboard";
import { money, phoneNumber } from "@/lib/workspace/model";
import { isOnRequestMessage } from "@/lib/catalog/on-request";

const format = (date: string) => new Date(date).toLocaleString("es-MX");
const err = (e: unknown) => e instanceof Error ? e.message : "Ocurrió un error";

export function WebOrders({ onOpenOrder, onRequestOnly=false,stage="all" }: { onOpenOrder: (id: string, delivered?: boolean, processing?: boolean) => void; onRequestOnly?:boolean;stage?:"all"|"orders"|"deliveries" }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof webOrderList>> | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [tab, setTab] = useState<"paid" | "requests">(stage==="orders"||onRequestOnly?"requests":"paid");
  const [editing, setEditing] = useState(""), [name, setName] = useState(""), [phone, setPhone] = useState("");
  const code = getSavedCode();
  const requests=data?.requests.filter(r=>stage==="orders"?r.status==="nuevo"&&!r.linkedId:stage==="deliveries"?false:isOnRequestMessage(r.message)===onRequestOnly) || [];
  const refresh = useCallback(async () => {
    try { setData(await webOrderList({ data: { code } })); setError(""); }
    catch (e) { setError(err(e)); }
  }, [code]);
  useEffect(() => { void refresh(); }, [refresh]);
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError("");
    try { await fn(); await refresh(); }
    catch (e) { setError(err(e)); toast.error(err(e)); }
    finally { setBusy(false); }
  };
  if (stage === "orders" && data && !error && requests.length === 0) return null;
  return <section className="seller-card space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-bold">{stage==="deliveries"?"Página web · Entregas automáticas":stage==="orders"?"Página web · Solicitudes pendientes":onRequestOnly?"Solicitudes por encargo":"Pedidos de la página"}</h2><p className="text-xs text-muted-foreground">{onRequestOnly?"Servicios solicitados sin stock inmediato.":"Compras con saldo confirmado y solicitudes normales."}</p></div><Button variant="outline" size="sm" disabled={busy} onClick={() => void refresh()}>Actualizar</Button></div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {stage==="all"&&!onRequestOnly?<div className="flex flex-wrap gap-2"><Button size="sm" variant={tab === "paid" ? "default" : "outline"} onClick={() => setTab("paid")}>Pagados ({data?.paid.length || 0})</Button><Button size="sm" variant={tab === "requests" ? "default" : "outline"} onClick={() => setTab("requests")}>Por confirmar ({requests.filter(r => r.status === "nuevo" && !r.linkedId).length})</Button></div>:null}
    {!data ? <p className="text-sm text-muted-foreground">Cargando pedidos…</p> : null}
    {tab === "paid" ? <>
      <p className="text-xs text-muted-foreground">La tienda reserva la cuenta al descontar el saldo. El cliente conserva el acceso en Mis compras; tú puedes copiar o compartir la entrega por separado.</p>
      {data?.paid.map(o => <article key={o.id} className="rounded-xl border p-3 space-y-2">
        <div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-bold">{o.title}</h3><p className="text-xs text-muted-foreground">Página web · {o.client} · {format(o.createdAt)}</p></div><Badge variant="secondary">Pagado · {money(o.total)}</Badge></div>
        <p className="text-sm">WhatsApp: {o.whatsapp || "Sin dato"} · Vence: {o.expiresOn || "Sin fecha"}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => void run(async () => { const r = await webPaidDelivery({ data: { code, id: o.id, protected: false } }); await copyText(r.text); toast.success("Credenciales copiadas"); })}>Copiar credenciales</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => { const r = await webPaidDelivery({ data: { code, id: o.id, protected: true } }); await copyText(`Documento: ${location.origin}/e/${r.id}?t=${encodeURIComponent(r.token)}\nContraseña: ${r.password}`); toast.success("Enlace y contraseña copiados"); })}>Documento protegido</Button>
          {o.whatsapp && o.expiresOn ? <Button size="sm" variant="outline" asChild><a href={`https://wa.me/${phoneNumber(o.whatsapp)}?text=${encodeURIComponent(`Hola ${o.client} 😊 Tu suscripción ${o.title} vence el ${o.expiresOn}. ¿Deseas renovarla?`)}`} target="_blank" rel="noopener noreferrer">Recordar renovación</a></Button> : null}
          <Button size="sm" variant="ghost" disabled={busy || o.acknowledged} onClick={() => void run(async () => { await webAcknowledgePaid({ data: { code, id: o.id } }); toast.success("Aviso atendido"); })}>{o.acknowledged ? "Aviso atendido" : "Marcar aviso atendido"}</Button>
        </div>
      </article>)}
      {data && !data.paid.length ? <p className="text-sm text-muted-foreground">Sin compras con saldo.</p> : null}
    </> : <>
      <p className="text-xs text-muted-foreground">Las solicitudes de catálogo no prueban el pago. Confírmalo antes de asignar stock y guarda el teléfono del comprador.</p>
      {requests.map(o => <article key={o.id} className="rounded-xl border p-3 space-y-2">
        <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{o.serviceName}</h3><Badge variant="secondary">{o.linkedStatus === "completed" ? "Entregado" : o.linkedId ? "En proceso" : o.status === "atendido" ? "Atendido" : "Pendiente de pago"}</Badge></div>
        <p className="text-xs text-muted-foreground">{o.catalogName} · {format(o.createdAt)} · {money(o.total)}</p><p className="text-xs whitespace-pre-wrap break-words">{o.message}</p>
        {o.linkedId ? <Button size="sm" onClick={() => onOpenOrder(o.linkedId!)}>Abrir entrega</Button> : o.status === "nuevo" ? <>
          {editing === o.id ? <div className="space-y-2"><label className="text-xs font-semibold">Comprador</label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del comprador"/><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="WhatsApp del comprador" inputMode="tel"/><Button size="sm" disabled={busy || !name.trim() || !phone.trim()} onClick={() => { if (!confirm(`¿Confirmas que verificaste el pago de ${money(o.total)}? Se asignará una cuenta si hay una coincidencia segura.`)) return; void run(async () => { const r = await webPrepareCatalog({ data: { code, id: o.id, name, whatsapp: phone, confirmedPayment: true, protected: true } }); toast.success(r.delivered ? "Pedido entregado" : r.automatic ? "Entrega preparada" : "Pedido guardado; selecciona la cuenta adecuada"); onOpenOrder(r.id, r.delivered, r.automatic); }); }}>Confirmar pago y preparar entrega</Button><Button size="sm" variant="ghost" onClick={() => setEditing("")}>Cancelar</Button></div> : <Button size="sm" variant="outline" onClick={() => { setEditing(o.id); setName(/^Cliente:\s*(.+)$/im.exec(o.message)?.[1]?.trim() || ""); setPhone(/^WhatsApp del cliente:\s*(.+)$/im.exec(o.message)?.[1]?.trim() || ""); }}>Preparar entrega</Button>}
        </> : null}
      </article>)}
      {data && !requests.length ? <p className="text-sm text-muted-foreground">Sin solicitudes.</p> : null}
    </>}
  </section>;
}
