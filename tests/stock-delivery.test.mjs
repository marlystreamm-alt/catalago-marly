import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const moduleURL = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const dbModule = moduleURL("export const supabaseAdmin = {from: (...args) => globalThis.__stockTest.db.from(...args)};");
const deliveryModule = moduleURL(`
  export const getDeliveryRow = async () => ({detail: JSON.stringify({status:'active', token:'existing-token'})});
  export const decryptPayload = async value => JSON.parse(value);
  export const saveDeliveryRow = async () => { globalThis.__stockTest.revoked++; };
`);
const historyModule = moduleURL("export const logStockHistory = async () => { globalThis.__stockTest.history++; };");
const source = await readFile(new URL("../src/lib/stock/manual-delivery.server.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  .replaceAll('"@/integrations/supabase/client.server"', JSON.stringify(dbModule))
  .replaceAll('"@/lib/deliveries/deliveries.server"', JSON.stringify(deliveryModule))
  .replaceAll('"./stock.server"', JSON.stringify(historyModule));

function fixture() {
  const row = { id: "stock-1", business_id: null, status: "available", updated_at: "2026-10-18T00:00:00Z", protected_delivery_id: null, username: "fixture@example.invalid" };
  const state = { row, history: 0, revoked: 0, documents: 0 };
  state.db = { from: (table) => {
    assert.equal(table, "stock_items");
    let values = {}, conditions = [];
    const run = () => {
      const matched = conditions.every(([key, value]) => row[key] === value);
      if (!matched) return { data: null, error: null };
      Object.assign(row, values);
      return { data: { id: row.id }, error: null };
    };
    const query = {
      update: (patch) => { values = patch; return query; },
      eq: (key, value) => { conditions.push([key, value]); return query; },
      is: (key, value) => { conditions.push([key, value]); return query; },
      select: () => query,
      maybeSingle: async () => run(),
      then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
    };
    return query;
  } };
  globalThis.__stockTest = state;
  const item = { id: row.id, businessId: null, status: "available", updatedAt: row.updated_at, clientName: "", clientWhatsapp: "", deliveredOn: null, expiresOn: null, salePrice: 0, relatedOrderId: "", protectedDeliveryId: "" };
  const input = { clientName: "Fixture client", clientWhatsapp: "", stockExpiresOn: "2099-12-31", expiresAt: "2099-12-31T00:00:00Z", salePrice: 80, relatedOrderId: "" };
  return { state, item, input };
}

test("concurrent delivery clicks reserve one stock item and create one document", async () => {
  const { state, item, input } = fixture();
  const { deliverAvailableStock } = await import(moduleURL(compiled));
  const create = async () => { state.documents++; return { id: "doc-1", token: "fixture-token", client: input.clientName, whatsapp: "", platform: "Fixture" }; };
  const results = await Promise.allSettled([deliverAvailableStock(item, input, create), deliverAvailableStock(item, input, create)]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(state.documents, 1);
  assert.equal(state.row.status, "assigned");
  assert.equal(state.row.protected_delivery_id, "doc-1");
  assert.equal(state.row.expires_on, input.stockExpiresOn);
  assert.equal(state.row.sale_price, 80);
});

test("document creation failure releases the claim and preserves stock credentials", async () => {
  const { state, item, input } = fixture();
  const { deliverAvailableStock } = await import(moduleURL(compiled));
  await assert.rejects(deliverAvailableStock(item, input, async () => { throw new Error("document unavailable"); }), /document unavailable/);
  assert.equal(state.row.status, "available");
  assert.equal(state.row.protected_delivery_id, null);
  assert.equal(state.row.username, "fixture@example.invalid");
  assert.equal(state.row.client_name, "");
});

test("client-owned stock cannot reserve stock from another business", async () => {
  const { state, item, input } = fixture();
  item.businessId = "another-business";
  const { deliverAvailableStock } = await import(moduleURL(compiled));
  await assert.rejects(deliverAvailableStock(item, input, async () => { state.documents++; }), /cuenta cambió/);
  assert.equal(state.documents, 0);
  assert.equal(state.row.status, "available");
});

test("a delivery requires a recipient and a future expiry", async () => {
  const { item, input } = fixture();
  const { deliverAvailableStock } = await import(moduleURL(compiled));
  await assert.rejects(deliverAvailableStock(item, {...input, clientName: ""}, async () => {}), /a quién/);
  await assert.rejects(deliverAvailableStock(item, {...input, expiresAt: "2000-01-01T00:00:00Z"}, async () => {}), /futura/);
});
