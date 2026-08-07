/** Acceso a datos de los catálogos de clientes (solo servidor). */
import {
  DEFAULT_FEATURES,
  businessStatus,
  type FeatureKey,
  type Features,
  type MenuBusiness,
  type MenuCategory,
  type MenuItem,
} from "./types";

type Row = Record<string, unknown>;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const num = (v: unknown, d = 0) => (typeof v === "number" ? v : Number(v ?? d) || d);
const bool = (v: unknown, d = true) => (typeof v === "boolean" ? v : d);

export function parseFeatures(v: unknown): Features {
  const out = { ...DEFAULT_FEATURES };
  if (v && typeof v === "object") {
    for (const key of Object.keys(out) as FeatureKey[]) {
      const raw = (v as Record<string, unknown>)[key];
      if (typeof raw === "boolean") out[key] = raw;
    }
  }
  return out;
}

export function rowToBusiness(row: Row): MenuBusiness {
  return {
    id: str(row["id"]),
    slug: str(row["slug"]),
    name: str(row["name"]),
    ownerName: str(row["owner_name"]),
    whatsapp: str(row["whatsapp"]),
    address: str(row["address"]),
    notes: str(row["notes"]),
    active: bool(row["active"]),
    sortIndex: num(row["sort_index"]),
    logoUrl: str(row["logo_url"]),
    expiresOn: row["expires_on"] ? str(row["expires_on"]) : null,
    features: parseFeatures(row["features"]),
    hasAccess: Boolean(str(row["access_hash"])),
    accessTemp: bool(row["access_temp"], true),
    accessSuspended: bool(row["access_suspended"], false),
    accessUpdatedAt: row["access_updated_at"] ? str(row["access_updated_at"]) : null,
    multiAdmin: bool(row["multi_admin"], false),
  };
}

export function rowToCategory(row: Row): MenuCategory {
  return {
    id: str(row["id"]),
    businessId: str(row["business_id"]),
    name: str(row["name"]),
    sortIndex: num(row["sort_index"]),
  };
}

export function rowToItem(row: Row): MenuItem {
  const cat = str(row["category_id"]);
  return {
    id: str(row["id"]),
    businessId: str(row["business_id"]),
    categoryId: cat || null,
    name: str(row["name"]),
    description: str(row["description"]),
    price: num(row["price"]),
    priceText: str(row["price_text"]),
    imageUrl: str(row["image_url"]),
    available: bool(row["available"]),
    sortIndex: num(row["sort_index"]),
  };
}

export async function listBusinesses(): Promise<MenuBusiness[]> {
  const db = await admin();
  const { data, error } = await db
    .from("menu_businesses")
    .select("*")
    .order("sort_index", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToBusiness(r as Row));
}

/** Cuántas categorías y productos tiene cada negocio (para el panel de ventas). */
export async function countsByBusiness(): Promise<Record<string, { cats: number; items: number }>> {
  const db = await admin();
  const [cats, items] = await Promise.all([
    db.from("menu_categories").select("business_id"),
    db.from("menu_items").select("business_id"),
  ]);
  const out: Record<string, { cats: number; items: number }> = {};
  const bump = (id: string, key: "cats" | "items") => {
    out[id] = out[id] ?? { cats: 0, items: 0 };
    out[id][key] += 1;
  };
  for (const r of cats.data ?? []) bump(str((r as Row)["business_id"]), "cats");
  for (const r of items.data ?? []) bump(str((r as Row)["business_id"]), "items");
  return out;
}

export async function loadMenu(businessId: string) {
  const db = await admin();

  const [biz, cats, items] = await Promise.all([
    db.from("menu_businesses").select("*").eq("id", businessId).maybeSingle(),
    db
      .from("menu_categories")
      .select("*")
      .eq("business_id", businessId)
      .order("sort_index", { ascending: true }),
    db
      .from("menu_items")
      .select("*")
      .eq("business_id", businessId)
      .order("sort_index", { ascending: true }),
  ]);
  if (!biz.data) throw new Error("Negocio no encontrado");
  return {
    business: rowToBusiness(biz.data as Row),
    categories: (cats.data ?? []).map((r) => rowToCategory(r as Row)),
    items: (items.data ?? []).map((r) => rowToItem(r as Row)),
  };
}

