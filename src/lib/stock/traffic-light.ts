export type RenewalLimits = { red: number; yellow: number };
export const DEFAULT_RENEWAL_LIMITS: RenewalLimits = { red: 3, yellow: 7 };
export function renewalLimits(red?: string, yellow?: string): RenewalLimits {
  const r = Number(red || 3), y = Number(yellow || 7);
  return Number.isInteger(r) && Number.isInteger(y) && r >= 0 && y > r && y <= 365
    ? { red: r, yellow: y } : DEFAULT_RENEWAL_LIMITS;
}
export function daysRemaining(date: string | null, today: string): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const end = Date.parse(`${date}T12:00:00Z`), start = Date.parse(`${today}T12:00:00Z`);
  return Number.isFinite(end) && Number.isFinite(start) ? Math.round((end - start) / 86400000) : null;
}
export function renewalTone(days: number | null, limits = DEFAULT_RENEWAL_LIMITS) {
  return days == null ? "unknown" : days < 0 ? "expired" : days <= limits.red ? "red" : days <= limits.yellow ? "yellow" : "green";
}
export function inventoryTone(count: number) { return count === 0 ? "red" : count <= 2 ? "yellow" : "green"; }
export const INVENTORY_DOT_CLASSES = {
  red: "bg-red-500",
  yellow: "bg-amber-500",
  green: "bg-emerald-500",
};
export const TONE_CLASSES = {
  red: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200",
  yellow: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  green: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  expired: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
  unknown: "border-border bg-muted text-muted-foreground",
};
export type InventoryStock = {id:string; platform:string; stockKind:string; durationMonths?:number; parentStockId:string|null; accountType:string; status:string; expiresOn:string|null; username:string; password:string};
export function inventoryLevels(items: InventoryStock[], today:string, catalog: {name:string;kind:string;months:number;available:number}[] = [], key = (name:string,kind:string,months:number) => `${name.trim().toLowerCase()}|${kind}|${months}`) {
  const parents = new Set(items.map(x=>x.parentStockId).filter(Boolean));
  const groups = new Map<string,{key:string;platform:string;kind:string;months:number;available:number}>();
  const ensure = (platform:string,kind:string,months:number) => {
    const k=key(platform,kind,months);
    if(!groups.has(k)) groups.set(k,{key:k,platform,kind,months,available:0});
    return groups.get(k)!;
  };
  const authoritative = new Set<string>();
  for(const p of catalog) if(p.kind==="profile"||p.kind==="complete") {const group=ensure(p.name,p.kind,p.months);group.available=p.available;authoritative.add(group.key);}
  for(const x of items) {
    if(parents.has(x.id)||x.accountType==="split_parent") continue;
    const group=ensure(x.platform,x.stockKind,x.durationMonths||1);
    if(!authoritative.has(group.key)&&x.status==="available"&&x.username&&x.password&&(!x.expiresOn||x.expiresOn>=today)) group.available++;
  }
  return [...groups.values()].sort((a,b)=>a.available-b.available||a.platform.localeCompare(b.platform,"es")||a.kind.localeCompare(b.kind));
}
