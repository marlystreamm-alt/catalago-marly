import type { ProtectedDeliveryPrivate } from "./types";

type Row = Record<string, unknown>;
const CHANNEL = "protected_delivery";
const CONFIG_CHANNEL = "ma2_config";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function serverSecret() {
  const value = process.env["MA2_SESSION_SECRET"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!value) throw new Error("Falta la clave privada del servidor");
  return value;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}
function fromB64(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

async function encryptionKey() {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(serverSecret()));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptPayload(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = enc.encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), data);
  return `${b64(iv)}.${b64(new Uint8Array(cipher))}`;
}

export async function decryptPayload<T>(value: string): Promise<T> {
  const [ivRaw, cipherRaw] = value.split(".");
  if (!ivRaw || !cipherRaw) throw new Error("Entrega dañada");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(ivRaw) },
    await encryptionKey(),
    fromB64(cipherRaw),
  );
  return JSON.parse(dec.decode(plain)) as T;
}

export function randomToken() {
  return b64(crypto.getRandomValues(new Uint8Array(24)));
}

export async function requireAdminCode(code: string) {
  const { requireAdminCode } = await import("@/lib/notify/notify.server");
  await requireAdminCode(code);
}

export async function listDeliveryRows() {
  const db = await admin();
  const { data, error } = await db
    .from("notification_log")
    .select("*")
    .eq("channel", CHANNEL)
    .order("created_at", { ascending: false })
    .limit(250);
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

export async function getDeliveryRow(id: string) {
  const db = await admin();
  const { data, error } = await db
    .from("notification_log")
    .select("*")
    .eq("id", id)
    .eq("channel", CHANNEL)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Row | null) ?? null;
}

export async function saveDeliveryRow(id: string, payload: ProtectedDeliveryPrivate, status = payload.status) {
  const db = await admin();
  const detail = await encryptPayload(payload);
  const { error } = await db
    .from("notification_log")
    .update({ detail, status, attempt: payload.viewCount })
    .eq("id", id)
    .eq("channel", CHANNEL);
  if (error) throw new Error(error.message);
}

export async function insertDelivery(payload: ProtectedDeliveryPrivate) {
  const db = await admin();
  const detail = await encryptPayload(payload);
  const { data, error } = await db
    .from("notification_log")
    .insert({ channel: CHANNEL, kind: "delivery", attempt: 0, status: "active", detail })
    .select("id,created_at")
    .single();
  if (error) throw new Error(error.message);
  return { id: String(data.id), createdAt: String(data.created_at) };
}

export async function removeDeliveryRow(id: string) {
  const db = await admin();
  const { error } = await db.from("notification_log").delete().eq("id", id).eq("channel", CHANNEL);
  if (error) throw new Error(error.message);
}

export async function loadSaleEnabled() {
  const db = await admin();
  const { data, error } = await db
    .from("notification_log")
    .select("detail")
    .eq("channel", CONFIG_CHANNEL)
    .eq("kind", "protected_deliveries_sale")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return false;
  try {
    return (await decryptPayload<{ enabled: boolean }>(String(data.detail ?? ""))).enabled === true;
  } catch {
    return false;
  }
}

export async function saveSaleEnabled(enabled: boolean) {
  const db = await admin();
  const detail = await encryptPayload({ enabled, updatedAt: new Date().toISOString() });
  const { error } = await db.from("notification_log").insert({
    channel: CONFIG_CHANNEL,
    kind: "protected_deliveries_sale",
    attempt: 1,
    status: enabled ? "active" : "disabled",
    detail,
  });
  if (error) throw new Error(error.message);
}
