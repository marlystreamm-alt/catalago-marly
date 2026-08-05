/** Acceso a datos de las suscripciones de menús (solo servidor). */
import { computeStatus, daysUntil, todayISO, type Subscription } from "./types";

type Row = Record<string, unknown>;

interface DbResult {
  data: Row[] | null;
  error: { message: string } | null;
}

interface SingleResult {
  data: Row | null;
  error: { message: string } | null;
}

/** Constructor de consultas mínimo (las tablas se crean por migración). */
interface QueryBuilder extends PromiseLike<DbResult> {
  select: (columns?: string) => QueryBuilder;
  insert: (values: Row | Row[]) => QueryBuilder;
  update: (values: Row) => QueryBuilder;
  delete: () => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  neq: (column: string, value: unknown) => QueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
  limit: (count: number) => QueryBuilder;
  maybeSingle: () => PromiseLike<SingleResult>;
  single: () => PromiseLike<SingleResult>;
}

interface LooseDb {
  from: (table: string) => QueryBuilder;
}

/**
 * Cliente con permisos de servidor. Se usa sin tipos generados porque las tablas
 * de suscripciones se crean por migración y los tipos se regeneran después.
 */
export async function admin(): Promise<LooseDb> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as LooseDb;
}



export function rowToSub(row: Row): Subscription {
  const expiresOn = String(row["expires_on"] ?? "");
  const suspended = row["suspended"] === true;
  const today = todayISO();
  return {
    id: String(row["id"] ?? ""),
    businessName: String(row["business_name"] ?? ""),
    ownerName: String(row["owner_name"] ?? ""),
    whatsapp: String(row["whatsapp"] ?? ""),
    slug: String(row["slug"] ?? ""),
    catalogId: String(row["catalog_id"] ?? "clientes"),
    plan: String(row["plan"] ?? "mensual"),
    price: Number(row["price"] ?? 0),
    startedOn: String(row["started_on"] ?? ""),
    expiresOn,
    suspended,
    notes: String(row["notes"] ?? ""),
    createdAt: String(row["created_at"] ?? ""),
    status: computeStatus(expiresOn, suspended, today),
    daysLeft: daysUntil(expiresOn, today),
  };
}

export async function listSubs(): Promise<Subscription[]> {
  const db = await admin();
  const { data, error } = await db
    .from("menu_subscriptions")
    .select("*")
    .order("expires_on", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToSub(r as Row));
}

export async function getSubBySlug(slug: string): Promise<Subscription | null> {
  const db = await admin();
  const { data } = await db
    .from("menu_subscriptions")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return data ? rowToSub(data as Row) : null;
}

export async function addRenewal(entry: {
  subscriptionId: string;
  kind: string;
  previousExpires: string | null;
  newExpires: string | null;
  note?: string;
}) {
  const db = await admin();
  await db.from("subscription_renewals").insert({
    subscription_id: entry.subscriptionId,
    kind: entry.kind,
    previous_expires: entry.previousExpires,
    new_expires: entry.newExpires,
    note: entry.note ?? "",
  });
}
