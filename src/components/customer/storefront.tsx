import { groupPlatforms, platformFamily } from "@/lib/stock/master-products";
import { useEffect,useState } from "react";
import { Search,ShoppingBag,ShieldCheck } from "lucide-react";
import { mainStoreLink } from "@/lib/catalog/links";
import { storefrontLoad,storefrontRequest } from "@/lib/customer/storefront.functions";
import { appearanceStyle, normalizeAppearance } from "@/lib/appearance/theme";
import { toast } from "sonner";
type Data=Awaited<ReturnType<typeof storefrontLoad>>;
type Product=Data["products"][number];
const money=(c:number)=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:2}).format(c/100);
const manual=(p:Product)=>p.kind.startsWith("catalog-request-");
function variantLabel(product: Product) {
  const kind = manual(product) ? "Por encargo" : product.kind === "complete" ? "Cuenta completa" : "Perfil";
  return [product.name, kind, product.months > 0 ? product.months + (product.months === 1 ? " mes" : " meses") : ""].filter(Boolean).join(" · ");
}

function PlatformCard({ name, items, choose }: { name: string; items: Product[]; choose: (product: Product) => void }) {
  const [choice, setChoice] = useState("");
  const product = items.find(item => item.key === choice) ?? items.find(item => item.available || manual(item)) ?? items[0];
  const [failedImage, setFailedImage] = useState("");
  const available = manual(product) || product.available > 0;
  return <article className="seller-card flex min-w-0 flex-col gap-3">
    <div className="ma2-product-cover grid aspect-[2/1] place-items-center overflow-hidden rounded-xl">
      {product.image && /^(https:\/\/|data:image\/|\/(?!\/))/.test(product.image) && failedImage !== product.image
        ? <img src={product.image} alt="" loading="lazy" onError={() => setFailedImage(product.image)} className="size-full object-cover" />
        : <ShoppingBag aria-hidden="true" className="text-primary" />}
    </div>
    <h3 className="font-bold">{name}</h3>
    {items.length > 1 ? <label className="seller-field"><span>Elige una opción</span>
      <select className="w-full rounded-lg border bg-card p-2 text-sm" value={product.key} onChange={e => setChoice(e.target.value)}>
        {items.map(item => <option key={item.key} value={item.key}>{variantLabel(item)}{!manual(item) && !item.available ? " · Agotado" : ""}</option>)}
      </select></label> : <p className="text-xs text-muted-foreground">{variantLabel(product)}</p>}
    {product.description && <p className="text-xs text-muted-foreground">{product.description}</p>}
    <strong className="mt-auto text-xl text-primary">{money(product.priceCents)}</strong>
    {available ? <button className="rounded-xl bg-primary p-2 text-sm font-bold text-primary-foreground" onClick={() => choose(product)}>
      {manual(product) ? "Solicitar" : "Comprar con saldo"}</button> : <span className="text-sm text-muted-foreground">Agotado</span>}
  </article>;
}
export function Storefront({embedded=false,onSelect,onPurchase}:{embedded?:boolean;onSelect?:(key:string,name:string)=>void;onPurchase?:()=>void}={}){
  const [data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[filter,setFilter]=useState("all"),[query,setQuery]=useState(""),[selected,setSelected]=useState<Product|null>(null),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[requestId,setRequestId]=useState("");
  const load=()=>{setError("");storefrontLoad().then(setData).catch(()=>setError("No pudimos cargar la tienda. Intenta nuevamente."));};
  useEffect(load,[]);
  const products=data?.products.filter(p=>(filter==="all"||(filter==="manual"?manual(p):p.kind===filter))&&(p.name + " " + platformFamily(p.name)).toLowerCase().includes(query.trim().toLowerCase()))||[];
  return <div className={embedded?"":"seller-app ma2-unified pb-24"} style={embedded?undefined:appearanceStyle(normalizeAppearance(data?.appearance))} data-season={embedded?undefined:normalizeAppearance(data?.appearance).season}>
    {!embedded&&<header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4"><a href={mainStoreLink()} className="flex items-center gap-2 font-black text-xl"><span className="seller-logo">{normalizeAppearance(data?.appearance).logoImage?<img src={normalizeAppearance(data?.appearance).logoImage} alt="MA²" className="h-full w-full object-contain"/>:"MA²"}</span><span>MA² <small className="block text-[10px] font-semibold text-muted-foreground">TIENDA DIGITAL</small></span></a><div className="flex gap-2"><a className="rounded-xl border px-3 py-2 text-sm font-bold" href={mainStoreLink("cuenta")}>Mi cuenta</a><a className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground" href={mainStoreLink("saldo")}>Mi saldo</a></div></div></header>}
    <div className={embedded?"":"mx-auto max-w-6xl px-4"}>
      <section id="productos" className="scroll-mt-24 space-y-4 py-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl font-black">Explora la tienda</h2>{data?.role==="reseller"&&<span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800">Precio revendedor</span>}</div><label className="flex items-center gap-2 rounded-xl border bg-card p-3"><Search size={20}/><input className="w-full bg-transparent outline-none" placeholder="Busca Disney, Netflix, Canva…" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="flex gap-2 overflow-x-auto pb-1">{[["all","Todo"],["profile","Perfiles"],["complete","Cuentas completas"],["manual","Entrega manual"]].map(([k,l])=><button key={k} onClick={()=>setFilter(k)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${filter===k?"bg-primary text-primary-foreground":"border bg-card"}`}>{l}</button>)}</div>
      {error?<button onClick={load} className="text-red-700">{error} Reintentar</button>:!data?<p>Consultando productos…</p>:products.length===0?<p className="rounded-xl border bg-card p-5">No hay productos en esta selección.</p>:<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groupPlatforms(products, p => p.name).map(group => <PlatformCard key={group.name} {...group} choose={p => {
          if (manual(p)) {
            setSelected(p); setDone(false); setRequestId(crypto.randomUUID());
          } else if (onSelect) onSelect(p.key,p.name);
          else location.assign(mainStoreLink("tienda",p.name,p.key));
        }} />)}
      </div>}</section>
      {!embedded&&<footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t py-5 text-xs text-muted-foreground"><span className="flex items-center gap-1"><ShieldCheck size={16}/> MA² · Gestión segura de pedidos</span><a href={mainStoreLink("cuenta")}>Iniciar sesión</a></footer>}
    </div>
    {selected&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl"><button className="float-right font-bold" onClick={()=>setSelected(null)}>Cerrar</button><h2 className="mb-2 text-xl font-bold">{selected.name}</h2>{done?<p className="py-5">Pedido pagado con tu saldo. Puedes darle seguimiento en Mis compras.</p>:<form className="mt-4 space-y-3" onSubmit={async e=>{e.preventDefault();if(busy)return;const f=new FormData(e.currentTarget);setBusy(true);try{await storefrontRequest({data:{key:selected.key,name:String(f.get("name")),email:String(f.get("email")),phone:String(f.get("phone")),requestId}});setDone(true);onPurchase?.();}catch(err){toast.error(err instanceof Error?err.message:"No se pudo pedir");}finally{setBusy(false);}}}><p className="text-sm">Entrega manual · {money(selected.priceCents)}. El importe se descontará de tu saldo al hacer el pedido.</p>{[["name","Nombre","text"],["email","Correo electrónico","email"],["phone","Teléfono / WhatsApp","tel"]].map(([k,l,t])=><label key={k} className="block text-sm font-bold">{l}<input name={k} type={t} required className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>)}<button disabled={busy} className="w-full rounded-xl bg-primary p-3 font-bold text-primary-foreground">{busy?"Comprando…":"Pagar con saldo"}</button></form>}</div></div>}
  </div>;
}
