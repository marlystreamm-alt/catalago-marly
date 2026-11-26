import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Store, Package, Users, Wallet, Palette, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { salesGetPublicConfig } from "@/lib/sales/sales.functions";
import { money } from "@/lib/workspace/model";
import { mainStoreLink } from "@/lib/catalog/links";
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
  return (
    <main className="buyer-app px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <nav className="flex flex-wrap items-center justify-between gap-3 mb-14">
          <a href="/" className="font-bold text-lg">
            Mi tienda MA²
          </a>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href="/acceso">Ya tengo una tienda</a>
            </Button>
            <Button variant="ghost" asChild>
              <a href={mainStoreLink("inicio")}>Volver a mi cuenta de comprador</a>
            </Button>
          </div>
        </nav>
        <section className="text-center mx-auto max-w-3xl mb-12">
          <p className="buyer-eyebrow">TU NEGOCIO, TU PROPIA TIENDA</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold mt-3">
            Vende y administra
            <br />
            desde un mismo lugar.
          </h1>
          <p className="text-muted-foreground my-6 text-lg">
            Contrata tu tienda digital por mensualidad. Personalízala y entrega a tus compradores un
            espacio propio para comprar, consultar sus accesos y recibir soporte.
          </p>
          <p className="mb-6 text-sm text-muted-foreground">
            ¿Ya compras cuentas con MA²? Puedes solicitar tu tienda aquí y seguir usando tu cuenta de comprador.
          </p>
          <div className="flex justify-center flex-wrap gap-3">
            <Button size="lg" asChild>
              <a
                href={
                  config?.enabled
                    ? "/contratar"
                    : "https://wa.me/528443852364?text=Hola%2C%20quiero%20informaci%C3%B3n%20para%20contratar%20mi%20tienda%20por%20mensualidad."
                }
              >
                {config?.enabled ? "Ver planes y contratar" : "Quiero mi tienda"}
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="/acceso">Ingresar a mi negocio</a>
            </Button>
          </div>
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map(({ icon: Icon, title, text }) => (
            <article className="seller-card space-y-3" key={title}>
              <Icon className="text-primary size-6" />
              <h2 className="font-bold">{title}</h2>
              <p className="text-sm text-muted-foreground">{text}</p>
            </article>
          ))}
        </section>
        {error ? (
          <p role="alert" className="text-center my-6">
            {error}
          </p>
        ) : null}
        {config?.enabled ? (
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-center mb-6">Planes mensuales</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {config.plans.map((p) => (
                <article className="seller-card space-y-4" key={p.id}>
                  <h3 className="font-bold">{p.name}</h3>
                  <p>
                    <b className="text-3xl">{money(p.monthly)}</b>
                    <span className="text-sm"> / mes</span>
                  </p>
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                  <Button asChild className="w-full">
                    <a href="/contratar">Contratar</a>
                  </Button>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        <p className="text-center text-xs text-muted-foreground mt-10">
          Activación después de verificar tu pago. Las renovaciones y herramientas se administran
          según tu contratación.
        </p>
      </div>
    </main>
  );
}
