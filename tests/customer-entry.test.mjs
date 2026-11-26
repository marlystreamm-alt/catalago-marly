import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8");
test("MA² landing uses customer sign-in before showing products",async()=>{
 const [root,route,portal,admin,server]=await Promise.all(["src/routes/index.tsx","src/routes/tienda.$slug.tsx","src/components/customer/customer-store.tsx","src/components/customer/admin-entry.tsx","src/lib/customer/storefront.functions.ts"].map(read));
 assert.match(root,/return <CustomerStore slug="ma2" initialView="inicio"/);
 assert.match(route,/return <CustomerStore/);
 assert.doesNotMatch(route,/<Storefront/);
 assert.doesNotMatch(admin,/>Ver tienda</);
 assert.doesNotMatch(portal,/>\s*Ver tienda web\s*</);
 assert.match(portal,/<Storefront embedded/);
 assert.match(portal,/Reportar una falla/);
 assert.match(portal,/<StoreNotices\/>/);
 assert.match(server,/customerContext\("ma2"\)/);
 assert.doesNotMatch(server,/catch \{ return "retail"/);
});
