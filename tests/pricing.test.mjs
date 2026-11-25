import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import ts from "typescript";
const url=s=>`data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
const compile=async path=>ts.transpileModule(await readFile(new URL(`../${path}`,import.meta.url),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const master=url(await compile("src/lib/stock/master-products.ts"));
const {pricingKey,catalogPriceVariant}=await import(url((await compile("src/lib/customer/pricing.ts")).replaceAll('"@/lib/stock/master-products"',JSON.stringify(master))));
const pricingModule=url((await compile("src/lib/customer/pricing.ts")).replaceAll('"@/lib/stock/master-products"',JSON.stringify(master)));
const {overlayPrices}=await import(url((await compile("src/lib/customer/pricing.server.ts")).replaceAll('"@/lib/workspace/operations.server"',JSON.stringify(url('export const opsDB=()=>{};'))).replaceAll('"./pricing"',JSON.stringify(pricingModule))));
test("manual public cards require email and never expose wholesale costs or supplier",()=>{
 const base={id:"clientes",name:"Tienda",services:[],categories:[{id:"ia"}]};const name="Canva por invitación · 1 mes",kind="catalog-request-ia-creatividad";
 const p={product_key:pricingKey(name,kind,1),name,kind,months:1,retail_cents:3000,reseller_cents:1500,cost_cents:500,provider:"PRIVATE-SUPPLIER",published:true,image:"https://example.invalid/logo.png"};
 const state=overlayPrices({catalogs:{clientes:base,revendedores:{...base,id:"revendedores"}}},[p]);
 assert.equal(state.catalogs.clientes.services[0].price,30);assert.equal(state.catalogs.revendedores.services[0].price,15);assert.equal(state.catalogs.clientes.services[0].onRequest,"email");assert.equal(state.catalogs.clientes.services[0].icon,p.image);assert.ok(!JSON.stringify(state).includes("PRIVATE-SUPPLIER"));assert.ok(!JSON.stringify(state).includes("cost_cents"));
 const again=overlayPrices(state,[{...p,published:false}]);assert.equal(again.catalogs.clientes.services.length,1);assert.equal(again.catalogs.clientes.services[0].active,false);
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
