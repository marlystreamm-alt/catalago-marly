import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  rechargeSettings,
  paymentDetails,
  type RechargeSettings,
  type RechargeRequest,
  type RechargeEvent,
} from "./settings";
import { parseBankNotice } from "./parser";
const auth = z.object({ code: z.string().min(4).max(200) });
const portal = z.object({ id: z.string().uuid(), token: z.string().min(60).max(100) });
async function gate(code: string) {
  await (await import("@/lib/notify/notify.server")).requireAdminCode(code);
  return import("@/lib/workspace/operations.server");
}
export const rechargeAdminLoad = createServerFn({ method: "POST" })
  .validator((v: unknown) => auth.parse(v))
  .handler(async ({ data }) => {
    const s = await gate(data.code);
    const m = await import("./mail.server");
    const cfg = await m.readConfig();
    const [requests, events] = await Promise.all([
      s
        .opsDB()
        .from("ma2_recharge_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300),
      s
        .opsDB()
        .from("ma2_recharge_events")
        .select("id,received_at,amount_cents,reference,status,reason,verified,request_id")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    if (requests.error || events.error) throw new Error("No se pudieron cargar las recargas");
    return {
      settings: (cfg?.settings || null) as RechargeSettings | null,
      version: cfg?.version || 0,
      hasPassword: Boolean(cfg?.password_cipher),
      tested: Boolean(
        cfg?.tested_signature &&
        cfg.tested_signature === (await m.signature(cfg.settings, cfg.password_cipher)),
      ),
      lastCheck: cfg?.last_check as string | null,
      lastError: cfg?.last_error as string | null,
      requests: (requests.data || []) as RechargeRequest[],
      events: (events.data || []) as RechargeEvent[],
    };
  });
export const rechargeSave = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    auth
      .extend({
        settings: rechargeSettings,
        password: z.string().max(100).default(""),
        version: z.number().int().min(0),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const s = await gate(data.code);
    const m = await import("./mail.server");
    const old = await m.readConfig();
    if ((old?.version || 0) !== data.version)
      throw new Error("La configuración cambió. Actualiza antes de guardar.");
    const cipher = data.password.trim()
      ? await (
          await import("@/lib/deliveries/deliveries.server")
        ).encryptPayload({ password: data.password.replace(/\s/g, "") })
      : old?.password_cipher || "";
    if (!cipher) throw new Error("Escribe la contraseña de aplicación de Gmail");
    const sig = await m.signature(data.settings, cipher);
    if (data.settings.enabled && sig !== old?.tested_signature)
      throw new Error("Guarda con las recargas apagadas y prueba la conexión antes de activar");
    const identityChanged = !old || sig !== (await m.signature(old.settings, old.password_cipher));
    const payload = {
      id: 1,
      settings: data.settings,
      password_cipher: cipher,
      version: data.version + 1,
      ...(identityChanged
        ? {
            started_at: new Date().toISOString(),
            last_uid: 0,
            uid_validity: "",
            tested_signature: null,
          }
        : {}),
      last_error: null,
    };
    const result = old
      ? await s
          .opsDB()
          .from("ma2_recharge_config")
          .update(payload)
          .eq("id", 1)
          .eq("version", data.version)
          .select("id")
          .maybeSingle()
      : await s.opsDB().from("ma2_recharge_config").insert(payload).select("id").single();
    if (result.error || !result.data)
      throw new Error("No se pudo guardar. Actualiza antes de intentar de nuevo.");
    return { ok: true };
  });
export const rechargeTestConnection = createServerFn({ method: "POST" })
  .validator((v: unknown) => auth.parse(v))
  .handler(async ({ data }) => {
    const s = await gate(data.code);
    const m = await import("./mail.server");
    const row = await m.readConfig();
    if (!row?.password_cipher)
      throw new Error("Guarda primero el correo y su contraseña de aplicación");
    await m.testMailbox(row);
    const { data: updated, error } = await s
      .opsDB()
      .from("ma2_recharge_config")
      .update({
        tested_signature: await m.signature(row.settings, row.password_cipher),
        last_error: null,
      })
      .eq("id", 1)
      .eq("version", row.version)
      .select("id")
      .maybeSingle();
    if (error || !updated) throw new Error("La configuración cambió. Vuelve a probar la conexión.");
    return { ok: true };
  });
export const rechargeScan = createServerFn({ method: "POST" })
  .validator((v: unknown) => auth.parse(v))
  .handler(async ({ data }) => {
    await gate(data.code);
    return (await import("./mail.server")).scanRechargeMail();
  });
export const rechargeParseTest = createServerFn({ method: "POST" })
  .validator((v: unknown) => auth.extend({ text: z.string().max(30000) }).parse(v))
  .handler(async ({ data }) => {
    await gate(data.code);
    return parseBankNotice(data.text);
  });
export const rechargeRetry = createServerFn({ method: "POST" })
  .validator((v: unknown) => auth.extend({ eventId: z.string().uuid() }).parse(v))
  .handler(async ({ data }) => {
    const s = await gate(data.code);
    const r = await s.opsDB().rpc("ma2_recharge_settle", { p_event: data.eventId });
    if (r.error) throw new Error("No se pudo reprocesar el aviso");
    return { status: String(r.data) };
  });
export const rechargePortalLoad = createServerFn({ method: "POST" })
  .validator((v: unknown) => portal.parse(v))
  .handler(async ({ data }) => {
    const s = await import("@/lib/workspace/operations.server");
    await s.portalClient(data.id, data.token);
    const cfg = await (await import("./mail.server")).readConfig();
    const result = await s
      .opsDB()
      .from("ma2_recharge_requests")
      .select("*")
      .eq("client_id", data.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (result.error) throw new Error("No se pudieron cargar tus referencias");
    return {
      settings: cfg ? paymentDetails(cfg.settings) : null,
      requests: (result.data || []) as RechargeRequest[],
    };
  });
export const rechargeCreate = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    portal.extend({ amount: z.number().int().positive().max(1000000) }).parse(v),
  )
  .handler(async ({ data }) => {
    const s = await import("@/lib/workspace/operations.server");
    await s.portalClient(data.id, data.token);
    const r = await s
      .opsDB()
      .rpc("ma2_recharge_create", { p_client: data.id, p_amount: data.amount * 100 });
    if (r.error)
      throw new Error(
        /l[ií]mite|referencias|Importe|recargas|centavos/i.test(r.error.message)
          ? r.error.message
          : "No se pudo generar la referencia",
      );
    return r.data as RechargeRequest;
  });
export const rechargeCancel = createServerFn({ method: "POST" })
  .validator((v: unknown) => portal.extend({ requestId: z.string().uuid() }).parse(v))
  .handler(async ({ data }) => {
    const s = await import("@/lib/workspace/operations.server");
    await s.portalClient(data.id, data.token);
    const r = await s
      .opsDB()
      .from("ma2_recharge_requests")
      .update({ status: "cancelled" })
      .eq("id", data.requestId)
      .eq("client_id", data.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (r.error || !r.data)
      throw new Error("La referencia ya cambió. Actualiza antes de continuar.");
    return { ok: true };
  });
