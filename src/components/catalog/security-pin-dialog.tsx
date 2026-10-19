import { useState } from "react";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyChangeCode, notifyLogin } from "@/lib/notify/notify.functions";
import { getSavedPin, saveCode } from "@/lib/notify/client";

const err = (e: unknown) => (e instanceof Error ? e.message : "No se pudo cambiar el PIN");

export function SecurityPinDialog() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(() => getSavedPin());
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function rememberCurrent() {
    const value = current.trim();
    if (value.length < 4) return toast.error("Escribe tu PIN actual");
    setBusy(true);
    try {
      await notifyLogin({ data: { code: value } });
      saveCode(value);
      setOpen(false);
      toast.success("PIN validado y guardado en este dispositivo");
    } catch (e) {
      toast.error(err(e));
    } finally {
      setBusy(false);
    }
  }

  async function change() {
    const value = next.trim();
    if (value.length < 6) return toast.error("Usa al menos 6 caracteres para el PIN de seguridad");
    if (value !== confirm.trim()) return toast.error("Los PIN no coinciden");
    if (value === current.trim()) return toast.error("El nuevo PIN debe ser diferente");
    setBusy(true);
    try {
      await notifyChangeCode({ data: { code: current.trim(), newCode: value } });
      saveCode(value);
      setCurrent(value);
      setNext("");
      setConfirm("");
      setOpen(false);
      toast.success("PIN privado actualizado. Las herramientas ya usarán el nuevo PIN.");
    } catch (e) {
      toast.error(err(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="justify-start">
          <KeyRound className="size-4" /> Cambiar PIN de seguridad
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>PIN de herramientas privadas</DialogTitle>
          <DialogDescription>
            Protege Mis clientes, stock, entregas, ventas y solicitudes. Cámbialo antes de publicar y no lo compartas con clientes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>PIN actual</Label>
            <Input type={show ? "text" : "password"} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </div>
          <div>
            <Label>Nuevo PIN</Label>
            <Input type={show ? "text" : "password"} value={next} onChange={(e) => setNext(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
          </div>
          <div>
            <Label>Confirmar nuevo PIN</Label>
            <Input type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          <Button type="button" variant="ghost" className="justify-start" onClick={() => setShow((v) => !v)}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {show ? "Ocultar" : "Mostrar"}
          </Button>
          <Button type="button" variant="outline" onClick={() => void rememberCurrent()} disabled={busy || !current}>
            Usar este PIN en este dispositivo
          </Button>
          <Button type="button" onClick={() => void change()} disabled={busy || !next || !confirm}>
            {busy ? "Actualizando…" : "Cambiar PIN privado"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
