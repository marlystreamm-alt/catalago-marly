import { useCallback, useEffect, useState } from "react";
import { ImagePlus, Images, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteLibraryImage, getImageLibrary, saveLibraryImage, type LibraryImage } from "@/lib/image-library";
import { toast } from "sonner";

export function ImageLibraryPicker({ onSelect, current }: { onSelect:(url:string)=>void; current?:string }) {
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [images,setImages]=useState<LibraryImage[]>([]);
  const refresh=useCallback(async()=>{ try { setImages(await getImageLibrary()); } catch(x) { toast.error(x instanceof Error?x.message:"No se pudo abrir la biblioteca"); } },[]);
  useEffect(()=>{ void refresh(); },[refresh]);
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" onClick={()=>{setOpen(v=>!v);void refresh()}}><Images className="mr-1 size-4"/>Biblioteca de imágenes</Button>
      <label className={`inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium ${busy?"cursor-wait opacity-60":"cursor-pointer"}`}>
        {busy?<Loader2 className="mr-1 size-4 animate-spin"/>:<ImagePlus className="mr-1 size-4"/>}{busy?"Guardando…":"Subir y guardar"}
        <Input className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={async e=>{const f=e.target.files?.[0]; if(!f)return; setBusy(true); try{const img=await saveLibraryImage(f); onSelect(img.dataUrl); await refresh(); setOpen(true); toast.success("Imagen guardada en Supabase")}catch(x){toast.error(x instanceof Error?x.message:"No se pudo guardar") }finally{setBusy(false); e.currentTarget.value=""}}}/>
      </label>
    </div>
    {open?<div className="rounded-2xl border p-3">
      <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Mis imágenes</p><span className="text-xs text-muted-foreground">{images.length} guardada(s)</span></div>
      {images.length?<div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{images.map(img=><div key={img.id} className={`relative overflow-hidden rounded-xl border ${current===img.dataUrl?"ring-2 ring-primary":""}`}>
        <button type="button" className="block w-full" onClick={()=>{onSelect(img.dataUrl);setOpen(false)}} title={img.name}><img src={img.dataUrl} alt={img.name} className="aspect-square w-full object-cover"/><span className="block truncate px-1 py-1 text-[10px]">{img.name}</span></button>
        <button type="button" className="absolute right-1 top-1 rounded-md bg-background/90 p-1" onClick={async()=>{if(!window.confirm("¿Eliminar esta imagen de la biblioteca?"))return; try{await deleteLibraryImage(img);await refresh();toast.success("Imagen eliminada")}catch(x){toast.error(x instanceof Error?x.message:"No se pudo eliminar")}}} aria-label="Eliminar de biblioteca"><Trash2 className="size-3"/></button>
      </div>)}</div>:<p className="py-4 text-center text-xs text-muted-foreground">Todavía no tienes imágenes guardadas en Supabase.</p>}
    </div>:null}
  </div>
}
