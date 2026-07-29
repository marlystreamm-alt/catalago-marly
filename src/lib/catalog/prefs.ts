import { CATALOG_IDS, type CatalogId, type SortMode } from "./types";

/** Vista del catálogo: tarjetas completas o tabla compacta plataforma/precio. */
export type ViewMode = "tarjetas" | "tabla";

/** Preferencias de filtrado y orden guardadas por catálogo en este dispositivo. */
export interface CatalogPrefs {
  sortMode: SortMode;
  onlyActive: boolean;
  onlyFavorites: boolean;
  categoryFilter: string;
  /** Muestra el botón "Ver detalle" en las tarjetas. */
  showDetail: boolean;
  /** Muestra el botón "Compartir" en las tarjetas. */
  showShare: boolean;
  /** Tarjetas o tabla de plataformas y precios. */
  viewMode: ViewMode;
}

export type PrefsMap = Record<CatalogId, CatalogPrefs>;

const KEY = "ma2-prefs-v1";

export const ALL_CATEGORIES = "__all__";

export const DEFAULT_PREFS: CatalogPrefs = {
  sortMode: "categoria",
  onlyActive: true,
  onlyFavorites: false,
  categoryFilter: ALL_CATEGORIES,
  showDetail: true,
  showShare: true,
  viewMode: "tarjetas",
};

const SORTS: SortMode[] = ["categoria", "precio", "nombre"];


function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalize(raw: unknown): PrefsMap {
  const base = CATALOG_IDS.reduce((acc, id) => {
    acc[id] = { ...DEFAULT_PREFS };
    return acc;
  }, {} as PrefsMap);
  if (!raw || typeof raw !== "object") return base;
  const input = raw as Partial<Record<CatalogId, Partial<CatalogPrefs>>>;
  for (const id of CATALOG_IDS) {
    const p = input[id];
    if (!p) continue;
    base[id] = {
      sortMode: SORTS.includes(p.sortMode as SortMode) ? (p.sortMode as SortMode) : "categoria",
      onlyActive: p.onlyActive !== false,
      onlyFavorites: p.onlyFavorites === true,
      categoryFilter: typeof p.categoryFilter === "string" ? p.categoryFilter : ALL_CATEGORIES,
      showDetail: p.showDetail !== false,
      showShare: p.showShare !== false,
    };
  }
  return base;
}

export function loadPrefs(): PrefsMap {
  if (!isBrowser()) return normalize(null);
  try {
    const raw = window.localStorage.getItem(KEY);
    return normalize(raw ? JSON.parse(raw) : null);
  } catch (error) {
    console.error("No se pudieron leer las preferencias:", error);
    return normalize(null);
  }
}

export function savePrefs(prefs: PrefsMap) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch (error) {
    console.error("No se pudieron guardar las preferencias:", error);
  }
}
