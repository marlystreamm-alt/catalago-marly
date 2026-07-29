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
import { downloadCsv, printPdf, stamp } from "@/lib/catalog/export";
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

const LOG_HEADERS = ["Fecha", "Usuario", "Catálogo", "Acción", "Elemento", "Resumen"];


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
