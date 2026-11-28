import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8");
test("the three order stages share navigation and hide the duplicate filters",async()=>{
 const [workspace,cyber,web,notices]=await Promise.all(["src/components/workspace/seller-workspace.tsx","src/components/catalog/cyberdocs-orders-dialog.tsx","src/components/customer/web-orders.tsx","src/components/catalog/notifications-dialog.tsx"].map(read));
 assert.match(workspace,/\["main","Pendientes",ClipboardList\],\["delivered","Entregados",PackageCheck\],\["closed","Cancelados",ArchiveX\]/);
 assert.match(workspace,/main:"orders",children:\[\]/);
 assert.match(workspace,/\['stock','Stock'\],\['deliveries','Entregas'\],\['vigencias','Vigencias'\]/);
 assert.match(cyber,/Copiar enlace protegido/);
 assert.match(cyber,/Enviar contraseña por WhatsApp/);
 assert.match(cyber,/orders: \["new", "error", "in_process"\]/);
 assert.doesNotMatch(workspace,/Origen del pedido|orderChannel/);
 assert.match(workspace,/renderRows=\{unifiedOrders\}/);
 assert.match(cyber,/visibleOrders.length\+visibleWebRows.length/);
 assert.match(workspace,/className="ma2-order-tabs gap-1.5"/);
 assert.doesNotMatch(workspace,/Solicitudes manuales pendientes/);
 assert.match(workspace,/manualRows=\{manualRows\}/);
 assert.match(cyber,/manualRows.filter\(r=>!linkedIds.has\(r.id\)\)/);
 const css=await read("src/styles.css");
 assert.match(css,/\.ma2-order-tabs \{ display:grid; grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(cyber,/Cuenta asignada · Entrega manual pendiente/);
 assert.match(cyber,/processing: \["in_process"\]/);
 assert.match(cyber,/closed: \["cancelled", "rejected"\]/);
 assert.match(cyber,/onStageChange\(order.id, "closed"\)/);
 assert.match(cyber,/\{!navigation && <div className="-mx-3/);
 assert.match(cyber,/\{navigation\}[\s\S]*?size="icon"[\s\S]*?aria-label="Ajustes de pedidos"/);
 assert.match(web,/stage==="orders"\?r.status==="nuevo"&&!r.linkedId/);
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

test("finalizing a subscription calculates the renewal date and manual edits are optional", async()=>{
 const [server,dialog,dates]=await Promise.all(["src/lib/cyberdocs/cyberdocs.server.ts","src/components/catalog/cyberdocs-orders-dialog.tsx","src/lib/stock/duration.ts"].map(read));
 assert.match(server,/orderSubscriptionMonths\(completed.serviceName\)/);
 assert.match(server,/\.is\("expires_on", null\)/);
 assert.match(dialog,/<summary[^>]*>Editar fechas<\/summary>/);
 const { orderSubscriptionMonths, expiresAfterMonths }=await import("../src/lib/stock/duration.ts");
 assert.equal(expiresAfterMonths("2026-01-31", orderSubscriptionMonths("HBO 1 mes")), "2026-02-28");
 assert.equal(orderSubscriptionMonths("ViX anual"), 12);
 assert.equal(orderSubscriptionMonths("Disney 3 meses"), 3);
 assert.equal(orderSubscriptionMonths("Acta de nacimiento"), null);
});
