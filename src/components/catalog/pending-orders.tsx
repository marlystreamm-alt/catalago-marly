import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Download,
  Info,
  RotateCw,
  Send,
  Upload,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MAX_ATTEMPTS_LIMIT,
  MIN_ATTEMPTS,
  useOrderQueue,
} from "@/lib/catalog/order-queue";
import {
  ORDER_STATUS_LABELS,
  buildOrdersBackup,
  downloadTextFile,
  parseOrdersBackup,
  type OrderStatus,
  type PendingOrder,
} from "@/lib/catalog/orders";
import { OrderDetailDialog } from "./order-detail-dialog";
import { toast } from "sonner";
import { formatMXN } from "@/lib/catalog/whatsapp";
import { useOnline } from "@/hooks/use-online";
import { ConfirmButton } from "./confirm-button";

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  cola: "bg-muted text-muted-foreground",
  enviando: "bg-primary/15 text-primary",
  enviado: "bg-emerald-500/15 text-emerald-700",
  fallido: "bg-destructive/15 text-destructive",
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const Icon =
    status === "enviado"
      ? CheckCircle2
      : status === "fallido"
        ? AlertTriangle
        : status === "enviando"
          ? Loader2
          : Clock;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      <Icon className={`size-3.5 ${status === "enviando" ? "animate-spin" : ""}`} />
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

const FILTERS: { key: OrderStatus | "todos"; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "cola", label: "En cola" },
  { key: "enviando", label: "Enviando" },
  { key: "enviado", label: "Enviado" },
  { key: "fallido", label: "Fallido" },
];

