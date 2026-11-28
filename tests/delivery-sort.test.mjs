import test from "node:test";
import assert from "node:assert/strict";
import {deliveryDateKey} from "../src/lib/stock/delivery-sort.ts";
import {readFile} from "node:fs/promises";

test("deliveries use Monterrey dates, oldest first, with unknown dates last",()=>{
  const records=[
    ["manual",deliveryDateKey("2026-11-27T20:20:15Z")],
    ["combo",deliveryDateKey("2026-11-27T10:20:26Z")],
    ["stock",deliveryDateKey("2026-11-25")],
    ["unknown",deliveryDateKey(null)],
  ];
  assert.deepEqual(records.sort((a,b)=>a[1].localeCompare(b[1])).map(r=>r[0]),["stock","combo","manual","unknown"]);
  assert.equal(deliveryDateKey("2026-11-27","2026-11-28T01:00:00Z"),"2026-11-27 19:00:00");
  assert.equal(deliveryDateKey("2026-11-27","2026-11-29T01:00:00Z"),"2026-11-27 00:00:00");
});

test("inventory combines manual entries and stock without a separate history and exposes combos",async()=>{
  const [workspace,insights]=await Promise.all(["seller-workspace.tsx","insights-panels.tsx"].map(name=>readFile(new URL(`../src/components/workspace/${name}`,import.meta.url),"utf8")));
  assert.doesNotMatch(workspace,/Historial de servicios manuales|Productos, precios y combos/);
  assert.match(workspace,/\['vigencias','Vigencias'\],\['combos','Combos'\]/);
  assert.match(workspace,/inventoryView==="combos"\?<StockComboPlanner/);
  assert.match(insights,/!representedManual.has\(record.id\)/);
  assert.match(insights,/entries.sort\(\(a,b\)=>a.date.localeCompare\(b.date\)/);
});
