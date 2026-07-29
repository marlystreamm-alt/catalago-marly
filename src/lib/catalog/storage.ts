import { createSeedState } from "./seed";
import {
  CATALOG_IDS,
  DEFAULT_TEMPLATE,
  LOG_LABELS,
  MAX_LOG_ENTRIES,
  type AppState,
  type Catalog,
  type CatalogId,
  type LogEntry,
} from "./types";

const KEY = "ma2-catalogos-v1";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Normaliza cualquier objeto entrante para que la app nunca quede vacía. */
export function normalizeState(raw: unknown): AppState {
  const seed = createSeedState();
  if (!raw || typeof raw !== "object") return seed;
  const input = raw as Partial<AppState>;
  const catalogs = (input.catalogs ?? {}) as Partial<Record<CatalogId, Catalog>>;
  const result = { version: seed.version, catalogs: { ...seed.catalogs } } as AppState;

  for (const id of CATALOG_IDS) {
    const c = catalogs[id];
    if (!c || !Array.isArray(c.services) || c.services.length === 0) continue;
    result.catalogs[id] = {
      id,
      name: typeof c.name === "string" && c.name.trim() ? c.name : seed.catalogs[id].name,
      subtitle: typeof c.subtitle === "string" ? c.subtitle : seed.catalogs[id].subtitle,
      whatsappNumber: typeof c.whatsappNumber === "string" ? c.whatsappNumber : "",
      whatsappTemplate:
        typeof c.whatsappTemplate === "string" && c.whatsappTemplate.trim()
          ? c.whatsappTemplate
          : DEFAULT_TEMPLATE,
      categories:
        Array.isArray(c.categories) && c.categories.length
          ? c.categories.map((cat) => ({
              id: String(cat.id),
              name: String(cat.name ?? ""),
              subsections: Array.isArray(cat.subsections)
                ? cat.subsections.map((sub) => ({
                    id: String(sub.id),
                    name: String(sub.name ?? ""),
                  }))
                : [],
            }))
          : seed.catalogs[id].categories,
      services: c.services.map((sv, i) => ({
        id: String(sv.id ?? `${id}-r${i}`),
        name: String(sv.name ?? "Sin nombre"),
        price: Number.isFinite(Number(sv.price)) ? Number(sv.price) : 0,
        categoryId: String(sv.categoryId ?? "otros"),
        subsectionId: sv.subsectionId ? String(sv.subsectionId) : null,
        description: String(sv.description ?? ""),
        devices: String(sv.devices ?? ""),
        profiles: String(sv.profiles ?? ""),
        delivery: String(sv.delivery ?? ""),
        warranty: String(sv.warranty ?? ""),
        active: sv.active !== false,
        favorite: sv.favorite === true,
      })),
      hidden: c.hidden === true,
      log: Array.isArray(c.log)
        ? c.log.slice(0, MAX_LOG_ENTRIES).map((e, i) => ({
            id: String(e.id ?? `log-${i}`),
            at: String(e.at ?? new Date().toISOString()),
            action: (LOG_LABELS as Record<string, string>)[String(e.action)]
              ? (e.action as LogEntry["action"])
              : "sistema",
            target: String(e.target ?? ""),
            summary: String(e.summary ?? ""),
            user: typeof e.user === "string" && e.user.trim() ? e.user : "Administrador",
            field: typeof e.field === "string" ? e.field : undefined,
            before: typeof e.before === "string" ? e.before : undefined,
            after: typeof e.after === "string" ? e.after : undefined,
          }))

        : [],
    };
  }
  return result;
}

export function loadState(): AppState {
  if (!isBrowser()) return createSeedState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return createSeedState();
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.error("No se pudo leer el respaldo local:", error);
    return createSeedState();
  }
}

export function saveState(state: AppState): { ok: boolean; error?: string } {
  if (!isBrowser()) return { ok: false, error: "Sin almacenamiento disponible" };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    return { ok: true };
  } catch (error) {
    console.error("No se pudo guardar:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

export function clearState() {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch (error) {
    console.error("No se pudo limpiar el almacenamiento:", error);
  }
}
