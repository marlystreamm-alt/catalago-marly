import type { Appearance } from '@/lib/appearance/theme';
/** Tipos del apartado de catálogos vendidos (negocios de clientes). */

export const VIEW_FEATURES = [
  "show_prices",
  "show_photos",
  "show_descriptions",
  "show_whatsapp",
  "show_address",
] as const;

export const EDIT_FEATURES = [
  "edit_prices",
  "edit_item_text",
  "edit_photos",
  "add_items",
  "delete_items",
  "edit_categories",
  "toggle_items",
  "edit_business",
  "per_item_whatsapp",
  "stock_manager",
  "stock_add",
  "stock_edit",
  "stock_delete",
  "stock_assign",
  "stock_view_password",
  "stock_export",
  "protected_deliveries",
  "notices",
  "commercial_fields",
] as const;

export type ViewFeature = (typeof VIEW_FEATURES)[number];
export type EditFeature = (typeof EDIT_FEATURES)[number];
export type FeatureKey = ViewFeature | EditFeature;
export type Features = Record<FeatureKey, boolean>;

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  show_prices: "Mostrar precios",
  show_photos: "Mostrar fotos",
  show_descriptions: "Mostrar descripciones",
  show_whatsapp: "Botón Pedir por WhatsApp",
  show_address: "Mostrar dirección",
  edit_prices: "Editar precios",
  edit_item_text: "Editar nombre y descripción",
  edit_photos: "Cambiar fotos",
  add_items: "Agregar productos",
  delete_items: "Eliminar productos",
  edit_categories: "Manejar categorías",
  toggle_items: "Activar/desactivar productos",
  edit_business: "Cambiar datos del negocio",
  per_item_whatsapp: "WhatsApp individual por tarjeta",
  stock_manager: "Gestor de stock",
  stock_add: "Stock: agregar registros",
  stock_edit: "Stock: editar registros",
  stock_delete: "Stock: eliminar registros",
  stock_assign: "Stock: asignar / entregar",
  stock_view_password: "Stock: ver contraseñas",
  stock_export: "Stock: exportar respaldo",
  protected_deliveries: "Entregas protegidas",
  notices: "Avisos en su espacio",
  commercial_fields: "Datos comerciales (días, horario, domicilio y pagos)",
};

export const DEFAULT_FEATURES: Features = {
  show_prices: true,
  show_photos: true,
  show_descriptions: true,
  show_whatsapp: true,
  show_address: true,
  edit_prices: false,
  edit_item_text: false,
  edit_photos: false,
  add_items: false,
  delete_items: false,
  edit_categories: false,
  toggle_items: false,
  edit_business: false,
  per_item_whatsapp: false,
  stock_manager: false,
  stock_add: false,
  stock_edit: false,
  stock_delete: false,
  stock_assign: false,
  stock_view_password: false,
  stock_export: false,
  protected_deliveries: false,
  notices: false,
  commercial_fields: false,
};

export type MenuBusiness = {
  appearance?: Appearance;
  id: string;
  slug: string;
  name: string;
  ownerName: string;
  whatsapp: string;
  address: string;
  notes: string;
  active: boolean;
  sortIndex: number;
  logoUrl: string;
  expiresOn: string | null;
  features: Features;
  hasAccess: boolean;
  /** Usuario manual elegido por la administradora para iniciar sesión. */
  accessUsername: string;
  accessTemp: boolean;
  accessSuspended: boolean;
  accessUpdatedAt: string | null;
  /** Número total de pestañas que la administradora autorizó. */
  allowedSpaces: number;
  planName: string;
  renewalPrice: number;
  billingDay: number | null;
  graceDays: number;
  contractStartedOn: string;
  whatsappTemplate: string;
  suspensionMessage: string;
  /** Permite que el negocio tenga varios administradores con contraseñas distintas. */
  multiAdmin: boolean;
};

