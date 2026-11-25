import type { StockItem } from "@/lib/stock/types";

const normalize = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();

/** Select only a definite product match. Never choose between a full account and a profile. */
export function matchOrderStock(service: string, stock: StockItem[], today: string): StockItem | null {
  const product = normalize(service);
  if (!product) return null;
  const parents = new Set(stock.map(s => s.parentStockId).filter(Boolean));
  const matches = stock.filter(s => s.businessId === null && s.status === "available" && s.accountType !== "split_parent" && !parents.has(s.id) && (!s.expiresOn || s.expiresOn >= today) && s.username && s.password && [normalize(s.platform), normalize(`${s.platform} ${s.accountType}`)].includes(product));
  if (!matches.length || new Set(matches.map(s => `${normalize(s.platform)}:${s.stockKind}:${normalize(s.accountType)}`)).size !== 1) return null;
  return matches.sort((a,b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0];
}
