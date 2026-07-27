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
}

export interface Catalog {
  id: CatalogId;
  name: string;
  subtitle: string;
  whatsappNumber: string;
  whatsappTemplate: string;
  categories: Category[];
  services: Service[];
}

export interface AppState {
  version: number;
  catalogs: Record<CatalogId, Catalog>;
}

export const CATALOG_IDS: CatalogId[] = ["clientes", "cyberdoc", "revendedores"];

export const DEFAULT_TEMPLATE =
  "Hola, me interesa {servicio} por {precio}. Detalles: {detalles}";
