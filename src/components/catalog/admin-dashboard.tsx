import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Banknote, CalendarClock, CircleDollarSign, Clock3, Loader2, Package, PackageCheck, RefreshCw, Wrench } from 'lucide-react';
import { adminDashboard } from '@/lib/stock/dashboard.functions';
import { getSavedCode } from '@/lib/notify/client';
import { Button } from '@/components/ui/button';

type Summary = Awaited<ReturnType<typeof adminDashboard>>;
const money = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);
export function AdminDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { setData(await adminDashboard({ data: { code: getSavedCode() } })); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el resumen'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const cards = data ? [
    { label: 'Stock disponible', value: data.available, detail: 'Listo para entregar', icon: Package, tone: 'green' },
    { label: 'Vendidas activas', value: data.sold, detail: 'Asignadas y aún vigentes', icon: PackageCheck, tone: 'blue' },
    { label: 'Por vencer', value: data.expiring, detail: 'De hoy a los próximos 7 días', icon: CalendarClock, tone: 'amber' },
    { label: 'Vencidas / bajas', value: data.expired, detail: 'Fecha vencida o dadas de baja', icon: AlertTriangle, tone: 'red' },
    { label: 'Pedidos pendientes', value: data.pending, detail: 'Cyberdoc nuevos o en proceso', icon: Clock3, tone: 'purple' },
    { label: 'Reposiciones', value: data.replacements, detail: 'Cliente o proveedor', icon: Wrench, tone: 'pink' },
    { label: 'Ventas registradas', value: money(data.revenue), detail: `${data.sales} entregas este mes`, icon: Banknote, tone: 'teal' },
    { label: 'Ganancia estimada', value: data.marginSales ? money(data.margin) : 'Sin datos', detail: `${data.marginSales} ventas con precio y costo válidos`, icon: CircleDollarSign, tone: 'green' },
  ] : [];
  return (
    <section className="ma2-home mt-4" aria-labelledby="ma2-home-title">
      <header className="ma2-home-heading">
        <div><p className="ma2-panel-eyebrow">VISTA GENERAL</p><h2 id="ma2-home-title">Inicio de tu negocio</h2><p>Tu stock, vencimientos y resultados en un solo lugar.</p></div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy} aria-label="Actualizar resumen"><RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} /> Actualizar</Button>
      </header>
      {error ? <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><p>{error}</p><Button variant="outline" className="mt-2" disabled={busy} onClick={() => void load()}>Reintentar</Button>{data ? <p className="mt-2 text-muted-foreground">Las cifras conservan la última actualización.</p> : null}</div> : null}
      {busy && !data ? <p role="status" className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando tu resumen…</p> : null}
      {data ? <>
        <div className="ma2-home-grid">{cards.map(({label,value,detail,icon:Icon,tone}) => <article key={label} className={`ma2-metric ma2-tone-${tone}`}><div className="ma2-metric-top"><span>{label}</span><Icon className="size-5 shrink-0" aria-hidden="true" /></div><strong>{value}</strong><p>{detail}</p></article>)}</div>
        <div className="ma2-home-details">
          <div className="ma2-home-platforms"><h3>Inventario por plataforma</h3>{data.platforms.length ? <div className="max-h-64 overflow-auto"><table><thead><tr><th>Plataforma</th><th>Disponible</th><th>Vendida activa</th></tr></thead><tbody>{data.platforms.map(p => <tr key={p.platform}><td>{p.platform}</td><td>{p.available}</td><td>{p.sold}</td></tr>)}</tbody></table></div> : <p>Aún no hay stock registrado.</p>}</div>
          <div className="ma2-home-notes"><h3>Resultados del mes</h3><p>Periodo: {data.month}. Importes en MXN.</p><p>Ventas = precios de las entregas registradas. Ganancia estimada = precio menos costo; no incluye gastos operativos.</p><p>{data.salesWithoutPrice} entregas sin precio. {data.salesWithoutMargin} entregas fuera del cálculo de ganancia por costo/precio incompletos o perfiles derivados sin costo individual.</p><p>Las renovaciones y ventas eliminadas del stock no forman parte de este resumen.</p><p>Actualizado: {new Date(data.updatedAt).toLocaleString('es-MX', { timeZone: 'America/Monterrey', dateStyle: 'short', timeStyle: 'short' })}.</p></div>
        </div>
      </> : null}
    </section>
  );
}
