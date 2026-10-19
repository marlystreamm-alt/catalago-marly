/**
 * Lógica de avisos de pedidos (solo servidor).
 * Envía notificaciones push, correo, WhatsApp y Alexa respetando el horario configurado.
 */
import { ApplicationServerKeys, generatePushHTTPRequest, setWebCrypto } from "webpush-webcrypto";
import {
  DEFAULT_ALEXA_EVENTS,
  DEFAULT_SETTINGS,
  type AlexaEventKey,
  type AlexaMethod,
  type AlexaProvider,
  type CloudOrder,
  type NotifySettings,
} from "./types";

type Row = Record<string, unknown>;

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/* ------------------------------- Configuración ------------------------------ */

export function rowToSettings(row: Row | null): NotifySettings {
  if (!row) return { ...DEFAULT_SETTINGS };
  const s = (k: string, d: string) => (typeof row[k] === "string" ? (row[k] as string) : d);
  const b = (k: string, d: boolean) => (typeof row[k] === "boolean" ? (row[k] as boolean) : d);
  return {
    enabled: b("enabled", true),
    channelPush: b("channel_push", true),
    channelEmail: b("channel_email", false),
    channelWhatsapp: b("channel_whatsapp", false),
    channelAlexa: b("channel_alexa", false),
    channelAlexaApp: b("channel_alexa_app", false),
    email: s("email", ""),
    whatsappNumber: s("whatsapp_number", ""),
    whatsappProvider: (["twilio", "whapi", "greenapi"] as const).includes(
      s("whatsapp_provider", "twilio") as any,
    )
      ? (s("whatsapp_provider", "twilio") as NotifySettings["whatsappProvider"])
      : "twilio",
    alexaProvider: (["voicemonkey", "virtualbuttons", "webhook", "custom"] as const).includes(
      s("alexa_provider", "voicemonkey") as AlexaProvider,
    )
      ? (s("alexa_provider", "voicemonkey") as AlexaProvider)
      : "voicemonkey",
    alexaToken: s("alexa_token", ""),
    alexaDevice: s("alexa_device", ""),
    alexaAppDevice: s("alexa_app_device", ""),
    alexaWebhookUrl: s("alexa_webhook_url", ""),
    alexaWebhookSecret: s("alexa_webhook_secret", ""),
    alexaMethod: s("alexa_method", "POST") === "GET" ? "GET" : "POST",
    alexaBodyTemplate: s(
      "alexa_body_template",
      '{"message":"{message}","event":"{event}","source":"MA2"}',
    ),
    alexaEvents: (() => {
      const raw = row["alexa_events"];
      const obj =
        raw && typeof raw === "object" && !Array.isArray(raw)
          ? (raw as Record<string, unknown>)
          : {};
      return {
        order_new:
          typeof obj["order_new"] === "boolean"
            ? Boolean(obj["order_new"])
            : DEFAULT_ALEXA_EVENTS.order_new,
        order_reminder:
          typeof obj["order_reminder"] === "boolean"
            ? Boolean(obj["order_reminder"])
            : DEFAULT_ALEXA_EVENTS.order_reminder,
        directory_request:
          typeof obj["directory_request"] === "boolean"
            ? Boolean(obj["directory_request"])
            : DEFAULT_ALEXA_EVENTS.directory_request,
        menu_extra_request:
          typeof obj["menu_extra_request"] === "boolean"
            ? Boolean(obj["menu_extra_request"])
            : DEFAULT_ALEXA_EVENTS.menu_extra_request,
        payment_proof:
          typeof obj["payment_proof"] === "boolean"
            ? Boolean(obj["payment_proof"])
            : DEFAULT_ALEXA_EVENTS.payment_proof,
        client_suspended:
          typeof obj["client_suspended"] === "boolean"
            ? Boolean(obj["client_suspended"])
            : DEFAULT_ALEXA_EVENTS.client_suspended,
      };
    })(),
    alexaOrderNewMessage: s(
      "alexa_order_new_message",
      "Tienes un nuevo pedido de {catalogo}. Revisa MA² Connect.",
    ),
    alexaOrderReminderMessage: s(
      "alexa_order_reminder_message",
      "Tienes un pedido pendiente de {catalogo}. Revisa MA² Connect.",
    ),
    repeatEnabled: b("repeat_enabled", true),
    repeatMinutes: Number(row["repeat_minutes"] ?? 15) || 15,
    quietStart: s("quiet_start", "08:00"),
    quietEnd: s("quiet_end", "00:00"),
    autoOffMidnight: b("auto_off_midnight", true),
    timezone: s("timezone", "America/Monterrey"),
    escalateEnabled: b("escalate_enabled", false),
    escalateMinutes: Number(row["escalate_minutes"] ?? 30) || 30,
    escalateChannel: (["push", "email", "whatsapp", "alexa"] as const).includes(
      s("escalate_channel", "whatsapp") as NotifySettings["escalateChannel"],
    )
      ? (s("escalate_channel", "whatsapp") as NotifySettings["escalateChannel"])
      : "whatsapp",
    hasCode: !!s("admin_code_hash", ""),
  };
}

