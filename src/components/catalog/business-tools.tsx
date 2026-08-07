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

export function BusinessTools({
  code,
  business,
  onBusinessChange,
}: {
  code: string;
  business: MenuBusiness;
  onBusinessChange: (b: MenuBusiness) => void;
}) {
  const [audit, setAudit] = useState<MenuAuditEntry[]>([]);
  const [admins, setAdmins] = useState<MenuAdmin[]>([]);
  const [backups, setBackups] = useState<MenuBackupVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [newAdmin, setNewAdmin] = useState("");
  const [shown, setShown] = useState<{ name: string; password: string } | null>(null);
  const [fActor, setFActor] = useState("todos");
  const [fKind, setFKind] = useState("todos");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fText, setFText] = useState("");
  const [order, setOrder] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [showAllBackups, setShowAllBackups] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const businessId = business.id;

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

  const filtered = useMemo(
    () =>
      audit.filter((e) => {
        const name = e.actorName || actorLabel[e.actorKind] || "—";
        if (fActor !== "todos" && name !== fActor) return false;
        if (fKind !== "todos" && changeKind(e) !== fKind) return false;
        const day = e.createdAt.slice(0, 10);
        if (fFrom && day < fFrom) return false;
        if (fTo && day > fTo) return false;
        return true;
      }),
    [audit, fActor, fKind, fFrom, fTo],
  );

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
    if (newAdmin.trim().length < 2) {
      toast.error("Escribe el nombre del administrador");
      return;
    }
    try {
      const { password } = await menusAddAdmin({
        data: { code, businessId, name: newAdmin.trim() },
      });
      setShown({ name: newAdmin.trim(), password });
      setNewAdmin("");
      await refresh();
      toast.success("Administrador agregado");
    } catch (e) {
      toast.error(errText(e));
    }
  };

  const patchAdmin = async (
    a: MenuAdmin,
    change: { suspended?: boolean; regenerate?: boolean; remove?: boolean },
  ) => {
    if (change.remove && !window.confirm(`¿Quitar a ${a.name}?`)) return;
    try {
      const res = await menusSetAdmin({ data: { code, id: a.id, ...change } });
      if (res.password) setShown({ name: a.name, password: res.password });
      await refresh();
    } catch (e) {
      toast.error(errText(e));
    }
  };

  return (
    <>
      <section className="card-soft space-y-3 rounded-2xl border border-border bg-card p-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="size-4 text-primary" />
          Varios administradores
        </h3>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={business.multiAdmin} onCheckedChange={(v) => void toggleMulti(v)} />
          <span className="min-w-0 flex-1">
            Permitir que este negocio tenga varias personas con contraseña propia
          </span>
        </label>
        <p className="text-xs text-muted-foreground">
          Todos entran en /acceso con el mismo enlace y tienen exactamente los permisos que
          autorizaste arriba.
        </p>

        {business.multiAdmin ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Input
                value={newAdmin}
                placeholder="Nombre (ej. Laura, mostrador)"
                onChange={(e) => setNewAdmin(e.target.value)}
                className="min-w-0 flex-1"
                aria-label="Nombre del administrador"
              />
              <Button size="sm" className="rounded-xl" onClick={() => void addAdmin()}>
                <Plus className="mr-1 size-4" />
                Agregar
              </Button>
            </div>
            {shown ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary p-2">
                <span className="text-xs">{shown.name}:</span>
                <code className="min-w-0 break-all text-sm font-semibold">{shown.password}</code>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    void navigator.clipboard.writeText(shown.password);
                    toast.success("Contraseña copiada");
                  }}
                >
                  <Copy className="mr-1 size-3.5" />
                  Copiar
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
        </div>
        <p className="text-xs text-muted-foreground">
          {filtered.length} de {audit.length} movimientos
        </p>

        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground">No hay movimientos con esos filtros.</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {filtered.map((e) => (
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
        )}
      </section>
    </>
  );
}
