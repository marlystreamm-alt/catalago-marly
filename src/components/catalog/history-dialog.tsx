import { useMemo, useState } from "react";
import { FileDown, FileText, History, Trash2 } from "lucide-react";
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
const CURRENT = "__current__";

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

/**
 * Historial unificado: un solo diálogo con alcance
 * "Este catálogo" o "Todos los catálogos" (antes Historial + Bitácora).
 */
export function HistoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { catalog, state, auditLog, isAdmin, clearLog } = useCatalogStore();
  const [action, setAction] = useState<string>(ALL);
  const [scope, setScope] = useState<string>(CURRENT);

  const entries = useMemo(() => {
    const byScope =
      scope === ALL
        ? auditLog
        : auditLog.filter((e) => e.catalogId === (scope === CURRENT ? catalog.id : scope));
    return action === ALL ? byScope : byScope.filter((e) => e.action === action);
  }, [auditLog, action, scope, catalog.id]);

  const scopeName =
    scope === ALL
      ? "Todos los catálogos"
      : scope === CURRENT
        ? catalog.name
        : (state.catalogs[scope]?.name ?? scope);

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
        { label: "Catálogo", value: scopeName },
        {
          label: "Filtro de acción",
          value: action === ALL ? "Todos los movimientos" : LOG_LABELS[action as LogAction],
        },
        { label: "Movimientos exportados", value: String(entries.length) },
      ]),
    [scopeName, action, entries.length],
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
            Creaciones, ediciones y cambios de estado con fecha, usuario, catálogo y acción.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2">
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger aria-label="Alcance del historial">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CURRENT}>Este catálogo ({catalog.name})</SelectItem>
              <SelectItem value={ALL}>Todos los catálogos</SelectItem>
              {Object.values(state.catalogs)
                .filter((c) => c.id !== catalog.id)
                .map((c) => (
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
              <SelectItem value={ALL}>Todos los movimientos</SelectItem>
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
              downloadCsv(`ma2-historial-${stamp()}`, LOG_HEADERS, rows, meta);
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
                `Historial · ${scopeName}`,
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

        <p className="text-xs text-muted-foreground">{entries.length} movimiento(s)</p>

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
                    {scope === ALL ? <Badge variant="outline">{e.catalogName}</Badge> : null}
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(e.at)}</span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-card-foreground">{e.target}</p>
                <p className="text-sm text-muted-foreground">{e.summary}</p>
                <ChangeDiff entry={e} />
                <p className="mt-1 text-xs text-muted-foreground">
                  Por {e.user ?? "Administrador"}
                  {scope === ALL ? "" : ` · ${e.catalogName}`}
                </p>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <ConfirmButton
            title="¿Vaciar el historial?"
            description={`Se borrarán los movimientos registrados de ${catalog.name}.`}
            confirmLabel="Vaciar"
            onConfirm={clearLog}
          >
            <Button variant="outline" size="sm">
              <Trash2 className="size-4 text-destructive" />
              Vaciar este catálogo
            </Button>
          </ConfirmButton>
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
