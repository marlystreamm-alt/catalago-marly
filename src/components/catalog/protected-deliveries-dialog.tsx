import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Eye, EyeOff, FileUp, History, ImagePlus, KeyRound, Link2, Loader2, MessageCircle, PackageCheck, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { friendlyServerError } from "@/lib/server-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "@/lib/browser/clipboard";
import { getSavedCode } from "@/lib/notify/client";
import { deliveriesCreate, deliveriesDelete, deliveriesGetAdminDetails, deliveriesGetLinkToken, deliveriesList, deliveriesPatch, deliveriesSaleConfig } from "@/lib/deliveries/deliveries.functions";
import type { DeliveryAttachment, ProtectedDelivery, ProtectedDeliveryAdminView } from "@/lib/deliveries/types";

const errText = (e: unknown) => friendlyServerError(e, "Ocurrió un error");
const fmt = (iso: string) => new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
const toLocalDateTime = (iso: string) => {
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

function durationToIso(amount: number, unit: "minutes" | "hours" | "days") {
  const ms = unit === "minutes" ? amount * 60_000 : unit === "hours" ? amount * 3_600_000 : amount * 86_400_000;
  return new Date(Date.now() + ms).toISOString();
}

const DEFAULT_PLATFORM_MESSAGE = "Hola {cliente}, te entrego {plataforma}.\n\nPuedes abrir tu entrega aquí: {link}";
const DEFAULT_PASSWORD_MESSAGE = "Hola {cliente}, la contraseña para abrir tu entrega de {plataforma} es: {contraseña}";

function fillMessage(template: string, values: { client: string; platform: string; link?: string; password?: string }) {
  return template
    .replaceAll("{cliente}", values.client || "")
    .replaceAll("{plataforma}", values.platform || "tu compra")
    .replaceAll("{link}", values.link || "")
    .replaceAll("{contraseña}", values.password || "");
}

function stateOf(d: ProtectedDelivery) {
  if (d.status === "revoked") return "Revocada";
  if (d.status === "suspended") return "Suspendida";
  if (new Date(d.expiresAt).getTime() <= Date.now()) return "Vencida";
  if (d.maxViews !== null && d.viewCount >= d.maxViews) return "Límite alcanzado";
  return "Activa";
}


async function fileToAttachment(file: File): Promise<DeliveryAttachment> {
  if (file.size > 5_000_000) throw new Error("El documento debe pesar máximo 5 MB");
  const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png", "image/webp"];
  if (file.type && !allowed.includes(file.type)) throw new Error("Puedes adjuntar PDF, Word o una imagen");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer el documento"));
    reader.readAsDataURL(file);
  });
  return { name: file.name, type: file.type || "application/octet-stream", dataUrl };
}

async function fileToDataUrl(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Selecciona únicamente fotografías");
  if (file.size > 2_000_000) throw new Error("Cada fotografía debe pesar máximo 2 MB");
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer la fotografía"));
    reader.readAsDataURL(file);
  });
}

