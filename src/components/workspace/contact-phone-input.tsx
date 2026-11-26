import { useEffect, useState } from "react";
import { Contact, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { phoneNumber } from "@/lib/workspace/model";

type ContactPicker = { select: (fields: string[], options: { multiple: boolean }) => Promise<{name?:string[];tel?:string[]}[]> };

export function ContactPhoneInput({value,onChange,onName,disabled=false}:{value:string;onChange:(value:string)=>void;onName?:(name:string)=>void;disabled?:boolean}){
  const [picker,setPicker]=useState<ContactPicker>();
  useEffect(()=>{setPicker((navigator as Navigator & {contacts?:ContactPicker}).contacts);},[]);
  async function choose(){
    try {
      const selected=(await picker?.select(["name","tel"],{multiple:false}))?.[0];
      if(!selected) return;
      if(!selected.tel?.length){toast.error("El contacto no tiene teléfono");return;}
      onChange(phoneNumber(selected.tel[0]));
      if(selected.name?.[0]) onName?.(selected.name[0]);
    } catch {toast.error("No se pudo abrir la agenda. Puedes pegar el número.");}
  }
  async function paste(){
    try {
      const text=await navigator.clipboard.readText();
      if(!/^\+?[\d\s()-]{10,25}$/.test(text.trim())){toast.error("Copia primero un número de teléfono válido");return;}
      onChange(phoneNumber(text.trim()));
    } catch {toast.info("Mantén presionado el campo de WhatsApp y selecciona Pegar.");}
  }
  return <div className="space-y-2">
    <Input required type="tel" inputMode="tel" autoComplete="tel" aria-label="WhatsApp obligatorio" disabled={disabled} value={value} onChange={e=>onChange(e.target.value)} placeholder="Ej. 844 123 4567"/>
    {!disabled && <div className="flex flex-wrap gap-2">
      {picker && <Button type="button" variant="outline" size="sm" onClick={()=>void choose()}><Contact className="size-4"/>Elegir contacto</Button>}
      <Button type="button" variant="outline" size="sm" onClick={()=>void paste()}><ClipboardPaste className="size-4"/>Pegar número</Button>
    </div>}
    {!disabled&&!picker&&<p className="text-xs text-muted-foreground">Copia el número de tu agenda y pégalo aquí.</p>}
  </div>;
}
