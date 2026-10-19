import { adminSessionRecover } from "@/lib/admin-session.functions";

export const RECOVERY_EMAIL = "marlystreamm@gmail.com";
export interface RotationResult {
  ok: boolean;
  error?: string;
  recoveryCode?: string;
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Los antiguos códigos locales no modifican la contraseña del servidor. */
export async function resetWithRecoveryCode(
  _code: string,
  _newPassword: string,
): Promise<RotationResult> {
  return { ok: false, error: "Usa la recuperación por correo para restablecer tu contraseña." };
}

/** Envía un enlace seguro de recuperación al correo configurado mediante Supabase Auth. */
export async function requestRecoveryEmail() {
  const { supabase } = await import("@/integrations/supabase/client");
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}?admin_recovery=1`
      : undefined;
  const { error } = await supabase.auth.signInWithOtp({
    email: RECOVERY_EMAIL,
    options: {
      shouldCreateUser: true,
      ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
    },
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, email: RECOVERY_EMAIL };
}

/** Finaliza la recuperación por correo actualizando la credencial del servidor. */
export async function completeRecoveryFromEmail(newPassword: string): Promise<RotationResult> {
  const invalid = validatePasswordStrength(newPassword);
  if (invalid) return { ok: false, error: invalid };
  const { supabase } = await import("@/integrations/supabase/client");
  const [{ data, error }, sessionResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  if (error || !data.user || data.user.email?.toLowerCase() !== RECOVERY_EMAIL.toLowerCase()) {
    return { ok: false, error: "Abre primero el enlace de recuperación enviado a tu correo" };
  }
  const accessToken = sessionResult.data.session?.access_token;
  if (!accessToken) return { ok: false, error: "El enlace de recuperación ya venció" };
  try {
    await adminSessionRecover({ data: { accessToken, newCode: newPassword.trim() } });
  } catch (recoveryError) {
    return {
      ok: false,
      error:
        recoveryError instanceof Error
          ? recoveryError.message
          : "No se pudo actualizar la contraseña",
    };
  }
  await supabase.auth.signOut();
  return { ok: true };
}

export function validatePasswordStrength(password: string) {
  const value = password.trim();
  if (value.length < 8) return "Usa al menos 8 caracteres";
  if (!/[a-záéíóúñ]/i.test(value)) return "Incluye al menos una letra";
  if (!/\d/.test(value)) return "Incluye al menos un número";
  return null;
}

/* ------------------------------------------------------------------ *
 * Bloqueo temporal tras varios intentos fallidos.
 * Se guarda en este dispositivo para frenar intentos por fuerza bruta.
 * ------------------------------------------------------------------ */

const LOCK_KEY = "ma2-auth-lock-v1";
export const MAX_LOGIN_ATTEMPTS = 5;
/** Duración del bloqueo según cuántas veces se ha bloqueado ya. */
const LOCK_STEPS_MS = [30_000, 60_000, 300_000, 900_000];

interface LockRecord {
  fails: number;
  locks: number;
  until: number;
}

function readLock(): LockRecord {
  if (!isBrowser()) return { fails: 0, locks: 0, until: 0 };
  try {
    const raw = window.localStorage.getItem(LOCK_KEY);
    if (!raw) return { fails: 0, locks: 0, until: 0 };
    const p = JSON.parse(raw) as Partial<LockRecord>;
    return {
      fails: Number(p.fails) || 0,
      locks: Number(p.locks) || 0,
      until: Number(p.until) || 0,
    };
  } catch {
    return { fails: 0, locks: 0, until: 0 };
  }
}

function writeLock(record: LockRecord) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(LOCK_KEY, JSON.stringify(record));
  } catch (error) {
    console.error("No se pudo guardar el estado de bloqueo:", error);
  }
}

export interface LockStatus {
  locked: boolean;
  remainingMs: number;
  fails: number;
  attemptsLeft: number;
}

export function getLockStatus(): LockStatus {
  const rec = readLock();
  const remaining = Math.max(0, rec.until - Date.now());
  return {
    locked: remaining > 0,
    remainingMs: remaining,
    fails: rec.fails,
    attemptsLeft: Math.max(0, MAX_LOGIN_ATTEMPTS - rec.fails),
  };
}

/** Registra un intento fallido y bloquea al superar el límite. */
export function registerFailedAttempt(): LockStatus {
  const rec = readLock();
  const fails = rec.fails + 1;
  if (fails >= MAX_LOGIN_ATTEMPTS) {
    const locks = rec.locks + 1;
    const ms = LOCK_STEPS_MS[Math.min(locks - 1, LOCK_STEPS_MS.length - 1)];
    writeLock({ fails: 0, locks, until: Date.now() + ms });
  } else {
    writeLock({ ...rec, fails });
  }
  return getLockStatus();
}

export function clearFailedAttempts() {
  writeLock({ fails: 0, locks: 0, until: 0 });
}

export function formatLockWait(ms: number) {
  const total = Math.ceil(ms / 1000);
  if (total < 60) return `${total} s`;
  const min = Math.ceil(total / 60);
  return `${min} min`;
}
