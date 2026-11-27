export const MASTER_PLANS = [
  { code:"DIS-STD", name:"Disney+ Estándar", aliases:["Disney Estándar","Disney Standard"] },
  { code:"DIS-PRE", name:"Disney+ Premium", aliases:["Disney Premium"] },
  { code:"MAX-STD", name:"Max Estándar", aliases:["HBO Max Estándar","HBO Estándar","Max Standard"] },
  { code:"MAX-PRE", name:"Max Premium", aliases:["HBO Max Premium","HBO Premium"] },
  { code:"MAX-HULU", name:"Max Premium Hulu", aliases:["HBO Max Premium Hulu"] },
  { code:"NET-PRI", name:"Netflix Privado", aliases:[] },
  { code:"NET-STD", name:"Netflix Estándar", aliases:["Netflix Standard"] },
  { code:"NET-PRE", name:"Netflix Premium", aliases:[] },
  { code:"PAR-PRE", name:"Paramount+ Premium", aliases:["Paramount Premium"] },
  { code:"PAR-BASE", name:"Paramount+", aliases:["Paramount"] },
  { code:"PRI-BASE", name:"Prime Video", aliases:["Amazon Prime Video"] },
  { code:"PRI-SA", name:"Prime Video S/A", aliases:["Prime Video Sin Anuncios"] },
  { code:"CRU-BASE", name:"Crunchyroll", aliases:[] },
  { code:"VIX-MES", name:"ViX Premium 1 mes", aliases:["ViX Premium mensual"] },
  { code:"VIX-ANO", name:"ViX Premium Anual", aliases:["ViX Premium 1 año"] },
  { code:"FOX-ONE", name:"Fox One", aliases:[] },
] as const;

const normalized = (value:string) => value.normalize("NFD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
const kinds = [{kind:"profile",suffix:"PER",labels:["perfil","perfiles","perfil individual"]},{kind:"complete",suffix:"COM",labels:["completa","completo","cuenta completa","cuenta completo"]}] as const;
export type MasterKind = "profile"|"complete";
export function masterPlan(name:string) { const n=normalized(name);return MASTER_PLANS.find(p=>[p.name,...p.aliases].some(a=>normalized(a)===n))||null; }
export function masterProduct(name:string,kind:MasterKind) { const plan=masterPlan(name);const suffix=kind==="profile"?"PER":"COM";if(plan)return `${plan.code}-${suffix}`;const existing=recognizeOrderProduct(name);return existing?.endsWith(`-${suffix}`)?existing:null; }
export function recognizeOrderProduct(name:string) {
  const n=normalized(name);
  for(const p of MASTER_PLANS) for(const k of kinds) for(const a of [p.name,...p.aliases]) for(const label of k.labels) if(n===normalized(`${a} ${label}`)||n===normalized(`${label} ${a}`))return `${p.code}-${k.suffix}`;
  return null;
}
export function isPlanFamily(name:string){return /^(disney|hbo|max|netflix|paramount|prime|amazon prime|vix|crunchyroll|fox one)\b/i.test(normalized(name));}

const legacyStockLabels = new Map(Object.entries({
  "disney": "Disney+",
  "disney anual": "Disney+ Anual",
  "disney anual completa": "Disney+ Anual",
  "disney mes": "Disney+ Mensual",
  "disney vix anual": "Disney+ + ViX Anual",
  "hbo": "HBO Max",
  "max": "HBO Max",
  "hbo max": "HBO Max",
  "hbo 3 meses": "HBO Max · 3 meses",
  "hbo max 3 meses": "HBO Max · 3 meses",
  "kocowa": "KOCOWA",
  "link de gemini": "Gemini",
  "link geminni 12 m": "Gemini · 12 meses",
  "microsoft": "Microsoft",
  "microsoft 365": "Microsoft 365",
  "mubi": "MUBI",
  "net privada": "Netflix Privado",
  "net privado": "Netflix Privado",
  "netflix privada": "Netflix Privado",
  "netflix": "Netflix",
  "netflix extra": "Netflix Extra",
  "paramoun tiii": "Paramount+",
  "prime video 6m": "Prime Video · 6 meses",
  "vix anual": "ViX Anual",
}));

export function stockPlatform(name: string) {
  const original = name.trim().replace(/\s+/g, " ") || "Sin plataforma";
  const label = legacyStockLabels.get(normalized(original)) ?? original;
  const plan = masterPlan(label);
  return plan
    ? { key: plan.code.toLowerCase(), label: plan.name }
    : { key: `custom:${normalized(label)}`, label };
}

// Display families only. Checkout and assignment still use the selected product key.
const brands: [RegExp, string][] = [
  [/\b(?:hbo|max)\b/, "HBO Max"], [/\bparamount\b/, "Paramount+"],
  [/\bdisney\b/, "Disney+"], [/\bvix\b/, "ViX"], [/\bnetflix\b/, "Netflix"],
  [/\bprime video\b/, "Prime Video"], [/\bgemini\b/, "Gemini"],
  [/\bcrunchyroll\b/, "Crunchyroll"], [/\bcanva\b/, "Canva"],
  [/\bspotify\b/, "Spotify"], [/\byoutube\b/, "YouTube"],
  [/\bclaro video\b/, "Claro Video"], [/\buniversal\b/, "Universal+"],
  [/\bhulu\b/, "Hulu"], [/\bfox one\b/, "Fox One"], [/\bmicrosoft 365\b/, "Microsoft 365"],
  [/\bapple tv\b/, "Apple TV+"],
];

export function platformFamily(name: string) {
  const { label } = stockPlatform(name);
  const words = normalized(label);
  const found = [...new Set(brands.filter(([pattern]) => pattern.test(words)).map(([, brand]) => brand))];
  if (found.length > 1) return found.join(" + ");
  if (/\s\+\s|\bcombo\b/i.test(label)) return label;
  return found[0] ?? label;
}

export function groupPlatforms<T>(items: T[], nameOf: (item: T) => string) {
  const groups = new Map<string, { name: string; items: T[] }>();
  for (const item of items) {
    const name = platformFamily(nameOf(item));
    const key = normalized(name);
    const group = groups.get(key) ?? { name, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return Array.from(groups.values());
}
