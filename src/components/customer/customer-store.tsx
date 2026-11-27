import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Menu,
  X,
  Home,
  ShoppingBag,
  Wallet,
  Package,
  LifeBuoy,
  Bell,
  History,
  User,
  LogOut,
  Copy,
  Eye,
  EyeOff,
  Moon,
  Sun,
} from "lucide-react";
import { toast } from "sonner";
import { adminSessionLogout, adminSessionValidate } from "@/lib/admin-session.functions";
import { clearCode } from "@/lib/notify/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from "@/components/ui/sheet";
import {useIsMobile} from "@/hooks/use-mobile";
import {useMa2Appearance} from "@/hooks/use-ma2-appearance";
import { StoreNotices } from "@/components/workspace/store-notices";
import { Storefront } from "@/components/customer/storefront";
import { prepareGalleryImage } from "@/lib/gallery/image";
import { AccessLoading } from "@/components/customer/access-loading";
import { BusinessCover } from "@/components/catalog/business-cover";
import { appearanceStyle, normalizeAppearance } from "@/lib/appearance/theme";
import { reportAvailability, reportClosedMessage } from "@/lib/reports/settings";
import { CustomerRecharge } from "@/components/recharges/customer-recharge";
import { copyText } from "@/lib/browser/clipboard";
import { mainStoreLink, type MainStoreView } from "@/lib/catalog/links";
import { pricingKey } from "@/lib/customer/pricing";
import { groupProducts } from "@/lib/customer/group-products";
import { money, phoneNumber, STATUS } from "@/lib/workspace/model";
import {customerIdentityOptions,customerRequestRecovery} from "@/lib/customer/identity.functions";
import {isCyberdocLogin} from "@/lib/customer/identity-policy";
import {
  customerShopInfo,
  customerSignUp,
  customerSignIn,
  customerSignOut,
  customerLoad,
  customerProducts,
  customerBuy,
  customerDelivery,
  customerWebDelivery,
  customerSubmit,
  customerChangePassword,
  customerDocument,
} from "@/lib/customer/customer.functions";
type View = Awaited<ReturnType<typeof customerLoad>>;
type Product = Awaited<ReturnType<typeof customerProducts>>[number];
const err = (e: unknown) => (e instanceof Error ? e.message : "No se pudo completar la operación");
const tabs = [
  ["inicio", "Inicio", Home],
  ["tienda", "Tienda", ShoppingBag],
  ["saldo", "Recargar saldo", Wallet],
  ["compras", "Mis compras", Package],
  ["reportes", "Reportes", LifeBuoy],
  ["ayuda", "Ayuda", LifeBuoy],
  ["avisos", "Avisos", Bell],
  ["movimientos", "Movimientos", History],
  ["cuenta", "Mi cuenta", User],
] as const;
export function CustomerStore({ slug, initialView = "inicio", initialQuery = "", initialSku = "" }: { slug: string; initialView?: MainStoreView; initialQuery?: string; initialSku?:string }) {
  const isMobile=useIsMobile();
  const [dark,setDark]=useState(false);
  useEffect(()=>{try{setDark(window.localStorage.getItem("ma2-buyer-theme")==="dark");}catch{}},[]);
  useEffect(()=>{const root=document.documentElement;const previous=root.classList.contains("dark");root.classList.toggle("dark",dark);return()=>{root.classList.toggle("dark",previous);};},[dark]);
  const toggleTheme=()=>{const next=!dark;setDark(next);try{window.localStorage.setItem("ma2-buyer-theme",next?"dark":"light");}catch{}};
  const [shop, setShop] = useState<Awaited<ReturnType<typeof customerShopInfo>> | null>(null),
    [data, setData] = useState<View | null>(null),
    [tab, setTab] = useState<string>(initialView),
    [menu, setMenu] = useState(false),
    [mode, setMode] = useState("login"),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [fatal, setFatal] = useState("");
  const [showLoginPassword,setShowLoginPassword]=useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoverySent, setRecoverySent] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [identityOptions,setIdentityOptions]=useState({google:false,email:false});
  useEffect(()=>{if(slug!=="ma2")return;let active=true;void (async()=>{const v=await customerIdentityOptions().catch(()=>({google:false,email:true}));const google=v.google||await (await import("@/lib/customer/identity-client")).customerGoogleAvailable();if(active)setIdentityOptions({...v,google});})();return()=>{active=false;};},[slug]);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [wa, setWa] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [currentPassword, setCurrentPassword] = useState("");
  const [products, setProducts] = useState<Product[]>([]),
    [productsError, setProductsError] = useState(""),
    [query, setQuery] = useState(initialQuery),
    [sku,setSku]=useState(initialSku),
    [kind, setKind] = useState("all"),
    [ledger, setLedger] = useState("all");
  const [delivery, setDelivery] = useState<Awaited<ReturnType<typeof customerDelivery>> | null>(
      null,
    ),
    [showPassword, setShowPassword] = useState(false),
    [reportTitle, setReportTitle] = useState(""),
    [reportMessage, setReportMessage] = useState(""),
    [reportOrder, setReportOrder] = useState(""),
    [reportEvidence, setReportEvidence] = useState(""),
    [evidenceLoading, setEvidenceLoading] = useState(false),
    [reportKind, setReportKind] = useState<"reports" | "questions" | "requests">("reports");
  const requests = useRef(new Map<string, string>());
  useMa2Appearance(shop?.appearance);
  const load = useCallback(async () => {
    try {
      const d = await customerLoad({ data: { slug } });
      setData(d);
      setShop(d.shop);
      setError("");
      if (d.mustChange) setTab("cuenta");
    } catch (e) {
      setData(null);
      setDelivery(null);
      setError(err(e));
    } finally {
      setLoading(false);
    }
  }, [slug]);
  useEffect(() => {
    setData(null);
    setProducts([]);
    setLoading(true);
    setFatal("");
    customerShopInfo({ data: { slug } })
      .then(setShop)
      .catch((e) => setFatal(err(e)));
    void load();
  }, [slug, load]);
  const loadProducts = useCallback(async () => {
    try {
      setProducts(await customerProducts({ data: { slug } }));
      setProductsError("");
    } catch (e) {
      setProductsError(err(e));
    }
  }, [slug]);
  useEffect(() => {
    if (data && !data.mustChange && (tab === "tienda" || tab === "inicio")) void loadProducts();
  }, [Boolean(data), data?.mustChange, data?.priceTier, tab, loadProducts]);
  useEffect(()=>{
    if(!data)return;
    const refresh=()=>{void load();if(tab==="tienda"||tab==="inicio")void loadProducts();};
    window.addEventListener("focus",refresh);return ()=>window.removeEventListener("focus",refresh);
  },[Boolean(data),tab,load,loadProducts]);
  const [canReturnToPanel, setCanReturnToPanel] = useState(false);
  useEffect(() => {
    if (slug !== "ma2") return;
    let active = true;
    let token = "";
    try { token = window.localStorage.getItem("ma2-admin-session-v2") || ""; }
    catch { return; }
    if (token) {
      void adminSessionValidate({ data: { token } }).then(result => {
        if (active) setCanReturnToPanel(result.valid);
      }).catch(() => undefined);
    }
    return () => { active = false; };
  }, [slug]);
  const support = `https://wa.me/${phoneNumber(shop?.whatsapp || "")}?text=${encodeURIComponent(`Hola, necesito ayuda con mi cuenta de ${shop?.name || "la tienda"}.`)}`;
  function openRecovery(message = "") {
    setRecoveryEmail("");
    setRecoverySent(false);
    setRecoveryError("");
    setRecoveryNotice(message);
    setRecoveryOpen(true);
  }
  const action = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(err(e));
      toast.error(err(e));
    } finally {
      setBusy(false);
    }
  };
  const buy = async (p: Product) => {
    if (
      !data ||
      busy ||
      !confirm(`¿Confirmas comprar ${p.name} por ${money(p.priceCents / 100)} de tu saldo?`)
    )
      return;
    await action(async () => {
      const key = p.id + ":" + p.priceCents;
      let requestId = requests.current.get(key);
      if (!requestId) {
        requestId = crypto.randomUUID();
        requests.current.set(key, requestId);
      }
      const r = await customerBuy({
        data: { slug, stockId: p.id, priceCents: p.priceCents, requestId },
      });
      await load();
      await loadProducts();
      setTab("compras");
      setDelivery(await customerDelivery({ data: { slug, orderId: r.id } }));
      toast.success("Compra confirmada. Tu entrega está en Mis compras.");
    });
  };
  const productGrid = (list: Product[], limit?: number) => (
    <div className="buyer-product-grid">
      {groupProducts(list).slice(0, limit).map(({product: p, count}) => (
        <article key={p.id} className="buyer-product">
          <div className={`buyer-product-cover ${p.kind === "profile" ? "violet" : "aqua"}`}>
            <span className="buyer-pill">
              {p.kind === "profile" ? "👤 Perfil" : "📺 Cuenta completa"}
            </span>
            <h3>{p.name}</h3>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              {p.type} · {p.months} mes(es){p.expiresOn ? ` · vence ${p.expiresOn}` : ""}
            </p>
            <div className="flex items-center justify-between gap-2">
              <strong className="text-xl text-primary">{money(p.priceCents / 100)}</strong>
              <span className="text-xs font-semibold text-emerald-700">● {count} disponible{count === 1 ? "" : "s"}</span>
            </div>
            <Button
              className="w-full"
              disabled={busy || Boolean(data?.mustChange)}
              onClick={() => void buy(p)}
            >
              Comprar con saldo
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
  const [reportTime, setReportTime] = useState(() => new Date());
  useEffect(() => {
    if (tab !== "reportes" || !data?.reportSettings) return;
    setReportTime(new Date());
    const interval = window.setInterval(() => setReportTime(new Date()), 1000 * 15);
    return () => window.clearInterval(interval);
  }, [tab, data?.reportSettings]);
  const reportSettings = reportKind === "reports" ? data?.reportSettings : null;
  const reportWindow = reportSettings && reportAvailability(reportSettings, reportTime);
  const reportsClosed = reportWindow?.open === false;
  if (fatal)
    return (
      <main className="mx-auto max-w-lg p-8">
        <h1 className="text-xl font-bold">Tienda no disponible</h1>
        <p role="alert" className="my-4">
          {fatal}
        </p>
        <Button asChild variant="outline">
          <a href="/">Volver al inicio</a>
        </Button>
      </main>
    );
  if (loading || !shop) return <AccessLoading/>;
  const renderClientMenu=()=>data?<nav className="ma2-client-menu space-y-1" aria-label="Panel de cliente"><div className="rounded-2xl bg-card border p-3 mb-4"><div className="flex items-center gap-2"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 font-bold text-primary">{data.name.slice(0,1).toUpperCase()}</span><div className="min-w-0"><strong className="block truncate">{data.name}</strong><span className="block truncate text-xs text-muted-foreground">{data.email}</span></div></div><p className="mt-3 text-xs text-muted-foreground">Saldo disponible</p><strong className="text-xl text-primary">{money(data.balance)}</strong></div><p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mi cuenta</p>{tabs.map(([key,label,Icon])=><button key={key} className={tab===key?"active":""} aria-current={tab===key?"page":undefined} disabled={data.mustChange&&key!=="cuenta"} onClick={()=>{setTab(key);if(key==="tienda"){setSku("");setQuery("");setKind("all");}if(key==="reportes")setReportKind("reports");if(key==="ayuda")setReportKind("questions");setMenu(false);setError("");window.scrollTo({top:0,behavior:"instant"});}}><Icon className="size-4"/>{label}</button>)}<a href={support} target="_blank" rel="noopener noreferrer"><LifeBuoy className="size-4"/> Ayuda por WhatsApp</a><a href="/plataforma"><ShoppingBag className="size-4"/>Quiero mi propia tienda</a></nav>:null;
  return (
    <main
      className="buyer-app seller-app ma2-unified"
      style={appearanceStyle(normalizeAppearance(shop.appearance))}
      data-season={normalizeAppearance(shop.appearance).season}
    >
      <header className="buyer-top">
        <div className="flex min-w-0 items-center gap-3">
          {data && isMobile ? (
            <button
              className="seller-icon-button shrink-0"
              aria-label={menu ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          ) : null}
          {shop.logoUrl ? (
            <span className="seller-logo"><img className="h-full w-full object-contain" src={shop.logoUrl} alt="" /></span>
          ) : (
            <span className="seller-logo">MA²</span>
          )}
          <div className="min-w-0">
            <p className="buyer-header-label text-xs text-muted-foreground">{data ? data.priceTier === "reseller" ? "MI CUENTA · REVENDEDOR" : "MI CUENTA" : "BIENVENIDO"}</p>
            <h1 className="font-bold truncate">{shop.name}</h1>
          </div>
        </div>
        <div className="flex shrink-0 gap-1 items-center">
          {canReturnToPanel && <Button asChild variant="outline" size="sm">
            <a href="/?panel=1"><ArrowLeft /> <span>Mi panel</span></a>
          </Button>}
          <button type="button" className="seller-icon-button" aria-label={dark?"Activar modo claro":"Activar modo oscuro"} onClick={toggleTheme}>{dark?<Sun className="size-4"/>:<Moon className="size-4"/>}</button>
          {data ? (
            <>
              <button
                className="buyer-balance"
                onClick={() => {
                  setTab("saldo");
                  setMenu(false);
                }}
              >
                {money(data.balance)}
              </button>
              <button
                type="button"
                className="seller-exit"
                aria-label="Salir"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await customerSignOut();
                    setData(null);
                    setDelivery(null);
                    setReportEvidence("");
                    setReportMessage("");
                    setReportTitle("");
                    setReportOrder("");
                    setProducts([]);
                    setPassword("");
                    setShowLoginPassword(false);
                    setError("");
                    setTab("inicio");
                  })
                }
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline ml-1">Salir</span>
              </button>
            </>
          ) : null}
        </div>
      </header>
      {!data ? (
        <div className="buyer-auth ma2-login-layout">
          <section className="space-y-4 ma2-login-promo">
            <p className="buyer-eyebrow">TU TIENDA DIGITAL</p>
            <h2 className="text-3xl font-extrabold">
              Todo lo que compras,
              <br />
              en un mismo lugar.
            </h2>
            <p className="text-muted-foreground">
              Entra para recargar saldo, comprar productos disponibles, consultar tus entregas y
              recibir soporte.
            </p>
            <BusinessCover appearance={normalizeAppearance(shop.appearance)} name={shop.name} />
            {!shop.id&&<><div className="ma2-brand-promo p-5"><p className="text-xs font-bold uppercase tracking-wide text-primary">Servicios digitales MA²</p><h3 className="mt-2 text-xl font-extrabold">Contrata tus plataformas favoritas</h3><p className="mt-2 text-sm text-muted-foreground">Crea tu cuenta, recarga saldo y compra tus servicios de streaming o solicita entregas por encargo.</p></div><StoreNotices/></>}
            {shop.id&&<a className="text-sm text-primary underline" href="/plataforma">
              ¿Tienes un negocio? Contrata tu propia tienda
            </a>}
          </section>
          <form
            className="seller-card ma2-login-card space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                if (mode === "register") {
                  if (password !== confirmation) throw new Error("Las contraseñas no coinciden");
                  await customerSignUp({ data: { slug, email, password, name, whatsapp: wa } });
                } else {
                  const result = await customerSignIn({ data: { slug, email, password } });
                  if (!result.ok) {
                    setPassword("");
                    setShowLoginPassword(false);
                    openRecovery("Llegaste al límite de 5 intentos. Recupera tu contraseña para volver a entrar.");
                    return;
                  }
                  if (result.role === "admin") {
                    try {
                      clearCode();
                      window.localStorage.setItem("ma2-admin-session-v2", result.token);
                    } catch {
                      await adminSessionLogout({ data: { token: result.token } });
                      throw new Error("Permite el almacenamiento del navegador para iniciar sesión.");
                    }
                    setPassword("");
                    window.location.assign("/?panel=1");
                    return;
                  }
                }
                if (!shop.id) {
                  const previous = window.localStorage.getItem("ma2-admin-session-v2");
                  window.localStorage.removeItem("ma2-admin-session-v2");
                  clearCode();
                  if (previous) await adminSessionLogout({ data: { token: previous } }).catch(() => undefined);
                }
                setPassword("");
                setShowLoginPassword(false);
                setConfirmation("");
                if(!shop.id&&initialView==="cuenta")setTab("inicio");
                await load();
              });
            }}
          >
            <div className="flex items-center gap-3"><span className="seller-logo">{shop.logoUrl?<img className="h-full w-full object-contain" src={shop.logoUrl} alt=""/>:"MA²"}</span><div><p className="text-xs font-semibold text-primary">ACCESO MA²</p><h2 className="text-xl font-bold">{mode==="register"?"Crea tu cuenta":"Bienvenido de nuevo"}</h2></div></div>
            <p className="text-sm text-muted-foreground">
              {mode === "register" ? "Regístrate con tus datos para empezar." : "Ingresa con el correo y contraseña de tu cuenta."}
            </p>
            {mode === "register" ? (
              <>
                <label className="seller-field">
                  <span>Tu nombre</span>
                  <Input
                    required
                    minLength={2}
                    maxLength={100}
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="seller-field">
                  <span>WhatsApp</span>
                  <Input
                    required
                    type="tel"
                    autoComplete="tel"
                    value={wa}
                    onChange={(e) => setWa(e.target.value)}
                  />
                </label>
              </>
            ) : null}
            <label className="seller-field">
              <span>Correo</span>
              <Input
                required
                type="email"
                autoComplete="username"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="seller-field">
              <span>Contraseña</span>
              <div className="relative"><Input
                required
                className="pr-11"
                type={showLoginPassword?"text":"password"}
                minLength={mode === "register" ? 10 : 1}
                maxLength={128}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              /><button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground" aria-label={showLoginPassword?"Ocultar contraseña":"Mostrar contraseña"} onClick={()=>setShowLoginPassword(v=>!v)}>{showLoginPassword?<EyeOff className="size-4"/>:<Eye className="size-4"/>}</button></div>
            </label>
            {mode === "register" ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Al menos 10 caracteres con letras y números.
                </p>
                <label className="seller-field">
                  <span>Confirmar contraseña</span>
                  <Input
                    required
                    type="password"
                    maxLength={128}
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                  />
                </label>
              </>
            ) : null}
            {error && !/Inicia sesión|sesión terminó/i.test(error) ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button disabled={busy} className="w-full">
              {busy
                ? "Procesando…"
                : mode === "register"
                  ? "Crear cuenta y entrar"
                  : "Entrar"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">{mode==="register"?"¿Ya tienes cuenta?":"¿Todavía no tienes cuenta?"} <button type="button" className="font-bold text-primary underline-offset-4 hover:underline" onClick={()=>{setMode(mode==="register"?"login":"register");setPassword("");setConfirmation("");setShowLoginPassword(false);setError("");}}>{mode==="register"?"Entrar":"Regístrate aquí"}</button></p>
            {!shop.id && mode === "login" && (
              <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={() => openRecovery()}>
                Olvidé mi contraseña
              </Button>
            )}
            {!shop.id&&mode==="login"&&!isCyberdocLogin(email)&&identityOptions.google&&<Button type="button" variant="outline" className="w-full" disabled={busy} onClick={()=>void action(async()=>{await (await import("@/lib/customer/identity-client")).startCustomerGoogle();})}>Continuar con Google</Button>}
            {!shop.id&&isCyberdocLogin(email)&&<p className="text-xs text-muted-foreground">Acceso Cyberdoc. Conserva tu correo y contraseña; no está habilitada la recuperación automática.</p>}
            <a
              className="block text-sm text-primary underline"
              href={support}
              target="_blank"
              rel="noopener noreferrer"
            >
              ¿Necesitas ayuda? Contactar soporte
            </a>
            {!shop.id && (
              <Button className="w-full" variant="outline" asChild>
                <a href="/plataforma">Quiero mi propia tienda</a>
              </Button>
            )}
          </form>
        </div>
      ) : (
        <div className="buyer-shell">
          {isMobile?<Sheet open={menu} onOpenChange={setMenu}><SheetContent side="left" className="ma2-client-drawer w-[85vw] max-w-sm overflow-y-auto p-4"><SheetHeader className="sr-only"><SheetTitle>Mi cuenta</SheetTitle><SheetDescription>Elige una sección de tu cuenta MA².</SheetDescription></SheetHeader>{renderClientMenu()}</SheetContent></Sheet>:<aside className="buyer-nav">{renderClientMenu()}</aside>}
          <section className="buyer-content">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="buyer-eyebrow">{shop.name}</p>
                <h2 className="text-2xl font-extrabold">
                  {tab === "inicio" ? `Hola, ${data.name}` : tabs.find((t) => t[0] === tab)?.[1]}
                </h2>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await load();
                    if (tab === "tienda") await loadProducts();
                  })
                }
              >
                Actualizar
              </Button>
            </div>
            {error ? (
              <p role="alert" className="seller-error mb-4">
                {error}
              </p>
            ) : null}
            {tab === "inicio" ? (
              <>
                {!shop.id && (
                  <Button className="mb-4" variant="outline" asChild>
                    <a href="/plataforma">Quiero mi propia tienda</a>
                  </Button>
                )}
                <div className="buyer-metrics ma2-client-metrics">
                  <article className="aqua">
                    <Wallet />
                    <span>Saldo disponible</span>
                    <strong>{money(data.balance)}</strong>
                    <button onClick={() => setTab("saldo")}>Recargar →</button>
                  </article>
                  <article className="rose">
                    <ShoppingBag />
                    <span>Total gastado</span>
                    <strong>
                      {money(
                        -data.entries
                          .filter((e) => e.kind === "purchase")
                          .reduce((n, e) => n + e.amount_cents, 0) / 100,
                      )}
                    </strong>
                    <small>En los últimos movimientos</small>
                  </article>
                  <article className="violet">
                    <Package />
                    <span>Compras</span>
                    <strong>{data.orders.length + data.webOrders.length}</strong>
                    <button onClick={() => setTab("compras")}>Ver mis entregas →</button>
                  </article>
                </div>
                <BusinessCover appearance={normalizeAppearance(shop.appearance)} name={shop.name} />
                {!shop.id&&<><section className="seller-card space-y-3"><h3 className="font-bold text-lg">¿Qué necesitas hoy?</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{([["tienda","Comprar servicios",ShoppingBag],["saldo","Recargar saldo",Wallet],["compras","Mis compras",Package],["reportes","Reportar una falla",LifeBuoy],["movimientos","Mis movimientos",History],["cuenta","Mi perfil",User]] as const).map(([v,label,Icon])=><button key={v} onClick={()=>{setTab(v);if(v==="tienda"){setSku("");setQuery("");}if(v==="reportes"){setReportKind("reports");setReportOrder("");setReportTitle("");setReportMessage("");}}} className="flex flex-col items-center gap-2 rounded-xl border bg-card p-3 text-center text-sm font-semibold"><Icon className="size-6 text-primary"/>{label}</button>)}</div></section><StoreNotices/></>}
                <div className="flex justify-between items-center my-5">
                  <h3 className="font-bold">Disponible en la tienda</h3>
                  <button className="text-sm text-primary" onClick={() => {setSku("");setQuery("");setTab("tienda");}}>
                    Ver todo →
                  </button>
                </div>
                {productsError ? (
                  <p role="alert">{productsError}</p>
                ) : products.length ? (
                  productGrid(products, 4)
                ) : (
                  <p className="seller-card text-muted-foreground">
                    Todavía no hay productos listos para compra con saldo. Consulta la tienda o
                    pide ayuda por WhatsApp.
                  </p>
                )}
              </>
            ) : null}
            {tab === "tienda" ? (!shop.id&&!sku?<Storefront embedded onPurchase={() => void load()} onSelect={(key,name)=>{setSku(key);setQuery(name);setKind("all");void loadProducts();}}/>:
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  {data.priceTier === "reseller" ? "Estás viendo las tarifas de revendedor. Solo aparecen productos con precio de revendedor configurado." : "Precios para cliente normal."} Disponibilidad y precio comprobados al comprar. Recibe tus accesos aquí mismo.
                </p>
                {!shop.id&&<Button variant="outline" className="mb-3" onClick={()=>{setSku("");setQuery("");}}>Volver a todos los productos</Button>}
                <Input
                  aria-label="Buscar producto"
                  placeholder="Buscar plataforma o producto…"
                  value={query}
                  onChange={(e) => {setSku("");setQuery(e.target.value);}}
                />
                <div className="seller-tabs">
                  {[
                    ["all", "Todos"],
                    ["profile", "Perfiles"],
                    ["complete", "Completas"],
                  ].map(([v, l]) => (
                    <button
                      className={kind === v ? "active" : ""}
                      key={v}
                      onClick={() => setKind(v)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                {productsError ? (
                  <p role="alert" className="seller-error">
                    {productsError}
                  </p>
                ) : null}
                {productGrid(
                  products.filter(
                    (p) =>
                      (kind === "all" || p.kind === kind) &&
                      (sku ? pricingKey(p.name,p.kind,p.months)===sku : `${p.name} ${p.type}`.toLowerCase().includes(query.toLowerCase())),
                  ),
                )}
                {!products.length ? (
                  <p className="seller-card text-muted-foreground">
                    El negocio debe cargar credenciales y precio en su stock para habilitar compras
                    con saldo.
                  </p>
                ) : null}
                {shop.id&&<Button variant="outline" className="mt-5" asChild><a href={`/${encodeURIComponent(shop.slug)}`}>Catálogo y pedidos por WhatsApp</a></Button>}
              </>
            ) : null}
            {tab === "saldo" ? (
              <>
                <CustomerRecharge id="" token="" shopSlug={slug} permanentReference={data.clientReference} onBalanceChange={load} />
                <div className="seller-card mt-4">
                  <h3 className="font-bold">Recargar con el negocio</h3>
                  <p className="text-sm text-muted-foreground my-3">
                    Solicita los datos de pago a soporte. El negocio verifica el pago y abona a tu
                    cuenta.
                  </p>
                  <Button asChild>
                    <a href={support} target="_blank" rel="noopener noreferrer">
                      Abrir WhatsApp
                    </a>
                  </Button>
                </div>
              </>
            ) : null}
            {tab === "compras" ? (
              <div className="space-y-3">
                {data.webOrders.map(order => (
                  <article key={order.id} className="seller-card space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <h3 className="font-bold break-words">{order.title}</h3>
                        <p className="text-sm text-muted-foreground">{({completed:"Entregado", in_process:"En proceso", cancelled:"Cancelado", rejected:"Rechazado"} as Record<string,string>)[order.status] || "Pagado · pendiente de entrega"}</p>
                      </div>
                      <strong className="shrink-0">{money(order.total)}</strong>
                    </div>
                    {order.status === "completed" && <div className="grid gap-2 sm:flex">
                      <Button size="sm" disabled={busy} onClick={() => void action(async () => {
                        setShowPassword(false);
                        setDelivery(await customerWebDelivery({ data: { slug, orderId: order.id } }));
                      })}>Ver acceso y guía</Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setReportKind("reports");
                        setReportOrder(order.id);
                        setReportTitle(`Falla en ${order.title}`.slice(0,160));
                        setTab("reportes");
                        window.scrollTo({top:0});
                      }}>Reportar falla</Button>
                    </div>}
                  </article>
                ))}{data.records.filter(r=>r.module==="requests"&&r.status==="completed").map(r=><article key={r.id} className="seller-card space-y-2"><h3 className="font-bold">{r.title}</h3><p className="text-sm text-muted-foreground">Entrega registrada</p>{r.deliveryUrl&&<Button asChild size="sm"><a href={r.deliveryUrl} target="_blank" rel="noopener noreferrer">Abrir documento</a></Button>}{r.reply&&<Button variant="outline" size="sm" onClick={()=>void copyText(r.reply)}>Copiar datos de entrega</Button>}</article>)}
                {data.records
                  .filter((r) => ["documents", "codes"].includes(r.module))
                  .map((r) => (
                    <article className="seller-card space-y-3" key={r.id}>
                      <h3 className="font-bold">{r.title}</h3>
                      {r.module === "codes" ? (
                        <>
                          <code className="text-xl tracking-widest">{r.value}</code>
                          <Button variant="outline" onClick={() => void copyText(r.value)}>
                            Copiar código
                          </Button>
                        </>
                      ) : (
                        <Button
                          disabled={busy}
                          onClick={() =>
                            void action(async () => {
                              const doc = await customerDocument({
                                data: { slug, documentId: r.id },
                              });
                              const a = document.createElement("a");
                              a.href = doc.attachment;
                              a.download = doc.filename;
                              a.click();
                            })
                          }
                        >
                          Descargar documento
                        </Button>
                      )}
                    </article>
                  ))}
                {data.orders.length ? (
                  data.orders.map((o) => (
                    <article className="seller-card" key={o.id}>
                      <div className="flex justify-between gap-3">
                        <h3 className="font-bold">{o.title}</h3>
                        <strong>{money(o.amount_cents / 100)}</strong>
                      </div>
                      <p className="text-xs text-muted-foreground my-3">
                        {new Date(o.created_at).toLocaleString("es-MX")}
                        {o.expires_on ? ` · Vence ${o.expires_on}` : ""}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          disabled={busy}
                          onClick={() =>
                            void action(async () => {
                              setShowPassword(false);
                              setDelivery(
                                await customerDelivery({ data: { slug, orderId: o.id } }),
                              );
                            })
                          }
                        >
                          Ver entrega
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setReportKind("reports");
                            setReportOrder(o.id);
                            setReportTitle("Soporte · " + o.title);
                            setTab("reportes");
                          }}
                        >
                          Reportar una falla
                        </Button>
                      </div>
                    </article>
                  ))
                ) : data.webOrders.length ? null : (
                  <p className="seller-card text-muted-foreground">
                    Tus compras y entregas aparecerán aquí.
                  </p>
                )}
              </div>
            ) : null}
            {tab === "reportes" || tab === "ayuda" ? (
              <>
                {tab==="ayuda"&&<div className="space-y-3 mb-4">{data.records.filter(r=>r.module==="faq").map(r=><article key={r.id} className="seller-card"><h3 className="font-bold">{r.title}</h3><p className="text-sm mt-2">{r.message}</p></article>)}</div>}
                <form
                  className="seller-card space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (reportsClosed) return;
                    void action(async () => {
                      await customerSubmit({
                        data: {
                          slug,
                          module: reportKind,
                          title: reportTitle,
                          message: reportMessage,
                          ...(reportOrder ? { orderId: reportOrder } : {}),
                          ...(reportKind === "reports" && reportEvidence ? { evidence: reportEvidence } : {}),
                        },
                      });
                      setReportTitle("");
                      setReportMessage("");
                      setReportEvidence("");
                      setReportOrder("");
                      await load();
                      toast.success(reportKind === "reports" ? "Reporte enviado. Puedes consultar la respuesta aquí." : "Solicitud enviada al negocio");
                    });
                  }}
                >
                  <label className="seller-field">
                    <span>Tipo de solicitud</span>
                    <select
                      className="buyer-select"
                      value={reportKind}
                      onChange={(e) => {
                        const kind = e.target.value as typeof reportKind;
                        setReportKind(kind);
                        setTab(kind === "reports" ? "reportes" : "ayuda");
                      }}
                    >
                      <option value="reports">Reportar falla</option>
                      <option value="questions">Pregunta / ayuda</option>
                      <option value="requests">Pedido por encargo</option>
                    </select>
                  </label>
                  {reportsClosed && <p role="status" className="rounded-xl border bg-muted/40 p-3 text-sm">
                    {reportClosedMessage(reportWindow.next)}
                  </p>}
                  <label className="seller-field">
                    <span>Compra relacionada</span>
                    <select
                      className="buyer-select"
                      value={reportOrder}
                      required={reportSettings?.allowManual === false}
                      onChange={(e) => setReportOrder(e.target.value)}
                    >
                      <option value="">{reportSettings?.allowManual === false ? "Selecciona una compra" : "Sin compra relacionada"}</option>
                      {[...data.orders, ...data.webOrders.filter(o=>!["cancelled","rejected"].includes(o.status))].map((o) => (
                        <option key={o.id} value={o.id}>{o.title}</option>
                      ))}
                    </select>
                  </label>
                  <label className="seller-field">
                    <span>Asunto</span>
                    <Input
                      required
                      minLength={2}
                      maxLength={160}
                      value={reportTitle}
                      onChange={(e) => setReportTitle(e.target.value)}
                    />
                  </label>
                  <label className="seller-field">
                    <span>Describe lo que necesitas</span>
                    <Textarea
                      required
                      minLength={2}
                      maxLength={2000}
                      value={reportMessage}
                      onChange={(e) => setReportMessage(e.target.value)}
                    />
                  </label>
                  {reportKind === "reports" && <div className="space-y-2">
                    <label className="seller-field"><span>Captura de la falla{reportSettings?.requireEvidence ? " (obligatoria)" : " (opcional)"}</span>
                      <Input type="file" accept="image/*" disabled={busy || evidenceLoading} onChange={async event => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = "";
                        if (!file) return;
                        setEvidenceLoading(true);
                        try { setReportEvidence((await prepareGalleryImage(file)).image); }
                        catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo agregar la captura"); }
                        finally { setEvidenceLoading(false); }
                      }} />
                    </label>
                    {reportEvidence && <Button type="button" variant="ghost" size="sm" onClick={()=>setReportEvidence("")}>Quitar captura</Button>}
                  </div>}
                  <Button disabled={busy || evidenceLoading || reportsClosed || (reportSettings?.requireEvidence && !reportEvidence)}>{reportKind === "reports" ? "Enviar reporte" : "Enviar solicitud"}</Button>
                </form>
                <div className="mt-4 space-y-3">
                  {data.records
                    .filter((r) => tab === "reportes" ? r.module === "reports" : ["questions", "requests"].includes(r.module))
                    .map((r) => (
                      <article className="seller-card" key={r.id}>
                        <h3 className="font-bold">{r.title}</h3>
                        <span className="text-xs text-primary">{STATUS[r.status] || r.status}</span>
                        {r.purchaseTitle && <p className="mt-2 text-xs text-muted-foreground">Compra: {r.purchaseTitle}</p>}
                        <p className="text-sm whitespace-pre-wrap mt-2">{r.message}</p>
                        {r.reply ? (
                          <p className="rounded-xl bg-primary/5 p-3 mt-3 text-sm whitespace-pre-wrap">
                            <b>Respuesta del negocio:</b> {r.reply}
                          </p>
                        ) : null}
                        {r.deliveryUrl && /^https?:\/\//i.test(r.deliveryUrl) ? (
                          <Button asChild variant="outline" className="mt-3">
                            <a href={r.deliveryUrl} target="_blank" rel="noopener noreferrer">
                              Ver entrega del pedido
                            </a>
                          </Button>
                        ) : null}
                      </article>
                    ))}
                </div>
              </>
            ) : null}
            {tab === "avisos" ? (
              <div className="space-y-3">
                {data.records
                  .filter((r) => r.module==="notices")
                  .map((r) => (
                    <article className="seller-card" key={r.id}>
                      <h3 className="font-bold">{r.title}</h3>
                      <p className="text-sm whitespace-pre-wrap mt-3">{r.message}</p>
                    </article>
                  ))}
                {!data.records.some((r) => r.module==="notices") ? (
                  <p className="seller-card text-muted-foreground">No hay avisos nuevos.</p>
                ) : null}
              </div>
            ) : null}
            {tab === "movimientos" ? (
              <>
                <div className="seller-tabs">
                  {[
                    ["all", "Todos"],
                    ["purchase", "Compras"],
                    ["recharge", "Recargas"],
                    ["withdrawal", "Retiros"],
                  ].map(([v, l]) => (
                    <button
                      className={ledger === v ? "active" : ""}
                      key={v}
                      onClick={() => setLedger(v)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {data.entries
                    .filter((e) => ledger === "all" || e.kind === ledger)
                    .map((e) => (
                      <article className="seller-card flex justify-between gap-3" key={e.id}>
                        <div>
                          <p className="text-sm font-semibold">{e.note}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(e.created_at).toLocaleString("es-MX")}
                          </p>
                        </div>
                        <strong
                          className={e.amount_cents > 0 ? "text-emerald-700" : "text-rose-600"}
                        >
                          {e.amount_cents > 0 ? "+" : ""}
                          {money(e.amount_cents / 100)}
                        </strong>
                      </article>
                    ))}
                  {!data.entries.length ? (
                    <p className="seller-card text-muted-foreground">Todavía no hay movimientos.</p>
                  ) : null}
                </div>
              </>
            ) : null}
            {tab === "cuenta" ? (
              <div className="space-y-4">
                <section className="seller-card">
                  <h3 className="font-bold">Tus datos</h3>
                  <p className="text-sm mt-3">{data.name}</p>
                  <p className="text-sm text-muted-foreground">{data.email}</p>
                  {data.clientReference&&<p className="mt-2 text-sm font-semibold">Referencia permanente: {data.clientReference}</p>}
                </section>
                <form
                  className="seller-card space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(async () => {
                      if (password !== confirmation)
                        throw new Error("Las contraseñas no coinciden");
                      await customerChangePassword({ data: { slug, currentPassword, password } });
                      setCurrentPassword("");
                      setPassword("");
                      setConfirmation("");
                      await load();
                      toast.success("Contraseña actualizada");
                    });
                  }}
                >
                  <h3 className="font-bold">
                    {data.mustChange
                      ? "Cambia tu contraseña temporal para continuar"
                      : "Cambiar mi contraseña"}
                  </h3>
                  <label className="seller-field">
                    <span>Contraseña actual</span>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      maxLength={128}
                    />
                  </label>
                  <label className="seller-field">
                    <span>Nueva contraseña · 10 caracteres, letras y números</span>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      minLength={10}
                      maxLength={128}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>
                  <label className="seller-field">
                    <span>Confirmar nueva contraseña</span>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                    />
                  </label>
                  <Button disabled={busy}>Guardar contraseña</Button>
                </form>
              </div>
            ) : null}
          </section>
        </div>
      )}
      <Dialog open={recoveryOpen} onOpenChange={(open) => {
        if (!recoveryBusy) setRecoveryOpen(open);
      }}>
        <DialogContent hideClose={recoveryBusy} className="w-[calc(100%-2rem)] max-w-md rounded-2xl bg-card">
          <DialogHeader className="pr-6">
            <DialogTitle>Recuperar contraseña</DialogTitle>
            <DialogDescription>
              {recoverySent
                ? "Si el correo está registrado, recibirás un enlace para crear una contraseña nueva. Si no lo ves en tu bandeja de entrada, revisa la carpeta de Spam o correo no deseado."
                : [recoveryNotice, "Escribe de nuevo el correo con el que registraste tu cuenta."].filter(Boolean).join(" ")}
            </DialogDescription>
          </DialogHeader>
          {recoverySent ? (
            <Button type="button" onClick={() => setRecoveryOpen(false)}>Volver a iniciar sesión</Button>
          ) : (
            <form className="space-y-4" onSubmit={async (event) => {
              event.preventDefault();
              if (recoveryBusy) return;
              if (isCyberdocLogin(recoveryEmail)) {
                setRecoveryError("Para una cuenta de Cyberdoc, contacta a soporte para recuperar el acceso.");
                return;
              }
              setRecoveryBusy(true);
              setRecoveryError("");
              try {
                await customerRequestRecovery({data: {email: recoveryEmail.trim()}});
                setRecoverySent(true);
              } catch {
                setRecoveryError("No se pudo solicitar el enlace. Intenta más tarde.");
              } finally {
                setRecoveryBusy(false);
              }
            }}>
              <label className="seller-field">
                <span>Correo electrónico</span>
                <Input type="email" autoComplete="email" required maxLength={254} disabled={recoveryBusy}
                  value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} />
              </label>
              {recoveryError && <p role="alert" className="text-sm text-destructive">{recoveryError}</p>}
              <Button type="submit" disabled={recoveryBusy} className="w-full">
                {recoveryBusy ? "Solicitando enlace…" : "Enviar enlace"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(delivery)}
        onOpenChange={(v) => {
          if (!v) {
            setDelivery(null);
            setShowPassword(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{delivery?.title || "Tu entrega"}</DialogTitle>
            <DialogDescription>
              Acceso y guía de ingreso
            </DialogDescription>
          </DialogHeader>
          {delivery ? (
            <div className="space-y-4">
              {delivery.link && <Button asChild className="w-full"><a href={delivery.link} target="_blank" rel="noopener noreferrer">Abrir acceso</a></Button>}
              {delivery.notes && <div className="rounded-xl bg-muted px-4 py-3"><p className="font-semibold text-sm">Instrucciones</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{delivery.notes}</p></div>}
              {delivery.username && (<label className="seller-field">
                <span>Usuario / correo</span>
                <div className="flex gap-2">
                  <Input readOnly value={delivery.username} />
                  <Button
                    aria-label="Copiar usuario"
                    size="icon"
                    variant="outline"
                    onClick={() => void copyText(delivery.username)}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </label>)}
              {delivery.password && (<label className="seller-field">
                <span>Contraseña de la plataforma</span>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    type={showPassword ? "text" : "password"}
                    value={delivery.password}
                  />
                  <Button
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    size="icon"
                    variant="outline"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                  <Button
                    aria-label="Copiar contraseña"
                    size="icon"
                    variant="outline"
                    onClick={() => void copyText(delivery.password)}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </label>)}
              {delivery.profilePin ? (
                <p className="text-sm">
                  Perfil / PIN: <b>{delivery.profilePin}</b>
                </p>
              ) : null}
              {delivery.expiresOn ? <p className="text-sm">Vence: {delivery.expiresOn}</p> : null}
              {delivery.guides.length > 0 && <h3 className="font-semibold">Guía de ingreso</h3>}
              {delivery.guides.map((g, i) => (
                <figure className="space-y-2" key={i}>
                  <figcaption className="text-sm font-semibold">{g.title}</figcaption>
                  <img src={g.image} alt={g.title} className="w-full rounded-xl border" loading="lazy" />
                </figure>
              ))}
              {delivery.username && <p className="text-sm text-muted-foreground">
                Ingresa con estos datos en la aplicación o sitio oficial de la plataforma. Respeta
                los dispositivos y el tipo de cuenta que compraste.
              </p>}
              <Button variant="outline" onClick={() => {
                setReportKind("reports");
                setReportOrder(delivery.id);
                setReportTitle(`Falla en ${delivery.title}`.slice(0,160));
                setDelivery(null);
                setTab("reportes");
                window.scrollTo({top:0});
              }}>Reportar falla</Button>
              <Button asChild variant="outline">
                <a href={support} target="_blank" rel="noopener noreferrer">
                  Soporte por WhatsApp
                </a>
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
