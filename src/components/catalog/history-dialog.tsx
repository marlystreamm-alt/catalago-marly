import { useMemo, useState } from "react";
import { FileDown, FileText, History, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCatalogStore } from "@/lib/catalog/store";
import { buildMeta, downloadCsv, formatStamp, printPdf, stamp } from "@/lib/catalog/export";
import { LOG_LABELS, type LogAction } from "@/lib/catalog/types";
import { ConfirmButton } from "./confirm-button";

const ALL = "__all__";

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Muestra el valor anterior y el nuevo cuando la acción los registró. */
function ChangeDiff({ entry }: { entry: { field?: string; before?: string; after?: string } }) {
  if (!entry.field || (entry.before === undefined && entry.after === undefined)) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="font-semibold text-muted-foreground">{entry.field}:</span>
      <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-destructive line-through">
        {entry.before || "—"}
      </span>
      <span className="text-muted-foreground">→</span>
      <span className="rounded-md bg-primary/10 px-2 py-0.5 font-semibold text-primary">
        {entry.after || "—"}
      </span>
    </div>
  );
}

const LOG_HEADERS = [

  "Fecha",
  "Usuario",
  "Catálogo",
  "Acción",
  "Elemento",
  "Resumen",
  "Campo",
  "Valor anterior",
  "Valor nuevo",
];

