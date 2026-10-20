import { useCallback, useEffect, useState } from 'react';
import { ImagePlus, Images, Loader2, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { getSavedCode } from '@/lib/notify/client';
import { galleryArchive, galleryGetImage, galleryList, gallerySave, type GalleryImage } from '@/lib/gallery/gallery.functions';
import { prepareGalleryImage } from '@/lib/gallery/image';
const message = (e: unknown) => e instanceof Error ? e.message : 'No se pudo completar la operación';

function GalleryContents({ initialPlatform = '', onSelect }: { initialPlatform?: string; onSelect?: (image: string) => void }) {
  const [platform, setPlatform] = useState(initialPlatform);
  const [title, setTitle] = useState('Cómo ingresar');
  const [search, setSearch] = useState(initialPlatform);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const load = useCallback(async (next = 0) => {
    setLoading(true); setError('');
    try {
      const result = await galleryList({data:{code:getSavedCode(), platform:search.trim(), page:next}});
      setImages(current => next ? [...current,...result.images] : result.images); setPage(next); setHasMore(result.hasMore);
    } catch(e) { setError(message(e)); } finally { setLoading(false); }
  }, [search]);
  // Search is submitted explicitly; avoid a request on every keystroke.
  useEffect(() => { void load(0); }, []);
  return <div className="space-y-4">
    <div className="grid gap-3 rounded-2xl border bg-muted/20 p-3 sm:grid-cols-2">
      <div><Label htmlFor="gallery-platform">Plataforma</Label><Input id="gallery-platform" value={platform} maxLength={100} onChange={e=>setPlatform(e.target.value)} placeholder="Netflix, Disney+, Spotify…" /></div>
      <div><Label htmlFor="gallery-title">Título de las instrucciones</Label><Input id="gallery-title" value={title} maxLength={100} onChange={e=>setTitle(e.target.value)} placeholder="Cómo ingresar en la televisión" /></div>
      <div className="sm:col-span-2"><Label htmlFor="gallery-upload" className="flex items-center gap-2"><ImagePlus className="size-4" />Subir capturas o fotografías</Label><Input id="gallery-upload" className="mt-2" type="file" accept="image/*" multiple disabled={busy} onChange={async e=>{
        const files=Array.from(e.currentTarget.files || []);e.currentTarget.value='';if(!files.length)return;
        if(!platform.trim()||!title.trim())return toast.error('Escribe la plataforma y el título antes de subir');
        if(files.length>10)return toast.error('Selecciona hasta 10 imágenes a la vez');
        setBusy(true);let count=0;
        try { for(const file of files) { const prepared=await prepareGalleryImage(file);await gallerySave({data:{code:getSavedCode(),platform:platform.trim(),title:files.length>1?`${title.trim()} · ${++count}`:title.trim(),...prepared}});if(files.length===1)count++; } toast.success(`${count} imagen(es) guardada(s) en la galería`); }
        catch(e){toast.error(message(e));}finally{setBusy(false);await load(0);}
      }} /><p className="mt-2 text-xs text-muted-foreground">Se guardan en tu base de datos. Estarán disponibles al abrir sesión desde otro dispositivo.</p>{busy?<p role="status" className="mt-2 flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" />Guardando imágenes…</p>:null}</div>
    </div>
    <form className="flex gap-2" onSubmit={e=>{e.preventDefault();void load(0);}}><Input aria-label="Buscar imágenes por plataforma" value={search} maxLength={100} onChange={e=>setSearch(e.target.value)} placeholder="Buscar plataforma · vacío para ver todas" /><Button type="submit" variant="outline" disabled={loading||busy}><Search className="size-4" />Buscar</Button></form>
    {error?<div role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm"><p>{error}</p><Button variant="outline" className="mt-2" onClick={()=>void load(0)}>Reintentar</Button></div>:null}
    {loading?<p role="status" className="text-sm text-muted-foreground">Cargando galería…</p>:null}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{images.map(img=><article key={img.id} className="overflow-hidden rounded-2xl border bg-card">
      <button type="button" className="block w-full text-left" disabled={busy} onClick={async()=>{setBusy(true);try{const result=await galleryGetImage({data:{code:getSavedCode(),id:img.id}});if(onSelect)onSelect(result.image);else setPreview(result.image);}catch(e){toast.error(message(e));}finally{setBusy(false);}}} aria-label={`${onSelect?'Agregar':'Ver'} ${img.title} de ${img.platform}`}><img src={img.thumbnail} alt={img.title} loading="lazy" className="aspect-[4/3] w-full bg-muted/30 object-contain" /><div className="space-y-1 p-2"><p className="text-xs font-semibold text-primary">{img.platform}</p><p className="break-words text-sm">{img.title}</p><span className="text-xs text-muted-foreground">{onSelect?'Agregar a la entrega':'Ver imagen completa'}</span></div></button>
      <div className="border-t p-1"><Button type="button" size="sm" variant="ghost" className="text-xs text-muted-foreground" disabled={busy} onClick={async()=>{if(!confirm(`¿Retirar «${img.title}» de la galería? Las entregas anteriores conservarán su copia.`))return;setBusy(true);try{await galleryArchive({data:{code:getSavedCode(),id:img.id}});await load(0);toast.success('Imagen retirada de la galería');}catch(e){toast.error(message(e));}finally{setBusy(false);}}}><Trash2 className="size-3.5" />Retirar</Button></div>
    </article>)}</div>
    {!loading&&!error&&!images.length?<p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">No hay imágenes para esta búsqueda. Puedes subirlas arriba o borrar el filtro para ver todas.</p>:null}
    {hasMore?<Button variant="outline" disabled={loading||busy} onClick={()=>void load(page+1)}>Cargar más imágenes</Button>:null}
    <Dialog open={Boolean(preview)} onOpenChange={v=>{if(!v)setPreview('');}}><DialogContent className="max-h-[90vh] max-w-3xl overflow-auto"><DialogHeader><DialogTitle>Instrucciones de acceso</DialogTitle><DialogDescription>Vista completa de la imagen guardada.</DialogDescription></DialogHeader>{preview?<img src={preview} alt="Instrucciones de acceso completas" className="h-auto w-full object-contain" />:null}</DialogContent></Dialog>
  </div>;
}
export function PlatformGalleryDialog({ initialPlatform, onSelect }: { initialPlatform?: string; onSelect?: (image:string)=>void }) {
  const [open,setOpen]=useState(false);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button type="button" size="sm" variant="outline"><Images className="size-4" />{onSelect?'Elegir de la galería':'Galería de plataformas'}</Button></DialogTrigger><DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Galería de plataformas</DialogTitle><DialogDescription>Guarda cómo ingresar a cada plataforma y reutiliza las imágenes en tus entregas.</DialogDescription></DialogHeader><GalleryContents initialPlatform={initialPlatform} onSelect={onSelect?image=>{onSelect(image);setOpen(false);}:undefined} /></DialogContent></Dialog>;
}
export function GalleryDeliveryImages({ platform, images, onChange }: { platform: string; images:string[]; onChange:(images:string[])=>void }) {
  return <div className="space-y-2 rounded-2xl border p-3"><p className="text-sm font-semibold">Instrucciones de acceso · imágenes</p><p className="text-xs text-muted-foreground">Hasta 2 imágenes. Se incluyen dentro del documento protegido.</p>{images.length<2?<PlatformGalleryDialog initialPlatform={platform} onSelect={image=>{if(images.includes(image))return toast.error('Esta imagen ya está seleccionada');onChange([...images,image].slice(0,2));}} />:null}<div className="grid grid-cols-2 gap-2">{images.map((src,i)=><div key={i} className="relative rounded-xl border p-1"><img src={src} alt={`Instrucciones seleccionadas ${i+1}`} className="h-32 w-full object-contain" /><Button type="button" size="icon" variant="destructive" className="absolute right-1 top-1 size-7" aria-label={`Quitar imagen ${i+1} de esta entrega`} onClick={()=>onChange(images.filter((_,n)=>n!==i))}><X className="size-3.5" /></Button></div>)}</div></div>;
}
