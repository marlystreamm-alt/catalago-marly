/** Flujo guiado para conectar Alexa (Notify Me / Voice Monkey) desde el panel de avisos. */
import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Volume2 } from "lucide-react";
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
import { notifyVerifyAlexa } from "@/lib/notify/notify.functions";
import type { NotifySettings } from "@/lib/notify/types";

const PASOS: Record<NotifySettings["alexaProvider"], string[]> = {
  notifyme: [
    "En tu teléfono abre la app Alexa y busca la skill «Notify Me». Actívala (es gratis).",
    "Dile a tu bocina: «Alexa, abre Notify Me». Te llegará un correo con tu Access Code.",
    "Copia ese código del correo y pégalo abajo.",
    "Toca «Validar y activar»: tu Alexa debe sonar con un aviso de prueba.",
  ],
  voicemonkey: [
    "Entra a voicemonkey.io, crea tu cuenta y activa la skill «Voice Monkey» en la app Alexa.",
    "En voicemonkey.io copia tu Access Token del apartado de ajustes.",
    "Copia también el nombre exacto de tu dispositivo (device) y pégalo abajo.",
    "Toca «Validar y activar»: tu Alexa anunciará el aviso de prueba en voz alta.",
  ],
};

export function AlexaSetup({
  code,
  settings,
  onSaved,
}: {
  code: string;
  settings: NotifySettings;
  onSaved: (next: NotifySettings) => void;
}) {
  const [provider, setProvider] = useState<NotifySettings["alexaProvider"]>(settings.alexaProvider);
  const [token, setToken] = useState(settings.alexaToken);
  const [device, setDevice] = useState(settings.alexaDevice);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const tokenLimpio = token.trim();
  const faltaDevice = provider === "voicemonkey" && !device.trim();
  const puede = tokenLimpio.length >= 4 && !faltaDevice && !busy;

  const validar = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await notifyVerifyAlexa({
        data: { code, provider, token: tokenLimpio, device: device.trim(), save: true },
      });
      setResult(r);
      if (r.ok) {
        onSaved({
          ...settings,
          channelAlexa: true,
          alexaProvider: provider,
          alexaToken: tokenLimpio,
          alexaDevice: device.trim(),
        });
      }
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : "No se pudo validar el código",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-muted/40 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Volume2 className="size-4" /> Conectar tu Alexa paso a paso
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs">Skill puente</Label>
        <Select
          value={provider}
          onValueChange={(v) => {
            setProvider(v as NotifySettings["alexaProvider"]);
            setResult(null);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="notifyme">Notify Me (más fácil)</SelectItem>
            <SelectItem value="voicemonkey">Voice Monkey (anuncia en voz alta)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ol className="space-y-1.5 text-xs text-muted-foreground">
        {PASOS[provider].map((paso, i) => (
          <li key={paso} className="flex gap-2">
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
              {i + 1}
            </span>
            <span>{paso}</span>
          </li>
        ))}
      </ol>

      <div className="grid gap-1.5">
        <Label className="text-xs" htmlFor="alexa-code">
          {provider === "notifyme" ? "Access Code de Notify Me" : "Access Token de Voice Monkey"}
        </Label>
        <Input
          id="alexa-code"
          value={token}
          autoComplete="off"
          placeholder="Pega aquí el código del correo"
          onChange={(e) => {
            setToken(e.target.value);
            setResult(null);
          }}
        />
        {tokenLimpio.length > 0 && tokenLimpio.length < 4 ? (
          <p className="text-xs font-medium text-destructive">
            El código parece incompleto (mínimo 4 caracteres).
          </p>
        ) : null}
      </div>

      {provider === "voicemonkey" && (
        <div className="grid gap-1.5">
          <Label className="text-xs" htmlFor="alexa-device">
            Nombre del dispositivo
          </Label>
          <Input
            id="alexa-device"
            value={device}
            placeholder="Ej. cocina"
            onChange={(e) => {
              setDevice(e.target.value);
              setResult(null);
            }}
          />
          {faltaDevice ? (
            <p className="text-xs font-medium text-destructive">
              Voice Monkey necesita el nombre del dispositivo.
            </p>
          ) : null}
        </div>
      )}

      <Button className="w-full rounded-xl" disabled={!puede} onClick={() => void validar()}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
        {busy ? "Validando…" : "Validar y activar"}
      </Button>

      {result ? (
        <div
          className={`flex items-start gap-2 rounded-xl p-2.5 text-xs ${
            result.ok
              ? "bg-primary/10 text-foreground"
              : "bg-destructive/10 font-medium text-destructive"
          }`}
        >
          {result.ok ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
          )}
          <span>
            {result.ok
              ? "¡Listo! Tu Alexa recibió el aviso de prueba y el código quedó guardado. Con Notify Me di «Alexa, lee mis notificaciones»."
              : result.message}
          </span>
        </div>
      ) : null}
    </div>
  );
}
