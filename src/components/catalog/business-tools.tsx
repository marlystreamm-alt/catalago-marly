import { copyText } from "@/lib/browser/clipboard";
/** Bitácora filtrable, respaldos versionados y administradores adicionales de un negocio vendido. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Download,
  History,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  menusAddAdmin,
  menusAdminsList,
  menusAudit,
  menusBackups,
  menusExport,
  menusImport,
  menusRestoreBackup,
  menusSetAdmin,
  menusSetMultiAdmin,
} from "@/lib/menus/menus.functions";
import type { MenuAdmin, MenuAuditEntry, MenuBackupVersion, MenuBusiness } from "@/lib/menus/types";

const errText = (e: unknown) => (e instanceof Error ? e.message : "Ocurrió un error");

const when = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso),
  );

const actorLabel: Record<string, string> = {
  dueno: "Dueño",
  admin: "Tú (admin)",
  equipo: "Equipo",
};

const originLabel: Record<string, string> = {
  export: "Exportación",
  import: "Importación",
  restore: "Restauración",
  auto: "Automático",
};

/** Clasifica un movimiento para poder filtrarlo por tipo de cambio. */
function changeKind(e: MenuAuditEntry): string {
  const t = `${e.action} ${e.field}`.toLowerCase();
  if (t.includes("precio")) return "precio";
  if (t.includes("disponib") || t.includes("activo")) return "activo";
  if (t.includes("descrip") || t.includes("nombre") || t.includes("texto")) return "descripcion";
  if (t.includes("foto") || t.includes("imagen") || t.includes("logo")) return "foto";
  if (t.includes("categor")) return "categoria";
  if (t.includes("respald") || t.includes("import") || t.includes("export")) return "respaldo";
  if (t.includes("acceso") || t.includes("contrase") || t.includes("sesión")) return "acceso";
  return "otros";
}

const kindLabel: Record<string, string> = {
  precio: "Precio",
  activo: "Disponibilidad",
  descripcion: "Nombre y descripción",
  foto: "Fotos",
  categoria: "Categorías",
  respaldo: "Respaldos",
  acceso: "Accesos",
  otros: "Otros",
};

export type BusinessToolsSection = "todo" | "administradores" | "respaldos" | "historial";