export function ProtectedDeliveriesDialog() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<ProtectedDelivery[]>([]);
  const [saleEnabled, setSaleEnabled] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [platform, setPlatform] = useState("");
  const [client, setClient] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [link, setLink] = useState("");
  const [panelUsername, setPanelUsername] = useState("");
  const [panelPassword, setPanelPassword] = useState("");
  const [platformMessage, setPlatformMessage] = useState(DEFAULT_PLATFORM_MESSAGE);
  const [passwordMessage, setPasswordMessage] = useState(DEFAULT_PASSWORD_MESSAGE);
  const [protectWithPassword, setProtectWithPassword] = useState(true);
  const [accessPassword, setAccessPassword] = useState("");
  const [confirmAccessPassword, setConfirmAccessPassword] = useState("");
  const [showAccessPassword, setShowAccessPassword] = useState(false);
  const [showConfirmAccessPassword, setShowConfirmAccessPassword] = useState(false);
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [attachment, setAttachment] = useState<DeliveryAttachment | null>(null);
  const [duration, setDuration] = useState(24);
  const [unit, setUnit] = useState<"minutes" | "hours" | "days">("days");
  const [maxViews, setMaxViews] = useState("0");
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDetail, setEditDetail] = useState<ProtectedDeliveryAdminView | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editExpires, setEditExpires] = useState("");
  const [editMaxViews, setEditMaxViews] = useState("0");
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editAttachment, setEditAttachment] = useState<DeliveryAttachment | null>(null);
  const code = getSavedCode();

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [list, cfg] = await Promise.all([deliveriesList({ data: { code } }), deliveriesSaleConfig({ data: { code } })]);
      setItems(list);
      setSaleEnabled(cfg.enabled);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  }, [code]);

  useEffect(() => { if (open) void refresh(); }, [open, refresh]);

  const reset = () => {
    setPlatform(""); setClient(""); setWhatsapp(""); setUsername(""); setPassword(""); setLink(""); setPanelUsername(""); setPanelPassword(""); setPlatformMessage(DEFAULT_PLATFORM_MESSAGE); setPasswordMessage(DEFAULT_PASSWORD_MESSAGE);
    setProtectWithPassword(true); setAccessPassword(""); setConfirmAccessPassword(""); setShowAccessPassword(false); setShowConfirmAccessPassword(false);
    setNotes(""); setImages([]); setAttachment(null); setDuration(24); setUnit("days"); setMaxViews("0"); setShowForm(false);
  };

  const addPhotos = async (files: FileList | null, target: "create" | "edit") => {
    if (!files?.length) return;
    const current = target === "create" ? images : editImages;
    if (current.length + files.length > 2) return toast.error("Puedes subir máximo 2 fotografías por entrega");
    try {
      const added = await Promise.all(Array.from(files).map(fileToDataUrl));
      if (target === "create") setImages([...current, ...added].slice(0, 2));
      else setEditImages([...current, ...added].slice(0, 2));
    } catch (e) { toast.error(errText(e)); }
  };

  const create = async () => {
    if (!platform.trim()) return toast.error("Escribe la plataforma o nombre de la entrega");
    if (duration <= 0) return toast.error("La vigencia debe ser mayor a cero");
    if (protectWithPassword && accessPassword.length < 4) return toast.error("La contraseña de protección debe tener al menos 4 caracteres");
    if (protectWithPassword && accessPassword !== confirmAccessPassword) return toast.error("Las contraseñas de protección no coinciden");
    if (!protectWithPassword && !window.confirm("Esta entrega se enviará SIN contraseña. Cualquier persona con el enlace podrá ver el contenido mientras siga vigente. ¿Deseas continuar?")) return;
    setBusy(true);
    try {
      const res = await deliveriesCreate({ data: {
        code, platform, client, whatsapp, username, password, link, panelUsername, panelPassword, accessPassword: protectWithPassword ? accessPassword : "", platformMessage, passwordMessage, notes, images,
        attachment, expiresAt: durationToIso(duration, unit), maxViews: Number(maxViews) > 0 ? Number(maxViews) : null,
      } });
      setItems((p) => [res.delivery, ...p]);
      const protectedLink = `${window.location.origin}/e/${res.delivery.id}?t=${encodeURIComponent(res.token)}`;
      await copyText(protectedLink);
      toast.success("Documento protegido creado · enlace copiado");
      reset();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  const linkFor = async (d: ProtectedDelivery, markWhatsapp = false) => {
    const res = await deliveriesGetLinkToken({ data: { code, id: d.id, markWhatsapp } });
    return { ...res, link: `${window.location.origin}/e/${d.id}?t=${encodeURIComponent(res.token)}` };
  };
  const copyPlatformDelivery = async (d: ProtectedDelivery) => {
    try {
      const info = await linkFor(d);
      const template = info.platformMessage || DEFAULT_PLATFORM_MESSAGE;
      const msg = fillMessage(template, { client: info.client, platform: info.platform, link: info.link });
      await copyText(msg);
      toast.success("Mensaje + link copiados para la plataforma");
    } catch (e) { toast.error(errText(e)); }
  };
  const sendWhatsappPassword = async (d: ProtectedDelivery) => {
    try {
      const info = await linkFor(d, true);
      if (!info.accessPassword) return toast.error("Esta entrega no tiene contraseña de protección");
      const template = info.passwordMessage || DEFAULT_PASSWORD_MESSAGE;
      const msg = fillMessage(template, { client: info.client, platform: info.platform, password: info.accessPassword });
      const digits = info.whatsapp.replace(/\D/g, "");
      if (!digits) { await copyText(msg); toast.success("Mensaje de contraseña copiado"); return; }
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
      await refresh();
    } catch (e) { toast.error(errText(e)); }
  };

  const patch = async (d: ProtectedDelivery, change: { status?: "active" | "suspended" | "revoked"; expiresAt?: string; maxViews?: number | null; images?: string[] }) => {
    try {
      const saved = await deliveriesPatch({ data: { code, id: d.id, ...change } });
      setItems((p) => p.map((x) => x.id === d.id ? saved : x));
      return saved;
    } catch (e) { toast.error(errText(e)); return null; }
  };

  const openEdit = async (d: ProtectedDelivery) => {
    setEditId(d.id); setEditDetail(null); setEditLoading(true);
    try {
      const detail = await deliveriesGetAdminDetails({ data: { code, id: d.id } });
      setEditDetail(detail);
      setEditExpires(toLocalDateTime(detail.expiresAt));
      setEditMaxViews(detail.maxViews === null ? "0" : String(detail.maxViews));
      setEditImages(Array.isArray(detail.images) ? detail.images.slice(0, 2) : []);
      setEditAttachment(detail.attachment ?? null);
    } catch (e) { toast.error(errText(e)); setEditId(null); } finally { setEditLoading(false); }
  };
  const updateEdit = <K extends keyof ProtectedDeliveryAdminView>(key: K, value: ProtectedDeliveryAdminView[K]) => setEditDetail((p) => p ? { ...p, [key]: value } : p);
  const saveEdit = async () => {
    const d = items.find((x) => x.id === editId);
    if (!d || !editDetail) return;
    if (!editDetail.platform.trim()) return toast.error("Escribe la plataforma o nombre de la entrega");
    if (!editExpires) return toast.error("Selecciona la nueva vigencia");
    if (editDetail.accessPassword && editDetail.accessPassword.length < 4) return toast.error("La contraseña de protección debe tener al menos 4 caracteres");
    setBusy(true);
    try {
      const saved = await deliveriesPatch({ data: {
        code, id: d.id, platform: editDetail.platform, client: editDetail.client, whatsapp: editDetail.whatsapp, username: editDetail.username,
        password: editDetail.password, link: editDetail.link, panelUsername: editDetail.panelUsername ?? "", panelPassword: editDetail.panelPassword ?? "", accessPassword: editDetail.accessPassword, platformMessage: editDetail.platformMessage ?? "", passwordMessage: editDetail.passwordMessage ?? "",
        notes: editDetail.notes, images: editImages, attachment: editAttachment, expiresAt: new Date(editExpires).toISOString(), maxViews: Number(editMaxViews) > 0 ? Number(editMaxViews) : null, status: d.status,
      } });
      setItems((p) => p.map((x) => x.id === d.id ? saved : x));
      setEditId(null); setEditDetail(null); toast.success("Todos los cambios quedaron guardados");
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  const history = useMemo(() => items.find((d) => d.id === historyId) ?? null, [items, historyId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm" className="rounded-xl"><ShieldCheck className="mr-1.5 size-4" /> Entregas protegidas</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto rounded-3xl">
        <DialogHeader><DialogTitle>Entregas protegidas</DialogTitle><DialogDescription>Protege el documento completo, controla accesos, vigencia y fotografías.</DialogDescription></DialogHeader>

        <section className="rounded-2xl border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Disponible para vender</p><p className="text-xs text-muted-foreground">Tu uso como administradora siempre permanece disponible.</p></div><Switch checked={saleEnabled} onCheckedChange={async (enabled) => { try { const r = await deliveriesSaleConfig({ data: { code, enabled } }); setSaleEnabled(r.enabled); toast.success(enabled ? "Función habilitada para venta" : "Función retirada de venta"); } catch (e) { toast.error(errText(e)); } }} /></div>
        </section>

        <div className="flex gap-2"><Button size="sm" className="rounded-xl" onClick={() => setShowForm((v) => !v)}><Plus className="mr-1 size-4" /> Nueva entrega</Button><Button size="sm" variant="outline" className="rounded-xl" onClick={() => void refresh()} disabled={busy}>{busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : null} Actualizar</Button></div>

        {showForm ? <section className="grid gap-3 rounded-2xl border border-border p-3 sm:grid-cols-2">
          <div><Label>Plataforma / entrega</Label><Input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Netflix, Canva, acceso…" /></div>
          <div><Label>Cliente</Label><Input value={client} onChange={(e) => setClient(e.target.value)} /></div>
          <div><Label>WhatsApp</Label><Input inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="521844…" /></div>
          <div><Label>Usuario / correo</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} /></div>
          <div><Label>Contraseña / código a entregar</Label><Input value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Link a proteger</Label><Input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." /></div>
          <div><Label>Usuario del panel</Label><Input value={panelUsername} onChange={(e) => setPanelUsername(e.target.value)} /></div>
          <div><Label>Contraseña del panel</Label><Input value={panelPassword} onChange={(e) => setPanelPassword(e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Mensaje para entregar en la plataforma</Label><Textarea value={platformMessage} onChange={(e) => setPlatformMessage(e.target.value)} /><p className="mt-1 text-[11px] text-muted-foreground">Puedes usar: {`{cliente}`}, {`{plataforma}`} y {`{link}`}.</p></div>
          <div className="sm:col-span-2"><Label>Mensaje para mandar la contraseña por WhatsApp</Label><Textarea value={passwordMessage} onChange={(e) => setPasswordMessage(e.target.value)} /><p className="mt-1 text-[11px] text-muted-foreground">Puedes usar: {`{cliente}`}, {`{plataforma}`} y {`{contraseña}`}.</p></div>
          <div className="sm:col-span-2 flex items-center justify-between rounded-xl border p-3"><div><p className="text-sm font-semibold">Proteger con contraseña</p><p className="text-xs text-muted-foreground">Opcional. Si se apaga, confirmarás el envío sin contraseña antes de crearla.</p></div><Switch checked={protectWithPassword} onCheckedChange={setProtectWithPassword} /></div>
          {protectWithPassword ? <><div><Label>Contraseña de protección</Label><div className="relative"><Input type={showAccessPassword ? "text" : "password"} value={accessPassword} onChange={(e) => setAccessPassword(e.target.value)} className="pr-10" placeholder="Mínimo 4 caracteres" /><Button type="button" size="icon" variant="ghost" className="absolute right-1 top-1/2 size-8 -translate-y-1/2" onClick={() => setShowAccessPassword((v) => !v)}>{showAccessPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button></div></div>
          <div><Label>Confirmar contraseña</Label><div className="relative"><Input type={showConfirmAccessPassword ? "text" : "password"} value={confirmAccessPassword} onChange={(e) => setConfirmAccessPassword(e.target.value)} className={accessPassword && confirmAccessPassword && accessPassword !== confirmAccessPassword ? "border-destructive pr-10" : "pr-10"} /><Button type="button" size="icon" variant="ghost" className="absolute right-1 top-1/2 size-8 -translate-y-1/2" onClick={() => setShowConfirmAccessPassword((v) => !v)}>{showConfirmAccessPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button></div>{accessPassword && confirmAccessPassword && accessPassword !== confirmAccessPassword ? <p className="mt-1 text-xs font-medium text-destructive">Las contraseñas no coinciden.</p> : null}</div></> : null}
          <div><Label>Vigencia</Label><div className="flex gap-2"><Input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 1)} /><Select value={unit} onValueChange={(v) => setUnit(v as typeof unit)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="minutes">Minutos</SelectItem><SelectItem value="hours">Horas</SelectItem><SelectItem value="days">Días</SelectItem></SelectContent></Select></div></div>
          <div><Label>Límite de accesos</Label><Input type="number" min={0} max={1000} value={maxViews} onChange={(e) => setMaxViews(e.target.value)} placeholder="0 = sin límite" /><p className="mt-1 text-[11px] text-muted-foreground">Puedes cambiarlo manualmente después, aunque el límite ya se haya alcanzado.</p></div>
          <div className="sm:col-span-2"><Label>Notas</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Instrucciones para el cliente" /></div>

          <div className="sm:col-span-2 space-y-2"><Label>Documento adjunto (opcional)</Label><Input type="file" accept=".pdf,.doc,.docx,image/*" onChange={async (e) => { const file = e.target.files?.[0]; e.currentTarget.value = ""; if (!file) return; try { setAttachment(await fileToAttachment(file)); } catch (err) { toast.error(errText(err)); } }} />{attachment ? <div className="flex items-center gap-2 rounded-xl border p-2 text-sm"><FileUp className="size-4" /><span className="min-w-0 flex-1 truncate">{attachment.name}</span><Button type="button" size="sm" variant="ghost" onClick={() => setAttachment(null)}>Quitar</Button></div> : <p className="text-[11px] text-muted-foreground">Puedes elegir un PDF, Word o imagen desde tu celular. Máximo 5 MB.</p>}</div>
          <div className="sm:col-span-2 space-y-2"><Label>Fotografías protegidas (máximo 2)</Label><Input type="file" accept="image/*" multiple disabled={images.length >= 2} onChange={(e) => { void addPhotos(e.target.files, "create"); e.currentTarget.value = ""; }} />{images.length ? <div className="grid grid-cols-2 gap-2">{images.map((src, i) => <div key={`${i}-${src.slice(0, 16)}`} className="relative overflow-hidden rounded-xl border"><img src={src} alt={`Vista previa ${i + 1}`} className="h-32 w-full object-contain bg-muted/30" /><Button type="button" size="icon" variant="destructive" className="absolute right-1 top-1 size-7" onClick={() => setImages((p) => p.filter((_, n) => n !== i))}><X className="size-3.5" /></Button></div>)}</div> : null}</div>
          <div className="sm:col-span-2 flex gap-2"><Button onClick={() => void create()} disabled={busy || (protectWithPassword && (!accessPassword || accessPassword !== confirmAccessPassword))}><PackageCheck className="mr-1 size-4" />Crear y copiar enlace</Button><Button variant="outline" onClick={reset}>Cancelar</Button></div>
        </section> : null}

        {editId ? <section className="grid gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center gap-2"><Pencil className="size-4" /><p className="flex-1 text-sm font-semibold">Editar entrega completa</p><Button size="sm" variant="ghost" onClick={() => { setEditId(null); setEditDetail(null); }}>Cerrar</Button></div>
          {editLoading || !editDetail ? <div className="sm:col-span-2 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Cargando todos los datos…</div> : <>
            <div><Label>Plataforma / entrega</Label><Input value={editDetail.platform} onChange={(e) => updateEdit("platform", e.target.value)} /></div>
            <div><Label>Cliente</Label><Input value={editDetail.client} onChange={(e) => updateEdit("client", e.target.value)} /></div>
            <div><Label>WhatsApp</Label><Input inputMode="tel" value={editDetail.whatsapp} onChange={(e) => updateEdit("whatsapp", e.target.value)} /></div>
            <div><Label>Usuario / correo</Label><Input value={editDetail.username} onChange={(e) => updateEdit("username", e.target.value)} /></div>
            <div><Label>Contraseña / código dentro del documento</Label><Input value={editDetail.password} onChange={(e) => updateEdit("password", e.target.value)} /></div>
            <div><Label>Contraseña de protección</Label><Input value={editDetail.accessPassword} onChange={(e) => updateEdit("accessPassword", e.target.value)} placeholder="Vacía = sin contraseña" /></div>
            <div className="sm:col-span-2"><Label>Link dentro del documento protegido</Label><Input type="url" value={editDetail.link} onChange={(e) => updateEdit("link", e.target.value)} /></div>
            <div><Label>Usuario del panel</Label><Input value={editDetail.panelUsername ?? ""} onChange={(e) => updateEdit("panelUsername", e.target.value)} /></div>
            <div><Label>Contraseña del panel</Label><Input value={editDetail.panelPassword ?? ""} onChange={(e) => updateEdit("panelPassword", e.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Mensaje para la plataforma (mensaje + link)</Label><Textarea value={editDetail.platformMessage ?? ""} onChange={(e) => updateEdit("platformMessage", e.target.value)} placeholder={DEFAULT_PLATFORM_MESSAGE} /><p className="mt-1 text-[11px] text-muted-foreground">Variables: {"{cliente}"}, {"{plataforma}"}, {"{link}"}</p></div>
            <div className="sm:col-span-2"><Label>Mensaje de contraseña para WhatsApp</Label><Textarea value={editDetail.passwordMessage ?? ""} onChange={(e) => updateEdit("passwordMessage", e.target.value)} placeholder={DEFAULT_PASSWORD_MESSAGE} /><p className="mt-1 text-[11px] text-muted-foreground">Variables: {"{cliente}"}, {"{plataforma}"}, {"{contraseña}"}</p></div>

            <div className="sm:col-span-2 space-y-2"><Label>Documento adjunto (opcional)</Label><Input type="file" accept=".pdf,.doc,.docx,image/*" onChange={async (e) => { const file = e.target.files?.[0]; e.currentTarget.value = ""; if (!file) return; try { setEditAttachment(await fileToAttachment(file)); } catch (err) { toast.error(errText(err)); } }} />{editAttachment ? <div className="flex items-center gap-2 rounded-xl border p-2 text-sm"><FileUp className="size-4" /><span className="min-w-0 flex-1 truncate">{editAttachment.name}</span><Button type="button" size="sm" variant="ghost" onClick={() => setEditAttachment(null)}>Quitar</Button></div> : null}</div>
            <div className="sm:col-span-2"><Label>Notas / instrucciones dentro del documento</Label><Textarea value={editDetail.notes} onChange={(e) => updateEdit("notes", e.target.value)} /></div>
            <div><Label>Vigencia</Label><Input type="datetime-local" value={editExpires} onChange={(e) => setEditExpires(e.target.value)} /></div>
            <div><Label>Límite de accesos</Label><Input type="number" min={0} max={1000} value={editMaxViews} onChange={(e) => setEditMaxViews(e.target.value)} /><p className="mt-1 text-[11px] text-muted-foreground">0 = sin límite. Accesos actuales: {editDetail.viewCount}.</p></div>
            <div className="sm:col-span-2 space-y-2"><Label>Fotografías (máximo 2)</Label><Input type="file" accept="image/*" multiple disabled={editImages.length >= 2} onChange={(e) => { void addPhotos(e.target.files, "edit"); e.currentTarget.value = ""; }} />{editImages.length ? <div className="grid grid-cols-2 gap-2">{editImages.map((src, i) => <div key={`${i}-${src.slice(0, 16)}`} className="relative overflow-hidden rounded-xl border"><img src={src} alt={`Foto ${i + 1}`} className="h-32 w-full object-contain bg-background" /><Button type="button" size="icon" variant="destructive" className="absolute right-1 top-1 size-7" onClick={() => setEditImages((p) => p.filter((_, n) => n !== i))}><X className="size-3.5" /></Button></div>)}</div> : null}</div>
            <div className="sm:col-span-2"><Button onClick={() => void saveEdit()} disabled={busy}>Guardar todos los cambios</Button></div>
          </>}
        </section> : null}

        {history ? <section className="rounded-2xl border border-primary/30 bg-primary/5 p-3"><div className="mb-2 flex items-center gap-2"><History className="size-4" /><p className="min-w-0 flex-1 truncate text-sm font-semibold">Historial · {history.platform}</p><Button size="sm" variant="ghost" onClick={() => setHistoryId(null)}>Cerrar</Button></div><ul className="max-h-52 space-y-1 overflow-y-auto text-xs">{[...history.history].reverse().map((h, i) => <li key={`${h.at}-${i}`} className="rounded-lg bg-background/80 px-2 py-1.5"><b>{fmt(h.at)}</b> · {h.detail}</li>)}</ul></section> : null}

        {items.length === 0 && !busy ? <p className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">Todavía no tienes entregas protegidas.</p> : null}
        <ul className="space-y-2">{items.map((d) => { const state = stateOf(d); return <li key={d.id} className="rounded-2xl border border-border p-3"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{d.platform}{d.client ? ` · ${d.client}` : ""}</p><p className="text-xs text-muted-foreground">{d.viewCount} acceso{d.viewCount === 1 ? "" : "s"} · {d.maxViews === null ? "sin límite" : `límite ${d.maxViews}`} · vence {fmt(d.expiresAt)}{d.imageCount ? ` · ${d.imageCount} foto${d.imageCount === 1 ? "" : "s"}` : ""}</p></div><Badge variant={state === "Activa" ? "default" : "secondary"}>{state}</Badge></div><div className="mt-2 flex flex-wrap gap-1.5"><Button size="sm" variant="outline" onClick={() => void copyPlatformDelivery(d)}><Link2 className="mr-1 size-3.5" />Plataforma</Button><Button size="sm" variant="outline" onClick={() => void sendWhatsappPassword(d)}><MessageCircle className="mr-1 size-3.5" />Contraseña WhatsApp</Button><Button size="sm" variant="outline" onClick={() => setHistoryId(d.id)}><Eye className="mr-1 size-3.5" />Historial</Button><Button size="sm" variant="outline" onClick={() => void openEdit(d)}><Pencil className="mr-1 size-3.5" />Editar</Button>{d.status === "active" ? <Button size="sm" variant="outline" onClick={() => void patch(d, { status: "suspended" })}>Suspender</Button> : d.status === "suspended" ? <Button size="sm" variant="outline" onClick={() => void patch(d, { status: "active" })}>Reactivar</Button> : null}{d.status !== "revoked" ? <Button size="sm" variant="outline" onClick={() => void patch(d, { status: "revoked" })}>Revocar</Button> : null}<Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { if (!confirm("¿Eliminar definitivamente esta entrega y su historial?")) return; try { await deliveriesDelete({ data: { code, id: d.id } }); setItems((p) => p.filter((x) => x.id !== d.id)); } catch (e) { toast.error(errText(e)); } }}><Trash2 className="size-3.5" /></Button></div></li>; })}</ul>
      </DialogContent>
    </Dialog>
  );
}