export async function loadSettingsRow(): Promise<Row | null> {
  const db = await admin();
  const { data } = await db.from("notification_settings").select("*").eq("id", 1).maybeSingle();
  return (data as Row) ?? null;
}

export async function loadSettings(): Promise<NotifySettings> {
  return rowToSettings(await loadSettingsRow());
}

/** Procesa recordatorios y escalaciones pendientes desde una tarea del servidor. */
export async function runPendingReminders() {
  const settings = await loadSettings();
  if (!settings.enabled || !withinSchedule(settings)) {
    return { skipped: true, sent: 0, escalated: 0 };
  }

  const db = await admin();
  let sent = 0;
  let escalated = 0;
  let renewals = 0;

  if (settings.repeatEnabled) {
    const cutoff = new Date(Date.now() - settings.repeatMinutes * 60_000).toISOString();
    const { data, error } = await db
      .from("orders")
      .select("*")
      .eq("status", "nuevo")
      .or(`notified_at.is.null,notified_at.lt.${cutoff}`)
      .order("created_at", { ascending: true })
      .limit(20);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      try {
        await notifyOrder(rowToOrder(row as Record<string, unknown>), settings, true);
        sent += 1;
      } catch (error) {
        console.error("Recordatorio falló:", error);
      }
    }
  }

  if (settings.escalateEnabled) {
    const limit = new Date(Date.now() - settings.escalateMinutes * 60_000).toISOString();
    const { data } = await db
      .from("orders")
      .select("*")
      .eq("status", "nuevo")
      .is("escalated_at", null)
      .lt("created_at", limit)
      .order("created_at", { ascending: true })
      .limit(20);
    for (const row of data ?? []) {
      try {
        await escalateOrder(rowToOrder(row as Record<string, unknown>), settings);
        escalated += 1;
      } catch (error) {
        console.error("Escalamiento falló:", error);
      }
    }
  }

  try {
    renewals = await createCyberDocsRenewalAlerts(settings);
  } catch (error) {
    console.error("Alertas de renovación fallaron:", error);
  }

  return { ok: true, sent, escalated, renewals };
}

