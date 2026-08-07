/** Panel del dueño: edita su catálogo dentro de lo que el administrador le autorizó. */
import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ExternalLink, Loader2, LogOut, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ownerChangePassword,
  ownerDeleteCategory,
  ownerDeleteItem,
  ownerLoad,
  ownerSaveBusiness,
  ownerSaveCategory,
  ownerSaveItem,
} from "@/lib/menus/owner.functions";
import { clearOwnerToken, getOwnerToken } from "@/lib/menus/owner-session";
import {
  EDIT_FEATURES,
  FEATURE_LABELS,
  type EditFeature,
  type Features,
  type MenuBusiness,
  type MenuCategory,
  type MenuItem,
} from "@/lib/menus/types";

export const Route = createFileRoute("/mi-catalogo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mi catálogo — Panel del dueño | MA² Connect" },
      { name: "description", content: "Edita tu catálogo: productos, precios, fotos y categorías." },
      { property: "og:title", content: "Mi catálogo — Panel del dueño" },
      {
        property: "og:description",
        content: "Edita tu catálogo: productos, precios, fotos y categorías.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerPanel,
});

const err = (e: unknown) => (e instanceof Error ? e.message : "Ocurrió un error");

/** Qué significa cada permiso, en palabras del dueño. */
const FEATURE_HELP: Record<EditFeature, string> = {
  edit_prices: "Cambiar el precio de tus productos.",
  edit_item_text: "Cambiar el nombre y la descripción de tus productos.",
  edit_photos: "Poner o cambiar la foto de cada producto.",
  add_items: "Agregar productos nuevos a tu menú.",
  delete_items: "Eliminar productos de tu menú.",
  edit_categories: "Crear, renombrar y borrar categorías.",
  toggle_items: "Marcar productos como disponibles o agotados.",
  edit_business: "Cambiar el nombre, WhatsApp, dirección y logo del negocio.",
};

const NO_PERMISO = "No tienes autorización para esto. Pídeselo a MA² para que lo active.";

/** Aviso claro cuando una sección está bloqueada. */
function Bloqueado({ texto }: { texto: string }) {
  return (
    <p className="rounded-xl bg-muted p-2 text-xs text-muted-foreground">
      🔒 {texto} {NO_PERMISO}
    </p>
  );
}

