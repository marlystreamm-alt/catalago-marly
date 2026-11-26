import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function load(file) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

test("all customer views use the independent store URL", async () => {
  const { mainStoreLink, MAIN_STORE_VIEWS } = await load("src/lib/catalog/links.ts");
  assert.equal(mainStoreLink(), "/tienda/ma2");
  for (const view of MAIN_STORE_VIEWS) {
    const url = new URL(mainStoreLink(view), "https://example.invalid");
    assert.equal(url.pathname, "/tienda/ma2");
    assert.equal(url.searchParams.get("cat"), null);
    assert.equal(url.searchParams.get("vista"), view);
  }
});

test("stock cards consolidate only interchangeable units, never different plans or prices", async () => {
  const { groupProducts } = await load("src/lib/customer/group-products.ts");
  const base = {id:"oldest",name:"Disney Premium",type:"Premium",kind:"profile",priceCents:5000,months:1,expiresOn:null};
  const groups = groupProducts([base,{...base,id:"next"},{...base,id:"full",kind:"complete"},{...base,id:"standard",name:"Disney Estándar"},{...base,id:"price",priceCents:6000},{...base,id:"longer",months:2}]);
  assert.equal(groups.length, 5);
  assert.equal(groups[0].count, 2);
  assert.equal(groups[0].product.id, "oldest");
});
