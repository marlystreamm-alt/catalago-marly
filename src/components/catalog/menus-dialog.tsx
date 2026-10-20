import { BusinessAppearanceEditor } from './appearance-editor';
import { ImageLibraryPicker } from "@/components/catalog/image-library-picker";
import { copyText } from "@/lib/browser/clipboard";
/** Apartado "Menús" — solo visible dentro del modo administrador. */
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Copy, DatabaseBackup, Eye, EyeOff, ImagePlus, Loader2, Plus, Store, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { friendlyServerError } from "@/lib/server-error";
import { saveLibraryImage } from "@/lib/image-library";
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
import { BusinessTools, type BusinessToolsSection } from "@/components/catalog/business-tools";
import {
  menusCounts,
  menusDeleteBusiness,
  menusDeleteCategory,
  menusDeleteItem,
  menusExport,
  menusList,
  menusLoad,
  menusSaveBusiness,
  menusSaveCategory,
  menusSaveItem,
  menusSetAccess,
  menusSetCredentials,
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
  type MenuSpace,
} from "@/lib/menus/types";

const money = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

const errText = (e: unknown) => friendlyServerError(e, "Ocurrió un error");

export function MenusDialog() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(() => getSavedCode());
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [businesses, setBusinesses] = useState<MenuBusiness[]>([]);
  const [counts, setCounts] = useState<Record<string, { cats: number; items: number }>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [spaces, setSpaces] = useState<MenuSpace[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState("");
  const [accessUsername, setAccessUsername] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [accessPassword2, setAccessPassword2] = useState("");
  const [showAccessPassword, setShowAccessPassword] = useState(false);
  const [masterSection, setMasterSection] = useState<BusinessToolsSection>("todo");

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
        setSpaces(data.spaces);
        setSelectedSpaceId(data.spaces.find((space) => space.kind === "directory")?.id ?? data.spaces[0]?.id ?? "");
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
    setBusy(true);
    setLoadError("");
    try {
      await refreshList(code.trim());
      saveCode(code.trim());
      setUnlocked(true);
    } catch (e) {
      const message = errText(e);
      setLoadError(/Login Redirect|edge-access|Please enable JavaScript/i.test(message) ? "Netlify bloqueó la llamada del servidor. Tus clientes no se borraron." : message);
    } finally {
      setBusy(false);
    }
  }, [code, refreshList]);

  useEffect(() => {
    if (!open) {
      setUnlocked(false);
      setSelected(null);
      return;
    }
    // Si ya se entró al modo administrador, “Mis clientes” no vuelve a pedir PIN.
    // Usa el código guardado del panel privado y valida silenciosamente en el servidor.
    void login();
  }, [open, login]);

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

  const saveCredentials = async (business: MenuBusiness) => {
    const username = accessUsername.trim().toLowerCase();
    if (username.length < 3) return toast.error("Escribe un usuario de al menos 3 caracteres");
    if (accessPassword.length < 6) return toast.error("La contraseña debe tener al menos 6 caracteres");
    if (accessPassword !== accessPassword2) return toast.error("Las contraseñas no coinciden");
    try {
      await menusSetCredentials({ data: { code, id: business.id, username, password: accessPassword } });
      setAccessPassword("");
      setAccessPassword2("");
      await refreshList(code);
      toast.success("Usuario y contraseña guardados");
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

  const addCategory = async (parentId: string | null = null) => {
    if (!selected) return;
    try {
      const saved = await menusSaveCategory({
        data: {
          code,
          category: { businessId: selected, spaceId: selectedSpaceId || null, parentId, name: parentId ? "Subsección" : "Categoría", sortIndex: categories.length },
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

  const copyExistingCardsToSubsection = async (categoryId: string) => {
    if (!selected || !selectedSpaceId) return;
    const source = items.filter((item) => item.spaceId === selectedSpaceId).slice(0, 3);
    if (!source.length) return toast.error("No hay tarjetas para copiar");
    const existingNames = new Set(items.filter((item) => item.categoryId === categoryId).map((item) => item.name.toLowerCase()));
    try {
      const created: MenuItem[] = [];
      for (const item of source) {
        if (existingNames.has(item.name.toLowerCase())) continue;
        created.push(await menusSaveItem({ data: { code, item: { ...item, id: undefined, businessId: selected, spaceId: selectedSpaceId, categoryId, sortIndex: items.length + created.length } } }));
      }
      setItems((prev) => [...prev, ...created]);
      toast.success(created.length ? `${created.length} tarjetas agregadas a la subsección` : "Las tarjetas ya estaban en esta subsección");
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
            spaceId: selectedSpaceId || null,
            categoryId: categories.find((category) => category.spaceId === selectedSpaceId && !category.parentId)?.id ?? null,
            name: "Platillo nuevo",
            description: "",
            price: 0,
            priceText: "",
            imageUrl: "",
            whatsapp: "",
            whatsappMessage: "",
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
  const spaceCategories = categories.filter((category) => category.spaceId === selectedSpaceId);
  const spaceItems = items.filter((item) => item.spaceId === selectedSpaceId);
  const mainCategories = spaceCategories.filter((category) => !category.parentId);

  useEffect(() => {
    setAccessUsername(business?.accessUsername ?? "");
    setAccessPassword("");
    setAccessPassword2("");
  }, [business?.id, business?.accessUsername]);

  const masterBackup = async () => {
    if (!businesses.length) return toast.error("Todavía no hay clientes para respaldar");
    setBusy(true);
    try {
      const catalogs = [];
      for (const b of businesses) catalogs.push(await menusExport({ data: { code, businessId: b.id } }));
      const payload = {
        kind: "ma2-master-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        businesses: catalogs,
      };
      const stamp = new Date().toISOString().slice(0, 10);
      const file = new File([JSON.stringify(payload, null, 2)], `MA2_Backup_${stamp}.json`, { type: "application/json" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> };
      if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
        await nav.share({ title: `Respaldo maestro MA² ${stamp}`, files: [file] });
        toast.success("Respaldo listo para guardar en Drive o Archivos");
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a"); a.href = url; a.download = file.name; a.click(); URL.revokeObjectURL(url);
        toast.success("Respaldo maestro descargado");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error(errText(e));
    } finally { setBusy(false); }
  };

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
          loadError ? (
            <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-semibold text-destructive">No se pudo abrir Mis clientes</p>
              <p className="text-xs text-muted-foreground">{loadError}</p>
              <Button size="sm" variant="outline" onClick={() => void login()}>Reintentar</Button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-border p-5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Abriendo clientes…
            </div>
          )
        ) : !business ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={addBusiness} disabled={busy} size="sm" className="rounded-xl">
                <Plus className="mr-1.5 size-4" />
                Agregar negocio
              </Button>
              <Button onClick={() => void masterBackup()} disabled={busy || businesses.length === 0} size="sm" variant="outline" className="rounded-xl">
                <DatabaseBackup className="mr-1.5 size-4" />
                Respaldo maestro
              </Button>
            </div>
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
                              void copyText(`${origin}/acceso?catalogo=${encodeURIComponent(b.slug)}`);
                              toast.success("Acceso para editar copiado");
                            }}
                          >
                            <Copy className="mr-1 size-3.5" />
                            Acceso dueño
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => {
                              void copyText(`${origin}/${b.slug}`);
                              toast.success("Link para cliente copiado");
                            }}
                          >
                            <Copy className="mr-1 size-3.5" />
                            Link cliente
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
                  <Label htmlFor="biz-tabs">Pestañas autorizadas</Label>
                  <Input
                    id="biz-tabs"
                    type="number"
                    min={1}
                    max={50}
                    value={business.allowedSpaces}
                    onChange={(e) =>
                      setBusinesses((prev) =>
                        prev.map((b) =>
                          b.id === business.id
                            ? { ...b, allowedSpaces: Math.max(1, Number(e.target.value) || 1) }
                            : b,
                        ),
                      )
                    }
                    onBlur={() => void patchBusiness(business)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Incluye 1. Aumenta este número solo cuando le autorices una pestaña extra.
                  </p>
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
              <BusinessAppearanceEditor businessId={business.id} initial={business.appearance} />
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
                        void copyText(`${origin}/acceso?catalogo=${encodeURIComponent(business.slug)}`);
                        toast.success("Acceso para editar copiado");
                      }}
                    >
                      <Copy className="mr-1 size-3.5" />
                      Acceso dueño
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => {
                        void copyText(`${origin}/${business.slug}`);
                        toast.success("Link para cliente copiado");
                      }}
                    >
                      <Copy className="mr-1 size-3.5" />
                      Link cliente
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
              <h3 className="text-sm font-semibold">Acceso del cliente</h3>
              <p className="text-xs text-muted-foreground">
                Tú eliges el usuario y la contraseña. No se genera ninguna clave predeterminada.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="owner-user">Usuario</Label>
                  <Input id="owner-user" value={accessUsername} onChange={(e) => setAccessUsername(e.target.value)} placeholder="Ej. marlycliente01" autoCapitalize="none" autoCorrect="off" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="owner-pass">Contraseña</Label>
                  <div className="relative">
                    <Input id="owner-pass" type={showAccessPassword ? "text" : "password"} value={accessPassword} onChange={(e) => setAccessPassword(e.target.value)} placeholder={business.hasAccess ? "Escribe una nueva para cambiarla" : "Mínimo 6 caracteres"} className="pr-10" />
                    <Button type="button" size="icon" variant="ghost" className="absolute right-1 top-1/2 size-8 -translate-y-1/2" onClick={() => setShowAccessPassword((v) => !v)} aria-label={showAccessPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showAccessPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-start-2">
                  <Label htmlFor="owner-pass2">Confirmar contraseña</Label>
                  <Input id="owner-pass2" type={showAccessPassword ? "text" : "password"} value={accessPassword2} onChange={(e) => setAccessPassword2(e.target.value)} className={accessPassword && accessPassword2 && accessPassword !== accessPassword2 ? "border-destructive" : undefined} />
                  {accessPassword && accessPassword2 && accessPassword !== accessPassword2 ? <p className="text-xs font-medium text-destructive">Las contraseñas no coinciden.</p> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="rounded-xl" onClick={() => void saveCredentials(business)} disabled={!accessUsername.trim() || !accessPassword || accessPassword !== accessPassword2}>Guardar acceso</Button>
                {business.hasAccess ? <>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => void patchAccess(business, { suspended: !business.accessSuspended })}>{business.accessSuspended ? "Reactivar acceso" : "Suspender acceso"}</Button>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => void patchAccess(business, { revoke: true })}>Quitar acceso</Button>
                </> : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {business.hasAccess ? `${business.accessSuspended ? "Suspendido" : "Activo"} · usuario: ${business.accessUsername || "pendiente"}` : "Todavía no tiene usuario y contraseña."}
              </p>
            </section>

            <section className="card-soft space-y-3 rounded-2xl border border-border bg-card p-3">
              <div>
                <h3 className="text-sm font-semibold">Respaldo maestro e historial</h3>
                <p className="text-xs text-muted-foreground">
                  Elige qué tienda quieres revisar y qué información necesitas ver.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Select
                  value={selected ?? business.id}
                  onValueChange={(id) => void openMenu(id)}
                >
                  <SelectTrigger aria-label="Elegir tienda para respaldo e historial">
                    <SelectValue placeholder="Elegir tienda" />
                  </SelectTrigger>
                  <SelectContent>
                    {businesses.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={masterSection}
                  onValueChange={(v) => setMasterSection(v as BusinessToolsSection)}
                >
                  <SelectTrigger aria-label="Elegir apartado del respaldo maestro">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">Resumen completo</SelectItem>
                    <SelectItem value="administradores">Administradores</SelectItem>
                    <SelectItem value="respaldos">Respaldos</SelectItem>
                    <SelectItem value="historial">Historial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>

            <BusinessTools
              code={code}
              business={business}
              section={masterSection}
              onBusinessChange={(saved) =>
                setBusinesses((prev) => prev.map((b) => (b.id === saved.id ? saved : b)))
              }
            />

            {spaces.length ? (
              <section className="space-y-2">
                <Label>Pestaña que estás editando</Label>
                <Select value={selectedSpaceId} onValueChange={setSelectedSpaceId}>
                  <SelectTrigger><SelectValue placeholder="Elige una pestaña" /></SelectTrigger>
                  <SelectContent>{spaces.map((space) => <SelectItem key={space.id} value={space.id}>{space.name}</SelectItem>)}</SelectContent>
                </Select>
              </section>
            ) : null}


            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Categorías</h3>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => void addCategory(null)}>
                  <Plus className="mr-1 size-4" />
                  Agregar
                </Button>
              </div>
              {mainCategories.map((c) => (
                <div key={c.id} className="rounded-2xl border p-2">
                  <div className="flex items-center gap-2">
                    <Input value={c.name} aria-label="Nombre de la categoría" onChange={(e) => setCategories((prev) => prev.map((x) => x.id === c.id ? { ...x, name: e.target.value } : x))} onBlur={() => void patchCategory(c)} />
                    <Button variant="outline" size="sm" className="shrink-0" onClick={() => void addCategory(c.id)}><Plus className="size-4" /> Subsección</Button>
                    <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={`Eliminar ${c.name}`} onClick={() => void removeCategory(c.id)}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                  <div className="ml-4 mt-2 space-y-2">
                    {spaceCategories.filter((sub) => sub.parentId === c.id).map((sub) => (
                      <div key={sub.id} className="flex items-center gap-2">
                        <Input value={sub.name} aria-label="Nombre de la subsección" onChange={(e) => setCategories((prev) => prev.map((x) => x.id === sub.id ? { ...x, name: e.target.value } : x))} onBlur={() => void patchCategory(sub)} />
                        <Button variant="outline" size="sm" className="shrink-0" onClick={() => void copyExistingCardsToSubsection(sub.id)}>Agregar 3 tarjetas</Button>
                        <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={`Eliminar ${sub.name}`} onClick={() => void removeCategory(sub.id)}><Trash2 className="size-4 text-destructive" /></Button>
                      </div>
                    ))}
                  </div>
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
              {spaceItems.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  Sin platillos todavía.
                </p>
              ) : null}
              {spaceItems.map((it) => (
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
                          {spaceCategories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.parentId ? "↳ " : ""}{c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Imagen</Label>
                      <Input
                        value={it.imageUrl}
                        placeholder="URL de imagen"
                        onChange={(e) => setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, imageUrl: e.target.value } : x))}
                        onBlur={() => void patchItem(it)}
                      />
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium">
                        <ImagePlus className="size-4" /> Subir desde galería
                        <input className="hidden" type="file" accept="image/*" onChange={async (e) => {
                          const file=e.target.files?.[0]; e.currentTarget.value=""; if(!file) return;
                          try { const imageUrl=(await saveLibraryImage(file)).dataUrl; const next={...it,imageUrl}; setItems((prev)=>prev.map((x)=>x.id===it.id?next:x)); await patchItem(next); toast.success("Imagen guardada en Supabase y visible en el enlace público"); } catch(err) { toast.error(err instanceof Error?err.message:"No se pudo subir la imagen"); }
                        }} />
                      </label>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">WhatsApp de esta tarjeta</Label>
                      <Input inputMode="tel" value={it.whatsapp} placeholder="Vacío = WhatsApp general" onChange={(e) => setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, whatsapp: e.target.value } : x))} onBlur={() => void patchItem(it)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Mensaje de WhatsApp</Label>
                      <Input value={it.whatsappMessage} placeholder="Vacío = mensaje automático" onChange={(e) => setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, whatsappMessage: e.target.value } : x))} onBlur={() => void patchItem(it)} />
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
