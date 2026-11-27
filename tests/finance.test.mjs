import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import ts from 'typescript';
const src=await readFile(new URL('../src/lib/workspace/finance.ts',import.meta.url),'utf8');const {cashBalance,cashTotals,financeClock,canIncludePrevious}=await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64')}`);
test('cash transfers do not inflate company income or expenses, voided entries are excluded',()=>{const a={id:'a',opening_cents:1000},b={id:'b',opening_cents:0};const base={occurred_on:'2026-11-25',voided_at:null};const moves=[{...base,kind:'income',account_id:'a',amount_cents:5000},{...base,kind:'expense',account_id:'a',amount_cents:1000},{...base,kind:'transfer',account_id:'a',to_account_id:'b',amount_cents:2000},{...base,kind:'income',account_id:'b',amount_cents:99999,voided_at:'2026-11-25'}];assert.equal(cashBalance(a,moves),3000);assert.equal(cashBalance(b,moves),2000);assert.deepEqual(cashTotals(moves,'2026-11-25','2026-11-25'),{income:5000,expense:1000,net:4000});});
test('Monterrey midnight reconciliation ends at 00:30; payments default to the new date',()=>{const at=new Date('2026-11-27T06:20:00Z');assert.deepEqual(financeClock(at),{day:'2026-11-27',previous:'2026-11-26',reconciling:true});assert.equal(canIncludePrevious('2026-11-27T06:05:00Z',at),true);assert.equal(canIncludePrevious('2026-11-27T05:59:00Z',at),false);assert.equal(canIncludePrevious('2026-11-27T06:30:00Z',new Date('2026-11-27T06:31:00Z')),false);assert.equal(canIncludePrevious('2026-11-27T06:05:00Z',new Date('2026-11-27T06:30:00Z')),false);assert.equal(financeClock(new Date('2027-01-01T06:10:00Z')).previous,'2026-12-31');});

test("quick entry posts with the Saltillo date and no folio or notes", async () => {
  const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  const mocks = {
    "@tanstack/react-start": moduleUrl("export const createServerFn=()=>({validator:v=>({handler:h=>({data})=>h({data:v(data)})})});"),
    "zod": import.meta.resolve("zod"),
    "./finance": moduleUrl('export const financeToday=()=>"2026-11-27";export const canIncludePrevious=()=>false;'),
    "@/lib/notify/notify.server": moduleUrl('export const requireAdminCode=async code=>{if(code!=="fixture")throw Error("No autorizado")};'),
    "./operations.server": moduleUrl(`export const opsDB=()=>({from(table){return {async insert(row){
      globalThis.__financeQuickWrites.push({table,row}); return {error:null};
    }}}});`),
  };
  let functions = ts.transpileModule(
    await readFile(new URL("../src/lib/workspace/finance.functions.ts", import.meta.url), "utf8"),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
  ).outputText;
  for (const [name, url] of Object.entries(mocks)) functions = functions.replaceAll(JSON.stringify(name), JSON.stringify(url));
  const { financeQuickMove } = await import(moduleUrl(functions));
  globalThis.__financeQuickWrites = [];
  const requestId = crypto.randomUUID(), account = crypto.randomUUID();
  const data = { code: "fixture", kind: "expense", requestId, account, amount: 1929, category: "Proveedor" };

  await assert.rejects(financeQuickMove({ data: { ...data, code: "wrong" } }), /No autorizado/);
  assert.equal(globalThis.__financeQuickWrites.length, 0);
  assert.deepEqual(await financeQuickMove({ data: { ...data, date: "2020-01-01", note: "ignored" } }), { saved: true });
  assert.deepEqual(globalThis.__financeQuickWrites, [{
    table: "ma2_finance_moves",
    row: { id: requestId, kind: "expense", account_id: account, to_account_id: null,
      amount_cents: 1929, occurred_on: "2026-11-27", category: "Proveedor", note: "", reference: "" },
  }]);
  delete globalThis.__financeQuickWrites;
});
