import { useCallback, useEffect, useRef, useState } from "react";
import {
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
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
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
import { BusinessCover } from "@/components/catalog/business-cover";
import { appearanceStyle, normalizeAppearance } from "@/lib/appearance/theme";
import { CustomerRecharge } from "@/components/recharges/customer-recharge";
import { copyText } from "@/lib/browser/clipboard";
import { mainStoreLink, type MainStoreView } from "@/lib/catalog/links";
import { pricingKey } from "@/lib/customer/pricing";
import { groupProducts } from "@/lib/customer/group-products";
import { money, phoneNumber, STATUS } from "@/lib/workspace/model";
import {
  customerShopInfo,
  customerSignUp,
  customerSignIn,
  customerSignOut,
  customerLoad,
  customerProducts,
  customerBuy,
  customerDelivery,
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
  ["reportes", "Reportes y soporte", LifeBuoy],
  ["avisos", "Avisos", Bell],
  ["movimientos", "Movimientos", History],
  ["cuenta", "Mi cuenta", User],
] as const;
export function CustomerStore({ slug, initialView = "inicio", initialQuery = "", initialSku = "" }: { slug: string; initialView?: MainStoreView; initialQuery?: string; initialSku?:string }) {
  const [shop, setShop] = useState<Awaited<ReturnType<typeof customerShopInfo>> | null>(null),
    [data, setData] = useState<View | null>(null),
    [tab, setTab] = useState<string>(initialView),
    [menu, setMenu] = useState(false),
    [mode, setMode] = useState("login"),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [fatal, setFatal] = useState("");
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
    [reportKind, setReportKind] = useState<"reports" | "questions" | "requests">("reports");
  const requests = useRef(new Map<string, string>());
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
  const support = `https://wa.me/${phoneNumber(shop?.whatsapp || "")}?text=${encodeURIComponent(`Hola, necesito ayuda con mi cuenta de ${shop?.name || "la tienda"}.`)}`;
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
  if (loading || !shop)
    return (
      <main className="p-8 text-center" role="status">
        Abriendo tu tienda…
      </main>
    );
  return (
    <main
      className="buyer-app seller-app ma2-unified"
      style={appearanceStyle(normalizeAppearance(shop.appearance))}
    >
      <header className="buyer-top">
        <div className="flex min-w-0 items-center gap-3">
          {data ? (
            <Button
              size="icon"
              variant="ghost"
              aria-label={menu ? "Cerrar menú" : "Abrir menú"}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </Button>
          ) : null}
          {shop.logoUrl ? (
            <img className="size-10 rounded-full object-cover" src={shop.logoUrl} alt="" />
          ) : (
            <span className="seller-logo">MA²</span>
          )}
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{data ? data.priceTier === "reseller" ? "MI CUENTA · REVENDEDOR" : "MI CUENTA" : "BIENVENIDO"}</p>
            <h1 className="font-bold truncate">{shop.name}</h1>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {!shop.id && data && <Button variant="outline" size="sm" asChild><a href={mainStoreLink()}>Tienda web</a></Button>}
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
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await customerSignOut();
                    setData(null);
                    setDelivery(null);
                    setProducts([]);
                    setPassword("");
                    setError("");
                  })
                }
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline ml-1">Salir</span>
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <a href={shop.id ? `/${encodeURIComponent(shop.slug)}` : mainStoreLink()}>
                Ver tienda web
              </a>
            </Button>
          )}
        </div>
      </header>
      {!data ? (
        <div className="buyer-auth">
          <section className="space-y-4">
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
            {shop.id&&<a className="text-sm text-primary underline" href="/plataforma">
              ¿Tienes un negocio? Contrata tu propia tienda
            </a>}
          </section>
          <form
            className="seller-card space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                if (mode === "register") {
                  if (password !== confirmation) throw new Error("Las contraseñas no coinciden");
                  await customerSignUp({ data: { slug, email, password, name, whatsapp: wa } });
                } else await customerSignIn({ data: { slug, email, password } });
                setPassword("");
                setConfirmation("");
                await load();
              });
            }}
          >
            <div className="seller-tabs">
              <button
                type="button"
                className={mode === "login" ? "active" : ""}
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                className={mode === "register" ? "active" : ""}
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                Crear mi cuenta
              </button>
            </div>
            <h2 className="text-xl font-bold">
              {mode === "register" ? "Crea tu cuenta de cliente" : "Qué gusto verte de nuevo"}
            </h2>
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
              <Input
                required
                type="password"
                minLength={mode === "register" ? 10 : 1}
                maxLength={128}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
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
                  : "Entrar a mi cuenta"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Esta cuenta pertenece a {shop.name}. Si ya tienes saldo con el negocio, pide que te
              habiliten el acceso para conservarlo.
            </p>
            <a
              className="block text-sm text-primary underline"
              href={support}
              target="_blank"
              rel="noopener noreferrer"
            >
              Olvidé mi contraseña · Recuperar con soporte
            </a>
            {!shop.id && <div className="flex justify-end border-t pt-2"><a href="/?panel=1" aria-label="Acceso del equipo" title="Acceso del equipo" className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><Settings2 className="size-4" aria-hidden="true"/></a></div>}
          </form>
        </div>
      ) : (
        <div className="buyer-shell">
          <nav className={`buyer-nav ${menu ? "open" : ""}`} aria-label="Panel de cliente">
            {tabs.map(([key, label, Icon]) => (
              <button
                key={key}
                className={tab === key ? "active" : ""}
                disabled={data.mustChange && key !== "cuenta"}
                onClick={() => {
                  setTab(key);
                  setMenu(false);
                  setError("");
                }}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
            <a href={support} target="_blank" rel="noopener noreferrer">
              <LifeBuoy className="size-4" />
              Ayuda por WhatsApp
            </a>
            <a href="/plataforma">
              <ShoppingBag className="size-4" />
              Quiero mi propia tienda
            </a>
          </nav>
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
                <div className="buyer-metrics">
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
                    <strong>{data.orders.length}</strong>
                    <button onClick={() => setTab("compras")}>Ver mis entregas →</button>
                  </article>
                </div>
                <BusinessCover appearance={normalizeAppearance(shop.appearance)} name={shop.name} />
                <div className="flex justify-between items-center my-5">
                  <h3 className="font-bold">Disponible en la tienda</h3>
                  <button className="text-sm text-primary" onClick={() => setTab("tienda")}>
                    Ver todo →
                  </button>
                </div>
                {productsError ? (
                  <p role="alert">{productsError}</p>
                ) : products.length ? (
                  productGrid(products, 4)
                ) : (
                  <p className="seller-card text-muted-foreground">
                    Todavía no hay productos listos para compra con saldo. Consulta el catálogo o
                    pide ayuda por WhatsApp.
                  </p>
                )}
              </>
            ) : null}
            {tab === "tienda" ? (
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  {data.priceTier === "reseller" ? "Estás viendo las tarifas de revendedor. Solo aparecen productos con precio de revendedor configurado." : "Precios para cliente normal."} Disponibilidad y precio comprobados al comprar. Recibe tus accesos aquí mismo.
                </p>
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
                <Button variant="outline" className="mt-5" asChild>
                  <a href={shop.id ? `/${encodeURIComponent(shop.slug)}` : mainStoreLink()}>
                    Catálogo y pedidos por WhatsApp
                  </a>
                </Button>
              </>
            ) : null}
            {tab === "saldo" ? (
              <>
                <CustomerRecharge id="" token="" shopSlug={slug} onBalanceChange={load} />
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
                ) : (
                  <p className="seller-card text-muted-foreground">
                    Tus compras y entregas aparecerán aquí.
                  </p>
                )}
              </div>
            ) : null}
            {tab === "reportes" ? (
              <>
                <form
                  className="seller-card space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(async () => {
                      await customerSubmit({
                        data: {
                          slug,
                          module: reportKind,
                          title: reportTitle,
                          message: reportMessage,
                          ...(reportOrder ? { orderId: reportOrder } : {}),
                        },
                      });
                      setReportTitle("");
                      setReportMessage("");
                      setReportOrder("");
                      await load();
                      toast.success("Solicitud enviada al negocio");
                    });
                  }}
                >
                  <label className="seller-field">
                    <span>Tipo de solicitud</span>
                    <select
                      className="buyer-select"
                      value={reportKind}
                      onChange={(e) => setReportKind(e.target.value as typeof reportKind)}
                    >
                      <option value="reports">Reportar falla</option>
                      <option value="questions">Pregunta / ayuda</option>
                      <option value="requests">Pedido por encargo</option>
                    </select>
                  </label>
                  <label className="seller-field">
                    <span>Compra relacionada</span>
                    <select
                      className="buyer-select"
                      value={reportOrder}
                      onChange={(e) => setReportOrder(e.target.value)}
                    >
                      <option value="">Sin compra relacionada</option>
                      {data.orders.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.title}
                        </option>
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
                  <Button disabled={busy}>Enviar solicitud</Button>
                </form>
                <div className="mt-4 space-y-3">
                  {data.records
                    .filter((r) => ["reports", "questions", "requests"].includes(r.module))
                    .map((r) => (
                      <article className="seller-card" key={r.id}>
                        <h3 className="font-bold">{r.title}</h3>
                        <span className="text-xs text-primary">{STATUS[r.status] || r.status}</span>
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
                  .filter((r) => ["notices", "faq"].includes(r.module))
                  .map((r) => (
                    <article className="seller-card" key={r.id}>
                      <h3 className="font-bold">{r.title}</h3>
                      <p className="text-sm whitespace-pre-wrap mt-3">{r.message}</p>
                    </article>
                  ))}
                {!data.records.some((r) => ["notices", "faq"].includes(r.module)) ? (
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
            <DialogTitle>Tu entrega</DialogTitle>
            <DialogDescription>
              {delivery?.title} · Consulta soporte si necesitas ayuda.
            </DialogDescription>
          </DialogHeader>
          {delivery ? (
            <div className="space-y-4">
              <label className="seller-field">
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
              </label>
              <label className="seller-field">
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
              </label>
              {delivery.profilePin ? (
                <p className="text-sm">
                  Perfil / PIN: <b>{delivery.profilePin}</b>
                </p>
              ) : null}
              {delivery.expiresOn ? <p className="text-sm">Vence: {delivery.expiresOn}</p> : null}
              {delivery.guides.map((g, i) => (
                <figure className="space-y-2" key={i}>
                  <figcaption className="text-sm font-semibold">{g.title}</figcaption>
                  <img src={g.image} alt={g.title} className="w-full rounded-xl" />
                </figure>
              ))}
              <p className="text-sm text-muted-foreground">
                Ingresa con estos datos en la aplicación o sitio oficial de la plataforma. Respeta
                los dispositivos y el tipo de cuenta que compraste.
              </p>
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
