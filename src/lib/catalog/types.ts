import type { Appearance } from '@/lib/appearance/theme';
/** Identificador de catálogo: los tres base y cualquiera creado por el administrador. */
export type CatalogId = string;

export type SeedCatalogId = "clientes" | "cyberdoc" | "revendedores";

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
  /** Precio en texto libre ("Desde $45", "Consultar"); tiene prioridad al mostrarse. */
  priceText?: string;
  /** Emoji o URL de imagen que identifica la plataforma o trámite. */
  icon?: string;
  /** Plan, modalidad o tipo de cuenta (texto libre). */
  plan?: string;
  /** Usuarios permitidos (texto libre). */
  users?: string;
  /** Vigencia o duración (texto libre). */
  vigencia?: string;
  /** Requisitos o campos requeridos (texto libre, usado en trámites). */
  requirements?: string;
  /** WhatsApp específico de esta tarjeta. Solo se usa en directorios cuando la ficha lo activa. */
  whatsapp?: string;
  /** Activa el botón de WhatsApp personal únicamente para esta ficha de directorio. */
  personalWhatsappEnabled?: boolean;
  /** Mensaje personalizado para esta tarjeta. */
  whatsappMessage?: string;
  /** Orden manual dentro del catálogo (menor primero). */
  sortIndex?: number;
  /** Enlace del menú personalizado aprobado para una tarjeta de Agenda de negocio. */
  linkedMenuUrl?: string;
  /** Datos comerciales opcionales para directorios. */
  serviceDays?: string;
  businessHours?: string;
  address?: string;
  mapsUrl?: string;
  homeDelivery?: boolean;
  paymentMethods?: ("cash" | "transfer" | "card")[];
  /** Campos adicionales configurables por tarjeta. */
  customFields?: { id: string; label: string; value: string; visible?: boolean }[];
  /** Sección/pestaña pública superior dentro del catálogo (ej. Perfiles, Completas). */
  sectionId?: string;
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



export type SpaceType = "catalog" | "menu" | "directory" | "provider" | "marketplace";
export const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  catalog: "Catálogo",
  menu: "Menú",
  directory: "Directorio telefónico",
  provider: "Directorio de proveedores",
  marketplace: "Mercadito",
};

export interface CatalogSection {
  id: string;
  name: string;
  hidden?: boolean;
}

export interface Catalog {
  appearance?: Appearance;
  id: CatalogId;
  name: string;
  subtitle: string;
  spaceType: SpaceType;
  imageUrl: string;
  whatsappNumber: string;
  whatsappTemplate: string;
  /** Permite usar WhatsApp y mensaje distintos en cada tarjeta. */
  individualWhatsappEnabled: boolean;
  /** El administrador decide si este espacio permite datos comerciales en sus tarjetas. */
  commercialFieldsEnabled?: boolean;
  hidden: boolean;
  /** Nombres heredados; se conservan para migrar instalaciones anteriores. */
  sectionLabels?: { perfiles: string; completas: string; "ia-creatividad"?: string; tramites: string };
  /** Secciones superiores editables, visibles también en modo público. */
  sectionTabs?: CatalogSection[];
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
