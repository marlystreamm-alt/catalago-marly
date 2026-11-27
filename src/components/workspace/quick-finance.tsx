import { useId, useRef, useState, type FormEvent } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSavedCode } from "@/lib/notify/client";
import { financeListAccounts, financeQuickMove } from "@/lib/workspace/finance.functions";

type Kind = "income" | "expense";
type Accounts = Awaited<ReturnType<typeof financeListAccounts>>;

export function QuickFinance({ openFinance }: { openFinance: () => void }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [accounts, setAccounts] = useState<Accounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const requests = useRef(new Map<string, string>());
  const locked = useRef(false);
  const formId = useId();

  const loadAccounts = async () => {
    setLoading(true);
    setError("");
    try {
      setAccounts(await financeListAccounts({ data: { code: getSavedCode() } }));
    } catch {
      setError("No se pudieron cargar las cuentas.");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (next: Kind) => {
    if (kind === next) {
      setKind(null);
      return;
    }
    setKind(next);
    if (!accounts && !loading) void loadAccounts();
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!kind || !accounts?.length || locked.current) return;
    const fields = new FormData(event.currentTarget);
    const account = accounts.length === 1 ? accounts[0].id : String(fields.get("account") || "");
    const category = String(fields.get("category") || "").trim();
    const amount = Math.round(Number(fields.get("amount")) * 100);
    if (!category) {
      setError("Escribe una categoría.");
      return;
    }
    const key = JSON.stringify([kind, account, category, amount]);
    const requestId = requests.current.get(key) ?? crypto.randomUUID();
    requests.current.set(key, requestId);
    locked.current = true;
    setSaving(true);
    setError("");
    try {
      await financeQuickMove({ data: { code: getSavedCode(), requestId, kind, account, amount, category } });
      requests.current.delete(key);
      toast.success(kind === "income" ? "Entrada guardada" : "Salida guardada");
      setKind(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo guardar el movimiento.");
    } finally {
      locked.current = false;
      setSaving(false);
    }
  };

  return (
    <section className="seller-card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Wallet className="size-5 text-primary" /> Finanzas
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={kind === "income" ? "default" : "outline"}
            aria-expanded={kind === "income"} aria-controls={formId} disabled={saving}
            onClick={() => toggle("income")}>Registrar entrada</Button>
          <Button type="button" size="sm" variant={kind === "expense" ? "default" : "outline"}
            aria-expanded={kind === "expense"} aria-controls={formId} disabled={saving}
            onClick={() => toggle("expense")}>Registrar salida</Button>
          <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={openFinance}>Ver finanzas</Button>
        </div>
      </div>
      <div id={formId} hidden={!kind}>
        {kind && <div className="space-y-2 border-t pt-3">
          {loading && <p className="text-sm text-muted-foreground" role="status">Cargando cuentas…</p>}
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          {!loading && !accounts && <Button type="button" size="sm" variant="outline" onClick={() => void loadAccounts()}>Reintentar</Button>}
          {accounts?.length === 0 && <p className="text-sm text-muted-foreground">Agrega una cuenta en Finanzas → Mis cuentas.</p>}
          {accounts && accounts.length > 0 && <form key={kind} className="space-y-3" onSubmit={(event) => void save(event)}>
            <fieldset disabled={saving} className="grid gap-2 sm:grid-cols-2">
              <label className="seller-field"><span>Importe · MXN</span>
                <Input name="amount" type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01" required />
              </label>
              <label className="seller-field"><span>Categoría</span>
                <Input name="category" maxLength={100} required />
              </label>
              {accounts.length > 1 ? (
                <label className="seller-field sm:col-span-2"><span>Cuenta</span>
                  <select className="buyer-select" name="account" required defaultValue="">
                    <option value="">Selecciona una cuenta</option>
                    {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                </label>
              ) : <p className="text-xs text-muted-foreground sm:col-span-2">Cuenta: {accounts[0].name}</p>}
            </fieldset>
            <Button size="sm" disabled={saving}>{saving ? "Guardando…" : kind === "income" ? "Guardar entrada" : "Guardar salida"}</Button>
          </form>}
        </div>}
      </div>
    </section>
  );
}
