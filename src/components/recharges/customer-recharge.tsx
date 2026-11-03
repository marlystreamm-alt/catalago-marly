import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copyText } from "@/lib/browser/clipboard";
import { money } from "@/lib/workspace/model";
import {
  rechargePortalLoad,
  rechargeCreate,
  rechargeCancel,
} from "@/lib/recharges/recharges.functions";
export function CustomerRecharge({
  id,
  token,
  onBalanceChange,
}: {
  id: string;
  token: string;
  onBalanceChange: () => Promise<void>;
}) {
  const [data, setData] = useState<Awaited<ReturnType<typeof rechargePortalLoad>> | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setData(await rechargePortalLoad({ data: { id, token } }));
      setError("");
    } catch {
      setError("No se pudieron cargar las recargas. Intenta actualizar.");
    }
  }, [id, token]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!data?.requests.some((r) => r.status === "pending")) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void load();
        void onBalanceChange();
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [data?.requests, load, onBalanceChange]);
  const s = data?.settings;
  return (
    <section className="seller-card space-y-3">
      <h2 className="font-bold">Recargar mi saldo</h2>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {s?.enabled ? (
        <>
          <p className="text-sm text-slate-500">
            Genera tu referencia y transfiere el importe exacto antes de que venza. El abono se
            comprueba por correo cada 5 minutos; puede tardar más si el aviso bancario se retrasa.
          </p>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await rechargeCreate({ data: { id, token, amount: Number(amount) } });
                setAmount("");
                await load();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "No se pudo generar la referencia");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Input
              type="number"
              required
              min={s.minimum}
              max={s.maximum}
              step="1"
              placeholder={`De ${s.minimum} a ${s.maximum} MXN`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-label="Importe de recarga en pesos"
            />
            <Button disabled={busy}>Generar referencia</Button>
          </form>
          <div className="rounded-xl bg-cyan-50 p-3 text-sm space-y-1">
            <p>
              <b>Banco:</b> {s.bank}
            </p>
            <p>
              <b>Titular:</b> {s.holder}
            </p>
            <p className="break-all">
              <b>Cuenta / CLABE:</b> {s.account}
            </p>
            <Button variant="outline" size="sm" onClick={() => void copyText(s.account)}>
              Copiar cuenta
            </Button>
            {s.note ? <p className="whitespace-pre-wrap">{s.note}</p> : null}
            {s.bonusPercent > 0 ? (
              <p>Saldo de regalo: {s.bonusPercent}% sobre el monto solicitado.</p>
            ) : null}
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">
          Las recargas automáticas no están activas. Puedes pedir una recarga mediante el botón de
          soporte.
        </p>
      )}
      {data?.requests.map((r) => {
        const expired =
          r.status === "expired" ||
          (r.status === "pending" && Date.parse(r.expires_at) < Date.now());
        return (
          <article key={r.id} className="rounded-xl border p-3 space-y-2">
            <div className="flex justify-between gap-2">
              <b>{money(Number(r.payable_cents) / 100)}</b>
              <span className="text-xs">
                {r.status === "credited"
                  ? "✅ Acreditada"
                  : expired
                    ? "Vencida"
                    : r.status === "cancelled"
                      ? "Cancelada"
                      : "Esperando pago"}
              </span>
            </div>
            <p className="text-sm">
              Referencia: <b className="tracking-widest">{r.reference}</b>
            </p>
            <p className="text-xs text-slate-500">
              Vence: {new Date(r.expires_at).toLocaleString("es-MX")}
            </p>
            {r.status === "pending" && !expired ? (
              <>
                <p className="text-xs">
                  Usa esta referencia en el campo de referencia o concepto y envía exactamente el
                  importe indicado, incluidos los centavos.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void copyText(r.reference)}>
                    Copiar referencia
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        !confirm(
                          "Cancela solo si todavía no realizaste el pago. ¿Cancelar esta referencia?",
                        )
                      )
                        return;
                      setBusy(true);
                      try {
                        await rechargeCancel({ data: { id, token, requestId: r.id } });
                        await load();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "No se pudo cancelar");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </>
            ) : null}
          </article>
        );
      })}
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          await load();
          await onBalanceChange();
        }}
      >
        Actualizar pagos y saldo
      </Button>
    </section>
  );
}
