import {
  DEFAULT_TEMPLATE,
  type AppState,
  type Catalog,
  type CatalogId,
  type Category,
  type Service,
} from "./types";

const cat = (id: string, name: string, subsections: { id: string; name: string }[] = []): Category => ({
  id,
  name,
  subsections,
});

export const baseCategories = (): Category[] => [
  cat("streaming", "Streaming", [
    { id: "perfiles", name: "Perfiles (1 dispositivo)" },
    { id: "completas", name: "Completas (3 a 4 dispositivos)" },
  ]),
  cat("ia", "IA y productividad"),
  cat("actas", "Actas"),
  cat("sat", "SAT"),
  cat("imss", "IMSS"),
  cat("infonavit", "INFONAVIT"),
  cat("otros", "Otros trámites"),
];

type Seed = Omit<Service, "id" | "active"> & { active?: boolean };

const s = (
  name: string,
  price: number,
  categoryId: string,
  subsectionId: string | null,
  description: string,
  devices: string,
  profiles: string,
  delivery: string,
  warranty: string,
): Seed => ({
  name,
  price,
  categoryId,
  subsectionId,
  description,
  devices,
  profiles,
  delivery,
  warranty,
});

const INMEDIATO = "Inmediato (5 a 30 min)";
const G30 = "30 días";

const baseSeeds = (): Seed[] => [
  // Streaming - perfiles
  s("Netflix Perfil", 65, "streaming", "perfiles", "Perfil individual, 1 mes.", "1", "1", INMEDIATO, G30),
  s("Disney+ Perfil", 55, "streaming", "perfiles", "Perfil individual, 1 mes.", "1", "1", INMEDIATO, G30),
  s("HBO Max Perfil", 55, "streaming", "perfiles", "Perfil individual, 1 mes.", "1", "1", INMEDIATO, G30),
  s("Prime Video Perfil", 45, "streaming", "perfiles", "Perfil individual, 1 mes.", "1", "1", INMEDIATO, G30),
  s("Crunchyroll Perfil", 45, "streaming", "perfiles", "Perfil individual, 1 mes.", "1", "1", INMEDIATO, G30),
  s("Paramount+ Perfil", 45, "streaming", "perfiles", "Perfil individual, 1 mes.", "1", "1", INMEDIATO, G30),
  s("ViX Premium Perfil", 45, "streaming", "perfiles", "Perfil individual, 1 mes.", "1", "1", INMEDIATO, G30),
  s("Apple TV+ con MLS Perfil", 60, "streaming", "perfiles", "Incluye MLS Season Pass.", "1", "1", INMEDIATO, G30),
  s("Fox One Perfil", 55, "streaming", "perfiles", "Deportes en vivo, 1 mes.", "1", "1", INMEDIATO, G30),
  s("MUBI Perfil", 50, "streaming", "perfiles", "Cine de autor, 1 mes.", "1", "1", INMEDIATO, G30),
  // Streaming - completas
  s("Netflix Completa", 199, "streaming", "completas", "Cuenta completa, 1 mes.", "4", "4-5", INMEDIATO, G30),
  s("Disney+ Completa", 169, "streaming", "completas", "Cuenta completa, 1 mes.", "4", "4", INMEDIATO, G30),
  s("HBO Max Completa", 159, "streaming", "completas", "Cuenta completa, 1 mes.", "3", "3-5", INMEDIATO, G30),
  s("Prime Video Completa", 139, "streaming", "completas", "Cuenta completa, 1 mes.", "3", "3-6", INMEDIATO, G30),
  s("Crunchyroll Completa", 129, "streaming", "completas", "Cuenta completa, 1 mes.", "4", "4", INMEDIATO, G30),
  s("Paramount+ Completa", 129, "streaming", "completas", "Cuenta completa, 1 mes.", "3", "3-6", INMEDIATO, G30),
  s("Plex Pass", 149, "streaming", "completas", "Plex Pass 1 mes, servidor propio.", "4", "N/A", INMEDIATO, G30),
  // IA / productividad
  s("Canva Pro", 99, "ia", null, "Canva Pro por 1 mes en tu correo.", "Ilimitado", "1", INMEDIATO, G30),
  s("Gemini Advanced", 179, "ia", null, "Gemini Advanced 1 mes con 2 TB.", "Ilimitado", "1", INMEDIATO, G30),
  s("ChatGPT Plus", 349, "ia", null, "Acceso Plus por 1 mes.", "Ilimitado", "1", "1 a 12 h", G30),
  s("Microsoft 365", 129, "ia", null, "Office 365 por 1 mes, 1 TB OneDrive.", "5", "1", "1 a 12 h", G30),
  // Actas
  s("Acta de nacimiento", 90, "actas", null, "Impresión certificada nacional en PDF.", "N/A", "N/A", "10 a 40 min", "Reimpresión 7 días"),
  s("Acta de matrimonio", 110, "actas", null, "Copia certificada en PDF.", "N/A", "N/A", "10 a 60 min", "Reimpresión 7 días"),
  s("Acta de divorcio", 130, "actas", null, "Copia certificada en PDF.", "N/A", "N/A", "1 a 24 h", "Reimpresión 7 días"),
  s("Acta de defunción", 130, "actas", null, "Copia certificada en PDF.", "N/A", "N/A", "1 a 24 h", "Reimpresión 7 días"),
  // SAT
  s("Constancia de situación fiscal", 60, "sat", null, "CSF actualizada en PDF con RFC y CIEC.", "N/A", "N/A", "10 a 30 min", "Reenvío 7 días"),
  s("Opinión de cumplimiento 32-D", 80, "sat", null, "Opinión positiva del SAT en PDF.", "N/A", "N/A", "10 a 60 min", "Reenvío 7 días"),
  s("Cédula fiscal", 50, "sat", null, "Cédula de identificación fiscal en PDF.", "N/A", "N/A", "10 a 30 min", "Reenvío 7 días"),
  // IMSS
  s("Número de Seguridad Social (NSS)", 60, "imss", null, "Asignación o consulta de NSS.", "N/A", "N/A", "15 a 60 min", "Reenvío 7 días"),
  s("Vigencia de derechos IMSS", 60, "imss", null, "Constancia de vigencia en PDF.", "N/A", "N/A", "15 a 60 min", "Reenvío 7 días"),
  s("Semanas cotizadas IMSS", 70, "imss", null, "Reporte de semanas cotizadas en PDF.", "N/A", "N/A", "15 a 60 min", "Reenvío 7 días"),
  // INFONAVIT
  s("Estado de cuenta INFONAVIT", 80, "infonavit", null, "Estado de cuenta del crédito en PDF.", "N/A", "N/A", "30 a 90 min", "Reenvío 7 días"),
  s("Precalificación INFONAVIT", 90, "infonavit", null, "Puntos y precalificación de crédito.", "N/A", "N/A", "30 a 90 min", "Reenvío 7 días"),
  // Otros
  s("CURP certificada", 40, "otros", null, "CURP con código QR en PDF.", "N/A", "N/A", "5 a 20 min", "Reenvío 7 días"),
  s("Constancia de no antecedentes", 250, "otros", null, "Trámite estatal, sujeto a disponibilidad.", "N/A", "N/A", "1 a 3 días", "Sin garantía"),
];

