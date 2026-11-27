import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Upload } from "lucide-react";
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
import { salesCreateRequest, salesGetPublicConfig } from "@/lib/sales/sales.functions";
import type { SalesPlan } from "@/lib/sales/types";
import { StoreBusinessPage } from "@/components/sales/store-business-page";
export const Route = createFileRoute("/contratar")({
  validateSearch: (search) => ({ plan: typeof search.plan === "string" ? search.plan : undefined }),
  component: Contratar,
});
function Contratar() {
  const { plan: selectedPlan } = Route.useSearch();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [plans, setPlans] = useState<SalesPlan[]>([]);
  const [instructions, setInstructions] = useState("");
  const [name, setName] = useState("");
  const [wa, setWa] = useState("");
  const [business, setBusiness] = useState("");
  const [plan, setPlan] = useState("");
  const [receipt, setReceipt] = useState("");
  const [result, setResult] = useState<{
    reference: string;
    amount: number;
    planName: string;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    salesGetPublicConfig().then((c) => {
      setEnabled(c.enabled && c.plans.length > 0);
      setPlans(c.plans);
      setInstructions(c.paymentInstructions);
      setPlan(c.plans.find((item) => item.id === selectedPlan)?.id ?? c.plans[0]?.id ?? "");
    }).catch(() => {
      setError("No pudimos cargar los planes.");
      setEnabled(false);
    });
  }, [selectedPlan]);
  if (enabled === null) return <main className="mx-auto max-w-lg p-6" role="status">Cargando planes…</main>;
  if (!enabled)
    return (
      <main className="mx-auto max-w-lg p-6">
        <div className="rounded-3xl border p-6 text-center">
          <h1 className="font-bold">Contrata tu tienda</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error || "Consulta los planes disponibles y solicita tu tienda por WhatsApp."}
          </p>
          <Button asChild className="mt-4"><a href="https://wa.me/528443852364?text=Hola%2C%20quiero%20contratar%20mi%20tienda">Consultar por WhatsApp</a></Button>
        </div>
      </main>
    );
  if (result)
    return (
      <main className="mx-auto max-w-lg p-6">
        <div className="rounded-3xl border bg-card p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-primary" />
          <h1 className="mt-3 text-xl font-bold">Solicitud registrada</h1>
          <p className="mt-3 text-sm">Tu referencia es</p>
          <code className="mt-1 block text-2xl font-black">{result.reference}</code>
          <p className="mt-2">
            {result.planName} · ${result.amount} MXN
          </p>
          {instructions ? (
            <div className="mt-4 whitespace-pre-wrap rounded-2xl bg-muted/50 p-3 text-left text-sm">
              {instructions}
            </div>
          ) : null}
        </div>
      </main>
    );
  return (
    <StoreBusinessPage actions={<Button asChild size="sm" variant="ghost"><a href="/plataforma#planes">Volver a planes</a></Button>}>
      <div className="mx-auto max-w-lg px-4 py-6">
      <section className="seller-card">
        <h1 className="text-xl font-bold">Contratar MA²</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Elige un plan y genera tu referencia de pago.
        </p>
        <div className="space-y-3">
          <div>
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="shop-whatsapp">WhatsApp del propietario</Label>
            <Input
              id="shop-whatsapp"
              type="tel"
              autoComplete="tel"
              aria-describedby="shop-whatsapp-format"
              placeholder="+52 844 123 4567"
              value={wa}
              onChange={(e) => setWa(e.target.value)}
            />
            <p id="shop-whatsapp-format" className="mt-1 text-xs text-muted-foreground">
              Incluye el código de tu país. En México, escribe +52 seguido de tu número de 10 dígitos.
              Ejemplo: +52 844 123 4567.
            </p>
          </div>
          <div>
            <Label>Nombre del negocio</Label>
            <Input value={business} onChange={(e) => setBusiness(e.target.value)} />
          </div>
          <div>
            <Label>Plan</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · ${p.monthly}/mes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Comprobante (opcional)</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed p-3 text-sm">
              <Upload className="size-4" />
              {receipt ? "Comprobante cargado" : "Elegir imagen"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) {
                    setError("Selecciona PNG, JPG o WebP");
                    return;
                  }
                  if (f.size > 1_500_000) {
                    setError("La imagen debe pesar menos de 1.5 MB");
                    return;
                  }
                  const r = new FileReader();
                  r.onload = () => setReceipt(String(r.result ?? ""));
                  r.readAsDataURL(f);
                }}
              />
            </label>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            className="w-full"
            disabled={submitting || !name.trim() || !business.trim() || !wa.trim() || !plan}
            onClick={async () => {
              setSubmitting(true);
              setError("");
              try {
                const r = await salesCreateRequest({
                  data: {
                    customerName: name,
                    whatsapp: wa,
                    businessName: business,
                    planId: plan,
                    receiptDataUrl: receipt,
                  },
                });
                setResult({
                  reference: r.request.reference,
                  amount: r.request.amount,
                  planName: r.request.planName,
                });
                setInstructions(r.paymentInstructions);
              } catch (e) {
                setError(e instanceof Error ? e.message : "No se pudo registrar");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? "Generando referencia…" : "Generar referencia"}
          </Button>
        </div>
      </section>
      </div>
    </StoreBusinessPage>
  );
}
