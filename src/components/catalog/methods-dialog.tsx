import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpenCheck, FileImage, FileText, ImagePlus, Loader2, Pencil, Plus, Printer, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fileToCompressedDataUrl } from "@/lib/catalog/image";
import { getSavedCode } from "@/lib/notify/client";
import { friendlyServerError } from "@/lib/server-error";
import { methodsDelete, methodsList, methodsSave } from "@/lib/methods/methods.functions";
import type { InstructionMethod } from "@/lib/methods/types";

const blank = () => ({ name: "", instruction: "", notes: "", link: "", image: "", active: true, sortOrder: 0 });
const safe = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
const nl = (s: string) => safe(s).replace(/\n/g, "<br>");

function exportHtml(items: InstructionMethod[], printable: boolean) {
  const sections = items.map((m, i) => `
    <section class="method${i ? " page" : ""}">
      <h2>${i + 1}. ${safe(m.name)}</h2>
      ${m.image ? `<img src="${m.image}" alt="${safe(m.name)}">` : ""}
      ${m.instruction ? `<div class="instructions">${nl(m.instruction)}</div>` : ""}
      ${m.link ? `<p><strong>Enlace:</strong> <a href="${safe(m.link)}">${safe(m.link)}</a></p>` : ""}
      ${m.notes ? `<div class="notes"><strong>Notas:</strong><br>${nl(m.notes)}</div>` : ""}
    </section>`).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Métodos MA²</title><style>
    @page{size:A4;margin:15mm} body{font-family:Arial,sans-serif;color:#171717;margin:0} .head{border-bottom:2px solid #222;padding-bottom:10px;margin-bottom:18px} h1{margin:0;font-size:26px} .sub{color:#666;margin-top:5px} h2{font-size:20px;margin:0 0 12px} .method{padding:4px 0 20px} .page{${printable ? "break-before:page;" : "border-top:1px solid #ddd;padding-top:20px;"}} img{max-width:100%;max-height:360px;object-fit:contain;border-radius:10px;margin:8px 0 14px}.instructions{font-size:14px;line-height:1.55;white-space:normal}.notes{margin-top:12px;padding:10px;background:#f5f5f5;border-radius:8px;font-size:13px}a{color:#333;word-break:break-all}p{font-size:13px;line-height:1.45}
  </style></head><body><div class="head"><h1>Métodos</h1><div class="sub">MA² · ${items.length} método${items.length === 1 ? "" : "s"} seleccionado${items.length === 1 ? "" : "s"}</div></div>${sections}</body></html>`;
}

function downloadBlob(content: BlobPart, type: string, filename: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src;
  });
}

function wrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  let yy = y;
  for (const raw of text.split("\n")) {
    if (!raw) { yy += lineHeight; continue; }
    const words = raw.split(/\s+/); let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) { ctx.fillText(line, x, yy); yy += lineHeight; line = word; }
      else line = test;
    }
    if (line) { ctx.fillText(line, x, yy); yy += lineHeight; }
  }
  return yy;
}

async function exportPng(items: InstructionMethod[]) {
  const width = 1240, pad = 70, contentW = width - pad * 2;
  const images = await Promise.all(items.map(async (m) => m.image ? loadImage(m.image).catch(() => null) : null));
  const measure = document.createElement("canvas").getContext("2d")!;
  let height = 150;
  items.forEach((m, i) => {
    measure.font = "700 34px Arial"; const nameLines = Math.max(1, Math.ceil(measure.measureText(`${i + 1}. ${m.name}`).width / contentW));
    measure.font = "26px Arial"; const textLines = Math.max(1, Math.ceil((m.instruction.length + m.notes.length + m.link.length) / 65));
    const imgH = images[i] ? Math.min(430, Math.round(images[i]!.height * Math.min(contentW / images[i]!.width, 1))) : 0;
    height += nameLines * 46 + textLines * 38 + imgH + 120;
  });
  height = Math.min(Math.max(height, 800), 16000);
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height); ctx.fillStyle = "#111111";
  ctx.font = "700 46px Arial"; ctx.fillText("Métodos", pad, 80); ctx.font = "24px Arial"; ctx.fillStyle = "#666666"; ctx.fillText(`MA² · ${items.length} seleccionado${items.length === 1 ? "" : "s"}`, pad, 118);
  let y = 180;
  for (let i = 0; i < items.length; i++) {
    const m = items[i]; ctx.fillStyle = "#111111"; ctx.font = "700 34px Arial"; y = wrapped(ctx, `${i + 1}. ${m.name}`, pad, y, contentW, 44) + 16;
    const img = images[i]; if (img) { const ratio = Math.min(contentW / img.width, 430 / img.height, 1); const w = img.width * ratio, h = img.height * ratio; ctx.drawImage(img, pad, y, w, h); y += h + 22; }
    ctx.font = "26px Arial"; ctx.fillStyle = "#222222"; if (m.instruction) y = wrapped(ctx, m.instruction, pad, y, contentW, 38) + 12;
    if (m.link) { ctx.font = "22px Arial"; ctx.fillStyle = "#555555"; y = wrapped(ctx, `Enlace: ${m.link}`, pad, y, contentW, 32) + 8; }
    if (m.notes) { ctx.font = "22px Arial"; ctx.fillStyle = "#555555"; y = wrapped(ctx, `Notas: ${m.notes}`, pad, y, contentW, 32) + 10; }
    ctx.strokeStyle = "#dddddd"; ctx.beginPath(); ctx.moveTo(pad, y + 12); ctx.lineTo(width - pad, y + 12); ctx.stroke(); y += 56;
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
  if (!blob) throw new Error("No se pudo generar la imagen");
  downloadBlob(blob, "image/png", `metodos-ma2-${new Date().toISOString().slice(0,10)}.png`);
}

export function MethodsDialog() {
  const code = getSavedCode();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [items, setItems] = useState<InstructionMethod[]>([]);
  const [selected, setSelected] = useState<string[]>([]), [editingId, setEditingId] = useState<string | null>(null), [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank()); const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => { setBusy(true); try { setItems(await methodsList({ data: { code } })); } catch (e) { toast.error(friendlyServerError(e, "No se pudieron cargar los métodos")); } finally { setBusy(false); } }, [code]);
  useEffect(() => { if (open) void refresh(); }, [open, refresh]);
  const chosen = useMemo(() => items.filter((m) => selected.includes(m.id)), [items, selected]);
  const resetForm = () => { setForm(blank()); setEditingId(null); setShowForm(false); };
  const edit = (m: InstructionMethod) => { setEditingId(m.id); setForm({ name:m.name, instruction:m.instruction, notes:m.notes, link:m.link, image:m.image, active:m.active, sortOrder:m.sortOrder }); setShowForm(true); };
  const save = async () => { if (!form.name.trim()) return toast.error("Escribe el nombre del método"); setBusy(true); try { await methodsSave({ data: { code, id: editingId || undefined, method: { ...form, name: form.name.trim(), sortOrder: Number(form.sortOrder) || 0 } } }); toast.success(editingId ? "Método actualizado" : "Método agregado"); resetForm(); await refresh(); } catch(e) { toast.error(friendlyServerError(e, "No se pudo guardar")); } finally { setBusy(false); } };
  const remove = async (m: InstructionMethod) => { if (!confirm(`¿Eliminar el método “${m.name}”?`)) return; try { await methodsDelete({ data: { code, id:m.id } }); setSelected((s)=>s.filter((id)=>id!==m.id)); await refresh(); toast.success("Método eliminado"); } catch(e){ toast.error(friendlyServerError(e,"No se pudo eliminar")); } };
  const requireChosen = () => { if (!chosen.length) { toast.error("Selecciona por lo menos un método"); return false; } return true; };
  const exportDoc = () => { if (!requireChosen()) return; downloadBlob(exportHtml(chosen, false), "application/msword;charset=utf-8", `metodos-ma2-${new Date().toISOString().slice(0,10)}.doc`); toast.success("Documento generado"); };
  const exportPdf = () => { if (!requireChosen()) return; const win = window.open("", "_blank"); if (!win) return toast.error("Permite ventanas emergentes para exportar PDF"); win.document.write(exportHtml(chosen, true)); win.document.close(); setTimeout(()=>{ win.focus(); win.print(); }, 450); };

  return <Dialog open={open} onOpenChange={(v)=>{setOpen(v); if(!v) resetForm();}}>
    <DialogTrigger asChild><Button variant="outline"><BookOpenCheck className="size-4"/>Métodos</Button></DialogTrigger>
    <DialogContent className="max-h-[94vh] w-[calc(100vw-1rem)] max-w-5xl overflow-y-auto rounded-3xl">
      <DialogHeader><DialogTitle>Métodos · checklist maestro</DialogTitle><DialogDescription>Agrega y edita instrucciones. Marca uno o varios métodos y expórtalos juntos en un mismo documento, PDF o imagen.</DialogDescription></DialogHeader>
      <div className="flex flex-wrap gap-2">
        <Button onClick={()=>{setEditingId(null);setForm({...blank(),sortOrder:items.length});setShowForm(true)}}><Plus className="size-4"/>Agregar método</Button>
        <Button variant="outline" onClick={()=>setSelected(items.map(x=>x.id))} disabled={!items.length}>Seleccionar todos</Button>
        <Button variant="ghost" onClick={()=>setSelected([])} disabled={!selected.length}><X className="size-4"/>Limpiar</Button>
        <span className="ml-auto self-center text-sm font-semibold text-muted-foreground">{selected.length} seleccionado{selected.length===1?"":"s"}</span>
      </div>

      {showForm ? <section className="grid gap-3 rounded-2xl border bg-muted/20 p-4">
        <div className="flex items-center justify-between"><h3 className="font-semibold">{editingId?"Editar método":"Nuevo método"}</h3><Button size="sm" variant="ghost" onClick={resetForm}>Cerrar</Button></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><Label>Nombre del método</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ej. Netflix con código"/></div>
        <div className="sm:col-span-2"><Label>Instrucciones</Label><Textarea className="min-h-40" value={form.instruction} onChange={e=>setForm({...form,instruction:e.target.value})} placeholder="Escribe los pasos completos…"/></div>
        <div><Label>Link opcional</Label><Input value={form.link} onChange={e=>setForm({...form,link:e.target.value})} placeholder="https://…"/></div><div><Label>Orden</Label><Input type="number" min="0" value={form.sortOrder} onChange={e=>setForm({...form,sortOrder:Number(e.target.value)})}/></div>
        <div className="sm:col-span-2"><Label>Notas opcionales</Label><Textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
        <div className="sm:col-span-2 rounded-xl border border-dashed p-3"><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async e=>{const f=e.target.files?.[0];e.target.value="";if(!f)return;try{setForm({...form,image:await fileToCompressedDataUrl(f)});toast.success("Imagen agregada")}catch(err){toast.error(err instanceof Error?err.message:"No se pudo leer la imagen")}}}/><div className="flex flex-wrap items-center gap-2"><Button type="button" size="sm" variant="outline" onClick={()=>fileRef.current?.click()}><ImagePlus className="size-4"/>{form.image?"Cambiar imagen":"Agregar imagen"}</Button>{form.image?<><img src={form.image} alt="" className="h-16 max-w-28 rounded-lg object-cover"/><Button type="button" size="sm" variant="ghost" onClick={()=>setForm({...form,image:""})}>Quitar</Button></>:null}</div></div>
        <label className="sm:col-span-2 flex items-center justify-between rounded-xl border p-3"><span><span className="block text-sm font-semibold">Activo</span><span className="text-xs text-muted-foreground">Puedes ocultarlo sin borrarlo.</span></span><Switch checked={form.active} onCheckedChange={v=>setForm({...form,active:v})}/></label></div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={resetForm}>Cancelar</Button><Button onClick={save} disabled={busy}>{busy?<Loader2 className="size-4 animate-spin"/>:null}{editingId?"Guardar cambios":"Agregar método"}</Button></div>
      </section>:null}

      <section className="rounded-2xl border overflow-hidden">
        {!items.length && !busy?<p className="p-8 text-center text-sm text-muted-foreground">Todavía no hay métodos. Pulsa “Agregar método” para crear el primero.</p>:null}
        {busy && !items.length?<div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin"/>Cargando…</div>:null}
        <div className="divide-y">{items.map((m,i)=><div key={m.id} className={`flex items-start gap-3 p-3 ${m.active?"":"opacity-55"}`}>
          <Checkbox checked={selected.includes(m.id)} onCheckedChange={v=>setSelected(s=>v?[...new Set([...s,m.id])]:s.filter(id=>id!==m.id))} aria-label={`Seleccionar ${m.name}`}/>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-muted-foreground">{i+1}.</span><p className="font-semibold">{m.name}</p>{!m.active?<span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">Oculto</span>:null}</div>{m.instruction?<p className="mt-1 line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">{m.instruction}</p>:null}{m.link?<p className="mt-1 truncate text-xs text-primary">{m.link}</p>:null}</div>
          <div className="flex shrink-0 gap-1"><Button size="icon" variant="outline" onClick={()=>edit(m)} aria-label="Editar"><Pencil className="size-4"/></Button><Button size="icon" variant="ghost" onClick={()=>void remove(m)} aria-label="Eliminar"><Trash2 className="size-4 text-destructive"/></Button></div>
        </div>)}</div>
      </section>

      <section className="rounded-2xl border bg-muted/20 p-3"><p className="mb-2 text-sm font-semibold">Exportar seleccionados</p><div className="grid grid-cols-3 gap-2"><Button variant="outline" onClick={exportDoc}><FileText className="size-4"/>Documento</Button><Button variant="outline" onClick={exportPdf}><Printer className="size-4"/>PDF</Button><Button variant="outline" onClick={()=>{if(requireChosen())void exportPng(chosen).then(()=>toast.success("Imagen generada")).catch(e=>toast.error(e instanceof Error?e.message:"No se pudo exportar"))}}><FileImage className="size-4"/>Imagen</Button></div><p className="mt-2 text-xs text-muted-foreground">Si marcas 3 métodos, los 3 salen juntos en el mismo archivo.</p></section>
    </DialogContent>
  </Dialog>;
}