const ratio: Record<CatalogId, number> = {
  clientes: 1,
  cyberdoc: 0.8,
  revendedores: 0.7,
};

const meta: Record<CatalogId, { name: string; subtitle: string }> = {
  clientes: { name: "Mis Clientes", subtitle: "Catálogo de servicios" },
  cyberdoc: { name: "Cyberdoc", subtitle: "Catálogo de proveedor" },
  revendedores: { name: "Revendedores", subtitle: "Precios para revendedores" },
};

const roundPrice = (n: number) => Math.max(5, Math.round(n / 5) * 5);

function buildCatalog(id: CatalogId): Catalog {
  const services: Service[] = baseSeeds().map((seed, i) => ({
    ...seed,
    id: `${id}-${i + 1}`,
    price: roundPrice(seed.price * ratio[id]),
    active: true,
  }));
  return {
    id,
    name: meta[id].name,
    subtitle: meta[id].subtitle,
    whatsappNumber: "5215500000000",
    whatsappTemplate: DEFAULT_TEMPLATE,
    categories: baseCategories(),
    services,
  };
}

export const SEED_VERSION = 1;

export function createSeedState(): AppState {
  return {
    version: SEED_VERSION,
    catalogs: {
      clientes: buildCatalog("clientes"),
      cyberdoc: buildCatalog("cyberdoc"),
      revendedores: buildCatalog("revendedores"),
    },
  };
}
