import { opsLoad } from "@/lib/workspace/operations.functions";
import { ContactPhoneInput } from "@/components/workspace/contact-phone-input";
import { phoneNumber, validWhatsApp, validFullName, validClientEmail, transferReferenceMessage } from "@/lib/workspace/model";
import { pricingLoad } from "@/lib/customer/pricing.functions";
import { pricingKey, type PriceRow } from "@/lib/customer/pricing";
import { MASTER_PLANS, stockPlatform, groupPlatforms, platformFamily } from "@/lib/stock/master-products";
import {stockRevertPlan} from "@/lib/stock/revert";
import { Switch } from '@/components/ui/switch';
import { expiresAfterMonths, businessToday } from '@/lib/stock/duration';
import { daysRemaining } from '@/lib/stock/traffic-light';
import { ToolFrame } from '@/components/workspace/tool-frame';
import { StockPlatformMark } from "@/components/workspace/stock-platform-mark";
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
  Settings2,
  Trash2,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getSavedCode } from "@/lib/notify/client";
import { copyText } from "@/lib/browser/clipboard";
import { cyberdocsListOrders } from "@/lib/cyberdocs/cyberdocs.functions";
import type { CyberDocsOrder } from "@/lib/cyberdocs/types";
import {
  stockAdminDelete,
  stockAdminDeletedList,
  stockAdminClientReference,
  stockAdminRestoreDeleted,
  stockAdminConvertProfiles,
  stockAdminDeliver,
  stockAdminHistory,
  stockAdminList,
  stockAdminSave,
  stockAdminProtectedLink,
  stockAdminReview,
  stockOwnerDelete,
  stockOwnerConvertProfiles,
  stockOwnerDeliver,
  stockOwnerHistory,
  stockOwnerList,
  stockOwnerSave,
  stockOwnerProtectedLink,
  stockOwnerReview,
} from "@/lib/stock/stock.functions";
import { STOCK_STATUS_LABELS, type StockItem } from "@/lib/stock/types";
import type { DeliveryAttachment } from "@/lib/deliveries/types";
import { getPrimaryFichaTemplate, renderDeliveryFicha } from "@/lib/delivery-fichas";

type FeatureMap = Record<string, boolean>;
type HistoryRow = { id: string; action: string; detail: string; createdAt: string };
type StockTab = "all" | "available" | "sold" | "expiring" | "review" | "expired";


type PlatformOption = { id: string; label: string; platform: string; months?: number; kind?: "profile" | "complete" };
const platformOptions: { label: string; options: PlatformOption[] }[] = [
  {label:"Disney+",options:[
    {id:"disney-standard",label:"Disney+ Estándar",platform:"Disney+ Estándar",months:1},
    {id:"disney-premium",label:"Disney+ Premium",platform:"Disney+ Premium",months:1},
    {id:"disney-annual",label:"Disney+ Anual",platform:"Disney anual",months:12},
  ]},
  {label:"Netflix",options:[
    {id:"netflix-private",label:"Netflix Privado",platform:"Netflix Privado"},
    {id:"netflix-profile",label:"Netflix Perfil",platform:"Netflix",kind:"profile"},
    {id:"netflix-complete",label:"Netflix Completa",platform:"Netflix",kind:"complete"},
  ]},
  {label:"Paramount+",options:[{id:"paramount",label:"Paramount+",platform:"Paramount+"}]},
  {label:"Prime Video",options:[
    {id:"prime",label:"Prime Video",platform:"Prime Video",months:1},
    {id:"prime-six",label:"Prime Video · 6 meses",platform:"Prime Video 6M",months:6},
    {id:"prime-no-ads",label:"Prime Video Sin Anuncios",platform:"Prime Video S/A"},
  ]},
  {label:"Otras plataformas",options:MASTER_PLANS
    .filter(plan=>!/^(DIS|NET|PAR|PRI)-/.test(plan.code))
    .map(plan=>({id:plan.code,label:plan.name,platform:plan.name}))},
];
const options = platformOptions.flatMap(group=>group.options);
function selectedPlatform(form: Pick<StockItem,"platform"|"stockKind"|"durationMonths">) {
  const key = stockPlatform(form.platform).key;
  return options.find(option=>stockPlatform(option.platform).key===key
    && (!option.kind||option.kind===form.stockKind)
    && (!option.months||option.months===(form.durationMonths||1)))?.id || "manual";
}

