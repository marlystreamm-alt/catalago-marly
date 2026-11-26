import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const url = s => `data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
async function compile(file, replacements = {}) {
  let source = ts.transpileModule(await readFile(new URL(`../${file}`, import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  for (const [key, value] of Object.entries(replacements)) source = source.replaceAll(JSON.stringify(key), JSON.stringify(value));
  return url(source);
}
const identityURL = await compile("src/lib/customer/purchase-identity.server.ts");
const { purchaseRecordId } = await import(identityURL);
test("purchase IDs are stable and separated across notifications, documents, and renewal dates", () => {
  const order = crypto.randomUUID();
  const ids = [purchaseRecordId("notice",order),purchaseRecordId("document",order),purchaseRecordId("renewal",order,"2099-01-01"),purchaseRecordId("renewal",order,"2099-02-01")];
  assert.equal(new Set(ids).size, 4);
  assert.equal(ids[0], purchaseRecordId("notice",order));
  assert.equal(purchaseRecordId("public-order",order,"same"),purchaseRecordId("public-order",order,"same"));
  assert.notEqual(purchaseRecordId("public-order",order,"same"),purchaseRecordId("public-order",order,"different"));
  assert.ok(ids.every(id => /^[a-f0-9-]{36}$/.test(id) && id !== order));
});
const { parseCyberDocsMessage } = await import(await compile("src/lib/cyberdocs/parser.ts"));
const { extraOrderDetails } = await import(await compile("src/lib/cyberdocs/order-details.ts"));
const { isOnRequestMessage, requestEmail } = await import(await compile("src/lib/catalog/on-request.ts"));
test("on-request orders are classified separately and retain the customer activation email",()=>{
 const message="Modalidad: Por encargo\nServicio: Fixture\nCorreo del cliente: buyer@example.invalid\nWhatsApp del cliente: 8441234567";
 assert.equal(isOnRequestMessage(message),true);assert.equal(requestEmail(message),"buyer@example.invalid");assert.equal(isOnRequestMessage("Hola, me interesa por encargo"),false);assert.equal(requestEmail("sin correo"),"");
});
test("expanded order cards keep additional details without repeating standard data", () => {
  assert.deepEqual(extraOrderDetails({id:"fixture",cliente:"Cliente",servicio:"Producto","contacto_(whatsapp)":"phone",fecha:"today",correo:"example.invalid",notas:"Detalle",Notas:"Repetido"}), [["correo","example.invalid"],["notas","Detalle"]]);
});
test("CyberDocs recognizes the contact_(whatsapp) format and preserves the buyer number", () => {
  const order = parseCyberDocsMessage("Nuevo pedido asignado\nID: fixture-order\nCliente: Cliente de prueba\nServicio: Plataforma de prueba\ncontacto_(whatsapp): 844 123 4567");
  assert.equal(order.isOrder,true);
  assert.equal(order.contactLabel,"WhatsApp");
  assert.equal(order.contactValue,"844 123 4567");
});
const notify = url(`
  export const admin = async () => ({
    from: table => {
      if (table !== 'orders') throw Error('wrong table');
      return { upsert: row => ({ select: () => ({ maybeSingle: async () => {
        const state = globalThis.__purchaseNotice;
        if (state.rows.has(row.id)) return {data:null};
        state.rows.set(row.id,row);
        return {data:row};
      } }) }) };
    },
  });
  export const loadSettings = async () => ({enabled:true});
  export const withinSchedule = () => true;
  export const rowToOrder = r => r;
  export const notifyOrder = async () => {globalThis.__purchaseNotice.sent++};
