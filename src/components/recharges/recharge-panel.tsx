import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { getSavedCode } from "@/lib/notify/client";
import { money, type OpsRecord } from "@/lib/workspace/model";
import type { RechargeSettings } from "@/lib/recharges/settings";
import {
  rechargeAdminLoad,
  rechargeSave,
  rechargeTestConnection,
  rechargeScan,
  rechargeParseTest,
  rechargeRetry,
} from "@/lib/recharges/recharges.functions";
const blank: RechargeSettings = {
  enabled: false,
  email: "",
  senders: [],
  bank: "",
  holder: "",
  account: "",
  note: "",
  minimum: 10,
  maximum: 5000,
  minutes: 60,
  openLimit: 2,
  dailyLimit: 0,
  uniqueCents: false,
  bonusPercent: 0,
};
const message = (e: unknown) =>
  e instanceof Error ? e.message : "No se pudo completar la operación";
export function RechargePanel({
  records,
  onChanged,
}: {
  records: OpsRecord[];
  onChanged: () => Promise<void>;
}) {
  const [data, setData] = useState<Awaited<ReturnType<typeof rechargeAdminLoad>> | null>(null);
  const [draft, setDraft] = useState<RechargeSettings>(blank);
  const [password, setPassword] = useState("");
  const [senders, setSenders] = useState("");
  const [tab, setTab] = useState("requests");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [sample, setSample] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof rechargeParseTest>> | null>(null);
  const load = useCallback(async () => {
    setError("");
    try {
      const d = await rechargeAdminLoad({ data: { code: getSavedCode() } });
      setData(d);
      setDraft(d.settings || blank);
      setSenders(d.settings?.senders.join(", ") || "");
      setPassword("");
    } catch (e) {
      setError(message(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const changed =
    JSON.stringify(draft) !== JSON.stringify(data?.settings || blank) ||
    Boolean(password) ||
    senders !== (data?.settings?.senders.join(", ") || "");
  const names = new Map(records.filter((r) => r.module === "clients").map((r) => [r.id, r.title]));
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="seller-card space-y-2">
        <h2 className="font-bold">Recargas automáticas por Gmail</h2>
        <p className="text-sm text-muted-foreground">
          Banco y cuenta configurables. Cada cliente genera una referencia desde su enlace privado
          de atención.
        </p>
        <p className="text-sm font-semibold">
          {data?.settings?.enabled
            ? data.lastCheck && !data.lastError
              ? "🟢 Lector activo"
              : "🟠 Activadas · esperando revisión"
            : "⚪ Recargas automáticas apagadas"}
        </p>
        {data?.lastCheck ? (
          <p className="text-xs text-muted-foreground">
            Última revisión: {new Date(data.lastCheck).toLocaleString("es-MX")}
          </p>
        ) : null}
        {data?.lastError ? (
          <p role="alert" className="text-sm text-destructive">
            {data.lastError}
          </p>
        ) : null}
        <Button
          variant="outline"
          disabled={busy || !data?.settings?.enabled || changed}
          onClick={() =>
            void run(async () => {
              const r = await rechargeScan({ data: { code: getSavedCode() } });
              toast.success(
                "processed" in r ? `${r.processed} avisos procesados` : "Revisión solicitada",
              );
              await onChanged();
            })
          }
        >
          Revisar correo ahora
        </Button>
      </div>
      <div className="seller-tabs">
        {[
          ["requests", "Recargas"],
          ["events", "Avisos leídos"],
          ["settings", "Ajustes"],
        ].map(([v, l]) => (
          <button
            key={v}
            className={tab === v ? "active" : ""}
            onClick={() => {
              setTab(v);
              setFilter("all");
            }}
          >
            {l}
          </button>
        ))}
      </div>
      {error ? (
        <div role="alert" className="seller-error">
          <p>{error}</p>
          <Button onClick={() => void load()}>Reintentar</Button>
        </div>
      ) : null}
      {tab === "settings" ? (
        <>
          <form
            className="seller-card space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await rechargeSave({
                  data: {
                    code: getSavedCode(),
                    version: data?.version || 0,
                    settings: {
                      ...draft,
                      senders: senders
                        .split(",")
                        .map((s) => s.trim().toLowerCase())
                        .filter(Boolean),
                    },
                    password,
                  },
                });
                toast.success("Configuración guardada");
              });
            }}
          >
            <h3 className="font-bold">Cómo te pagan</h3>
            <label className="flex justify-between gap-3 text-sm">
              <span>Activar recargas automáticas</span>
              <Switch
                checked={draft.enabled}
                disabled={!data?.tested && !draft.enabled}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, enabled: v }))}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Guarda primero con las recargas apagadas, prueba Gmail y después activa. Cambiar
              correo, cuenta o remitentes cancela las referencias pendientes.
            </p>
            <div className="seller-form-grid">
              {(
                [
                  ["bank", "Banco donde recibes"],
                  ["holder", "Titular de la cuenta"],
                  ["account", "Cuenta o CLABE receptora"],
                ] as const
              ).map(([key, label]) => (
                <label className="seller-field" key={key}>
                  <span>{label}</span>
                  <Input
                    required
                    maxLength={key === "account" ? 18 : 150}
                    value={draft[key]}
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <label className="seller-field">
              <span>Nota para tus clientes</span>
              <Textarea
                value={draft.note}
                maxLength={1000}
                onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              />
            </label>
            <h3 className="font-bold">Límites</h3>
            <div className="seller-form-grid">
              {(
                [
                  ["minimum", "Mínimo MXN", 1, 100000],
                  ["maximum", "Máximo MXN", 1, 1000000],
                  ["minutes", "Vigencia de la referencia (minutos)", 5, 1440],
                  ["openLimit", "Referencias abiertas por cliente", 1, 5],
                  ["dailyLimit", "Máximo diario por cliente (0 = sin límite)", 0, 100],
                  ["bonusPercent", "Saldo de regalo (%)", 0, 100],
                ] as const
              ).map(([key, label, min, max]) => (
                <label className="seller-field" key={key}>
                  <span>{label}</span>
                  <Input
                    type="number"
                    min={min}
                    max={max}
                    step="1"
                    required
                    value={draft[key]}
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
                  />
                </label>
              ))}
            </div>
            <label className="flex justify-between gap-3 text-sm">
              <span>Centavos únicos para identificar pagos sin referencia</span>
              <Switch
                checked={draft.uniqueCents}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, uniqueCents: v }))}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Si los activas, el cliente deberá transferir el importe exacto con centavos. Si el
              aviso trae una referencia válida, se comprueban referencia e importe juntos.
            </p>
            <h3 className="font-bold">Correo que recibe los avisos</h3>
            <p className="text-xs text-muted-foreground">
              Usa un correo dedicado a los avisos de esta cuenta receptora. Se lee Gmail sin enviar
              ni borrar correos. La contraseña se guarda cifrada y no vuelve a mostrarse.
            </p>
            <label className="seller-field">
              <span>Correo de Gmail</span>
              <Input
                required
                type="email"
                autoComplete="off"
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              />
            </label>
            <label className="seller-field">
              <span>Contraseña de aplicación</span>
              <Input
                type="password"
                autoComplete="new-password"
                value={password}
                placeholder={
                  data?.hasPassword
                    ? "Guardada · deja vacío para conservarla"
                    : "Contraseña de aplicación de Google"
                }
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="seller-field">
              <span>Remitentes permitidos · correos completos separados por coma</span>
              <Input
                required
                value={senders}
                onChange={(e) => setSenders(e.target.value)}
                placeholder="avisos@tu-banco.com"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Los abonos exigen autenticación del remitente en Gmail, aviso de dinero recibido,
              clave de rastreo y coincidencia de importe y referencia o centavos únicos.
            </p>
            <div className="seller-actions">
              <Button disabled={busy} type="submit">
                {busy ? "Procesando…" : "Guardar ajustes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || changed || !data?.hasPassword}
                onClick={() =>
                  void run(async () => {
                    await rechargeTestConnection({ data: { code: getSavedCode() } });
                    toast.success("Gmail conectado. Ya puedes activar y guardar las recargas.");
                  })
                }
              >
                Probar conexión
              </Button>
              {data?.tested ? <span className="text-xs text-primary">Conexión probada</span> : null}
            </div>
          </form>
          <section className="seller-card space-y-3">
            <h3 className="font-bold">Probar el lector con un aviso real</h3>
            <p className="text-xs text-muted-foreground">
              Pega el texto del aviso. Esta prueba solo extrae datos; no acredita dinero ni verifica
              la autenticidad del correo pegado.
            </p>
            <Textarea
              value={sample}
              maxLength={30000}
              rows={6}
              onChange={(e) => setSample(e.target.value)}
            />
            <Button
              disabled={busy || !sample.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  setResult(
                    await rechargeParseTest({ data: { code: getSavedCode(), text: sample } }),
                  );
                } catch (e) {
                  toast.error(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Leer aviso
            </Button>
            {result ? (
              <dl className="rounded-xl bg-muted/40 p-3 text-sm space-y-1">
                <div>Transferencia recibida: {result.incoming ? "Sí" : "No identificada"}</div>
                <div>
                  Importe:{" "}
                  {result.amountCents ? money(result.amountCents / 100) : "No encontrado o ambiguo"}
                </div>
                <div>Referencia: {result.reference || "No encontrada"}</div>
                <div>Clave de rastreo: {result.tracking || "No encontrada"}</div>
              </dl>
            ) : null}
          </section>
        </>
      ) : (
        <>
          <div className="seller-actions">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar referencia o cliente"
              aria-label="Buscar recargas"
            />
            <Button disabled={busy || changed} variant="outline" onClick={() => void load()}>
              Actualizar
            </Button>
          </div>
          <div className="seller-tabs">
            {[
              "all",
              ...(tab === "requests"
                ? ["pending", "credited", "expired", "cancelled"]
                : ["review", "credited", "ignored", "duplicate"]),
            ].map((v) => (
              <button key={v} className={filter === v ? "active" : ""} onClick={() => setFilter(v)}>
                {labels[v] || v}
              </button>
            ))}
          </div>
          <div className="seller-record-grid">
            {tab === "requests"
              ? data?.requests
                  .filter(
                    (r) =>
                      (filter === "all" || r.status === filter) &&
                      `${r.reference} ${names.get(r.client_id) || ""}`
                        .toLowerCase()
                        .includes(q.toLowerCase()),
                  )
                  .map((r) => (
                    <article className="seller-card" key={r.id}>
                      <div className="flex justify-between gap-2">
                        <h3 className="font-bold">{money(Number(r.payable_cents) / 100)}</h3>
                        <span className="seller-badge">{labels[r.status]}</span>
                      </div>
                      <p className="text-sm mt-2">
                        {names.get(r.client_id) || "Cliente"} · referencia <b>{r.reference}</b>
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Vence: {new Date(r.expires_at).toLocaleString("es-MX")}
                      </p>
                    </article>
                  ))
              : data?.events
                  .filter(
                    (e) =>
                      (filter === "all" || e.status === filter) &&
                      `${e.reference || ""}`.includes(q),
                  )
                  .map((e) => (
                    <article className="seller-card" key={e.id}>
                      <div className="flex justify-between gap-2">
                        <h3 className="font-bold">
                          {e.amount_cents
                            ? money(Number(e.amount_cents) / 100)
                            : "Importe no identificado"}
                        </h3>
                        <span className="seller-badge">{labels[e.status]}</span>
                      </div>
                      <p className="mt-2 text-sm">Referencia: {e.reference || "No encontrada"}</p>
                      <p className="text-xs text-muted-foreground mt-2">{e.reason}</p>
                      <p className="text-xs mt-2">
                        {new Date(e.received_at).toLocaleString("es-MX")} ·{" "}
                        {e.verified ? "Correo autenticado" : "Sin validar"}
                      </p>
                      {e.status === "review" && e.verified ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              const r = await rechargeRetry({
                                data: { code: getSavedCode(), eventId: e.id },
                              });
                              toast.info(
                                r.status === "credited"
                                  ? "Abono confirmado"
                                  : "El aviso sigue sin coincidencia válida",
                              );
                              await onChanged();
                            })
                          }
                        >
                          Revisar coincidencia otra vez
                        </Button>
                      ) : null}
                    </article>
                  ))}
          </div>
          {data && (tab === "requests" ? data.requests : data.events).length === 0 ? (
            <p className="seller-card text-sm text-muted-foreground">
              Todavía no hay registros en este apartado.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
const labels: Record<string, string> = {
  all: "Todas",
  pending: "Esperando pago",
  credited: "Acreditada",
  expired: "Vencida",
  cancelled: "Cancelada",
  review: "En revisión",
  ignored: "Ignorado",
  duplicate: "Duplicado",
};
