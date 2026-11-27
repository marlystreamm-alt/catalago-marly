import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "@/lib/browser/clipboard";
import { money, type OpsRecord, STATUS } from "@/lib/workspace/model";
import { getSavedCode } from "@/lib/notify/client";
import { mainStoreLink } from "@/lib/catalog/links";
import {
  customerManageLoad,
  customerManageCredit,
  customerManageReset,
  customerManageReply,
  customerManageActive,
  customerManageTier,
} from "@/lib/customer/manage.functions";
const err = (e: unknown) => (e instanceof Error ? e.message : "No se pudo completar");
export function CustomerManager({
  ownerToken,
  slug,
  onAssign,
}: {
  ownerToken?: string;
  slug: string;
  records?: OpsRecord[];
  onAssign?: (id: string) => void;
}) {
  const [data, setData] = useState<Awaited<ReturnType<typeof customerManageLoad>> | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [temporary, setTemporary] = useState("");
  const [query, setQuery] = useState("");
  const requests = useRef(new Map<string, string>());
  const auth = useCallback(
    () => (ownerToken ? { ownerToken } : { code: getSavedCode() }),
    [ownerToken],
  );
  const load = useCallback(async () => {
    try {
      setData(await customerManageLoad({ data: auth() }));
      setError("");
    } catch (e) {
      setError(err(e));
    }
  }, [auth]);
  useEffect(() => {
    void load();
  }, [load]);
  const action = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(err(e));
      toast.error(err(e));
    } finally {
      setBusy(false);
    }
  };
  const search = query.trim().toLowerCase();
  const matches = data?.accounts.filter((account) =>
    `${account.name} ${account.email}`.toLowerCase().includes(search),
  ) ?? [];
  return (
    <section className="seller-card space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <h2 className="text-sm font-bold">Cuentas web</h2>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost"
            onClick={() => void copyText(`${location.origin}${slug === "ma2" ? mainStoreLink() : `/tienda/${encodeURIComponent(slug)}`}`)}>
            Copiar enlace
          </Button>
          <Button variant="ghost" size="icon" disabled={busy} aria-label="Actualizar clientes" onClick={() => void load()}>
            <RefreshCw />
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {temporary ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-slate-900 space-y-2">
          <p className="text-sm font-bold">Acceso temporal · entrégalo solo al titular</p>
          <code className="break-all">{temporary}</code>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void copyText(temporary)}>
              Copiar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setTemporary("")}>
              Ocultar
            </Button>
          </div>
          <p className="text-xs">Se pedirá cambiar esta contraseña al entrar.</p>
        </div>
      ) : null}
      {Boolean(data?.accounts.length) && (
        <Input value={query} onChange={(event) => setQuery(event.target.value)}
          aria-label="Buscar cuentas web" placeholder="Buscar cliente o correo" />
      )}
      {data?.accounts.length ? (
        <div className="grid items-start gap-2 lg:grid-cols-2">
        {matches.map((a) => (
          <details className="seller-disclosure" key={a.id}>
            <summary>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{a.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {a.active ? "Activo" : "Suspendido"}
                </span>
              </span>
              <b className="whitespace-nowrap text-sm">{money(a.balance)}</b>
            </summary>
            <div className="seller-disclosure-body space-y-3">
              <p className="text-xs break-all text-muted-foreground">{a.email}</p>
              {a.must_change && <p className="text-xs">Cambio de contraseña pendiente</p>}
            {!ownerToken && slug === "ma2" && <label className="seller-field"><span>Tipo de cliente y tarifa</span><select className="buyer-select" disabled={busy} value={a.price_tier || "retail"} onChange={e=>{const tier=e.target.value as "retail"|"reseller";if(!confirm(`¿Cambiar a ${tier==="reseller"?"Revendedor":"Cliente normal"}? Se aplicará en sus próximas compras.`))return;void action(async()=>{await customerManageTier({data:{...auth(),accountId:a.id,tier}});toast.success("Categoría actualizada");});}}><option value="retail">Cliente normal</option><option value="reseller">Revendedor</option></select></label>}
            <form
              className="grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fields = new FormData(e.currentTarget),
                  amount = Number(fields.get("amount")),
                  note = String(fields.get("note") || "");
                if (
                  !confirm(
                    `¿Confirmas que verificaste el pago y deseas abonar ${money(amount)} a ${a.name}?`,
                  )
                )
                  return;
                void action(async () => {
                  const key = a.id + ":" + amount + ":" + note;
                  let id = requests.current.get(key);
                  if (!id) {
                    id = crypto.randomUUID();
                    requests.current.set(key, id);
                  }
                  await customerManageCredit({
                    data: { ...auth(), accountId: a.id, amount, note, requestId: id },
                  });
                  toast.success("Saldo acreditado");
                });
              }}
            >
              <label className="seller-field">
                <span>Abonar saldo verificado · MXN</span>
                <Input name="amount" type="number" min="0.01" max="1000000" step="0.01" required />
              </label>
              <label className="seller-field">
                <span>Referencia de pago / motivo único</span>
                <Input name="note" minLength={3} maxLength={400} required />
              </label>
              <Button size="sm" disabled={busy || !a.active}>
                Confirmar abono
              </Button>
            </form>
            <div className="flex flex-wrap gap-2">
              {onAssign && a.client_id ? <Button size="sm" disabled={!a.active || busy} onClick={() => onAssign(a.client_id)}>Asignar cuenta</Button> : null}
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  if (
                    !confirm(
                      "¿Verificaste la identidad del cliente? Se cerrarán sus sesiones y se generará una contraseña temporal.",
                    )
                  )
                    return;
                  void action(async () => {
                    setTemporary(
                      (await customerManageReset({ data: { ...auth(), accountId: a.id } }))
                        .password,
                    );
                  });
                }}
              >
                Recuperar acceso
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (
                    !confirm(
                      a.active ? "¿Suspender el acceso de este cliente?" : "¿Reactivar al cliente?",
                    )
                  )
                    return;
                  void action(async () => {
                    await customerManageActive({
                      data: { ...auth(), accountId: a.id, active: !a.active },
                    });
                  });
                }}
              >
                {a.active ? "Suspender" : "Reactivar"}
              </Button>
            </div>
            </div>
          </details>
        ))}
        {!matches.length && <p className="text-sm text-muted-foreground">Sin coincidencias.</p>}
        </div>
      ) : null}
      {data && !data.accounts.length ? (
        <p className="text-sm text-muted-foreground">
          Los compradores aparecerán cuando se registren desde el enlace de tu tienda.
        </p>
      ) : null}
      {data && data.requests.length > 0 && <details className="seller-disclosure">
        <summary className="text-sm font-semibold">Reportes y solicitudes ({data.requests.length})</summary>
        <div className="seller-disclosure-body space-y-2">
        {data.requests.map((r) => (
          <details className="seller-disclosure" key={r.id}>
            <summary><span className="flex-1 text-sm font-semibold">{r.title}</span><span className="seller-badge">{STATUS[r.status] || r.status}</span></summary>
        <form
          className="seller-disclosure-body space-y-3"
          key={r.version}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void action(async () => {
              await customerManageReply({
                data: {
                  ...auth(),
                  id: r.id,
                  version: r.version,
                  reply: String(f.get("reply") || ""),
                  status: String(f.get("status")) as
                    "pending" | "in_progress" | "resolved" | "completed" | "cancelled",
                },
              });
              toast.success("Respuesta guardada");
            });
          }}
        >
          <p className="text-xs text-muted-foreground">
            {data.accounts.find((a) => a.client_id === r.clientId)?.name || "Cliente"}
          </p>
          <p className="text-sm whitespace-pre-wrap">{r.message}</p>
          <label className="seller-field">
            <span>Respuesta para el cliente</span>
            <Textarea name="reply" defaultValue={r.reply} maxLength={2000} />
          </label>
          <label className="seller-field">
            <span>Estado</span>
            <select name="status" className="buyer-select" defaultValue={r.status}>
              {["pending", "in_progress", "resolved", "completed", "cancelled"].map((s) => (
                <option key={s} value={s}>
                  {STATUS[s] || s}
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" disabled={busy}>
            Guardar respuesta
          </Button>
        </form>
          </details>
        ))}
        </div>
      </details>}
    </section>
  );
}
