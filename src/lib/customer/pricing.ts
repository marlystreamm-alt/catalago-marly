import { masterPlan } from "@/lib/stock/master-products";
import type { Service } from "@/lib/catalog/types";

export type CustomerTier = "retail" | "reseller";
export type PriceRow = { key: string; name: string; kind: string; months: number; retailCents: number | null; resellerCents: number | null; available: number; source: string; version: string | null; costCents?:number|null; provider?:string; image?:string; description?:string; published?:boolean|null };
export const normalizePriceName = (name: string) => name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function pricingKey(name: string, kind: string, months: number) {
  const canonical = masterPlan(name)?.code.toLowerCase() || normalizePriceName(name);
  return `${canonical}|${kind}|${months}`;
}
export function catalogPriceVariant(s: Service) {
  const name = normalizePriceName(s.name);
  const match = name.match(/\b(\d+) mes(?:es)?\b/) || name.match(/\b(\d+) ano(?:s)?\b/);
  const months = s.pricingMonths || (match ? Number(match[1]) * (/\b\d+ ano(?:s)?\b/.test(name) ? 12 : 1) : /\banual\b/.test(name) ? 12 : 1);
  const kind = s.onRequest ? `catalog-request-${s.sectionId || "otros"}` : s.sectionId === "perfiles" ? "profile" : s.sectionId === "completas" ? "complete" : `catalog-${s.sectionId || "otros"}`;
  return { key: pricingKey(s.name, kind, months), kind, months };
}
