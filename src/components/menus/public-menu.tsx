/** Vista pública del catálogo de un negocio cliente. */
import { Link } from "@tanstack/react-router";
import { MapPin, MessageCircle, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MenuData, MenuItem } from "@/lib/menus/types";

const money = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

const priceLabel = (it: MenuItem) =>
  it.priceText.trim() ? it.priceText : it.price > 0 ? money(it.price) : "";

export function waLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  const number = digits.length === 10 ? `52${digits}` : digits;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/40 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">{children}</div>
    </main>
  );
}

export function MenuMissing() {
  return (
    <Shell>
      <div className="card-soft rounded-3xl border border-border bg-card p-8 text-center">
        <UtensilsCrossed className="mx-auto mb-3 size-8 text-primary" />
        <h1 className="text-xl font-bold">Este catálogo no está disponible</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Puede que el enlace haya cambiado, que esté pausado o que su vigencia terminara.
        </p>
        <Button asChild variant="outline" className="mt-4 rounded-xl">
          <Link to="/">Ir al inicio</Link>
        </Button>
      </div>
    </Shell>
  );
}

export function PublicMenuView({ data }: { data: MenuData }) {
  const { business, categories, items } = data;
  const groups = [
    ...categories.map((c) => ({
      id: c.id,
      name: c.name,
      list: items.filter((i) => i.categoryId === c.id),
    })),
    { id: "none", name: "Más del catálogo", list: items.filter((i) => !i.categoryId) },
  ].filter((g) => g.list.length > 0);

  return (
    <Shell>
      <header className="card-soft mb-5 rounded-3xl border border-border bg-card p-5 text-center">
        {business.logoUrl ? (
          <img
            src={business.logoUrl}
            alt={business.name}
            className="mx-auto mb-3 size-16 rounded-2xl object-cover"
          />
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight">{business.name}</h1>
        {business.address ? (
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4" />
            {business.address}
          </p>
        ) : null}
        {business.whatsapp ? (
          <Button asChild className="mt-4 w-full rounded-full">
            <a
              href={waLink(business.whatsapp, `Hola ${business.name}, quiero hacer un pedido 🙌`)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="mr-1.5 size-4" />
              Pedir por WhatsApp
            </a>
          </Button>
        ) : null}
      </header>

      {groups.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Este negocio todavía no publica productos.
        </p>
      ) : null}

      {groups.map((g) => (
        <section key={g.id} className="mb-6">
          <h2 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {g.name}
          </h2>
          <ul className="space-y-3">
            {g.list.map((it) => (
              <li
                key={it.id}
                className="card-soft flex items-center gap-3 rounded-3xl border border-border bg-card p-3"
              >
                {it.imageUrl ? (
                  <img
                    src={it.imageUrl}
                    alt={it.name}
                    loading="lazy"
                    className="size-20 shrink-0 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-secondary">
                    <UtensilsCrossed className="size-6 text-primary" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold">{it.name}</p>
                  {it.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{it.description}</p>
                  ) : null}
                  {priceLabel(it) ? (
                    <p className="mt-1 text-base font-bold text-primary">{priceLabel(it)}</p>
                  ) : null}
                </div>
                {business.whatsapp ? (
                  <Button asChild size="sm" variant="outline" className="shrink-0 rounded-full">
                    <a
                      href={waLink(
                        business.whatsapp,
                        `Hola ${business.name}, quiero pedir: ${it.name}${
                          priceLabel(it) ? ` (${priceLabel(it)})` : ""
                        }`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Pedir ${it.name} por WhatsApp`}
                    >
                      Pedir
                    </a>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="pb-8 pt-2 text-center text-xs text-muted-foreground">
        Catálogo digital por MA² Connect
      </p>
    </Shell>
  );
}
