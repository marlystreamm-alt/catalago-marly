import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Upload,
  Download,
  MessageCircle,
  Link2,
  Pencil,
  Archive,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DEFINITIONS,
  STATUS,
  money,
  youtubeId,
  phoneNumber,
  type Module,
  type OpsRecord,
  type Payload,
} from "@/lib/workspace/model";
import {
  opsSave,
  opsArchive,
  opsGet,
  opsPortalLink,
  walletPost,
  opsImportClients,
} from "@/lib/workspace/operations.functions";
import { getSavedCode } from "@/lib/notify/client";
import { copyText } from "@/lib/browser/clipboard";
export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "No se pudo completar la operación";
export type Entry = {
  id: string;
  client_id: string;
  amount_cents: number;
  kind: string;
  note: string;
  created_at: string;
};
export function balanceFor(entries: Entry[], id: string, debt = false) {
  return entries
    .filter((e) => e.client_id === id && ["credit", "repayment"].includes(e.kind) === debt)
    .reduce((sum, e) => sum + Number(e.amount_cents) / 100, 0);
}
export function exportRows(rows: Record<string, unknown>[], name: string) {
  const columns = Object.keys(rows[0] || {});
  if (!columns.length) return toast.error("No hay datos para exportar");
  const cell = (x: unknown) =>
    '"' +
    String(x ?? "")
      .replace(/^[=+@\-]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const body =
    "\ufeff" +
    [columns, ...rows.map((r) => columns.map((k) => r[k]))]
      .map((r) => r.map(cell).join(","))
      .join("\r\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ResourcePanel({
  module,
  records,
  entries,
  reload,
  onWallet,
}: {
  module: Module;
  records: OpsRecord[];
  entries: Entry[];
  reload: () => Promise<void>;
  onWallet?: (id: string, debt?: boolean) => void;
}) {
  const def = DEFINITIONS[module];
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<OpsRecord | null>(null);
  const [opened, setOpened] = useState(false);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState(def.statuses[0]);
  const [payload, setPayload] = useState<Payload>({});
  const [busy, setBusy] = useState(false);
  const [player, setPlayer] = useState("");
  const clients = records.filter((r) => r.module === "clients");
  const names = new Map(clients.map((c) => [c.id, c.title]));
  const rows = useMemo(
    () =>
      records.filter(
        (r) =>
          r.module === module &&
          (filter === "all" || r.status === filter) &&
          `${r.title} ${Object.values(r.data).join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [records, module, query, filter],
  );
  const fresh = () => {
    setEditing(null);
    setTitle("");
    setStatus(def.statuses[0]);
    setPayload({});
    setOpened(true);
  };
  const edit = async (r: OpsRecord) => {
    setBusy(true);
    try {
      const full = await opsGet({ data: { code: getSavedCode(), id: r.id } });
      setEditing(full);
      setTitle(full.title);
      setStatus(full.status);
      setPayload(full.data);
      setOpened(true);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="seller-actions">
        <Button onClick={fresh}>
          <Plus className="size-4" />
          Agregar {def.singular}
        </Button>
        {module === "clients" ? (
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await opsImportClients({ data: { code: getSavedCode() } });
                await reload();
                toast.success(`${result.count} clientes importados del stock`);
              } catch (e) {
                toast.error(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Importar clientes de mis entregas
          </Button>
        ) : null}
        <Button
          variant="outline"
          onClick={() =>
            exportRows(
              rows.map((r) => ({
                Nombre: r.title,
                Estado: STATUS[r.status] || r.status,
                Cliente: names.get(r.data.clientId) || "",
                Actualizado: r.updatedAt,
              })),
              module,
            )
          }
        >
          <Download className="size-4" />
          Exportar
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => void reload()}
          aria-label="Actualizar registros"
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>
      <div className="seller-search">
        <Search className="size-4" />
        <Input
          aria-label={`Buscar ${def.title}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, plataforma o cliente…"
        />
      </div>
      <div className="seller-tabs">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
          Todos ({records.filter((r) => r.module === module).length})
        </button>
        {def.statuses.map((s) => (
          <button key={s} className={filter === s ? "active" : ""} onClick={() => setFilter(s)}>
            {STATUS[s]}
          </button>
        ))}
      </div>
      {!rows.length ? (
        <EmptyState
          icon={def.icon}
          title={query ? "Sin resultados" : `Sin ${def.title.toLowerCase()} todavía`}
          description="Usa el botón de arriba para agregar tu primer registro."
        />
      ) : (
        <div className="seller-record-grid">
          {rows.map((r) => (
            <article className="seller-card" key={r.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="seller-caption">{names.get(r.data.clientId) || def.singular}</p>
                  <h3 className="font-bold break-words">{r.title}</h3>
                </div>
                <span className={`seller-badge status-${r.status}`}>
                  {STATUS[r.status] || r.status}
                </span>
              </div>
              {module === "clients" ? (
                <div className="my-3 grid grid-cols-2 gap-2">
                  <div className="seller-mini-stat">
                    <small>Saldo</small>
                    <b>{money(balanceFor(entries, r.id))}</b>
                  </div>
                  <div className="seller-mini-stat">
                    <small>Crédito pendiente</small>
                    <b>{money(balanceFor(entries, r.id, true))}</b>
                  </div>
                </div>
              ) : null}
              {def.fields
                .filter((f) => r.data[f.key] && f.key !== "clientId")
                .slice(0, 5)
                .map((f) => (
                  <div className="mt-2" key={f.key}>
                    <small className="text-muted-foreground">{f.label}</small>
                    <p className="whitespace-pre-wrap break-words text-sm">{r.data[f.key]}</p>
                  </div>
                ))}
              {module === "referrals" ? (
                <p className="my-2 text-sm">
                  {
                    clients.filter(
                      (c) => c.data.referrer?.toLowerCase() === r.data.code?.toLowerCase(),
                    ).length
                  }{" "}
                  clientes registrados con este código
                </p>
              ) : null}
              {r.data.filename ? <p className="my-2 text-sm">📎 {r.data.filename}</p> : null}
              <div className="seller-actions mt-4">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void edit(r)}>
                  <Pencil className="size-3.5" />
                  Editar
                </Button>
                {r.data.whatsapp ? (
                  <Button size="sm" variant="outline" asChild>
                    <a
                      href={`https://wa.me/${phoneNumber(r.data.whatsapp)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="size-3.5" />
                      WhatsApp
                    </a>
                  </Button>
                ) : null}
                {module === "clients" ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => onWallet?.(r.id)}>
                      Saldo / crédito
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || r.status !== "active"}
                      onClick={async () => {
                        if (
                          !confirm(
                            "¿Generar un enlace privado de atención para este cliente? Si tenía uno, dejará de funcionar.",
                          )
                        )
                          return;
                        setBusy(true);
                        try {
                          const result = await opsPortalLink({
                            data: { code: getSavedCode(), id: r.id },
                          });
                          await copyText(
                            `${location.origin}/cliente/${result.id}?t=${encodeURIComponent(result.token)}`,
                          );
                          toast.success(
                            "Enlace privado copiado. Compártelo únicamente con este cliente.",
                          );
                          await reload();
                        } catch (e) {
                          toast.error(errorText(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Link2 className="size-3.5" />
                      Enlace del cliente
                    </Button>
                  </>
                ) : null}
                {module === "songs" ? (
                  <Button size="sm" onClick={() => setPlayer(youtubeId(r.data.url))}>
                    ▶ Reproducir
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      !confirm(
                        `¿Retirar «${r.title}» del panel? Su historial de saldo se conserva.`,
                      )
                    )
                      return;
                    setBusy(true);
                    try {
                      await opsArchive({
                        data: { code: getSavedCode(), id: r.id, version: r.version },
                      });
                      await reload();
                      toast.success("Registro retirado");
                    } catch (e) {
                      toast.error(errorText(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Archive className="size-3.5" />
                  Retirar
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <Dialog
        open={opened}
        onOpenChange={(v) => {
          if (!busy) setOpened(v);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar" : "Agregar"} {def.singular}
            </DialogTitle>
            <DialogDescription>Se guarda en tu base de datos.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await opsSave({
                  data: {
                    code: getSavedCode(),
                    ...(editing ? { id: editing.id, version: editing.version } : {}),
                    module,
                    title,
                    status,
                    payload,
                  },
                });
                setOpened(false);
                await reload();
                toast.success("Registro guardado");
              } catch (e) {
                toast.error(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="seller-field">
              <span>Nombre / título *</span>
              <Input
                value={title}
                maxLength={160}
                required
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            {def.fields.map((f) => (
              <label className="seller-field" key={f.key}>
                <span>
                  {f.label}
                  {f.required ? " *" : ""}
                </span>
                {f.type === "textarea" ? (
                  <Textarea
                    value={payload[f.key] || ""}
                    maxLength={10000}
                    required={f.required}
                    onChange={(e) => setPayload((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                ) : f.type === "client" || f.type === "select" ? (
                  <select
                    value={payload[f.key] || ""}
                    required={f.required}
                    onChange={(e) => setPayload((p) => ({ ...p, [f.key]: e.target.value }))}
                  >
                    <option value="">Seleccionar</option>
                    {f.type === "client"
                      ? clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))
                      : f.options?.map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <Input
                    type={f.type || "text"}
                    min={f.type === "number" ? 0 : undefined}
                    step={f.type === "number" ? "0.01" : undefined}
                    maxLength={1000}
                    value={
                      f.type === "datetime-local"
                        ? localDateInput(payload[f.key] || "")
                        : payload[f.key] || ""
                    }
                    required={f.required}
                    onChange={(e) =>
                      setPayload((p) => ({
                        ...p,
                        [f.key]:
                          f.type === "datetime-local" && e.target.value
                            ? new Date(e.target.value).toISOString()
                            : e.target.value,
                      }))
                    }
                  />
                )}
              </label>
            ))}
            <label className="seller-field">
              <span>Estado</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {def.statuses.map((s) => (
                  <option value={s} key={s}>
                    {STATUS[s]}
                  </option>
                ))}
              </select>
            </label>
            {["documents", "reports"].includes(module) ? (
              <div className="space-y-2">
                <Label>Adjunto privado · PDF o imagen, hasta 3 MB</Label>
                <Input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={async (e) => {
                    const file = e.currentTarget.files?.[0];
                    e.currentTarget.value = "";
                    if (!file) return;
                    if (file.size > 3_000_000) return toast.error("Máximo 3 MB");
                    try {
                      const value = await new Promise<string>((resolve, reject) => {
                        const fr = new FileReader();
                        fr.onload = () => resolve(String(fr.result));
                        fr.onerror = reject;
                        fr.readAsDataURL(file);
                      });
                      setPayload((p) => ({
                        ...p,
                        attachment: value,
                        filename: file.name,
                        filetype: file.type,
                      }));
                    } catch {
                      toast.error("No se pudo leer el archivo");
                    }
                  }}
                />
                {payload.attachment ? (
                  <div className="flex gap-2">
                    <Button type="button" asChild variant="outline">
                      <a href={payload.attachment} download={payload.filename || "documento"}>
                        <Download className="size-4" />
                        {payload.filename}
                      </a>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setPayload((p) => ({ ...p, attachment: "", filename: "", filetype: "" }))
                      }
                    >
                      Quitar
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
            <Button type="submit" disabled={busy}>
              {busy ? "Guardando…" : "Guardar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(player)}
        onOpenChange={(v) => {
          if (!v) setPlayer("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tu música</DialogTitle>
            <DialogDescription>Reproducción de YouTube</DialogDescription>
          </DialogHeader>
          {player ? (
            <iframe
              title="Reproductor de música"
              src={`https://www.youtube-nocookie.com/embed/${player}`}
              className="aspect-video w-full rounded-xl"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="seller-empty">
      <span aria-hidden="true">{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function WalletPanel({
  records,
  entries,
  reload,
  initialClient = "",
  debt = false,
}: {
  records: OpsRecord[];
  entries: Entry[];
  reload: () => Promise<void>;
  initialClient?: string;
  debt?: boolean;
}) {
  const clients = records.filter((r) => r.module === "clients" && r.status === "active");
  const [clientId, setClient] = useState(initialClient);
  const [kind, setKind] = useState(debt ? "credit" : "recharge");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(crypto.randomUUID());
  const filtered = entries.filter(
    (e) =>
      (!clientId || e.client_id === clientId) && ["credit", "repayment"].includes(e.kind) === debt,
  );
  const names = new Map(clients.map((c) => [c.id, c.title]));
  return (
    <div className="space-y-4">
      <div className="seller-grid">
        <article className="seller-card">
          <p className="seller-caption">
            {debt ? "Crédito pendiente registrado" : "Saldo de clientes registrado"}
          </p>
          <strong className="text-3xl">
            {money(
              entries
                .filter((e) => ["credit", "repayment"].includes(e.kind) === debt)
                .reduce((sum, e) => sum + Number(e.amount_cents) / 100, 0),
            )}
          </strong>
          <p className="text-xs text-muted-foreground mt-2">
            Control interno en MXN. Cada movimiento queda en el historial.
          </p>
        </article>
        <article className="seller-card">
          <p className="seller-caption">{debt ? "Clientes con deuda" : "Clientes con saldo"}</p>
          <strong className="text-3xl">
            {clients.filter((c) => balanceFor(entries, c.id, debt) > 0).length}
          </strong>
        </article>
      </div>
      <form
        className="seller-card space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!confirm(`¿Registrar ${money(Number(amount))} para ${names.get(clientId)}?`)) return;
          setBusy(true);
          try {
            await walletPost({
              data: {
                code: getSavedCode(),
                clientId,
                kind: kind as "credit" | "repayment" | "recharge" | "withdrawal",
                amount: Number(amount),
                note,
                requestId: request.current,
              },
            });
            request.current = crypto.randomUUID();
            setAmount("");
            setNote("");
            await reload();
            toast.success("Movimiento registrado");
          } catch (e) {
            toast.error(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3 className="font-bold">
          {debt ? "Otorgar crédito o registrar abono" : "Registrar recarga o retiro"}
        </h3>
        <div className="seller-form-grid">
          <label className="seller-field">
            <span>Cliente</span>
            <select
              value={clientId}
              required
              onChange={(e) => {
                setClient(e.target.value);
                request.current = crypto.randomUUID();
              }}
            >
              <option value="">Seleccionar cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="seller-field">
            <span>Movimiento</span>
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                request.current = crypto.randomUUID();
              }}
            >
              {(debt
                ? [
                    ["credit", "Crédito otorgado"],
                    ["repayment", "Abono a la deuda"],
                  ]
                : [
                    ["recharge", "Recarga confirmada"],
                    ["withdrawal", "Retiro / ajuste"],
                  ]
              ).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="seller-field">
            <span>Importe MXN</span>
            <Input
              type="number"
              required
              min="0.01"
              max="1000000"
              step="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                request.current = crypto.randomUUID();
              }}
            />
          </label>
          <label className="seller-field">
            <span>Referencia / motivo</span>
            <Input
              required
              maxLength={500}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                request.current = crypto.randomUUID();
              }}
            />
          </label>
        </div>
        <Button disabled={busy || !clients.length}>
          {busy ? "Registrando…" : "Confirmar movimiento"}
        </Button>
        <p className="text-xs text-muted-foreground">
          {debt
            ? "Los abonos reducen la deuda; no aumentan el saldo disponible."
            : "Confirma el pago recibido antes de acreditarlo. La lectura automática del banco requiere un proveedor de pagos conectado."}
        </p>
      </form>
      <section className="seller-card">
        <div className="flex flex-wrap justify-between gap-2">
          <h3 className="font-bold">Historial de movimientos</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportRows(
                filtered.map((e) => ({
                  Fecha: e.created_at,
                  Cliente: names.get(e.client_id) || e.client_id,
                  Importe: Number(e.amount_cents) / 100,
                  Movimiento: e.kind,
                  Referencia: e.note,
                })),
                debt ? "creditos" : "recargas",
              )
            }
          >
            Exportar CSV
          </Button>
        </div>
        {filtered.length ? (
          <div className="seller-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Importe</th>
                  <th>Referencia</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td>{names.get(e.client_id) || "Cliente retirado"}</td>
                    <td>{money(Number(e.amount_cents) / 100)}</td>
                    <td>{e.note}</td>
                    <td>{new Date(e.created_at).toLocaleString("es-MX")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Todavía no hay movimientos registrados.
          </p>
        )}
      </section>
    </div>
  );
}

function localDateInput(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
