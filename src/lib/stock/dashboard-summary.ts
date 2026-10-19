export type DashboardStock = {
  id: string; platform: string; status: string; parent_stock_id: string | null;
  expires_on: string | null; delivered_on: string | null; cost: number | null; sale_price: number | null;
};
export function stockDashboardSummary(rows: DashboardStock[], today: string) {
  const month = today.slice(0, 7);
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 7);
  const weekEnd = end.toISOString().slice(0, 10);
  const parents = new Set(rows.map(r => r.parent_stock_id).filter(Boolean));
  // A complete account split into profiles is a container, not another sellable unit.
  const units = rows.filter(r => !parents.has(r.id));
  const expired = (r: DashboardStock) => r.status === 'expired' || Boolean(r.expires_on && r.expires_on < today);
  const available = units.filter(r => r.status === 'available' && !expired(r));
  const sold = units.filter(r => ['assigned', 'expiring'].includes(r.status) && !expired(r));
  const expiring = units.filter(r => !expired(r) && r.expires_on && r.expires_on >= today && r.expires_on <= weekEnd);
  const sales = units.filter(r => r.delivered_on?.slice(0, 7) === month && r.delivered_on <= today && r.status !== 'available');
  const priced = sales.filter(r => Number(r.sale_price) > 0);
  // Derived profiles inherit their parent's cost. Do not count that duplicated cost as a margin.
  const withMargin = priced.filter(r => !r.parent_stock_id && Number(r.cost) > 0);
  const revenue = priced.reduce((sum, r) => sum + Number(r.sale_price), 0);
  const margin = withMargin.reduce((sum, r) => sum + Number(r.sale_price) - Number(r.cost), 0);
  const platforms = [...new Set(units.map(r => r.platform.trim() || 'Sin plataforma'))].map(platform => ({
    platform,
    available: available.filter(r => (r.platform.trim() || 'Sin plataforma') === platform).length,
    sold: sold.filter(r => (r.platform.trim() || 'Sin plataforma') === platform).length,
  })).sort((a,b) => b.available - a.available || a.platform.localeCompare(b.platform, 'es'));
  return { today, weekEnd, month, available: available.length, sold: sold.length, expiring: expiring.length,
    expired: units.filter(expired).length,
    replacements: units.filter(r => ['client_replacement','provider_replacement'].includes(r.status)).length,
    revenue: Math.round(revenue * 100) / 100, margin: Math.round(margin * 100) / 100,
    sales: sales.length, salesWithoutPrice: sales.length - priced.length,
    marginSales: withMargin.length, salesWithoutMargin: sales.length - withMargin.length, platforms };
}
