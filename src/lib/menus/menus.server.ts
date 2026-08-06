/** Acceso a datos del apartado Menús (solo servidor, con clave de administrador). */
import type { MenuBusiness, MenuCategory, MenuItem } from "./types";

type Row = Record<string, unknown>;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const num = (v: unknown, d = 0) => (typeof v === "number" ? v : Number(v ?? d) || d);
const bool = (v: unknown, d = true) => (typeof v === "boolean" ? v : d);

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
