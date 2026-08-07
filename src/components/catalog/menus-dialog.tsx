/** Apartado "Menús" — solo visible dentro del modo administrador. */
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Copy, Loader2, Plus, Store, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSavedCode, saveCode } from "@/lib/notify/client";
import { BusinessTools } from "@/components/catalog/business-tools";
import {
  menusCounts,
  menusDeleteBusiness,
  menusDeleteCategory,
  menusDeleteItem,
  menusGenerateAccess,
  menusList,
  menusLoad,
  menusSaveBusiness,
  menusSaveCategory,
  menusSaveItem,
  menusSetAccess,
  menusSetFeatures,
} from "@/lib/menus/menus.functions";
import {
  businessStatus,
  EDIT_FEATURES,
  FEATURE_LABELS,
  VIEW_FEATURES,
  type FeatureKey,
  type MenuBusiness,
  type MenuCategory,
  type MenuItem,
} from "@/lib/menus/types";

const money = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

const errText = (e: unknown) => (e instanceof Error ? e.message : "Ocurrió un error");

export function MenusDialog() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(getSavedCode());
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [businesses, setBusinesses] = useState<MenuBusiness[]>([]);
  const [counts, setCounts] = useState<Record<string, { cats: number; items: number }>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [newPassword, setNewPassword] = useState<{ id: string; value: string } | null>(null);

  const refreshList = useCallback(async (value: string) => {
    const [list, c] = await Promise.all([
      menusList({ data: { code: value } }),
      menusCounts({ data: { code: value } }),
    ]);
    setBusinesses(list);
    setCounts(c);
  }, []);

  const openMenu = useCallback(
    async (businessId: string) => {
      setBusy(true);
      try {
        const data = await menusLoad({ data: { code, businessId } });
        setCategories(data.categories);
        setItems(data.items);
        setSelected(businessId);
      } catch (e) {
        toast.error(errText(e));
      } finally {
        setBusy(false);
      }
    },
    [code],
  );

  const login = useCallback(async () => {
    if (code.trim().length < 4) {
      toast.error("Escribe tu código de administrador (mínimo 4 caracteres)");
      return;
    }
    setBusy(true);
    try {
      await refreshList(code.trim());
      saveCode(code.trim());
      setUnlocked(true);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  }, [code, refreshList]);

  useEffect(() => {
    if (!open) {
      setUnlocked(false);
      setSelected(null);
    }
  }, [open]);

  /* --------------------------------- Negocios -------------------------------- */

  const addBusiness = async () => {
    setBusy(true);
    try {
      await menusSaveBusiness({
        data: {
          code,
          business: {
            slug: "",
            name: "Negocio nuevo",
            ownerName: "",
            whatsapp: "",
            address: "",
            notes: "",
            active: true,
            sortIndex: businesses.length,
          },
        },
      });
      await refreshList(code);
      toast.success("Negocio creado");
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const patchBusiness = async (business: MenuBusiness) => {
    try {
      const saved = await menusSaveBusiness({ data: { code, business } });
      setBusinesses((prev) => prev.map((b) => (b.id === saved.id ? saved : b)));
    } catch (e) {
      toast.error(errText(e));
    }
  };

  const toggleFeature = async (business: MenuBusiness, key: FeatureKey, value: boolean) => {
    const features = { ...business.features, [key]: value };
    setBusinesses((prev) => prev.map((b) => (b.id === business.id ? { ...b, features } : b)));
    try {
      const saved = await menusSetFeatures({ data: { code, id: business.id, features } });
      setBusinesses((prev) => prev.map((b) => (b.id === saved.id ? saved : b)));
    } catch (e) {
      toast.error(errText(e));
      await refreshList(code);
    }
  };

  const generateAccess = async (business: MenuBusiness) => {
    try {
      const { password } = await menusGenerateAccess({ data: { code, id: business.id } });
      setNewPassword({ id: business.id, value: password });
      await refreshList(code);
      toast.success("Contraseña temporal generada");
    } catch (e) {
      toast.error(errText(e));
    }
  };

  const patchAccess = async (
    business: MenuBusiness,
    change: { suspended?: boolean; revoke?: boolean },
  ) => {
    try {
      const saved = await menusSetAccess({ data: { code, id: business.id, ...change } });
      setBusinesses((prev) => prev.map((b) => (b.id === saved.id ? saved : b)));
      if (change.revoke) setNewPassword(null);
    } catch (e) {
      toast.error(errText(e));
    }
  };


  const removeBusiness = async (id: string) => {
    if (!window.confirm("¿Eliminar este negocio y todo su menú?")) return;
    try {
      await menusDeleteBusiness({ data: { code, id } });
      setBusinesses((prev) => prev.filter((b) => b.id !== id));
      if (selected === id) setSelected(null);
      toast.success("Negocio eliminado");
    } catch (e) {
      toast.error(errText(e));
    }
  };

  /* -------------------------------- Categorías ------------------------------- */

  const addCategory = async () => {
    if (!selected) return;
    try {
      const saved = await menusSaveCategory({
        data: {
          code,
          category: { businessId: selected, name: "Categoría", sortIndex: categories.length },
        },
      });
      setCategories((prev) => [...prev, saved]);
    } catch (e) {
      toast.error(errText(e));
    }
  };

  const patchCategory = async (category: MenuCategory) => {
    try {
      const saved = await menusSaveCategory({ data: { code, category } });
      setCategories((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
    } catch (e) {
      toast.error(errText(e));
    }
  };

  const removeCategory = async (id: string) => {
    if (!window.confirm("¿Eliminar esta categoría? Sus platillos quedarán sin categoría.")) return;
    try {
      await menusDeleteCategory({ data: { code, id } });
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setItems((prev) => prev.map((i) => (i.categoryId === id ? { ...i, categoryId: null } : i)));
    } catch (e) {
      toast.error(errText(e));
    }
  };

  /* --------------------------------- Platillos -------------------------------- */

  const addItem = async () => {
    if (!selected) return;
    try {
      const saved = await menusSaveItem({
        data: {
          code,
          item: {
            businessId: selected,
            categoryId: categories[0]?.id ?? null,
            name: "Platillo nuevo",
            description: "",
            price: 0,
            priceText: "",
            imageUrl: "",
            available: true,
            sortIndex: items.length,
          },
        },
      });
      setItems((prev) => [...prev, saved]);
    } catch (e) {
      toast.error(errText(e));
    }
  };

  const patchItem = async (item: MenuItem) => {
    try {
      const saved = await menusSaveItem({ data: { code, item } });
      setItems((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));
    } catch (e) {
      toast.error(errText(e));
    }
  };

  const removeItem = async (id: string) => {
    if (!window.confirm("¿Eliminar este platillo?")) return;
    try {
      await menusDeleteItem({ data: { code, id } });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      toast.error(errText(e));
    }
  };

  const business = businesses.find((b) => b.id === selected) ?? null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl">
          <UtensilsCrossed className="mr-1.5 size-4" />
          Mis clientes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>Mis clientes · catálogos vendidos</DialogTitle>
          <DialogDescription>
            Apartado privado del administrador. Los clientes del catálogo no lo ven.
          </DialogDescription>
        </DialogHeader>

        {!unlocked ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="menus-code">Código de administrador</Label>
              <Input
                id="menus-code"
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Tu código de avisos"
                autoComplete="current-password"
              />
              <p className="text-xs text-muted-foreground">
                Es el mismo código que usas en “Avisos de pedidos”.
              </p>
            </div>
            <Button onClick={login} disabled={busy} className="w-full rounded-xl">
              {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              Entrar
            </Button>
          </div>
        ) : !business ? (
          <div className="space-y-3">
            <Button onClick={addBusiness} disabled={busy} size="sm" className="rounded-xl">
              <Plus className="mr-1.5 size-4" />
              Agregar negocio
            </Button>
            {businesses.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                Todavía no hay negocios. Agrega el primero para armar su menú.
              </p>
            ) : (
              <ul className="space-y-2">
                {businesses.map((b) => {
                  const status = businessStatus(b);
                  const c = counts[b.id] ?? { cats: 0, items: 0 };
                  return (
                    <li
                      key={b.id}
                      className="card-soft space-y-2 rounded-2xl border border-border bg-card p-3"
                    >
                      <div className="flex items-center gap-2">
                        <Store className="size-4 shrink-0 text-primary" />
                        <button
                          type="button"
                          onClick={() => void openMenu(b.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block truncate text-sm font-semibold">{b.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {b.ownerName || "Sin dueño"} · {b.whatsapp || "sin WhatsApp"}
                          </span>
                        </button>
                        <Badge
                          variant={status === "activo" ? "default" : "secondary"}
                          className="shrink-0 capitalize"
                        >
                          {status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          aria-label={`Eliminar ${b.name}`}
                          onClick={() => void removeBusiness(b.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {c.items} productos · {c.cats} categorías
                        </span>
                        <span>·</span>
                        <span>{b.hasAccess ? "Clave entregada" : "Sin clave"}</span>
                        {b.expiresOn ? <span>· vence {b.expiresOn}</span> : null}
                      </div>
                      {b.slug ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={`/${b.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 break-all text-xs text-primary underline"
                          >
                            {`${origin}/${b.slug}`}
                          </a>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => {
                              void navigator.clipboard.writeText(`${origin}/${b.slug}`);
                              toast.success("Enlace copiado");
                            }}
                          >
                            <Copy className="mr-1 size-3.5" />
                            Copiar
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl px-2"
              onClick={() => setSelected(null)}
            >
              <ChevronLeft className="mr-1 size-4" />
              Todos los negocios
            </Button>

            <section className="card-soft space-y-3 rounded-2xl border border-border bg-card p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="biz-name">Negocio</Label>
                  <Input
                    id="biz-name"
                    value={business.name}
                    onChange={(e) =>
                      setBusinesses((prev) =>
                        prev.map((b) => (b.id === business.id ? { ...b, name: e.target.value } : b)),
                      )
                    }
                    onBlur={() => void patchBusiness(business)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="biz-owner">Dueño</Label>
                  <Input
                    id="biz-owner"
                    value={business.ownerName}
                    onChange={(e) =>
                      setBusinesses((prev) =>
                        prev.map((b) =>
                          b.id === business.id ? { ...b, ownerName: e.target.value } : b,
                        ),
                      )
                    }
                    onBlur={() => void patchBusiness(business)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="biz-wa">WhatsApp</Label>
                  <Input
                    id="biz-wa"
                    inputMode="tel"
                    value={business.whatsapp}
                    onChange={(e) =>
                      setBusinesses((prev) =>
                        prev.map((b) =>
                          b.id === business.id ? { ...b, whatsapp: e.target.value } : b,
                        ),
                      )
                    }
                    onBlur={() => void patchBusiness(business)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="biz-address">Dirección</Label>
                  <Input
                    id="biz-address"
                    value={business.address}
                    onChange={(e) =>
                      setBusinesses((prev) =>
                        prev.map((b) =>
                          b.id === business.id ? { ...b, address: e.target.value } : b,
                        ),
                      )
                    }
                    onBlur={() => void patchBusiness(business)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="biz-expires">Vence el</Label>
                  <Input
                    id="biz-expires"
                    type="date"
                    value={business.expiresOn ?? ""}
                    onChange={(e) =>
                      setBusinesses((prev) =>
                        prev.map((b) =>
                          b.id === business.id ? { ...b, expiresOn: e.target.value || null } : b,
                        ),
                      )
                    }
                    onBlur={() => void patchBusiness(business)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="biz-logo">Logo (URL)</Label>
                  <Input
                    id="biz-logo"
                    value={business.logoUrl}
                    onChange={(e) =>
                      setBusinesses((prev) =>
                        prev.map((b) =>
                          b.id === business.id ? { ...b, logoUrl: e.target.value } : b,
                        ),
                      )
                    }
                    onBlur={() => void patchBusiness(business)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-slug">Enlace público</Label>
                <Input
                  id="biz-slug"
                  value={business.slug}
                  placeholder="tacos-don-beto"
                  onChange={(e) =>
                    setBusinesses((prev) =>
                      prev.map((b) => (b.id === business.id ? { ...b, slug: e.target.value } : b)),
                    )
                  }
                  onBlur={() => void patchBusiness(business)}
                />
                {business.slug ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/${business.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 break-all text-xs text-primary underline"
                    >
                      {`${origin}/${business.slug}`}
                    </a>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => {
                        void navigator.clipboard.writeText(`${origin}/${business.slug}`);
                        toast.success("Enlace copiado");
                      }}
                    >
                      <Copy className="mr-1 size-3.5" />
                      Copiar
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Se genera solo con el nombre del negocio al guardar.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-notes">Notas</Label>
                <Textarea
                  id="biz-notes"
                  rows={2}
                  value={business.notes}
                  onChange={(e) =>
                    setBusinesses((prev) =>
                      prev.map((b) => (b.id === business.id ? { ...b, notes: e.target.value } : b)),
                    )
                  }
                  onBlur={() => void patchBusiness(business)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="biz-active"
                  checked={business.active}
                  onCheckedChange={(v) => void patchBusiness({ ...business, active: v })}
                />
                <Label htmlFor="biz-active">Catálogo activo</Label>
                <Badge variant="secondary" className="ml-auto capitalize">
                  {businessStatus(business)}
                </Badge>
              </div>
            </section>

            <section className="card-soft space-y-3 rounded-2xl border border-border bg-card p-3">
              <h3 className="text-sm font-semibold">Lo que ve el público</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {VIEW_FEATURES.map((k) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={business.features[k]}
                      onCheckedChange={(v) => void toggleFeature(business, k, v)}
                      aria-label={FEATURE_LABELS[k]}
                    />
                    <span className="min-w-0 flex-1">{FEATURE_LABELS[k]}</span>
                  </label>
                ))}
              </div>
              <h3 className="pt-1 text-sm font-semibold">Lo que el dueño puede editar</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {EDIT_FEATURES.map((k) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={business.features[k]}
                      onCheckedChange={(v) => void toggleFeature(business, k, v)}
                      aria-label={FEATURE_LABELS[k]}
                    />
                    <span className="min-w-0 flex-1">{FEATURE_LABELS[k]}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="card-soft space-y-3 rounded-2xl border border-border bg-card p-3">
              <h3 className="text-sm font-semibold">Acceso del dueño</h3>
              <p className="text-xs text-muted-foreground">
                Entra en {origin}/acceso con su enlace ({business.slug || "sin enlace"}) y la
                contraseña temporal que le generes. Él la cambia al entrar.
              </p>
              {newPassword?.id === business.id ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary p-2">
                  <code className="min-w-0 break-all text-sm font-semibold">
                    {newPassword.value}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      void navigator.clipboard.writeText(newPassword.value);
                      toast.success("Contraseña copiada");
                    }}
                  >
                    <Copy className="mr-1 size-3.5" />
                    Copiar
                  </Button>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="rounded-xl"
                  onClick={() => void generateAccess(business)}
                >
                  {business.hasAccess ? "Generar nueva contraseña" : "Generar contraseña"}
                </Button>
                {business.hasAccess ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() =>
                        void patchAccess(business, { suspended: !business.accessSuspended })
                      }
                    >
                      {business.accessSuspended ? "Reactivar acceso" : "Suspender acceso"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => void patchAccess(business, { revoke: true })}
                    >
                      Quitar acceso
                    </Button>
                  </>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {business.hasAccess
                  ? `${business.accessSuspended ? "Suspendido" : "Activo"}${
                      business.accessTemp ? " · contraseña temporal sin cambiar" : ""
                    }`
                  : "Todavía no tiene contraseña."}
              </p>
            </section>

            <BusinessTools
              code={code}
              business={business}
              onBusinessChange={(saved) =>
                setBusinesses((prev) => prev.map((b) => (b.id === saved.id ? saved : b)))
              }
            />


            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Categorías</h3>
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
                    onBlur={() => void patchCategory(c)}
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

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Platillos</h3>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={addItem}>
                  <Plus className="mr-1 size-4" />
                  Agregar
                </Button>
              </div>
              {items.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  Sin platillos todavía.
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
                      aria-label="Nombre del platillo"
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((x) => (x.id === it.id ? { ...x, name: e.target.value } : x)),
                        )
                      }
                      onBlur={() => void patchItem(it)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label={`Eliminar ${it.name}`}
                      onClick={() => void removeItem(it.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
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
                        onBlur={() => void patchItem(it)}
                      />
                      <p className="text-[11px] text-muted-foreground">{money(it.price)}</p>
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
                        onBlur={() => void patchItem(it)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Categoría</Label>
                      <Select
                        value={it.categoryId ?? "none"}
                        onValueChange={(v) =>
                          void patchItem({ ...it, categoryId: v === "none" ? null : v })
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
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((x) =>
                              x.id === it.id ? { ...x, imageUrl: e.target.value } : x,
                            ),
                          )
                        }
                        onBlur={() => void patchItem(it)}
                      />
                    </div>
                  </div>
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
                      onBlur={() => void patchItem(it)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={it.available}
                      onCheckedChange={(v) => void patchItem({ ...it, available: v })}
                      aria-label="Disponible"
                    />
                    <span className="text-sm text-muted-foreground">Disponible</span>
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
