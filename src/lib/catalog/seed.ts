import {
  DEFAULT_TEMPLATE,
  type AppState,
  type Catalog,
  type CatalogId,
  type Category,
  type Service,
  type SpaceType,
} from "./types";

const cat = (
  id: string,
  name: string,
  subsections: { id: string; name: string }[] = [],
): Category => ({
  id,
  name,
  subsections,
});

export const baseCategories = (): Category[] => [
  cat("streaming", "Streaming", [
    { id: "perfiles", name: "Streaming Perfiles" },
    { id: "completas", name: "Streaming Completas" },
  ]),
  cat("ia", "IA y Creatividad"),
  cat("actas", "Actas"),
  cat("sat", "SAT"),
  cat("imss", "IMSS"),
  cat("infonavit", "INFONAVIT"),
  cat("otros", "Otros trámites"),
];

type Seed = Omit<Service, "id" | "active" | "favorite"> & { active?: boolean };

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

const INMEDIATO = "20 a 25 min";
const G30 = "25 días";

const baseSeeds = (): Seed[] => [
  // Streaming - perfiles (clientes)
  s("Disney Premium",40,"streaming","perfiles","Disfruta películas, series y contenido para toda la familia de Disney, Pixar, Marvel, Star Wars, National Geographic y mucho más.","1","1",INMEDIATO,G30),
  s("Max Premium Hulu",38,"streaming","perfiles","Accede a una amplia variedad de películas, series, documentales, contenido infantil y producciones populares para disfrutar todos los días.","1","1",INMEDIATO,G30),
  s("Max Estándar",34,"streaming","perfiles","Disfruta series reconocidas, películas, documentales, contenido familiar y una gran selección de entretenimiento desde tu dispositivo.","1","1",INMEDIATO,G30),
  s("ViX Premium 1 mes",33,"streaming","perfiles","Disfruta durante un mes novelas, películas, series, programas y una amplia variedad de contenido premium completamente en español.","1","1",INMEDIATO,G30),
  s("ViX Premium Anual",36,"streaming","perfiles","Accede por tiempo prolongado a novelas, películas, series, programas y contenido premium en español para disfrutar cuando quieras.","1","1",INMEDIATO,G30),
  s("Prime Video S/A",34,"streaming","perfiles","Disfruta películas, series, documentales y producciones originales de Prime Video con una gran variedad de géneros para elegir.","1","1",INMEDIATO,G30),
  s("Paramount Premium",37,"streaming","perfiles","Encuentra películas, series, realities, contenido infantil y entretenimiento de reconocidas franquicias en un mismo lugar.","1","1",INMEDIATO,G30),
  s("Crunchyroll",37,"streaming","perfiles","Disfruta anime, nuevos episodios, temporadas completas y una gran selección de series populares para todos los fanáticos.","1","1",INMEDIATO,G30),

  // Streaming - completas (clientes)
  s("Disney Premium",95,"streaming","completas","Cuenta completa para disfrutar y compartir películas, series y contenido familiar de Disney, Pixar, Marvel, Star Wars y más.","3 a 5","3 a 5",INMEDIATO,G30),
  s("Max Premium Hulu",65,"streaming","completas","Cuenta completa con una amplia variedad de películas, series, documentales y entretenimiento para compartir en varios dispositivos.","3 a 5","3 a 5",INMEDIATO,G30),
  s("Max Estándar",60,"streaming","completas","Disfruta y comparte series populares, películas, documentales, contenido infantil y entretenimiento para todos los gustos.","3 a 5","3 a 5",INMEDIATO,G30),
  s("ViX Premium 1 mes",45,"streaming","completas","Cuenta completa por un mes con novelas, películas, series, programas y contenido premium en español para varios dispositivos.","3 a 5","3 a 5",INMEDIATO,G30),
  s("ViX Premium Anual",55,"streaming","completas","Cuenta completa de larga duración para compartir novelas, películas, series y una amplia selección de contenido premium en español.","3 a 5","3 a 5",INMEDIATO,G30),
  s("MUBI 3 meses",65,"streaming","completas","Disfruta durante tres meses una selección especial de cine internacional, clásicos, películas independientes y producciones reconocidas.","3 a 5","3 a 5",INMEDIATO,G30),
  s("Prime Video S/A",50,"streaming","completas","Cuenta completa para compartir películas, series, documentales y producciones originales de Prime Video en varios dispositivos.","3 a 5","3 a 5",INMEDIATO,G30),
  s("Universal",70,"streaming","completas","Disfruta películas, series y una selección variada de entretenimiento de Universal para compartir con familiares o amigos.","3 a 5","3 a 5",INMEDIATO,G30),
  s("Kocowa",44,"streaming","completas","Accede a dramas coreanos, programas de variedades, música y entretenimiento asiático para disfrutar en varios dispositivos.","3 a 5","3 a 5",INMEDIATO,G30),
  s("Paramount Premium",60,"streaming","completas","Cuenta completa con películas, series, realities, contenido infantil y entretenimiento para compartir en varios dispositivos.","3 a 5","3 a 5",INMEDIATO,G30),
  s("Crunchyroll",63,"streaming","completas","Cuenta completa para disfrutar anime, estrenos, temporadas completas y series populares desde varios dispositivos.","3 a 5","3 a 5",INMEDIATO,G30),
  s("Fox One",55,"streaming","completas","Disfruta una selección variada de películas, series y contenido de entretenimiento para compartir en varios dispositivos. Correo Yopmail.","3 a 5","3 a 5",INMEDIATO,G30),
  s("Netflix Privado",85,"streaming","completas","Cuenta privada para utilizarse en dos dispositivos, con una reproducción disponible a la vez y acceso al catálogo de películas, series y documentales.","2 (1 simultáneo)","Privada",INMEDIATO,G30),

  // IA y Creatividad (clientes)
  s("Gemini · 18 meses",150,"ia",null,"Utiliza herramientas de inteligencia artificial para estudiar, redactar, resumir información, generar ideas, organizar actividades y facilitar tareas personales o laborales.","","1",INMEDIATO,G30),
  s("Canva por invitación · 1 mes",45,"ia",null,"Crea diseños para redes sociales, invitaciones, presentaciones, videos, logotipos, flyers y muchos otros proyectos mediante plantillas y herramientas de edición.","","1",INMEDIATO,G30),
  s("Canva por invitación · 3 meses",100,"ia",null,"Crea diseños para redes sociales, invitaciones, presentaciones, videos, logotipos, flyers y muchos otros proyectos mediante plantillas y herramientas de edición.","","1",INMEDIATO,G30),
  s("Canva por invitación · 6 meses",180,"ia",null,"Crea diseños para redes sociales, invitaciones, presentaciones, videos, logotipos, flyers y muchos otros proyectos mediante plantillas y herramientas de edición.","","1",INMEDIATO,G30),
  s("Canva por invitación · 1 año",250,"ia",null,"Crea diseños para redes sociales, invitaciones, presentaciones, videos, logotipos, flyers y muchos otros proyectos mediante plantillas y herramientas de edición.","","1",INMEDIATO,G30),
  s("Canva por invitación · Permanente",390,"ia",null,"Crea diseños para redes sociales, invitaciones, presentaciones, videos, logotipos, flyers y muchos otros proyectos mediante plantillas y herramientas de edición.","","1",INMEDIATO,G30),
  // Actas
  s(
    "Acta de nacimiento",
    90,
    "actas",
    null,
    "Impresión certificada nacional en PDF.",
    "N/A",
    "N/A",
    "10 a 40 min",
    "Reimpresión 7 días",
  ),
  s(
    "Acta de matrimonio",
    110,
    "actas",
    null,
    "Copia certificada en PDF.",
    "N/A",
    "N/A",
    "10 a 60 min",
    "Reimpresión 7 días",
  ),
  s(
    "Acta de divorcio",
    130,
    "actas",
    null,
    "Copia certificada en PDF.",
    "N/A",
    "N/A",
    "1 a 24 h",
    "Reimpresión 7 días",
  ),
  s(
    "Acta de defunción",
    130,
    "actas",
    null,
    "Copia certificada en PDF.",
    "N/A",
    "N/A",
    "1 a 24 h",
    "Reimpresión 7 días",
  ),
  // SAT
  s(
    "Constancia de situación fiscal",
    60,
    "sat",
    null,
    "CSF actualizada en PDF con RFC y CIEC.",
    "N/A",
    "N/A",
    "10 a 30 min",
    "Reenvío 7 días",
  ),
  s(
    "Opinión de cumplimiento 32-D",
    80,
    "sat",
    null,
    "Opinión positiva del SAT en PDF.",
    "N/A",
    "N/A",
    "10 a 60 min",
    "Reenvío 7 días",
  ),
  s(
    "Cédula fiscal",
    50,
    "sat",
    null,
    "Cédula de identificación fiscal en PDF.",
    "N/A",
    "N/A",
    "10 a 30 min",
    "Reenvío 7 días",
  ),
  // IMSS
  s(
    "Número de Seguridad Social (NSS)",
    60,
    "imss",
    null,
    "Asignación o consulta de NSS.",
    "N/A",
    "N/A",
    "15 a 60 min",
    "Reenvío 7 días",
  ),
  s(
    "Vigencia de derechos IMSS",
    60,
    "imss",
    null,
    "Constancia de vigencia en PDF.",
    "N/A",
    "N/A",
    "15 a 60 min",
    "Reenvío 7 días",
  ),
  s(
    "Semanas cotizadas IMSS",
    70,
    "imss",
    null,
    "Reporte de semanas cotizadas en PDF.",
    "N/A",
    "N/A",
    "15 a 60 min",
    "Reenvío 7 días",
  ),
  // INFONAVIT
  s(
    "Estado de cuenta INFONAVIT",
    80,
    "infonavit",
    null,
    "Estado de cuenta del crédito en PDF.",
    "N/A",
    "N/A",
    "30 a 90 min",
    "Reenvío 7 días",
  ),
  s(
    "Precalificación INFONAVIT",
    90,
    "infonavit",
    null,
    "Puntos y precalificación de crédito.",
    "N/A",
    "N/A",
    "30 a 90 min",
    "Reenvío 7 días",
  ),
  // Otros
  s(
    "CURP certificada",
    40,
    "otros",
    null,
    "CURP con código QR en PDF.",
    "N/A",
    "N/A",
    "5 a 20 min",
    "Reenvío 7 días",
  ),
  s(
    "Constancia de no antecedentes",
    250,
    "otros",
    null,
    "Trámite estatal, sujeto a disponibilidad.",
    "N/A",
    "N/A",
    "1 a 3 días",
    "Sin garantía",
  ),
];

