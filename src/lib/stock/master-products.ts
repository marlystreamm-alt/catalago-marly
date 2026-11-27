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

export function stockPlatform(name: string) {
  const label = name.trim().replace(/\s+/g, " ") || "Sin plataforma";
  const plan = masterPlan(label);
  return plan
    ? { key: plan.code.toLowerCase(), label: plan.name }
    : { key: `custom:${label.toLocaleLowerCase("es-MX")}`, label };
}
