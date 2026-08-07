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
import type { Features, MenuBusiness, MenuCategory, MenuItem } from "@/lib/menus/types";

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

        {can("edit_business") ? (
          <section className="card-soft space-y-3 rounded-3xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Datos del negocio</h2>
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
          </section>
        ) : null}

        {can("edit_categories") ? (
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Categorías</h2>
              <Button size="sm" variant="outline" className="rounded-xl" onClick={addCategory}>
                <Plus className="mr-1 size-4" />
                Agregar
              </Button>
            </div>
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <Input
                  value={c.name}
                  aria-label="Nombre de la categoría"
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
                  onClick={() => void removeCategory(c.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </section>
        ) : null}

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Productos</h2>
            {can("add_items") ? (
              <Button size="sm" variant="outline" className="rounded-xl" onClick={addItem}>
                <Plus className="mr-1 size-4" />
                Agregar
              </Button>
            ) : null}
          </div>
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
                {can("delete_items") ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label={`Eliminar ${it.name}`}
                    onClick={() => void removeItem(it.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {can("edit_prices") ? (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Precio (MXN)</Label>
                      <Input
                        inputMode="decimal"
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
                ) : null}
                {can("edit_categories") ? (
                  <div className="space-y-1">
                    <Label className="text-xs">Categoría</Label>
                    <Select
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
                ) : null}
                {can("edit_photos") ? (
                  <div className="space-y-1">
                    <Label className="text-xs">Imagen (URL)</Label>
                    <Input
                      value={it.imageUrl}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((x) => (x.id === it.id ? { ...x, imageUrl: e.target.value } : x)),
                        )
                      }
                      onBlur={() => void saveItem(it)}
                    />
                  </div>
                ) : null}
              </div>
              {can("edit_item_text") ? (
                <div className="space-y-1">
                  <Label className="text-xs">Descripción</Label>
                  <Textarea
                    rows={2}
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
              ) : null}
              {can("toggle_items") ? (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={it.available}
                    onCheckedChange={(v) => void saveItem({ ...it, available: v })}
                    aria-label="Disponible"
                  />
                  <span className="text-sm text-muted-foreground">Disponible</span>
                </div>
              ) : null}
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
