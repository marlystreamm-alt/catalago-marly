import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { CheckCircle2, Clock3, Copy, Download, Eye, EyeOff, ExternalLink, FileText, LockKeyhole, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyText } from "@/lib/browser/clipboard";
import { deliveriesOpen } from "@/lib/deliveries/deliveries.functions";
import type { DeliveryPublicView } from "@/lib/deliveries/types";

const searchSchema = z.object({ t: fallback(z.string(), "").default("") });
export const Route = createFileRoute("/e/$id")({ validateSearch: zodValidator(searchSchema), component: DeliveryPage });

function DeliveryPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const token = search.t;
  const [data, setData] = useState<DeliveryPublicView | null>(null);
  const [error, setError] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [showAccessPassword, setShowAccessPassword] = useState(false);
  const [showCredentialPassword, setShowCredentialPassword] = useState(false);
  const [showPanelPassword, setShowPanelPassword] = useState(false);
  const [busy, setBusy] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);

  const openDelivery = async (password: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await deliveriesOpen({ data: { id, token, accessPassword: password } });
      setData(result);
      setNeedsPassword(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo abrir la entrega";
      if (/contraseña de acceso/i.test(message)) {
        setNeedsPassword(true);
        if (password) setError("Contraseña incorrecta. Verifica e intenta de nuevo.");
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void openDelivery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-4 py-8 sm:py-12">
      <header className="mb-5 text-center">
        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-primary/10"><ShieldCheck className="size-6 text-primary" /></div>
        <h1 className="text-xl font-bold">Entrega protegida MA²</h1>
        <p className="mt-1 text-sm text-muted-foreground">El contenido se muestra únicamente mientras esta entrega siga activa y dentro de su vigencia.</p>
      </header>

      {busy ? (
        <div className="rounded-3xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Validando entrega…</div>
      ) : needsPassword && !data ? (
        <section className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="text-center">
            <div className="mx-auto mb-2 grid size-10 place-items-center rounded-2xl bg-primary/10"><LockKeyhole className="size-5 text-primary" /></div>
            <h2 className="font-semibold">Documento protegido</h2>
            <p className="mt-1 text-xs text-muted-foreground">Escribe la contraseña que te proporcionaron. Ningún dato se mostrará antes.</p>
          </div>
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void openDelivery(accessPassword); }}>
            <div className="grid gap-1.5">
              <Label htmlFor="delivery-access-password">Contraseña</Label>
              <div className="relative">
                <Input id="delivery-access-password" type={showAccessPassword ? "text" : "password"} value={accessPassword} onChange={(e) => { setAccessPassword(e.target.value); setError(""); }} className="pr-10" autoComplete="current-password" />
                <Button type="button" size="icon" variant="ghost" className="absolute right-1 top-1/2 size-8 -translate-y-1/2" onClick={() => setShowAccessPassword((v) => !v)} aria-label={showAccessPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showAccessPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>
              </div>
            </div>
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            <Button type="submit" className="h-11 rounded-xl" disabled={accessPassword.length < 4}>Abrir documento</Button>
          </form>
        </section>
      ) : error && !data ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center"><p className="font-semibold text-destructive">Documento no disponible</p><p className="mt-2 text-sm text-muted-foreground">{error}</p></div>
      ) : data ? (
        <section className="space-y-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Plataforma / entrega</p><p className="text-lg font-bold">{data.platform}</p>{data.client ? <p className="text-sm text-muted-foreground">Para {data.client}</p> : null}</div>
          {data.username ? <div className="rounded-2xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Usuario / correo</p><div className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 break-all text-sm font-semibold">{data.username}</code><Button size="icon" variant="ghost" className="size-8" onClick={() => void copyText(data.username)}><Copy className="size-4" /></Button></div></div> : null}
          {data.password ? <div className="rounded-2xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Contraseña / código</p><div className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 break-all text-sm font-semibold">{showCredentialPassword ? data.password : "••••••••"}</code><Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowCredentialPassword((v) => !v)}>{showCredentialPassword ? <EyeOff className="mr-1 size-4" /> : <Eye className="mr-1 size-4" />}{showCredentialPassword ? "Ocultar" : "Mostrar"}</Button>{showCredentialPassword ? <Button size="icon" variant="ghost" className="size-8" onClick={() => void copyText(data.password)}><Copy className="size-4" /></Button> : null}</div></div> : null}
          {data.link ? <div className="rounded-2xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Link</p><div className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 break-all text-sm font-semibold">{data.link}</code><Button size="icon" variant="ghost" className="size-8" onClick={() => void copyText(data.link)}><Copy className="size-4" /></Button><Button size="icon" variant="ghost" className="size-8" onClick={() => window.open(data.link, "_blank", "noopener,noreferrer")}><ExternalLink className="size-4" /></Button></div></div> : null}
          {data.panelUsername ? <div className="rounded-2xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Usuario del panel</p><div className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 break-all text-sm font-semibold">{data.panelUsername}</code><Button size="icon" variant="ghost" className="size-8" onClick={() => void copyText(data.panelUsername)}><Copy className="size-4" /></Button></div></div> : null}
          {data.panelPassword ? <div className="rounded-2xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Contraseña del panel</p><div className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 break-all text-sm font-semibold">{showPanelPassword ? data.panelPassword : "••••••••"}</code><Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowPanelPassword((v) => !v)}>{showPanelPassword ? <EyeOff className="mr-1 size-4" /> : <Eye className="mr-1 size-4" />}{showPanelPassword ? "Ocultar" : "Mostrar"}</Button>{showPanelPassword ? <Button size="icon" variant="ghost" className="size-8" onClick={() => void copyText(data.panelPassword)}><Copy className="size-4" /></Button> : null}</div></div> : null}

          {data.attachment ? <div className="rounded-2xl border border-border p-3"><p className="text-xs text-muted-foreground">Documento adjunto</p><div className="mt-2 flex items-center gap-2"><FileText className="size-5 text-primary" /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{data.attachment.name}</span><Button size="sm" variant="outline" onClick={() => window.open(data.attachment!.dataUrl, "_blank", "noopener,noreferrer")}><ExternalLink className="mr-1 size-4" />Abrir</Button><a href={data.attachment.dataUrl} download={data.attachment.name}><Button size="sm"><Download className="mr-1 size-4" />Guardar</Button></a></div></div> : null}
          {data.notes ? <div className="rounded-2xl border border-border p-3 text-sm whitespace-pre-wrap">{data.notes}</div> : null}
          <Button type="button" variant="outline" className="w-full rounded-xl" onClick={() => window.open("https://wa.me/528443852364", "_blank", "noopener,noreferrer")}><MessageCircle className="mr-2 size-4" />Soporte por WhatsApp</Button>
          {data.images.length ? <div className="grid gap-3 sm:grid-cols-2">{data.images.map((src, i) => <a key={`${i}-${src.slice(0, 24)}`} href={src} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-border"><img src={src} alt={`Imagen protegida ${i + 1}`} className="h-56 w-full object-contain bg-muted/30" /></a>)}</div> : null}
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><p className="flex items-center gap-1.5"><Clock3 className="size-3.5" />Vence: {new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(new Date(data.expiresAt))}</p><p className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5" />Acceso #{data.viewCount}{data.remainingViews !== null ? ` · quedan ${data.remainingViews}` : " · sin límite"}</p></div>
        </section>
      ) : null}
    </main>
  );
}