function OwnerPanel() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<MenuBusiness | null>(null);
  const [features, setFeatures] = useState<Features | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [mustChange, setMustChange] = useState(false);
  const [newPass, setNewPass] = useState("");

  const load = useCallback(
    async (t: string) => {
      try {
        const data = await ownerLoad({ data: { token: t } });
        setBusiness(data.business);
        setFeatures(data.features);
        setCategories(data.categories);
        setItems(data.items);
        setMustChange(data.mustChangePassword);
      } catch (e) {
        toast.error(err(e));
        clearOwnerToken();
        void navigate({ to: "/acceso" });
      } finally {
        setLoading(false);
      }
    },
    [navigate],
  );

  useEffect(() => {
    const t = getOwnerToken();
    if (!t) {
      void navigate({ to: "/acceso" });
      return;
    }
    setToken(t);
    void load(t);
  }, [load, navigate]);

  const can = (k: keyof Features) => Boolean(features?.[k]);

  const saveItem = async (item: MenuItem) => {
    try {
      const saved = await ownerSaveItem({
        data: {
          token,
          id: item.id,
          categoryId: item.categoryId,
          name: item.name,
          description: item.description,
          price: item.price,
          priceText: item.priceText,
          imageUrl: item.imageUrl,
          available: item.available,
          sortIndex: item.sortIndex,
        },
      });
      setItems((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));
    } catch (e) {
      toast.error(err(e));
      void load(token);
    }
  };

  const addItem = async () => {
    try {
      const saved = await ownerSaveItem({
        data: {
          token,
          categoryId: categories[0]?.id ?? null,
          name: "Producto nuevo",
          description: "",
          price: 0,
          priceText: "",
          imageUrl: "",
          available: true,
          sortIndex: items.length,
        },
      });
      setItems((prev) => [...prev, saved]);
    } catch (e) {
      toast.error(err(e));
    }
  };

  const removeItem = async (id: string) => {
    if (!window.confirm("¿Eliminar este producto?")) return;
    try {
      await ownerDeleteItem({ data: { token, id } });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      toast.error(err(e));
    }
  };

  const addCategory = async () => {
    try {
      const saved = await ownerSaveCategory({
        data: { token, name: "Categoría", sortIndex: categories.length },
      });
      setCategories((prev) => [...prev, saved]);
    } catch (e) {
      toast.error(err(e));
    }
  };

  const saveCategory = async (c: MenuCategory) => {
    try {
      const saved = await ownerSaveCategory({
        data: { token, id: c.id, name: c.name, sortIndex: c.sortIndex },
      });
      setCategories((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
    } catch (e) {
      toast.error(err(e));
      void load(token);
    }
  };

  const removeCategory = async (id: string) => {
    if (!window.confirm("¿Eliminar esta categoría?")) return;
    try {
      await ownerDeleteCategory({ data: { token, id } });
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setItems((prev) => prev.map((i) => (i.categoryId === id ? { ...i, categoryId: null } : i)));
    } catch (e) {
      toast.error(err(e));
    }
  };

  const saveBusiness = async (b: MenuBusiness) => {
    try {
      await ownerSaveBusiness({
        data: { token, name: b.name, whatsapp: b.whatsapp, address: b.address, logoUrl: b.logoUrl },
      });
      toast.success("Datos guardados");
    } catch (e) {
      toast.error(err(e));
    }
  };

  const changePassword = async () => {
    try {
      await ownerChangePassword({ data: { token, password: newPass } });
      setNewPass("");
      setMustChange(false);
      toast.success("Contraseña actualizada");
    } catch (e) {
      toast.error(err(e));
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }
  if (!business || !features) return null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/40 px-4 py-6">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <header className="card-soft flex items-center gap-2 rounded-3xl border border-border bg-card p-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">{business.name}</h1>
            <p className="truncate text-xs text-muted-foreground">Mi menú · MA² Connect</p>
          </div>
          <Button asChild size="sm" variant="outline" className="rounded-xl">
            <Link to="/$slug" params={{ slug: business.slug }} target="_blank">
              <ExternalLink className="mr-1 size-4" />
              Ver
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl"
            onClick={() => {
              clearOwnerToken();
              void navigate({ to: "/acceso" });
            }}
          >
            <LogOut className="size-4" />
          </Button>
        </header>

        {mustChange ? (
          <section className="card-soft space-y-2 rounded-3xl border border-primary/40 bg-card p-4">
            <h2 className="text-sm font-semibold">Cambia tu contraseña temporal</h2>
            <div className="flex gap-2">
              <Input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Nueva contraseña"
                autoComplete="new-password"
              />
              <Button onClick={() => void changePassword()} className="rounded-xl">
                Guardar
              </Button>
            </div>
          </section>
        ) : null}

        <section className="card-soft space-y-2 rounded-3xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Lo que puedes hacer en tu menú</h2>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {EDIT_FEATURES.map((k) => (
              <li key={k} className="flex items-start gap-2 text-xs">
                <span aria-hidden>{can(k) ? "✅" : "🔒"}</span>
                <span className={can(k) ? "" : "text-muted-foreground"}>
                  <strong className="font-medium">{FEATURE_LABELS[k]}</strong>
                  <br />
                  {FEATURE_HELP[k]}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Lo que aparece con 🔒 está bloqueado por MA²; se ve pero no se puede modificar.
          </p>
        </section>

        <section className="card-soft space-y-3 rounded-3xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Datos del negocio</h2>
          {can("edit_business") ? null : <Bloqueado texto="Cambiar los datos del negocio." />}
          <fieldset disabled={!can("edit_business")} className="space-y-3 disabled:opacity-70">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="b-name">Nombre</Label>
                <Input
                  id="b-name"
                  value={business.name}
                  onChange={(e) => setBusiness({ ...business, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-wa">WhatsApp</Label>
                <Input
                  id="b-wa"
                  inputMode="tel"
                  value={business.whatsapp}
                  onChange={(e) => setBusiness({ ...business, whatsapp: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-addr">Dirección</Label>
                <Input
                  id="b-addr"
                  value={business.address}
                  onChange={(e) => setBusiness({ ...business, address: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-logo">Logo (URL)</Label>
                <Input
                  id="b-logo"
                  value={business.logoUrl}
                  onChange={(e) => setBusiness({ ...business, logoUrl: e.target.value })}
                />
              </div>
            </div>
            <Button size="sm" className="rounded-xl" onClick={() => void saveBusiness(business)}>
              Guardar datos
            </Button>
          </fieldset>
        </section>

        <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Categorías</h2>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                disabled={!can("edit_categories")}
                onClick={addCategory}
              >
                <Plus className="mr-1 size-4" />
                Agregar
              </Button>
            </div>
            {can("edit_categories") ? null : <Bloqueado texto="Manejar tus categorías." />}
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <Input
                  value={c.name}
                  aria-label="Nombre de la categoría"
                  disabled={!can("edit_categories")}
                  onChange={(e) =>
                    setCategories((prev) =>
                      prev.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)),
                    )
                  }
                  onBlur={() => void saveCategory(c)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label={`Eliminar ${c.name}`}
                  disabled={!can("edit_categories")}
                  onClick={() => void removeCategory(c.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Productos</h2>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              disabled={!can("add_items")}
              onClick={addItem}
            >
              <Plus className="mr-1 size-4" />
              Agregar
            </Button>
          </div>
          {can("add_items") ? null : <Bloqueado texto="Agregar productos nuevos." />}
          {items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Todavía no tienes productos.
            </p>
          ) : null}
          {items.map((it) => (
            <div
              key={it.id}
              className="card-soft space-y-2 rounded-2xl border border-border bg-card p-3"
            >
              <div className="flex items-center gap-2">
                <Input
                  value={it.name}
                  aria-label="Nombre del producto"
                  disabled={!can("edit_item_text")}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((x) => (x.id === it.id ? { ...x, name: e.target.value } : x)),
                    )
                  }
                  onBlur={() => void saveItem(it)}
                />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label={`Eliminar ${it.name}`}
                    disabled={!can("delete_items")}
                    onClick={() => void removeItem(it.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Precio (MXN)</Label>
                      <Input
                        inputMode="decimal"
                        disabled={!can("edit_prices")}
                        value={String(it.price)}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((x) =>
                              x.id === it.id
                                ? { ...x, price: Math.max(0, Number(e.target.value) || 0) }
                                : x,
                            ),
                          )
                        }
                        onBlur={() => void saveItem(it)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Precio en texto</Label>
                      <Input
                        value={it.priceText}
                        placeholder="Ej. desde $80"
                        disabled={!can("edit_prices")}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((x) =>
                              x.id === it.id ? { ...x, priceText: e.target.value } : x,
                            ),
                          )
                        }
                        onBlur={() => void saveItem(it)}
                      />
                    </div>
                  </>
                  <div className="space-y-1">
                    <Label className="text-xs">Categoría</Label>
                    <Select
                      disabled={!can("edit_categories")}
                      value={it.categoryId ?? "none"}
                      onValueChange={(v) =>
                        void saveItem({ ...it, categoryId: v === "none" ? null : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sin categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin categoría</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Imagen (URL)</Label>
                    <Input
                      value={it.imageUrl}
                      disabled={!can("edit_photos")}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((x) => (x.id === it.id ? { ...x, imageUrl: e.target.value } : x)),
                        )
                      }
                      onBlur={() => void saveItem(it)}
                    />
                  </div>
              </div>
                <div className="space-y-1">
                  <Label className="text-xs">Descripción</Label>
                  <Textarea
                    rows={2}
                    disabled={!can("edit_item_text")}
                    value={it.description}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((x) =>
                          x.id === it.id ? { ...x, description: e.target.value } : x,
                        ),
                      )
                    }
                    onBlur={() => void saveItem(it)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    disabled={!can("toggle_items")}
                    checked={it.available}
                    onCheckedChange={(v) => void saveItem({ ...it, available: v })}
                    aria-label="Disponible"
                  />
                  <span className="text-sm text-muted-foreground">Disponible</span>
                </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
