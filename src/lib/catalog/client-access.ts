/**
 * Accesos de cliente ("Mi menú").
 *
 * Cada cliente tiene su propia clave (nunca se guarda en texto plano: solo un
 * hash PBKDF2-SHA256 con sal), una vigencia y una lista de permisos que decide
 * el administrador. Todo se guarda en este dispositivo (localStorage).
 */

const KEY = "ma2-client-access-v1";
/** Safari/iOS no soporta más de 100 000 iteraciones de PBKDF2. */
const ITERATIONS = 100_000;

export const PERMISSIONS = [
  { key: "verPrecios", label: "Ver precios", group: "ver" },
  { key: "verDescripciones", label: "Ver descripciones", group: "ver" },
  { key: "verImagenes", label: "Ver imágenes", group: "ver" },
  { key: "verOcultos", label: "Ver servicios ocultos", group: "ver" },
  { key: "usarDetalles", label: "Botón Ver detalles", group: "funciones" },
  { key: "usarCompartir", label: "Botón Compartir", group: "funciones" },
  { key: "usarWhatsapp", label: "Botón Pedir por WhatsApp", group: "funciones" },
  { key: "usarFavoritos", label: "Favoritos", group: "funciones" },
  { key: "editPrecio", label: "Editar precio", group: "editar" },
  { key: "editNombre", label: "Editar nombre", group: "editar" },
  { key: "editDescripcion", label: "Editar descripción", group: "editar" },
  { key: "editImagen", label: "Cambiar imagen", group: "editar" },
  { key: "editDetalles", label: "Editar detalles (entrega, garantía…)", group: "editar" },
  { key: "editEstado", label: "Activar o desactivar servicios", group: "editar" },
  { key: "agregarServicio", label: "Agregar servicios", group: "editar" },
  { key: "eliminarServicio", label: "Eliminar servicios", group: "editar" },
  { key: "ajustesCatalogo", label: "Cambiar nombre, subtítulo y WhatsApp", group: "editar" },
  { key: "editWhatsappTarjeta", label: "WhatsApp individual por tarjeta", group: "editar" },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["key"];

export type Permissions = Record<Permission, boolean>;

export const EMPTY_PERMISSIONS: Permissions = PERMISSIONS.reduce((acc, p) => {
  acc[p.key] = false;
  return acc;
}, {} as Permissions);

/** Permisos mínimos razonables al crear un cliente nuevo. */
export const DEFAULT_PERMISSIONS: Permissions = {
  ...EMPTY_PERMISSIONS,
  verPrecios: true,
  verDescripciones: true,
  verImagenes: true,
  usarDetalles: true,
  usarWhatsapp: true,
  usarFavoritos: true,
};

export interface ClientAccess {
  id: string;
  business: string;
  owner: string;
  whatsapp: string;
  /** Usuario elegido manualmente por la administradora. */
  username: string;
  notes: string;
  catalogId: string;
  /** Catálogos que este acceso puede ver. catalogId se conserva como principal por compatibilidad. */
  catalogIds: string[];
  startsOn: string;
  expiresOn: string;
  suspended: boolean;
  permissions: Permissions;
  salt: string;
  hash: string;
  createdAt: string;
  updatedAt: string;
}

export type ClientAccessStatus = "activo" | "suspendido" | "vencido";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export function randomHex(bytes: number) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashCode(code: string, salt: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: ITERATIONS },
    key,
    256,
  );
  return toHex(bits);
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function addMonths(dateISO: string, months: number) {
  const d = new Date(`${dateISO}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function statusOf(client: ClientAccess): ClientAccessStatus {
  if (client.suspended) return "suspendido";
  if (client.expiresOn && client.expiresOn < todayISO()) return "vencido";
  return "activo";
}

function normalize(raw: unknown): ClientAccess[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      id: String(c.id ?? randomHex(8)),
      business: String(c.business ?? ""),
      owner: String(c.owner ?? ""),
      whatsapp: String(c.whatsapp ?? ""),
      username: String(c.username ?? ""),
      notes: String(c.notes ?? ""),
      catalogId: String(c.catalogId ?? "clientes"),
      catalogIds: Array.isArray(c.catalogIds) && c.catalogIds.length ? c.catalogIds.map(String) : [String(c.catalogId ?? "clientes")],
      startsOn: String(c.startsOn ?? todayISO()),
      expiresOn: String(c.expiresOn ?? addMonths(todayISO(), 1)),
      suspended: c.suspended === true,
      permissions: { ...DEFAULT_PERMISSIONS, ...(c.permissions as Permissions | undefined) },
      salt: String(c.salt ?? ""),
      hash: String(c.hash ?? ""),
      createdAt: String(c.createdAt ?? new Date().toISOString()),
      updatedAt: String(c.updatedAt ?? new Date().toISOString()),
    }));
}

export function loadClients(): ClientAccess[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return normalize(raw ? JSON.parse(raw) : []);
  } catch (error) {
    console.error("No se pudieron leer los accesos de cliente:", error);
    return [];
  }
}

export function saveClients(clients: ClientAccess[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(clients));
  } catch (error) {
    console.error("No se pudieron guardar los accesos de cliente:", error);
  }
}

/** Busca un cliente por usuario + contraseña y valida estado/vigencia. */
export async function findClientByCredentials(
  username: string,
  password: string,
  clients: ClientAccess[],
): Promise<{ ok: true; client: ClientAccess } | { ok: false; error: string }> {
  const user = username.trim().toLowerCase();
  const clean = password;
  if (!user) return { ok: false, error: "Escribe tu usuario" };
  if (!clean) return { ok: false, error: "Escribe tu contraseña" };
  const client = clients.find((c) => c.username.trim().toLowerCase() === user);
  if (!client || !client.salt || !client.hash) return { ok: false, error: "Usuario o contraseña incorrectos" };
  const hash = await hashCode(clean, client.salt);
  if (!safeEqual(hash, client.hash)) return { ok: false, error: "Usuario o contraseña incorrectos" };
  const status = statusOf(client);
  if (status === "suspendido") return { ok: false, error: "Tu acceso está suspendido. Contacta a MA² para reactivarlo." };
  if (status === "vencido") return { ok: false, error: "Tu acceso venció. Contacta a MA² para renovarlo." };
  return { ok: true, client };
}