`);
const purchaseOps=url(`export const opsDB=()=>({from:table=>{if(table!=='ma2_customer_orders')throw Error('wrong table');const q={select:()=>q,eq:()=>q,is:()=>q,maybeSingle:async()=>({data:{title:"Producto de prueba",amount_cents:2500}})};return q}});`);
const { notifyPaidPurchase } = await import(await compile("src/lib/customer/purchase-notify.server.ts", { "./purchase-identity.server": identityURL, "@/lib/notify/notify.server": notify, "@/lib/workspace/operations.server":purchaseOps }));
test("paid purchase retries notify once and separate merchants never notify the main shop", async () => {
  globalThis.__purchaseNotice = { rows:new Map(), sent:0 };
  const id = crypto.randomUUID();
  await Promise.all([notifyPaidPurchase(id,null),notifyPaidPurchase(id,null)]);
  await notifyPaidPurchase(crypto.randomUUID(),crypto.randomUUID());
  assert.equal(globalThis.__purchaseNotice.rows.size,1);
  assert.equal(globalThis.__purchaseNotice.sent,1);
  const row = [...globalThis.__purchaseNotice.rows.values()][0];
  assert.equal(row.recipient, "");
  assert.equal(row.id, purchaseRecordId("notice",id));
  assert.equal(row.catalog_name,"Página web MA²");
  assert.equal(row.total,25);
});
const model = await compile("src/lib/workspace/model.ts");
const ops = url(`export const readRecords=async()=>globalThis.__remember.existing;export const opsDB=()=>({from:()=>({upsert:async(row,options)=>{if(!options.ignoreDuplicates)throw Error('not idempotent');globalThis.__remember.rows.set(row.id,globalThis.__remember.rows.get(row.id)||row);return {error:null}}})});`);
const encryption = url(`export const encryptPayload=async data=>JSON.stringify(data);`);
const remember = await import(await compile("src/lib/customer/remember-client.server.ts", { "@/lib/workspace/model": model, "@/lib/workspace/operations.server": ops, "@/lib/deliveries/deliveries.server": encryption }));
test("phone normalization and concurrent order contact registration prevent duplicate buyers", async () => {
  const old = process.env.MA2_SESSION_SECRET;
  process.env.MA2_SESSION_SECRET = "fixture-only-secret";
  try {
    globalThis.__remember = { existing: [],rows:new Map() };
    assert.equal(remember.normalizedClientPhone("844 123 4567"),"528441234567");
    assert.equal(remember.normalizedClientPhone("+52 1 844 123 4567"),"528441234567");
    assert.equal(remember.normalizedClientPhone("123"),"");
    const results = await Promise.all([remember.rememberOrderClient("Fixture","8441234567"),remember.rememberOrderClient("Fixture 2","+528441234567")]);
    assert.equal(results[0],results[1]); assert.equal(globalThis.__remember.rows.size,1);
    globalThis.__remember.existing = [{id:"existing-client",data:{whatsapp:"8441234567",shopId:"main"}}];
    assert.equal(await remember.rememberOrderClient("Fixture","+528441234567"),"existing-client");
    assert.equal(globalThis.__remember.rows.size,1);
  } finally { if (old === undefined) delete process.env.MA2_SESSION_SECRET; else process.env.MA2_SESSION_SECRET = old; }
});
const masterURL = await compile("src/lib/stock/master-products.ts");
const { recognizeOrderProduct,masterProduct }=await import(masterURL);
const { matchOrderStock } = await import(await compile("src/lib/customer/order-stock-match.ts",{"@/lib/stock/master-products":masterURL}));
test("master catalog distinguishes Disney standard versus premium and profile versus complete",()=>{
 assert.equal(recognizeOrderProduct("👤 DISNEY+ ESTÁNDAR PERFIL"),"DIS-STD-PER");
 assert.equal(recognizeOrderProduct("DISNEY PREMIUM CUENTA COMPLETA"),"DIS-PRE-COM");
 assert.equal(recognizeOrderProduct("Disney perfil"),null);
 assert.equal(masterProduct("Disney Premium perfil","complete"),null);
 const base={businessId:null,status:"available",accountType:"Perfil",stockKind:"profile",username:"fixture",password:"fixture",expiresOn:null,parentStockId:null,createdAt:"2026-01-01"};
 const stock=[{...base,id:"standard",platform:"Disney Estándar"},{...base,id:"premium",platform:"Disney Premium"},{...base,id:"complete",platform:"Disney Estándar",stockKind:"complete",accountType:"Completa"}];
 assert.equal(matchOrderStock("Disney+ estándar perfil",stock,"2026-01-01").id,"standard");
 assert.equal(matchOrderStock("Disney premium perfil",stock,"2026-01-01").id,"premium");
 assert.equal(matchOrderStock("Disney perfil",stock,"2026-01-01"),null);
 assert.equal(matchOrderStock("Disney estándar perfil",[{...stock[0],expiresOn:"2026-01-01"}],"2026-01-01"),null);
 assert.equal(matchOrderStock("Disney estándar perfil",[stock[0],{...stock[0],id:"annual",durationMonths:12}],"2026-01-01"),null);
});
test("automatic assignment picks the oldest matching available account but never guesses between types", () => {
  const base = { businessId:null,status:"available",platform:"Fixture",accountType:"Completa",stockKind:"complete",username:"fixture@example.invalid",password:"fixture",expiresOn:null,parentStockId:null,createdAt:"2026-01-01" };
  const first = {...base,id:"first"}, later = {...base,id:"later",createdAt:"2026-02-01"};
  const profile = {...base,id:"profile",accountType:"Perfil",stockKind:"profile"};
  assert.equal(matchOrderStock("Fixture Completa",[later,first,profile],"2026-01-01").id,"first");
  assert.equal(matchOrderStock("Fixture",[first,profile],"2026-01-01"),null);
  assert.equal(matchOrderStock("Fixture",[{...first,businessId:"other"},{...later,status:"assigned"}],"2026-01-01"),null);
  assert.equal(matchOrderStock("Fixture Completa",[first,{...profile,parentStockId:"first"}],"2026-01-01"),null);
});