const ratio: Record<CatalogId, number> = {
  clientes: 1,
  cyberdoc: 0.8,
  revendedores: 1,
};

function catalogPrice(id: CatalogId, seed: Seed): number {
  if (id !== "revendedores") return roundPrice(seed.price * (ratio[id] ?? 1));
  if (seed.categoryId === "streaming") return Math.max(0, seed.price - 20);
  if (seed.categoryId === "ia") {
    if (seed.name.startsWith("Gemini")) return 90;
    const canva: Record<number, number> = { 45: 22, 100: 77, 180: 157, 250: 227, 390: 367 };
    return canva[seed.price] ?? seed.price;
  }
  return seed.price;
}

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
    price: catalogPrice(id, seed),
    sectionId: seed.categoryId === "streaming" ? (seed.subsectionId ?? "perfiles") : seed.categoryId === "ia" ? "ia-creatividad" : "tramites",
    active: true,
    favorite: false,
  }));
  return {
    id,
    name: meta[id]?.name ?? id,
    subtitle: meta[id]?.subtitle ?? "",
    spaceType: "catalog",
    imageUrl: "",
    whatsappNumber: "5215500000000",
    whatsappTemplate: DEFAULT_TEMPLATE,
    individualWhatsappEnabled: false,
    commercialFieldsEnabled: true,
    hidden: false,
    sectionLabels: { perfiles: "Streaming Perfiles", completas: "Streaming Completas", "ia-creatividad": "IA y Creatividad", tramites: "Trámites" },
    sectionTabs: [
      { id: "perfiles", name: "Streaming Perfiles", hidden: false },
      { id: "completas", name: "Streaming Completas", hidden: false },
      { id: "ia-creatividad", name: "IA y Creatividad", hidden: false },
      { id: "tramites", name: "Trámites", hidden: false },
    ],
    categories: baseCategories(),
    services,
    log: [],
  };
}