/** Catálogo público de un negocio por su enlace (slug), respetando sus interruptores. */
export async function loadPublicMenu(slug: string) {
  const db = await admin();
  const { data: biz } = await db
    .from("menu_businesses")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!biz) return null;
  const business = rowToBusiness(biz as Row);
  if (businessStatus(business) !== "activo") return null;

  const f = business.features;
  const [cats, items] = await Promise.all([
    db
      .from("menu_categories")
      .select("*")
      .eq("business_id", business.id)
      .order("sort_index", { ascending: true }),
    db
      .from("menu_items")
      .select("*")
      .eq("business_id", business.id)
      .eq("available", true)
      .order("sort_index", { ascending: true }),
  ]);
  return {
    business: {
      ...business,
      notes: "",
      address: f.show_address ? business.address : "",
      whatsapp: f.show_whatsapp ? business.whatsapp : "",
      accessTemp: false,
      accessSuspended: false,
      accessUpdatedAt: null,
      hasAccess: false,
    },
    categories: (cats.data ?? []).map((r) => rowToCategory(r as Row)),
    items: (items.data ?? []).map((r) => {
      const it = rowToItem(r as Row);
      return {
        ...it,
        price: f.show_prices ? it.price : 0,
        priceText: f.show_prices ? it.priceText : "",
        description: f.show_descriptions ? it.description : "",
        imageUrl: f.show_photos ? it.imageUrl : "",
      };
    }),
  };
}

/* ------------------------- Acceso del dueño (clientes) ------------------------ */

const enc = new TextEncoder();
const MAX_ITER = 100_000;

export async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: MAX_ITER },
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

