/** Configuración multi-proveedor para avisos de Alexa. */
import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Smartphone, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { notifyVerifyAlexa } from "@/lib/notify/notify.functions";
import {
  ALEXA_EVENT_TEXT,
  type AlexaEventKey,
  type AlexaMethod,
  type AlexaProvider,
  type NotifySettings,
} from "@/lib/notify/types";

const PROVIDERS: { value: AlexaProvider; label: string; hint: string }[] = [
  {
    value: "voicemonkey",
    label: "Voice Monkey",
    hint: "Anuncios hablados directamente en un Echo compatible.",
  },
  {
    value: "virtualbuttons",
    label: "Virtual Buttons",
    hint: "Dispara una Rutina de Alexa. La frase o acción se configura dentro de esa rutina.",
  },
  {
    value: "webhook",
    label: "Webhook / Rutina compatible",
    hint: "Envía un evento HTTPS a IFTTT, Zapier, Home Assistant u otro puente compatible.",
  },
  {
    value: "custom",
    label: "Integración personalizada",
    hint: "Deja MA² listo para una futura skill o API propia sin rediseñar Notificaciones.",
  },
];

const EVENT_KEYS = Object.keys(ALEXA_EVENT_TEXT) as AlexaEventKey[];

export function AlexaSetup({
  code,
  settings,
  onSaved,
  onSaveSettings,
}: {
  code: string;
  settings: NotifySettings;
  onSaved: (next: NotifySettings) => void;
  onSaveSettings: (next: NotifySettings) => void | Promise<void>;
}) {
  const [provider, setProvider] = useState<AlexaProvider>(settings.alexaProvider);
  const [token, setToken] = useState(settings.alexaToken);
  const [device, setDevice] = useState(settings.alexaDevice || "1");
  const [webhookUrl, setWebhookUrl] = useState(settings.alexaWebhookUrl);
  const [webhookSecret, setWebhookSecret] = useState(settings.alexaWebhookSecret);
  const [method, setMethod] = useState<AlexaMethod>(settings.alexaMethod);
  const [bodyTemplate, setBodyTemplate] = useState(settings.alexaBodyTemplate);
  const [appEnabled, setAppEnabled] = useState(settings.channelAlexaApp);
  const [appDevice, setAppDevice] = useState(settings.alexaAppDevice);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const providerInfo = PROVIDERS.find((p) => p.value === provider) ?? PROVIDERS[0];

  const puede = useMemo(() => {
    if (busy) return false;
    if (provider === "voicemonkey") return token.trim().length >= 4 && device.trim().length >= 2;
    if (provider === "virtualbuttons") {
      const n = Number(device);
      return token.trim().length >= 4 && Number.isInteger(n) && n >= 1 && n <= 99;
    }
    return /^https:\/\//i.test(webhookUrl.trim());
  }, [busy, provider, token, device, webhookUrl]);

  const validar = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await notifyVerifyAlexa({
        data: {
          code,
          provider,
          token: token.trim(),
          device: device.trim(),
          webhookUrl: webhookUrl.trim(),
          webhookSecret,
          method,
          bodyTemplate,
          save: true,
        },
      });
      setResult(r);
      if (r.ok) {
        onSaved({
          ...settings,
          channelAlexa: true,
          alexaProvider: provider,
          alexaToken: token.trim(),
          alexaDevice: device.trim(),
          alexaWebhookUrl: webhookUrl.trim(),
          alexaWebhookSecret: webhookSecret,
          alexaMethod: method,
          alexaBodyTemplate: bodyTemplate,
        });
      }
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : "No se pudo validar la integración de Alexa",
      });
    } finally {
      setBusy(false);
    }
  };

  const toggleEvent = (key: AlexaEventKey, value: boolean) => {
    const next: NotifySettings = {
      ...settings,
      alexaEvents: { ...settings.alexaEvents, [key]: value },
    };
    onSaved(next);
    void onSaveSettings(next);
  };

  return (
    <div className="space-y-3 rounded-2xl bg-muted/40 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Volume2 className="size-4" /> Integración con Alexa
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs">Método de Alexa</Label>
        <Select
          value={provider}
          onValueChange={(value) => {
            setProvider(value as AlexaProvider);
            setResult(null);
          }}
        >
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">{providerInfo.hint}</p>
      </div>

      {provider === "voicemonkey" ? (
        <>
          <div className="grid gap-1.5">
            <Label className="text-xs" htmlFor="alexa-vm-token">API Token de Voice Monkey</Label>
            <Input
              id="alexa-vm-token"
              value={token}
              type="password"
              autoComplete="off"
              placeholder="Pega aquí tu API Token"
              onChange={(e) => { setToken(e.target.value); setResult(null); }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs" htmlFor="alexa-vm-device">ID del Speaker</Label>
            <Input
              id="alexa-vm-device"
              value={device}
              autoComplete="off"
              placeholder="Ej. kitchen-echo-3f7k2"
              onChange={(e) => { setDevice(e.target.value); setResult(null); }}
            />
          </div>
        </>
      ) : null}

      {provider === "virtualbuttons" ? (
        <>
          <div className="grid gap-1.5">
            <Label className="text-xs" htmlFor="alexa-vb-code">Access Code de Virtual Buttons</Label>
            <Input
              id="alexa-vb-code"
              value={token}
              type="password"
              autoComplete="off"
              placeholder="Código recibido al vincular la skill"
              onChange={(e) => { setToken(e.target.value); setResult(null); }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs" htmlFor="alexa-vb-number">Número de Virtual Button</Label>
            <Input
              id="alexa-vb-number"
              value={device}
              inputMode="numeric"
              placeholder="1"
              onChange={(e) => { setDevice(e.target.value.replace(/\D/g, "").slice(0, 2)); setResult(null); }}
            />
            <p className="text-[11px] text-muted-foreground">
              Este método dispara la Rutina asociada al botón; la frase que Alexa diga se configura en la app Alexa.
            </p>
          </div>
        </>
      ) : null}

      {provider === "webhook" || provider === "custom" ? (
        <>
          <div className="grid gap-1.5">
            <Label className="text-xs" htmlFor="alexa-hook-url">URL HTTPS</Label>
            <Input
              id="alexa-hook-url"
              value={webhookUrl}
              autoComplete="off"
              placeholder="https://..."
              onChange={(e) => { setWebhookUrl(e.target.value); setResult(null); }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs" htmlFor="alexa-hook-secret">Secreto / Bearer opcional</Label>
            <Input
              id="alexa-hook-secret"
              value={webhookSecret}
              type="password"
              autoComplete="off"
              placeholder="Opcional"
              onChange={(e) => { setWebhookSecret(e.target.value); setResult(null); }}
            />
          </div>
        </>
      ) : null}

      {provider === "custom" ? (
        <>
          <div className="grid gap-1.5">
            <Label className="text-xs">Método HTTP</Label>
            <Select value={method} onValueChange={(value) => setMethod(value as AlexaMethod)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {method === "POST" ? (
            <div className="grid gap-1.5">
              <Label className="text-xs" htmlFor="alexa-custom-body">Cuerpo de la petición</Label>
              <Textarea
                id="alexa-custom-body"
                value={bodyTemplate}
                rows={4}
                onChange={(e) => { setBodyTemplate(e.target.value); setResult(null); }}
              />
              <p className="text-[11px] text-muted-foreground">
                Variables: {'{message} {event} {source} {token} {device}'}
              </p>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Token opcional</Label>
              <Input value={token} type="password" onChange={(e) => setToken(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Device / ID opcional</Label>
              <Input value={device} onChange={(e) => setDevice(e.target.value)} />
            </div>
          </div>
        </>
      ) : null}

      <Button className="w-full rounded-xl" disabled={!puede} onClick={() => void validar()}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
        {busy ? "Probando Alexa…" : "Probar Alexa y guardar método"}
      </Button>

      {result ? (
        <div className={`flex items-start gap-2 rounded-xl p-2.5 text-xs ${result.ok ? "bg-primary/10 text-foreground" : "bg-destructive/10 font-medium text-destructive"}`}>
          {result.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
          <span>{result.message}</span>
        </div>
      ) : null}

      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Smartphone className="size-4" /> Alexa app (Rutina Trigger)
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Dispara una Rutina de Alexa aparte del anuncio del Echo. En Voice Monkey crea un
              Routine Trigger y vincúlalo a una rutina de Alexa con la acción que quieras usar en el teléfono.
            </p>
          </div>
          <Switch
            checked={appEnabled}
            onCheckedChange={(value) => {
              setAppEnabled(value);
              const next = { ...settings, channelAlexaApp: value, alexaAppDevice: appDevice.trim() };
              onSaved(next);
              void onSaveSettings(next);
            }}
          />
        </div>
        {appEnabled ? (
          <div className="grid gap-1.5">
            <Label className="text-xs" htmlFor="alexa-app-trigger">ID de Routine Trigger</Label>
            <Input
              id="alexa-app-trigger"
              value={appDevice}
              autoComplete="off"
              placeholder="Ej. pedidos-app-abc123"
              onChange={(e) => setAppDevice(e.target.value)}
              onBlur={() => {
                const next = { ...settings, channelAlexaApp: appEnabled, alexaAppDevice: appDevice.trim() };
                onSaved(next);
                void onSaveSettings(next);
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              Echo y Alexa app quedan independientes: si uno falla, el otro sigue intentando avisar.
            </p>
          </div>
        ) : null}
      </div>

      <div className="space-y-2 border-t pt-3">
        <p className="text-xs font-medium">Qué eventos puede anunciar Alexa</p>
        {EVENT_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between gap-3 rounded-xl border bg-background/60 px-3 py-2">
            <span className="text-xs">{ALEXA_EVENT_TEXT[key]}</span>
            <Switch
              checked={settings.alexaEvents[key]}
              onCheckedChange={(value) => toggleEvent(key, value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
