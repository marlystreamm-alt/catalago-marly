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
test("sign-in shows one form with automatic role routing",async()=>{
 const [portal,admin]=await Promise.all(["src/components/customer/customer-store.tsx","src/components/customer/admin-entry.tsx"].map(read));
 assert.doesNotMatch(admin,/Cliente \/ revendedor|>Administración<|seller-tabs/);
 const entry=portal.split("{!data ? (")[1].split('<div className="buyer-shell">')[0];
 assert.doesNotMatch(entry,/seller-tabs/);
 assert.match(entry,/Regístrate aquí/);
 assert.doesNotMatch(entry,/aria-label="Acceso del equipo"/);
 assert.match(portal,/result.role === "admin"/);
 assert.match(portal,/SheetContent side="left"/);
 assert.match(portal,/<SheetTitle>Mi cuenta<\/SheetTitle>/);
});
test("initial entry waits for both catalogue and verified session without flashing old workspace",async()=>{
 const [root,store,portal,loader]=await Promise.all(["src/routes/index.tsx","src/lib/catalog/store.tsx","src/components/customer/customer-store.tsx","src/components/customer/access-loading.tsx"].map(read));
 assert.match(root,/if \(!hydrated\) return <AccessLoading\/>;\s*if \(hydrated && !isAdmin/);
 assert.match(store,/const accessReady = remembered\s*\? adminSessionValidate/);
 assert.match(store,/await accessReady;\s*if \(!cancelled\) setHydrated\(true\)/);
 assert.match(portal,/if \(loading \|\| !shop\) return <AccessLoading\/>/);
 assert.match(loader,/role="status"/);
 assert.doesNotMatch(loader,/Contraseña|Administración|Catálogos/);
});
