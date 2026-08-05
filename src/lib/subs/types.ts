/** Tipos y cálculo de estado de las suscripciones de menús (cliente y servidor). */

export type SubStatus = "activo" | "por_vencer" | "vencido" | "suspendido";

export interface Subscription {
  id: string;
  businessName: string;
  ownerName: string;
  whatsapp: string;
  slug: string;
  catalogId: string;
  plan: string;
  price: number;
  startedOn: string;
  expiresOn: string;
  suspended: boolean;
  notes: string;
  createdAt: string;
  /** Estado calculado a partir de la fecha de vencimiento y la suspensión manual. */
  status: SubStatus;
  daysLeft: number;
}

export interface RenewalEntry {
  id: string;
  createdAt: string;
  kind: string;
  previousExpires: string | null;
  newExpires: string | null;
  note: string;
}

export const STATUS_TEXT: Record<SubStatus, string> = {
  activo: "Activo",
  por_vencer: "Por vencer",
  vencido: "Vencido",
  suspendido: "Suspendido",
};

/** Días que faltan (o sobran, en negativo) para el vencimiento. */
export function daysUntil(expiresOn: string, today = todayISO()): number {
  const a = Date.parse(`${expiresOn}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((a - b) / 86_400_000);
}

/** Fecha de hoy (AAAA-MM-DD) en la zona horaria del negocio. */
export function todayISO(timezone = "America/Monterrey"): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Regla de negocio: vencido = suspendido; 5 días o menos = por vencer. */
export function computeStatus(expiresOn: string, suspended: boolean, today = todayISO()): SubStatus {
  if (suspended) return "suspendido";
  const left = daysUntil(expiresOn, today);
  if (left < 0) return "suspendido";
  if (left <= 5) return "por_vencer";
  return "activo";
}

/** Suma meses o años desde el vencimiento vigente (si sigue activo) o desde hoy. */
export function nextExpiry(expiresOn: string, months: number, today = todayISO()): string {
  const base = daysUntil(expiresOn, today) >= 0 ? expiresOn : today;
  const [y, m, d] = base.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

/** Convierte texto libre en un slug seguro para el enlace público. */
export function toSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
