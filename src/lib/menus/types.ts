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
};

export const DEFAULT_FEATURES: Features = {
  show_prices: true,
  show_photos: true,
  show_descriptions: true,
  show_whatsapp: true,
  show_address: true,
  edit_prices: true,
  edit_item_text: true,
  edit_photos: true,
  add_items: true,
  delete_items: false,
  edit_categories: true,
  toggle_items: true,
  edit_business: false,
};

export type MenuBusiness = {
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
  accessTemp: boolean;
  accessSuspended: boolean;
  accessUpdatedAt: string | null;
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

export type MenuCategory = {
  id: string;
  businessId: string;
  name: string;
  sortIndex: number;
};

export type MenuItem = {
  id: string;
  businessId: string;
  categoryId: string | null;
  name: string;
  description: string;
  price: number;
  priceText: string;
  imageUrl: string;
  available: boolean;
  sortIndex: number;
};

export type MenuData = {
  business: MenuBusiness;
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
  accessTemp: true,
  accessSuspended: false,
  accessUpdatedAt: null,
  multiAdmin: false,
});

/** Estado comercial del negocio para el panel del administrador. */
export function businessStatus(b: {
  active: boolean;
  expiresOn: string | null;
}): "activo" | "apagado" | "vencido" {
  if (!b.active) return "apagado";
  if (b.expiresOn && b.expiresOn < new Date().toISOString().slice(0, 10)) return "vencido";
  return "activo";
}
