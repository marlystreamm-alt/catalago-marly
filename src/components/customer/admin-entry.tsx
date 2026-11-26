import {useState} from "react";
import {useCatalogStore} from "@/lib/catalog/store";
import {mainStoreLink} from "@/lib/catalog/links";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
export function AdminEntry(){
 const {login}=useCatalogStore();
 const [password,setPassword]=useState(""),[busy,setBusy]=useState(false);
 return <main className="seller-app ma2-unified"><header className="buyer-top"><div className="flex items-center gap-3 font-bold"><span className="seller-logo">MA²</span> MA² · Tienda digital</div></header><div className="buyer-auth"><section className="space-y-4"><p className="buyer-eyebrow">TU TIENDA DIGITAL</p><h1 className="text-3xl font-extrabold">Bienvenida a MA²</h1><p className="text-muted-foreground">Administra pedidos, productos, clientes y finanzas desde un solo lugar.</p></section><form className="seller-card space-y-4" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await login(password);}finally{setPassword("");setBusy(false);}}}><div className="seller-tabs"><a className="rounded-xl px-3 py-2 font-semibold" href={mainStoreLink("cuenta")}>Cliente / revendedor</a><button type="button" className="active">Administración</button></div><h2 className="text-xl font-bold">Iniciar sesión</h2><label className="seller-field"><span>Contraseña de administración</span><Input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><Button className="w-full" disabled={busy}>{busy?"Ingresando…":"Ingresar al panel"}</Button><a className="block text-sm text-primary underline" href="/?panel=1&admin_recovery=1">Recuperar contraseña</a></form></div></main>
}