function dateInTimezone(timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    return year && month && day ? `${year}-${month}-${day}` : new Date().toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function daysBetweenDates(from: string, to: string) {
  const fromTime = Date.parse(`${from}T12:00:00Z`);
  const toTime = Date.parse(`${to}T12:00:00Z`);
  return Math.round((toTime - fromTime) / 86_400_000);
}

async function createCyberDocsRenewalAlerts(settings: NotifySettings) {
  const db = await admin();
  const today = dateInTimezone(settings.timezone);
  const horizon = new Date(`${today}T12:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 90);
  const horizonDate = horizon.toISOString().slice(0, 10);
  const { data, error } = await db
    .from("cyberdocs_orders")
    .select(
      "id,cyberdocs_order_id,client_name,service_name,expires_on,renewal_warning_days,renewal_alerted_for",
    )
    .eq("status", "completed")
    .not("expires_on", "is", null)
    .gte("expires_on", today)
    .lte("expires_on", horizonDate)
    .order("expires_on", { ascending: true })
    .limit(250);
  if (error) throw new Error(error.message);

  let created = 0;
  for (const raw of data ?? []) {
    const row = raw as Row;
    const expiresOn = String(row["expires_on"] ?? "");
    const rawWarningDays = Number(row["renewal_warning_days"]);
    const warningDays = Math.max(
      0,
      Math.min(90, Number.isFinite(rawWarningDays) ? rawWarningDays : 3),
    );
    const days = daysBetweenDates(today, expiresOn);
    if (days < 0 || days > warningDays || row["renewal_alerted_for"] === expiresOn) continue;

    const serviceName = String(row["service_name"] ?? "Servicio");
    const clientName = String(row["client_name"] ?? "Cliente");
    const orderId = String(row["id"]);
    const { data: notification, error: insertError } = await db
      .from("orders")
      .insert({
        catalog_id: `renewal-${orderId}-${expiresOn}`,
        catalog_name: "Renovaciones",
        service_name: `Renovación próxima: ${serviceName}`,
        total: 0,
        items: [{ name: serviceName, price: 0 }],
        message: `${clientName} vence ${days === 0 ? "hoy" : `en ${days} día(s)`}. Ofrece la renovación por WhatsApp.`,
        link: "/?cyberdocs=1",
        recipient: "",
      })
      .select("*")
      .single();
    if (insertError || !notification) {
      console.error("No se creó el aviso de renovación:", insertError?.message);
      continue;
    }

    const { error: updateError } = await db
      .from("cyberdocs_orders")
      .update({
        renewal_alerted_for: expiresOn,
        renewal_notification_order_id: notification.id,
        renewal_status: "Pendiente de contactar",
      })
      .eq("id", orderId);
    if (updateError) {
      console.error("No se enlazó el aviso de renovación:", updateError.message);
      continue;
    }
    await db.from("cyberdocs_order_events").insert({
      order_id: orderId,
      action: "renewal_alert_created",
      actor: "system",
      detail: `Aviso automático ${days} día(s) antes del vencimiento ${expiresOn}`,
    });
    await notifyOrder(rowToOrder(notification as Row), settings, true, "recordatorio");
    created += 1;
  }
  return created;
}

/* --------------------------------- Horario --------------------------------- */

function minutesNow(timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("es-MX", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return (h % 24) * 60 + m;
  } catch {
    const d = new Date();
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
}

function toMinutes(value: string, fallback: number) {
  const match = /^(\d{1,2}):(\d{2})$/.exec((value || "").trim());
  if (!match) return fallback;
  return (Number(match[1]) % 24) * 60 + Number(match[2]);
}

/** ¿Estamos dentro del horario en el que sí se avisa? */
export function withinSchedule(settings: NotifySettings) {
  const now = minutesNow(settings.timezone);
  const start = toMinutes(settings.quietStart, 8 * 60);
  const rawEnd = toMinutes(settings.quietEnd, 0);
  // "00:00" significa medianoche del día siguiente.
  const end = rawEnd === 0 ? 24 * 60 : rawEnd;
  if (settings.autoOffMidnight && rawEnd === 0 && now < start) return false;
  if (start <= end) return now >= start && now < end;
  // Horario que cruza la medianoche (ej. 20:00 a 06:00).
  return now >= start || now < end;
}

/* -------------------------------- Mensajes --------------------------------- */

const money = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

export function orderTitle(order: CloudOrder, repeat: boolean) {
  return repeat ? "Pedido pendiente por atender" : "Tienes un pedido nuevo";
}

export function orderBody(order: CloudOrder) {
  const items = order.items?.length ? order.items.map((i) => i.name).join(", ") : order.serviceName;
  return `${order.catalogName}: ${items} · ${money(order.total)}`;
}

/* ---------------------------------- Push ----------------------------------- */

export async function ensureVapidConfig() {
  setWebCrypto(globalThis.crypto);
  const db = await admin();
  const { data, error } = await db
    .from("notification_settings")
    .select("vapid_public_key,vapid_private_key,vapid_subject")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const row = (data ?? {}) as Record<string, unknown>;
  const publicKey = String(row["vapid_public_key"] ?? "").trim();
  const privateKey = String(row["vapid_private_key"] ?? "").trim();
  const subject =
    String(row["vapid_subject"] ?? "mailto:marlystreamm@gmail.com").trim() ||
    "mailto:marlystreamm@gmail.com";

  const looksValidPublic =
    publicKey.length >= 80 && publicKey !== "undefined" && publicKey !== "null";
  const looksValidPrivate =
    privateKey.length >= 40 && privateKey !== "undefined" && privateKey !== "null";
  if (looksValidPublic && looksValidPrivate) return { publicKey, privateKey, subject };

  // Generar el par con la misma librería que lo usa al enviar evita pares
  // VAPID incompatibles o llaves pegadas con formato incorrecto.
  const generated = await ApplicationServerKeys.generate();
  const json = await generated.toJSON();
  const next = {
    publicKey: String(json.publicKey).trim(),
    privateKey: String(json.privateKey).trim(),
    subject: "mailto:marlystreamm@gmail.com",
  };
  const { error: saveError } = await db
    .from("notification_settings")
    .update({
      vapid_public_key: next.publicKey,
      vapid_private_key: next.privateKey,
      vapid_subject: next.subject,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (saveError) throw new Error(saveError.message);
  return next;
}

async function sendPush(order: CloudOrder, repeat: boolean) {
  const { publicKey, privateKey, subject } = await ensureVapidConfig();
  const db = await admin();
  const { data } = await db.from("push_subscriptions").select("*").eq("active", true);
  const subs = (data ?? []) as Row[];
  if (!subs.length) return "Sin dispositivos registrados";

  const keys = await ApplicationServerKeys.fromJSON({ publicKey, privateKey });
  const payload = JSON.stringify({
    title: orderTitle(order, repeat),
    body: orderBody(order),
    url: "/?pedidos=1",
    tag: `pedido-${order.id}`,
  });

  let ok = 0;
  for (const sub of subs) {
    try {
      const req = await generatePushHTTPRequest({
        applicationServerKeys: keys,
        payload,
        target: {
          endpoint: String(sub["endpoint"]),
          keys: { p256dh: String(sub["p256dh"]), auth: String(sub["auth"]) },
        },
        adminContact: subject,
        ttl: 60 * 60,
        urgency: "high",
      });
      const res = await fetch(req.endpoint, {
        method: "POST",
        headers: req.headers,
        body: req.body,
      });
      if (res.ok) ok += 1;
      else if (res.status === 404 || res.status === 410) {
        await db.from("push_subscriptions").delete().eq("endpoint", String(sub["endpoint"]));
      }
    } catch (error) {
      console.error("Push falló:", error);
    }
  }
  return ok ? `Push enviado a ${ok} dispositivo(s)` : "No se pudo entregar el push";
}

/* --------------------------------- Correo ---------------------------------- */

async function sendEmail(order: CloudOrder, settings: NotifySettings, repeat: boolean) {
  const resendKey = process.env["RESEND_API_KEY"];
  if (!settings.email) return "Falta el correo del administrador";
  if (!resendKey) return "Correo no configurado (falta RESEND_API_KEY)";
  // Resend directo: evita depender del gateway de Lovable en producción.
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: process.env["RESEND_FROM"] || "MA² Avisos <onboarding@resend.dev>",
      to: [settings.email],
      subject: orderTitle(order, repeat),
      html: `<p><strong>${orderBody(order)}</strong></p><pre style="white-space:pre-wrap;font-family:inherit">${order.message}</pre>`,
    }),
  });
  if (!res.ok) return `Correo falló [${res.status}]: ${await res.text()}`;
  return "Correo enviado";
}

/* -------------------------------- WhatsApp --------------------------------- */

async function sendWhatsapp(order: CloudOrder, settings: NotifySettings, repeat: boolean) {
  if (!settings.whatsappNumber) return "Falta el número de WhatsApp";
  // MA² queda preparado para cambiar de proveedor sin tocar el resto del sistema.
  // Por ahora WhatsApp se mantiene opcional; Alexa, Alexa app y correo funcionan aparte.
  if (settings.whatsappProvider === "whapi")
    return "Whapi.Cloud preparado; falta agregar las credenciales del canal";
  if (settings.whatsappProvider === "greenapi")
    return "GREEN-API preparado; falta agregar las credenciales de la instancia";

  const lovableKey = process.env["LOVABLE_API_KEY"];
  const twilioKey = process.env["TWILIO_API_KEY"];
  const from = process.env["TWILIO_FROM_NUMBER"];
  if (!lovableKey || !twilioKey || !from) return "Twilio no configurado";
  const res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": twilioKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: settings.whatsappNumber,
      From: from,
      Body: `${orderTitle(order, repeat)}\n${orderBody(order)}`,
    }),
  });
  if (!res.ok) return `WhatsApp falló [${res.status}]: ${await res.text()}`;
  return "WhatsApp enviado";
}

/* ---------------------------------- Alexa ---------------------------------- */

export interface AlexaDispatchConfig {
  provider: AlexaProvider;
  token: string;
  device: string;
  webhookUrl?: string;
  webhookSecret?: string;
  method?: AlexaMethod;
  bodyTemplate?: string;
  event?: string;
}

function safeReplace(template: string, values: Record<string, string>) {
  let out = template;
  for (const [key, value] of Object.entries(values)) {
    out = out.split(`{${key}}`).join(value);
  }
  return out;
}

function safeExternalUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false as const, message: "La URL del webhook no es válida" };
  }
  if (url.protocol !== "https:") {
    return { ok: false as const, message: "Por seguridad, el webhook debe usar HTTPS" };
  }
  const host = url.hostname.toLowerCase();
  const privateHost =
    host === "localhost" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (privateHost) return { ok: false as const, message: "Ese destino privado no está permitido" };
  return { ok: true as const, url };
}

async function fetchWithTimeout(input: string | URL, init?: RequestInit) {
  return fetch(input, { ...init, signal: AbortSignal.timeout(10_000) });
}

/** Envía un texto o disparador hacia Alexa mediante el proveedor configurado. */
export async function sendAlexaText(
  text: string,
  config: AlexaDispatchConfig,
): Promise<{ ok: boolean; message: string }> {
  const message = text.trim();
  const token = config.token.trim();
  const device = config.device.trim();
  const event = (config.event || "evento").trim();
  try {
    if (config.provider === "voicemonkey") {
      if (!token) return { ok: false, message: "Falta el API Token de Voice Monkey" };
      if (!device) return { ok: false, message: "Falta el ID del Speaker de Voice Monkey" };
      const res = await fetchWithTimeout("https://api-v3.voicemonkey.io/announce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, device, speech: message, language: "es-MX" }),
      });
      if (!res.ok) {
        const body = (await res.text()).slice(0, 220);
        if (res.status === 401 || res.status === 403)
          return { ok: false, message: "El API Token de Voice Monkey no es válido" };
        if (res.status === 404)
          return { ok: false, message: "No se encontró ese Speaker en Voice Monkey" };
        if (res.status === 429)
          return {
            ok: false,
            message:
              "Voice Monkey limitó temporalmente las solicitudes; intenta de nuevo en un momento",
          };
        return { ok: false, message: `Voice Monkey falló [${res.status}]: ${body}` };
      }
      return { ok: true, message: "Voice Monkey recibió el anuncio" };
    }

    if (config.provider === "virtualbuttons") {
      if (!token) return { ok: false, message: "Falta el Access Code de Virtual Buttons" };
      const n = Number(device || "1");
      if (!Number.isInteger(n) || n < 1 || n > 99)
        return { ok: false, message: "El botón virtual debe ser un número del 1 al 99" };
      const url = new URL("https://api.virtualbuttons.com/v1");
      url.searchParams.set("virtualButton", String(n));
      url.searchParams.set("accessCode", token);
      const res = await fetchWithTimeout(url, { method: "GET" });
      if (!res.ok) {
        const body = (await res.text()).slice(0, 220);
        return { ok: false, message: `Virtual Buttons falló [${res.status}]: ${body}` };
      }
      return {
        ok: true,
        message: `Virtual Button ${n} activado; Alexa ejecutará la rutina vinculada`,
      };
    }

    const checked = safeExternalUrl(config.webhookUrl || "");
    if (!checked.ok) return checked;
    const headers: Record<string, string> = {};
    if (config.webhookSecret?.trim())
      headers.Authorization = `Bearer ${config.webhookSecret.trim()}`;

    if (config.provider === "webhook") {
      headers["Content-Type"] = "application/json";
      const res = await fetchWithTimeout(checked.url, {
        method: "POST",
        headers,
        body: JSON.stringify({ message, event, source: "MA2", sentAt: new Date().toISOString() }),
      });
      if (!res.ok) {
        const body = (await res.text()).slice(0, 220);
        return { ok: false, message: `Webhook falló [${res.status}]: ${body}` };
      }
      return { ok: true, message: "Webhook enviado; la rutina compatible recibió el evento" };
    }

    const method: AlexaMethod = config.method === "GET" ? "GET" : "POST";
    const values = {
      message,
      event,
      token,
      device,
      source: "MA2",
    };
    if (method === "GET") {
      const url = new URL(checked.url);
      url.searchParams.set("message", message);
      url.searchParams.set("event", event);
      url.searchParams.set("source", "MA2");
      const res = await fetchWithTimeout(url, { method: "GET", headers });
      if (!res.ok) {
        const body = (await res.text()).slice(0, 220);
        return { ok: false, message: `Integración personalizada falló [${res.status}]: ${body}` };
      }
      return { ok: true, message: "Integración personalizada recibió la prueba" };
    }

    const template =
      config.bodyTemplate?.trim() || '{"message":"{message}","event":"{event}","source":"MA2"}';
    const rendered = safeReplace(template, values);
    let body = rendered;
    headers["Content-Type"] = "application/json";
    try {
      body = JSON.stringify(JSON.parse(rendered));
    } catch {
      headers["Content-Type"] = "text/plain; charset=utf-8";
    }
    const res = await fetchWithTimeout(checked.url, { method: "POST", headers, body });
    if (!res.ok) {
      const responseBody = (await res.text()).slice(0, 220);
      return {
        ok: false,
        message: `Integración personalizada falló [${res.status}]: ${responseBody}`,
      };
    }
    return { ok: true, message: "Integración personalizada recibió la prueba" };
  } catch (error) {
    return { ok: false, message: `No se pudo conectar con Alexa: ${String(error)}` };
  }
}

/** Dispara una Rutina Trigger de Voice Monkey, separada del anuncio hablado del Echo. */
export async function sendAlexaAppTrigger(settings: NotifySettings) {
  const token = settings.alexaToken.trim();
  const device = settings.alexaAppDevice.trim();
  if (!settings.channelAlexaApp) return { ok: true, message: "Alexa app desactivada" };
  if (!token) return { ok: false, message: "Falta el API Token de Voice Monkey para Alexa app" };
  if (!device) return { ok: false, message: "Falta el ID de Routine Trigger para Alexa app" };
  try {
    const res = await fetchWithTimeout("https://api-v3.voicemonkey.io/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, device }),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 220);
      return { ok: false, message: `Routine Trigger falló [${res.status}]: ${body}` };
    }
    return { ok: true, message: "Rutina de Alexa app activada" };
  } catch (error) {
    return { ok: false, message: `No se pudo activar la rutina de Alexa app: ${String(error)}` };
  }
}

function alexaConfigFromSettings(settings: NotifySettings, event: string): AlexaDispatchConfig {
  return {
    provider: settings.alexaProvider,
    token: settings.alexaToken,
    device: settings.alexaDevice,
    webhookUrl: settings.alexaWebhookUrl,
    webhookSecret: settings.alexaWebhookSecret,
    method: settings.alexaMethod,
    bodyTemplate: settings.alexaBodyTemplate,
    event,
  };
}

/** Aviso de Alexa para eventos que no son pedidos (directorio, pago, suspensión, etc.). */
export async function notifyAlexaEvent(event: AlexaEventKey, text: string) {
  const settings = await loadSettings();
  if (
    !settings.enabled ||
    (!settings.channelAlexa && !settings.channelAlexaApp) ||
    !settings.alexaEvents[event]
  )
    return { ok: true, skipped: true, message: "Alexa omitida por configuración" };
  if (!withinSchedule(settings))
    return { ok: true, skipped: true, message: "Alexa omitida por horario" };
  const result = settings.channelAlexa
    ? await sendAlexaText(text, alexaConfigFromSettings(settings, event))
    : { ok: true, message: "Echo desactivado" };
  const appResult = settings.channelAlexaApp
    ? await sendAlexaAppTrigger(settings)
    : { ok: true, message: "Alexa app desactivada" };
  if (settings.channelAlexa)
    await logEvent({
      orderId: null,
      channel: "alexa",
      kind: "evento",
      attempt: 1,
      detail: `${event}: ${result.message}`,
    });
  if (settings.channelAlexaApp)
    await logEvent({
      orderId: null,
      channel: "alexa_app",
      kind: "evento",
      attempt: 1,
      detail: `${event}: ${appResult.message}`,
    });
  return { ...result, skipped: false, app: appResult };
}

function renderAlexaOrderMessage(template: string, order: CloudOrder, repeat: boolean) {
  const items = order.items?.length ? order.items.map((i) => i.name).join(", ") : order.serviceName;
  const fallback = repeat
    ? "Tienes un pedido pendiente de {catalogo}. Revisa MA² Connect."
    : "Tienes un nuevo pedido de {catalogo}. Revisa MA² Connect.";
  return (template.trim() || fallback)
    .replaceAll("{catalogo}", order.catalogName || "CyberDocs")
    .replaceAll("{servicio}", order.serviceName || items || "pedido")
    .replaceAll("{productos}", items || "pedido")
    .replaceAll("{total}", money(order.total));
}

async function sendAlexa(order: CloudOrder, settings: NotifySettings, repeat: boolean) {
  const event: AlexaEventKey = repeat ? "order_reminder" : "order_new";
  if (!settings.alexaEvents[event]) return "Alexa omitida para este tipo de evento";
  const text = renderAlexaOrderMessage(
    repeat ? settings.alexaOrderReminderMessage : settings.alexaOrderNewMessage,
    order,
    repeat,
  );
  const r = await sendAlexaText(text, alexaConfigFromSettings(settings, event));
  return r.message;
}

/* -------------------------------- Orquestador ------------------------------- */

export function rowToOrder(row: Row): CloudOrder {
  return {
    id: String(row["id"]),
    createdAt: String(row["created_at"]),
    catalogId: String(row["catalog_id"] ?? ""),
    catalogName: String(row["catalog_name"] ?? ""),
    serviceName: String(row["service_name"] ?? ""),
    total: Number(row["total"] ?? 0),
    items: Array.isArray(row["items"]) ? (row["items"] as { name: string; price: number }[]) : [],
    message: String(row["message"] ?? ""),
    link: String(row["link"] ?? ""),
    recipient: String(row["recipient"] ?? ""),
    status: row["status"] === "atendido" ? "atendido" : "nuevo",
    notifiedAt: (row["notified_at"] as string) ?? null,
    notifyAttempts: Number(row["notify_attempts"] ?? 0),
    attendedAt: (row["attended_at"] as string) ?? null,
  };
}

export type NotifyKind = "nuevo" | "recordatorio" | "escalamiento" | "prueba" | "evento";

const FAILED = /(fall|falta|no configurado|no se pudo|sin dispositivos)/i;

/** Guarda una línea en el historial de avisos. */
export async function logEvent(entry: {
  orderId: string | null;
  channel: string;
  kind: NotifyKind;
  attempt: number;
  detail: string;
}) {
  try {
    const db = await admin();
    await db.from("notification_log").insert({
      order_id: entry.orderId,
      channel: entry.channel,
      kind: entry.kind,
      attempt: entry.attempt,
      status: FAILED.test(entry.detail) ? "pendiente" : "enviado",
      detail: entry.detail,
    });
  } catch (error) {
    console.error("No se pudo guardar el historial de avisos:", error);
  }
}

/** Envía por un solo canal y devuelve el detalle. */
export async function sendByChannel(
  channel: "push" | "email" | "whatsapp" | "alexa" | "alexa_app",
  order: CloudOrder,
  settings: NotifySettings,
  repeat: boolean,
) {
  if (channel === "push") return sendPush(order, repeat);
  if (channel === "email") return sendEmail(order, settings, repeat);
  if (channel === "whatsapp") return sendWhatsapp(order, settings, repeat);
  if (channel === "alexa_app") return (await sendAlexaAppTrigger(settings)).message;
  return sendAlexa(order, settings, repeat);
}

/** Envía el aviso por todos los canales activos y devuelve el detalle de cada uno. */
export async function notifyOrder(
  order: CloudOrder,
  settings: NotifySettings,
  repeat = false,
  kind: NotifyKind = repeat ? "recordatorio" : "nuevo",
): Promise<string[]> {
  const attempt = order.notifyAttempts + 1;
  const orderId = kind === "prueba" ? null : order.id;
  const results: string[] = [];
  const channels = [
    ["push", settings.channelPush, "Push"],
    ["email", settings.channelEmail, "Correo"],
    ["whatsapp", settings.channelWhatsapp, "WhatsApp"],
    ["alexa", settings.channelAlexa, "Alexa (Echo)"],
    ["alexa_app", settings.channelAlexaApp, "Alexa app"],
  ] as const;

  for (const [channel, on, label] of channels) {
    if (!on) continue;
    const detail = await sendByChannel(channel, order, settings, repeat);
    results.push(`${label}: ${detail}`);
    await logEvent({ orderId, channel, kind, attempt, detail });
  }
  if (!results.length) results.push("No hay canales activos");

  if (kind !== "prueba") {
    const db = await admin();
    await db
      .from("orders")
      .update({ notified_at: new Date().toISOString(), notify_attempts: attempt })
      .eq("id", order.id);
  }

  return results;
}

/** Escalamiento: avisa por el canal alterno si el pedido sigue sin atenderse. */
export async function escalateOrder(order: CloudOrder, settings: NotifySettings) {
  const channel = settings.escalateChannel;
  const detail = await sendByChannel(channel, order, settings, true);
  await logEvent({
    orderId: order.id,
    channel,
    kind: "escalamiento",
    attempt: order.notifyAttempts + 1,
    detail,
  });
  const db = await admin();
  await db.from("orders").update({ escalated_at: new Date().toISOString() }).eq("id", order.id);
  return detail;
}

/* ------------------------- Código de acceso admin --------------------------- */

const enc = new TextEncoder();

/**
 * Límite duro de iteraciones del runtime (Workers y Safari/iOS topan en 100 000).
 * Nunca debe ejecutarse PBKDF2 con un valor mayor: el runtime lanza error.
 */
const PBKDF2_ITERATIONS = 100_000;
const MAX_PBKDF2_ITERATIONS = 100_000;

export async function hashCode(code: string, salt: string, iterations = PBKDF2_ITERATIONS) {
  const safeIterations = Math.min(Math.max(1, Math.floor(iterations)), MAX_PBKDF2_ITERATIONS);
  const key = await crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: safeIterations },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Código inicial opcional, configurado únicamente como secreto del servidor. */
const INITIAL_ADMIN_CODE = process.env.MA2_INITIAL_ADMIN_CODE?.trim() ?? "";

/**
 * Verifica el código del administrador. Una base nueva solo puede inicializarse
 * con un secreto privado configurado en el servidor; no existe un PIN público.
 */
export async function requireAdminPassword(code: string) {
  const trimmed = (code ?? "").trim();
  if (trimmed.length < 4) throw new Error("El código debe tener al menos 4 caracteres");

  const db = await admin();
  let row = await loadSettingsRow();
  let hash = String(row?.["admin_code_hash"] ?? "");
  let salt = String(row?.["admin_code_salt"] ?? "");

  if (!hash || !salt) {
    if (INITIAL_ADMIN_CODE.length < 6) {
      throw new Error(
        "El PIN de administración todavía no está configurado. Define MA2_INITIAL_ADMIN_CODE en Netlify.",
      );
    }
    const newSalt = randomSalt();
    const initialHash = await hashCode(INITIAL_ADMIN_CODE, newSalt);
    const { error } = await db
      .from("notification_settings")
      .upsert(
        { id: 1, admin_code_hash: initialHash, admin_code_salt: newSalt },
        { onConflict: "id" },
      );
    if (error) throw new Error(error.message);
    row = await loadSettingsRow();
    hash = String(row?.["admin_code_hash"] ?? initialHash);
    salt = String(row?.["admin_code_salt"] ?? newSalt);
  }

  if ((await hashCode(trimmed, salt)) === hash) {
    return { mustChangePassword: Boolean(row?.["admin_must_change"]) };
  }
  throw new Error("Código incorrecto");
}

/** Shared authorization for stock, orders, deliveries, sales and notifications. */
export async function requireAdminCode(credential: string) {
  const { verifyAdminCredential } = await import("@/lib/admin-credential");
  return verifyAdminCredential(credential, {
    password: requireAdminPassword,
    session: async (token) => {
      const { requireServerSession } = await import("@/lib/sessions.server");
      await requireServerSession(token);
      const row = await loadSettingsRow();
      return { mustChangePassword: Boolean(row?.["admin_must_change"]) };
    },
  });
}
