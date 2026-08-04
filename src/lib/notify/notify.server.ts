/**
 * Lógica de avisos de pedidos (solo servidor).
 * Envía notificaciones push, correo, WhatsApp y Alexa respetando el horario configurado.
 */
import { ApplicationServerKeys, generatePushHTTPRequest, setWebCrypto } from "webpush-webcrypto";
import { DEFAULT_SETTINGS, type CloudOrder, type NotifySettings } from "./types";

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
    email: s("email", ""),
    whatsappNumber: s("whatsapp_number", ""),
    alexaProvider: s("alexa_provider", "notifyme") === "voicemonkey" ? "voicemonkey" : "notifyme",
    alexaToken: s("alexa_token", ""),
    alexaDevice: s("alexa_device", ""),
    repeatEnabled: b("repeat_enabled", true),
    repeatMinutes: Number(row["repeat_minutes"] ?? 15) || 15,
    quietStart: s("quiet_start", "08:00"),
    quietEnd: s("quiet_end", "00:00"),
    autoOffMidnight: b("auto_off_midnight", true),
    timezone: s("timezone", "America/Monterrey"),
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
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })
    .format(Number.isFinite(n) ? n : 0);

export function orderTitle(order: CloudOrder, repeat: boolean) {
  return repeat ? "Pedido pendiente por atender" : "Tienes un pedido nuevo";
}

export function orderBody(order: CloudOrder) {
  const items = order.items?.length
    ? order.items.map((i) => i.name).join(", ")
    : order.serviceName;
  return `${order.catalogName}: ${items} · ${money(order.total)}`;
}

/* ---------------------------------- Push ----------------------------------- */

async function sendPush(order: CloudOrder, repeat: boolean) {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"] ?? "mailto:avisos@example.com";
  if (!publicKey || !privateKey) return "Faltan las llaves de notificación";

  setWebCrypto(globalThis.crypto);
  const db = await admin();
  const { data } = await db.from("push_subscriptions").select("*");
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
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  if (!settings.email) return "Falta el correo del administrador";
  if (!lovableKey || !resendKey) return "Correo no configurado (falta conectar Resend)";
  const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({
      from: "MA² Avisos <onboarding@resend.dev>",
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
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const twilioKey = process.env["TWILIO_API_KEY"];
  const from = process.env["TWILIO_FROM_NUMBER"];
  if (!settings.whatsappNumber) return "Falta el número de WhatsApp";
  if (!lovableKey || !twilioKey || !from) return "WhatsApp no configurado (falta conectar Twilio)";
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

async function sendAlexa(order: CloudOrder, settings: NotifySettings, repeat: boolean) {
  if (!settings.alexaToken) return "Falta el código de la skill de Alexa";
  const text = `${orderTitle(order, repeat)}. ${orderBody(order)}`;
  try {
    if (settings.alexaProvider === "voicemonkey") {
      const res = await fetch("https://api.voicemonkey.io/announcement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: settings.alexaToken,
          device: settings.alexaDevice,
          text,
        }),
      });
      if (!res.ok) return `Alexa falló [${res.status}]: ${await res.text()}`;
    } else {
      const res = await fetch("https://api.notifymyecho.com/v1/NotifyMe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notification: text,
          accessCode: settings.alexaToken,
          title: "Pedido MA²",
        }),
      });
      if (!res.ok) return `Alexa falló [${res.status}]: ${await res.text()}`;
    }
    return "Alexa avisada";
  } catch (error) {
    return `Alexa falló: ${String(error)}`;
  }
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
    items: Array.isArray(row["items"])
      ? (row["items"] as { name: string; price: number }[])
      : [],
    message: String(row["message"] ?? ""),
    link: String(row["link"] ?? ""),
    recipient: String(row["recipient"] ?? ""),
    status: row["status"] === "atendido" ? "atendido" : "nuevo",
    notifiedAt: (row["notified_at"] as string) ?? null,
    notifyAttempts: Number(row["notify_attempts"] ?? 0),
    attendedAt: (row["attended_at"] as string) ?? null,
  };
}

/** Envía el aviso por todos los canales activos y devuelve el detalle de cada uno. */
export async function notifyOrder(
  order: CloudOrder,
  settings: NotifySettings,
  repeat = false,
): Promise<string[]> {
  const results: string[] = [];
  if (settings.channelPush) results.push(`Push: ${await sendPush(order, repeat)}`);
  if (settings.channelEmail) results.push(`Correo: ${await sendEmail(order, settings, repeat)}`);
  if (settings.channelWhatsapp)
    results.push(`WhatsApp: ${await sendWhatsapp(order, settings, repeat)}`);
  if (settings.channelAlexa) results.push(`Alexa: ${await sendAlexa(order, settings, repeat)}`);
  if (!results.length) results.push("No hay canales activos");

  const db = await admin();
  await db
    .from("orders")
    .update({ notified_at: new Date().toISOString(), notify_attempts: order.notifyAttempts + 1 })
    .eq("id", order.id);

  return results;
}

/* ------------------------- Código de acceso admin --------------------------- */

const enc = new TextEncoder();

export async function hashCode(code: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 120_000 },
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

/** Verifica el código del administrador; si aún no existe, lo crea con el enviado. */
export async function requireAdminCode(code: string) {
  const trimmed = (code ?? "").trim();
  if (trimmed.length < 4) throw new Error("El código debe tener al menos 4 caracteres");
  const row = await loadSettingsRow();
  const hash = String(row?.["admin_code_hash"] ?? "");
  const salt = String(row?.["admin_code_salt"] ?? "");
  const db = await admin();
  if (!hash) {
    const newSalt = randomSalt();
    await db
      .from("notification_settings")
      .update({ admin_code_hash: await hashCode(trimmed, newSalt), admin_code_salt: newSalt })
      .eq("id", 1);
    return;
  }
  if ((await hashCode(trimmed, salt)) !== hash) throw new Error("Código incorrecto");
}