const blank = (): StockItem => ({
  durationMonths: 1,
  startsOnSale: false,
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
  acquiredOn: businessToday(),
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
  embedded = false,
  initialTab = "all",
  initialPlatform,
  autoAdd = false,
  initialClient,
  compact = false,
  onDelivered,
  ownerToken,
  ownerFeatures,
  whatsappTemplate = "Hola {cliente}, aquí tienes tu entrega: {link}",
}: {
  embedded?: boolean;
  initialTab?: StockTab;
  initialPlatform?: { key: string; platform: string } | null;
  autoAdd?: boolean;
  initialClient?: {id:string;name:string;whatsapp:string;email?:string;clientReference?:string};
  compact?: boolean;
  onDelivered?: () => void;
  ownerToken?: string;
  ownerFeatures?: FeatureMap;
  whatsappTemplate?: string;
}) {
  const admin = !ownerToken;
  const can = (key: string) => admin || Boolean(ownerFeatures?.[key]);
  const code = getSavedCode();

  const [open, setOpen] = useState(embedded);
  const [busy, setBusy] = useState(false);
  const [deletedStock,setDeletedStock]=useState<Awaited<ReturnType<typeof stockAdminDeletedList>>|null>(null);
  const [items, setItems] = useState<StockItem[]>([]);
  const [stockTab, setStockTab] = useState<StockTab>(initialTab);
  const [q, setQ] = useState("");
  const [kindFilter,setKindFilter]=useState<"all"|"profile"|"complete">("all");
  const [familyFilter,setFamilyFilter]=useState("");
  const [availability,setAvailability]=useState<"all"|"ready"|"incomplete">("all");
  const [platformFilter, setPlatformFilter] = useState(initialPlatform);
  const [cyberdocOrders, setCyberdocOrders] = useState<CyberDocsOrder[]>([]);

  const [formOpen, setFormOpen] = useState(autoAdd);
  const [bulkMode, setBulkMode] = useState(false);
  const [splitOnSave, setSplitOnSave] = useState(false);
  const [profileCount, setProfileCount] = useState("5");
  const [bulkText, setBulkText] = useState("");
  const [form, setForm] = useState<StockItem>(blank());
  const [showPass, setShowPass] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  useEffect(() => { if (formOpen) setPanelOpen(Boolean(form.panelUrl || form.panelUsername || form.panelPassword)); }, [formOpen, form.id]);
  const formRef = useRef<HTMLDivElement | null>(null);

  const [toolsItem, setToolsItem] = useState<StockItem | null>(null);
  const [historyItem, setHistoryItem] = useState<StockItem | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const [deliver, setDeliver] = useState<StockItem | null>(null);
  const [deliveryResult, setDeliveryResult] = useState<{link:string; text:string; phone:string; item:StockItem; password:string; ficha:string} | null>(null);
  const [deliverClient, setDeliverClient] = useState("");
  const [registeredClients, setRegisteredClients] = useState<{id:string; name:string; whatsapp:string;email?:string;clientReference?:string;priceTier?:"retail"|"reseller"}[]>([]);
  const [deliverEmail,setDeliverEmail]=useState("");
  const [clientSearch,setClientSearch]=useState("");
  const [prices,setPrices]=useState<PriceRow[]>([]);
  const [clientChoice, setClientChoice] = useState("manual");
  const [clientLoadError, setClientLoadError] = useState(false);
  const deliveryOpen = Boolean(deliver);
  useEffect(() => {
    if (!deliveryOpen || !admin) return;
    let active = true;
    setClientChoice(initialClient?.id || "manual"); setClientSearch(""); setClientLoadError(false); setRegisteredClients(initialClient ? [initialClient] : []);
    void opsLoad({data:{code}}).then(result => { if (active) setRegisteredClients(result.records.filter(r => r.module === "clients" && r.status === "active" && (!r.data.shopId||r.data.shopId==="main")).map(r => ({id:r.id,name:r.title,whatsapp:r.data.whatsapp || "",email:r.data.email||"",clientReference:r.clientReference,priceTier:r.priceTier}))); }).catch(() => { if (active) setClientLoadError(true); });
    return () => { active = false; };
  }, [deliveryOpen, admin, code, initialClient]);
  const [deliverWhatsapp, setDeliverWhatsapp] = useState("");
  const [deliverStockExpires, setDeliverStockExpires] = useState("");
  const [deliverSalePrice, setDeliverSalePrice] = useState("");
  const [deliverOrderRef, setDeliverOrderRef] = useState("");
  useEffect(()=>{
    if(!admin || (!formOpen && !deliveryOpen))return;
    let active=true;
    void pricingLoad({data:{code}}).then(rows=>{if(active)setPrices(rows);}).catch(()=>{});
    return ()=>{active=false;};
  },[admin,formOpen,deliveryOpen,code]);
  const formPrice=prices.find(row=>row.key===pricingKey(form.platform,form.stockKind,form.durationMonths));
  useEffect(()=>{
    if(!formOpen || form.id || !formPrice)return;
    setForm(current=>({...current,cost:formPrice.costCents!=null?formPrice.costCents/100:current.cost,salePrice:formPrice.retailCents!=null?formPrice.retailCents/100:current.salePrice,provider:formPrice.provider||current.provider}));
  },[formOpen,form.id,formPrice]);
  const selectedClient=registeredClients.find(c=>c.id===clientChoice);
  const deliveryPrice=deliver && prices.find(row=>row.key===pricingKey(deliver.platform,deliver.stockKind,deliver.durationMonths));
  useEffect(()=>{
    if(!deliver || deliverOrderRef || !deliveryPrice)return;
    const cents=selectedClient?.priceTier==="reseller"?deliveryPrice.resellerCents:deliveryPrice.retailCents;
    if(cents!=null)setDeliverSalePrice(String(cents/100));
    else if(selectedClient?.priceTier==="reseller")setDeliverSalePrice("");
  },[deliver,deliverOrderRef,deliveryPrice,selectedClient?.priceTier,clientChoice]);
  const deliveryRequestId=useRef("");
  const [protect, setProtect] = useState(true);
  const [accessPassword, setAccessPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [days, setDays] = useState(7);
  const [views, setViews] = useState("0");
  const [message, setMessage] = useState(whatsappTemplate);
  const [deliveryImages, setDeliveryImages] = useState<string[]>([]);
  const [deliveryAttachment, setDeliveryAttachment] = useState<DeliveryAttachment | null>(null);
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

  const daysUntil = (value: string | null) => daysRemaining(value,businessToday());
  const availableIds=useMemo(()=>{const parents=new Set(items.map(x=>x.parentStockId));return new Set(items.filter(x=>x.status==="available"&&x.accountType!=="split_parent"&&!parents.has(x.id)&&(!x.expiresOn||x.expiresOn>=businessToday())&&Boolean(x.username&&x.password)).map(x=>x.id));},[items]);

  // Converted parents use expired as a non-sellable sentinel, not a validity date.
  const parentIds = useMemo(() => new Set(items.map(x => x.parentStockId).filter(Boolean)), [items]);
  const isContainer = (x: StockItem) => parentIds.has(x.id) || x.accountType === "split_parent";
  const isExpired = (x: StockItem) => (!isContainer(x) && x.status === "expired") || Boolean(x.expiresOn && x.expiresOn < businessToday());
  const availableUnits=items.filter(x=>x.status==="available"&&!isContainer(x)&&!isExpired(x));
  const needsReview = (x: StockItem) => x.status === "review" && !isExpired(x);
  const soldItems = items.filter((x) => !isContainer(x) && x.status !== "available" && x.status !== "review" && !isExpired(x));
  const renewalItems = useMemo(
    () => items.filter((x) => ["assigned", "expiring"].includes(x.status) && x.expiresOn && (daysUntil(x.expiresOn) ?? 999) <= 7),
    [items],
  );
  const expiredCount = items.filter(isExpired).length;

  const tabItems = useMemo(() => {
    let base = [...items];
    if (stockTab === "available") base = base.filter((x) => compact&&!initialClient?x.status==="available"&&!isContainer(x)&&!isExpired(x)&&(availability==="all"||(availability==="ready"?availableIds.has(x.id):!availableIds.has(x.id))):admin?availableIds.has(x.id):x.status==="available");
    if (stockTab === "sold") base = base.filter((x) => !isContainer(x) && x.status !== "available" && x.status !== "review" && !isExpired(x));
    if (stockTab === "review") base = base.filter(needsReview);
    if (stockTab === "expiring")
      base = base.filter((x) => ["assigned", "expiring"].includes(x.status) && x.expiresOn && (daysUntil(x.expiresOn) ?? 999) <= 7 && (daysUntil(x.expiresOn) ?? -1) >= 0);
    if (stockTab === "expired")
      base = base.filter(isExpired);
    const needle = q.trim().toLowerCase();
    return base
      .filter((x) => !platformFilter || stockPlatform(x.platform).key === platformFilter.key)
      .filter(x=>kindFilter==="all"||x.stockKind===kindFilter)
      .filter(x=>!familyFilter||platformFamily(x.platform)===familyFilter)
      .filter((x) => !needle || `${x.platform} ${stockPlatform(x.platform).label} ${x.username} ${x.clientName} ${x.clientWhatsapp} ${x.expiresOn || ""}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const ad = a.expiresOn ? new Date(a.expiresOn).getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b.expiresOn ? new Date(b.expiresOn).getTime() : Number.MAX_SAFE_INTEGER;
        if (stockTab === "expired") return (b.expiresOn || "").localeCompare(a.expiresOn || "") || b.createdAt.localeCompare(a.createdAt);
        return stockTab === "expiring" ? ad - bd : b.createdAt.localeCompare(a.createdAt);
      });
  }, [items, stockTab, q, admin, availableIds, platformFilter,kindFilter,familyFilter,availability,compact,initialClient]);

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
    const splitting = !bulkMode && form.stockKind === "complete" && form.status === "available" && splitOnSave;
    const count = Number(profileCount);
    if (splitting && (!can("stock_edit") || !can("stock_add"))) return toast.error("Necesitas permiso para agregar y editar stock");
    if (splitting && (!Number.isInteger(count) || count < 1 || count > 10)) return toast.error("Indica entre 1 y 10 perfiles");
    if (!window.confirm(splitting ? `¿Guardar esta cuenta y convertirla en ${count} perfiles?` : "¿Está seguro de guardar estos cambios?")) return;
    setBusy(true);
    try {
      const saved = await persist({ ...form, stockKind: form.stockKind || "complete", accountType: form.stockKind === "profile" ? "Perfil" : "Completa" }, "");
      // If conversion fails, keep the saved id so retrying cannot insert the complete again.
      setForm(saved);
      if (splitting) await splitAccount(saved.id, count);
      if (splitting || saved.status === "available") setStockTab("available");
      setQ(""); setSplitOnSave(false);
      await load();
      toast.success(splitting ? `${count} perfiles creados` : "Registro guardado");
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
    if (!window.confirm(`¿Está seguro de guardar ${lines.length} registro(s) de stock?`)) return;
    setBusy(true);
    try {
      for (const line of lines) {
        const [username = "", password = "", profilePin = ""] = line.split("|").map((x) => x.trim());
        // En modo lote nunca reutilizar credenciales capturadas previamente en modo individual.
        await persist({ ...form, id: "", stockKind: form.stockKind, accountType: form.stockKind === "profile" ? "Perfil" : "Completa", parentStockId: null, username, password, profilePin, clientName: "", clientWhatsapp: "", deliveredOn: null, relatedOrderId: "", renewalStatus: "", renewalNotifiedAt: null }, "");
      }
      setStockTab("available"); setQ("");
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

  async function splitAccount(id: string, count: number) {
    return ownerToken
      ? stockOwnerConvertProfiles({ data: { token: ownerToken, id, count } })
      : stockAdminConvertProfiles({ data: { code: getSavedCode(), id, count } });
  }

  async function convertToProfiles(x: StockItem) {
    if (busy || x.stockKind === "profile" || x.status !== "available") return;
    if (!can("stock_edit") || !can("stock_add")) return toast.error("Necesitas permiso para agregar y editar stock");
    const raw = window.prompt("¿Cuántos perfiles quieres sacar de esta cuenta completa?", "5");
    if (raw === null) return;
    const count = Number(raw);
    if (!Number.isInteger(count) || count < 1 || count > 10) return toast.error("Indica entre 1 y 10 perfiles");
    if (!window.confirm(`Se crearán ${count} perfiles y la completa dejará de estar disponible. ¿Continuar?`)) return;
    setBusy(true);
    try {
      await splitAccount(x.id, count);
      await load(); setToolsItem(null); setStockTab("available"); setQ("");
      toast.success(`${count} perfiles creados`);
    } catch(e) { toast.error(err(e)); } finally { setBusy(false); }
  }

  async function revertToComplete(x: StockItem) {
    if (busy) return;
    if (!can("stock_edit")) return toast.error("No tienes permiso para editar stock");
    let plan: ReturnType<typeof stockRevertPlan>;
    try { plan = stockRevertPlan(items, x); } catch(e) { toast.error(err(e)); return; }
    if (plan.children.length && !can("stock_delete")) return toast.error("No tienes permiso para retirar los perfiles derivados");
    const message = plan.children.length ? "Se retirarán los perfiles disponibles y se restaurará la cuenta completa original. ¿Continuar?" : "Este registro pasará de Perfiles a Completas conservando sus datos. ¿Continuar?";
    if (!window.confirm(message)) return;
    setBusy(true);
    try {
      for (const child of plan.children) ownerToken ? await stockOwnerDelete({data:{token:ownerToken,id:child.id}}) : await stockAdminDelete({data:{code:getSavedCode(),id:child.id}});
      await persist(plan.item, ""); await load(); setToolsItem(null); toast.success("Cuenta restaurada en Completas");
    } catch(e) { toast.error(err(e)); } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!can("stock_delete")) return toast.error("No tienes permiso para eliminar stock");
    if (!confirm("¿Eliminar este registro de stock?")) return;
    if (busy) return;
    const deleted = items.find(x => x.id === id);
    setBusy(true);
    try {
      const adminCode = getSavedCode();
      ownerToken ? await stockOwnerDelete({ data: { token: ownerToken, id } }) : await stockAdminDelete({ data: { code: adminCode, id } });
      setItems((p) => p.filter((x) => x.id !== id));
      await load();
      setToolsItem(null);
      setForm(blank()); setSplitOnSave(false);
      toast.success("Registro eliminado. Puedes volver a agregarlo.", deleted && deleted.status === "available" && can("stock_add") ? {
        action: { label: "Agregar de nuevo", onClick: () => {
          setForm({ ...deleted, id: "", status: "available", clientName: "", clientWhatsapp: "", deliveredOn: null, relatedOrderId: "", protectedDeliveryId: "", renewalStatus: "", renewalNotifiedAt: null });
          setBulkMode(false); setSplitOnSave(false); setFormOpen(true);
        } },
      } : undefined);
    } catch (e) {
      toast.error(err(e));
    } finally { setBusy(false); }
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

  async function copyProtectedLink(x: StockItem, withMessage = false) {
    try {
      const result = ownerToken
        ? await stockOwnerProtectedLink({ data: { token: ownerToken, id: x.id } })
        : await stockAdminProtectedLink({ data: { code, id: x.id } });
      const link = `${window.location.origin}/e/${result.id}?t=${encodeURIComponent(result.token)}`;
      const reference=withMessage&&admin?await stockAdminClientReference({data:{code,id:x.id}}):"";
      await copyText(withMessage ? (message || whatsappTemplate).replaceAll("{cliente}", x.clientName || "cliente").replaceAll("{plataforma}", x.platform).replaceAll("{usuario}", x.username).replaceAll("{vigencia}", x.expiresOn || "").replaceAll("{link}", link) + ((message || whatsappTemplate).includes("{link}") ? "" : "\n🔗 " + link)+transferReferenceMessage(reference) : link);
      toast.success(withMessage ? "Mensaje con link copiado" : "Enlace protegido copiado");
    } catch (e) {
      toast.error(err(e));
    }
  }

  async function copyFullAccess(x: StockItem, whatsapp = false) {
    const body = [
      `${x.platform}`,
      x.username ? `✉️ Correo: ${x.username}` : "",
      x.password ? `🔑 Contraseña: ${x.password}` : "",
      x.profilePin ? `👤 Perfil / PIN: ${x.profilePin}` : "",
      x.panelUrl ? `🔗 Link: ${x.panelUrl}` : "",
      x.panelUsername ? `👤 Usuario: ${x.panelUsername}` : "",
      x.panelPassword ? `🔑 Contraseña: ${x.panelPassword}` : "",
    ].filter(Boolean).join("\n");
    const reference=whatsapp&&admin?await stockAdminClientReference({data:{code,id:x.id}}).catch(()=>""):"";
    await copyText(whatsapp ? `Hola ${x.clientName || ""}, aquí tienes tu acceso:\n\n${body}${x.expiresOn ? "\n📅 Vence: " + x.expiresOn : ""}`+transferReferenceMessage(reference) : body);
    toast.success(whatsapp ? "Mensaje para WhatsApp copiado" : "Acceso completo copiado");
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
    await resolveReview(x, "nonrenewal");
  }

  async function resolveReview(x: StockItem, action: "nonrenewal" | "release" | "expire") {
    if (busy || !can("stock_edit")) return;
    let expiresOn: string | undefined;
    if (action === "release") {
      if (!confirm("¿Confirmas que la cuenta funciona y que retiraste el acceso del cliente anterior en la plataforma?")) return;
      expiresOn = window.prompt("Fecha real de vigencia de la cuenta (AAAA-MM-DD):", x.expiresOn || "") || undefined;
      if (!expiresOn) return;
    }
    if (action === "expire" && !confirm("¿Marcar esta cuenta como vencida?")) return;
    setBusy(true);
    try {
      const payload = { id: x.id, version: x.updatedAt, action, expiresOn };
      const result = ownerToken ? await stockOwnerReview({data:{token:ownerToken,...payload}}) : await stockAdminReview({data:{code:getSavedCode(),...payload}});
      await load();
      setToolsItem(null);
      setStockTab(result.status === "available" ? "available" : result.status === "review" ? "review" : "expired");
      toast.success(result.status === "available" ? "Cuenta disponible para volver a vender" : result.status === "review" ? "Cuenta enviada a Validar cuenta" : "Cuenta enviada a Vencidas");
    } catch (e) {
      toast.error(err(e));
    } finally { setBusy(false); }
  }

  function openManualDelivery(item: StockItem) {
    if (busy || item.status !== "available" || !can("stock_assign") || (admin&&!availableIds.has(item.id))) return;
    setDeliver(item);
    deliveryRequestId.current=crypto.randomUUID();
    setDeliveryImages([]);
    setDeliveryAttachment(null);
    setDeliverClient(initialClient?.name || "");
    setDeliverWhatsapp(initialClient?.whatsapp || "");
    setDeliverEmail(initialClient?.email||"");
    setClientChoice(initialClient?.id || "manual");
    setDeliverStockExpires(item.expiresOn || expiresAfterMonths(businessToday(), item.durationMonths || 1));
    setDeliverSalePrice(item.salePrice ? String(item.salePrice) : "");
    setDeliverOrderRef("");
    setToolsItem(null);
  }

  async function send() {
    if (!deliver) return;
    if (!can("stock_assign")) return toast.error("No tienes permiso para entregar stock");
    if (!validWhatsApp(deliverWhatsapp)) return toast.error("Escribe un número de WhatsApp válido con lada");
    if(admin&&!deliverOrderRef&&deliverEmail.trim()&&!validClientEmail(deliverEmail))return toast.error("Revisa el correo electrónico.");
    if (protect && (accessPassword.length < 4 || accessPassword !== confirmPassword)) return toast.error("Revisa la contraseña de protección");
    const incomplete = !validFullName(deliverClient) || (admin && !deliverEmail.trim());
    if (incomplete && !confirm("Faltan datos del cliente (nombre completo o correo). ¿Confirmas que deseas guardar la asignación con los datos disponibles?")) return;
    if(admin&&!deliverOrderRef){const price=Number(deliverSalePrice);if(!Number.isFinite(price)||price<0)return toast.error("Escribe un precio de venta válido.");if(!confirm(`¿Asignar esta cuenta por $${price.toFixed(2)}? El saldo de la tienda no se modificará.`))return;}
    setBusy(true);
    try {
      const payload = {
        itemId: deliver.id, clientId: admin && clientChoice !== "manual" && !deliverOrderRef ? clientChoice : undefined, clientName: deliverClient.trim() || (admin ? "" : phoneNumber(deliverWhatsapp)), clientWhatsapp: phoneNumber(deliverWhatsapp), clientEmail:deliverEmail.trim(), acceptIncomplete: incomplete,
        stockExpiresOn: deliverStockExpires || null, salePrice: Number(deliverSalePrice) || 0,
        relatedOrderId: deliverOrderRef.trim(), accessPassword: protect ? accessPassword : "",
        expiresAt: iso(Math.max(1, days)), maxViews: Number(views) > 0 ? Number(views) : null, notes: deliver.notes, attachment: deliveryAttachment, images: deliveryImages,
      };
      const res = ownerToken ? await stockOwnerDeliver({ data: { token: ownerToken, ...payload } }) : await stockAdminDeliver({ data: { code, ...payload, requestId:deliveryRequestId.current } });
      if ("completionError" in res && res.completionError) toast.warning(String(res.completionError));
      const link = `${window.location.origin}/e/${res.id}?t=${encodeURIComponent(res.token)}`;
      const ficha = renderDeliveryFicha(getPrimaryFichaTemplate(), { platform: deliver.platform, username: deliver.username, password: deliver.password, profilePin: deliver.profilePin, panelUrl: deliver.panelUrl, panelUsername: deliver.panelUsername, panelPassword: deliver.panelPassword });
      if (ficha) { toast.success("Ficha de entrega preparada"); }
      const reference="clientReference" in res?String(res.clientReference||""):"";
      const platformText = (message || whatsappTemplate)
        .replaceAll("{cliente}", res.client || deliverClient || "cliente").replaceAll("{plataforma}", deliver.platform)
        .replaceAll("{usuario}", deliver.username).replaceAll("{vigencia}", `${days} día(s)`).replaceAll("{link}", link)+transferReferenceMessage(reference);
      setDeliveryResult({ link, text: platformText, phone: deliverWhatsapp.replace(/\D/g, ""), item: deliver, password: protect ? accessPassword : "", ficha: ficha || "" });
      toast.success("Entrega registrada");
      setDeliver(null); setAccessPassword(""); setConfirmPassword(""); setDeliverSalePrice(""); setDeliverOrderRef(""); setDeliveryAttachment(null); setProtect(true);
      await load();
    } catch (e) { toast.error(err(e)); } finally { setBusy(false); }
  }

  const statusDot = (x: StockItem) => {
    if (isExpired(x)) return "bg-red-500";
    if (isContainer(x)) return "bg-sky-500";
    if (x.status === "review") return "bg-amber-500";
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
    if (tab === "all") return items.length;
    if (tab === "available") return admin?availableIds.size:items.filter((x) => x.status === "available").length;
    if (tab === "sold") return soldItems.length;
    if (tab === "expiring") return renewalItems.filter((x) => (daysUntil(x.expiresOn) ?? -1) >= 0).length;
    if (tab === "review") return items.filter(needsReview).length;
    return expiredCount;
  };

  return (
    <ToolFrame embedded={embedded} open={open} onOpenChange={setOpen} trigger={<Button variant="outline" size="sm" className="rounded-xl"><Warehouse className="mr-1.5 size-4" />Gestor</Button>} className="max-h-[94vh] w-[calc(100vw-0.75rem)] max-w-6xl overflow-y-auto rounded-3xl">
        {!embedded && <DialogHeader>
          <DialogTitle>Inventario</DialogTitle>
          <DialogDescription className="sr-only">Cuentas y perfiles del inventario.</DialogDescription>
        </DialogHeader>}
        {initialClient && <p className="text-sm font-semibold">Asignar cuenta a {initialClient.name}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Input className="min-w-32 flex-1" value={q} onChange={(event) => setQ(event.target.value)}
            aria-label="Buscar en inventario" placeholder="Buscar plataforma o cliente" />
          {can("stock_add") && <Button size="sm" onClick={() => {
            setForm(blank()); setSplitOnSave(false); setBulkMode(false); setFormOpen(true);
          }}><Plus className="size-4" />Agregar stock</Button>}
        </div>
        {platformFilter && <div className="flex flex-wrap items-center gap-2">
          <span className="seller-badge">{platformFilter.platform}</span>
          <Button size="sm" variant="ghost" onClick={() => setPlatformFilter(null)}>Quitar filtro</Button>
        </div>}
        {compact&&<><p className="text-sm text-muted-foreground">{availableIds.size} listas para vender · {availableUnits.length-availableIds.size} incompletas</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><label className="seller-field"><span>Plataforma</span><select className="buyer-select" value={familyFilter} onChange={e=>setFamilyFilter(e.target.value)}><option value="">Todas</option>{groupPlatforms(availableUnits,x=>x.platform).sort((a,b)=>a.name.localeCompare(b.name,"es")).map(group=><option key={group.name}>{group.name}</option>)}</select></label><label className="seller-field"><span>Tipo de cuenta</span><select className="buyer-select" value={kindFilter} onChange={e=>setKindFilter(e.target.value as typeof kindFilter)}><option value="all">Todos</option><option value="profile">Perfiles</option><option value="complete">Cuentas completas</option></select></label>{!initialClient&&<label className="seller-field"><span>Disponibilidad</span><select className="buyer-select" value={availability} onChange={e=>setAvailability(e.target.value as typeof availability)}><option value="all">Todas</option><option value="ready">Listas para vender</option><option value="incomplete">Datos incompletos</option></select></label>}</div></>}
        <details className="seller-disclosure">
          <summary className="text-sm font-medium">Opciones de inventario</summary>
          <div className="seller-disclosure-body flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => void load()} disabled={busy}><RefreshCw />Actualizar</Button>
            {can("stock_export") && <Button size="sm" variant="ghost" onClick={exportBackup}><Download />Exportar respaldo</Button>}
            {admin && <Button size="sm" variant="ghost" disabled={busy} onClick={async () => {
              try { setDeletedStock(await stockAdminDeletedList({ data: { code: getSavedCode() } })); }
              catch (error) { toast.error(err(error)); }
            }}><History />Papelera de inventario</Button>}
          </div>
        </details>
        {deletedStock && <section className="rounded-2xl border p-3 space-y-3">
          <div className="flex items-center justify-between"><h3 className="font-semibold">Papelera de inventario</h3><Button size="sm" variant="ghost" onClick={()=>setDeletedStock(null)}>Cerrar</Button></div>
          {deletedStock.length===0 && <p className="text-sm text-muted-foreground">No hay cuentas eliminadas para recuperar.</p>}
          {deletedStock.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
            <div><p className="font-medium">{item.platform}</p><p className="text-xs text-muted-foreground">{new Date(item.deleted_at).toLocaleString("es-MX")}</p></div>
            <Button size="sm" disabled={busy} onClick={async()=>{
              if(!confirm("¿Recuperar esta cuenta y sus perfiles vinculados?")) return;
              setBusy(true);
              try {
                const count=await stockAdminRestoreDeleted({data:{code:getSavedCode(),id:item.id}});
                setDeletedStock(await stockAdminDeletedList({data:{code:getSavedCode()}}));
                await load();
                toast.success(`${count} registro(s) recuperados`);
              } catch(e){toast.error(err(e));} finally {setBusy(false);}
            }}>Restaurar</Button>
          </div>)}
        </section>}

          <div className="grid gap-3">
            {!compact && <div className="seller-tabs !m-0" aria-label="Estado del inventario">
              {([
                ["all", "Todos"],
                ["available", "Disponibles"],
                ["sold", "Vendidas"],
                ["expiring", "Por vencer"],
                ["review", "Validar cuenta"],
                ["expired", "Vencidas / bajas"],
              ] as [StockTab, string][]).map(([key, label]) => <button key={key} type="button" className={stockTab === key ? "active" : ""} aria-pressed={stockTab === key} onClick={() => setStockTab(key)}>{label} ({countTab(key)})</button>)}
            </div>}

            {busy ? <Loader2 className="mx-auto size-5 animate-spin" /> : null}
            <div className="overflow-hidden rounded-2xl border">
              {groupPlatforms(tabItems,x=>x.platform).sort((a,b)=>a.name.localeCompare(b.name,"es")).map(group=><details key={group.name} className="seller-disclosure !rounded-none !border-x-0 !border-t-0" open={initialClient?true:undefined}>
                <summary><StockPlatformMark name={group.name}/><span className="min-w-0 flex-1 font-semibold">{group.name}</span><span className="text-xs text-muted-foreground">{group.items.filter(x=>x.stockKind==="complete").length} completas · {group.items.filter(x=>x.stockKind==="profile").length} perfiles</span></summary>
                <div className="seller-disclosure-body">{group.items.map((x) => {
                const d = daysUntil(x.expiresOn);
                const statusText = isExpired(x) ? "Caducada" : isContainer(x) ? "Dividida en perfiles · vigente" : x.status==="available"&&admin&&!availableIds.has(x.id)?"Datos incompletos":x.status === "review" ? "Validar cuenta" : ["assigned", "expiring"].includes(x.status) && d !== null && d <= 7 && d >= 0 ? `Por vencer · ${d === 0 ? "hoy" : `${d}d`}` : STOCK_STATUS_LABELS[x.status];
                const platform = <><StockPlatformMark name={stockPlatform(x.platform).label} /><span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{stockPlatform(x.platform).label}</span>
                  {x.accountType && <span className="block truncate text-xs text-muted-foreground">{x.accountType}</span>}
                </span></>;
                const status = <span className="flex shrink-0 items-center gap-1.5 text-xs">
                  <span className={`size-2 shrink-0 rounded-full ${statusDot(x)}`} />{statusText}
                </span>;
                if (initialClient && x.status === "available" && can("stock_assign")) {
                  return <div key={x.id} className="flex items-center gap-2 border-b px-3 py-2 last:border-b-0">
                    {platform}{status}
                    <Button size="sm" disabled={busy} onClick={() => openManualDelivery(x)}>Asignar</Button>
                  </div>;
                }
                return (
                  <details key={x.id} className="seller-disclosure !rounded-none !border-x-0 !border-t-0 last:!border-b-0">
                    <summary>{platform}{status}</summary>
                    <div className="seller-disclosure-body flex flex-wrap gap-2">
                      {x.status === "available" && availableIds.has(x.id) && can("stock_assign") && <Button size="sm" disabled={busy} onClick={()=>openManualDelivery(x)}>Asignar</Button>}
                      {x.status === "review" && can("stock_edit") && <>
                        {!isExpired(x) && <Button size="sm" disabled={busy} onClick={() => void resolveReview(x,"release")}>Funciona · Liberar</Button>}
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void resolveReview(x,"expire")}>Caducada</Button>
                      </>}
                      {can("stock_edit") && <Button size="sm" variant="outline" onClick={() => {
                        setForm({ ...x }); setBulkMode(false); setSplitOnSave(false); setFormOpen(true);
                      }}><Pencil />Editar</Button>}
                      <Button size="sm" variant="ghost" onClick={() => setToolsItem(x)}>
                        <Settings2 />Detalles y acciones
                      </Button>
                    </div>
                  </details>
                );
              })}</div></details>)}
              {!tabItems.length ? <p className="p-6 text-center text-sm text-muted-foreground">No hay registros en esta subpestaña.</p> : null}
            </div>
          </div>

        <Dialog open={formOpen} onOpenChange={(value) => { setFormOpen(value); if (!value) { setForm(blank()); setBulkMode(false); setSplitOnSave(false); } }}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader><DialogTitle>{form.id ? "Editar cuenta" : "Agregar stock"}</DialogTitle><DialogDescription>{form.id ? "Edita todos los datos del registro." : "Aquí solo capturas datos del stock. Cliente y entrega se solicitan únicamente al vender."}</DialogDescription></DialogHeader>
            {!form.id ? <div className="flex gap-2"><Button size="sm" variant={!bulkMode ? "default" : "outline"} onClick={() => { setBulkMode(false); setBulkText(""); }}>Agregar individual</Button><Button size="sm" variant={bulkMode ? "default" : "outline"} onClick={() => { setBulkMode(true); setSplitOnSave(false); setForm((current) => ({ ...current, username: "", password: "", profilePin: "" })); }}>Agregar por lote</Button></div> : null}
            <div ref={formRef} className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Plataforma y plan</Label>
                <Select value={selectedPlatform(form)} onValueChange={value=>setForm(current=>{
                  const option = options.find(item=>item.id===value);
                  if (!option) return {...current,platform:""};
                  const stockKind = current.id || splitOnSave ? current.stockKind : option.kind || current.stockKind;
                  return {...current,platform:option.platform,durationMonths:option.months||current.durationMonths,
                    stockKind,accountType: stockKind===current.stockKind ? current.accountType : stockKind==="profile"?"Perfil":"Completa"};
                })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {platformOptions.map(group=><SelectGroup key={group.label}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {group.options.map(option=><SelectItem key={option.id} value={option.id}
                        disabled={Boolean(form.id && option.kind && option.kind!==form.stockKind)}>{option.label}</SelectItem>)}
                    </SelectGroup>)}
                    <SelectItem value="manual">Otra plataforma (manual)</SelectItem>
                  </SelectContent>
                </Select>
                {selectedPlatform(form)==="manual" && <Input className="mt-2" value={form.platform}
                  onChange={e=>setForm({...form,platform:e.target.value})} placeholder="Nombre exacto del servicio" />}
              </div>
              <div><Label>Tipo de stock</Label><Select value={splitOnSave?"split":form.stockKind} disabled={Boolean(form.id)} onValueChange={v=>{setSplitOnSave(v==="split");if(v==="split")setBulkMode(false);setForm({...form,stockKind:v==="profile"?"profile":"complete",accountType:v==="profile"?"Perfil":"Completa"});}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="complete">Cuenta completa para vender</SelectItem>{!bulkMode&&can("stock_edit")&&can("stock_add")&&<SelectItem value="split">Cuenta completa para dividir en perfiles</SelectItem>}<SelectItem value="profile">Perfil individual ya separado</SelectItem></SelectContent></Select></div>
              {!bulkMode ? <div><Label>Usuario / correo</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div> : null}
              {!bulkMode ? <div><Label>Contraseña</Label><div className="relative"><Input type={showPass && can("stock_view_password") ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="pr-10" /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 size-8 -translate-y-1/2" onClick={() => setShowPass((v) => !v)}>{showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button></div></div> : null}
              {!bulkMode ? <div><Label>Perfil / PIN</Label><Input value={form.profilePin} onChange={(e) => setForm({ ...form, profilePin: e.target.value })} /></div> : null}
              <div><Label>Proveedor</Label><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></div>
              <div className="sm:col-span-3 space-y-3"><Button type="button" variant="outline" className="w-full justify-between" aria-expanded={panelOpen} onClick={() => setPanelOpen(v => !v)}><span>＋ Agregar panel</span><span>{panelOpen ? "⌃" : "⌄"}</span></Button>{panelOpen ? <div className="grid gap-3 rounded-xl border p-3 sm:grid-cols-3"><div><Label>🔗 Link</Label><Input value={form.panelUrl} onChange={(e) => setForm({ ...form, panelUrl: e.target.value })} /></div><div><Label>👤 Usuario</Label><Input value={form.panelUsername} onChange={(e) => setForm({ ...form, panelUsername: e.target.value })} /></div><div><Label>🔑 Contraseña</Label><Input type={showPass && can("stock_view_password") ? "text" : "password"} value={form.panelPassword} onChange={(e) => setForm({ ...form, panelPassword: e.target.value })} /></div></div> : null}</div>
              <div><Label>Costo</Label><Input type="number" min={0} step="0.01" value={form.cost || ""} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) || 0 })} /></div>
              <div><Label>Precio de venta</Label><Input type="number" min={0} step="0.01" value={form.salePrice || ""} onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) || 0 })} /></div>
              {admin&&formPrice&&<p className="sm:col-span-3 text-xs text-muted-foreground">Tarifas guardadas · Público: {formPrice.retailCents==null?"Sin precio":`$${formPrice.retailCents/100}`} · Revendedor: {formPrice.resellerCents==null?"Sin precio":`$${formPrice.resellerCents/100}`}</p>}
              <div><Label>Fecha de compra</Label><Input type="date" value={form.acquiredOn || ""} onChange={(e) => setForm({ ...form, acquiredOn: e.target.value || null })} /></div>
              <div className="sm:col-span-3 rounded-2xl border bg-muted/20 p-3 space-y-3"><Label>¿De cuánto tiempo es la cuenta?</Label><div className="flex flex-wrap gap-2">{[1,2,3,6,12].map(months=><Button key={months} type="button" size="sm" variant={(form.durationMonths||1)===months?"default":"outline"} onClick={()=>setForm({...form,durationMonths:months})}>{months===12?"1 año":`${months} ${months===1?"mes":"meses"}`}</Button>)}</div><label className="flex items-center justify-between gap-3 text-sm"><span>Contar la vigencia desde la venta</span><Switch checked={form.startsOnSale!==false} onCheckedChange={v=>setForm({...form,startsOnSale:v})}/></label><p className="text-xs text-muted-foreground">{form.startsOnSale!==false?"Al entregar, se propondrá el vencimiento automáticamente. Puedes ajustarlo antes de confirmar.":"Si no indicas un vencimiento base, se calcula desde la fecha de compra."}</p></div><div><Label>Vencimiento base</Label><Input type="date" value={form.expiresOn || ""} onChange={(e) => setForm({ ...form, expiresOn: e.target.value || null })} /></div>
              {form.id && form.status !== "available" ? <><div><Label>Cliente</Label><Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} /></div><div><Label>WhatsApp</Label><Input value={form.clientWhatsapp} onChange={(e) => setForm({ ...form, clientWhatsapp: e.target.value })} /></div><div><Label>Pedido relacionado</Label><Input value={form.relatedOrderId} onChange={(e) => setForm({ ...form, relatedOrderId: e.target.value })} /></div></> : null}
              <div className="sm:col-span-3"><Label>Notas privadas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              {bulkMode ? <div className="sm:col-span-3"><Label>Cuentas del lote</Label><Textarea rows={7} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={'correo1@ejemplo.com | contraseña1 | PIN1\ncorreo2@ejemplo.com | contraseña2 | PIN2'} /><p className="mt-1 text-[11px] text-muted-foreground">Una cuenta por renglón: correo/usuario | contraseña | PIN. Las completas se revisan por plataforma y correo. Los perfiles pueden compartir correo.</p></div> : null}
            </div>
            {!bulkMode && form.stockKind === "complete" && form.status === "available" && can("stock_add") && can("stock_edit") && splitOnSave ? (
              <div className="space-y-3 rounded-xl border p-3">
                {splitOnSave ? <div><Label>Cantidad de perfiles (1 a 10)</Label><Input type="number" min={1} max={10} step={1} value={profileCount} onChange={e => setProfileCount(e.target.value)} /><p className="mt-2 text-xs text-muted-foreground">Los perfiles conservarán el correo, contraseña, panel y vigencia. La completa quedará fuera de Disponibles.</p></div> : null}
              </div>
            ) : null}
            <div className="flex gap-2"><Button onClick={() => void (bulkMode ? saveBulk() : save())} disabled={busy}><Plus className="mr-1 size-4" />{!bulkMode && form.stockKind === "complete" && splitOnSave ? "Guardar y convertir a perfiles" : form.id ? "Guardar cambios" : bulkMode ? "Agregar lote" : form.stockKind === "profile" ? "Agregar perfil" : "Agregar cuenta completa"}</Button><Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button></div>
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
                {items.some(item => item.parentStockId === toolsItem.id) && <p>Cuenta dividida en perfiles. Cada perfil tiene su propia disponibilidad.</p>}
                {toolsItem.expiresOn ? <p><b>Vence:</b> {toolsItem.expiresOn}</p> : null}
                {toolsItem.renewalStatus ? <p><b>Renovación:</b> {toolsItem.renewalStatus}</p> : null}
                {toolsItem.renewalNotifiedAt ? <p><b>Último aviso:</b> {new Date(toolsItem.renewalNotifiedAt).toLocaleString("es-MX")}</p> : null}
                {toolsItem.cost ? <p><b>Costo:</b> ${toolsItem.cost.toFixed(2)}</p> : null}
                {toolsItem.salePrice ? <p><b>Venta:</b> ${toolsItem.salePrice.toFixed(2)}</p> : null}
                {toolsItem.cost || toolsItem.salePrice ? <p><b>Ganancia:</b> ${(toolsItem.salePrice - toolsItem.cost).toFixed(2)}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {toolsItem.profilePin ? <Button size="sm" variant="outline" onClick={() => void copyValue("PIN", toolsItem.profilePin)}><Copy className="mr-1 size-3.5" />PIN</Button> : null}
                {toolsItem.panelUrl ? <Button size="sm" variant="outline" onClick={() => void copyValue("Link del panel", toolsItem.panelUrl)}><Copy className="mr-1 size-3.5" />Panel</Button> : null}
                {toolsItem.panelUsername ? <Button size="sm" variant="outline" onClick={() => void copyValue("Usuario del panel", toolsItem.panelUsername)}><Copy className="mr-1 size-3.5" />Usuario panel</Button> : null}
                {can("stock_view_password") && toolsItem.panelPassword ? <Button size="sm" variant="outline" onClick={() => void copyValue("Contraseña del panel", toolsItem.panelPassword)}><Copy className="mr-1 size-3.5" />Clave panel</Button> : null}
                {can("stock_view_password") ? <Button size="sm" variant="outline" onClick={() => void copyFullAccess(toolsItem)}><Copy className="mr-1 size-3.5" />Copiar credenciales</Button> : null}
                {can("stock_view_password") ? <Button size="sm" variant="outline" onClick={() => void copyFullAccess(toolsItem, true)}><MessageCircle className="mr-1 size-3.5" />Copiar mensaje para WhatsApp</Button> : null}
                {toolsItem.protectedDeliveryId ? <Button size="sm" variant="outline" onClick={() => void copyProtectedLink(toolsItem, true)}><Copy className="mr-1 size-3.5" />Copiar mensaje con link</Button> : null}
                {toolsItem.protectedDeliveryId ? <Button size="sm" variant="outline" onClick={() => void copyProtectedLink(toolsItem)}><Copy className="mr-1 size-3.5" />Documento protegido</Button> : null}
                {can("stock_edit") ? <Button size="sm" variant="outline" onClick={() => { setForm({ ...toolsItem }); setBulkMode(false); setSplitOnSave(false); setFormOpen(true); setToolsItem(null); }}><Pencil className="mr-1 size-3.5" />Editar datos</Button> : null}
                {can("stock_edit") && can("stock_add") && toolsItem.stockKind !== "profile" && toolsItem.status === "available" ? <Button size="sm" variant="outline" onClick={() => void convertToProfiles(toolsItem)}>Convertir a perfiles</Button> : null}
                {can("stock_edit") && toolsItem.stockKind === "profile" ? <Button size="sm" variant="outline" onClick={() => void revertToComplete(toolsItem)}>Revertir a completa</Button> : null}
                {can("stock_assign") && toolsItem.status === "available" && (!admin||availableIds.has(toolsItem.id)) ? <Button size="sm" variant="outline" onClick={() => openManualDelivery(toolsItem)}><PackageCheck className="mr-1 size-3.5" />Entrega manual</Button> : null}
                <Button size="sm" variant="outline" onClick={() => void openHistory(toolsItem)}><History className="mr-1 size-3.5" />Ver historial</Button>
                {["assigned","expiring","expired"].includes(toolsItem.status) && (toolsItem.clientName || toolsItem.deliveredOn) && can("stock_edit") ? <><Button size="sm" onClick={() => void informClient(toolsItem)}><BellRing className="mr-1 size-3.5" />Informar al cliente</Button><Button size="sm" variant="outline" onClick={() => void setRenewalStatus(toolsItem, "Quiere renovar")}>Quiere renovar</Button><Button size="sm" variant="outline" onClick={() => void renew(toolsItem)}>Renovar</Button><Button size="sm" variant="outline" onClick={() => void noRenew(toolsItem)}>No renovó</Button></> : null}
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
                {admin ? <div className="sm:col-span-2"><Label>Buscar cliente registrado</Label><Input placeholder="Nombre, WhatsApp o referencia" value={clientSearch} disabled={Boolean(deliverOrderRef)} onChange={e=>setClientSearch(e.target.value)}/><Select value={clientChoice} disabled={Boolean(deliverOrderRef)} onValueChange={value => { setClientChoice(value); const client = registeredClients.find(c => c.id === value); if (client) { setDeliverClient(client.name); setDeliverWhatsapp(client.whatsapp); setDeliverEmail(client.email||""); } }}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="manual">Capturar cliente manualmente</SelectItem>{registeredClients.filter(c=>c.id===clientChoice||!clientSearch.trim()||`${c.name} ${c.whatsapp} ${c.clientReference||""}`.toLowerCase().includes(clientSearch.toLowerCase())).map(c => <SelectItem key={c.id} value={c.id}>{c.name} · {c.whatsapp}{c.clientReference?` · ${c.clientReference}`:""}</SelectItem>)}</SelectContent></Select>{clientLoadError ? <p className="text-xs text-muted-foreground">No se pudo cargar el registro. Puedes capturar los datos manualmente.</p> : null}</div> : null}
                <div><Label>Nombre (opcional)</Label><Input value={deliverClient} disabled={admin && Boolean(deliverOrderRef)} onChange={(e) => { setDeliverClient(e.target.value); }} /></div>
                {admin&&!deliverOrderRef&&<div className="sm:col-span-2"><Label>Correo electrónico (opcional)</Label><Input type="email" autoComplete="email" value={deliverEmail} onChange={e=>setDeliverEmail(e.target.value)} placeholder="cliente@correo.com"/>{selectedClient?.clientReference&&<p className="text-xs text-muted-foreground">Referencia: {selectedClient.clientReference}</p>}</div>}
                <div><Label>WhatsApp (obligatorio)</Label><ContactPhoneInput value={deliverWhatsapp} onChange={value=>{
                  setDeliverWhatsapp(value);
                  if (deliverOrderRef) return;
                  const match = validWhatsApp(value) ? registeredClients.find(c => phoneNumber(c.whatsapp) === phoneNumber(value)) : undefined;
                  if (match) {
                    setClientChoice(match.id); setDeliverClient(match.name); setDeliverEmail(match.email || "");
                  } else {
                    if (clientChoice !== "manual") { setDeliverClient(""); setDeliverEmail(""); }
                    setClientChoice("manual");
                  }
                }} onName={name=>{if(!deliverOrderRef&&!deliverClient.trim())setDeliverClient(name);}}/></div>
                <div><Label>Fecha de vencimiento</Label><Input type="date" value={deliverStockExpires} onChange={(e) => setDeliverStockExpires(e.target.value)} /></div>
                <div><Label>Precio de venta</Label><Input type="number" min={0} step="0.01" value={deliverSalePrice} onChange={(e) => setDeliverSalePrice(e.target.value)} />{admin&&<p className="mt-1 text-xs text-muted-foreground">Se registra la venta sin modificar el saldo de la tienda.</p>}</div>
                {admin ? <div className="sm:col-span-2 space-y-1"><Label>Vincular pedido web o Cyberdoc (opcional)</Label>
                  <Select value={deliverOrderRef || "manual"} onValueChange={(value) => {
                    const selected = cyberdocOrders.find((order) => order.id === value);
                    setClientChoice("manual");
                    setDeliverOrderRef(selected?.id || "");
                    setDeliverEmail("");
                    setDeliverClient(selected?.clientName || "");
                    setDeliverWhatsapp(selected ? selected.whatsapp || (selected.contactLabel === "WhatsApp" ? selected.contactValue : "") : "");
                    setDeliverStockExpires(selected?.expiresOn || "");
                  }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                    <SelectItem value="manual">Entrega manual sin pedido</SelectItem>
                    {cyberdocOrders.filter((order) => !["completed", "cancelled", "rejected"].includes(order.status) && !order.stockItemId && !order.protectedDeliveryId).map((order) =>
                      <SelectItem key={order.id} value={order.id}>{order.sourceLabel || "Pedido"} · {order.cyberdocsOrderId} · {order.clientName} · {order.serviceName}</SelectItem>
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

        <Dialog open={Boolean(deliveryResult)} onOpenChange={value => { if (!value) {setDeliveryResult(null);onDelivered?.();} }}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Entrega registrada</DialogTitle><DialogDescription>Elige cómo compartir el servicio con tu cliente.</DialogDescription></DialogHeader>
            {deliveryResult ? <div className="grid gap-2">
              {can("stock_view_password") ? <Button onClick={() => void copyFullAccess(deliveryResult.item)}><Copy className="mr-1 size-4" />Copiar credenciales</Button> : null}
              {can("stock_view_password") && deliveryResult.ficha ? <Button variant="outline" onClick={() => void copyValue("Ficha de entrega", deliveryResult.ficha)}>Copiar ficha de entrega</Button> : null}
              <Button variant="outline" onClick={() => void copyValue("Mensaje con link", deliveryResult.text.includes(deliveryResult.link) ? deliveryResult.text : deliveryResult.text + "\n" + deliveryResult.link)}>Copiar mensaje con link</Button>
              <Button variant="outline" onClick={() => void copyValue("Enlace de entrega", deliveryResult.link)}>🔗 Copiar enlace de entrega</Button>
              <Button variant="outline" onClick={() => window.open("https://wa.me/" + deliveryResult.phone + "?text=" + encodeURIComponent(deliveryResult.text), "_blank", "noopener,noreferrer")}><MessageCircle className="mr-1 size-4" />Compartir por WhatsApp</Button>
              {deliveryResult.password ? <Button variant="outline" onClick={() => window.open("https://wa.me/" + deliveryResult.phone + "?text=" + encodeURIComponent("Contraseña del documento protegido: " + deliveryResult.password), "_blank", "noopener,noreferrer")}>Enviar contraseña del documento por WhatsApp</Button> : null}
              <Button variant="ghost" onClick={() => setDeliveryResult(null)}>Cerrar</Button>
            </div> : null}
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(historyItem)} onOpenChange={(value) => !value && setHistoryItem(null)}>
          <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Historial · {historyItem?.platform || "Cuenta"}</DialogTitle></DialogHeader><div className="max-h-[60vh] space-y-2 overflow-y-auto">{history.map((h) => <p key={h.id} className="rounded-lg bg-muted/40 p-2 text-xs"><b>{new Date(h.createdAt).toLocaleString("es-MX")}</b> · {h.action} · {h.detail}</p>)}{!history.length ? <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p> : null}</div></DialogContent>
        </Dialog>
    </ToolFrame>
  );
}