export function BusinessTools({
  code,
  business,
  onBusinessChange,
  section = "todo",
  clients,
}: {
  code: string;
  business: MenuBusiness;
  onBusinessChange: (b: MenuBusiness) => void;
  section?: BusinessToolsSection;
  clients?: Array<{ id: string; title: string; reference?: string }>;
}) {
  const [audit, setAudit] = useState<MenuAuditEntry[]>([]);
  const [admins, setAdmins] = useState<MenuAdmin[]>([]);
  const [backups, setBackups] = useState<MenuBackupVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [newAdmin, setNewAdmin] = useState("");
  const [source, setSource] = useState<"new" | "client">("new");
  const [clientId, setClientId] = useState("");
  const [username, setUsername] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [shown, setShown] = useState<{ name: string; username: string; password: string } | null>(null);
  const [fActor, setFActor] = useState("todos");
  const [fKind, setFKind] = useState("todos");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fText, setFText] = useState("");
  const [order, setOrder] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const fileRef = useRef<HTMLInputElement>(null);
  const businessId = business.id;
  const availableClients = clients?.filter((client) => !admins.some((admin) => admin.clientId === client.id)) ?? [];

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [a, ad, bk] = await Promise.all([
        menusAudit({ data: { code, businessId, limit: 300 } }),
        menusAdminsList({ data: { code, businessId } }),
        menusBackups({ data: { code, businessId } }),
      ]);
      setAudit(a);
      setAdmins(ad);
      setBackups(bk);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setLoading(false);
    }
  }, [code, businessId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const actors = useMemo(
    () => Array.from(new Set(audit.map((e) => e.actorName || actorLabel[e.actorKind] || "—"))),
    [audit],
  );

  const filtered = useMemo(() => {
    const q = fText.trim().toLowerCase();
    const list = audit.filter((e) => {
      const name = e.actorName || actorLabel[e.actorKind] || "—";
      if (fActor !== "todos" && name !== fActor) return false;
      if (fKind !== "todos" && changeKind(e) !== fKind) return false;
      const day = e.createdAt.slice(0, 10);
      if (fFrom && day < fFrom) return false;
      if (fTo && day > fTo) return false;
      if (q && !`${name} ${e.target} ${e.field} ${e.before} ${e.after}`.toLowerCase().includes(q))
        return false;
      return true;
    });
    list.sort((a, b) =>
      order === "desc"
        ? b.createdAt.localeCompare(a.createdAt)
        : a.createdAt.localeCompare(b.createdAt),
    );
    return list;
  }, [audit, fActor, fKind, fFrom, fTo, fText, order]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => filtered.slice((currentPage - 1) * perPage, currentPage * perPage),
    [filtered, currentPage, perPage],
  );

  useEffect(() => {
    setPage(1);
  }, [fActor, fKind, fFrom, fTo, fText, perPage, order]);

  const exportJson = async () => {
    try {
      const backup = await menusExport({ data: { code, businessId } });
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `catalogo-${business.slug || businessId}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Respaldo descargado y guardado como versión");
      await refresh();
    } catch (e) {
      toast.error(errText(e));
    }
  };

  const importJson = async (file: File) => {
    const replace = window.confirm(
      "Aceptar: reemplaza todo el catálogo de este negocio con el respaldo.\nCancelar: solo agrega lo del respaldo.",
    );
    try {
      const backup = JSON.parse(await file.text()) as unknown;
      const res = await menusImport({
        data: { code, businessId, replace, origin: `archivo ${file.name}`, backup },
      });
      toast.success(`Restaurado: ${res.items} productos · cambios → ${res.resumen}`);
      await refresh();
    } catch (e) {
      toast.error(errText(e));
    }
  };

  const restoreVersion = async (b: MenuBackupVersion) => {
    if (
      !window.confirm(
        `¿Restaurar la versión v${b.version} (${b.itemsCount} productos)? Antes se guarda una versión automática con lo que tienes ahora.`,
      )
    )
      return;
    try {
      const res = await menusRestoreBackup({
        data: { code, businessId, backupId: b.id, replace: true },
      });
      toast.success(`Restaurado a v${b.version} · cambios → ${res.resumen}`);
      await refresh();
    } catch (e) {
      toast.error(errText(e));
    }
  };

  const toggleMulti = async (enabled: boolean) => {
    try {
      const saved = await menusSetMultiAdmin({ data: { code, id: businessId, enabled } });
      onBusinessChange(saved);
    } catch (e) {
      toast.error(errText(e));
    }
  };

  const addAdmin = async () => {
    if (addingAdmin) return;
    setAddingAdmin(true);
    try {
      const access = await menusAddAdmin({
        data: {
          code,
          businessId,
          username,
          ...(source === "client" ? { clientId } : { name: newAdmin }),
        },
      });
      setShown(access);
      setNewAdmin("");
      setUsername("");
      setClientId("");
      await refresh();
      toast.success("Acceso de ayudante creado");
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setAddingAdmin(false);
    }
  };

  const patchAdmin = async (
    a: MenuAdmin,
    change: { suspended?: boolean; regenerate?: boolean; remove?: boolean },
  ) => {
    if (change.remove && !window.confirm(`¿Quitar a ${a.name}?`)) return;
    try {
      const res = await menusSetAdmin({ data: { code, id: a.id, ...change } });
      if (res.password) setShown({
        name: a.name,
        username: a.username ? `${business.slug}/${a.username}` : business.accessUsername || business.slug,
        password: res.password,
      });
      await refresh();
    } catch (e) {
      toast.error(errText(e));
    }
  };

  return (
    <>
      {section === "todo" || section === "administradores" ? (
      <section className="card-soft space-y-3 rounded-2xl border border-border bg-card p-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="size-4 text-primary" />
          Ayudantes del negocio
        </h3>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={business.multiAdmin} onCheckedChange={(v) => void toggleMulti(v)} />
          <span className="min-w-0 flex-1">
            Permitir que este negocio tenga varias personas con contraseña propia
          </span>
        </label>
        <p className="text-xs text-muted-foreground">
          Los ayudantes entran por <a href="/acceso" className="font-semibold underline">Acceso al negocio</a>
          {" "}y usan las funciones habilitadas para este negocio.
        </p>

        {business.multiAdmin ? (
          <>
            <form className="space-y-3" onSubmit={(event) => {
              event.preventDefault();
              void addAdmin();
            }}>
              {clients && (
                <fieldset className="flex flex-wrap gap-3 text-sm">
                  <legend className="mb-1 font-medium">¿A quién quieres dar acceso?</legend>
                  <label className="flex items-center gap-2">
                    <input type="radio" name={`helper-source-${businessId}`} checked={source === "new"} onChange={() => setSource("new")} />
                    Crear usuario
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name={`helper-source-${businessId}`} checked={source === "client"} onChange={() => setSource("client")} disabled={!availableClients.length} />
                    Elegir de mis clientes
                  </label>
                  {!availableClients.length && <p className="w-full text-xs text-muted-foreground">No hay clientes activos disponibles para vincular a este negocio.</p>}
                </fieldset>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {source === "client" ? (
                  <label className="grid gap-1 text-sm font-medium">
                    Cliente
                    <select className="buyer-select" required value={clientId} onChange={(event) => setClientId(event.target.value)}>
                      <option value="">Selecciona un cliente</option>
                      {availableClients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.title}{client.reference ? ` · ${client.reference}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="grid gap-1 text-sm font-medium">
                    Nombre del ayudante
                    <Input required minLength={2} maxLength={160} value={newAdmin} onChange={(event) => setNewAdmin(event.target.value)} />
                  </label>
                )}
                <label className="grid gap-1 text-sm font-medium">
                  Usuario del ayudante
                  <Input required minLength={3} maxLength={30} value={username}
                    onChange={(event) => setUsername(event.target.value.toLowerCase())}
                    autoCapitalize="none" autoCorrect="off" placeholder="ej. laura"
                    pattern="[a-z0-9][a-z0-9._\-]{2,29}" />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Entrará como <strong>{business.slug}/{username || "usuario"}</strong> con una contraseña temporal propia.
              </p>
              <Button type="submit" size="sm" className="rounded-xl" disabled={addingAdmin || loading}>
                <Plus className="mr-1 size-4" />
                {addingAdmin ? "Creando acceso…" : "Crear acceso"}
              </Button>
            </form>
            {shown ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary p-2">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">{shown.name}</p>
                  <p className="break-all">Usuario <code>{shown.username}</code></p>
                  <p className="break-all">Contraseña temporal <code>{shown.password}</code></p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={async () => {
                    try {
                      await copyText(`Acceso: ${window.location.origin}/acceso\nUsuario: ${shown.username}\nContraseña temporal: ${shown.password}`);
                      toast.success("Acceso copiado");
                    } catch {
                      toast.error("No se pudo copiar el acceso");
                    }
                  }}
                >
                  <Copy className="mr-1 size-3.5" />
                  Copiar acceso
                </Button>
              </div>
            ) : null}
            {admins.length === 0 ? (
              <p className="text-xs text-muted-foreground">Todavía no agregas administradores.</p>
            ) : (
              <ul className="space-y-2">
                {admins.map((a) => (
                  <li key={a.id} className="rounded-xl border border-border p-2">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.name}</span>
                      <Badge variant={a.suspended ? "secondary" : "default"}>
                        {a.suspended ? "suspendido" : "activo"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        aria-label={`Quitar ${a.name}`}
                        onClick={() => void patchAdmin(a, { remove: true })}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {a.username ? `${business.slug}/${a.username} · ` : ""}
                      {a.clientId ? "Cliente vinculado · " : ""}
                      {a.temp ? "Contraseña temporal sin cambiar" : "Contraseña propia"}
                      {a.lastLoginAt ? ` · último acceso ${when(a.lastLoginAt)}` : " · sin entrar"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => void patchAdmin(a, { regenerate: true })}
                      >
                        Nueva contraseña
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => void patchAdmin(a, { suspended: !a.suspended })}
                      >
                        {a.suspended ? "Reactivar" : "Suspender"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </section>
      ) : null}

      {section === "todo" || section === "respaldos" ? (
      <section className="card-soft space-y-3 rounded-2xl border border-border bg-card p-3">
        <h3 className="text-sm font-semibold">Respaldos de este catálogo</h3>
        <p className="text-xs text-muted-foreground">
          Solo afecta a {business.name}. Cada exportación, importación y restauración queda guardada
          como versión y anotada en el historial con su origen y resultado.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() => void exportJson()}
          >
            <Download className="mr-1 size-4" />
            Exportar JSON
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-1 size-4" />
            Importar JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void importJson(file);
            }}
          />
        </div>

        {backups.length === 0 ? (
          <p className="text-xs text-muted-foreground">Todavía no hay versiones guardadas.</p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {backups.map((b) => (
              <li key={b.id} className="rounded-xl border border-border p-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">v{b.version}</span>
                  <Badge variant="secondary">{originLabel[b.origin] ?? b.origin}</Badge>
                  <span className="text-muted-foreground">
                    {b.itemsCount} productos · {b.categoriesCount} categorías
                  </span>
                </div>
                <p className="text-muted-foreground">
                  {b.label || "—"} · {when(b.createdAt)}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1 rounded-xl"
                  onClick={() => void restoreVersion(b)}
                >
                  <RotateCcw className="mr-1 size-3.5" />
                  Restaurar a esta versión
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      ) : null}

      {section === "todo" || section === "historial" ? (
      <section className="card-soft space-y-3 rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <h3 className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold">
            <History className="size-4 text-primary" />
            Historial de cambios
          </h3>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => void refresh()}>
            {loading ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
            Actualizar
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Select value={fActor} onValueChange={setFActor}>
            <SelectTrigger aria-label="Filtrar por administrador">
              <SelectValue placeholder="Quién" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los administradores</SelectItem>
              {actors.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fKind} onValueChange={setFKind}>
            <SelectTrigger aria-label="Filtrar por tipo de cambio">
              <SelectValue placeholder="Tipo de cambio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los cambios</SelectItem>
              {Object.entries(kindLabel).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="text-xs text-muted-foreground">
            Desde
            <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground">
            Hasta
            <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
          </label>
          <Input
            className="sm:col-span-2"
            placeholder="Buscar en el historial…"
            value={fText}
            onChange={(e) => setFText(e.target.value)}
          />
          <Select value={order} onValueChange={(v) => setOrder(v as "desc" | "asc")}>
            <SelectTrigger aria-label="Ordenar por fecha">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Más recientes primero</SelectItem>
              <SelectItem value="asc">Más antiguos primero</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(perPage)} onValueChange={(v) => setPerPage(Number(v))}>
            <SelectTrigger aria-label="Movimientos por página">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 por página</SelectItem>
              <SelectItem value="20">20 por página</SelectItem>
              <SelectItem value="50">50 por página</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {filtered.length} de {audit.length} movimientos
          </p>
          {fActor !== "todos" || fKind !== "todos" || fFrom || fTo || fText ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setFActor("todos");
                setFKind("todos");
                setFFrom("");
                setFTo("");
                setFText("");
              }}
            >
              Limpiar filtros
            </Button>
          ) : null}
        </div>

        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground">No hay movimientos con esos filtros.</p>
        ) : (
          <>
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {pageItems.map((e) => (
                <li key={e.id} className="rounded-xl border border-border p-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold">{e.target}</span>
                    <Badge variant="secondary" className="capitalize">
                      {kindLabel[changeKind(e)] ?? e.action}
                    </Badge>
                    <span className="text-muted-foreground">
                      {actorLabel[e.actorKind] ?? e.actorKind}
                      {e.actorName ? ` · ${e.actorName}` : ""}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    {e.field}
                    {e.before || e.after ? `: ${e.before || "—"} → ${e.after || "—"}` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{when(e.createdAt)}</p>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                Siguiente
              </Button>
            </div>
          </>
        )}
      </section>
      ) : null}
    </>
  );
}
