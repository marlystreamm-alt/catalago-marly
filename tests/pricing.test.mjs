import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import ts from "typescript";
const url=s=>`data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
const compile=async path=>ts.transpileModule(await readFile(new URL(`../${path}`,import.meta.url),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const master=url(await compile("src/lib/stock/master-products.ts"));
const {pricingKey,catalogPriceVariant}=await import(url((await compile("src/lib/customer/pricing.ts")).replaceAll('"@/lib/stock/master-products"',JSON.stringify(master))));
const pricingModule=url((await compile("src/lib/customer/pricing.ts")).replaceAll('"@/lib/stock/master-products"',JSON.stringify(master)));
test("store prices do not overlay or read legacy catalogs",async()=>{
 const [pricing,sync,editor,storefront,checkout]=await Promise.all(["src/lib/customer/pricing.server.ts","src/lib/catalog/sync.functions.ts","src/components/customer/product-pricing.tsx","src/lib/customer/storefront.functions.ts","supabase/migrations/20261126064935_ma2_on_request_wallet_purchase.sql"].map(p=>readFile(new URL("../"+p,import.meta.url),"utf8")));
 assert.ok(!pricing.includes("catalog_app_state"));assert.ok(!sync.includes("overlayPrices"));assert.ok(!editor.includes("applyCentralPrice"));assert.match(storefront,/published===true/);assert.match(storefront,/priceCents:/);assert.ok(!storefront.includes("costCents"));assert.match(storefront,/\.rpc\("ma2_buy_on_request"/);assert.match(checkout,/values \(p_id, 'store-ma2'/);assert.match(checkout,/ma2_wallet_post\(p_client, -cents, 'purchase'/);
});
test("same master plan aliases share prices but different variants and validity do not",()=>{
 assert.equal(pricingKey("Disney Premium","profile",1),pricingKey("Disney+ Premium","profile",1));
 assert.equal(pricingKey("HBO Max Estándar","complete",1),pricingKey("Max Estándar","complete",1));
 assert.notEqual(pricingKey("Disney Premium","profile",1),pricingKey("Disney Premium","complete",1));
 assert.notEqual(pricingKey("Disney Premium","profile",1),pricingKey("Disney Estándar","profile",1));
 assert.notEqual(pricingKey("Disney Premium","profile",1),pricingKey("Disney anual","profile",1));
 assert.notEqual(pricingKey("Prime Video","profile",1),pricingKey("Prime Video S/A","profile",1));
 assert.notEqual(pricingKey("Disney Premium","profile",1),pricingKey("Disney Premium","profile",12));
 assert.equal(catalogPriceVariant({name:"ViX Premium Anual",sectionId:"perfiles"}).months,12);
 assert.equal(catalogPriceVariant({name:"MUBI 3 meses",sectionId:"completas"}).months,3);
 assert.notEqual(catalogPriceVariant({name:"Disney Premium",sectionId:"perfiles",onRequest:"email"}).key,pricingKey("Disney Premium","profile",1));
});
