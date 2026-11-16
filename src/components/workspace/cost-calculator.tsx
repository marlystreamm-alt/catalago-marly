import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type Item = { id: string; name: string; cost: number; price: number; quantity: number; checked: boolean };
const KEY = "ma2-cost-calculator-v1";
const starter: Item[] = [{ id: "1", name: "Producto o servicio", cost: 0, price: 0, quantity: 1, checked: true }];
const money = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
const safe = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;

export function CostCalculator() {
  const [items, setItems] = useState<Item[]>(starter);
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (Array.isArray(saved)) setItems(saved.filter((x): x is Item => x && typeof x.id === "string" && typeof x.name === "string").map(x => ({
        id: x.id, name: x.name, cost: safe(Number(x.cost)), price: safe(Number(x.price)), quantity: safe(Number(x.quantity)), checked: Boolean(x.checked)
      })));
    } catch { /* Conserva el formulario inicial si el respaldo es inválido. */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(items)); }, [items, ready]);
  const update = (id: string, patch: Partial<Item>) => setItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  const totals = useMemo(() => items.filter(x => x.checked).reduce((sum, x) => ({
    cost: sum.cost + x.cost * x.quantity, sale: sum.sale + x.price * x.quantity, count: sum.count + x.quantity
  }), { cost: 0, sale: 0, count: 0 }), [items]);
  const profit = totals.sale - totals.cost;
  const shown = items.filter(x => x.name.toLowerCase().includes(search.toLowerCase()));
  const add = () => setItems(prev => [...prev, { id: crypto.randomUUID(), name: "", cost: 0, price: 0, quantity: 1, checked: true }]);
  const download = () => {
    const data = new Blob([JSON.stringify({ version: 1, items }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(data);
    const a = document.createElement("a"); a.href = url; a.download = "ma2-calculadora-respaldo.json"; a.click();
    URL.revokeObjectURL(url);
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.items)) throw new Error("Formato inválido");
      const valid = data.items.filter((x: Item) => x && typeof x.id === "string" && typeof x.name === "string")
        .map((x: Item) => ({ id: x.id, name: x.name, cost: safe(Number(x.cost)), price: safe(Number(x.price)), quantity: safe(Number(x.quantity)), checked: Boolean(x.checked) }));
      if (!window.confirm("¿Reemplazar los registros actuales por los del respaldo?")) return;
      setItems(valid);
    } catch { window.alert("No se pudo leer el respaldo. Verifica el archivo."); }
  };
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        ["Costo total", money(totals.cost)],
        ["Venta total", money(totals.sale)],
        ["Ganancia", money(profit)],
        ["Margen", totals.sale ? (profit / totals.sale * 100).toFixed(1) + "%" : "0%"],
      ].map(([label, value]) => <div key={label} className="seller-card"><p className="text-xs text-muted-foreground">{label}</p><strong className="text-xl">{value}</strong></div>)}
    </div>
    <section className="seller-card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="font-bold">Calculadora de costos</h2><p className="text-xs text-muted-foreground">Marca los productos que deseas incluir. Los totales se actualizan automáticamente.</p></div>
        <Button onClick={add}>+ Agregar producto</Button>
      </div>
      <input aria-label="Buscar producto" placeholder="Buscar producto o servicio..." className="w-full rounded-md border bg-background p-2" value={search} onChange={e => setSearch(e.target.value)} />
      <div className="flex flex-wrap gap-2 text-xs">
        <span>{items.filter(x => x.checked).length} de {items.length} seleccionados · {totals.count} unidades</span>
        <button className="underline" onClick={() => setItems(prev => prev.map(x => ({ ...x, checked: true })))}>Marcar todos</button>
        <button className="underline" onClick={() => setItems(prev => prev.map(x => ({ ...x, checked: false })))}>Desmarcar todos</button>
      </div>
      <div className="space-y-3">
        {shown.map(item => <div key={item.id} className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center gap-2">
            <input type="checkbox" aria-label={`Incluir ${item.name || "producto"}`} checked={item.checked} onChange={e => update(item.id, { checked: e.target.checked })} />
            <input aria-label="Nombre del producto" className="min-w-0 flex-1 rounded border bg-background p-2" placeholder="Nombre del producto o servicio" value={item.name} onChange={e => update(item.id, { name: e.target.value })} />
            <button className="text-xs text-destructive underline" onClick={() => { if (window.confirm("¿Eliminar este producto?")) setItems(prev => prev.filter(x => x.id !== item.id)); }}>Eliminar</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([["Costo unitario", "cost"], ["Precio de venta", "price"], ["Cantidad", "quantity"]] as const).map(([label, key]) =>
              <label key={key} className="text-xs">{label}<input className="mt-1 w-full rounded border bg-background p-2" type="number" min="0" step={key === "quantity" ? "1" : "0.01"} value={item[key]} onChange={e => update(item.id, { [key]: key === "quantity" ? Math.floor(safe(Number(e.target.value))) : safe(Number(e.target.value)) })} /></label>
            )}
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <span>Costo: <b>{money(item.cost * item.quantity)}</b></span>
            <span>Venta: <b>{money(item.price * item.quantity)}</b></span>
            <span>Ganancia: <b>{money((item.price - item.cost) * item.quantity)}</b></span>
          </div>
        </div>)}
        {!shown.length && <p className="text-sm text-muted-foreground">No hay productos con ese nombre.</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={download}>Descargar respaldo</Button>
        <label className="cursor-pointer rounded-md border px-3 py-2 text-sm">Importar respaldo<input className="sr-only" type="file" accept=".json,application/json" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
      </div>
      <p className="text-xs text-muted-foreground">Los registros se guardan en este navegador. Descarga un respaldo para conservarlos al cambiar de dispositivo.</p>
    </section>
  </div>;
}