/** Contraseña temporal legible para mandársela al dueño. */
export function tempPassword() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes).map((b) => abc[b % abc.length]);
  return `MA2-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

function secret() {
  return (
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_URL"] ?? "ma2-fallback-secret"
  );
}

async function sign(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Token firmado con el id del negocio y quién entró; el navegador nunca decide la sesión. */
export async function makeOwnerToken(businessId: string, actorName = "Dueño") {
  const clean = actorName.replace(/[~.]/g, " ").trim() || "Dueño";
  const payload = `${businessId}~${encodeURIComponent(clean)}~${Date.now() + 1000 * 60 * 60 * 24 * 30}`;
  return `${payload}.${await sign(payload)}`;
}

export async function readOwnerToken(
  token: string,
): Promise<{ id: string; actor: string; kind: "dueno" | "equipo" }> {
  const raw = token ?? "";
  const cut = raw.lastIndexOf(".");
  if (cut < 1) throw new Error("Sesión no válida, vuelve a entrar");
  const payload = raw.slice(0, cut);
  const sig = raw.slice(cut + 1);
  if ((await sign(payload)) !== sig) throw new Error("Sesión no válida, vuelve a entrar");
  const parts = payload.split("~");
  const id = parts[0] ?? "";
  const actor = parts.length === 3 ? decodeURIComponent(parts[1] ?? "") : "Dueño";
  const exp = parts.length === 3 ? parts[2] : payload.split(".")[1];
  if (!id || Number(exp) < Date.now()) throw new Error("Tu sesión expiró, vuelve a entrar");
  const kind = actor.startsWith("equipo:") ? "equipo" : "dueno";
  const name = actor.replace(/^(equipo|dueno):/, "");
  return { id, actor: name || "Dueño", kind };
}

/** Carga el negocio del dueño validando token, estado y vencimiento. */
export async function requireOwnerCtx(
  token: string,
): Promise<{ business: MenuBusiness; actor: string; kind: "dueno" | "equipo" }> {
  const { id, actor, kind } = await readOwnerToken(token);
  const db = await admin();
  const { data } = await db.from("menu_businesses").select("*").eq("id", id).maybeSingle();
  if (!data) throw new Error("Negocio no encontrado");
  const business = rowToBusiness(data as Row);
  if (business.accessSuspended) throw new Error("Tu acceso está suspendido");
  const status = businessStatus(business);
  if (status === "apagado") throw new Error("Tu catálogo está apagado");
  if (status === "vencido") throw new Error("Tu acceso venció");
  return { business, actor, kind };
}

export async function requireOwner(token: string): Promise<MenuBusiness> {
  return (await requireOwnerCtx(token)).business;
}

export function requireFeature(business: MenuBusiness, key: FeatureKey) {
  if (!business.features[key]) throw new Error("No tienes ese permiso autorizado");
}

/** Valida contraseña del dueño (o de un administrador adicional) y devuelve su token. */
export async function ownerLogin(slug: string, password: string) {
  const db = await admin();
  const { data } = await db
    .from("menu_businesses")
    .select("*")
    .eq("slug", slug.trim().toLowerCase())
    .maybeSingle();
  if (!data) throw new Error("Negocio o contraseña incorrectos");
  const business = rowToBusiness(data as Row);
  const salt = str((data as Row)["access_salt"]);
  const hash = str((data as Row)["access_hash"]);

  let actor = business.ownerName || "Dueño";
  let temp = business.accessTemp;
  let adminId: string | null = null;
  let matched = Boolean(hash && salt) && (await hashPassword(password, salt)) === hash;

  if (!matched && business.multiAdmin) {
    const { data: admins } = await db.from("menu_admins").select("*").eq("business_id", business.id);
    for (const row of admins ?? []) {
      const r = row as Row;
      const s = str(r["access_salt"]);
      const h = str(r["access_hash"]);
      if (!s || !h) continue;
      if ((await hashPassword(password, s)) !== h) continue;
      if (bool(r["suspended"], false)) throw new Error("Tu acceso está suspendido");
      matched = true;
      adminId = str(r["id"]);
      actor = str(r["name"]) || "Administrador";
      temp = bool(r["access_temp"], true);
      break;
    }
  }

  if (!matched) {
    if (!hash || !salt) throw new Error("Este negocio todavía no tiene contraseña asignada");
    throw new Error("Negocio o contraseña incorrectos");
  }
  if (!adminId && business.accessSuspended) throw new Error("Tu acceso está suspendido");
  const status = businessStatus(business);
  if (status !== "activo")
    throw new Error(status === "vencido" ? "Tu acceso venció" : "Tu catálogo está apagado");

  if (adminId)
    await db.from("menu_admins").update({ last_login_at: new Date().toISOString() }).eq("id", adminId);

  await logAudit({
    businessId: business.id,
    actorKind: adminId ? "equipo" : "dueno",
    actorName: actor,
    action: "acceso",
    target: "Sesión",
    field: "Entró al panel",
  });

  return {
    token: await makeOwnerToken(business.id, `${adminId ? "equipo" : "dueno"}:${actor}`),
    business,
    mustChange: temp,
    adminId,
  };
}

/* ------------------------------- Bitácora ------------------------------- */

export async function logAudit(entry: {
  businessId: string;
  actorKind: "dueno" | "admin" | "equipo";
  actorName: string;
  action: string;
  target: string;
  field?: string;
  before?: string | number | boolean;
  after?: string | number | boolean;
}) {
  const db = await admin();
  await db.from("menu_audit").insert({
    business_id: entry.businessId,
    actor_kind: entry.actorKind,
    actor_name: entry.actorName.slice(0, 80),
    action: entry.action,
    target: entry.target.slice(0, 120),
    field: entry.field ?? "",
    before_value: entry.before === undefined ? "" : String(entry.before),
    after_value: entry.after === undefined ? "" : String(entry.after),
  });
}

export async function listAudit(businessId: string, limit = 200) {
  const db = await admin();
  const { data, error } = await db
    .from("menu_audit")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const row = r as Row;
    return {
      id: str(row["id"]),
      businessId: str(row["business_id"]),
      actorKind: str(row["actor_kind"], "dueno") as "dueno" | "admin" | "equipo",
      actorName: str(row["actor_name"]),
      action: str(row["action"]),
      target: str(row["target"]),
      field: str(row["field"]),
      before: str(row["before_value"]),
      after: str(row["after_value"]),
      createdAt: str(row["created_at"]),
    };
  });
}

