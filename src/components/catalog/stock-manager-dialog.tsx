import { GalleryDeliveryImages } from "./platform-gallery-dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  Copy,
  Download,
  FileUp,
  Eye,
  EyeOff,
  History,
  Loader2,
  MessageCircle,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getSavedCode, saveCode } from "@/lib/notify/client";
import { notifyLogin } from "@/lib/notify/notify.functions";
import { copyText } from "@/lib/browser/clipboard";
import { cyberdocsListOrders } from "@/lib/cyberdocs/cyberdocs.functions";
import type { CyberDocsOrder } from "@/lib/cyberdocs/types";
import {
  stockAdminDelete,
  stockAdminDeliver,
  stockAdminHistory,
  stockAdminList,
  stockAdminSave,
  stockAdminProtectedLink,
  stockOwnerDelete,
  stockOwnerDeliver,
  stockOwnerHistory,
  stockOwnerList,
  stockOwnerSave,
  stockOwnerProtectedLink,
} from "@/lib/stock/stock.functions";
import { STOCK_STATUS_LABELS, type StockItem } from "@/lib/stock/types";
import type { DeliveryAttachment } from "@/lib/deliveries/types";
import { getPrimaryFichaTemplate, renderDeliveryFicha } from "@/lib/delivery-fichas";

type FeatureMap = Record<string, boolean>;
type HistoryRow = { id: string; action: string; detail: string; createdAt: string };
type StockTab = "available" | "sold" | "expiring" | "expired";


const blank = (): StockItem => ({
  id: "",
  businessId: null,
  platform: "",
  accountType: "Completa",
  stockKind: "complete",
  parentStockId: null,
  username: "",
  password: "",
  profilePin: "",
  panelUrl: "",
  panelUsername: "",
  panelPassword: "",
  provider: "",
  catalogRef: "",
  clientName: "",
  clientWhatsapp: "",
  status: "available",
  acquiredOn: null,
  deliveredOn: null,
  expiresOn: null,
  notes: "",
  cost: 0,
  salePrice: 0,
  relatedOrderId: "",
  renewalStatus: "",
  renewalNotifiedAt: null,
  protectedDeliveryId: "",
  createdAt: "",
  updatedAt: "",
});

const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
const err = (e: unknown) => (e instanceof Error ? e.message : "Ocurrió un error");
const today = () => new Date().toISOString().slice(0, 10);
const download = (name: string, body: string, type = "application/json") => {
  const a = document.createElement("a");
  const url = URL.createObjectURL(new Blob([body], { type }));
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};


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