/** Aviso y detalle de los pedidos guardados mientras no hubo internet. */
export function PendingOrdersBar() {
  const {
    orders,
    pending,
    sendAll,
    sendOne,
    remove,
    clear,
    clearSent,
    retryFailed,
    maxAttempts,
    setMaxAttempts,
    autoRetry,
    setAutoRetry,
    importOrders,
  } = useOrderQueue();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<OrderStatus | "todos">("todos");
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importMode = useRef<"merge" | "replace">("merge");

  const detailOrder = orders.find((o) => o.id === detailId) ?? null;

  const exportJson = () => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadTextFile(
      `ma2-pedidos-${stamp}.json`,
      JSON.stringify(buildOrdersBackup(orders), null, 2),
    );
    toast.success("Historial de pedidos exportado en JSON");
  };

  const pickFile = (mode: "merge" | "replace") => {
    importMode.current = mode;
    fileRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const list = parseOrdersBackup(await file.text());
      importOrders(list, importMode.current);
    } catch (error) {
      console.error("No se pudo importar el historial de pedidos:", error);
      toast.error("El archivo JSON no es un respaldo de pedidos válido");
    }
  };

  const counts = useMemo(() => {
    const base: Record<OrderStatus, number> = { cola: 0, enviando: 0, enviado: 0, fallido: 0 };
    orders.forEach((o) => {
      base[o.status] += 1;
    });
    return base;
  }, [orders]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter(
      (o) =>
        (filter === "todos" || o.status === filter) &&
        (!q ||
          o.serviceName.toLowerCase().includes(q) ||
          o.catalogName.toLowerCase().includes(q) ||
          o.message.toLowerCase().includes(q)),
    );
  }, [orders, filter, query]);

  const retryable = orders.filter(
    (o) => o.status === "fallido" && o.attempts < maxAttempts,
  ).length;

  if (!orders.length) return null;

  return (
    <>
      <div className="card-soft mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <Clock className="size-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          {pending.length ? (
            <>
              Tienes <strong className="text-card-foreground">{pending.length}</strong> pedido(s)
              pendiente(s).{" "}
              {online
                ? "Se envían por WhatsApp automáticamente."
                : autoRetry
                  ? "Se reintentarán solos al recuperar la conexión."
                  : "El reintento automático está desactivado."}
            </>
          ) : (
            <>Todos tus pedidos fueron enviados por WhatsApp.</>
          )}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(counts) as OrderStatus[])
            .filter((s) => counts[s] > 0)
            .map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <StatusBadge status={s} />
                <span className="text-xs text-muted-foreground">{counts[s]}</span>
              </span>
            ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Ver pedidos
        </Button>
        {online && pending.length ? (
          <Button size="sm" onClick={sendAll}>
            <Send className="size-4" />
            Enviar ahora
          </Button>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="size-4" />
              Estado de tus pedidos
            </DialogTitle>
            <DialogDescription>
              En cola, enviando, enviado o fallido. Los fallidos se reintentan solos al recuperar la
              conexión mientras no superen el límite de intentos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 rounded-xl border border-border bg-muted/40 p-3">
            <label className="flex items-center justify-between gap-3 text-sm font-medium">
              Reintento automático al reconectar
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={autoRetry}
                onChange={(e) => setAutoRetry(e.target.checked)}
              />
            </label>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="max-att" className="text-sm font-medium">
                Máximo de intentos por pedido
              </Label>
              <Input
                id="max-att"
                type="number"
                inputMode="numeric"
                min={MIN_ATTEMPTS}
                max={MAX_ATTEMPTS_LIMIT}
                className="w-20"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value) || MIN_ATTEMPTS)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={retryFailed}
              disabled={!online || retryable === 0}
              variant="outline"
            >
              <RotateCw className="size-4" />
              Reintentar fallidos ({retryable})
            </Button>
            <Button size="sm" variant="outline" onClick={clearSent} disabled={counts.enviado === 0}>
              <CheckCircle2 className="size-4" />
              Quitar enviados
            </Button>
            <Button size="sm" variant="outline" onClick={exportJson}>
              <Download className="size-4" />
              Exportar JSON
            </Button>
            <Button size="sm" variant="outline" onClick={() => pickFile("merge")}>
              <Upload className="size-4" />
              Importar (agregar)
            </Button>
            <Button size="sm" variant="outline" onClick={() => pickFile("replace")}>
              <Upload className="size-4" />
              Restaurar (reemplazar)
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>

          <div className="grid gap-2">
            <Input
              placeholder="Buscar en el historial de pedidos…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <Button
                  key={f.key}
                  size="sm"
                  variant={filter === f.key ? "default" : "outline"}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                  {f.key !== "todos" ? ` (${counts[f.key as OrderStatus]})` : ` (${orders.length})`}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            {shown.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No hay pedidos con ese filtro.
              </p>
            ) : null}
            {shown.map((o: PendingOrder) => (
              <div key={o.id} className="rounded-xl border border-border bg-muted/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-card-foreground">
                      {o.serviceName}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={o.status} />
                      <Badge variant="secondary">{o.catalogName}</Badge>
                      <Badge variant="outline">{formatMXN(o.price)}</Badge>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(o.at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">{o.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Intentos: {o.attempts}/{maxAttempts}
                  {o.lastAttemptAt ? ` · Último: ${formatDate(o.lastAttemptAt)}` : ""}
                </p>
                {o.status === "fallido" && o.error ? (
                  <p className="mt-1 text-xs font-medium text-destructive">{o.error}</p>
                ) : null}
                {o.status === "fallido" && o.attempts >= maxAttempts ? (
                  <p className="mt-1 text-xs font-medium text-destructive">
                    Límite de intentos alcanzado: súbelo o envíalo manualmente.
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setDetailId(o.id)}>
                    <Info className="size-4" />
                    Ver detalle
                  </Button>
                  {o.status === "enviado" ? null : (
                    <Button
                      size="sm"
                      onClick={() => sendOne(o.id)}
                      disabled={!online || o.status === "enviando"}
                    >
                      {o.status === "fallido" ? (
                        <RotateCw className="size-4" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      {o.status === "fallido" ? "Reintentar" : "Enviar"}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => remove(o.id)}>
                    <X className="size-4" />
                    Quitar
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <ConfirmButton
              title="¿Vaciar la lista de pedidos?"
              description="Se eliminarán todos los pedidos, incluidos los que no se han enviado."
              confirmLabel="Vaciar"
              onConfirm={clear}
            >
              <Button variant="outline" size="sm">
                <Trash2 className="size-4 text-destructive" />
                Vaciar lista
              </Button>
            </ConfirmButton>
            <Button onClick={() => setOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrderDetailDialog
        order={detailOrder}
        open={!!detailOrder}
        maxAttempts={maxAttempts}
        onOpenChange={(v) => {
          if (!v) setDetailId(null);
        }}
      />
    </>
  );
}
