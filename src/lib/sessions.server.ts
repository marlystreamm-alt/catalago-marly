const enc = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

export async function hashSessionToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(token));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createServerSession(
  actorName: string,
  options: { token?: string; hours?: number; userAgent?: string } = {},
) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = options.token ?? `ma2s_${bytesToBase64Url(bytes)}`;
  const expiresAt = new Date(Date.now() + (options.hours ?? 12) * 60 * 60 * 1000).toISOString();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  await supabaseAdmin
    .from("admin_sessions")
    .delete()
    .lt("expires_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  const { error } = await supabaseAdmin.from("admin_sessions").insert({
    token_hash: await hashSessionToken(token),
    actor_name: actorName.trim().slice(0, 80) || "Administrador",
    expires_at: expiresAt,
    user_agent: (options.userAgent ?? "").slice(0, 500),
  });
  if (error) throw new Error(`No se pudo crear la sesión: ${error.message}`);
  return { token, expiresAt };
}

export async function requireServerSession(token: string) {
  if (!token || token.length < 20) throw new Error("Sesión no válida, vuelve a entrar");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tokenHash = await hashSessionToken(token);
  const { data, error } = await supabaseAdmin
    .from("admin_sessions")
    .select("id, actor_name, expires_at, revoked_at, last_used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now()) {
    throw new Error("Tu sesión terminó, vuelve a entrar");
  }

  const lastUsed = new Date(data.last_used_at).getTime();
  if (!Number.isFinite(lastUsed) || Date.now() - lastUsed > 5 * 60 * 1000) {
    void supabaseAdmin
      .from("admin_sessions")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);
  }
  return { id: data.id, actorName: data.actor_name, expiresAt: data.expires_at };
}

export async function revokeServerSession(token: string) {
  if (!token) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("admin_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", await hashSessionToken(token))
    .is("revoked_at", null);
  if (error) throw new Error(error.message);
}
