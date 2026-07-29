export type CatalogId = "clientes" | "cyberdoc" | "revendedores";

export interface Subsection {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  subsections: Subsection[];
}

export interface Service {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  subsectionId: string | null;
  description: string;
  devices: string;
  profiles: string;
  delivery: string;
  warranty: string;
  active: boolean;
  favorite: boolean;
}

export type LogAction =
  | "creacion"
  | "edicion"
  | "estado"
  | "eliminacion"
  | "catalogo"
  | "categoria"
  | "sistema";

export interface LogEntry {
  id: string;
  at: string;
  action: LogAction;
  target: string;
  summary: string;
  /** Quién realizó la acción (bitácora de auditoría). */
  user?: string;
  /** Campo modificado, con su valor anterior y nuevo (auditoría detallada). */
  field?: string;
  before?: string;
  after?: string;
}


export interface Catalog {
  id: CatalogId;
  name: string;
  subtitle: string;
  whatsappNumber: string;
  whatsappTemplate: string;
  hidden: boolean;
  categories: Category[];
  services: Service[];
  log: LogEntry[];
}

export interface AppState {
  version: number;
  catalogs: Record<CatalogId, Catalog>;
}

export const CATALOG_IDS: CatalogId[] = ["clientes", "cyberdoc", "revendedores"];

export const LOG_LABELS: Record<LogAction, string> = {
  creacion: "Creación",
  edicion: "Edición",
  estado: "Activación",
  eliminacion: "Eliminación",
  catalogo: "Catálogo",
  categoria: "Categorías",
  sistema: "Sistema",
};

export const MAX_LOG_ENTRIES = 200;

export type SortMode = "categoria" | "precio" | "nombre";

export const DEFAULT_TEMPLATE = "Hola, me interesa {servicio} por {precio}. Detalles: {detalles}";
