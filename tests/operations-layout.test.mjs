import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8");
test("the three order stages share navigation and hide the duplicate filters",async()=>{
 const [workspace,cyber,web,notices]=await Promise.all(["src/components/workspace/seller-workspace.tsx","src/components/catalog/cyberdocs-orders-dialog.tsx","src/components/customer/web-orders.tsx","src/components/catalog/notifications-dialog.tsx"].map(read));
 assert.match(workspace,/\["main", "Pedidos"\], \["processing", "En proceso"\], \["delivered", "Entregadas"\]/);
 assert.match(workspace,/\["closed", "Cancelados \/ rechazados"\]/);
 assert.match(cyber,/orders: \["new", "error"\]/);
 assert.match(cyber,/processing: \["in_process"\]/);
 assert.match(cyber,/closed: \["cancelled", "rejected"\]/);
 assert.match(cyber,/onStageChange\(order.id, "closed"\)/);
 assert.match(cyber,/\{!navigation && <div className="-mx-3/);
 assert.match(cyber,/\{navigation\}[\s\S]*?size="icon"[\s\S]*?aria-label="Ajustes de pedidos"/);
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

test("manual preparation remains in process until a successful clipboard action", async()=>{
 const [cyber, api, customer]=await Promise.all(["src/components/catalog/cyberdocs-orders-dialog.tsx","src/lib/cyberdocs/cyberdocs.functions.ts","src/lib/customer/customer.functions.ts"].map(read));
 assert.match(api,/assignStockToOrder\(\{ \.\.\.data, prepareOnly: true \}\)/);
 assert.match(api,/createManualDeliveryForOrder\(\{ \.\.\.data, prepareOnly: true \}\)/);
 const copy=cyber.split("const copyAndComplete")[1].split("const shareDeliveryMessage")[0];
 assert.match(copy,/await copyText\(text\);[\s\S]*?await cyberdocsRetryDeliveryCompletion/);
 assert.match(copy,/onStageChange\?\.\(completed.id, "deliveries"\)/);
 assert.match(customer,/\.rpc\("ma2_customer_buy"/);
});
