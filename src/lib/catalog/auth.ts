/**
 * Credenciales del modo administrador.
 *
 * La contraseña nunca se guarda en texto plano ni queda escrita en el código:
 * se almacena solo un hash PBKDF2-SHA256 con sal aleatoria en este dispositivo.
 * La contraseña inicial (Artu1802) se marca como "temporal" y la app obliga a
 * rotarla en el primer acceso, entregando un código de recuperación de un solo
 * uso para poder restablecerla más adelante.
 */

const KEY = "ma2-auth-v1";
const INITIAL_PASSWORD = "Artu1802";
const ITERATIONS = 150_000;

export interface AuthRecord {
  version: 1;
  salt: string;
  hash: string;
  iterations: number;
  mustChange: boolean;
  recovery: { salt: string; hash: string } | null;
  updatedAt: string;
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(bytes: number) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function derive(secret: string, salt: string, iterations = ITERATIONS) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations },
    key,
    256,
  );
  return toHex(bits);
}

/** Comparación en tiempo constante para no filtrar información por tiempos. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function build(password: string, mustChange: boolean, recoveryCode?: string) {
  const salt = randomHex(16);
  const record: AuthRecord = {
    version: 1,
    salt,
    hash: await derive(password, salt),
    iterations: ITERATIONS,
    mustChange,
    recovery: null,
    updatedAt: new Date().toISOString(),
  };
  if (recoveryCode) {
    const rSalt = randomHex(16);
    record.recovery = { salt: rSalt, hash: await derive(recoveryCode, rSalt) };
  }
  return record;
}

function read(): AuthRecord | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthRecord;
    if (!parsed || typeof parsed.hash !== "string" || typeof parsed.salt !== "string") return null;
    return parsed;
  } catch (error) {
    console.error("No se pudo leer las credenciales locales:", error);
    return null;
  }
}

function write(record: AuthRecord) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(record));
  } catch (error) {
    console.error("No se pudo guardar las credenciales locales:", error);
  }
}

/** Crea el registro inicial (contraseña temporal) si aún no existe. */
export async function ensureAuthRecord(): Promise<AuthRecord | null> {
  if (!isBrowser()) return null;
  const existing = read();
  if (existing) return existing;
  const created = await build(INITIAL_PASSWORD, true);
  write(created);
  return created;
}

export function generateRecoveryCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  const chars = Array.from(arr, (n) => alphabet[n % alphabet.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars
    .slice(8, 12)
    .join("")}-${chars.slice(12, 16).join("")}`;
}

export async function verifyPassword(password: string) {
  const record = (await ensureAuthRecord()) ?? null;
  if (!record) return { ok: false, mustChange: false };
  const hash = await derive(password, record.salt, record.iterations || ITERATIONS);
  return { ok: safeEqual(hash, record.hash), mustChange: record.mustChange === true };
}

export interface RotationResult {
  ok: boolean;
  error?: string;
  recoveryCode?: string;
}

/** Cambia la contraseña verificando la actual y emite un nuevo código de recuperación. */
export async function rotatePassword(
  currentPassword: string,
  newPassword: string,
): Promise<RotationResult> {
  const check = await verifyPassword(currentPassword);
  if (!check.ok) return { ok: false, error: "La contraseña actual no es correcta" };
  const invalid = validatePasswordStrength(newPassword);
  if (invalid) return { ok: false, error: invalid };
  if (await verifyPassword(newPassword).then((r) => r.ok))
    return { ok: false, error: "La nueva contraseña debe ser distinta de la actual" };
  const recoveryCode = generateRecoveryCode();
  write(await build(newPassword, false, recoveryCode));
  return { ok: true, recoveryCode };
}

/** Restablece la contraseña con el código de recuperación (un solo uso). */
export async function resetWithRecoveryCode(
  code: string,
  newPassword: string,
): Promise<RotationResult> {
  const record = await ensureAuthRecord();
  if (!record?.recovery)
    return {
      ok: false,
      error: "Este dispositivo no tiene código de recuperación. Cambia la contraseña desde admin.",
    };
  const invalid = validatePasswordStrength(newPassword);
  if (invalid) return { ok: false, error: invalid };
  const hash = await derive(code.trim().toUpperCase(), record.recovery.salt, ITERATIONS);
  if (!safeEqual(hash, record.recovery.hash))
    return { ok: false, error: "El código de recuperación no es válido" };
  const recoveryCode = generateRecoveryCode();
  write(await build(newPassword, false, recoveryCode));
  return { ok: true, recoveryCode };
}

export function hasRecoveryCode() {
  return read()?.recovery !== null && read()?.recovery !== undefined;
}

export function validatePasswordStrength(password: string) {
  const value = password.trim();
  if (value.length < 8) return "Usa al menos 8 caracteres";
  if (!/[a-záéíóúñ]/i.test(value)) return "Incluye al menos una letra";
  if (!/\d/.test(value)) return "Incluye al menos un número";
  return null;
}
