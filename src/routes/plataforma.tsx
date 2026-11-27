import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Store, Package, Users, Wallet, Palette, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { salesGetPublicConfig } from "@/lib/sales/sales.functions";
import { money } from "@/lib/workspace/model";
import { mainStoreLink } from "@/lib/catalog/links";
import { StoreBusinessPage } from "@/components/sales/store-business-page";
export const Route = createFileRoute("/plataforma")({
  head: () => ({
    meta: [
      { title: "Tu propia tienda digital · MA²" },
      {
        name: "description",
        content:
          "Contrata tu tienda por mensualidad. Administra catálogo, stock, compradores y entregas desde tu panel.",
      },
    ],
  }),
  component: Platform,
});
const benefits = [
  { icon: Store, title: "Catálogo propio", text: "Tu nombre, enlace, productos y precios." },
  {
    icon: Package,
    title: "Stock y entregas",
    text: "Perfiles y cuentas con control de disponibilidad.",
  },
  {
    icon: Users,
    title: "Cuentas de compradores",
    text: "Tus clientes consultan compras, entregas y soporte.",
  },
  {
    icon: Wallet,
    title: "Saldo y movimientos",
    text: "Abona pagos verificados y permite compras con saldo.",
  },
  { icon: Palette, title: "Tu imagen", text: "Portada, colores y tarjetas para tu negocio." },
  {
    icon: ShieldCheck,
    title: "Accesos separados",
    text: "Cada tienda administra sus datos y compradores.",
  },
];
function Platform() {
  const [config, setConfig] = useState<Awaited<ReturnType<typeof salesGetPublicConfig>> | null>(
      null,
    ),
    [error, setError] = useState("");
  useEffect(() => {
    salesGetPublicConfig()
      .then(setConfig)
      .catch(() =>
        setError("No se pudieron consultar los planes. Puedes pedir información por WhatsApp."),
      );
  }, []);
  const whatsapp = (plan?: string) => `https://wa.me/528443852364?text=${encodeURIComponent(
    plan ? `Hola, me interesa el plan ${plan} para mi tienda MA².` : "Hola, quiero información de los planes de MA².",
  )}`;
  return (
    <StoreBusinessPage actions={
      <>
        <Button size="sm" variant="outline" asChild><a href="/acceso">Ya tengo tienda</a></Button>
        <Button size="sm" variant="ghost" asChild><a href={mainStoreLink("inicio")}>Mi cuenta de comprador</a></Button>
      </>
    }>
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:py-8">
        <section className="seller-card space-y-3">
          <h1 className="text-2xl font-extrabold sm:text-4xl">Tu propia tienda digital</h1>
          <p className="text-sm text-muted-foreground">Administra tus productos, pedidos y clientes desde un solo lugar.</p>
          <Button asChild size="sm"><a href="#planes">Quiero mi tienda</a></Button>
        </section>

        <section id="planes" className="scroll-mt-24 space-y-3" aria-labelledby="planes-titulo">
          <h2 id="planes-titulo" className="text-xl font-bold">Planes mensuales</h2>
          {error ? (
            <div className="seller-card space-y-2" role="alert">
              <p className="text-sm">{error}</p>
              <Button asChild size="sm" variant="outline"><a href={whatsapp()}>Consultar por WhatsApp</a></Button>
            </div>
          ) : !config ? (
            <p className="text-sm text-muted-foreground" role="status">Cargando precios…</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {config.plans.map((plan) => (
                <article className="seller-card flex flex-col items-start gap-2" key={plan.id}>
                  <h3 className="font-bold">{plan.name}</h3>
                  <p><strong className="text-2xl text-primary">{money(plan.monthly)}</strong> <span className="text-sm text-muted-foreground">MXN al mes</span></p>
                  {plan.description && <p className="flex-1 text-sm text-muted-foreground">{plan.description}</p>}
                  <Button asChild size="sm">
                    <a href={config.enabled ? `/contratar?plan=${encodeURIComponent(plan.id)}` : whatsapp(plan.name)}>
                      {config.enabled ? "Elegir plan" : "Solicitar por WhatsApp"}
                    </a>
                  </Button>
                </article>
              ))}
            </div>
          )}
        </section>

        <details className="seller-disclosure">
          <summary className="text-sm font-semibold">Qué incluye tu tienda</summary>
          <ul className="seller-disclosure-body grid gap-4 sm:grid-cols-2">
            {benefits.map(({ icon: Icon, title, text }) => (
              <li className="flex gap-3" key={title}>
                <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <div><h3 className="text-sm font-bold">{title}</h3><p className="text-sm text-muted-foreground">{text}</p></div>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </StoreBusinessPage>
  );
}
