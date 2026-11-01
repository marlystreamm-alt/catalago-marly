import { encryptPayload, decryptPayload } from "@/lib/deliveries/deliveries.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Module, OpsRecord, Payload } from "./model";
export const opsDB = () => supabaseAdmin as any;
export async function readRecords(module?: Module): Promise<OpsRecord[]> {
  const db = opsDB();
  const rows: any[] = [];
  for (let start = 0; ; start += 500) {
    let q = db
      .from("ma2_ops_records")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .order("id");
    if (module) q = q.eq("module", module);
    const { data, error } = await q.range(start, start + 499);
    if (error) throw new Error("No se pudieron cargar los registros");
    rows.push(...(data || []));
    if ((data || []).length < 500) break;
  }
  return Promise.all(rows.map(decode));
}
export async function decode(row: any): Promise<OpsRecord> {
  return {
    id: row.id,
    module: row.module,
    title: row.title,
    status: row.status,
    data: await decryptPayload<Payload>(row.payload_cipher),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export async function readRecord(id: string) {
  const { data, error } = await opsDB()
    .from("ma2_ops_records")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error || !data) throw new Error("Registro no disponible");
  return decode(data);
}
export async function createRecord(module: Module, title: string, status: string, data: Payload) {
  const { data: row, error } = await opsDB()
    .from("ma2_ops_records")
    .insert({ module, title, status, payload_cipher: await encryptPayload(data) })
    .select("*")
    .single();
  if (error) throw new Error("No se pudo guardar el registro");
  return decode(row);
}
export async function changeRecord(
  record: OpsRecord,
  patch: { title?: string; status?: string; data?: Payload; archived_at?: string },
) {
  const payload: any = {
    title: patch.title ?? record.title,
    status: patch.status ?? record.status,
    payload_cipher: await encryptPayload(patch.data ?? record.data),
    version: record.version + 1,
    updated_at: new Date().toISOString(),
    ...(patch.archived_at ? { archived_at: patch.archived_at } : {}),
  };
  const { data, error } = await opsDB()
    .from("ma2_ops_records")
    .update(payload)
    .eq("id", record.id)
    .eq("version", record.version)
    .is("archived_at", null)
    .select("*")
    .maybeSingle();
  if (error || !data)
    throw new Error("El registro cambió en otro dispositivo. Actualiza antes de guardar.");
  return decode(data);
}
export async function walletEntries(clientId?: string) {
  let q = opsDB()
    .from("ma2_wallet_entries")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id");
  if (clientId) q = q.eq("client_id", clientId);
  const rows: any[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await q.range(start, start + 999);
    if (error) throw new Error("No se pudo cargar el saldo");
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows as {
    id: string;
    client_id: string;
    amount_cents: number;
    kind: string;
    note: string;
    created_at: string;
  }[];
}
export function totals(entries: Awaited<ReturnType<typeof walletEntries>>) {
  const cents = entries.reduce(
    (a, r) => {
      a[r.kind === "credit" || r.kind === "repayment" ? "debt" : "balance"] += Number(
        r.amount_cents,
      );
      return a;
    },
    { balance: 0, debt: 0 },
  );
  return { balance: cents.balance / 100, debt: cents.debt / 100 };
}
export async function hashToken(token: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export async function portalClient(id: string, token: string) {
  const client = await readRecord(id);
  if (
    client.module !== "clients" ||
    client.status !== "active" ||
    !client.data.portalHash ||
    client.data.portalHash !== (await hashToken(token))
  )
    throw new Error("Enlace de cliente no disponible");
  return client;
}
