import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  Info,
  LogIn,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  Plus,
  Search,
  Share2,
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MenuData, MenuItem, MenuSpace } from "@/lib/menus/types";
import { reportOrder } from "@/lib/notify/client";

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
const priceLabel = (item: MenuItem) =>
  item.priceText.trim() ? item.priceText : item.price > 0 ? money(item.price) : "";
const searchable = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

function PriceDisplay({ item }: { item: MenuItem }) {
  const lines = priceLabel(item)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length ? (
    <div className="mt-1 space-y-0.5">
      {lines.map((line, index) => (
        <p key={`${index}-${line}`} className="font-bold text-primary">
          {line}
        </p>
      ))}
    </div>
  ) : null;
}

export function waLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  const number = digits.length === 10 ? `52${digits}` : digits;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/40 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">{children}</div>
    </main>
  );
}

export function MenuMissing() {
  return (
    <Shell>
      <div className="rounded-3xl border bg-card p-8 text-center">
        <UtensilsCrossed className="mx-auto mb-3 size-8 text-primary" />
        <h1 className="text-xl font-bold">Este espacio no está disponible</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Puede que el enlace haya cambiado o esté temporalmente oculto.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/">Ir al inicio</Link>
        </Button>
      </div>
    </Shell>
  );
}

export function MenuUnavailable({
  business,
}: {
  business: { name: string; ownerName: string; whatsapp: string; suspensionMessage: string };
}) {
  return (
    <Shell>
      <div className="rounded-3xl border bg-card p-8 text-center">
        <Building2 className="mx-auto mb-3 size-9 text-primary" />
        <h1 className="text-2xl font-bold">Servicio no disponible</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {business.suspensionMessage ||
            "Este espacio se encuentra temporalmente suspendido. Contacta al administrador."}
        </p>
        {business.whatsapp ? (
          <Button asChild className="mt-5 rounded-full">
            <a
              href={waLink(
                business.whatsapp,
                `Hola ${business.ownerName || business.name}, quiero información sobre este espacio.`,
              )}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="mr-1 size-4" />
              Contactar al administrador
            </a>
          </Button>
        ) : null}
      </div>
    </Shell>
  );
}

type ItemCardProps = {
  item: MenuItem;
  business: MenuData["business"];
  icon: ReactNode;
  canAddToCart: boolean;
  onAdd: () => void;
  onViewMore: () => void;
};