export const SEED_VERSION = 2;

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

/** Pestaña nueva creada por la administradora con una tarjeta de ejemplo. */
export function createEmptyCatalog(
  id: CatalogId,
  name: string,
  subtitle: string,
  spaceType: SpaceType = "catalog",
  imageUrl = "",
): Catalog {
  const templates: Record<SpaceType, { category: Category; service: Omit<Service, "id"> }> = {
    catalog: {
      category: { id: "general", name: "General", subsections: [] },
      service: { name: "Producto o servicio de ejemplo", price: 0, categoryId: "general", subsectionId: null, sectionId: "perfiles", description: "Edita esta tarjeta con tu información.", devices: "", profiles: "", delivery: "", warranty: "", active: true, favorite: false, priceText: "Consultar" },
    },
    menu: {
      category: { id: "platillos", name: "Platillos", subsections: [] },
      service: { name: "Platillo de ejemplo", price: 0, categoryId: "platillos", subsectionId: null, description: "Agrega descripción, precio, extras y fotografía.", devices: "", profiles: "", delivery: "", warranty: "", active: true, favorite: false, priceText: "$0" },
    },
    directory: {
      category: { id: "contactos", name: "Contactos", subsections: [] },
      service: { name: "Contacto de ejemplo", price: 0, categoryId: "contactos", subsectionId: null, description: "Agrega nombre, teléfono, categoría y datos de contacto.", devices: "", profiles: "", delivery: "", warranty: "", active: true, favorite: false, priceText: "" },
    },
    provider: {
      category: { id: "proveedores", name: "Proveedores", subsections: [] },
      service: { name: "Proveedor de ejemplo", price: 0, categoryId: "proveedores", subsectionId: null, description: "Agrega proveedor, servicio, contacto y notas.", devices: "", profiles: "", delivery: "", warranty: "", active: true, favorite: false, priceText: "" },
    },
    marketplace: {
      category: { id: "productos", name: "Productos", subsections: [] },
      service: { name: "Producto de ejemplo", price: 0, categoryId: "productos", subsectionId: null, description: "Agrega precio, estado, fotografía y datos de contacto.", devices: "", profiles: "", delivery: "", warranty: "", active: true, favorite: false, priceText: "Consultar" },
    },
  };
  const tpl = templates[spaceType];
  return {
    id,
    name,
    subtitle,
    spaceType,
    imageUrl,
    whatsappNumber: "5215500000000",
    whatsappTemplate: DEFAULT_TEMPLATE,
    individualWhatsappEnabled: false,
    commercialFieldsEnabled: true,
    hidden: false,
    sectionLabels: spaceType === "catalog" ? { perfiles: "Streaming Perfiles", completas: "Streaming Completas", "ia-creatividad": "IA y Creatividad", tramites: "Trámites" } : undefined,
    sectionTabs: spaceType === "catalog" ? [
      { id: "perfiles", name: "Streaming Perfiles", hidden: false },
      { id: "completas", name: "Streaming Completas", hidden: false },
      { id: "ia-creatividad", name: "IA y Creatividad", hidden: false },
      { id: "tramites", name: "Trámites", hidden: false },
    ] : [],
    categories: [tpl.category],
    services: [{ ...tpl.service, id: `${id}-ejemplo-1`, sortIndex: 0 }],
    log: [],
  };
}
