import { CATALOG_IDS, type CatalogId, type SortMode } from "./types";

/** Vista del catálogo: tarjetas completas o tabla compacta plataforma/precio. */
export type ViewMode = "tarjetas" | "tabla";
export type ThemeMode = "claro" | "oscuro";
export type BackgroundStyle = "degradado" | "solido" | "suave";

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
  /** Muestra los botones de pedido por WhatsApp en el catálogo. */
  showWhatsapp: boolean;
  /** Tarjetas o tabla de plataformas y precios. */
  viewMode: ViewMode;
  /** Modo de edición en lista, separado del formato de vista. */
  editMode: boolean;
  /** Panel "Herramientas" abierto o plegado. */
  toolsOpen: boolean;
  /** Apariencia recuperada del módulo independiente de Mis Clientes. */
  themeMode: ThemeMode;
  accentColor: string;
  backgroundStyle: BackgroundStyle;
  /** Servicios marcados para pedido múltiple; se conservan por catálogo. */
  markedIds: string[];
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
  showWhatsapp: true,
  viewMode: "tarjetas",
  editMode: false,
  toolsOpen: false,
  themeMode: "claro",
  accentColor: "#8b5cf6",
  backgroundStyle: "degradado",
  markedIds: [],
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
  for (const id of Array.from(new Set([...CATALOG_IDS, ...Object.keys(input)]))) {
    const p = input[id];
    if (!p) continue;
    base[id] = {
      sortMode: SORTS.includes(p.sortMode as SortMode) ? (p.sortMode as SortMode) : "categoria",
      onlyActive: p.onlyActive !== false,
      onlyFavorites: p.onlyFavorites === true,
      categoryFilter: typeof p.categoryFilter === "string" ? p.categoryFilter : ALL_CATEGORIES,
      showDetail: p.showDetail !== false,
      showShare: p.showShare !== false,
      showWhatsapp: p.showWhatsapp !== false,
      // Migra la preferencia antigua "lista" al nuevo modo Editar separado.
      viewMode: p.viewMode === "tabla" ? "tabla" : "tarjetas",
      editMode: p.editMode === true || (p.viewMode as string | undefined) === "lista",
      toolsOpen: p.toolsOpen === true,
      themeMode: p.themeMode === "oscuro" ? "oscuro" : "claro",
      accentColor:
        typeof p.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(p.accentColor)
          ? p.accentColor
          : "#8b5cf6",
      backgroundStyle:
        p.backgroundStyle === "solido" || p.backgroundStyle === "suave"
          ? p.backgroundStyle
          : "degradado",
      markedIds: Array.isArray(p.markedIds)
        ? p.markedIds.filter((id): id is string => typeof id === "string")
        : [],
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
