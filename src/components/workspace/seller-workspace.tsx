import { CustomerManager } from "@/components/customer/customer-manager";
import { WebOrders } from "@/components/customer/web-orders";
import { RechargePanel } from "@/components/recharges/recharge-panel";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Store,
  Wallet,
  Pencil,
  X,
  Bell,
  Menu,
  Moon,
  Sun,
  LogOut,
  RefreshCw,
  ExternalLink,
  Copy,
  QrCode,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import qrcode from "qrcode-generator";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useCatalogStore } from "@/lib/catalog/store";
import { buildCatalogLink, mainStoreLink } from "@/lib/catalog/links";
import { ProductPricing } from "@/components/customer/product-pricing";
import { FinancePanel } from "./finance-panel";
import { SELLER_ONBOARDING_KEY, SellerOnboarding, SellerOnboardingInvite } from "./seller-onboarding";
import { getSavedCode } from "@/lib/notify/client";
import { copyText } from "@/lib/browser/clipboard";
import { adminDashboard } from "@/lib/stock/dashboard.functions";
import { opsLoad } from "@/lib/workspace/operations.functions";
import { DEFINITIONS, money, type Module, type OpsRecord } from "@/lib/workspace/model";
import { ResourcePanel, WalletPanel, EmptyState, errorText, type Entry } from "./resource-panel";
import { BusinessAssistant, GamesPanel, HelpersPanel, StockInsights } from "./insights-panels";
import { StockManagerDialog } from "@/components/catalog/stock-manager-dialog";
import { CyberDocsOrdersDialog } from "@/components/catalog/cyberdocs-orders-dialog";
import { MenusDialog } from "@/components/catalog/menus-dialog";
import { NotificationsDialog } from "@/components/catalog/notifications-dialog";
import { ProtectedDeliveriesDialog } from "@/components/catalog/protected-deliveries-dialog";
import { GalleryContents } from "@/components/catalog/platform-gallery-dialog";
import { MethodsDialog } from "@/components/catalog/methods-dialog";
import { CatalogSettingsDialog, ServiceFormDialog } from "@/components/catalog/service-dialogs";
import { SalesDialog } from "@/components/catalog/sales-dialog";
import { AdminBar } from "@/components/catalog/admin-bar";
import { SystemStatusDialog } from "@/components/catalog/system-status-dialog";
import { AppearanceEditor } from "@/components/catalog/appearance-editor";
import { comboCopyCredentials } from "@/lib/stock/combo.functions";
import { StockComboPlanner } from "@/components/workspace/stock-combo-planner";
import { mainAppearanceLoad, mainAppearanceSave } from "@/lib/appearance/main-store.functions";
import { normalizeAppearance, appearanceStyle, type Appearance } from "@/lib/appearance/theme";
import {useMa2Appearance} from "@/hooks/use-ma2-appearance";
import { renewalLimits, INVENTORY_DOT_CLASSES, inventoryTone } from "@/lib/stock/traffic-light";
const SECTIONS = [
  ["home", "📊", "Inicio"],
  ["finance", "💰", "Finanzas"],
  ["shop", "🏷️", "Productos y precios"],
  ["reports", "🛠️", "Reportes"],
  ["questions", "💬", "Dudas de clientes"],
  ["expiry", "⏰", "Vigencias y renovaciones"],
  ["clients", "👥", "Clientes"],
  ["wallet", "💸", "Recargas"],
  ["credit", "💳", "Créditos"],
  ["inventory", "📦", "Inventario"],
  ["combos", "🍔", "Combos"],
  ["orders", "📝", "Pedidos"],
  ["providers", "🤝", "Proveedores"],
  ["notices", "📢", "Avisos"],
  ["referrals", "🎁", "Referidos"],
  ["helpers", "🧑‍💼", "Ayudantes"],
  ["codes", "🔑", "Panel de códigos"],
  ["assistant", "🤖", "Asistente"],
  ["songs", "🎵", "Música"],
  ["games", "🎮", "Juegos"],
  ["memory", "🕹️", "Juegos de memoria"],
  ["appearance", "🎨", "Apariencia"],
  ["settings", "⚙️", "Configuración"],
  ["documents", "🗂️", "Bóveda de documentos"],
  ["subscription", "💳", "Planes y suscripciones"],
  ["gallery", "🖼️", "Guías de ingreso"],
  ["deliveries", "🛡️", "Entregas protegidas"],
  ["catalogs", "🏪", "Tiendas contratadas"],
  ["extras","✨","Extras"],
] as const;
export type Section = (typeof SECTIONS)[number][0];
const NAV_GROUPS: {main:Section; label?:string; children:Section[]}[] = [
  {main:"home",children:[]},
  {main:"expiry",children:[]},
  {main:"orders",label:"Pedidos y entregas",children:[]},
  {main:"inventory",children:["shop","combos"]},
  {main:"clients",children:[]},
  {main:"reports",children:[]},
  {main:"questions",children:[]},
  {main:"referrals",children:[]},
  {main:"wallet",children:[]},
  {main:"credit",children:[]},
  {main:"finance",children:[]},
  {main:"providers",children:[]},
  {main:"gallery",children:[]},
  {main:"notices",children:[]},
  {main:"helpers",children:[]},
  {main:"catalogs",children:[]},
  {main:"settings",label:"Ajustes",children:["appearance","subscription"]},
  {main:"extras",children:["documents","assistant","songs","games","memory","codes","deliveries"]},
];
type Summary = Awaited<ReturnType<typeof adminDashboard>>;
export function SellerLayout({
  section,
  onSection,
  shareUrl,
  name,
  dark,
  onTheme,
  onLogout,
  children,
  onNotifications,
  appearance,
}: {
  section: Section;
  onSection: (section: Section) => void;
  shareUrl: string;
  name: string;
  dark: boolean;
  onTheme: () => void;
  onLogout: () => void;
  children: ReactNode;
  onNotifications?: () => void;
  appearance?: Appearance;
}) {
  useMa2Appearance(appearance);
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState(false);
  const [onboarding, setOnboarding] = useState<"invite" | "active" | "finished">("finished");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SELLER_ONBOARDING_KEY);
      setOnboarding(saved === "active" || saved === "finished" ? saved : "invite");
    } catch {
      setOnboarding("invite");
    }
  }, []);
  const saveOnboarding = (status: "active" | "finished") => {
    setOnboarding(status);
    try {
      localStorage.setItem(SELLER_ONBOARDING_KEY, status);
    } catch {
      // The choice still applies for the current visit.
    }
  };
  const [qrData, setQrData] = useState("");
  const [expanded,setExpanded]=useState<Section|null>(null);
  const selected = SECTIONS.find((s) => s[0] === section)!;
  const go=(id:Section)=>{onSection(id);setOpen(false);};
  const parent = NAV_GROUPS.find((group) => group.children.includes(section))?.main ?? "home";
  const navButton=(id:Section,label?:string)=>{const item=SECTIONS.find(s=>s[0]===id)!;return <button key={id} onClick={()=>go(id)} className={`w-full ${id===section?"active":""}`} aria-current={id===section?"page":undefined}><span aria-hidden="true">{item[1]}</span>{label||item[2]}</button>;};
  const nav = (
    <>
      <p className="seller-nav-caption">PANEL</p>
      <nav aria-label="Panel de tu negocio">
        {NAV_GROUPS.map(group=>{const active=group.main===section||group.children.includes(section),show=expanded===group.main;return <div key={group.main} className="min-w-0">
          <div className={`flex items-center gap-1 rounded-xl ${active&&group.main!==section?"bg-primary/5":""}`}><div className="min-w-0 flex-1">{navButton(group.main,group.label)}</div>{group.children.length>0&&<button type="button" aria-label={`${show?"Ocultar":"Mostrar"} opciones de ${group.label||SECTIONS.find(s=>s[0]===group.main)?.[2]}`} aria-expanded={show} onClick={()=>setExpanded(show?null:group.main)} className="!w-9 !shrink-0 !justify-center !px-1"><span aria-hidden="true">{show?"▴":"▾"}</span></button>}</div>
          {show&&<div className="ml-3 border-l border-border pl-2">{group.children.map(id=>navButton(id))}</div>}
        </div>;})}
      </nav>
    </>
  );
  const shareCard = (
    <section className="seller-card ma2-store-link mb-4 space-y-3" aria-label="Mi tienda web">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border bg-card text-primary">
          {appearance?.logoImage
            ? <img src={appearance.logoImage} alt="" className="size-full object-contain" />
            : <Store className="size-6" aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold">Mi tienda web</h2>
          <a href={shareUrl} className="break-all text-sm font-semibold text-primary hover:underline">
            {shareUrl.replace(/^https?:\/\//, "")}
          </a>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" asChild><a href={shareUrl}><ExternalLink /> Ver tienda</a></Button>
        <Button type="button" size="sm" variant="outline" onClick={async () => {
          try {
            await copyText(shareUrl);
            toast.success("Enlace copiado");
          } catch {
            toast.error("No se pudo copiar el enlace");
          }
        }}><Copy /> Copiar enlace</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => {
          const code = qrcode(0, "M");
          code.addData(shareUrl);
          code.make();
          setQrData(code.createDataURL(5, 8));
          setQr(true);
        }}><QrCode /> QR</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => go("appearance")}>
          <Pencil /> {appearance?.logoImage ? "Cambiar logo" : "Agregar logo"}
        </Button>
      </div>
    </section>
  );
  return (
    <div
      className="seller-app ma2-unified"
      style={appearanceStyle(appearance)}
      data-season={appearance?.season || "normal"}
    >
      <header className="seller-topbar">
        <div className="flex items-center gap-2">
          <button
            className="seller-icon-button seller-mobile-toggle"
            aria-label="Abrir menú del panel"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" />
          </button>
          <button
            className="seller-logo"
            onClick={() => onSection("home")}
            aria-label="Ir al inicio"
          >
            {appearance?.logoImage ? (
              <img
                src={appearance.logoImage}
                alt="Logo del negocio"
                className="h-full w-full object-contain"
              />
            ) : (
              "MA²"
            )}
          </button>
          <span className="seller-topbar-name">{name}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="seller-icon-button"
            aria-label="Avisos y notificaciones"
            onClick={() => (onNotifications ? onNotifications() : onSection("settings"))}
          >
            <Bell className="size-4" />
          </button>
          <button
            className="seller-icon-button"
            aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
            onClick={onTheme}
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <button className="seller-exit" onClick={onLogout}>
            <LogOut className="size-3.5" />
            Salir
          </button>
        </div>
      </header>
      <aside className="seller-sidebar">{nav}</aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="seller-drawer ma2-themed-drawer w-[78vw] max-w-[290px] overflow-y-auto p-4"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Panel de {name}</SheetTitle>
            <SheetDescription>Selecciona un apartado de administración.</SheetDescription>
          </SheetHeader>
          {nav}
        </SheetContent>
      </Sheet>
      <main className="seller-main" id="seller-main">
        <div className="seller-page-heading">
          <div>
            <div className="flex items-center gap-2">
              {section !== "home" && (
                <Button type="button" variant="ghost" size="icon" className="shrink-0"
                  aria-label="Regresar" title="Regresar" onClick={() => go(parent)}>
                  <ArrowLeft className="size-5" />
                </Button>
              )}
              <h1>{section === "home" ? `Resumen de ${name}` : selected[2]}</h1>
            </div>
            <p>
              {section === "home"
                ? "Tu stock, tus clientes y tus entregas, en un solo lugar."
                : section in DEFINITIONS
                  ? DEFINITIONS[section as Module].description
                  : DESCRIPTIONS[section] || "Administra tu negocio desde aquí."}
            </p>
          </div>
          {section !== "home" && (
            <Button type="button" variant="ghost" size="icon" className="ml-auto shrink-0"
              aria-label="Cerrar apartado" title="Cerrar apartado" onClick={() => go("home")}>
              <X className="size-5" />
            </Button>
          )}
          {appearance?.coverImage ? (
            <img
              src={appearance.coverImage}
              alt={`Portada de ${name}`}
              className="seller-heading-cover"
            />
          ) : null}
        </div>
        {onboarding === "invite" && section === "home" && (
          <SellerOnboardingInvite onStart={() => saveOnboarding("active")} onSkip={() => saveOnboarding("finished")} />
        )}
        {onboarding === "active" && (
          <SellerOnboarding key={section} section={section} onFinish={() => saveOnboarding("finished")} />
        )}
        {section==="home"&&shareCard}
        {children}
      </main>
      <Dialog open={qr} onOpenChange={setQr}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>QR de tu tienda</DialogTitle>
            <DialogDescription>El cliente puede escanearlo para abrir tu tienda.</DialogDescription>
          </DialogHeader>
          {qrData ? (
            <img src={qrData} alt="Código QR de la tienda" className="mx-auto w-64 rounded-xl" />
          ) : null}
          <Button asChild>
            <a href={qrData} download="catalogo-ma2-qr.gif">
              Descargar QR
            </a>
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
const DESCRIPTIONS: Partial<Record<Section, string>> = {
  shop: "Tu página de ventas, enlace público y acceso de compradores.",
  finance: "Entradas, salidas, cuentas de efectivo y control de pagos.",
  expiry: "Consulta fechas de corte y da seguimiento a las renovaciones.",
  wallet: "Recargas confirmadas y movimientos del saldo de tus clientes.",
  credit: "Registra crédito otorgado y sus abonos, con historial.",
  inventory: "Cuentas completas y perfiles. Agrega stock, copia credenciales y entrega.",
  orders: "Pedidos de CyberDocs, ventas web y solicitudes por encargo.",
  appearance: "Portada, logo, tarjetas, temporadas y transparencia.",
  helpers: "Administra el equipo y los accesos de los catálogos de clientes.",
  assistant: "Consulta tus registros y resultados del negocio.",
  gallery: "Guarda instrucciones por plataforma y reutilízalas en cada entrega.",
  deliveries: "Enlaces protegidos con instrucciones, imágenes y soporte.",
  catalogs: "Gestiona las tiendas contratadas y sus funciones habilitadas.",
  settings: "Contacto, mensajes, avisos de pedidos y respaldos.",
  subscription: "Administra tus planes, demos y solicitudes de contratación.",
  combos: "Asigna paquetes de perfiles o cuentas completas del inventario.",
};
export function SellerHome({
  summary,
  clients,
  onNavigate,
}: {
  summary: Summary;
  clients: number;
  onNavigate: (section: Section) => void;
}) {
  const [salesOpen,setSalesOpen]=useState(false);
  const daily = summary.daily;
  const weekTotal = daily.reduce((s, d) => s + d.total, 0);
  const max = Math.max(100, ...daily.map((d) => d.total));
  const metrics = [
    {
      label: "💰 Vendido hoy",
      value: money(daily.at(-1)?.total || 0),
      detail: `${daily.at(-1)?.count || 0} entregas registradas`,
      section: "home",
      tone: "aqua",
    },
    {
      label: "📈 Últimos 7 días",
      value: money(weekTotal),
      detail: `${daily.reduce((s, d) => s + d.count, 0)} entregas registradas`,
      section: "home",
      tone: "",
    },
    {
      label: "🧾 Ventas del mes",
      value: money(summary.revenue),
      detail: `${summary.sales} entregas registradas · ${summary.salesWithoutPrice} sin precio`,
      section: "home",
      tone: "",
    },
    {
      label: "💵 Ganancia estimada del mes",
      value: summary.marginSales ? money(summary.margin) : "Sin datos",
      detail: `${summary.marginSales} ventas con costo y precio · no incluye gastos`,
      section: "finance",
      tone: "",
    },
    {
      label: "👥 Clientes registrados",
      value: clients,
      detail: "Contactos en tu panel de atención",
      section: "clients",
      tone: "",
    },
    {
      label: "📦 Unidades en stock",
      value: summary.available,
      detail: "Disponibles para entregar",
      section: "inventory",
      tone: "",
    },
  ] as const;
  return (
    <div className="space-y-5">
      <div className="seller-metrics">
        {metrics.map((m) => (
          <button
            className={`seller-metric ${m.tone}`}
            key={m.label}
            onClick={() => onNavigate(m.section)}
          >
            <span>{m.label}</span>
            <strong>{m.value}</strong>
            <small>{m.detail}</small>
          </button>
        ))}
      </div>
      <section className="seller-card">
        <div className="flex justify-between gap-2">
          <h2 className="font-bold text-sm">Ventas de los últimos 7 días</h2>
          <span className="seller-badge">{money(weekTotal)}</span>
        </div>
        <div
          className="seller-chart"
          role="img"
          aria-label={`Ingresos de los últimos siete días: ${money(weekTotal)}`}
        >
          <svg viewBox="0 0 560 180" className="w-full" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <line
                  x1="35"
                  x2="550"
                  y1={20 + i * 42}
                  y2={20 + i * 42}
                  stroke="currentColor"
                  opacity=".08"
                />
                <text x="0" y={24 + i * 42} fontSize="9" fill="currentColor" opacity=".5">
                  ${Math.round((max * (3 - i)) / 3)}
                </text>
              </g>
            ))}
            {daily.map((d, i) => (
              <g key={d.date}>
                <rect
                  x={55 + i * 70}
                  y={146 - (d.total / max) * 120}
                  width="30"
                  height={d.total ? Math.max(2, (d.total / max) * 120) : 1}
                  rx="5"
                  fill="var(--primary)"
                  opacity=".8"
                />
                <text
                  x={70 + i * 70}
                  y="172"
                  textAnchor="middle"
                  fontSize="10"
                  fill="currentColor"
                  opacity=".6"
                >
                  {d.date.slice(8)}/{d.date.slice(5, 7)}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </section>
      <div className="seller-grid">
        <section className="seller-card">
          <h2 className="font-bold">Se está agotando</h2>
          {summary.platforms.filter((p) => p.available <= 2).length ? (
            <div className="mt-3 space-y-3">
              {summary.platforms
                .filter((p) => p.available <= 2)
                .map((p) => (
                  <button
                    key={p.platform}
                    onClick={() => onNavigate("inventory")}
                    className="flex w-full items-center gap-2 text-left text-sm"
                  >
                    <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${INVENTORY_DOT_CLASSES[inventoryTone(p.available)]}`} />
                    <span>{p.platform}</span>
                    <span className="sr-only">{p.available ? `Disponibles: ${p.available}` : "Agotado"}</span>
                  </button>
                ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No hay plataformas con dos unidades o menos.
            </p>
          )}
        </section>
        <section className="seller-card">
          <h2 className="font-bold">Pendientes del día</h2>
          <div className="mt-3 space-y-3">
            {[
              ["orders", "Pedidos pendientes", summary.pending],
              ["expiry", "Renovaciones hoy", summary.renewToday],
              ["expiry", "Próximos 7 días", summary.renewUpcoming],
              ["reports", "Reposiciones de stock", summary.replacements],
            ].map(([s, l, v]) => (
              <button
                key={String(l)}
                onClick={() => onNavigate(s as Section)}
                className="flex w-full justify-between text-sm"
              >
                <span>{l}</span>
                <b>{v}</b>
              </button>
            ))}
          </div>
        </section>
      </div>
      <div className="seller-grid">
        <article className="seller-card">
          <p className="seller-caption">Vencidas / bajas</p>
          <strong className="text-2xl">{summary.expired}</strong>
          <p className="mt-2 text-xs text-muted-foreground">
            Actualizado:{" "}
            {new Date(summary.updatedAt).toLocaleString("es-MX", { timeZone: "America/Monterrey" })}
          </p>
        </article>
      </div>
      <details className="seller-card" onToggle={e=>setSalesOpen(e.currentTarget.open)}><summary className="font-semibold cursor-pointer">Consultar ventas registradas</summary>{salesOpen&&<div className="mt-3"><StockInsights sales showSummary={false}/></div>}</details>
    </div>
  );
}
export function SellerWorkspace({ onCatalog }: { onCatalog: (id?: string) => void }) {
  const store = useCatalogStore();
  const [section, setSection] = useState<Section>("home");
  const [records, setRecords] = useState<OpsRecord[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("main");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [assignClient, setAssignClient] = useState<OpsRecord | null>(null);
  const [addStock, setAddStock] = useState(false);
  const [financeStart, setFinanceStart] = useState<"summary" | "income" | "expense">("summary");
  const [walletClient, setWalletClient] = useState("");
  const [settings, setSettings] = useState(false);
  const [service, setService] = useState(false);
  const [design, setDesign] = useState(normalizeAppearance({}));
  const [savedDesign,setSavedDesign]=useState(normalizeAppearance({}));
  const [uploading, setUploading] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    const result = await Promise.allSettled([
      opsLoad({ data: { code: getSavedCode() } }),
      adminDashboard({ data: { code: getSavedCode() } }),
    ]);
    if (result[0].status === "fulfilled") {
      setRecords(result[0].value.records);
      setEntries(result[0].value.entries);
    } else setError(errorText(result[0].reason));
    if (result[1].status === "fulfilled") setSummary(result[1].value);
    else {
      const message = errorText(result[1].reason);
      setError((e) => [e, message].filter(Boolean).join(" · "));
    }
    setBusy(false);
  }, []);
  useEffect(() => {
    document.body.classList.add("seller-mode");
    void load();
    const focus = () => {
      void load();
    };
    window.addEventListener("focus", focus);
    return () => {
      document.body.classList.remove("seller-mode");
      window.removeEventListener("focus", focus);
    };
  }, [load]);
  useEffect(() => {
    void mainAppearanceLoad().then(a=>{setDesign(a);setSavedDesign(a);}).catch(()=>toast.error("No se pudo cargar la apariencia"));
  }, []);
  const navigate = (s: Section) => {
    setSection(s);
    setFinanceStart("summary");
    setTab("main");
    setSelectedOrderId(null);
    setAddStock(false);
    setAssignClient(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const assign = (id: string) => { const client = records.find(r => r.id === id && r.module === "clients" && r.status === "active"); if (!client) return toast.error("El cliente no está disponible. Actualiza clientes e inténtalo de nuevo."); navigate("inventory"); setAssignClient(client); };
  const resource = (module: Module,subset=records) => (
    <ResourcePanel
      key={module}
      module={module}
      records={subset}
      entries={entries}
      reload={load}
      onAssign={assign}
      onWallet={(id) => {
        setWalletClient(id);
        navigate("wallet");
      }}
    />
  );
  let content: ReactNode;
  if (section === "home")
    content = (<>
      <section className="seller-card flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold"><Wallet className="size-5 text-primary" /> Finanzas</h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => {
            navigate("finance");
            setFinanceStart("income");
          }}>Registrar entrada</Button>
          <Button size="sm" variant="outline" onClick={() => {
            navigate("finance");
            setFinanceStart("expense");
          }}>Registrar salida</Button>
          <Button size="sm" variant="ghost" onClick={() => navigate("finance")}>Ver finanzas</Button>
        </div>
      </section>
      {summary && (
      <SellerHome
        summary={summary}
        clients={records.filter((r) => r.module === "clients").length}
        onNavigate={navigate}
      />
    )}</>);
  else if (section === "shop") content = <ProductPricing/>;
  else if (section === "inventory") content = <div className="space-y-3"><div className="seller-tabs"><button className="active">Inventario</button><button onClick={()=>navigate("shop")}>Productos y precios</button><button onClick={()=>{navigate("combos");setTab("profile");}}>Combos de perfiles</button><button onClick={()=>{navigate("combos");setTab("complete");}}>Combos completas</button></div><StockManagerDialog key={assignClient?.id || String(addStock)} embedded autoAdd={addStock} initialTab={assignClient ? "available" : "all"} initialClient={assignClient ? {id:assignClient.id,name:assignClient.title,whatsapp:assignClient.data.whatsapp || "",email:assignClient.data.email||"",clientReference:assignClient.clientReference} : undefined} /></div>;
  else if (section === "expiry") {const cfg=records.find(r=>r.module==="config"&&r.status==="active")?.data;content = <StockInsights limits={renewalLimits(cfg?.renewalRedDays,cfg?.renewalYellowDays)} onChanged={()=>void load()}/>;}
  else if (section === "finance") content = <FinancePanel initialView={financeStart} />;
  else if (section === "wallet")
    content = (
      <div className="space-y-5">
        <RechargePanel records={records} onChanged={load} />
        <details className="seller-card">
          <summary className="cursor-pointer font-semibold">Recargas y ajustes manuales</summary>
          <div className="mt-4">
            <WalletPanel
              key={walletClient}
              records={records}
              entries={entries}
              reload={load}
              initialClient={walletClient}
            />
          </div>
        </details>
      </div>
    );
  else if (section === "credit")
    content = (
      <WalletPanel
        key={section + walletClient}
        records={records}
        entries={entries}
        reload={load}
        initialClient={walletClient}
        debt={section === "credit"}
      />
    );
  else if (section === "orders")
    content = <div className="space-y-4">
      <CyberDocsOrdersDialog
        key={tab + ":" + (selectedOrderId || "all")}
        embedded
        initialSelectedId={selectedOrderId}
        stage={tab === "delivered" ? "deliveries" : tab === "processing" || tab === "closed" ? tab : "orders"}
        navigation={
          <div className="seller-tabs min-w-0 flex-1" aria-label="Estado de pedidos">
            {([["main", "Pedidos"], ["processing", "En proceso"], ["delivered", "Entregadas"], ["closed", "Cancelados / rechazados"]] as const).map(([key, label]) => (
              <button key={key} type="button" className={tab === key ? "active" : ""} aria-pressed={tab === key}
                onClick={() => { setSelectedOrderId(null); setTab(key); }}>{label}</button>
            ))}
          </div>
        }
        onStageChange={(id, stage) => {
          setSelectedOrderId(id);
          setTab(stage === "deliveries" ? "delivered" : stage);
        }}
      />
      {(tab === "main" || tab === "delivered") && <WebOrders key={tab} stage={tab==="delivered"?"deliveries":"orders"}
        onOpenOrder={(id, delivered, processing) => {
          setSelectedOrderId(id);
          setTab(delivered ? "delivered" : processing ? "processing" : "main");
        }}
      />}
      {tab==="delivered"&&<><details className="seller-card"><summary className="font-semibold cursor-pointer">Entregas protegidas</summary><ProtectedDeliveriesDialog embedded/></details><details className="seller-card"><summary className="font-semibold cursor-pointer">Entregas del inventario</summary><StockInsights sales showSummary={false}/></details></>}
      {tab==="main"&&<details className="seller-card"><summary className="font-semibold cursor-pointer">Encargos registrados manualmente</summary>{resource("requests",records.filter(r=>r.module!=="requests"||r.status==="pending"))}</details>}{tab==="delivered"&&<details className="seller-card" open><summary className="font-semibold cursor-pointer">Combos y entregas manuales</summary><div className="mt-3 space-y-3">{records.filter(r=>r.module==="requests"&&r.status==="completed").map(r=><article className="rounded-xl border p-3" key={r.id}><strong>{r.title}</strong><p className="text-xs text-muted-foreground">{r.data.comboStockIds?"Combo de inventario":"Entrega manual"} · {records.find(c=>c.id===r.data.clientId)?.title||"Cliente"} · {new Date(r.createdAt).toLocaleString("es-MX")}</p><p>{money(Number(r.data.amount||0))}</p><div className="flex flex-wrap gap-2 mt-2">{r.data.reply&&<Button variant="outline" size="sm" onClick={()=>void copyText(r.data.reply)}>Copiar entrega</Button>}{r.data.comboStockIds&&r.data.deliveryUrl&&<Button variant="outline" size="sm" onClick={async()=>{try{await copyText(await comboCopyCredentials({data:{code:getSavedCode(),id:r.id}}));toast.success("Credenciales copiadas");}catch(e){toast.error(errorText(e));}}}>Copiar credenciales sin documento</Button>}{r.data.deliveryUrl&&<Button variant="outline" size="sm" asChild><a href={r.data.deliveryUrl} target="_blank" rel="noopener noreferrer">Documento protegido</a></Button>}</div></article>)}</div></details>}
    </div>;
  else if (section === "questions")
    content = (
      <>
        <div className="seller-tabs">
          <button className={tab === "main" ? "active" : ""} onClick={() => setTab("main")}>
            Consultas
          </button>
          <button className={tab === "faq" ? "active" : ""} onClick={() => setTab("faq")}>
            Preguntas frecuentes
          </button>
        </div>
        {resource(tab === "main" ? "questions" : "faq")}
      </>
    );
  else if (section === "clients")
    content = (
      <div className="space-y-5">
        <CustomerManager slug="ma2" records={records} onAssign={assign} />
        {resource("clients")}
      </div>
    );
  else if (section === "gallery")
    content = (
      <div className="seller-card">
        <GalleryContents />
      </div>
    );
  else if (section === "deliveries") content = <ProtectedDeliveriesDialog embedded />;
  else if (section === "catalogs") content = <MenusDialog embedded />;
  else if (section === "helpers") content = <HelpersPanel records={records} />;
  else if (section === "assistant") content = <BusinessAssistant records={records} />;
  else if (section === "games" || section === "memory")
    content = <GamesPanel key={section} memory={section === "memory"} />;
  else if (section === "appearance")
    content = (
      <div className="seller-card space-y-4">
        <p className="text-sm text-muted-foreground">Elige una temática en Temporada y guarda para aplicarla al panel, la tienda y la cuenta de cliente.</p>
        <AppearanceEditor value={design} onChange={setDesign} onBusyChange={setUploading} />
        <Button
          disabled={uploading}
          onClick={async () => {try{setUploading(true);const a=await mainAppearanceSave({data:{code:getSavedCode(),appearance:design}});setSavedDesign(a);setDesign(a);toast.success("Apariencia actualizada en MA²");}catch(e){toast.error(errorText(e));}finally{setUploading(false);}}}
        >
          Guardar portada y diseño
        </Button>

      </div>
    );
  else if (section === "settings")
    content = (
      <>
        <div className="seller-tabs">
          {[
            ["main", "Notificaciones"],
            ["tools", "Respaldos y sistema"],
          ].map(([v, l]) => (
            <button key={v} className={tab === v ? "active" : ""} onClick={() => setTab(v)}>
              {l}
            </button>
          ))}
        </div>
        {tab === "main" || tab === "notifications" ? (
          <NotificationsDialog embedded />
        ) : (
          <div className="seller-card space-y-4">
            <AdminBar />
            <SystemStatusDialog />
            <MethodsDialog />
            <details className="seller-card"><summary className="font-semibold cursor-pointer">Contacto, mensajes y semáforo de vigencias</summary>{resource("config")}</details>
          </div>
        )}
      </>
    );
  else if (section === "combos") content=<StockComboPlanner initialKind={tab==="complete"?"complete":"profile"} records={records} onDelivered={()=>{navigate("orders");setTab("delivered");void load();}}/>;
  else if(section==="extras") content=<div className="seller-card grid grid-cols-2 gap-3">{(["documents","assistant","songs","games","memory","codes","deliveries"] as Section[]).map(id=><Button key={id} variant="outline" className="h-auto whitespace-normal p-3" onClick={()=>navigate(id)}>{SECTIONS.find(s=>s[0]===id)?.[2]}</Button>)}</div>;
  else if (section === "subscription")
    content = (
      <div className="seller-card space-y-4">
        <h3 className="font-bold">Planes de tus tiendas</h3>
        <p className="text-sm text-muted-foreground">
          Configura planes, instrucciones de pago, demos y solicitudes de contratación. La
          activación de pagos se confirma desde tu panel.
        </p>
        <SalesDialog />
      </div>
    );
  else content = resource(section as Module);
  return (
    <SellerLayout
      section={section}
      appearance={savedDesign}
      onSection={navigate}
      name="MA²"
      shareUrl={`${typeof window!=="undefined"?window.location.origin:"https://martgor.shop"}${mainStoreLink()}`}
      dark={store.prefs.themeMode === "oscuro"}
      onTheme={() =>
        store.setPrefs({ themeMode: store.prefs.themeMode === "oscuro" ? "claro" : "oscuro" })
      }
      onLogout={store.logout}
      onNotifications={() => {
        navigate("orders");
        setTab("main");
      }}
    >
      {error ? (
        <div role="alert" className="seller-error">
          <p>{error}</p>
          <Button variant="outline" disabled={busy} onClick={() => void load()}>
            Reintentar carga
          </Button>
        </div>
      ) : null}
      {busy && !summary && records.length === 0 ? (
        <p className="seller-loading" role="status">
          Cargando tu panel…
        </p>
      ) : null}
      <div className="seller-content" key={section}>
        {content}
      </div>
      <CatalogSettingsDialog open={settings} onOpenChange={setSettings} />
      <ServiceFormDialog open={service} onOpenChange={setService} service={null} />
    </SellerLayout>
  );
}
