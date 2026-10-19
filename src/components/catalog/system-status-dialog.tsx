import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, Server, Smartphone, Wifi, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { systemHealth } from "@/lib/system-health.functions";

type CheckState = boolean | null | "blocked";

function accessBlocked(error: unknown) {
  const text = error instanceof Error ? error.message : String(error ?? "");
  return /Login Redirect|edge-access|app\.netlify\.com\/edge-access|Please enable JavaScript/i.test(text);
}

export function SystemStatusDialog() {
  const [open, setOpen] = useState(false);
  const [server, setServer] = useState<CheckState>(null);
  const [supabase, setSupabase] = useState<CheckState>(null);
  const [detail, setDetail] = useState("");
  const [last, setLast] = useState("");

  useEffect(() => {
    if (!open) return;
    setServer(null);
    setSupabase(null);
    setDetail("");
    systemHealth()
      .then((health) => {
        setServer(health.server);
        setSupabase(health.supabase);
        setDetail(health.detail ?? "");
        setLast(health.checkedAt);
      })
      .catch((error) => {
        const blocked = accessBlocked(error);
        setServer(blocked ? "blocked" : false);
        setSupabase(blocked ? "blocked" : false);
        setDetail(blocked ? "Netlify está bloqueando la llamada del servidor. No significa que Supabase esté caído." : error instanceof Error ? error.message : "No se pudo comprobar el sistema");
        setLast(new Date().toISOString());
      });
  }, [open]);

  const row = (ok: CheckState, label: string, icon: ReactNode) => (
    <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-2">
      {icon}
      <span className="min-w-0 flex-1 text-sm">{label}</span>
      {ok === null ? <Badge variant="secondary">revisando</Badge> : ok === "blocked" ? <Badge variant="secondary">acceso bloqueado</Badge> : ok ? <Badge>correcto</Badge> : <Badge variant="destructive">error</Badge>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm" className="rounded-xl"><Server className="mr-1.5 size-4" />Sistema</Button></DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md rounded-3xl">
        <DialogHeader><DialogTitle>Estado del sistema</DialogTitle><DialogDescription>Comprobación real de MA² antes de trabajar.</DialogDescription></DialogHeader>
        <div className="space-y-2">
          {row(navigator.onLine, "Internet", <Wifi className="size-4" />)}
          {row(server, "Servidor MA² / Netlify", server === false ? <XCircle className="size-4" /> : server === "blocked" ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />)}
          {row(supabase, "Supabase conectado", supabase === false ? <XCircle className="size-4" /> : supabase === "blocked" ? <AlertTriangle className="size-4" /> : <Database className="size-4" />)}
          {row(true, "Administración móvil", <Smartphone className="size-4" />)}
          {detail ? <div className="rounded-xl border p-2 text-xs text-muted-foreground">{detail}</div> : null}
          <div className="rounded-xl border p-2 text-xs text-muted-foreground"><p>Versión preparada: MA² v19</p>{last ? <p>Última comprobación: {new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(new Date(last))}</p> : null}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
