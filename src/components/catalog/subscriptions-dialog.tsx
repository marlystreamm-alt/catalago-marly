/** Panel de suscripciones: clientas con menú propio, renovaciones y estado. */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Copy,
  Loader2,
  Pencil,
  PauseCircle,
  Plus,
  RefreshCw,
  Search,
  Store,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmButton } from "./confirm-button";
import { getSavedCode, saveCode } from "@/lib/notify/client";
import { notifyStatus } from "@/lib/notify/notify.functions";
import {
  subsDelete,
  subsHistory,
  subsList,
  subsRenew,
  subsSave,
  subsSetSuspended,
} from "@/lib/subs/subs.functions";
import {
  STATUS_TEXT,
  formatDate,
  nextExpiry,
  todayISO,
  toSlug,
  type RenewalEntry,
  type SubStatus,
  type Subscription,
} from "@/lib/subs/types";
import { useCatalogStore } from "@/lib/catalog/store";

type Filter = "todos" | SubStatus;

const badgeClass: Record<SubStatus, string> = {
  activo: "bg-primary/10 text-primary",
  por_vencer: "bg-amber-500/15 text-amber-700",
  suspendido: "bg-destructive/10 text-destructive",
};

interface FormState {
  id?: string;
  businessName: string;
  ownerName: string;
  whatsapp: string;
  slug: string;
  catalogId: string;
  plan: string;
  price: string;
  startedOn: string;
  expiresOn: string;
  notes: string;
}

function emptyForm(catalogId: string): FormState {
  const today = todayISO();
  return {
    businessName: "",
    ownerName: "",
    whatsapp: "",
    slug: "",
    catalogId,
    plan: "mensual",
    price: "250",
    startedOn: today,
    expiresOn: nextExpiry(today, 1, today),
    notes: "",
  };
}