function ItemCard({ item, business, icon, canAddToCart, onAdd, onViewMore }: ItemCardProps) {
  const phone =
    business.features.per_item_whatsapp && item.whatsapp ? item.whatsapp : business.whatsapp;
  const message =
    business.features.per_item_whatsapp && item.whatsappMessage
      ? item.whatsappMessage
      : `Hola ${business.name}, quiero: ${item.name}`;
  return (
    <li className="group overflow-hidden rounded-3xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="aspect-[4/3] w-full overflow-hidden bg-secondary">
        {business.features.show_photos && item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid size-full place-items-center [&_svg]:size-14">{icon}</div>
        )}
      </div>
      <div className="p-4">
        <p className="text-lg font-bold leading-tight">{item.name}</p>
        {business.features.show_prices ? <PriceDisplay item={item} /> : null}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {canAddToCart ? (
            <Button size="lg" variant="outline" className="rounded-full" onClick={onAdd}>
              <ShoppingCart className="size-4" />
              Agregar al carrito
            </Button>
          ) : null}
          {business.features.show_whatsapp && phone ? (
            <Button asChild size="lg" className="rounded-full">
              <a
                href={waLink(phone, message)}
                target="_blank"
                rel="noreferrer"
                onClick={() =>
                  void reportOrder({
                    catalogId: business.id,
                    catalogName: business.name,
                    serviceName: item.name,
                    total: item.price,
                    items: [{ name: item.name, price: item.price }],
                    message,
                    link: window.location.href,
                    recipient: phone.replace(/\D/g, ""),
                  })
                }
              >
                <MessageCircle className="size-4" />
                Pedir por WhatsApp
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="rounded-full sm:col-span-2"
            onClick={onViewMore}
          >
            <Info className="size-4" />
            Ver más
          </Button>
        </div>
      </div>
    </li>
  );
}

function ItemDetailDialog({
  item,
  business,
  canAddToCart,
  open,
  onOpenChange,
  onAdd,
}: {
  item: MenuItem | null;
  business: MenuData["business"];
  canAddToCart: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: () => void;
}) {
  if (!item) return null;
  const phone =
    business.features.per_item_whatsapp && item.whatsapp ? item.whatsapp : business.whatsapp;
  const message =
    business.features.per_item_whatsapp && item.whatsappMessage
      ? item.whatsappMessage
      : `Hola ${business.name}, quiero: ${item.name}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-md">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="aspect-[4/3] w-full rounded-2xl object-cover"
          />
        ) : null}
        <DialogHeader>
          <DialogTitle className="text-2xl">{item.name}</DialogTitle>
          <DialogDescription className="whitespace-pre-line text-left leading-relaxed">
            {item.description || "Consulta la disponibilidad y los detalles por WhatsApp."}
          </DialogDescription>
        </DialogHeader>
        {business.features.show_prices ? (
          <div className="text-xl">
            <PriceDisplay item={item} />
          </div>
        ) : null}
        <div className="grid gap-2">
          {canAddToCart ? (
            <Button size="lg" variant="outline" className="rounded-full" onClick={onAdd}>
              <ShoppingCart className="size-4" />
              Agregar al carrito
            </Button>
          ) : null}
          {business.features.show_whatsapp && phone ? (
            <Button asChild size="lg" className="rounded-full">
              <a
                href={waLink(phone, message)}
                target="_blank"
                rel="noreferrer"
                onClick={() =>
                  void reportOrder({
                    catalogId: business.id,
                    catalogName: business.name,
                    serviceName: item.name,
                    total: item.price,
                    items: [{ name: item.name, price: item.price }],
                    message,
                    link: window.location.href,
                    recipient: phone.replace(/\D/g, ""),
                  })
                }
              >
                <MessageCircle className="size-4" />
                Pedir por WhatsApp
              </a>
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PublicMenuView({ data }: { data: MenuData & { space?: MenuSpace } }) {
  const { business, categories, items } = data;
  const visibleSpaces = data.spaces.filter((candidate) => !candidate.hidden);
  const initialSpace =
    data.space && visibleSpaces.some((candidate) => candidate.id === data.space?.id)
      ? data.space
      : visibleSpaces[0];
  const [activeSpaceId, setActiveSpaceId] = useState(initialSpace?.id ?? "");
  const [activeGroupId, setActiveGroupId] = useState("");
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerWhatsapp, setCustomerWhatsapp] = useState("");
  const [sending, setSending] = useState(false);
  const space = visibleSpaces.find((candidate) => candidate.id === activeSpaceId) ?? initialSpace;
  const spaceCategories = categories.filter(
    (category) => category.spaceId === space?.id && !category.hidden,
  );
  const allSpaceItems = items.filter((item) => item.spaceId === space?.id);
  const normalizedQuery = searchable(query);
  const spaceItems = normalizedQuery
    ? allSpaceItems.filter((item) => {
        const category = spaceCategories.find((candidate) => candidate.id === item.categoryId);
        const parent = category?.parentId
          ? spaceCategories.find((candidate) => candidate.id === category.parentId)
          : undefined;
        return searchable(
          [
            item.name,
            item.description,
            item.priceText,
            category?.name ?? "",
            parent?.name ?? "",
          ].join(" "),
        ).includes(normalizedQuery);
      })
    : allSpaceItems;
  const mains = spaceCategories.filter((category) => !category.parentId);
  const groups = mains.map((main) => {
    const children = spaceCategories.filter((category) => category.parentId === main.id);
    return {
      id: main.id,
      name: main.name,
      directItems: spaceItems.filter((item) => item.categoryId === main.id),
      childGroups: children.map((child) => ({
        id: child.id,
        name: child.name,
        imageUrl: child.imageUrl,
        list: spaceItems.filter((item) => item.categoryId === child.id),
      })),
    };
  });
  const hasSpaceTabs = visibleSpaces.length > 1;
  const hasCategoryTabs = !hasSpaceTabs && space?.kind === "catalog" && groups.length > 1;
  const selectedGroupId = hasCategoryTabs
    ? activeGroupId && groups.some((group) => group.id === activeGroupId)
      ? activeGroupId
      : (groups[0]?.id ?? "")
    : "";
  const shownGroups = hasCategoryTabs
    ? groups.filter((group) => group.id === selectedGroupId)
    : groups;
  const knownCategoryIds = new Set(spaceCategories.map((category) => category.id));
  const uncategorized = spaceItems.filter(
    (item) => !item.categoryId || !knownCategoryIds.has(item.categoryId),
  );
  const icon =
    space?.kind === "directory" ? (
      <Building2 className="size-6 text-primary" />
    ) : (
      <UtensilsCrossed className="size-6 text-primary" />
    );
  const canAddToCart = space?.kind !== "directory";
  const catalogCoverUrl = space?.imageUrl || business.logoUrl;
  const loginUrl = `/acceso?catalogo=${encodeURIComponent(business.slug)}&usuario=${encodeURIComponent(business.accessUsername || business.slug)}`;
  const cartItems = useMemo(() => items.filter((item) => (cart[item.id] || 0) > 0), [items, cart]);
  const cartTotal = cartItems.reduce((total, item) => total + item.price * (cart[item.id] || 0), 0);
  const setQty = (id: string, qty: number) =>
    setCart((previous) => {
      const next = { ...previous };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  const sendCart = async () => {
    if (!cartItems.length || sending || !customerName.trim() || !customerWhatsapp.trim()) return;
    const lines = cartItems
      .map(
        (item) =>
          `• ${cart[item.id]} x ${item.name}${item.price > 0 ? ` — ${money(item.price * cart[item.id])}` : ""}`,
      )
      .join("\n");
    const text = `Hola ${business.name}, quiero hacer este pedido:\n\n${lines}${cartTotal > 0 ? `\n\nTotal: ${money(cartTotal)}` : ""}\n\nCliente: ${customerName.trim()}\nWhatsApp del cliente: ${customerWhatsapp.trim()}`;
    const link = waLink(business.whatsapp, text);
    window.open(link, "_blank", "noopener,noreferrer");
    setSending(true);
    const saved = await reportOrder({
      catalogId: business.id,
      catalogName: business.name,
      serviceName: cartItems
        .map((item) => `${cart[item.id]} x ${item.name}`)
        .join(", ")
        .slice(0, 200),
      total: cartTotal,
      items: cartItems.map((item) => ({
        name: `${cart[item.id]} x ${item.name}`,
        price: item.price * cart[item.id],
      })),
      message: text,
      link: window.location.href,
      recipient: business.whatsapp.replace(/\D/g, ""),
    });
    setSending(false);
    if (saved) {
      setCart({});
      setCheckoutOpen(false);
      toast.success("Pedido registrado. Se abrió WhatsApp para enviarlo.");
    } else {
      toast.error("WhatsApp se abrió, pero no se pudo registrar el pedido.");
    }
  };
  const showSpace = (id: string) => {
    setActiveSpaceId(id);
    setActiveGroupId("");
    setNavigationOpen(false);
  };
  const showGroup = (id: string) => {
    setActiveGroupId(id);
    setNavigationOpen(false);
  };
  const goBack = () => {
    if (navigationOpen) {
      setNavigationOpen(false);
      return;
    }
    if (hasCategoryTabs) {
      const currentIndex = groups.findIndex((group) => group.id === selectedGroupId);
      if (currentIndex > 0) {
        setActiveGroupId(groups[currentIndex - 1].id);
        return;
      }
    }
    if (hasSpaceTabs) {
      const currentIndex = visibleSpaces.findIndex((candidate) => candidate.id === space?.id);
      if (currentIndex > 0) {
        showSpace(visibleSpaces[currentIndex - 1].id);
        return;
      }
    }
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/";
  };
  const shareCatalog = async () => {
    const url = `${window.location.origin}/${encodeURIComponent(business.slug)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: business.name,
          text: `Consulta el catálogo de ${business.name}`,
          url,
        });
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace del catálogo copiado");
    } catch {
      toast.error("No se pudo compartir el catálogo");
    }
  };

  return (
    <Shell>
      <header className="mb-5 overflow-hidden rounded-3xl border bg-card">
        {catalogCoverUrl ? (
          <img
            src={catalogCoverUrl}
            alt={`Portada de ${business.name}`}
            className="aspect-[16/7] w-full object-cover"
          />
        ) : null}
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                MA² CONNECT
              </p>
              <h1 className="truncate text-2xl font-bold">{business.name}</h1>
              {space?.subtitle ? (
                <p className="text-sm text-muted-foreground">{space.subtitle}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <a href={loginUrl}>
                  <LogIn className="size-4" />
                  Iniciar sesión
                </a>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => void shareCatalog()}
              >
                <Share2 className="size-4" />
                Compartir catálogo
              </Button>
            </div>
          </div>
          {business.features.show_address && business.address ? (
            <p className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-4" />
              {business.address}
            </p>
          ) : null}
          {business.features.show_whatsapp && business.whatsapp ? (
            <Button asChild className="mt-4 w-full rounded-full">
              <a
                href={waLink(business.whatsapp, `Hola ${business.name}, quiero información 🙌`)}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="mr-1 size-4" />
                WhatsApp
              </a>
            </Button>
          ) : null}
        </div>
      </header>

      {hasSpaceTabs || hasCategoryTabs ? (
        <nav className="mb-5 rounded-3xl border bg-card p-2" aria-label="Navegación del catálogo">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="shrink-0 rounded-2xl"
              onClick={goBack}
              aria-label="Regresar"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <p className="min-w-0 flex-1 truncate px-1 text-sm font-semibold">
              {hasSpaceTabs
                ? space?.name
                : groups.find((group) => group.id === selectedGroupId)?.name}
            </p>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => setNavigationOpen((open) => !open)}
              aria-expanded={navigationOpen}
              aria-controls="catalog-navigation-menu"
            >
              <Menu className="size-5" />
              Menú
            </Button>
          </div>
          {navigationOpen ? (
            <div
              id="catalog-navigation-menu"
              className="mt-2 grid gap-2 rounded-2xl bg-muted/70 p-2"
              style={{
                gridTemplateColumns: `repeat(${Math.min(Math.max(hasSpaceTabs ? visibleSpaces.length : groups.length, 1), 4)}, minmax(0, 1fr))`,
              }}
            >
              {hasSpaceTabs
                ? visibleSpaces.map((candidate) => {
                    const count = items.filter((item) => item.spaceId === candidate.id).length;
                    const active = candidate.id === space?.id;
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => showSpace(candidate.id)}
                        aria-current={active}
                        className={`rounded-xl px-2 py-3 text-sm font-semibold transition-colors ${active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:bg-card/70 hover:text-foreground"}`}
                      >
                        {candidate.name} ({count})
                      </button>
                    );
                  })
                : groups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => showGroup(group.id)}
                      aria-current={group.id === selectedGroupId}
                      className={`rounded-xl px-2 py-3 text-sm font-semibold transition-colors ${group.id === selectedGroupId ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:bg-card/70 hover:text-foreground"}`}
                    >
                      {group.name}
                    </button>
                  ))}
            </div>
          ) : null}
        </nav>
      ) : null}

      <section className="mb-5 rounded-3xl border bg-card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 rounded-full pl-9 pr-10"
            placeholder="Buscar negocio, producto o servicio…"
            aria-label="Buscar en el catálogo"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        {normalizedQuery ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {spaceItems.length} resultado(s) en {space?.name}
          </p>
        ) : null}
      </section>

      {space?.noticeEnabled && space.noticeMessage ? (
        <div className="mb-5 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="font-semibold">{space.noticeTitle || "Aviso"}</p>
          <p className="mt-1 text-sm">{space.noticeMessage}</p>
        </div>
      ) : null}

      {normalizedQuery && !spaceItems.length ? (
        <p className="mb-5 rounded-3xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No encontramos resultados para “{query}”. Puedes elegir otra pestaña o cambiar la
          búsqueda.
        </p>
      ) : null}
      {!normalizedQuery && !shownGroups.length && !uncategorized.length ? (
        <p className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Todavía no hay contenido publicado en esta pestaña.
        </p>
      ) : null}

      {shownGroups.map((group) => (
        <section key={group.id} className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-lg font-bold">{group.name}</h2>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {group.directItems.length +
                group.childGroups.reduce((total, child) => total + child.list.length, 0)}
            </span>
          </div>
          {group.directItems.length ? (
            <ul className="mb-4 grid gap-4 sm:grid-cols-2">
              {group.directItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  business={business}
                  icon={icon}
                  canAddToCart={canAddToCart}
                  onAdd={() => setQty(item.id, (cart[item.id] || 0) + 1)}
                  onViewMore={() => setSelectedItem(item)}
                />
              ))}
            </ul>
          ) : null}
          {group.childGroups.map((child) => (
            <div key={child.id} className="mb-5 overflow-hidden rounded-3xl border bg-card">
              <div className="p-4">
                {child.imageUrl ? (
                  <img
                    src={child.imageUrl}
                    alt={`Subportada de ${child.name}`}
                    className="mb-3 aspect-[16/7] w-full rounded-2xl object-cover"
                  />
                ) : null}
                <h3 className="text-base font-bold">{child.name}</h3>
              </div>
              {child.list.length ? (
                <ul className="grid gap-4 px-3 pb-3 sm:grid-cols-2">
                  {child.list.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      business={business}
                      icon={icon}
                      canAddToCart={canAddToCart}
                      onAdd={() => setQty(item.id, (cart[item.id] || 0) + 1)}
                      onViewMore={() => setSelectedItem(item)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mx-3 mb-3 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
                  {normalizedQuery
                    ? "Sin coincidencias en esta subsección."
                    : "Sin tarjetas disponibles en esta subsección."}
                </p>
              )}
            </div>
          ))}
        </section>
      ))}

      {uncategorized.length ? (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold">Más</h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {uncategorized.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                business={business}
                icon={icon}
                canAddToCart={canAddToCart}
                onAdd={() => setQty(item.id, (cart[item.id] || 0) + 1)}
                onViewMore={() => setSelectedItem(item)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {cartItems.length ? (
        <div className="sticky bottom-3 z-20 flex items-center gap-3 rounded-3xl border bg-card/95 p-4 shadow-xl backdrop-blur">
          <ShoppingCart className="size-5 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {cartItems.reduce((total, item) => total + cart[item.id], 0)} artículo(s)
            </p>
            <p className="text-sm font-bold text-primary">
              {cartTotal > 0 ? money(cartTotal) : "Consultar"}
            </p>
          </div>
          <Button className="rounded-full" onClick={() => setCheckoutOpen(true)}>
            Finalizar pedido
          </Button>
        </div>
      ) : null}

      <ItemDetailDialog
        item={selectedItem}
        business={business}
        canAddToCart={canAddToCart}
        open={!!selectedItem}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
        onAdd={() => {
          if (selectedItem) setQty(selectedItem.id, (cart[selectedItem.id] || 0) + 1);
          toast.success("Agregado al carrito");
        }}
      />

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Finalizar pedido</DialogTitle>
            <DialogDescription>
              Revisa cantidades, elimina artículos y deja tus datos para registrar el pedido.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {cartItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded-2xl border p-3">
                <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={() => setQty(item.id, cart[item.id] - 1)}
                  aria-label="Quitar uno"
                >
                  <Minus className="size-3" />
                </Button>
                <span className="w-5 text-center font-semibold">{cart[item.id]}</span>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={() => setQty(item.id, cart[item.id] + 1)}
                  aria-label="Agregar uno"
                >
                  <Plus className="size-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={() => setQty(item.id, 0)}
                  aria-label="Eliminar"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-muted p-3">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-primary">
              {cartTotal > 0 ? money(cartTotal) : "Consultar"}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="menu-customer-name">Tu nombre</Label>
              <Input
                id="menu-customer-name"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Nombre del cliente"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="menu-customer-whatsapp">Tu WhatsApp</Label>
              <Input
                id="menu-customer-whatsapp"
                inputMode="tel"
                value={customerWhatsapp}
                onChange={(event) => setCustomerWhatsapp(event.target.value)}
                placeholder="Ej. 669 123 4567"
              />
            </div>
          </div>
          <Button
            size="lg"
            className="w-full rounded-full"
            disabled={
              !business.whatsapp ||
              !cartItems.length ||
              !customerName.trim() ||
              !customerWhatsapp.trim() ||
              sending
            }
            onClick={() => void sendCart()}
          >
            {sending ? "Registrando pedido…" : "Registrar y enviar por WhatsApp"}
          </Button>
        </DialogContent>
      </Dialog>
      <p className="pb-8 text-center text-xs text-muted-foreground">Creado con MA² Connect</p>
    </Shell>
  );
}
