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