export function SubscriptionsDialog() {
  const { isAdmin, state, allCatalogIds } = useCatalogStore();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(() => getSavedCode());
  const [needsCode, setNeedsCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [maxDays, setMaxDays] = useState("todos");
  const [form, setForm] = useState<FormState | null>(null);
  const [history, setHistory] = useState<{ id: string; rows: RenewalEntry[] } | null>(null);

  const load = useCallback(
    async (accessCode: string) => {
      if (!accessCode) {
        setNeedsCode(true);
        return;
      }
      setLoading(true);
      try {
        const rows = await subsList({ data: { code: accessCode } });
        setSubs(rows);
        setNeedsCode(false);
        saveCode(accessCode);
      } catch (error) {
        setNeedsCode(true);
        toast.error(
          String(error).includes("Código")
            ? "Código de administrador incorrecto"
            : "No se pudo cargar la lista",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    void notifyStatus().catch(() => undefined);
    void load(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subs.filter((s) => {
      if (filter !== "todos" && s.status !== filter) return false;
      if (maxDays !== "todos" && s.daysLeft > Number(maxDays)) return false;
      if (!q) return true;
      return [s.businessName, s.ownerName, s.slug, s.whatsapp]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [subs, query, filter, maxDays]);

  const stats = useMemo(() => {
    const activos = subs.filter((s) => s.status === "activo").length;
    const porVencer = subs.filter((s) => s.status === "por_vencer").length;
    const suspendidos = subs.filter((s) => s.status === "suspendido").length;
    const ingreso = subs
      .filter((s) => s.status !== "suspendido")
      .reduce((sum, s) => sum + (s.plan === "anual" ? s.price / 12 : s.price), 0);
    return { activos, porVencer, suspendidos, ingreso };
  }, [subs]);

  if (!isAdmin) return null;

  const run = async (id: string, action: () => Promise<Subscription>, message: string) => {
    setBusyId(id);
    try {
      const updated = await action();
      setSubs((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast.success(message);
    } catch (error) {
      toast.error(String(error).replace("Error: ", ""));
    } finally {
      setBusyId(null);
    }
  };

  const submitForm = async () => {
    if (!form) return;
    const payload = {
      code,
      ...(form.id ? { id: form.id } : {}),
      businessName: form.businessName.trim(),
      ownerName: form.ownerName.trim(),
      whatsapp: form.whatsapp.replace(/[^\d]/g, ""),
      slug: toSlug(form.slug || form.businessName),
      catalogId: form.catalogId,
      plan: form.plan,
      price: Number(form.price) || 0,
      startedOn: form.startedOn,
      expiresOn: form.expiresOn,
      notes: form.notes.trim(),
    };
    if (payload.businessName.length < 2) {
      toast.error("Escribe el nombre del negocio");
      return;
    }
    if (!payload.slug) {
      toast.error("Escribe un enlace válido para el menú");
      return;
    }
    setLoading(true);
    try {
      const saved = await subsSave({ data: payload });
      setSubs((prev) => {
        const exists = prev.some((s) => s.id === saved.id);
        return exists ? prev.map((s) => (s.id === saved.id ? saved : s)) : [...prev, saved];
      });
      setForm(null);
      toast.success("Negocio guardado");
    } catch (error) {
      toast.error(String(error).replace("Error: ", ""));
    } finally {
      setLoading(false);
    }
  };

  const openHistory = async (id: string) => {
    try {
      const rows = await subsHistory({ data: { code, id } });
      setHistory({ id, rows });
    } catch {
      toast.error("No se pudo cargar el historial");
    }
  };

  const publicLink = (slug: string) =>
    `${typeof window === "undefined" ? "" : window.location.origin}/m/${slug}`;

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Store className="size-4" />
        Suscripciones
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Clientes de menú</DialogTitle>
            <DialogDescription>
              Controla las suscripciones mensuales de los menús que vendes a otros negocios.
            </DialogDescription>
          </DialogHeader>

          {needsCode ? (
            <form
              className="grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void load(code);
              }}
            >
              <Label htmlFor="subs-code">Código de administrador</Label>
              <Input
                id="subs-code"
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Tu código de avisos"
              />
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                Entrar
              </Button>
              <p className="text-xs text-muted-foreground">
                Es el mismo código que usas en “Avisos de pedidos”.
              </p>
            </form>
          ) : (
            <div className="grid gap-3">
              <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatBox label="Activos" value={String(stats.activos)} />
                <StatBox label="Por vencer" value={String(stats.porVencer)} />
                <StatBox label="Suspendidos" value={String(stats.suspendidos)} />
                <StatBox
                  label="Ingreso mensual"
                  value={`$${Math.round(stats.ingreso).toLocaleString("es-MX")}`}
                />
              </section>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-10 rounded-full pl-9"
                    placeholder="Buscar negocio…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Buscar negocio"
                  />
                </div>
                <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                  <SelectTrigger className="h-10" aria-label="Filtrar por estado">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    <SelectItem value="activo">Activos</SelectItem>
                    <SelectItem value="por_vencer">Por vencer</SelectItem>
                    <SelectItem value="suspendido">Suspendidos</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={maxDays} onValueChange={setMaxDays}>
                  <SelectTrigger className="h-10" aria-label="Filtrar por vencimiento">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Cualquier fecha</SelectItem>
                    <SelectItem value="0">Ya vencidos</SelectItem>
                    <SelectItem value="5">Vencen en 5 días</SelectItem>
                    <SelectItem value="15">Vencen en 15 días</SelectItem>
                    <SelectItem value="30">Vencen en 30 días</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setForm(emptyForm(allCatalogIds[0] ?? "clientes"))}
                >
                  <Plus className="size-4" />
                  Nuevo negocio
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void load(code)}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Actualizar
                </Button>
              </div>

              {filtered.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  {loading ? "Cargando…" : "No hay negocios que coincidan."}
                </p>
              ) : (
                <ul className="grid gap-2">
                  {filtered.map((sub) => (
                    <li
                      key={sub.id}
                      className="rounded-2xl border border-border bg-card p-3 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{sub.businessName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {sub.ownerName || "Sin propietaria"} · {sub.whatsapp || "sin WhatsApp"}
                          </p>
                        </div>
                        <Badge className={badgeClass[sub.status]} variant="secondary">
                          {STATUS_TEXT[sub.status]}
                        </Badge>
                      </div>

                      <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarClock className="size-3.5" />
                          Vence {formatDate(sub.expiresOn)}
                          {sub.daysLeft >= 0
                            ? ` · faltan ${sub.daysLeft} día(s)`
                            : ` · venció hace ${Math.abs(sub.daysLeft)} día(s)`}
                        </span>
                        <button
                          type="button"
                          className="flex items-center gap-1 truncate text-left text-primary"
                          onClick={() => {
                            void navigator.clipboard
                              ?.writeText(publicLink(sub.slug))
                              .then(() => toast.success("Enlace copiado"))
                              .catch(() => toast.error("No se pudo copiar"));
                          }}
                        >
                          <Copy className="size-3.5 shrink-0" />
                          /m/{sub.slug}
                        </button>
                        <span>
                          Plan {sub.plan} · ${sub.price.toLocaleString("es-MX")} · alta{" "}
                          {formatDate(sub.startedOn)}
                        </span>
                        {sub.notes ? <span className="italic">{sub.notes}</span> : null}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <Button
                          type="button"
                          size="sm"
                          className="h-10"
                          disabled={busyId === sub.id}
                          onClick={() =>
                            void run(
                              sub.id,
                              () => subsRenew({ data: { code, id: sub.id, months: 1 } }),
                              "Renovado 1 mes",
                            )
                          }
                        >
                          Renovar 1 mes
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-10"
                          disabled={busyId === sub.id}
                          onClick={() =>
                            void run(
                              sub.id,
                              () => subsRenew({ data: { code, id: sub.id, months: 12 } }),
                              "Renovado 1 año",
                            )
                          }
                        >
                          Renovar 1 año
                        </Button>
                        {sub.suspended ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-10"
                            disabled={busyId === sub.id}
                            onClick={() =>
                              void run(
                                sub.id,
                                () =>
                                  subsSetSuspended({
                                    data: { code, id: sub.id, suspended: false },
                                  }),
                                "Menú activado",
                              )
                            }
                          >
                            <CheckCircle2 className="size-4" />
                            Activar
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-10"
                            disabled={busyId === sub.id}
                            onClick={() =>
                              void run(
                                sub.id,
                                () =>
                                  subsSetSuspended({ data: { code, id: sub.id, suspended: true } }),
                                "Menú suspendido",
                              )
                            }
                          >
                            <PauseCircle className="size-4" />
                            Suspender
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-10"
                          onClick={() =>
                            setForm({
                              id: sub.id,
                              businessName: sub.businessName,
                              ownerName: sub.ownerName,
                              whatsapp: sub.whatsapp,
                              slug: sub.slug,
                              catalogId: sub.catalogId,
                              plan: sub.plan,
                              price: String(sub.price),
                              startedOn: sub.startedOn,
                              expiresOn: sub.expiresOn,
                              notes: sub.notes,
                            })
                          }
                        >
                          <Pencil className="size-4" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-10"
                          onClick={() => void openHistory(sub.id)}
                        >
                          Historial
                        </Button>
                        <ConfirmButton
                          title={`¿Eliminar ${sub.businessName}?`}
                          description="Se borra la suscripción y su historial. Los catálogos no se tocan."
                          confirmLabel="Eliminar"
                          onConfirm={() => {
                            void subsDelete({ data: { code, id: sub.id } })
                              .then(() => {
                                setSubs((prev) => prev.filter((s) => s.id !== sub.id));
                                toast.success("Negocio eliminado");
                              })
                              .catch(() => toast.error("No se pudo eliminar"));
                          }}
                        >
                          <Button type="button" size="sm" variant="ghost" className="h-10">
                            <Trash2 className="size-4 text-destructive" />
                            Eliminar
                          </Button>
                        </ConfirmButton>
                      </div>

                      {history?.id === sub.id ? (
                        <div className="mt-3 grid gap-1 rounded-xl bg-muted/50 p-2 text-xs">
                          <p className="font-semibold">Historial de renovaciones</p>
                          {history.rows.length === 0 ? (
                            <p className="text-muted-foreground">Sin movimientos.</p>
                          ) : (
                            history.rows.map((row) => (
                              <p key={row.id} className="text-muted-foreground">
                                {new Date(row.createdAt).toLocaleString("es-MX")} · {row.kind}
                                {row.newExpires ? ` → vence ${formatDate(row.newExpires)}` : ""}
                              </p>
                            ))
                          )}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!form} onOpenChange={(v) => (v ? null : setForm(null))}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar negocio" : "Nuevo negocio"}</DialogTitle>
            <DialogDescription>
              Los datos son de la clienta que renta su copia del menú.
            </DialogDescription>
          </DialogHeader>
          {form ? (
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void submitForm();
              }}
            >
              <Field label="Nombre del negocio">
                <Input
                  value={form.businessName}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      businessName: e.target.value,
                      slug: form.id ? form.slug : toSlug(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Propietaria">
                <Input
                  value={form.ownerName}
                  onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                />
              </Field>
              <Field label="WhatsApp">
                <Input
                  inputMode="numeric"
                  placeholder="528112345678"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                />
              </Field>
              <Field label="Enlace público (/m/…)">
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: toSlug(e.target.value) })}
                />
              </Field>
              <Field label="Catálogo que verá">
                <Select
                  value={form.catalogId}
                  onValueChange={(v) => setForm({ ...form, catalogId: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allCatalogIds.map((id) => (
                      <SelectItem key={id} value={id}>
                        {state.catalogs[id]?.name ?? id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Plan">
                  <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensual">Mensual</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Precio MXN">
                  <Input
                    inputMode="decimal"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha de alta">
                  <Input
                    type="date"
                    value={form.startedOn}
                    onChange={(e) => setForm({ ...form, startedOn: e.target.value })}
                  />
                </Field>
                <Field label="Vencimiento">
                  <Input
                    type="date"
                    value={form.expiresOn}
                    onChange={(e) => setForm({ ...form, expiresOn: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Notas">
                <Textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Field>
              <Button type="submit" className="h-11" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                Guardar
              </Button>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-2 text-center">
      <p className="text-lg font-bold leading-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