/** Administrador adicional de un negocio (mismos permisos que el dueño). */
export type MenuAdmin = {
  id: string;
  businessId: string;
  name: string;
  suspended: boolean;
  temp: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

/** Movimiento de la bitácora de un negocio. */
export type MenuAuditEntry = {
  id: string;
  businessId: string;
  actorKind: "dueno" | "admin" | "equipo";
  actorName: string;
  action: string;
  target: string;
  field: string;
  before: string;
  after: string;
  createdAt: string;
};

/** Respaldo JSON del catálogo de un negocio. */
export type MenuBackup = {
  kind: "ma2-menu-backup";
  version: 1;
  exportedAt: string;
  business: {
    name: string;
    ownerName: string;
    whatsapp: string;
    address: string;
    logoUrl: string;
    notes: string;
  };
  categories: { name: string; sortIndex: number }[];
  items: {
    category: string | null;
    name: string;
    description: string;
    price: number;
    priceText: string;
    imageUrl: string;
    available: boolean;
    sortIndex: number;
  }[];
};

/** Ficha de una versión guardada del respaldo de un negocio. */
export type MenuBackupVersion = {
  id: string;
  businessId: string;
  version: number;
  /** De dónde salió: exportación manual, importación de archivo, restauración o automático. */
  origin: "export" | "import" | "restore" | "auto";
  label: string;
  actorKind: "dueno" | "admin" | "equipo";
  actorName: string;
  categoriesCount: number;
  itemsCount: number;
  createdAt: string;
};

export type MenuSpaceKind = "catalog" | "menu" | "directory" | "marketplace";
export type MenuSpace = {
  id: string;
  businessId: string;
  kind: MenuSpaceKind;
  name: string;
  subtitle: string;
  imageUrl: string;
  slug: string;
  hidden: boolean;
  sortIndex: number;
  noticeEnabled: boolean;
  noticeTitle: string;
  noticeMessage: string;
};

export type MenuCategory = {
  id: string;
  businessId: string;
  spaceId: string | null;
  parentId: string | null;
  name: string;
  /** Portada de la sección o subportada de la subsección. */
  imageUrl: string;
  hidden: boolean;
  sortIndex: number;
};

export type MenuItem = {
  id: string;
  businessId: string;
  spaceId: string | null;
  categoryId: string | null;
  name: string;
  description: string;
  price: number;
  priceText: string;
  imageUrl: string;
  /** WhatsApp propio de esta tarjeta. Si está vacío usa el del negocio. */
  whatsapp: string;
  /** Mensaje personalizado para esta tarjeta. */
  whatsappMessage: string;
  available: boolean;
  /** Estado del producto en Mercadito. */
  condition?: "new" | "used";
  sortIndex: number;
};

export type MenuData = {
  business: MenuBusiness;
  spaces: MenuSpace[];
  categories: MenuCategory[];
  items: MenuItem[];
};

/** Datos que ve el dueño en su panel: su negocio, su menú y sus permisos. */
export type OwnerData = MenuData & {
  features: Features;
  mustChangePassword: boolean;
  /** Nombre de quien entró (dueño o administrador adicional). */
  actorName: string;
};

export const emptyBusiness = (): Omit<MenuBusiness, "id"> => ({
  slug: "",
  name: "",
  ownerName: "",
  whatsapp: "",
  address: "",
  notes: "",
  active: true,
  sortIndex: 0,
  logoUrl: "",
  expiresOn: null,
  features: { ...DEFAULT_FEATURES },
  hasAccess: false,
  accessUsername: "",
  accessTemp: true,
  accessSuspended: false,
  accessUpdatedAt: null,
  allowedSpaces: 1,
  planName: "Plan base",
  renewalPrice: 0,
  billingDay: null,
  graceDays: 1,
  contractStartedOn: new Date().toISOString().slice(0, 10),
  whatsappTemplate: "Hola {cliente}, aquí tienes tu entrega: {link}",
  suspensionMessage: "Servicio no disponible. Contacta al administrador.",
  multiAdmin: false,
});

/** Estado comercial. La fecha de vencimiento conserva un día completo de prórroga. */
export type BusinessStatus = "activo" | "prorroga" | "apagado" | "vencido";
export function businessStatus(b: { active: boolean; expiresOn: string | null; graceDays?: number }): BusinessStatus {
  if (!b.active) return "apagado";
  if (!b.expiresOn) return "activo";
  const today = new Date(`${new Date().toISOString().slice(0,10)}T12:00:00`);
  const expires = new Date(`${b.expiresOn}T12:00:00`);
  const grace = Math.max(0, b.graceDays ?? 1);
  const endGrace = new Date(expires);
  endGrace.setDate(endGrace.getDate() + grace);
  if (today <= expires) return "activo";
  if (today <= endGrace) return "prorroga";
  return "vencido";
}

export function daysUntilExpiry(expiresOn: string | null) {
  if (!expiresOn) return null;
  const a = new Date(`${new Date().toISOString().slice(0,10)}T12:00:00`).getTime();
  const b = new Date(`${expiresOn}T12:00:00`).getTime();
  return Math.ceil((b-a)/86400000);
}
