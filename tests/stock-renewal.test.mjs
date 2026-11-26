import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const url=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const db=url(`export const supabaseAdmin={from:(table)=>globalThis.__renewalDB.from(table)};`);
const duration=url(`export const businessToday=()=>"2026-11-25";export const expiresAfterMonths=()=>"2026-12-25";`);
const source=compile(await readFile(new URL('../src/lib/stock/stock.server.ts',import.meta.url),'utf8')).replaceAll('"@/integrations/supabase/client.server"',JSON.stringify(db)).replaceAll("'./duration'",JSON.stringify(duration));
const api=await import(url(source));
function fixture(extra={}){
 const row={id:'stock-1',status:'assigned',business_id:null,client_name:'Fixture',delivered_on:'2026-10-25',expires_on:'2026-11-25',updated_at:'version-1',password_cipher:'unchanged',sale_price:55,...extra},writes=[],history=[];
 globalThis.__renewalDB={from:table=>{let patch=null;const filters=[];const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q},is:(k,v)=>{filters.push([k,v]);return q},update:p=>{patch=p;return q},insert:async p=>{assert.equal(table,'stock_history');history.push(p);return {error:null}},maybeSingle:async()=>{if(!filters.every(([k,v])=>row[k]===v))return {data:null,error:null};if(patch){writes.push(patch);Object.assign(row,patch);}return {data:{...row},error:null}}};return q;}};
 return {row,writes,history};
}
test('renewing updates only date, status and reminder and preserves sale and credentials',async()=>{
 const s=fixture();await api.updateMainRenewal('stock-1','version-1','2026-12-25');
 assert.equal(s.row.expires_on,'2026-12-25');assert.equal(s.row.renewal_notified_at,null);assert.equal(s.row.password_cipher,'unchanged');assert.equal(s.row.sale_price,55);assert.equal(s.history[0].action,'renovado');assert.deepEqual(Object.keys(s.writes[0]).sort(),['expires_on','renewal_notified_at','renewal_status','status','updated_at']);
});
test('stale, foreign, unassigned and invalid dates cannot change stock',async()=>{
 for(const [extra,version,date] of [[{},'wrong','2026-12-25'],[{business_id:'other'},'version-1','2026-12-25'],[{status:'available'},'version-1','2026-12-25'],[{},'version-1','2026-11-25'],[{},'version-1','2026-11-31']]){const s=fixture(extra);await assert.rejects(api.updateMainRenewal('stock-1',version,date));assert.equal(s.writes.length,0);}
});
test('marking an alert as sent does not renew or charge an account',async()=>{
 const s=fixture();await api.updateMainRenewal('stock-1','version-1');assert.equal(s.row.expires_on,'2026-11-25');assert.ok(s.row.renewal_notified_at);assert.deepEqual(Object.keys(s.writes[0]).sort(),['renewal_notified_at','updated_at']);
});
