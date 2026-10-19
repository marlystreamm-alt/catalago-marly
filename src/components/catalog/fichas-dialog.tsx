import { useState } from "react";
import { Copy, FileText, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "@/lib/browser/clipboard";
import { loadFichaTemplates, saveFichaTemplates, loadPanelPresets, savePanelPresets, type FichaTemplate, type PanelPreset } from "@/lib/delivery-fichas";

export function FichasDialog() {
  const [open,setOpen]=useState(false); const [items,setItems]=useState<FichaTemplate[]>(()=>loadFichaTemplates()); const [panels,setPanels]=useState<PanelPreset[]>(()=>loadPanelPresets());
  const persist=(next:FichaTemplate[])=>{setItems(next);saveFichaTemplates(next);}; const persistPanels=(next:PanelPreset[])=>{setPanels(next);savePanelPresets(next);};
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="outline"><FileText className="size-4"/>Fichas</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Fichas de entrega</DialogTitle><DialogDescription>Crea varios formatos. La primera ficha se usa automáticamente al terminar una entrega y también puedes copiar cualquiera aquí.</DialogDescription></DialogHeader>
      <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">Variables: {'{plataforma}'} · {'{correo}'} · {'{contraseña}'} · {'{link}'} · {'{usuario_panel}'} · {'{contraseña_panel}'} · {'{perfil_pin}'}</div>
      <div className="grid gap-3">{items.map((x,i)=><div key={x.id} className="rounded-2xl border p-3"><div className="mb-2 flex gap-2"><Input value={x.name} onChange={e=>persist(items.map(y=>y.id===x.id?{...y,name:e.target.value}:y))}/><Button size="icon" variant="ghost" onClick={()=>persist(items.filter(y=>y.id!==x.id))} disabled={items.length===1}><Trash2 className="size-4"/></Button></div><Label>Formato</Label><Textarea className="mt-1 min-h-36" value={x.body} onChange={e=>persist(items.map(y=>y.id===x.id?{...y,body:e.target.value}:y))}/><div className="mt-2 flex gap-2"><Button size="sm" onClick={()=>{saveFichaTemplates(items);toast.success("Ficha guardada")}}><Save className="size-4"/>Guardar</Button><Button size="sm" variant="outline" onClick={async()=>{await copyText(x.body);toast.success("Formato copiado")}}><Copy className="size-4"/>Copiar</Button>{i===0?<span className="self-center text-xs text-muted-foreground">Predeterminada</span>:null}</div></div>)}
      <Button variant="outline" onClick={()=>persist([...items,{id:`f-${Date.now()}`,name:`Ficha ${items.length+1}`,body:"📺: {plataforma}\n✉️: {correo}\n🔑: {contraseña}\n📎: {link}"}])}><Plus className="size-4"/>Agregar otra ficha</Button></div>
      <div className="border-t pt-4"><p className="mb-2 text-sm font-semibold">Paneles guardados</p><p className="mb-3 text-xs text-muted-foreground">Guárdalos una vez y luego selecciónalos al hacer una entrega manual.</p><div className="grid gap-3">{panels.map(p=><div key={p.id} className="grid gap-2 rounded-2xl border p-3 sm:grid-cols-2"><Input placeholder="Nombre del panel" value={p.name} onChange={e=>persistPanels(panels.map(x=>x.id===p.id?{...x,name:e.target.value}:x))}/><Input placeholder="https://panel..." value={p.url} onChange={e=>persistPanels(panels.map(x=>x.id===p.id?{...x,url:e.target.value}:x))}/><Input placeholder="Usuario panel" value={p.username} onChange={e=>persistPanels(panels.map(x=>x.id===p.id?{...x,username:e.target.value}:x))}/><div className="flex gap-2"><Input placeholder="Contraseña panel" value={p.password} onChange={e=>persistPanels(panels.map(x=>x.id===p.id?{...x,password:e.target.value}:x))}/><Button size="icon" variant="ghost" onClick={()=>persistPanels(panels.filter(x=>x.id!==p.id))}><Trash2 className="size-4"/></Button></div></div>)}<Button variant="outline" onClick={()=>persistPanels([...panels,{id:`p-${Date.now()}`,name:"Panel nuevo",url:"",username:"",password:""}])}><Plus className="size-4"/>Agregar panel</Button></div></div>
    </DialogContent></Dialog>
}
