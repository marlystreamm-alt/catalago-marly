/** Acceso a datos de los catálogos de clientes (solo servidor). */
import {
  DEFAULT_FEATURES,
  businessStatus,
  type FeatureKey,
  type Features,
  type MenuBackup,
  type MenuBackupVersion,
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
  const { data: biz } = await db.from("menu_businesses").select("*").eq("slug", slug).maybeSingle();
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
): Promise<{ id: string; actor: string; kind: "dueno" | "equipo"; adminId: string }> {
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
  const rest = actor.replace(/^(equipo|dueno):/, "");
  const [adminId = "", ...nameParts] = kind === "equipo" ? rest.split(":") : ["", rest];
  const name = kind === "equipo" ? nameParts.join(":") : rest;
  return { id, actor: name || "Dueño", kind, adminId };
}

/** Carga el negocio del dueño validando token, estado y vencimiento. */
export async function requireOwnerCtx(token: string): Promise<{
  business: MenuBusiness;
  actor: string;
  kind: "dueno" | "equipo";
  adminId: string;
}> {
  const { id, actor, kind, adminId } = await readOwnerToken(token);
  const db = await admin();
  const { data } = await db.from("menu_businesses").select("*").eq("id", id).maybeSingle();
  if (!data) throw new Error("Negocio no encontrado");
  const business = rowToBusiness(data as Row);
  if (business.accessSuspended) throw new Error("Tu acceso está suspendido");
  const status = businessStatus(business);
  if (status === "apagado") throw new Error("Tu catálogo está apagado");
  if (status === "vencido") throw new Error("Tu acceso venció");
  if (kind === "equipo") {
    if (!business.multiAdmin) throw new Error("Tu acceso está suspendido");
    const { data: row } = await db
      .from("menu_admins")
      .select("suspended")
      .eq("id", adminId)
      .maybeSingle();
    if (!row || bool((row as Row)["suspended"], false))
      throw new Error("Tu acceso está suspendido");
  }
  return { business, actor, kind, adminId };
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
    const { data: admins } = await db
      .from("menu_admins")
      .select("*")
      .eq("business_id", business.id);
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
    await db
      .from("menu_admins")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", adminId);

  await logAudit({
    businessId: business.id,
    actorKind: adminId ? "equipo" : "dueno",
    actorName: actor,
    action: "acceso",
    target: "Sesión",
    field: "Entró al panel",
  });

  return {
    token: await makeOwnerToken(
      business.id,
      adminId ? `equipo:${adminId}:${actor}` : `dueno:${actor}`,
    ),
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

/* --------------------------- Respaldos versionados --------------------------- */

/** Arma el respaldo JSON del catálogo tal como está ahora. */
export async function buildBackup(businessId: string): Promise<MenuBackup> {
  const { business, categories, items } = await loadMenu(businessId);
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  return {
    kind: "ma2-menu-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    business: {
      name: business.name,
      ownerName: business.ownerName,
      whatsapp: business.whatsapp,
      address: business.address,
      logoUrl: business.logoUrl,
      notes: business.notes,
    },
    categories: categories.map((c) => ({ name: c.name, sortIndex: c.sortIndex })),
    items: items.map((i) => ({
      category: i.categoryId ? (catName.get(i.categoryId) ?? null) : null,
      name: i.name,
      description: i.description,
      price: i.price,
      priceText: i.priceText,
      imageUrl: i.imageUrl,
      available: i.available,
      sortIndex: i.sortIndex,
    })),
  };
}

function rowToBackupVersion(row: Row): MenuBackupVersion {
  return {
    id: str(row["id"]),
    businessId: str(row["business_id"]),
    version: num(row["version"], 1),
    origin: str(row["origin"], "export") as MenuBackupVersion["origin"],
    label: str(row["label"]),
    actorKind: str(row["actor_kind"], "admin") as MenuBackupVersion["actorKind"],
    actorName: str(row["actor_name"]),
    categoriesCount: num(row["categories_count"]),
    itemsCount: num(row["items_count"]),
    createdAt: str(row["created_at"]),
  };
}

/** Guarda una versión del respaldo y devuelve su ficha (sin el contenido). */
export async function saveBackupVersion(input: {
  businessId: string;
  origin: MenuBackupVersion["origin"];
  label: string;
  actorKind: MenuBackupVersion["actorKind"];
  actorName: string;
  payload: MenuBackup;
}): Promise<MenuBackupVersion> {
  const db = await admin();
  const { data: last } = await db
    .from("menu_backups")
    .select("version")
    .eq("business_id", input.businessId)
    .order("version", { ascending: false })
    .limit(1);
  const version = num((last?.[0] as Row | undefined)?.["version"], 0) + 1;
  const { data, error } = await db
    .from("menu_backups")
    .insert({
      business_id: input.businessId,
      version,
      origin: input.origin,
      label: input.label.slice(0, 160),
      actor_kind: input.actorKind,
      actor_name: input.actorName.slice(0, 80),
      categories_count: input.payload.categories.length,
      items_count: input.payload.items.length,
      payload: JSON.parse(JSON.stringify(input.payload)) as never,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowToBackupVersion(data as Row);
}

/** Versiones guardadas de un negocio, de la más reciente a la más vieja. */
export async function listBackups(businessId: string, limit = 50): Promise<MenuBackupVersion[]> {
  const db = await admin();
  const { data, error } = await db
    .from("menu_backups")
    .select(
      "id,business_id,version,origin,label,actor_kind,actor_name,categories_count,items_count,created_at",
    )
    .eq("business_id", businessId)
    .order("version", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToBackupVersion(r as Row));
}

/** Contenido completo de una versión guardada. */
export async function getBackupPayload(id: string, businessId: string): Promise<MenuBackup> {
  const db = await admin();
  const { data, error } = await db
    .from("menu_backups")
    .select("payload,business_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || str((data as Row)["business_id"]) !== businessId)
    throw new Error("Esa versión no pertenece a este negocio");
  return (data as Row)["payload"] as unknown as MenuBackup;
}

/** Resumen legible de qué campos cambiaron al restaurar. */
export function diffBackups(before: MenuBackup, after: MenuBackup) {
  const prev = new Map(before.items.map((i) => [i.name.toLowerCase(), i]));
  const counters = { precio: 0, descripcion: 0, foto: 0, disponibilidad: 0, categoria: 0 };
  let nuevos = 0;
  for (const it of after.items) {
    const old = prev.get(it.name.toLowerCase());
    if (!old) {
      nuevos += 1;
      continue;
    }
    if (old.price !== it.price || old.priceText !== it.priceText) counters.precio += 1;
    if (old.description !== it.description) counters.descripcion += 1;
    if (old.imageUrl !== it.imageUrl) counters.foto += 1;
    if (old.available !== it.available) counters.disponibilidad += 1;
    if ((old.category ?? "") !== (it.category ?? "")) counters.categoria += 1;
    prev.delete(it.name.toLowerCase());
  }
  const eliminados = prev.size;
  const partes = Object.entries(counters)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}: ${n}`);
  if (nuevos) partes.push(`nuevos: ${nuevos}`);
  if (eliminados) partes.push(`quitados: ${eliminados}`);
  return {
    ...counters,
    nuevos,
    eliminados,
    resumen: partes.length ? partes.join(" · ") : "sin cambios",
  };
}

/**
 * Aplica un respaldo a un negocio: guarda antes una versión automática,
 * registra en la bitácora el origen, el resultado y qué campos se reemplazaron.
 */
export async function applyBackup(input: {
  businessId: string;
  backup: MenuBackup;
  replace: boolean;
  origin: string;
  actorKind: "dueno" | "admin" | "equipo";
  actorName: string;
}): Promise<{ categories: number; items: number; resumen: string; snapshotVersion: number }> {
  const db = await admin();
  const bid = input.businessId;
  const before = await buildBackup(bid);
  const snapshot = await saveBackupVersion({
    businessId: bid,
    origin: "auto",
    label: `Respaldo automático antes de ${input.origin}`,
    actorKind: input.actorKind,
    actorName: input.actorName,
    payload: before,
  });

  if (input.replace) {
    await db.from("menu_items").delete().eq("business_id", bid);
    await db.from("menu_categories").delete().eq("business_id", bid);
  }

  const catId = new Map<string, string>();
  if (!input.replace) {
    const { data: existing } = await db
      .from("menu_categories")
      .select("id,name")
      .eq("business_id", bid);
    for (const r of existing ?? []) {
      const row = r as { id: string; name: string };
      catId.set(row.name, row.id);
    }
  }
  for (const c of input.backup.categories) {
    if (catId.has(c.name)) continue;
    const { data: row, error } = await db
      .from("menu_categories")
      .insert({ business_id: bid, name: c.name, sort_index: c.sortIndex })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    catId.set(c.name, (row as { id: string }).id);
  }

  if (input.backup.items.length) {
    const { error } = await db.from("menu_items").insert(
      input.backup.items.map((i) => ({
        business_id: bid,
        category_id: i.category ? (catId.get(i.category) ?? null) : null,
        name: i.name,
        description: i.description,
        price: i.price,
        price_text: i.priceText,
        image_url: i.imageUrl,
        available: i.available,
        sort_index: i.sortIndex,
      })),
    );
    if (error) throw new Error(error.message);
  }

  const diff = diffBackups(before, input.backup);
  await logAudit({
    businessId: bid,
    actorKind: input.actorKind,
    actorName: input.actorName,
    action: "respaldo",
    target: "Catálogo",
    field: `${input.replace ? "Restauró reemplazando todo" : "Importó agregando"} · origen: ${input.origin} · respaldo previo v${snapshot.version}`,
    before: `${before.items.length} productos, ${before.categories.length} categorías`,
    after: `${input.backup.items.length} productos, ${input.backup.categories.length} categorías · campos reemplazados → ${diff.resumen}`,
  });

  return {
    categories: input.backup.categories.length,
    items: input.backup.items.length,
    resumen: diff.resumen,
    snapshotVersion: snapshot.version,
  };
}