export function HistoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { catalog, isAdmin, clearLog } = useCatalogStore();
  const [filter, setFilter] = useState<string>(ALL);

  const entries = useMemo(
    () => (filter === ALL ? catalog.log : catalog.log.filter((e) => e.action === filter)),
    [catalog.log, filter],
  );

  const rows = useMemo(
    () =>
      entries.map((e) => [
        formatDate(e.at),
        e.user ?? "Administrador",
        catalog.name,
        LOG_LABELS[e.action],
        e.target,
        e.summary,
        e.field ?? "",
        e.before ?? "",
        e.after ?? "",
      ]),
    [entries, catalog.name],
  );

  const meta = useMemo(
    () =>
      buildMeta([
        { label: "Catálogo", value: catalog.name },
        {
          label: "Filtro de acción",
          value: filter === ALL ? "Todos los movimientos" : LOG_LABELS[filter as LogAction],
        },
        { label: "Movimientos exportados", value: String(entries.length) },
      ]),
    [catalog.name, filter, entries.length],
  );

  if (!isAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" />
            Historial de cambios
          </DialogTitle>
          <DialogDescription>
            Registro de creaciones, ediciones y cambios de estado en {catalog.name}.
          </DialogDescription>
        </DialogHeader>

        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger aria-label="Filtrar historial">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los movimientos</SelectItem>
            {(Object.keys(LOG_LABELS) as LogAction[]).map((a) => (
              <SelectItem key={a} value={a}>
                {LOG_LABELS[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!rows.length}
            onClick={() => {
              downloadCsv(`ma2-historial-${catalog.id}-${stamp()}`, LOG_HEADERS, rows, meta);
              toast.success("Historial exportado en CSV");
            }}
          >
            <FileDown className="size-4" />
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!rows.length}
            onClick={() => {
              const ok = printPdf(
                `Historial · ${catalog.name}`,
                `${rows.length} movimiento(s) · generado el ${formatStamp()}`,
                LOG_HEADERS,
                rows,
                meta,
              );
              if (!ok) toast.error("Permite ventanas emergentes para generar el PDF");
            }}
          >
            <FileText className="size-4" />
            Exportar PDF
          </Button>
        </div>


        <div className="grid gap-2">
          {entries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Todavía no hay movimientos registrados.
            </p>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="rounded-xl border border-border bg-muted/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary">{LOG_LABELS[e.action]}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(e.at)}</span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-card-foreground">{e.target}</p>
                <p className="text-sm text-muted-foreground">{e.summary}</p>
                <ChangeDiff entry={e} />

                <p className="mt-1 text-xs text-muted-foreground">
                  Por {e.user ?? "Administrador"} · {catalog.name}
                </p>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <ConfirmButton
            title="¿Vaciar el historial?"
            description="Se borrarán los movimientos registrados de este catálogo."
            confirmLabel="Vaciar"
            onConfirm={clearLog}
          >
            <Button variant="outline" size="sm">
              <Trash2 className="size-4 text-destructive" />
              Vaciar historial
            </Button>
          </ConfirmButton>
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CatalogVisibilityDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { state, isAdmin, toggleCatalogHidden } = useCatalogStore();
  if (!isAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mostrar u ocultar catálogos</DialogTitle>
          <DialogDescription>
            Los catálogos ocultos no aparecen para el público, pero siguen visibles para ti.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {(Object.values(state.catalogs) as { id: string; name: string; hidden: boolean }[]).map(
            (c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-card-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.hidden ? "Oculto al público" : "Visible al público"}
                  </p>
                </div>
                <Button
                  variant={c.hidden ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleCatalogHidden(c.id as never)}
                >
                  {c.hidden ? "Mostrar" : "Ocultar"}
                </Button>
              </div>
            ),
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Bitácora de auditoría: todos los catálogos con fecha, usuario, catálogo y acción. */
export function AuditDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { auditLog, isAdmin, state } = useCatalogStore();
  const [action, setAction] = useState<string>(ALL);
  const [scope, setScope] = useState<string>(ALL);

  const entries = useMemo(
    () =>
      auditLog.filter(
        (e) => (action === ALL || e.action === action) && (scope === ALL || e.catalogId === scope),
      ),
    [auditLog, action, scope],
  );

  const rows = useMemo(
    () =>
      entries.map((e) => [
        formatDate(e.at),
        e.user ?? "Administrador",
        e.catalogName,
        LOG_LABELS[e.action],
        e.target,
        e.summary,
        e.field ?? "",
        e.before ?? "",
        e.after ?? "",
      ]),
    [entries],
  );

  const meta = useMemo(
    () =>
      buildMeta([
        {
          label: "Catálogo",
          value:
            scope === ALL
              ? "Todos los catálogos"
              : (state.catalogs[scope as keyof typeof state.catalogs]?.name ?? scope),
        },
        {
          label: "Filtro de acción",
          value: action === ALL ? "Todas las acciones" : LOG_LABELS[action as LogAction],
        },
        { label: "Movimientos exportados", value: String(entries.length) },
      ]),
    [scope, action, entries.length, state.catalogs],
  );


  if (!isAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4" />
            Bitácora de auditoría
          </DialogTitle>
          <DialogDescription>
            Registro completo de los tres catálogos con fecha, usuario, catálogo y acción.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2">
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger aria-label="Filtrar por catálogo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los catálogos</SelectItem>
              {Object.values(state.catalogs).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger aria-label="Filtrar por acción">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas las acciones</SelectItem>
              {(Object.keys(LOG_LABELS) as LogAction[]).map((a) => (
                <SelectItem key={a} value={a}>
                  {LOG_LABELS[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!rows.length}
            onClick={() => {
              downloadCsv(`ma2-auditoria-${stamp()}`, LOG_HEADERS, rows, meta);
              toast.success("Bitácora exportada en CSV");
            }}
          >
            <FileDown className="size-4" />
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!rows.length}
            onClick={() => {
              const ok = printPdf(
                "Bitácora de auditoría MA²",
                `${rows.length} movimiento(s) · generado el ${formatStamp()}`,
                LOG_HEADERS,
                rows,
                meta,
              );

              if (!ok) toast.error("Permite ventanas emergentes para generar el PDF");
            }}
          >
            <FileText className="size-4" />
            Exportar PDF
          </Button>
        </div>

        <div className="grid gap-2">
          {entries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No hay movimientos con estos filtros.
            </p>
          ) : (
            entries.map((e) => (
              <div
                key={`${e.catalogId}-${e.id}`}
                className="rounded-xl border border-border bg-muted/40 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{LOG_LABELS[e.action]}</Badge>
                    <Badge variant="outline">{e.catalogName}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(e.at)}</span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-card-foreground">{e.target}</p>
                <p className="text-sm text-muted-foreground">{e.summary}</p>
                <ChangeDiff entry={e} />

                <p className="mt-1 text-xs text-muted-foreground">
                  Por {e.user ?? "Administrador"}
                </p>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
