import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  BellRing,
  Check,
  Loader2,
  RefreshCw,
  Send,
  Smartphone,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  notifyChangeCode,
  notifyDeleteDevice,
  notifyListDevices,
  notifyListLog,
  notifyListOrders,
  notifyLogin,
  notifySavePush,
  notifySaveSettings,
  notifySetDeviceActive,
  notifySetOrderStatus,
  notifyStatus,
  notifyTest,
} from "@/lib/notify/notify.functions";
import { getSavedCode, saveCode, subscribeToPush } from "@/lib/notify/client";
import { AlexaSetup } from "./alexa-setup";
import {
  CHANNEL_TEXT,
  DEFAULT_SETTINGS,
  KIND_TEXT,
  type CloudOrder,
  type NotifyDevice,
  type NotifyLogEntry,
  type NotifySettings,
} from "@/lib/notify/types";

const money = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })
    .format(Number.isFinite(n) ? n : 0);

const when = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });

export function NotificationsDialog() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(getSavedCode());
  const [hasCode, setHasCode] = useState(true);
  const [vapid, setVapid] = useState("");
  const [logged, setLogged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<NotifySettings>(DEFAULT_SETTINGS);
  const [orders, setOrders] = useState<CloudOrder[]>([]);
  const [devices, setDevices] = useState<NotifyDevice[]>([]);
  const [log, setLog] = useState<NotifyLogEntry[]>([]);
  const [logFilter, setLogFilter] = useState("todos");
  const [newCode, setNewCode] = useState("");

  useEffect(() => {
    if (!open) return;
    void notifyStatus()
      .then((s) => {
        setHasCode(s.hasCode);
        setVapid(s.vapidPublicKey);
      })
      .catch(() => undefined);
  }, [open]);

  const loadOrders = useCallback(async (theCode: string) => {
    try {
      setOrders(await notifyListOrders({ data: { code: theCode, onlyNew: false } }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron leer los pedidos");
    }
  }, []);

  const loadDevices = useCallback(async (theCode: string) => {
    try {
      setDevices(await notifyListDevices({ data: { code: theCode } }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron leer los dispositivos");
    }
  }, []);

  const loadLog = useCallback(async (theCode: string) => {
    try {
      setLog(await notifyListLog({ data: { code: theCode } }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo leer el historial");
    }
  }, []);

  const login = async () => {
    setBusy(true);
    try {
      const s = await notifyLogin({ data: { code: code.trim() } });
      setSettings(s);
      setLogged(true);
      setHasCode(true);
      saveCode(code.trim());
      await Promise.all([loadOrders(code.trim()), loadDevices(code.trim()), loadLog(code.trim())]);
      toast.success("Panel de avisos abierto");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Código incorrecto");
    } finally {
      setBusy(false);
    }
  };

  const save = async (next: NotifySettings) => {
    setSettings(next);
    setBusy(true);
    try {
      const { hasCode: _ignored, ...rest } = next;
      const saved = await notifySaveSettings({ data: { code: code.trim(), settings: rest } });
      setSettings(saved);
      toast.success("Avisos actualizados");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  const activarPush = async () => {
    setBusy(true);
    try {
      const result = await subscribeToPush(vapid);
      if (!result.ok || !result.subscription) {
        toast.error(result.reason ?? "No se pudo activar");
        return;
      }
      await notifySavePush({
        data: {
          code: code.trim(),
          endpoint: result.subscription.endpoint,
          p256dh: result.subscription.p256dh,
          auth: result.subscription.auth,
          label: navigator.userAgent.slice(0, 60),
        },
      });
      toast.success("Este dispositivo recibirá los avisos");
      await loadDevices(code.trim());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo activar el aviso");
    } finally {
      setBusy(false);
    }
  };

  const cambiarDispositivo = async (device: NotifyDevice, active: boolean) => {
    setDevices((prev) => prev.map((d) => (d.id === device.id ? { ...d, active } : d)));
    try {
      await notifySetDeviceActive({ data: { code: code.trim(), id: device.id, active } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el dispositivo");
      await loadDevices(code.trim());
    }
  };

  const borrarDispositivo = async (device: NotifyDevice) => {
    try {
      await notifyDeleteDevice({ data: { code: code.trim(), id: device.id } });
      setDevices((prev) => prev.filter((d) => d.id !== device.id));
      toast.success("Dispositivo eliminado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar");
    }
  };

  const probar = async () => {
    setBusy(true);
    try {
      const { results } = await notifyTest({ data: { code: code.trim() } });
      toast.success("Prueba enviada", { description: results.join(" · ") });
      await loadLog(code.trim());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar la prueba");
    } finally {
      setBusy(false);
    }
  };

  const cambiarCodigo = async () => {
    if (newCode.trim().length < 4) {
      toast.error("El código nuevo debe tener al menos 4 caracteres");
      return;
    }
    setBusy(true);
    try {
      await notifyChangeCode({ data: { code: code.trim(), newCode: newCode.trim() } });
      setCode(newCode.trim());
      saveCode(newCode.trim());
      setNewCode("");
      toast.success("Código actualizado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cambiar el código");
    } finally {
      setBusy(false);
    }
  };

  const marcar = async (order: CloudOrder) => {
    const status = order.status === "nuevo" ? "atendido" : "nuevo";
    try {
      await notifySetOrderStatus({ data: { code: code.trim(), id: order.id, status } });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar");
    }
  };

  const pendientes = orders.filter((o) => o.status === "nuevo").length;
  const filteredLog = log.filter((l) => logFilter === "todos" || l.channel === logFilter);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl">
          <Bell className="size-4" />
          Avisos de pedidos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Avisos de pedidos</DialogTitle>
          <DialogDescription>
            Recibe una notificación cada vez que alguien pide por WhatsApp, con recordatorios
            mientras no lo marques como atendido.
          </DialogDescription>
        </DialogHeader>

        {!logged ? (
          <div className="space-y-3">
            <Label htmlFor="avisos-code">
              {hasCode ? "Código de acceso a los avisos" : "Crea tu código de acceso (mínimo 4)"}
            </Label>
            <Input
              id="avisos-code"
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void login();
              }}
              placeholder="••••••"
              autoComplete="off"
            />
            <Button className="w-full rounded-xl" disabled={busy} onClick={() => void login()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}
              {hasCode ? "Entrar" : "Crear código y entrar"}
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="config">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="config" className="text-xs">
                Ajustes
              </TabsTrigger>
              <TabsTrigger value="pedidos" className="text-xs">
                Pedidos {pendientes ? `(${pendientes})` : ""}
              </TabsTrigger>
              <TabsTrigger value="dispositivos" className="text-xs">
                Equipos
              </TabsTrigger>
              <TabsTrigger value="historial" className="text-xs">
                Historial
              </TabsTrigger>
            </TabsList>

            <TabsContent value="config" className="space-y-4 pt-3">
              <Row
                label="Avisos activados"
                hint="Apaga esto para dejar de registrar y avisar pedidos."
                checked={settings.enabled}
                onChange={(v) => void save({ ...settings, enabled: v })}
              />

              <div className="space-y-3 rounded-2xl border p-3">
                <p className="text-sm font-medium">Canales</p>
                <Row
                  label="Notificación en el teléfono (push)"
                  checked={settings.channelPush}
                  onChange={(v) => void save({ ...settings, channelPush: v })}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl"
                  disabled={busy}
                  onClick={() => void activarPush()}
                >
                  <BellRing className="size-4" /> Activar avisos en este dispositivo
                </Button>
                <p className="text-xs text-muted-foreground">
                  En iPhone: agrega la app a la pantalla de inicio y ábrela desde ahí antes de
                  activar.
                </p>

                <Row
                  label="Correo"
                  checked={settings.channelEmail}
                  onChange={(v) => void save({ ...settings, channelEmail: v })}
                />
                {settings.channelEmail && (
                  <Input
                    value={settings.email}
                    placeholder="tucorreo@ejemplo.com"
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    onBlur={() => void save(settings)}
                  />
                )}

                <Row
                  label="WhatsApp"
                  checked={settings.channelWhatsapp}
                  onChange={(v) => void save({ ...settings, channelWhatsapp: v })}
                />
                {settings.channelWhatsapp && (
                  <Input
                    value={settings.whatsappNumber}
                    placeholder="+52..."
                    onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                    onBlur={() => void save(settings)}
                  />
                )}

                <Row
                  label="Alexa"
                  checked={settings.channelAlexa}
                  onChange={(v) => void save({ ...settings, channelAlexa: v })}
                />
                <AlexaSetup
                  code={code.trim()}
                  settings={settings}
                  onSaved={(next) => setSettings(next)}
                />

              </div>

              <div className="space-y-3 rounded-2xl border p-3">
                <p className="text-sm font-medium">Horario y recordatorios</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Desde</Label>
                    <Input
                      type="time"
                      value={settings.quietStart}
                      onChange={(e) => setSettings({ ...settings, quietStart: e.target.value })}
                      onBlur={() => void save(settings)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Hasta</Label>
                    <Input
                      type="time"
                      value={settings.quietEnd}
                      onChange={(e) => setSettings({ ...settings, quietEnd: e.target.value })}
                      onBlur={() => void save(settings)}
                    />
                  </div>
                </div>
                <Row
                  label="Apagar automáticamente a medianoche"
                  checked={settings.autoOffMidnight}
                  onChange={(v) => void save({ ...settings, autoOffMidnight: v })}
                />
                <Row
                  label="Recordarme mientras no atienda el pedido"
                  checked={settings.repeatEnabled}
                  onChange={(v) => void save({ ...settings, repeatEnabled: v })}
                />
                {settings.repeatEnabled && (
                  <div>
                    <Label className="text-xs">Cada cuántos minutos</Label>
                    <Input
                      type="number"
                      min={5}
                      max={240}
                      value={settings.repeatMinutes}
                      onChange={(e) =>
                        setSettings({ ...settings, repeatMinutes: Number(e.target.value) || 15 })
                      }
                      onBlur={() => void save(settings)}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-2xl border p-3">
                <p className="text-sm font-medium">Escalamiento automático</p>
                <p className="text-xs text-muted-foreground">
                  Si no marcas el pedido como atendido, se avisa por otro canal.
                </p>
                <Row
                  label="Activar escalamiento"
                  checked={settings.escalateEnabled}
                  onChange={(v) => void save({ ...settings, escalateEnabled: v })}
                />
                {settings.escalateEnabled && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Después de (minutos)</Label>
                      <Input
                        type="number"
                        min={5}
                        max={720}
                        value={settings.escalateMinutes}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            escalateMinutes: Number(e.target.value) || 30,
                          })
                        }
                        onBlur={() => void save(settings)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Avisar por</Label>
                      <Select
                        value={settings.escalateChannel}
                        onValueChange={(v) =>
                          void save({
                            ...settings,
                            escalateChannel: v as NotifySettings["escalateChannel"],
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="push">Push</SelectItem>
                          <SelectItem value="email">Correo</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="alexa">Alexa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-2xl border p-3">
                <p className="text-sm font-medium">Seguridad</p>
                <Input
                  type="password"
                  value={newCode}
                  placeholder="Nuevo código de acceso"
                  onChange={(e) => setNewCode(e.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl"
                  disabled={busy}
                  onClick={() => void cambiarCodigo()}
                >
                  Cambiar código
                </Button>
              </div>

              <Button
                variant="secondary"
                className="w-full rounded-xl"
                disabled={busy}
                onClick={() => void probar()}
              >
                <Send className="size-4" /> Enviar aviso de prueba
              </Button>
            </TabsContent>

            <TabsContent value="pedidos" className="space-y-2 pt-3">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => void loadOrders(code.trim())}
              >
                <RefreshCw className="size-4" /> Actualizar
              </Button>
              {!orders.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Todavía no hay pedidos registrados.
                </p>
              )}
              {orders.map((o) => (
                <div key={o.id} className="rounded-2xl border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {o.items.length > 1
                          ? o.items.map((i) => i.name).join(", ")
                          : o.serviceName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {o.catalogName} · {money(o.total)} · {when(o.createdAt)}
                      </p>
                    </div>
                    <Badge variant={o.status === "nuevo" ? "default" : "secondary"}>
                      {o.status === "nuevo" ? "Pendiente" : "Atendido"}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 rounded-xl"
                    onClick={() => void marcar(o)}
                  >
                    <Check className="size-4" />
                    {o.status === "nuevo" ? "Marcar como atendido" : "Volver a pendiente"}
                  </Button>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="dispositivos" className="space-y-2 pt-3">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => void loadDevices(code.trim())}
                >
                  <RefreshCw className="size-4" /> Actualizar
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl"
                  disabled={busy}
                  onClick={() => void activarPush()}
                >
                  <Smartphone className="size-4" /> Registrar este equipo
                </Button>
              </div>
              {!devices.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aún no hay dispositivos registrados.
                </p>
              )}
              {devices.map((d) => (
                <div key={d.id} className="flex items-center gap-2 rounded-2xl border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {d.label || "Dispositivo sin nombre"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Registrado el {when(d.createdAt)}
                    </p>
                  </div>
                  <Switch
                    checked={d.active}
                    onCheckedChange={(v) => void cambiarDispositivo(d, v)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => void borrarDispositivo(d)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="historial" className="space-y-2 pt-3">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => void loadLog(code.trim())}
                >
                  <RefreshCw className="size-4" /> Actualizar
                </Button>
                <Select value={logFilter} onValueChange={setLogFilter}>
                  <SelectTrigger className="h-9 flex-1 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los canales</SelectItem>
                    <SelectItem value="push">Push</SelectItem>
                    <SelectItem value="email">Correo</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="alexa">Alexa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!filteredLog.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Todavía no hay avisos registrados.
                </p>
              )}
              {filteredLog.map((l) => (
                <div key={l.id} className="rounded-2xl border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {CHANNEL_TEXT[l.channel] ?? l.channel} ·{" "}
                        <span className="font-normal text-muted-foreground">
                          {KIND_TEXT[l.kind] ?? l.kind}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {when(l.createdAt)} · intento {l.attempt}
                      </p>
                    </div>
                    <Badge variant={l.status === "enviado" ? "default" : "destructive"}>
                      {l.status === "enviado" ? "Enviado" : "Pendiente"}
                    </Badge>
                  </div>
                  {l.detail && <p className="mt-1 text-xs text-muted-foreground">{l.detail}</p>}
                </div>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
