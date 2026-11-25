import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCatalogStore } from "@/lib/catalog/store";
import { REQUEST_MODE_LABELS, type RequestMode } from "@/lib/catalog/on-request";
import type { Service } from "@/lib/catalog/types";
import { toast } from "sonner";

export function OnRequestInventory() {
  const { catalog, allCatalogIds, state, setCatalogId, saveService, toggleService } = useCatalogStore();
  const [editing, setEditing] = useState<Service | null>(null), [open,setOpen] = useState(false);
  const [name,setName]=useState(""), [price,setPrice]=useState(""), [mode,setMode]=useState<RequestMode>("link"), [description,setDescription]=useState(""), [delivery,setDelivery]=useState(""), [category,setCategory]=useState("");
  const begin=(s?:Service)=>{setEditing(s||null);setName(s?.name||"");setPrice(s?String(s.price):"");setMode(s?.onRequest||"link");setDescription(s?.description||"");setDelivery(s?.delivery||"");setCategory(s?.categoryId||catalog.categories[0]?.id||"");setOpen(true);};
  return <section className="seller-card space-y-3">
    <div className="flex flex-wrap justify-between gap-2"><div><h2 className="font-bold">Stock por encargo</h2><p className="text-xs text-muted-foreground">Publica servicios sin comprar una cuenta anticipadamente. No se reservan credenciales.</p></div><Button size="sm" disabled={catalog.spaceType!=="catalog"} onClick={()=>begin()}>Agregar por encargo</Button></div>
    <label className="grid gap-1 text-sm">Catálogo público<select className="buyer-select" value={catalog.id} onChange={e=>{setOpen(false);setCatalogId(e.target.value);}}>{allCatalogIds.filter(id=>state.catalogs[id]?.spaceType==="catalog").map(id=><option key={id} value={id}>{state.catalogs[id].name}</option>)}</select></label>
    {open ? <form className="grid gap-2 rounded-xl border p-3" onSubmit={e=>{e.preventDefault();const amount=Number(price);if(!name.trim()||!price.trim()||!Number.isFinite(amount)||amount<0||!category)return toast.error("Revisa nombre, precio y categoría");if(catalog.services.some(s=>s.id!==editing?.id&&s.onRequest&&s.name.trim().toLowerCase()===name.trim().toLowerCase()))return toast.error("Ya existe un servicio por encargo con ese nombre");saveService({...editing,name:name.trim(),price:amount,categoryId:category,subsectionId:editing?.subsectionId||null,description,devices:editing?.devices||"",profiles:editing?.profiles||"",delivery,warranty:editing?.warranty||"",active:editing?.active??true,favorite:editing?.favorite??false,onRequest:mode,sectionId:editing?.sectionId||catalog.sectionTabs?.find(s=>!s.hidden)?.id});setOpen(false);}}>
      <Input required placeholder="Nombre del servicio" value={name} onChange={e=>setName(e.target.value)} maxLength={120}/><Input required type="number" min="0" step="0.01" placeholder="Precio MXN" value={price} onChange={e=>setPrice(e.target.value)}/>
      <label className="grid gap-1 text-sm">Modalidad<select className="buyer-select" value={mode} onChange={e=>setMode(e.target.value as RequestMode)}>{Object.entries(REQUEST_MODE_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Categoría<select className="buyer-select" value={category} onChange={e=>setCategory(e.target.value)}>{catalog.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <Textarea placeholder="Descripción visible al cliente" value={description} onChange={e=>setDescription(e.target.value)} maxLength={320}/><Input placeholder="Tiempo de entrega aproximado" value={delivery} onChange={e=>setDelivery(e.target.value)} maxLength={100}/>
      <div className="flex gap-2"><Button type="submit" size="sm">{editing?"Guardar cambios":"Publicar en catálogo"}</Button><Button type="button" variant="outline" size="sm" onClick={()=>setOpen(false)}>Cancelar</Button></div>
    </form>:null}
    {catalog.services.filter(s=>s.onRequest).map(s=><article key={s.id} className="rounded-xl border p-3 flex flex-wrap items-center justify-between gap-2"><div><b>{s.name}</b><p className="text-xs text-muted-foreground">${s.price} · {REQUEST_MODE_LABELS[s.onRequest!]} · {s.active?"Publicado":"Oculto"}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>begin(s)}>Editar</Button><Button size="sm" variant="outline" onClick={()=>toggleService(s.id)}>{s.active?"Ocultar":"Publicar"}</Button></div></article>)}
  </section>;
}
