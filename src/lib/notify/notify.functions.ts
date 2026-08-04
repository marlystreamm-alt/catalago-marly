/** Funciones de servidor del panel de avisos (protegidas con el código del administrador). */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DEFAULT_SETTINGS, type CloudOrder, type NotifySettings } from "./types";

const codeSchema = z.object({ code: z.string().min(4) });

const settingsSchema = codeSchema.extend({
  settings: z.object({
    enabled: z.boolean(),
    channelPush: z.boolean(),
    channelEmail: z.boolean(),
    channelWhatsapp: z.boolean(),
    channelAlexa: z.boolean(),
    email: z.string(),
    whatsappNumber: z.string(),
    alexaProvider: z.enum(["notifyme", "voicemonkey"]),
    alexaToken: z.string(),
    alexaDevice: z.string(),
    repeatEnabled: z.boolean(),
    repeatMinutes: z.number().int().min(5).max(240),
    quietStart: z.string(),
    quietEnd: z.string(),
    autoOffMidnight: z.boolean(),
    timezone: z.string(),
    escalateEnabled: z.boolean(),
    escalateMinutes: z.number().int().min(5).max(720),
    escalateChannel: z.enum(["push", "email", "whatsapp", "alexa"]),
  }),
});

/** ¿Ya hay un código de administrador creado? (público, no revela nada sensible) */
export const notifyStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { loadSettings } = await import("./notify.server");
  const settings = await loadSettings();
  return {
    hasCode: settings.hasCode,
    vapidPublicKey: process.env["VAPID_PUBLIC_KEY"] ?? "",
  };
});

/** Inicia sesión en el panel de avisos y devuelve la configuración actual. */
export const notifyLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => codeSchema.parse(d))
  .handler(async ({ data }): Promise<NotifySettings> => {
    const { requireAdminCode, loadSettings } = await import("./notify.server");
    await requireAdminCode(data.code);
    return { ...(await loadSettings()), hasCode: true };
  });

/** Guarda la configuración de avisos. */
export const notifySaveSettings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => settingsSchema.parse(d))
  .handler(async ({ data }): Promise<NotifySettings> => {
    const { requireAdminCode, admin, loadSettings } = await import("./notify.server");
    await requireAdminCode(data.code);
    const s = data.settings;
    const db = await admin();
    const { error } = await db
      .from("notification_settings")
      .update({
        enabled: s.enabled,
        channel_push: s.channelPush,
        channel_email: s.channelEmail,
        channel_whatsapp: s.channelWhatsapp,
        channel_alexa: s.channelAlexa,
        email: s.email,
        whatsapp_number: s.whatsappNumber,
        alexa_provider: s.alexaProvider,
        alexa_token: s.alexaToken,
        alexa_device: s.alexaDevice,
        repeat_enabled: s.repeatEnabled,
        repeat_minutes: s.repeatMinutes,
        quiet_start: s.quietStart,
        quiet_end: s.quietEnd,
        auto_off_midnight: s.autoOffMidnight,
        timezone: s.timezone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ...(await loadSettings()), hasCode: true };
  });

/** Cambia el código de acceso del panel de avisos. */
export const notifyChangeCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => codeSchema.extend({ newCode: z.string().min(4) }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdminCode, admin, hashCode, randomSalt } = await import("./notify.server");
    await requireAdminCode(data.code);
    const salt = randomSalt();
    const db = await admin();
    await db
      .from("notification_settings")
      .update({ admin_code_hash: await hashCode(data.newCode.trim(), salt), admin_code_salt: salt })
      .eq("id", 1);
    return { ok: true };
  });

/** Lista los pedidos recibidos. */
export const notifyListOrders = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    codeSchema.extend({ onlyNew: z.boolean().default(false) }).parse(d),
  )
  .handler(async ({ data }): Promise<CloudOrder[]> => {
    const { requireAdminCode, admin, rowToOrder } = await import("./notify.server");
    await requireAdminCode(data.code);
    const db = await admin();
    let query = db.from("orders").select("*").order("created_at", { ascending: false }).limit(100);
    if (data.onlyNew) query = query.eq("status", "nuevo");
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => rowToOrder(r as Record<string, unknown>));
  });

/** Marca un pedido como atendido (o lo regresa a pendiente). */
export const notifySetOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    codeSchema.extend({ id: z.string().uuid(), status: z.enum(["nuevo", "atendido"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireAdminCode, admin } = await import("./notify.server");
    await requireAdminCode(data.code);
    const db = await admin();
    const { error } = await db
      .from("orders")
      .update({
        status: data.status,
        attended_at: data.status === "atendido" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Registra el dispositivo actual para recibir notificaciones push. */
export const notifySavePush = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    codeSchema.extend({
      endpoint: z.string().url(),
      p256dh: z.string().min(1),
      auth: z.string().min(1),
      label: z.string().default(""),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireAdminCode, admin } = await import("./notify.server");
    await requireAdminCode(data.code);
    const db = await admin();
    const { error } = await db
      .from("push_subscriptions")
      .upsert(
        { endpoint: data.endpoint, p256dh: data.p256dh, auth: data.auth, label: data.label },
        { onConflict: "endpoint" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Envía un aviso de prueba por los canales activos. */
export const notifyTest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => codeSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAdminCode, loadSettings, notifyOrder, withinSchedule } = await import(
      "./notify.server"
    );
    await requireAdminCode(data.code);
    const settings = await loadSettings();
    const demo: CloudOrder = {
      id: "00000000-0000-0000-0000-000000000000",
      createdAt: new Date().toISOString(),
      catalogId: "prueba",
      catalogName: "Prueba",
      serviceName: "Aviso de prueba",
      total: 0,
      items: [{ name: "Aviso de prueba", price: 0 }],
      message: "Este es un aviso de prueba de MA².",
      link: "",
      recipient: "",
      status: "nuevo",
      notifiedAt: null,
      notifyAttempts: 0,
      attendedAt: null,
    };
    const results: string[] = [];
    if (!withinSchedule(settings))
      results.push("Aviso: estás fuera del horario configurado (se envió de todos modos)");
    // No se actualiza ningún pedido real: se envía directamente por canal.
    const detail = await notifyOrder(demo, settings, false).catch((e: unknown) => [String(e)]);
    return { results: [...results, ...detail] };
  });

export const NOTIFY_DEFAULTS = DEFAULT_SETTINGS;
