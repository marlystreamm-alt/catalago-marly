import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type Material = { id: string; name: string; quantity: number; unit: string; basePrice: number; baseQuantity: number; selected: boolean };
type Quote = { title: string; materials: Material[]; extra: number; sellingPrice: number; multiplier: number };
const STORAGE = "ma2-quote-calculator-v2";
const initial: Quote = { title: "Nuevo pedido", extra: 0, sellingPrice: 0, multiplier: 1.7, materials: [] };
const currency = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
const positive = (n: unknown) => { const v = Number(n); return Number.isFinite(v) ? Math.max(0, v) : 0; };
const id = () => globalThis.crypto?.randomUUID?.() ?? `material-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const normalize = (x: unknown): Quote => {
  if (!x || typeof x !== "object") return initial;
  const data = x as Partial<Quote>;
  return {
    title: typeof data.title === "string" ? data.title : initial.title,
    extra: positive(data.extra), sellingPrice: positive(data.sellingPrice),
    multiplier: positive(data.multiplier) || 1.7,
    materials: Array.isArray(data.materials) ? data.materials.filter(m => m && typeof m.name === "string").map(m => ({
      id: String(m.id || id()), name: m.name, quantity: positive(m.quantity),
      unit: typeof m.unit === "string" ? m.unit : "pieza", basePrice: positive(m.basePrice),
      baseQuantity: positive(m.baseQuantity) || 1, selected: m.selected !== false,
    })) : [],
  };
};

function EditableNumber({ value, onChange, min = 0, step = "any", className, label }: { value: number; onChange: (value: number) => void; min?: number; step?: string; className: string; label: string }) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setDraft(String(value)); }, [value, focused]);
  return <input aria-label={label} type="number" min={min} step={step} className={className}
    value={draft} onFocus={() => setFocused(true)}
    onChange={e => { const text = e.target.value; setDraft(text); if (text !== "" && Number.isFinite(Number(text))) onChange(positive(text)); }}
    onBlur={() => { setFocused(false); const finalValue = draft === "" ? 0 : positive(draft); onChange(finalValue); setDraft(String(finalValue)); }} />;
}

export function CostCalculator() {
  const [quote, setQuote] = useState<Quote>(initial);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [editingMaterials, setEditingMaterials] = useState(false);
  useEffect(() => {
    try { setQuote(normalize(JSON.parse(localStorage.getItem(STORAGE) || "null"))); }
    catch { setQuote(initial); }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) localStorage.setItem(STORAGE, JSON.stringify(quote)); }, [quote, loaded]);
  const patch = (changes: Partial<Quote>) => setQuote(prev => ({ ...prev, ...changes }));
  const update = (key: string, changes: Partial<Material>) => setQuote(prev => ({
    ...prev, materials: prev.materials.map(m => m.id === key ? { ...m, ...changes } : m),
  }));
  const add = () => setQuote(prev => ({ ...prev, materials: [...prev.materials, { id: id(), name: "", quantity: 1, unit: "pieza", basePrice: 0, baseQuantity: 1, selected: true }] }));
  const costOf = (m: Material) => m.selected ? m.quantity / (m.baseQuantity || 1) * m.basePrice : 0;
  const materialsCost = useMemo(() => quote.materials.reduce((s, m) => s + costOf(m), 0), [quote.materials]);
  const total = materialsCost + quote.extra;
  const suggested = Math.ceil(total * quote.multiplier / 10) * 10;
  const usedPrice = quote.sellingPrice > 0 ? quote.sellingPrice : suggested;
  const gain = usedPrice - total;
  const visible = quote.materials.filter(m => m.name.toLowerCase().includes(query.toLowerCase()));
  const exportBackup = () => {
    const blob = new Blob([JSON.stringify({ version: 2, quote }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ma2-cotizacion-respaldo.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      if (!raw?.quote || !Array.isArray(raw.quote.materials)) throw new Error("Archivo inválido");
      if (window.confirm("¿Reemplazar esta cotización con la del respaldo?")) setQuote(normalize(raw.quote));
    } catch { window.alert("El archivo no es un respaldo válido de la calculadora."); }
  };
  return <div className="space-y-4">
    <div className="rounded-2xl bg-[#0b1020] p-4 text-white sm:p-6">
      <h2 className="text-2xl font-bold">🧁 Cotización del pedido</h2>
      <input aria-label="Nombre del pedido" className="mt-3 w-full rounded-lg border border-slate-600 !bg-white px-3 py-2 text-lg !text-slate-950 placeholder:!text-slate-500" value={quote.title} onChange={e => patch({ title: e.target.value })} placeholder="Ej. Pastel y 50 quequitos" />
      <p className="mt-2 text-sm text-slate-400">Calculadora editable · MXN</p>
      <div className="mt-4 h-2 rounded-full bg-gradient-to-r from-violet-500 via-sky-400 to-green-500" />
      <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
        {[
          ["Materiales", materialsCost, false],
          ["Costo total", total, false],
          ["Precio sugerido", suggested, true],
          ["Ganancia estimada", gain, true],
        ].map(([label, value, green]) => <div key={String(label)} className="min-w-0 rounded-xl border border-slate-700 bg-[#121a2d] p-3">
          <p className="text-xs text-slate-300 sm:text-sm">{label}</p>
          <strong className={`block break-words text-xl sm:text-2xl ${green ? "text-emerald-200" : "text-blue-200"}`}>{currency(Number(value))}</strong>
        </div>)}
      </div>
      <p className="mt-3 text-xs text-slate-400">Precio usado para calcular la ganancia: {currency(usedPrice)}</p>
    </div>

    <section className="rounded-2xl border border-slate-700 bg-[#151d32] p-4 text-white">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold">▼ Materiales</h3>
        <button type="button" aria-label={editingMaterials ? "Cerrar edición de materiales" : "Editar materiales"} aria-expanded={editingMaterials} onClick={() => setEditingMaterials(v => !v)} className="rounded-lg border border-slate-600 bg-[#0b1020] px-3 py-2 text-xl text-white" title="Editar materiales">⚙️</button>
      </div>
      {editingMaterials ? <div className="mt-3 space-y-3">
        <p className="text-xs text-slate-300">Edita el nombre, cantidad, precio y contenido del envase. Los cambios se reflejan automáticamente en la tabla.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={add}>+ Agregar material</Button>
          <input aria-label="Buscar materiales" placeholder="Buscar material..." className="min-w-0 flex-1 rounded-lg border border-slate-600 !bg-white px-3 py-2 text-sm !text-slate-950 placeholder:!text-slate-500" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {visible.map(m => <div key={m.id} className="rounded-xl border border-slate-700 bg-[#0b1020] p-3">
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={m.selected} aria-label="Incluir material" onChange={e => update(m.id, { selected: e.target.checked })} />
            <input aria-label="Nombre del material" className="min-w-0 flex-1 rounded-md border border-slate-600 !bg-white p-2 !text-slate-950 placeholder:!text-slate-500" placeholder="Nombre del material" value={m.name} onChange={e => update(m.id, { name: e.target.value })} />
            <button className="text-xs text-rose-300 underline" onClick={() => { if (window.confirm("¿Eliminar este material?")) patch({ materials: quote.materials.filter(x => x.id !== m.id) }); }}>Eliminar</button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="text-xs text-slate-300">Cantidad usada<EditableNumber label="Cantidad usada" min={0} step="any" className="mt-1 w-full rounded-md border border-slate-600 !bg-white p-2 !text-slate-950" value={m.quantity} onChange={value => update(m.id, { quantity: positive(value) })} /></label>
            <label className="text-xs text-slate-300">Unidad<input aria-label="Unidad" placeholder="ml, g, piezas..." className="mt-1 w-full rounded-md border border-slate-600 !bg-white p-2 !text-slate-950" value={m.unit} onChange={e => update(m.id, { unit: e.target.value })} /></label>
            <label className="text-xs text-slate-300">Precio base ($)<EditableNumber label="Precio base" min={0} step="any" className="mt-1 w-full rounded-md border border-slate-600 !bg-white p-2 !text-slate-950" value={m.basePrice} onChange={value => update(m.id, { basePrice: positive(value) })} /></label>
            <label className="text-xs text-slate-300">Contenido base<EditableNumber label="Contenido base" min={0.000001} step="any" className="mt-1 w-full rounded-md border border-slate-600 !bg-white p-2 !text-slate-950" value={m.baseQuantity} onChange={value => update(m.id, { baseQuantity: positive(value) })} /></label>
          </div>
          <div className="mt-2 text-right text-sm text-blue-200">Importe: {currency(costOf(m))}</div>
        </div>)}
        {!visible.length && <p className="text-sm text-slate-300">No hay materiales. Pulsa «Agregar material».</p>}
        <Button onClick={() => setEditingMaterials(false)}>Listo ✓</Button>
      </div> : <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[440px] text-left text-sm">
          <thead><tr className="border-b border-slate-700 text-slate-200"><th className="py-2">Material</th><th className="py-2">Cantidad</th><th className="py-2">Precio base</th><th className="py-2 text-right">Importe</th></tr></thead>
          <tbody>{quote.materials.map(m => <tr key={m.id} className="border-b border-slate-700/70">
            <td className="py-3 pr-2"><div className="font-medium">{m.name || "Sin nombre"}</div><div className="text-xs text-slate-400">{m.unit} · precio por {m.baseQuantity} {m.unit}</div></td>
            <td className="py-3 pr-2 text-slate-100">{m.quantity} {m.unit}</td>
            <td className="py-3 pr-2 text-slate-100">{currency(m.basePrice)}</td>
            <td className="py-3 text-right font-semibold text-blue-200">{m.selected ? currency(costOf(m)) : "Excluido"}</td>
          </tr>)}</tbody>
        </table>
        {!quote.materials.length && <p className="py-4 text-sm text-slate-300">Todavía no hay materiales. Pulsa ⚙️ para agregarlos.</p>}
        <p className="mt-3 text-right font-bold">Total materiales: {currency(materialsCost)}</p>
      </div>}
    </section>

    <details className="rounded-2xl border border-slate-700 bg-[#151d32] p-4 text-white" open>
      <summary className="cursor-pointer text-lg font-bold">Costos y precio de venta</summary>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm">Gastos adicionales ($)<EditableNumber label="Gastos adicionales" min={0} step="any" className="mt-1 w-full rounded-lg border border-slate-600 !bg-white p-2 !text-slate-950" value={quote.extra} onChange={value => patch({ extra: positive(value) })} /><span className="text-xs text-slate-400">Luz, gas, mano de obra, transporte, etc.</span></label>
        <label className="text-sm">Multiplicador sugerido<EditableNumber label="Multiplicador sugerido" min={0.01} step="0.1" className="mt-1 w-full rounded-lg border border-slate-600 !bg-white p-2 !text-slate-950" value={quote.multiplier} onChange={value => patch({ multiplier: positive(value) })} /><span className="text-xs text-slate-400">Ejemplo: 1.7 equivale al 70% sobre costo.</span></label>
        <label className="text-sm">Mi precio de venta ($)<EditableNumber label="Mi precio de venta" min={0} step="any" className="mt-1 w-full rounded-lg border border-slate-600 !bg-white p-2 !text-slate-950" value={quote.sellingPrice} onChange={value => patch({ sellingPrice: positive(value) })} /><span className="text-xs text-slate-400">En 0 se usa el precio sugerido.</span></label>
      </div>
      <p className="mt-4 text-sm">Costo total: <b>{currency(total)}</b> · Venta: <b>{currency(usedPrice)}</b> · Ganancia: <b className={gain >= 0 ? "text-emerald-200" : "text-rose-300"}>{currency(gain)}</b></p>
    </details>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={exportBackup}>Descargar respaldo</Button>
      <label className="cursor-pointer rounded-lg border px-3 py-2 text-sm">Importar respaldo<input type="file" accept=".json,application/json" className="sr-only" onChange={e => { void importBackup(e.target.files?.[0]); e.target.value = ""; }} /></label>
      <Button variant="outline" onClick={() => { if (window.confirm("¿Crear una cotización nueva? Se reemplazará la actual; descarga un respaldo si deseas conservarla.")) setQuote(initial); }}>Nueva cotización</Button>
    </div>
    <p className="text-xs text-muted-foreground">Los cambios se guardan en este navegador. Para conservarlos en otro dispositivo, descarga un respaldo.</p>
  </div>;
}
