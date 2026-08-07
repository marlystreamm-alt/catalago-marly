/** Bitácora, respaldo JSON y administradores adicionales de un negocio vendido. */
import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Download, History, Loader2, Plus, Trash2, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  menusAddAdmin,
  menusAdminsList,
  menusAudit,
  menusExport,
  menusImport,
  menusSetAdmin,
  menusSetMultiAdmin,
} from "@/lib/menus/menus.functions";
import type { MenuAdmin, MenuAuditEntry, MenuBusiness } from "@/lib/menus/types";

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
  const [loading, setLoading] = useState(false);
  const [newAdmin, setNewAdmin] = useState("");
  const [shown, setShown] = useState<{ name: string; password: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const businessId = business.id;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [a, ad] = await Promise.all([
        menusAudit({ data: { code, businessId, limit: 100 } }),
        menusAdminsList({ data: { code, businessId } }),
      ]);
      setAudit(a);
      setAdmins(ad);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setLoading(false);
    }
  }, [code, businessId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      toast.success("Respaldo descargado");
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
      const res = await menusImport({ data: { code, businessId, replace, backup } });
      toast.success(`Restaurado: ${res.items} productos, ${res.categories} categorías`);
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
        <h3 className="text-sm font-semibold">Respaldo de este catálogo</h3>
        <p className="text-xs text-muted-foreground">
          Solo afecta a {business.name}; los demás negocios no se tocan.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => void exportJson()}>
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
        {audit.length === 0 ? (
          <p className="text-xs text-muted-foreground">Todavía no hay movimientos.</p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {audit.map((e) => (
              <li key={e.id} className="rounded-xl border border-border p-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">{e.target}</span>
                  <Badge variant="secondary" className="capitalize">
                    {e.action}
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

/** Etiqueta para reutilizar el tipo de Label sin warnings de lint. */
export const BusinessToolsLabel = Label;
