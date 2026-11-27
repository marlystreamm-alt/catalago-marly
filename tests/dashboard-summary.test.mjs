import test from 'node:test';
import assert from 'node:assert/strict';
import { stockDashboardSummary } from '../src/lib/stock/dashboard-summary.ts';
const row = (id, extra = {}) => ({ id, platform:'Netflix',status:'available',parent_stock_id:null,expires_on:null,delivered_on:null,cost:0,sale_price:0,...extra });
test('expiration includes today through day seven and excludes stale available stock',()=>{
 const s=stockDashboardSummary([row('a',{expires_on:'2026-10-18'}),row('b',{expires_on:'2026-10-19'}),row('c',{status:'assigned',expires_on:'2026-10-26'}),row('d',{expires_on:'2026-10-27'})],'2026-10-19');
 assert.equal(s.available,2);assert.equal(s.expired,1);assert.equal(s.expiring,2);assert.equal(s.sold,1);
});
test('split parent is not counted and inherited profile costs do not inflate margin',()=>{
 const s=stockDashboardSummary([row('parent',{status:'expired',cost:100}),row('child',{parent_stock_id:'parent',status:'assigned',delivered_on:'2026-10-19',cost:100,sale_price:40})],'2026-10-19');
 assert.equal(s.expired,0);assert.equal(s.sold,1);assert.equal(s.revenue,40);assert.equal(s.marginSales,0);assert.equal(s.salesWithoutMargin,1);
});
test('monthly amounts exclude old and future sales and disclose missing financial data',()=>{
 const s=stockDashboardSummary([row('a',{status:'assigned',delivered_on:'2026-10-01',cost:35,sale_price:80}),row('b',{status:'expired',delivered_on:'2026-10-02',sale_price:50}),row('c',{status:'assigned',delivered_on:'2026-10-03'}),row('d',{status:'assigned',delivered_on:'2026-09-30',cost:1,sale_price:100}),row('e',{status:'assigned',delivered_on:'2026-10-20',cost:1,sale_price:100})],'2026-10-19');
 assert.equal(s.sales,3);assert.equal(s.revenue,130);assert.equal(s.margin,45);assert.equal(s.marginSales,1);assert.equal(s.salesWithoutMargin,2);assert.equal(s.salesWithoutPrice,1);
});

test('renewals distinguish today from the next seven days and exclude unsold units',()=>{
 const s=stockDashboardSummary([row('a',{status:'assigned',expires_on:'2026-10-19'}),row('b',{status:'expiring',expires_on:'2026-10-26'}),row('c',{expires_on:'2026-10-19'}),row('d',{status:'assigned',expires_on:'2026-10-18'})],'2026-10-19');
 assert.equal(s.renewToday,1);assert.equal(s.renewUpcoming,1);
});

test('platform counts merge case and aliases without mixing separate plans', () => {
  const summary = stockDashboardSummary([
    row('a', { platform: 'prime video' }),
    row('b', { platform: '  Prime   Video  ' }),
    row('c', { platform: 'PRIME VIDEO' }),
    row('d', { platform: 'Amazon Prime Video', status: 'assigned' }),
    row('e', { platform: 'Prime Video Sin Anuncios' }),
    row('f', { platform: 'MUBI' }),
    row('g', { platform: 'mubi', status: 'expired' }),
  ], '2026-10-19');

  assert.deepEqual(summary.platforms.find(group => group.platform === 'Prime Video'),
    { key: 'pri-base', platform: 'Prime Video', available: 3, sold: 1 });
  assert.equal(summary.platforms.find(group => group.platform === 'Prime Video S/A')?.available, 1);
  assert.equal(summary.platforms.filter(group => group.key === 'custom:mubi').length, 1);
});

test('historical inventory labels normalize across brands and preserve distinct offers', () => {
  const source = [
    'Disney', 'Disney ++', 'Disney anual completa', 'Disney + Vix anual',
    'Hbo', 'HBO max', 'HBO 3 meses', 'HBO Max 3 meses',
    'Net privada', 'Netflix privado', 'Netflix extra',
    'Paramoun tiii', 'Paramount+', 'Prime vídeo', 'Prime video 6m', 'VIX anual', 'ViX anual',
  ];
  const { platforms } = stockDashboardSummary(source.map((platform, index) => row(String(index), { platform })), '2026-11-27');
  const totals = Object.fromEntries(platforms.map((platform) => [platform.platform, platform.available]));
  assert.deepEqual(totals, {
    'Disney+': 2, 'Disney+ Anual': 1, 'Disney+ + ViX Anual': 1,
    'HBO Max': 2, 'HBO Max · 3 meses': 2,
    'Netflix Privado': 2, 'Netflix Extra': 1, 'Paramount+': 2,
    'Prime Video': 1, 'Prime Video · 6 meses': 1, 'ViX Anual': 2,
  });
});

test('platform cards retain every offer and keep bundles apart', async () => {
  const { groupPlatforms } = await import('../src/lib/stock/master-products.ts');
  const names = ['HBO 3 meses', 'Max Premium', 'HBO', 'Paramoun tiii', 'Paramount+ Premium',
    'Disney ++', 'Disney + Vix anual', 'Gemini', 'Link geminni 12 m', 'MUBI', 'mubi'];
  const groups = groupPlatforms(names, name => name);
  assert.deepEqual(groups.map(group => [group.name, group.items.length]), [
    ['HBO Max', 3], ['Paramount+', 2], ['Disney+', 1], ['Disney+ + ViX', 1], ['Gemini', 2], ['MUBI', 2],
  ]);
  assert.deepEqual(groups.flatMap(group => group.items).sort(), [...names].sort());
});
