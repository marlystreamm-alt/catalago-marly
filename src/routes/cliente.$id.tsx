import { CustomerRecharge } from "@/components/recharges/customer-recharge";
import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { portalLoad, portalSubmit, portalDocument } from "@/lib/workspace/operations.functions";
import { money, STATUS, phoneNumber } from "@/lib/workspace/model";
import { copyText } from "@/lib/browser/clipboard";
export const Route = createFileRoute("/cliente/$id")({
  validateSearch: zodValidator(z.object({ t: fallback(z.string(), "").default("") })),
  head: () => ({
    meta: [
      { title: "Mi atención · MA²" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: CustomerPortal,
});
type View = Awaited<ReturnType<typeof portalLoad>>;
function CustomerPortal() {
  const { id } = Route.useParams();
  const { t: token } = Route.useSearch();
  const [data, setData] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [module, setModule] = useState<"reports" | "questions" | "requests">("questions");
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setData(await portalLoad({ data: { id, token } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir tu atención");
      setData(null);
    } finally {
      setBusy(false);
    }
  }, [id, token]);
  useEffect(() => {
    void load();
  }, [load]);
  const config = data?.records.find((r) => r.module === "config");
  const whatsapp = phoneNumber(config?.data.whatsapp || "528443852364");
  return (
    <main className="customer-app min-h-screen bg-gradient-to-br from-cyan-50 to-purple-50 px-4 py-7 text-slate-900">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="seller-card">
          <p className="seller-caption">MI TIENDA MA²</p>
          <h1 className="text-2xl font-bold">
            {data ? `Hola, ${data.name}` : "Tu atención privada"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Consulta tus mensajes, documentos, códigos y saldo registrado.
          </p>
        </header>
        {error ? (
          <div className="seller-error" role="alert">
            <p>{error}</p>
            <Button disabled={busy} onClick={() => void load()}>
              Reintentar
            </Button>
          </div>
        ) : null}
        {busy && !data ? <p role="status">Cargando tu información…</p> : null}
        {data ? (
          <>
            <div className="seller-metrics grid-cols-2">
              <article className="seller-metric aqua">
                <span>Saldo registrado</span>
                <strong>{money(data.balance)}</strong>
              </article>
              <article className="seller-metric">
                <span>Crédito pendiente</span>
                <strong>{money(data.debt)}</strong>
              </article>
            </div>
            <CustomerRecharge id={id} token={token} onBalanceChange={load} />
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
                  Soporte por WhatsApp
                </a>
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => void load()}>
                Actualizar
              </Button>
            </div>
            {config?.data.message ? (
              <p className="seller-card whitespace-pre-wrap">{config.data.message}</p>
            ) : null}
            {data.records
              .filter((r) => r.module === "notices")
              .map((r) => (
                <article key={r.id} className="seller-card border-cyan-200">
                  <h2 className="font-bold">📢 {r.title}</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{r.data.message}</p>
                </article>
              ))}
            <section className="seller-card space-y-3">
              <h2 className="font-bold">¿En qué podemos ayudarte?</h2>
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    await portalSubmit({ data: { id, token, module, title, message, platform } });
                    setTitle("");
                    setMessage("");
                    setPlatform("");
                    await load();
                    toast.success("Solicitud enviada");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "No se pudo enviar");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label className="seller-field">
                  <span>Tipo de solicitud</span>
                  <select
                    className="w-full rounded-lg border p-2"
                    value={module}
                    onChange={(e) => setModule(e.target.value as typeof module)}
                  >
                    <option value="questions">Tengo una duda</option>
                    <option value="reports">Reportar una cuenta</option>
                    <option value="requests">Pedir un producto / recarga</option>
                  </select>
                </label>
                <label className="seller-field">
                  <span>Asunto</span>
                  <Input
                    required
                    maxLength={160}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label className="seller-field">
                  <span>Plataforma o producto</span>
                  <Input
                    maxLength={100}
                    required={module !== "questions"}
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                  />
                </label>
                <label className="seller-field">
                  <span>Mensaje</span>
                  <Textarea
                    required
                    maxLength={2000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </label>
                <Button disabled={busy}>Enviar solicitud</Button>
              </form>
            </section>
            <section className="space-y-3">
              <h2 className="font-bold">Mis consultas, reportes y pedidos</h2>
              {data.records
                .filter((r) => ["questions", "reports", "requests"].includes(r.module))
                .map((r) => (
                  <article className="seller-card" key={r.id}>
                    <div className="flex justify-between gap-2">
                      <h3 className="font-bold">{r.title}</h3>
                      <span className="seller-badge">{STATUS[r.status] || r.status}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap mt-2">{r.data.message}</p>
                    {r.data.reply ? (
                      <div className="mt-3 rounded-xl bg-cyan-50 p-3 text-sm whitespace-pre-wrap">
                        <b>Respuesta de MA²</b>
                        <p>{r.data.reply}</p>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">En espera de atención.</p>
                    )}
                    {r.data.deliveryUrl && /^https:\/\//.test(r.data.deliveryUrl) ? (
                      <Button asChild className="mt-3">
                        <a href={r.data.deliveryUrl} target="_blank" rel="noopener noreferrer">
                          Abrir mi entrega
                        </a>
                      </Button>
                    ) : null}
                  </article>
                ))}
              {!data.records.some((r) =>
                ["questions", "reports", "requests"].includes(r.module),
              ) ? (
                <p className="seller-card text-sm text-slate-500">
                  Aún no tienes solicitudes registradas.
                </p>
              ) : null}
            </section>
            <section className="space-y-3">
              <h2 className="font-bold">Mis documentos y códigos</h2>
              {data.records
                .filter((r) => ["documents", "codes"].includes(r.module))
                .map((r) => (
                  <article className="seller-card" key={r.id}>
                    <h3 className="font-bold">{r.title}</h3>
                    {r.module === "codes" ? (
                      r.data.value ? (
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <code className="text-2xl font-bold">{r.data.value}</code>
                          <Button variant="outline" onClick={() => void copyText(r.data.value)}>
                            Copiar código
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 mt-2">
                          Código {STATUS[r.status]?.toLowerCase() || "no disponible"}.
                        </p>
                      )
                    ) : null}
                    {r.module === "documents" && r.data.filename ? (
                      <Button
                        className="mt-3"
                        variant="outline"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const doc = await portalDocument({
                              data: { id, token, documentId: r.id },
                            });
                            const a = document.createElement("a");
                            a.href = doc.attachment;
                            a.download = doc.filename;
                            a.click();
                          } catch (e) {
                            toast.error(
                              e instanceof Error ? e.message : "No se pudo descargar el archivo",
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Guardar {r.data.filename}
                      </Button>
                    ) : null}
                    {r.data.expiresAt ? (
                      <p className="text-xs text-slate-500 mt-2">
                        Vence: {new Date(r.data.expiresAt).toLocaleString("es-MX")}
                      </p>
                    ) : null}
                  </article>
                ))}
            </section>
            {data.records.some((r) => r.module === "faq") ? (
              <section className="seller-card space-y-3">
                <h2 className="font-bold">Preguntas frecuentes</h2>
                {data.records
                  .filter((r) => r.module === "faq")
                  .map((r) => (
                    <details key={r.id} className="border-t pt-3">
                      <summary className="cursor-pointer font-medium">{r.title}</summary>
                      <p className="text-sm mt-2 whitespace-pre-wrap">{r.data.reply}</p>
                    </details>
                  ))}
              </section>
            ) : null}
            <details className="seller-card">
              <summary className="cursor-pointer font-bold">Historial de saldo y crédito</summary>
              <div className="mt-3 space-y-3">
                {data.entries.map((e) => (
                  <div key={e.id} className="border-b py-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span>{e.note}</span>
                      <b>{money(Number(e.amount_cents) / 100)}</b>
                    </div>
                    <small className="text-slate-500">
                      {new Date(e.created_at).toLocaleString("es-MX")}
                    </small>
                  </div>
                ))}
                {!data.entries.length ? (
                  <p className="text-sm text-slate-500">Sin movimientos registrados.</p>
                ) : null}
              </div>
            </details>
          </>
        ) : null}
        <p className="text-center text-xs text-slate-500">
          Este enlace es privado. Compártelo únicamente con su titular.
        </p>
      </div>
    </main>
  );
}
