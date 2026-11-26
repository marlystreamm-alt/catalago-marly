import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { shopRequestId } from "../src/lib/sales/shop-request-identity.server.ts";

test("the same business and owner share one registration ID across formatting changes", () => {
  const first = shopRequestId("Diseño & Café", "844 123 4567");
  assert.equal(first, shopRequestId(" diseno-cafe ", "+52 (844) 123-4567"));
  assert.equal(first, shopRequestId("DISEÑO CAFÉ", "+52 1 844 123 4567"));
  assert.notEqual(first, shopRequestId("Otro negocio", "8441234567"));
  assert.notEqual(first, shopRequestId("Diseño & Café", "8441234568"));
});

test("duplicate submissions use the same primary key and keep the original request", async () => {
  const source = await readFile(new URL("../src/lib/sales/sales.functions.ts", import.meta.url), "utf8");
  const registration = source.split("export const salesCreateRequest")[1].split("export const salesListRequests")[0];
  assert.match(registration, /id: shopRequestId\(data\.businessName, whatsapp\)/);
  assert.match(registration, /id: draft\.id/);
  assert.match(registration, /error\?\.code === "23505"/);
  assert.doesNotMatch(registration, /\.(?:upsert|update)\(/);
});
