import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8");
test("orders and deliveries use disjoint stages with shared origins",async()=>{
 const [workspace,cyber,web,notices]=await Promise.all(["src/components/workspace/seller-workspace.tsx","src/components/catalog/cyberdocs-orders-dialog.tsx","src/components/customer/web-orders.tsx","src/components/catalog/notifications-dialog.tsx"].map(read));
 assert.match(workspace,/stage=\{tab==="delivered"\?"deliveries":"orders"\}/);
 assert.match(cyber,/stage==="deliveries"\?order.status==="completed":order.status!=="completed"/);
 assert.match(web,/stage==="orders"\?!r.linkedId/);
 assert.match(cyber,/aria-label="Ajustes de pedidos"/);
 assert.doesNotMatch(notices,/<TabsTrigger value="pedidos"/);
});
test("combo assignment checks administrator, locks all units and persists one delivery",async()=>{
 const [api,sql]=await Promise.all(["src/lib/stock/combo.functions.ts","supabase/migrations/20261126030846_ma2_atomic_combo_delivery.sql"].map(read));
 assert.match(api,/await gate\(data.code\)/);
 assert.match(api,/encryptPayload\(payload\)/);
 assert.match(sql,/for update/);
 assert.match(sql,/status<>'available'/);
 assert.match(sql,/status='assigned'/);
 assert.match(sql,/from public,anon,authenticated/);
});
