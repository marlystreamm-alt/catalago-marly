import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
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
import { buildCatalogLink } from "@/lib/catalog/links";
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
import { CatalogManager } from "@/components/catalog/catalog-manager";
import { SalesDialog } from "@/components/catalog/sales-dialog";
import { AdminBar } from "@/components/catalog/admin-bar";
import { SystemStatusDialog } from "@/components/catalog/system-status-dialog";
import { AppearanceEditor } from "@/components/catalog/appearance-editor";
import { normalizeAppearance, appearanceStyle, type Appearance } from "@/lib/appearance/theme";
const SECTIONS = [
  ["home", "📊", "Inicio"],
  ["reports", "🛠️", "Reportes"],
  ["questions", "💬", "Dudas de clientes"],
  ["expiry", "⏰", "Por vencer"],
  ["sales", "🧾", "Ventas"],
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
  ["catalogs", "🏪", "Catálogos de clientes"],
] as const;
export type Section = (typeof SECTIONS)[number][0];
type Summary = Awaited<ReturnType<typeof adminDashboard>>;
export function SellerLayout({
  section,
  onSection,
  shareUrl,
  name,
  dark,
  onTheme,
  onLogout,
  onCatalog,
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
  onCatalog: () => void;
  children: ReactNode;
  onNotifications?: () => void;
  appearance?: Appearance;
}) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState(false);
  const [qrData, setQrData] = useState("");
  const selected = SECTIONS.find((s) => s[0] === section)!;
  const nav = (
    <>
      <div className="seller-share">
        <p>🔗 Link para tus clientes</p>
        <strong className="break-all">{shareUrl.replace(/^https?:\/\//, "")}</strong>
        <div className="seller-share-actions">
          <button onClick={() => void copyText(shareUrl)}>Copiar</button>
          <a href={shareUrl} target="_blank" rel="noopener noreferrer">
            Ver
          </a>
          <button
            onClick={() => {
              const code = qrcode(0, "M");
              code.addData(shareUrl);
              code.make();
              setQrData(code.createDataURL(5, 8));
              setQr(true);
            }}
          >
            QR
          </button>
        </div>
        <p>Compártelo en tu grupo y tus estados.</p>
      </div>
      <p className="seller-nav-caption">PANEL</p>
      <nav aria-label="Panel de tu negocio">
        {SECTIONS.map(([id, icon, label]) => (
          <button
            key={id}
            onClick={() => {
              onSection(id);
              setOpen(false);
            }}
            className={id === section ? "active" : ""}
            aria-current={id === section ? "page" : undefined}
          >
            <span aria-hidden="true">{icon}</span>
            {label}
          </button>
        ))}
        <button
          onClick={() => {
            onCatalog();
            setOpen(false);
          }}
        >
          <span aria-hidden="true">🛍️</span>Editar catálogo público
        </button>
      </nav>
    </>
  );
  return (
    <div
      className="seller-app"
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
          className="seller-drawer w-[78vw] max-w-[290px] overflow-y-auto p-4"
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
            <h1>{section === "home" ? `Resumen de ${name}` : selected[2]}</h1>
            <p>
              {section === "home"
                ? "Tu stock, tus clientes y tus entregas, en un solo lugar."
                : section in DEFINITIONS
                  ? DEFINITIONS[section as Module].description
                  : DESCRIPTIONS[section] || "Administra tu negocio desde aquí."}
            </p>
          </div>
          {appearance?.coverImage ? (
            <img
              src={appearance.coverImage}
              alt={`Portada de ${name}`}
              className="seller-heading-cover"
            />
          ) : null}
        </div>
        {children}
      </main>
      <Dialog open={qr} onOpenChange={setQr}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>QR de tu catálogo</DialogTitle>
            <DialogDescription>El cliente puede escanearlo para abrir tu tienda.</DialogDescription>
          </DialogHeader>
          {qrData ? (
            <img src={qrData} alt="Código QR del catálogo" className="mx-auto w-64 rounded-xl" />
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
  expiry: "Consulta fechas de corte y da seguimiento a las renovaciones.",
  sales: "Entregas e importes registrados en tu inventario.",
  wallet: "Recargas confirmadas y movimientos del saldo de tus clientes.",
  credit: "Registra crédito otorgado y sus abonos, con historial.",
  inventory: "Cuentas completas y perfiles. Agrega stock, copia credenciales y entrega.",
  orders: "Pedidos de Cyberdoc y solicitudes por encargo.",
  appearance: "Portada, logo, tarjetas, temporadas y transparencia.",
  helpers: "Administra el equipo y los accesos de los catálogos de clientes.",
  assistant: "Consulta tus registros y resultados del negocio.",
  gallery: "Guarda instrucciones por plataforma y reutilízalas en cada entrega.",
  deliveries: "Enlaces protegidos con instrucciones, imágenes y soporte.",
  catalogs: "Gestiona los catálogos vendidos y las funciones habilitadas.",
  settings: "Contacto, mensajes, avisos de pedidos y respaldos.",
  subscription: "Administra tus planes, demos y solicitudes de contratación.",
  combos: "Organiza los paquetes de tu catálogo y sus precios.",
};
export function SellerHome({
  summary,
  clients,
  onAddStock,
  onNavigate,
}: {
  summary: Summary;
  clients: number;
  onAddStock: () => void;
  onNavigate: (section: Section) => void;
}) {
  const daily = summary.daily;
  const weekTotal = daily.reduce((s, d) => s + d.total, 0);
  const max = Math.max(100, ...daily.map((d) => d.total));
  const metrics = [
    {
      label: "💰 Vendido hoy",
      value: money(daily.at(-1)?.total || 0),
      detail: `${daily.at(-1)?.count || 0} entregas registradas`,
      section: "sales",
      tone: "aqua",
    },
    {
      label: "📈 Últimos 7 días",
      value: money(weekTotal),
      detail: `${daily.reduce((s, d) => s + d.count, 0)} entregas registradas`,
      section: "sales",
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
      <Button onClick={onAddStock}>
        <Plus className="size-4" />
        Agregar stock
      </Button>
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
                    className="flex w-full items-center justify-between text-left text-sm"
                  >
                    <span>{p.platform}</span>
                    <b className="seller-badge">{p.available}</b>
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
          <p className="seller-caption">Ganancia estimada del mes</p>
          <strong className="text-2xl">
            {summary.marginSales ? money(summary.margin) : "Sin datos completos"}
          </strong>
          <p className="mt-2 text-xs text-muted-foreground">
            {summary.marginSales} ventas con costo y precio válidos. No incluye gastos operativos.
          </p>
        </article>
        <article className="seller-card">
          <p className="seller-caption">Vencidas / bajas</p>
          <strong className="text-2xl">{summary.expired}</strong>
          <p className="mt-2 text-xs text-muted-foreground">
            Actualizado:{" "}
            {new Date(summary.updatedAt).toLocaleString("es-MX", { timeZone: "America/Monterrey" })}
          </p>
        </article>
      </div>
    </div>
  );
}
export function SellerWorkspace({ onCatalog }: { onCatalog: () => void }) {
  const store = useCatalogStore();
  const [section, setSection] = useState<Section>("home");
  const [records, setRecords] = useState<OpsRecord[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("main");
  const [addStock, setAddStock] = useState(false);
  const [walletClient, setWalletClient] = useState("");
  const [settings, setSettings] = useState(false);
  const [service, setService] = useState(false);
  const [design, setDesign] = useState(normalizeAppearance(store.catalog.appearance));
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
    setDesign(normalizeAppearance(store.catalog.appearance));
  }, [store.catalog.appearance]);
  const navigate = (s: Section) => {
    setSection(s);
    setTab("main");
    setAddStock(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const resource = (module: Module) => (
    <ResourcePanel
      key={module}
      module={module}
      records={records}
      entries={entries}
      reload={load}
      onWallet={(id) => {
        setWalletClient(id);
        navigate("wallet");
      }}
    />
  );
  let content: ReactNode;
  if (section === "home")
    content = summary ? (
      <SellerHome
        summary={summary}
        clients={records.filter((r) => r.module === "clients").length}
        onNavigate={navigate}
        onAddStock={() => {
          navigate("inventory");
          setAddStock(true);
        }}
      />
    ) : null;
  else if (section === "inventory")
    content = <StockManagerDialog key={String(addStock)} embedded autoAdd={addStock} />;
  else if (section === "expiry") content = <StockInsights />;
  else if (section === "sales") content = <StockInsights sales />;
  else if (section === "wallet" || section === "credit")
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
    content = (
      <>
        <div className="seller-tabs">
          <button className={tab === "main" ? "active" : ""} onClick={() => setTab("main")}>
            Cyberdoc
          </button>
          <button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}>
            Por encargo
          </button>
        </div>
        {tab === "main" ? <CyberDocsOrdersDialog embedded /> : resource("requests")}
      </>
    );
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
  else if (section === "gallery")
    content = (
      <div className="seller-card">
        <GalleryContents />
      </div>
    );
  else if (section === "deliveries") content = <ProtectedDeliveriesDialog embedded />;
  else if (section === "catalogs") content = <MenusDialog embedded />;
  else if (section === "helpers") content = <HelpersPanel />;
  else if (section === "assistant") content = <BusinessAssistant records={records} />;
  else if (section === "games" || section === "memory")
    content = <GamesPanel key={section} memory={section === "memory"} />;
  else if (section === "appearance")
    content = (
      <div className="seller-card space-y-4">
        <label className="seller-field">
          <span>Catálogo a personalizar</span>
          <select value={store.catalogId} onChange={(e) => store.setCatalogId(e.target.value)}>
            {Object.values(store.state.catalogs).map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <AppearanceEditor value={design} onChange={setDesign} onBusyChange={setUploading} />
        <Button
          disabled={uploading}
          onClick={() => {
            store.updateCatalog({ appearance: design });
            toast.success("Diseño actualizado. Se sincronizará con tu catálogo.");
          }}
        >
          Guardar portada y diseño
        </Button>
        <Button variant="outline" onClick={() => setSettings(true)}>
          Colores, nombre y WhatsApp
        </Button>
      </div>
    );
  else if (section === "settings")
    content = (
      <>
        <div className="seller-tabs">
          {[
            ["main", "Contacto y mensajes"],
            ["notifications", "Notificaciones"],
            ["tools", "Respaldos y sistema"],
          ].map(([v, l]) => (
            <button key={v} className={tab === v ? "active" : ""} onClick={() => setTab(v)}>
              {l}
            </button>
          ))}
        </div>
        {tab === "main" ? (
          resource("config")
        ) : tab === "notifications" ? (
          <NotificationsDialog embedded />
        ) : (
          <div className="seller-card space-y-4">
            <AdminBar />
            <SystemStatusDialog />
            <MethodsDialog />
            <Button onClick={() => setSettings(true)}>Ajustes del catálogo</Button>
          </div>
        )}
      </>
    );
  else if (section === "combos") {
    const combos = store.catalog.services.filter((s) =>
      /combo|paquete/i.test(
        `${s.name} ${store.catalog.categories.find((c) => c.id === s.categoryId)?.name}`,
      ),
    );
    content = (
      <div className="space-y-4">
        <div className="seller-actions">
          <Button onClick={() => setService(true)}>Agregar combo al catálogo</Button>
          <Button variant="outline" onClick={onCatalog}>
            Editar servicios y precios
          </Button>
        </div>
        {combos.length ? (
          <div className="seller-record-grid">
            {combos.map((c) => (
              <article className="seller-card" key={c.id}>
                <h3 className="font-bold">{c.name}</h3>
                <p className="text-2xl font-bold mt-2">{money(c.price)}</p>
                <p className="text-sm mt-2">{c.description}</p>
                <Button variant="outline" className="mt-3" onClick={onCatalog}>
                  Editar en catálogo
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="🍔"
            title="Todavía no hay combos en este catálogo"
            description="Agrega un servicio con el nombre Combo o Paquete, o asígnalo a una categoría de combos."
          />
        )}
      </div>
    );
  } else if (section === "subscription")
    content = (
      <div className="seller-card space-y-4">
        <h3 className="font-bold">Planes de tus catálogos</h3>
        <p className="text-sm text-muted-foreground">
          Configura planes, instrucciones de pago, demos y solicitudes de contratación. La
          activación de pagos se confirma desde tu panel.
        </p>
        <SalesDialog />
        <MenusDialog />
      </div>
    );
  else content = resource(section as Module);
  return (
    <SellerLayout
      section={section}
      appearance={store.catalog.appearance}
      onSection={navigate}
      name={store.catalog.name}
      shareUrl={buildCatalogLink(store.catalogId)}
      dark={store.prefs.themeMode === "oscuro"}
      onTheme={() =>
        store.setPrefs({ themeMode: store.prefs.themeMode === "oscuro" ? "claro" : "oscuro" })
      }
      onLogout={store.logout}
      onCatalog={onCatalog}
      onNotifications={() => {
        navigate("settings");
        setTab("notifications");
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