export function StockManagerDialog({
  ownerToken,
  ownerFeatures,
  whatsappTemplate = "Hola {cliente}, aquí tienes tu entrega: {link}",
}: {
  ownerToken?: string;
  ownerFeatures?: FeatureMap;
  whatsappTemplate?: string;
}) {
  const admin = !ownerToken;
  const can = (key: string) => admin || Boolean(ownerFeatures?.[key]);
  const code = getSavedCode();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<StockItem[]>([]);
  const [stockTab, setStockTab] = useState<StockTab>("available");
  const [stockKindTab, setStockKindTab] = useState<"complete" | "profile">("complete");
  const [q, setQ] = useState("");
  const [cyberdocOrders, setCyberdocOrders] = useState<CyberDocsOrder[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [form, setForm] = useState<StockItem>(blank());
  const [showPass, setShowPass] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);

  const [toolsItem, setToolsItem] = useState<StockItem | null>(null);
  const [historyItem, setHistoryItem] = useState<StockItem | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const [deliver, setDeliver] = useState<StockItem | null>(null);
  const [deliverClient, setDeliverClient] = useState("");
  const [deliverWhatsapp, setDeliverWhatsapp] = useState("");
  const [deliverStockExpires, setDeliverStockExpires] = useState("");
  const [deliverSalePrice, setDeliverSalePrice] = useState("");
  const [deliverOrderRef, setDeliverOrderRef] = useState("");
  const [protect, setProtect] = useState(true);
  const [accessPassword, setAccessPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [days, setDays] = useState(7);
  const [views, setViews] = useState("0");
  const [message, setMessage] = useState(whatsappTemplate);
  const [deliveryImages, setDeliveryImages] = useState<string[]>([]);
  const [deliveryAttachment, setDeliveryAttachment] = useState<DeliveryAttachment | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const pinResolver = useRef<((ok: boolean) => void) | null>(null);
  const pinAuthorized = useRef(false);

  function requestStockPin() {
    if (pinAuthorized.current) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      pinResolver.current = resolve;
      setPinInput("");
      setPinOpen(true);
    });
  }

  function finishStockPin(ok: boolean) {
    if (ok) pinAuthorized.current = true;
    setPinOpen(false);
    const resolve = pinResolver.current;
    pinResolver.current = null;
    resolve?.(ok);
  }

  async function verifyStockPin() {
    const candidate = pinInput.trim();
    if (candidate.length < 4) {
      toast.error("Escribe tu PIN de seguridad");
      return;
    }
    try {
      await notifyLogin({ data: { code: candidate } });
      saveCode(candidate);
      finishStockPin(true);
    } catch (error) {
      toast.error(err(error));
    }
  }

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const next = ownerToken
        ? await stockOwnerList({ data: { token: ownerToken } })
        : await stockAdminList({ data: { code } });
      setItems(next);
      if (admin) {
        const orders = await cyberdocsListOrders({ data: { code } });
        setCyberdocOrders(orders);
      }
    } catch (e) {
      toast.error(err(e));
    } finally {
      setBusy(false);
    }
  }, [ownerToken, code, admin]);

  useEffect(() => {
    if (!open) return;
    if (admin) {
      const saved = localStorage.getItem("ma2-stock-whatsapp-template");
      if (saved) setMessage(saved);
    } else setMessage(whatsappTemplate);
    void load();
  }, [open, load, admin, whatsappTemplate]);

  const daysUntil = (value: string | null) => {
    if (!value) return null;
    const end = new Date(`${value}T23:59:59`);
    return Math.ceil((end.getTime() - Date.now()) / 86400000);
  };

  const soldItems = useMemo(() => items.filter((x) => x.status !== "available" && x.status !== "expired"), [items]);
  const renewalItems = useMemo(
    () => items.filter((x) => x.status !== "available" && x.expiresOn && (daysUntil(x.expiresOn) ?? 999) <= 7),
    [items],
  );
  const expiredCount = items.filter((x) => x.status === "expired" || (x.expiresOn && (daysUntil(x.expiresOn) ?? 1) < 0)).length;

  const tabItems = useMemo(() => {
    let base = items.filter((x) => (x.stockKind || "complete") === stockKindTab);
    if (!admin) base = base.filter((x) => x.status !== "available");
    if (stockTab === "available") base = base.filter((x) => x.status === "available");
    if (stockTab === "sold") base = base.filter((x) => x.status !== "available" && x.status !== "expired");
    if (stockTab === "expiring")
      base = base.filter((x) => x.status !== "available" && x.expiresOn && (daysUntil(x.expiresOn) ?? 999) <= 7 && (daysUntil(x.expiresOn) ?? -1) >= 0);
    if (stockTab === "expired")
      base = base.filter((x) => x.status === "expired" || Boolean(x.expiresOn && (daysUntil(x.expiresOn) ?? 1) < 0));
    const needle = q.trim().toLowerCase();
    return base
      .filter((x) => !needle || `${x.platform} ${x.username} ${x.clientName} ${x.clientWhatsapp} ${x.expiresOn || ""}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const ad = a.expiresOn ? new Date(a.expiresOn).getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b.expiresOn ? new Date(b.expiresOn).getTime() : Number.MAX_SAFE_INTEGER;
        return stockTab === "expiring" ? ad - bd : b.createdAt.localeCompare(a.createdAt);
      });
  }, [items, stockTab, stockKindTab, q, admin]);

  async function persist(item: StockItem, success = "Registro guardado") {
    const saved = ownerToken
      ? await stockOwnerSave({ data: { token: ownerToken, item } })
      : await stockAdminSave({ data: { code: getSavedCode(), item } });
    setItems((current) => (current.some((x) => x.id === saved.id) ? current.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...current]));
    if (success) toast.success(success);
    return saved;
  }

  async function save() {
    if (!form.platform.trim()) return toast.error("Escribe la plataforma");
    if (form.id && !can("stock_edit")) return toast.error("No tienes permiso para editar stock");
    if (!form.id && !can("stock_add")) return toast.error("No tienes permiso para agregar stock");
    if (!window.confirm("¿Está seguro de guardar estos cambios?")) return;
    setBusy(true);
    try {
      await persist({ ...form, stockKind: form.stockKind || "complete", accountType: form.stockKind === "profile" ? "Perfil" : "Completa" });
      setForm(blank());
      setFormOpen(false);
    } catch (e) {
      toast.error(err(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveBulk() {
    if (!can("stock_add")) return toast.error("No tienes permiso para agregar stock");
    if (!form.platform.trim()) return toast.error("Escribe la plataforma del lote");
    const lines = bulkText.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    if (!lines.length) return toast.error("Agrega al menos una cuenta");
    if (lines.length > 100) return toast.error("Puedes agregar hasta 100 cuentas por lote");
    if (!window.confirm(`¿Está seguro de guardar ${lines.length} cuenta(s) completas?`)) return;
    setBusy(true);
    try {
      for (const line of lines) {
        const [username = "", password = "", profilePin = ""] = line.split("|").map((x) => x.trim());
        // En modo lote nunca reutilizar credenciales capturadas previamente en modo individual.
        await persist({ ...form, id: "", stockKind: "complete", accountType: "Completa", parentStockId: null, username, password, profilePin, clientName: "", clientWhatsapp: "", deliveredOn: null, relatedOrderId: "", renewalStatus: "", renewalNotifiedAt: null }, "");
      }
      setBulkText("");
      setForm(blank());
      setFormOpen(false);
      await load();
      toast.success(`${lines.length} cuenta(s) agregadas al stock`);
    } catch (e) {
      toast.error(err(e));
    } finally {
      setBusy(false);
    }
  }

  async function convertToProfiles(x: StockItem) {
    if (x.stockKind === "profile" || x.status !== "available") return;
    const raw = window.prompt("¿Cuántos perfiles quieres sacar de esta cuenta completa?", "5");
    if (raw === null) return; const count = Math.max(1, Math.min(10, Number(raw) || 0)); if (!count) return toast.error("Cantidad inválida");
    if (!window.confirm(`Se crearán ${count} perfiles y la completa dejará de estar disponible. ¿Continuar?`)) return;
    setBusy(true); try {
      for (let i=1;i<=count;i++) await persist({ ...x, id:"", stockKind:"profile", parentStockId:x.id, accountType:"Perfil", profilePin:`Perfil ${i}`, status:"available", clientName:"", clientWhatsapp:"", deliveredOn:null, relatedOrderId:"", protectedDeliveryId:"", notes:`Perfil ${i} derivado de cuenta completa` }, "");
      await persist({ ...x, status:"expired", notes:`${x.notes ? x.notes+"\n" : ""}Convertida a ${count} perfiles` }, ""); await load(); setToolsItem(null); setStockKindTab("profile"); toast.success(`${count} perfiles creados`);
    } catch(e){ toast.error(err(e)); } finally { setBusy(false); }
  }

  async function revertToComplete(x: StockItem) {
    const parentId = x.parentStockId || x.id; const parent = items.find(i=>i.id===parentId); const children=items.filter(i=>i.parentStockId===parentId);
    if (!parent) return toast.error("No se encontró la cuenta completa original");
    if (children.some(i=>i.status !== "available")) return toast.error("No se puede revertir: uno o más perfiles ya están vendidos/asignados");
    if (!window.confirm("Se eliminarán los perfiles disponibles y la cuenta volverá a Completas. ¿Continuar?")) return;
    try { const ok=admin ? await requestStockPin() : true; if(!ok) return; for(const c of children) ownerToken ? await stockOwnerDelete({data:{token:ownerToken,id:c.id}}) : await stockAdminDelete({data:{code:getSavedCode(),id:c.id}}); await persist({...parent,status:"available",notes:parent.notes.replace(/\n?Convertida a \d+ perfiles/g,"")},""); await load(); setToolsItem(null); setStockKindTab("complete"); toast.success("Cuenta revertida a completa"); } catch(e){toast.error(err(e));}
  }

  async function remove(id: string) {
    if (!can("stock_delete")) return toast.error("No tienes permiso para eliminar stock");
    if (!confirm("¿Eliminar este registro de stock?")) return;
    try {
      let adminCode = code;
      if (admin) {
        const ok = await requestStockPin();
        if (!ok) return;
        adminCode = getSavedCode();
      }
      ownerToken ? await stockOwnerDelete({ data: { token: ownerToken, id } }) : await stockAdminDelete({ data: { code: adminCode, id } });
      setItems((p) => p.filter((x) => x.id !== id));
      setToolsItem(null);
      toast.success("Registro eliminado");
    } catch (e) {
      toast.error(err(e));
    }
  }

  async function openHistory(item: StockItem) {
    setHistoryItem(item);
    try {
      setHistory(ownerToken ? await stockOwnerHistory({ data: { token: ownerToken, id: item.id } }) : await stockAdminHistory({ data: { code, id: item.id } }));
    } catch (e) {
      toast.error(err(e));
    }
  }

  function exportBackup() {
    if (!can("stock_export")) return toast.error("No tienes permiso para exportar");
    const clean = items.map((x) => ({ ...x, password: can("stock_view_password") ? x.password : "", panelPassword: can("stock_view_password") ? x.panelPassword : "" }));
    download(`ma2-stock-${today()}.json`, JSON.stringify({ kind: "ma2-stock-backup", version: 2, exportedAt: new Date().toISOString(), items: clean }, null, 2));
    toast.success("Respaldo exportado");
  }

  async function copyValue(label: string, value: string) {
    if (!value) return toast.error(`No hay ${label.toLowerCase()} guardado`);
    await copyText(value);
    toast.success(`${label} copiado`);
  }

  async function copyProtectedLink(x: StockItem) {
    try {
      const result = ownerToken
        ? await stockOwnerProtectedLink({ data: { token: ownerToken, id: x.id } })
        : await stockAdminProtectedLink({ data: { code, id: x.id } });
      const link = `${window.location.origin}/e/${result.id}?t=${encodeURIComponent(result.token)}`;
      await copyText(link);
      toast.success("Enlace protegido copiado");
    } catch (e) {
      toast.error(err(e));
    }
  }

  async function copyFullAccess(x: StockItem) {
    const body = [
      `📺 ${x.platform}${x.accountType ? ` · ${x.accountType}` : ""}`,
      x.username ? `Usuario/correo: ${x.username}` : "",
      x.password ? `Contraseña: ${x.password}` : "",
      x.profilePin ? `PIN: ${x.profilePin}` : "",
      x.panelUrl ? `Panel: ${x.panelUrl}` : "",
      x.panelUsername ? `Usuario panel: ${x.panelUsername}` : "",
      x.panelPassword ? `Contraseña panel: ${x.panelPassword}` : "",
    ].filter(Boolean).join("\n");
    await copyText(body);
    toast.success("Acceso completo copiado");
  }

  async function informClient(x: StockItem) {
    const price = x.salePrice ? `$${x.salePrice.toFixed(2)}` : "el precio acordado";
    const template = localStorage.getItem("ma2-renewal-template") || "Hola, [Nombre] 😊 Tu servicio de [Plataforma] vence el [Fecha]. ¿Deseas renovarlo para conservar tu acceso? El costo de renovación es de $[Precio].";
    const text = template
      .replaceAll("[Nombre]", x.clientName || "cliente")
      .replaceAll("[Plataforma]", x.platform)
      .replaceAll("[Fecha]", x.expiresOn || "próximamente")
      .replaceAll("$[Precio]", price)
      .replaceAll("[Precio]", price.replace(/^\$/, ""));
    try {
      const saved = await persist({ ...x, renewalStatus: "Avisado", renewalNotifiedAt: new Date().toISOString() }, "Aviso registrado");
      setToolsItem(saved);
      const digits = x.clientWhatsapp.replace(/\D/g, "");
      if (!digits) {
        await copyText(text);
        toast.success("Mensaje copiado; falta WhatsApp del cliente");
      } else window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(err(e));
    }
  }

  async function setRenewalStatus(x: StockItem, renewalStatus: string) {
    try {
      const saved = await persist({ ...x, renewalStatus }, `Renovación: ${renewalStatus}`);
      setToolsItem(saved);
    } catch (e) {
      toast.error(err(e));
    }
  }

  async function renew(x: StockItem) {
    const value = window.prompt("Nueva fecha de vencimiento (AAAA-MM-DD):", x.expiresOn || "");
    if (!value) return;
    try {
      const saved = await persist({ ...x, expiresOn: value, renewalStatus: "Renovado" }, "Renovación guardada");
      setToolsItem(saved);
    } catch (e) {
      toast.error(err(e));
    }
  }

  async function noRenew(x: StockItem) {
    const action = window.prompt("Escribe LIBERAR para regresar la cuenta a Disponibles o BAJA para dejarla fuera de servicio:", "BAJA")?.trim().toUpperCase();
    if (!action || !["LIBERAR", "BAJA"].includes(action)) return;
    const next = action === "LIBERAR"
      ? { ...x, status: "available" as const, clientName: "", clientWhatsapp: "", deliveredOn: null, relatedOrderId: "", renewalStatus: "No renovó" }
      : { ...x, status: "expired" as const, renewalStatus: "No renovó" };
    try {
      await persist(next, action === "LIBERAR" ? "Cuenta liberada" : "Cuenta marcada como baja/vencida");
      setToolsItem(null);
    } catch (e) {
      toast.error(err(e));
    }
  }

  async function send() {
    if (!deliver) return;
    if (!can("stock_assign")) return toast.error("No tienes permiso para entregar stock");
    if (!deliverClient.trim()) return toast.error("Escribe a quién se entrega el producto");
    if (protect && (accessPassword.length < 4 || accessPassword !== confirmPassword)) return toast.error("Revisa la contraseña de protección");
    setBusy(true);
    try {
      const payload = {
        itemId: deliver.id, clientName: deliverClient.trim(), clientWhatsapp: deliverWhatsapp.trim(),
        stockExpiresOn: deliverStockExpires || null, salePrice: Number(deliverSalePrice) || 0,
        relatedOrderId: deliverOrderRef.trim(), accessPassword: protect ? accessPassword : "",
        expiresAt: iso(Math.max(1, days)), maxViews: Number(views) > 0 ? Number(views) : null, notes: deliver.notes, attachment: deliveryAttachment, images: deliveryImages,
      };
      const res = ownerToken ? await stockOwnerDeliver({ data: { token: ownerToken, ...payload } }) : await stockAdminDeliver({ data: { code, ...payload } });
      const link = `${window.location.origin}/e/${res.id}?t=${encodeURIComponent(res.token)}`;
      const ficha = renderDeliveryFicha(getPrimaryFichaTemplate(), { platform: deliver.platform, username: deliver.username, password: deliver.password, profilePin: deliver.profilePin, panelUrl: deliver.panelUrl || link, panelUsername: deliver.panelUsername, panelPassword: deliver.panelPassword });
      if (ficha) { await copyText(ficha); toast.success("Entrega realizada · ficha copiada"); }
      const platformText = (message || whatsappTemplate)
        .replaceAll("{cliente}", deliverClient || "cliente").replaceAll("{plataforma}", deliver.platform)
        .replaceAll("{usuario}", deliver.username).replaceAll("{vigencia}", `${days} día(s)`).replaceAll("{link}", link);
      if (protect) {
        await copyText(platformText);
        toast.success("Mensaje con enlace copiado · ahora envía la contraseña por WhatsApp");
        const passwordText = `Hola ${deliverClient || ""} 😊\nContraseña de tu documento protegido: ${accessPassword}`;
        const digits = deliverWhatsapp.replace(/\D/g, "");
        if (digits) window.open(`https://wa.me/${digits}?text=${encodeURIComponent(passwordText)}`, "_blank", "noopener,noreferrer");
        else await copyText(passwordText);
      } else {
        const digits = deliverWhatsapp.replace(/\D/g, "");
        if (digits) window.open(`https://wa.me/${digits}?text=${encodeURIComponent(platformText)}`, "_blank", "noopener,noreferrer");
        else await copyText(platformText);
        toast.success("Documento sin contraseña listo · un solo enlace");
      }
      setDeliver(null); setAccessPassword(""); setConfirmPassword(""); setDeliverSalePrice(""); setDeliverOrderRef(""); setDeliveryAttachment(null); setProtect(true);
      await load();
    } catch (e) { toast.error(err(e)); } finally { setBusy(false); }
  }

  const statusDot = (x: StockItem) => {
    const d = daysUntil(x.expiresOn);
    if (x.status !== "available" && d !== null && d <= 1) return "bg-red-500";
    if (x.status !== "available" && d !== null && d <= 3) return "bg-orange-500";
    if (x.status !== "available" && d !== null && d <= 7) return "bg-amber-400";
    if (x.status === "available") return "bg-emerald-500";
    if (x.status === "expired") return "bg-red-500";
    if (x.status === "client_replacement" || x.status === "provider_replacement") return "bg-red-500";
    return "bg-sky-500";
  };

  const countTab = (tab: StockTab) => {
    if (tab === "available") return items.filter((x) => x.status === "available").length;
    if (tab === "sold") return soldItems.length;
    if (tab === "expiring") return renewalItems.filter((x) => (daysUntil(x.expiresOn) ?? -1) >= 0).length;
    return expiredCount;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl"><Warehouse className="mr-1.5 size-4" />Gestor</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[94vh] w-[calc(100vw-0.75rem)] max-w-6xl overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>Gestor</DialogTitle>
          <DialogDescription>Administra tu stock, copia credenciales y prepara tus entregas.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">Mi stock actual</h3>
          <Button size="sm" variant="ghost" onClick={() => void load()} disabled={busy}><RefreshCw className="mr-1 size-4" />Actualizar</Button>
        </div>

          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-muted/20 p-3">
              <div><p className="font-semibold">Mi stock actual</p><p className="text-xs text-muted-foreground">Selecciona una subpestaña. La información sensible queda dentro de ⚙️.</p></div>
              {can("stock_add") && stockKindTab === "complete" ? <Button onClick={() => { setForm(blank()); setBulkMode(false); setFormOpen(true); }}><Plus className="mr-1 size-4" />Agregar completas</Button> : null}
            </div>

            <div className="flex flex-wrap gap-2"><Button size="sm" variant={stockKindTab === "complete" ? "default" : "outline"} onClick={() => setStockKindTab("complete")}>📺 Completas</Button><Button size="sm" variant={stockKindTab === "profile" ? "default" : "outline"} onClick={() => setStockKindTab("profile")}>👤 Perfiles</Button></div>
            <div className="flex flex-wrap gap-2">
              {([
                ["available", "Disponibles"],
                ["sold", "Vendidas"],
                ["expiring", "Por vencer"],
                ["expired", "Vencidas / bajas"],
              ] as [StockTab, string][]).map(([key, label]) => <Button key={key} size="sm" variant={stockTab === key ? "default" : "outline"} onClick={() => setStockTab(key)}>{label} ({countTab(key)})</Button>)}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-56 flex-1 items-center gap-2"><Search className="size-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar plataforma, cliente, WhatsApp, correo o vencimiento" /></div>
              {can("stock_export") ? <Button size="sm" variant="outline" onClick={exportBackup}><Download className="mr-1 size-4" />Exportar respaldo</Button> : null}
            </div>

            {busy ? <Loader2 className="mx-auto size-5 animate-spin" /> : null}
            <div className="overflow-hidden rounded-2xl border">
              <div className="grid grid-cols-[1fr_150px_74px] border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span>Plataforma</span><span>Estado</span><span className="text-center">Configuración</span></div>
              {tabItems.map((x) => {
                const d = daysUntil(x.expiresOn);
                const statusText = x.status !== "available" && d !== null && d <= 7 && d >= 0 ? `Por vencer · ${d === 0 ? "hoy" : `${d}d`}` : STOCK_STATUS_LABELS[x.status];
                return <div key={x.id} className="grid grid-cols-[1fr_150px_74px] items-center border-b px-3 py-3 last:border-b-0"><div className="min-w-0"><p className="truncate font-semibold">{x.platform}</p>{x.accountType ? <p className="truncate text-xs text-muted-foreground">{x.accountType}</p> : null}</div><div className="flex items-center gap-2 text-sm"><span className={`size-2.5 shrink-0 rounded-full ${statusDot(x)}`} /><span className="truncate">{statusText}</span></div><div className="text-center"><Button size="icon" variant="outline" className="size-9" onClick={() => setToolsItem(x)} aria-label={`Configurar ${x.platform}`}><Settings2 className="size-4" /></Button></div></div>;
              })}
              {!tabItems.length ? <p className="p-6 text-center text-sm text-muted-foreground">No hay registros en esta subpestaña.</p> : null}
            </div>
          </div>

        <Dialog open={formOpen} onOpenChange={(value) => { setFormOpen(value); if (!value) { setForm(blank()); setBulkMode(false); } }}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader><DialogTitle>{form.id ? "Editar cuenta" : "Agregar stock"}</DialogTitle><DialogDescription>{form.id ? "Edita todos los datos del registro." : "Aquí solo capturas datos del stock. Cliente y entrega se solicitan únicamente al vender."}</DialogDescription></DialogHeader>
            {!form.id ? <div className="flex gap-2"><Button size="sm" variant={!bulkMode ? "default" : "outline"} onClick={() => { setBulkMode(false); setBulkText(""); }}>Agregar individual</Button><Button size="sm" variant={bulkMode ? "default" : "outline"} onClick={() => { setBulkMode(true); setForm((current) => ({ ...current, username: "", password: "", profilePin: "" })); }}>Agregar por lote</Button></div> : null}
            <div ref={formRef} className="grid gap-3 sm:grid-cols-3">
              <div><Label>Plataforma</Label><Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} /></div>
              <div><Label>Tipo de stock</Label><Input value={form.stockKind === "profile" ? "Perfil" : "Completa"} disabled /></div>
              {!bulkMode ? <div><Label>Usuario / correo</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div> : null}
              {!bulkMode ? <div><Label>Contraseña</Label><div className="relative"><Input type={showPass && can("stock_view_password") ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="pr-10" /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 size-8 -translate-y-1/2" onClick={() => setShowPass((v) => !v)}>{showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button></div></div> : null}
              {!bulkMode ? <div><Label>Perfil / PIN</Label><Input value={form.profilePin} onChange={(e) => setForm({ ...form, profilePin: e.target.value })} /></div> : null}
              <div><Label>Proveedor</Label><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></div>
              <div><Label>Link del panel</Label><Input value={form.panelUrl} onChange={(e) => setForm({ ...form, panelUrl: e.target.value })} /></div>
              <div><Label>Usuario del panel</Label><Input value={form.panelUsername} onChange={(e) => setForm({ ...form, panelUsername: e.target.value })} /></div>
              <div><Label>Contraseña del panel</Label><Input type={showPass ? "text" : "password"} value={form.panelPassword} onChange={(e) => setForm({ ...form, panelPassword: e.target.value })} /></div>
              <div><Label>Costo</Label><Input type="number" min={0} step="0.01" value={form.cost || ""} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) || 0 })} /></div>
              <div><Label>Precio de venta</Label><Input type="number" min={0} step="0.01" value={form.salePrice || ""} onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) || 0 })} /></div>
              <div><Label>Fecha de compra</Label><Input type="date" value={form.acquiredOn || ""} onChange={(e) => setForm({ ...form, acquiredOn: e.target.value || null })} /></div>
              <div><Label>Vencimiento base</Label><Input type="date" value={form.expiresOn || ""} onChange={(e) => setForm({ ...form, expiresOn: e.target.value || null })} /></div>
              {form.id && form.status !== "available" ? <><div><Label>Cliente</Label><Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} /></div><div><Label>WhatsApp</Label><Input value={form.clientWhatsapp} onChange={(e) => setForm({ ...form, clientWhatsapp: e.target.value })} /></div><div><Label>Pedido relacionado</Label><Input value={form.relatedOrderId} onChange={(e) => setForm({ ...form, relatedOrderId: e.target.value })} /></div></> : null}
              <div className="sm:col-span-3"><Label>Notas privadas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              {bulkMode ? <div className="sm:col-span-3"><Label>Cuentas del lote</Label><Textarea rows={7} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={'correo1@ejemplo.com | contraseña1 | PIN1\ncorreo2@ejemplo.com | contraseña2 | PIN2'} /><p className="mt-1 text-[11px] text-muted-foreground">Una cuenta por renglón: correo/usuario | contraseña | PIN. Se evita duplicar correos/usuarios ya registrados.</p></div> : null}
            </div>
            <div className="flex gap-2"><Button onClick={() => void (bulkMode ? saveBulk() : save())} disabled={busy}><Plus className="mr-1 size-4" />{form.id ? "Guardar cambios" : bulkMode ? "Agregar lote" : "Agregar cuenta"}</Button><Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button></div>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(toolsItem)} onOpenChange={(value) => !value && setToolsItem(null)}>
          <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
            {toolsItem ? <>
              <DialogHeader><DialogTitle>⚙️ {toolsItem.platform}</DialogTitle><DialogDescription>Acciones y datos privados de esta cuenta.</DialogDescription></DialogHeader>
              <div className="grid gap-2 rounded-xl border p-3 text-sm sm:grid-cols-2">
                {toolsItem.username ? <p><b>Usuario/correo:</b> {toolsItem.username}</p> : null}
                {toolsItem.profilePin ? <p><b>PIN:</b> {toolsItem.profilePin}</p> : null}
                {toolsItem.clientName ? <p><b>Cliente:</b> {toolsItem.clientName}</p> : null}
                {toolsItem.expiresOn ? <p><b>Vence:</b> {toolsItem.expiresOn}</p> : null}
                {toolsItem.renewalStatus ? <p><b>Renovación:</b> {toolsItem.renewalStatus}</p> : null}
                {toolsItem.renewalNotifiedAt ? <p><b>Último aviso:</b> {new Date(toolsItem.renewalNotifiedAt).toLocaleString("es-MX")}</p> : null}
                {toolsItem.cost ? <p><b>Costo:</b> ${toolsItem.cost.toFixed(2)}</p> : null}
                {toolsItem.salePrice ? <p><b>Venta:</b> ${toolsItem.salePrice.toFixed(2)}</p> : null}
                {toolsItem.cost || toolsItem.salePrice ? <p><b>Ganancia:</b> ${(toolsItem.salePrice - toolsItem.cost).toFixed(2)}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {toolsItem.username ? <Button size="sm" variant="outline" onClick={() => void copyValue("Usuario/correo", toolsItem.username)}><Copy className="mr-1 size-3.5" />Correo</Button> : null}
                {can("stock_view_password") && toolsItem.password ? <Button size="sm" variant="outline" onClick={() => void copyValue("Contraseña", toolsItem.password)}><Copy className="mr-1 size-3.5" />Contraseña</Button> : null}
                {toolsItem.profilePin ? <Button size="sm" variant="outline" onClick={() => void copyValue("PIN", toolsItem.profilePin)}><Copy className="mr-1 size-3.5" />PIN</Button> : null}
                {toolsItem.panelUrl ? <Button size="sm" variant="outline" onClick={() => void copyValue("Link del panel", toolsItem.panelUrl)}><Copy className="mr-1 size-3.5" />Panel</Button> : null}
                {toolsItem.panelUsername ? <Button size="sm" variant="outline" onClick={() => void copyValue("Usuario del panel", toolsItem.panelUsername)}><Copy className="mr-1 size-3.5" />Usuario panel</Button> : null}
                {can("stock_view_password") && toolsItem.panelPassword ? <Button size="sm" variant="outline" onClick={() => void copyValue("Contraseña del panel", toolsItem.panelPassword)}><Copy className="mr-1 size-3.5" />Clave panel</Button> : null}
                {can("stock_view_password") ? <Button size="sm" variant="outline" onClick={() => void copyFullAccess(toolsItem)}><Copy className="mr-1 size-3.5" />Copiar credenciales</Button> : null}
                {toolsItem.protectedDeliveryId ? <Button size="sm" variant="outline" onClick={() => void copyProtectedLink(toolsItem)}><Copy className="mr-1 size-3.5" />Documento protegido</Button> : null}
                {can("stock_edit") ? <Button size="sm" variant="outline" onClick={() => { setForm({ ...toolsItem }); setFormOpen(true); setToolsItem(null); }}><Pencil className="mr-1 size-3.5" />Editar datos</Button> : null}
                {can("stock_edit") && toolsItem.stockKind !== "profile" && toolsItem.status === "available" ? <Button size="sm" variant="outline" onClick={() => void convertToProfiles(toolsItem)}>Convertir a perfiles</Button> : null}
                {can("stock_edit") && toolsItem.stockKind === "profile" ? <Button size="sm" variant="outline" onClick={() => void revertToComplete(toolsItem)}>Revertir a completa</Button> : null}
                {can("stock_assign") && toolsItem.status === "available" ? <Button size="sm" variant="outline" onClick={() => { setDeliver(toolsItem); setDeliveryImages([]); setDeliveryAttachment(null); setDeliverClient(""); setDeliverWhatsapp(""); setDeliverStockExpires(""); setDeliverSalePrice(toolsItem.salePrice ? String(toolsItem.salePrice) : ""); setDeliverOrderRef(""); setToolsItem(null); }}><PackageCheck className="mr-1 size-3.5" />Entrega manual</Button> : null}
                <Button size="sm" variant="outline" onClick={() => void openHistory(toolsItem)}><History className="mr-1 size-3.5" />Ver historial</Button>
                {toolsItem.status !== "available" && toolsItem.expiresOn && (daysUntil(toolsItem.expiresOn) ?? 999) <= 7 ? <><Button size="sm" onClick={() => void informClient(toolsItem)}><BellRing className="mr-1 size-3.5" />Informar al cliente</Button><Button size="sm" variant="outline" onClick={() => void setRenewalStatus(toolsItem, "Quiere renovar")}>Quiere renovar</Button><Button size="sm" variant="outline" onClick={() => void renew(toolsItem)}>Renovar</Button><Button size="sm" variant="outline" onClick={() => void noRenew(toolsItem)}>No renovó</Button></> : null}
                {can("stock_delete") ? <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void remove(toolsItem.id)}><Trash2 className="mr-1 size-3.5" />Eliminar</Button> : null}
              </div>
            </> : null}
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(deliver)} onOpenChange={(value) => !value && setDeliver(null)}>
          <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
            {deliver ? <>
              <DialogHeader><DialogTitle>Entregar · {deliver.platform}</DialogTitle><DialogDescription>Los datos de cliente se capturan aquí, nunca al agregar stock.</DialogDescription></DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Cliente</Label><Input value={deliverClient} disabled={admin && Boolean(deliverOrderRef)} onChange={(e) => setDeliverClient(e.target.value)} /></div>
                <div><Label>WhatsApp</Label><Input value={deliverWhatsapp} disabled={admin && Boolean(deliverOrderRef)} onChange={(e) => setDeliverWhatsapp(e.target.value)} /></div>
                <div><Label>Fecha de vencimiento</Label><Input type="date" value={deliverStockExpires} onChange={(e) => setDeliverStockExpires(e.target.value)} /></div>
                <div><Label>Precio de venta</Label><Input type="number" min={0} step="0.01" value={deliverSalePrice} onChange={(e) => setDeliverSalePrice(e.target.value)} /></div>
                {admin ? <div className="sm:col-span-2 space-y-1"><Label>Pedido de Cyberdoc (opcional)</Label>
                  <Select value={deliverOrderRef || "manual"} onValueChange={(value) => {
                    const selected = cyberdocOrders.find((order) => order.id === value);
                    setDeliverOrderRef(selected?.id || "");
                    setDeliverClient(selected?.clientName || "");
                    setDeliverWhatsapp(selected ? selected.whatsapp || (selected.contactLabel === "WhatsApp" ? selected.contactValue : "") : "");
                    setDeliverStockExpires(selected?.expiresOn || "");
                  }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                    <SelectItem value="manual">Entrega manual sin pedido</SelectItem>
                    {cyberdocOrders.filter((order) => !["completed", "cancelled", "rejected"].includes(order.status) && !order.stockItemId && !order.protectedDeliveryId).map((order) =>
                      <SelectItem key={order.id} value={order.id}>{order.cyberdocsOrderId} · {order.clientName} · {order.serviceName}</SelectItem>
                    )}
                  </SelectContent></Select>
                  {deliverOrderRef ? <p className="text-xs text-muted-foreground">Al entregar, el pedido quedará finalizado con este documento, cuenta y vencimiento. Puedes corregir el contacto desde Cyberdoc.</p> : null}
                </div> : null}

                {admin ? <div className="sm:col-span-2"><GalleryDeliveryImages platform={deliver.platform} images={deliveryImages} onChange={setDeliveryImages} /></div> : null}
                <div className="sm:col-span-2 space-y-2"><Label>Agregar documento desde tu celular (opcional)</Label><Input type="file" accept=".pdf,.doc,.docx,image/*" onChange={async (e) => { const file = e.target.files?.[0]; e.currentTarget.value = ""; if (!file) return; try { setDeliveryAttachment(await fileToAttachment(file)); } catch (error) { toast.error(err(error)); } }} />{deliveryAttachment ? <div className="flex items-center gap-2 rounded-xl border p-2 text-sm"><FileUp className="size-4" /><span className="min-w-0 flex-1 truncate">{deliveryAttachment.name}</span><Button type="button" size="sm" variant="ghost" onClick={() => setDeliveryAttachment(null)}>Quitar</Button></div> : <p className="text-[11px] text-muted-foreground">PDF, Word o imagen · máximo 5 MB.</p>}</div>
                <div className="sm:col-span-2"><p className="mb-2 text-sm font-semibold">Documento protegido</p><div className="grid gap-2 sm:grid-cols-2"><Button type="button" variant={protect ? "default" : "outline"} onClick={() => setProtect(true)}>Con contraseña</Button><Button type="button" variant={!protect ? "default" : "outline"} onClick={() => { setProtect(false); setAccessPassword(""); setConfirmPassword(""); }}>Sin contraseña</Button></div></div>
                {protect ? <><div><Label>Contraseña del documento</Label><Input type="password" value={accessPassword} onChange={(e) => setAccessPassword(e.target.value)} /></div><div><Label>Confirmar contraseña</Label><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div></> : null}
                <div><Label>Vigencia del documento (días)</Label><Input type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value) || 1)} /></div><div><Label>Límite de accesos</Label><Input type="number" min={0} value={views} onChange={(e) => setViews(e.target.value)} /></div>
              </div>
              <div className="flex gap-2"><Button onClick={() => void send()} disabled={busy}><MessageCircle className="mr-1 size-4" />Entregar</Button><Button variant="outline" onClick={() => setDeliver(null)}>Cancelar</Button></div>
            </> : null}
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(historyItem)} onOpenChange={(value) => !value && setHistoryItem(null)}>
          <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Historial · {historyItem?.platform || "Cuenta"}</DialogTitle></DialogHeader><div className="max-h-[60vh] space-y-2 overflow-y-auto">{history.map((h) => <p key={h.id} className="rounded-lg bg-muted/40 p-2 text-xs"><b>{new Date(h.createdAt).toLocaleString("es-MX")}</b> · {h.action} · {h.detail}</p>)}{!history.length ? <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p> : null}</div></DialogContent>
        </Dialog>
      <Dialog open={pinOpen} onOpenChange={(open) => { if (!open) finishStockPin(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Autorizar registro de stock</DialogTitle>
            <DialogDescription>Ingresa tu PIN de autorización para registrar o modificar la cuenta.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Label htmlFor="stock-pin">PIN de autorización</Label>
            <Input id="stock-pin" type="password" inputMode="numeric" autoFocus value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void verifyStockPin(); } }}
              placeholder="••••" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => finishStockPin(false)}>Cancelar</Button>
              <Button type="button" onClick={() => void verifyStockPin()}>Continuar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      </DialogContent>
    </Dialog>
  );
}
