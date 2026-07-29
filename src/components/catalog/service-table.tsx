import { useEffect, useState } from "react";
import { Check, Download, MessageCircle, Star, Undo2, Upload, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCatalogStore } from "@/lib/catalog/store";
import { buildWhatsappLink, formatMXN } from "@/lib/catalog/whatsapp";
import type { Service } from "@/lib/catalog/types";

type PriceUndo = { services: { id: string; price: number; name: string }[]; label: string };

/** Pila de deshacer de precios, viva durante la sesión (sobrevive a remontajes). */
const undoStack: PriceUndo[] = [];

type BulkMode = "porcentaje" | "monto" | "fijo";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Tabla compacta plataforma/precio; el administrador edita el precio en línea. */
export function ServiceTable({
  services,
  selectedIds = [],
  onToggleSelect,
}: {
  services: Service[];
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
}) {
  const { catalog, isAdmin, saveService, toggleFavorite, exportBackup, importBackup } =
    useCatalogStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [confirmOne, setConfirmOne] = useState<{ service: Service; price: number } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<BulkMode>("porcentaje");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [undoCount, setUndoCount] = useState(undoStack.length);

  useEffect(() => {
    if (!isAdmin) setEditingId(null);
  }, [isAdmin]);

  const targets = selectedIds.length
    ? services.filter((s) => selectedIds.includes(s.id))
    : services;

  const startEdit = (s: Service) => {
    setEditingId(s.id);
    setDraft(String(s.price));
    setError("");
  };

  const cancel = () => {
    setEditingId(null);
    setError("");
  };

  const requestCommit = (s: Service) => {
    const raw = draft.trim().replace(/\s|\$|,/g, "");
    const price = Number(raw);
    if (!raw) {
      setError("Escribe un precio");
      return;
    }
    if (!Number.isFinite(price)) {
      setError("El precio debe ser un número");
      return;
    }
    if (price < 0) {
      setError("El precio no puede ser negativo");
      return;
    }
    if (price > 1_000_000) {
      setError("El precio es demasiado alto");
      return;
    }
    if (round2(price) === s.price) {
      cancel();
      return;
    }
    setConfirmOne({ service: s, price: round2(price) });
  };

  const applyOne = () => {
    if (!confirmOne) return;
    const { service, price } = confirmOne;
    undoStack.push({
      services: [{ id: service.id, price: service.price, name: service.name }],
      label: `${service.name}: ${formatMXN(service.price)}`,
    });
    setUndoCount(undoStack.length);
    saveService({ ...service, price });
    toast.success(`Precio actualizado: ${service.name}`);
    setConfirmOne(null);
    cancel();
  };

  const bulkPreview = (s: Service) => {
    const value = Number(bulkValue.trim().replace(/\s|\$|,/g, ""));
    if (!Number.isFinite(value)) return s.price;
    if (bulkMode === "porcentaje") return round2(s.price * (1 + value / 100));
    if (bulkMode === "monto") return round2(s.price + value);
    return round2(value);
  };

  const validateBulk = () => {
    const raw = bulkValue.trim().replace(/\s|\$|,/g, "");
    if (!raw) return "Escribe un valor";
    const value = Number(raw);
    if (!Number.isFinite(value)) return "El valor debe ser un número";
    if (bulkMode === "fijo" && value < 0) return "El precio no puede ser negativo";
    if (bulkMode === "fijo" && value > 1_000_000) return "El precio es demasiado alto";
    if (!targets.length) return "No hay servicios seleccionados";
    if (targets.some((s) => bulkPreview(s) < 0))
      return "El resultado sería negativo en algún servicio";
    return "";
  };

  const applyBulk = () => {
    const msg = validateBulk();
    if (msg) {
      setBulkError(msg);
      return;
    }
    const changed = targets.filter((s) => bulkPreview(s) !== s.price);
    if (!changed.length) {
      setBulkError("Ningún precio cambiaría con ese valor");
      return;
    }
    undoStack.push({
      services: changed.map((s) => ({ id: s.id, price: s.price, name: s.name })),
      label: `${changed.length} precios`,
    });
    setUndoCount(undoStack.length);
    changed.forEach((s) => saveService({ ...s, price: bulkPreview(s) }));
    toast.success(`Precios actualizados: ${changed.length} servicio(s)`);
    setBulkOpen(false);
    setBulkValue("");
    setBulkError("");
  };

  const undo = () => {
    const last = undoStack.pop();
    setUndoCount(undoStack.length);
    if (!last) return;
    let restored = 0;
    last.services.forEach((prev) => {
      const current = catalog.services.find((s) => s.id === prev.id);
      if (!current) return;
      restored += 1;
      saveService({ ...current, price: prev.price });
    });
    toast.success(`Se revirtió el cambio de ${last.label} (${restored} servicio(s))`);
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      importBackup(text);
    } catch {
      toast.error("No se pudo leer el archivo de respaldo");
    }
  };

  if (!services.length) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card/70 p-8 text-center text-sm text-muted-foreground">
        No hay servicios que coincidan con tu búsqueda.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {isAdmin ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/80 p-2">
          <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
            <Wand2 className="size-4" />
            Precios en lote ({targets.length})
          </Button>
          <Button size="sm" variant="outline" disabled={undoCount === 0} onClick={undo}>
            <Undo2 className="size-4" />
            Deshacer precio
          </Button>
          <Button size="sm" variant="outline" onClick={exportBackup}>
            <Download className="size-4" />
            Exportar respaldo
          </Button>
          <Button size="sm" variant="outline" asChild>
            <label className="cursor-pointer">
              <Upload className="size-4" />
              Importar respaldo
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(e) => {
                  void onImportFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
          <span className="text-xs text-muted-foreground">
            {selectedIds.length
              ? `Aplica a ${selectedIds.length} seleccionados`
              : "Aplica a los servicios visibles"}
          </span>
        </div>
      ) : null}

      <div className="card-soft overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <caption className="sr-only">Plataformas y precios de {catalog.name}</caption>
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              {onToggleSelect ? <th className="w-8 p-2" aria-label="Seleccionar" /> : null}
              <th className="p-2 font-semibold">Plataforma</th>
              <th className="p-2 text-right font-semibold">Precio</th>
              <th className="w-20 p-2 text-right font-semibold">Pedir</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => {
              const editing = editingId === s.id;
              return (
                <tr key={s.id} className="border-b border-border align-middle last:border-0">
                  {onToggleSelect ? (
                    <td className="p-2">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={selectedIds.includes(s.id)}
                        aria-label={`Seleccionar ${s.name}`}
                        onChange={() => onToggleSelect(s.id)}
                      />
                    </td>
                  ) : null}
                  <td className="p-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={s.favorite ? "Quitar de favoritos" : "Marcar como favorito"}
                        onClick={() => toggleFavorite(s.id)}
                      >
                        <Star
                          className={`size-4 ${s.favorite ? "fill-primary text-primary" : "text-muted-foreground"}`}
                        />
                      </button>
                      <span className="font-medium text-card-foreground">{s.name}</span>
                      {!s.active ? <span className="text-xs text-destructive">(oculto)</span> : null}
                    </div>
                  </td>
                  <td className="p-2 text-right">
                    {editing ? (
                      <div className="flex items-center justify-end gap-1">
                        <div className="grid gap-0.5">
                          <Input
                            autoFocus
                            value={draft}
                            inputMode="decimal"
                            aria-label={`Precio de ${s.name}`}
                            aria-invalid={!!error}
                            className={`h-8 w-24 text-right ${error ? "border-destructive" : ""}`}
                            onChange={(e) => {
                              setDraft(e.target.value);
                              setError("");
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") requestCommit(s);
                              if (e.key === "Escape") cancel();
                            }}
                          />
                          {error ? (
                            <span className="text-[11px] text-destructive">{error}</span>
                          ) : null}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Guardar precio"
                          onClick={() => requestCommit(s)}
                        >
                          <Check className="size-4 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label="Cancelar" onClick={cancel}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    ) : isAdmin ? (
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        aria-label={`Editar precio de ${s.name}`}
                        className="rounded-lg px-2 py-1 font-bold text-primary underline decoration-dotted underline-offset-4 hover:bg-muted"
                      >
                        {formatMXN(s.price)}
                      </button>
                    ) : (
                      <span className="font-bold text-primary">{formatMXN(s.price)}</span>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    <Button asChild size="icon" variant="ghost">
                      <a
                        href={buildWhatsappLink(s, catalog)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Pedir ${s.name} por WhatsApp`}
                      >
                        <MessageCircle className="size-4 text-primary" />
                      </a>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!confirmOne} onOpenChange={(o) => !o && setConfirmOne(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar nuevo precio</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmOne
                ? `${confirmOne.service.name}: ${formatMXN(confirmOne.service.price)} → ${formatMXN(confirmOne.price)}`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={applyOne}>Guardar precio</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Actualizar precios en lote</AlertDialogTitle>
            <AlertDialogDescription>
              Se aplicará a {targets.length} servicio(s){" "}
              {selectedIds.length ? "seleccionados" : "visibles"} de {catalog.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="bulk-mode">Tipo de cambio</Label>
              <Select value={bulkMode} onValueChange={(v) => setBulkMode(v as BulkMode)}>
                <SelectTrigger id="bulk-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="porcentaje">Incremento por porcentaje (%)</SelectItem>
                  <SelectItem value="monto">Incremento por monto (MXN)</SelectItem>
                  <SelectItem value="fijo">Precio fijo (MXN)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bulk-value">
                {bulkMode === "porcentaje"
                  ? "Porcentaje (usa negativo para descuento)"
                  : bulkMode === "monto"
                    ? "Monto a sumar (negativo para restar)"
                    : "Precio fijo"}
              </Label>
              <Input
                id="bulk-value"
                inputMode="decimal"
                value={bulkValue}
                aria-invalid={!!bulkError}
                className={bulkError ? "border-destructive" : ""}
                onChange={(e) => {
                  setBulkValue(e.target.value);
                  setBulkError("");
                }}
              />
              {bulkError ? <span className="text-xs text-destructive">{bulkError}</span> : null}
            </div>
            {targets[0] && bulkValue.trim() && !bulkError ? (
              <p className="text-xs text-muted-foreground">
                Ejemplo: {targets[0].name} {formatMXN(targets[0].price)} →{" "}
                {formatMXN(bulkPreview(targets[0]))}
              </p>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                applyBulk();
              }}
            >
              Aplicar a {targets.length}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
