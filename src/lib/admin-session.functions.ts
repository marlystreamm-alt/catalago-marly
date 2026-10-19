import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const sessionToken = z.string().min(20).max(1000);
const recoveryInput = z.object({
  accessToken: z.string().min(20).max(5000),
  newCode: z
    .string()
    .min(8)
    .max(120)
    .regex(/[a-záéíóúñ]/i, "Incluye al menos una letra")
    .regex(/\d/, "Incluye al menos un número"),
});

const ADMIN_RECOVERY_EMAIL = (
  process.env.MA2_ADMIN_EMAIL?.trim() || "marlystreamm@gmail.com"
).toLowerCase();

export const adminSessionLogin = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    z
      .object({ code: z.string().min(4).max(120), actorName: z.string().min(1).max(80) })
      .parse(value),
  )
  .handler(async ({ data }) => {
    const { requireAdminPassword } = await import("@/lib/notify/notify.server");
    const { createServerSession } = await import("@/lib/sessions.server");
    const verification = await requireAdminPassword(data.code);
    const session = await createServerSession(data.actorName, { hours: 12 });
    return { ...session, mustChangePassword: verification.mustChangePassword };
  });

export const adminSessionChangePassword = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    z
      .object({
        token: sessionToken,
        currentCode: z.string().min(4).max(120),
        newCode: recoveryInput.shape.newCode,
      })
      .parse(value),
  )
  .handler(async ({ data }) => {
    const { requireServerSession } = await import("@/lib/sessions.server");
    const { requireAdminPassword, admin, hashCode, randomSalt } =
      await import("@/lib/notify/notify.server");
    await requireServerSession(data.token);
    await requireAdminPassword(data.currentCode);
    if (data.currentCode.trim() === data.newCode.trim()) {
      throw new Error("La contraseña nueva debe ser diferente de la temporal");
    }
    const db = await admin();
    const salt = randomSalt();
    const { error } = await db
      .from("notification_settings")
      .update({
        admin_code_hash: await hashCode(data.newCode.trim(), salt),
        admin_code_salt: salt,
        admin_must_change: false,
        admin_password_updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminSessionValidate = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ token: sessionToken }).parse(value))
  .handler(async ({ data }) => {
    const { requireServerSession } = await import("@/lib/sessions.server");
    const session = await requireServerSession(data.token);
    const { admin } = await import("@/lib/notify/notify.server");
    const db = await admin();
    const { data: settings, error } = await db
      .from("notification_settings")
      .select("admin_must_change")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ...session, mustChangePassword: Boolean(settings?.admin_must_change) };
  });

export const adminSessionLogout = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ token: sessionToken }).parse(value))
  .handler(async ({ data }) => {
    const { revokeServerSession } = await import("@/lib/sessions.server");
    await revokeServerSession(data.token);
    return { ok: true as const };
  });

/** Restablece el código únicamente después de verificar el correo administrador con Supabase Auth. */
export const adminSessionRecover = createServerFn({ method: "POST" })
  .validator((value: unknown) => recoveryInput.parse(value))
  .handler(async ({ data }) => {
    const { admin, hashCode, randomSalt } = await import("@/lib/notify/notify.server");
    const db = await admin();
    const { data: authData, error: authError } = await db.auth.getUser(data.accessToken);
    const email = authData.user?.email?.trim().toLowerCase() ?? "";
    if (authError || !authData.user || !authData.user.email_confirmed_at || email !== ADMIN_RECOVERY_EMAIL) {
      throw new Error("El enlace de recuperación no es válido o ya venció");
    }

    const salt = randomSalt();
    const hash = await hashCode(data.newCode.trim(), salt);
    const { error: updateError } = await db
      .from("notification_settings")
      .update({
        admin_code_hash: hash,
        admin_code_salt: salt,
        admin_must_change: false,
        admin_password_updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (updateError) throw new Error(updateError.message);

    // La recuperación invalida todas las sesiones administrativas existentes.
    const { error: revokeError } = await db
      .from("admin_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .is("revoked_at", null);
    if (revokeError) throw new Error(revokeError.message);
    return { ok: true as const };
  });
