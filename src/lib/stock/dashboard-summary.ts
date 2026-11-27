import { stockPlatform } from './master-products.ts';

export type DashboardStock = {
  id: string; platform: string; status: string; parent_stock_id: string | null;
  expires_on: string | null; delivered_on: string | null; cost: number | null; sale_price: number | null;
  archived_sale?: boolean;
};
export function stockDashboardSummary(rows: DashboardStock[], today: string) {
  const month = today.slice(0, 7);
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 7);
  const weekEnd = end.toISOString().slice(0, 10);
  const current = rows.filter(r => !r.archived_sale);
  const parents = new Set(current.map(r => r.parent_stock_id).filter(Boolean));
  // A complete account split into profiles is a container, not another sellable unit.
  const units = current.filter(r => !parents.has(r.id));
  const saleUnits = [...units, ...rows.filter(r => r.archived_sale)];
  const expired = (r: DashboardStock) => r.status === 'expired' || Boolean(r.expires_on && r.expires_on < today);
  const isAvailable = (r: DashboardStock) => r.status === 'available' && !expired(r);
  const isSold = (r: DashboardStock) => ['assigned', 'expiring'].includes(r.status) && !expired(r);
  const available = units.filter(isAvailable);
  const sold = units.filter(isSold);
  const expiring = units.filter(r => r.status !== 'review' && !expired(r) && r.expires_on && r.expires_on >= today && r.expires_on <= weekEnd);
  const sales = saleUnits.filter(r => r.delivered_on?.slice(0, 7) === month && r.delivered_on <= today && r.status !== 'available');
  const priced = sales.filter(r => Number(r.sale_price) > 0);
  // Derived profiles inherit their parent's cost. Do not count that duplicated cost as a margin.
  const withMargin = priced.filter(r => !r.parent_stock_id && Number(r.cost) > 0);
  const revenue = priced.reduce((sum, r) => sum + Number(r.sale_price), 0);
  const margin = withMargin.reduce((sum, r) => sum + Number(r.sale_price) - Number(r.cost), 0);
  const byPlatform = new Map<string, { key: string; platform: string; available: number; sold: number }>();
  for (const unit of units) {
    const { key, label } = stockPlatform(unit.platform);
    const group = byPlatform.get(key) ?? { key, platform: label, available: 0, sold: 0 };
    if (isAvailable(unit)) group.available++;
    if (isSold(unit)) group.sold++;
    byPlatform.set(key, group);
  }
  const platforms = [...byPlatform.values()].sort((a, b) =>
    b.available - a.available || a.platform.localeCompare(b.platform, 'es'));
  const daily = Array.from({length:7},(_,index)=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-6+index);const date=d.toISOString().slice(0,10);const sold=saleUnits.filter(r=>r.delivered_on===date&&r.status!=='available');return {date,count:sold.length,total:Math.round(sold.reduce((sum,r)=>sum+Number(r.sale_price||0),0)*100)/100};});
  return { daily, today, weekEnd, month, available: available.length, sold: sold.length, expiring: expiring.length,
    expired: units.filter(expired).length,
    renewToday: units.filter(r => r.status !== "available" && r.status !== "review" && r.expires_on === today).length,
    renewUpcoming: units.filter(r => r.status !== "available" && r.status !== "review" && r.expires_on && r.expires_on > today && r.expires_on <= weekEnd).length,
    replacements: units.filter(r => ['client_replacement','provider_replacement'].includes(r.status)).length,
    revenue: Math.round(revenue * 100) / 100, margin: Math.round(margin * 100) / 100,
    sales: sales.length, salesWithoutPrice: sales.length - priced.length,
    marginSales: withMargin.length, salesWithoutMargin: sales.length - withMargin.length, platforms };
}
