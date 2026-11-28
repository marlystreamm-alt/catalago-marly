import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("the admin menu keeps each visible section in its requested group", async () => {
  const source = await readFile(new URL("../src/components/workspace/seller-workspace.tsx", import.meta.url), "utf8");
  const sections = source.split("const SECTIONS = [")[1].split("] as const")[0];
  const ids = [...sections.matchAll(/\["([^"]+)"/g)].map((match) => match[1]);
  const navigation = source.split("const NAV_GROUPS:")[1].split("type Summary")[0];
  const groups = new Map([...navigation.matchAll(/main:"([^"]+)"[^\n]*children:\[([^\]]*)\]/g)]
    .map(([, main, children]) => [main, [...children.matchAll(/"([^"]+)"/g)].map((match) => match[1])]));
  assert.deepEqual([...groups.keys()].slice(0, 2), ["home", "inventory"]);
  assert.deepEqual(groups.get("inventory"), []);
  assert.deepEqual(groups.get("clients"), ["questions", "referrals", "wallet", "credit"]);
  assert.deepEqual(groups.get("extras"), ["documents", "songs", "games", "memory"]);
  const actual = [...groups].flatMap(([main, children]) => [main, ...children]);
  assert.equal(new Set(actual).size, actual.length);
  assert.deepEqual(actual.sort(), ids.filter(id=>!["expiry","shop","combos"].includes(id)).sort());
  for (const removed of ["catalogs", "assistant", "codes", "deliveries"]) assert.ok(!ids.includes(removed));
  assert.match(source, /Opciones de clientes[\s\S]*?sectionLinks\("clients"\)/);
  assert.match(source, /else if\(section==="orders"\)/);
  assert.match(source, /\['stock','Stock'\],\['deliveries','Entregas'\],\['vigencias','Vigencias'\]/);
  assert.doesNotMatch(source,/Gráfica de ventas · últimos 7 días|Vencidas \/ bajas/);
  assert.match(source,/FinancePanel summaryContent/);
  assert.match(source, /Ventas del mes/);
  assert.match(source, /Ganancia estimada del mes/);
});
