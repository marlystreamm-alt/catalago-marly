import {createFileRoute} from "@tanstack/react-router";
import {useEffect,useRef,useState} from "react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {customerGoogleAccess,customerResetFromLink} from "@/lib/customer/identity.functions";
import {customerIdentityClient} from "@/lib/customer/identity-client";
import {mainStoreLink} from "@/lib/catalog/links";
import {clearCode} from "@/lib/notify/client";

export const Route=createFileRoute("/recuperar-acceso")({ssr:false,validateSearch:(s:Record<string,unknown>)=>({modo:s.modo==="google"?"google" as const:"email" as const}),head:()=>({meta:[{title:"Acceso seguro · MA²"},{name:"robots",content:"noindex"},{name:"referrer",content:"no-referrer"}]}),component:RecoveryPage});
function RecoveryPage(){
 const {modo}=Route.useSearch(),started=useRef(false);
 const [accessToken,setToken]=useState(""),[status,setStatus]=useState<"loading"|"reset"|"link"|"register"|"done"|"error">("loading"),[error,setError]=useState(""),[email,setEmail]=useState(""),[name,setName]=useState(""),[wa,setWa]=useState(""),[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[busy,setBusy]=useState(false);
 const finishGoogle=async()=>{await customerIdentityClient("google").auth.signOut({scope:"local"}).catch(()=>undefined);try{window.localStorage.removeItem("ma2-admin-session-v2");clearCode();}catch{}window.location.replace(mainStoreLink());};
 const google=async(t:string,extra?:{currentPassword?:string;name?:string;whatsapp?:string})=>{const r=await customerGoogleAccess({data:{accessToken:t,...extra}});if(r.status==="ok"){await finishGoogle();return;}setEmail(r.email);setStatus(r.status);if(r.status==="register")setName(r.name||"");};
 useEffect(()=>{if(started.current)return;started.current=true;void (async()=>{
  try{const {data,error:authError}=await customerIdentityClient(modo).auth.getSession();const t=data.session?.access_token;if(authError||!t)throw Error("El enlace es inválido o venció. Solicita uno nuevo.");setToken(t);if(modo==="google")await google(t);else setStatus("reset");}
  catch(e){setError(e instanceof Error?e.message:"No se pudo comprobar el acceso");setStatus("error");}
 })();},[modo]);
 return <main className="seller-app ma2-unified min-h-screen"><div className="mx-auto max-w-md p-4 pt-12"><section className="seller-card space-y-4"><h1 className="text-xl font-bold">{modo==="google"?"Acceso con Google":"Restablecer contraseña"}</h1>
 {status==="loading"&&<p>Comprobando enlace seguro…</p>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
 {status==="reset"&&<form className="space-y-3" onSubmit={async e=>{e.preventDefault();if(busy)return;setError("");if(password!==confirm)return setError("Las contraseñas no coinciden");setBusy(true);try{await customerResetFromLink({data:{accessToken,password}});await customerIdentityClient("email").auth.signOut({scope:"local"}).catch(()=>undefined);setToken("");setPassword("");setConfirm("");setStatus("done");}catch(e){setError(e instanceof Error?e.message:"No se pudo guardar");}finally{setBusy(false);}}}><p className="text-sm">Elige una nueva contraseña de al menos 10 caracteres, con letras y números. Tus sesiones anteriores se cerrarán.</p><Input required type="password" autoComplete="new-password" minLength={10} maxLength={128} placeholder="Nueva contraseña" value={password} onChange={e=>setPassword(e.target.value)}/><Input required type="password" autoComplete="new-password" minLength={10} maxLength={128} placeholder="Repetir contraseña" value={confirm} onChange={e=>setConfirm(e.target.value)}/><Button className="w-full" disabled={busy}>Guardar contraseña</Button></form>}
 {status==="link"&&<form className="space-y-3" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError("");try{await google(accessToken,{currentPassword:password});}catch(e){setError(e instanceof Error?e.message:"No se pudo vincular");}finally{setBusy(false);}}}><p className="text-sm">Ya existe una cuenta con {email}. Confirma tu contraseña una sola vez para vincular Google sin duplicar tus compras ni saldo.</p><Input required type="password" autoComplete="current-password" placeholder="Contraseña actual" value={password} onChange={e=>setPassword(e.target.value)}/><Button disabled={busy} className="w-full">Vincular y entrar</Button></form>}
 {status==="register"&&<form className="space-y-3" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError("");try{await google(accessToken,{name,whatsapp:wa});}catch(e){setError(e instanceof Error?e.message:"No se pudo registrar");}finally{setBusy(false);}}}><p className="text-sm">Completa tus datos para crear tu cuenta con {email}.</p><Input required autoComplete="name" placeholder="Nombre completo" value={name} onChange={e=>setName(e.target.value)}/><Input required type="tel" autoComplete="tel" placeholder="WhatsApp con lada" value={wa} onChange={e=>setWa(e.target.value)}/><Button disabled={busy} className="w-full">Crear cuenta y entrar</Button></form>}
 {status==="done"&&<p className="text-sm text-emerald-700">Contraseña actualizada. Ya puedes ingresar con tu nueva contraseña.</p>}
 <Button variant="outline" className="w-full" asChild><a href={mainStoreLink("cuenta")}>Volver al inicio de sesión</a></Button></section></div></main>;
}
