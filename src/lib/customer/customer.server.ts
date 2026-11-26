import { getCookie, setCookie, deleteCookie, getRequestHeader } from "@tanstack/react-start/server";
import { opsDB, hashToken, readRecord, readRecords } from "@/lib/workspace/operations.server";
const COOKIE = "ma2_customer_session";
export async function customerShop(slug: string) {
  if (slug === "ma2") {
    const cfg = (await readRecords("config")).find((r) => r.status === "active");
    const support = [cfg?.data.whatsapp, "528443852364"].find(value => {
      const digits = String(value || "").replace(/\D/g, "");
      return digits.length >= 10 && !["5500000000", "525500000000", "5215500000000"].includes(digits);
    });
    const {normalizeAppearance}=await import("@/lib/appearance/theme");
    let raw:unknown={};try{raw=JSON.parse(cfg?.data.storeAppearance||"{}");}catch{}
    const appearance=normalizeAppearance(raw);
    return {
      id: null as string | null,
      slug: "ma2",
      name: "MA² · Tienda web",
      whatsapp: String(support || "528443852364"),
      logoUrl: appearance.logoImage,
      appearance,
    };
  }
  const { data, error } = await opsDB()
    .from("menu_businesses")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) throw new Error("Tienda no disponible");
  const { rowToBusiness } = await import("@/lib/menus/menus.server");
  const b = rowToBusiness(data),
    today = (await import("@/lib/stock/duration")).businessToday();
  const end = b.expiresOn ? new Date(b.expiresOn + "T12:00:00Z") : null;
  if (end) end.setUTCDate(end.getUTCDate() + Math.max(0, b.graceDays || 0));
  if (
    !b.active ||
    b.accessSuspended ||
    !b.features.stock_manager ||
    (end && end.toISOString().slice(0, 10) < today)
  )
    throw new Error("Tienda no disponible. Contacta al negocio.");
  return {
    id: b.id as string | null,
    slug: b.slug,
    name: b.name,
    whatsapp: b.whatsapp,
    logoUrl: b.logoUrl,
    appearance: b.appearance || {},
  };
}
export async function customerThrottle(kind: string, key: string, max: number) {
  const ip = getRequestHeader("x-nf-client-connection-ip") || "shared";
  for (const [value, limit] of [
    [`${kind}:ip:${ip}`, max * 3],
    [`${kind}:key:${key}`, max],
  ] as const) {
    const r = await opsDB().rpc("ma2_customer_limit", {
      p_key: await hashToken(value),
      p_max: limit,
      p_seconds: 900,
    });
    if (r.error || !r.data) throw new Error("Demasiados intentos. Espera 15 minutos.");
  }
}
export async function customerSession(accountId: string) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const r = await opsDB()
    .from("ma2_customer_sessions")
    .insert({
      token_hash: await hashToken(token),
      account_id: accountId,
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
  if (r.error) throw new Error("No se pudo abrir la sesión");
  setCookie(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 86400,
  });
}
export async function customerContext(slug: string) {
  const shop = await customerShop(slug),
    token = getCookie(COOKIE) || "";
  if (token.length !== 72) throw new Error("Inicia sesión para continuar");
  const { data: s, error } = await opsDB()
    .from("ma2_customer_sessions")
    .select("account_id,expires_at")
    .eq("token_hash", await hashToken(token))
    .maybeSingle();
  if (error || !s || Date.parse(s.expires_at) <= Date.now())
    throw new Error("Tu sesión terminó. Vuelve a entrar");
  const { data: a, error: accountError } = await opsDB()
    .from("ma2_customer_accounts")
    .select("*")
    .eq("id", s.account_id)
    .eq("active", true)
    .maybeSingle();
  if (accountError || !a || a.business_id !== shop.id)
    throw new Error("Inicia sesión en esta tienda");
  const client = await readRecord(a.client_id);
  if (client.status !== "active" || client.module !== "clients")
    throw new Error("Tu acceso está suspendido");
  return { account: a, client, shop };
}
export async function customerLogoutSession() {
  const token = getCookie(COOKIE);
  if (token) {
    const r = await opsDB()
      .from("ma2_customer_sessions")
      .delete()
      .eq("token_hash", await hashToken(token));
    if (r.error) throw new Error("No se pudo cerrar la sesión");
  }
  deleteCookie(COOKIE, { path: "/" });
}
export async function customerOwner(token: string) {
  const { requireOwnerCtx, requireFeature } = await import("@/lib/menus/menus.server");
  const ctx = await requireOwnerCtx(token);
  requireFeature(ctx.business, "stock_manager");
  return ctx;
}
export async function customerRecords(clientId: string, shared = false) {
  const records = await readRecords();
  return records.filter(
    (r) =>
      r.data.clientId === clientId ||
      (shared && ["notices", "faq"].includes(r.module) && r.status === "active"),
  );
}
