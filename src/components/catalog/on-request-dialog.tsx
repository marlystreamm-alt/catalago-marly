import { useState } from "react";
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reportOrder } from "@/lib/notify/client";
import { displayPrice } from "@/lib/catalog/whatsapp";
import { REQUEST_MODE_LABELS } from "@/lib/catalog/on-request";
import type { Catalog, Service } from "@/lib/catalog/types";
import { toast } from "sonner";

export function OnRequestDialog({service,catalog}:{service:Service;catalog:Catalog}) {
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[name,setName]=useState(""),[phone,setPhone]=useState(""),[email,setEmail]=useState("");
  if(!service.onRequest || !service.active)return null;
  const requiresEmail=service.onRequest!=="link";
  return <><Button type="button" className="rounded-full" onClick={()=>setOpen(true)}>Solicitar por encargo</Button><Dialog open={open} onOpenChange={v=>{if(!busy)setOpen(v);}}><DialogContent><DialogHeader><DialogTitle>{service.name} · {displayPrice(service)}</DialogTitle><DialogDescription>{REQUEST_MODE_LABELS[service.onRequest]} · Te contactaremos para confirmar el pago y la entrega.</DialogDescription></DialogHeader><form className="grid gap-3" onSubmit={async e=>{e.preventDefault();if(busy)return;if(!name.trim()||!/^\+?[\d\s()-]{10,25}$/.test(phone.trim())||!/^\d{10,15}$/.test(phone.replace(/\D/g,"")))return toast.error("Revisa el nombre y el WhatsApp");setBusy(true);try{const message=["Modalidad: Por encargo",`Servicio: ${service.name}`,`Cliente: ${name.trim()}`,`WhatsApp del cliente: ${phone.trim()}`,requiresEmail?`Correo del cliente: ${email.trim()}`:"",`Entrega: ${REQUEST_MODE_LABELS[service.onRequest!]}`].filter(Boolean).join("\n");const ok=await reportOrder({catalogId:catalog.id,catalogName:catalog.name,serviceName:service.name,total:service.price,items:[{name:service.name,price:service.price}],message,link:location.href,recipient:""});if(!ok)throw Error("No se pudo registrar la solicitud. Intenta nuevamente.");toast.success("Solicitud registrada. Te contactaremos por WhatsApp.");setOpen(false);setName("");setPhone("");setEmail("");}catch(e){toast.error(e instanceof Error?e.message:"No se pudo enviar");}finally{setBusy(false);}}}>
    <Label>Nombre</Label><Input required minLength={2} maxLength={160} value={name} onChange={e=>setName(e.target.value)}/><Label>WhatsApp</Label><Input required type="tel" minLength={10} maxLength={25} value={phone} onChange={e=>setPhone(e.target.value)}/>{requiresEmail?<><Label>Correo que se utilizará para activar el servicio</Label><Input required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></>:null}<p className="text-xs text-muted-foreground">No compartas contraseñas ni códigos de verificación.</p><Button type="submit" disabled={busy}>{busy?"Enviando…":"Enviar solicitud"}</Button></form></DialogContent></Dialog></>;
}
