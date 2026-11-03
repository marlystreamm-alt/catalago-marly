import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const url = (s) => `data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
const compile = (s) =>
  ts.transpileModule(s, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");
const parserURL = url(compile(await read("src/lib/recharges/parser.ts")));
const { parseBankNotice, authenticatedBankHeader } = await import(parserURL);
const notice =
  "Ilustración $850\nHola. Recibiste una transferencia hoy.\nMonto: $15.00 pesos\nBanco: BANCO EJEMPLO\nCuenta terminación: *****0000\nReferencia: 2310260\nClave de rastreo: FIXTURE01002611030086083925";
test("bank receipt reads labeled amount, never decorative amounts", () =>
  assert.deepEqual(parseBankNotice(notice), {
    incoming: true,
    amountCents: 1500,
    reference: "2310260",
    tracking: "FIXTURE01002611030086083925",
  }));
test("receipt parser rejects ambiguous, missing, negative and outgoing amounts", () => {
  assert.equal(parseBankNotice(notice + "\nMonto: $25.00").amountCents, null);
  assert.equal(parseBankNotice("Recibiste una transferencia $15").amountCents, null);
  assert.equal(parseBankNotice("Monto: -$15.00").amountCents, null);
  assert.equal(parseBankNotice(notice.replace("Recibiste", "Enviaste")).incoming, false);
  assert.equal(parseBankNotice(notice.replace("15.00", "1,250.50")).amountCents, 125050);
  assert.equal(parseBankNotice(notice.replace("15.00", "15,50")).amountCents, 1550);
  assert.equal(parseBankNotice(notice + "\nReferencia: 9999999").reference, null);
});
const sender = "avisos@banco.example",
  allowed = [sender];
const good =
  "Authentication-Results: mx.google.com;\r\n dkim=pass header.i=@banco.example;\r\n dmarc=pass header.from=banco.example\r\n\r\n";
test("only exact permitted senders with aligned Gmail DKIM and DMARC can credit", () => {
  assert.equal(authenticatedBankHeader(good, sender, allowed), true);
  for (const header of [
    "",
    good.replace("mx.google.com", "evil.example"),
    good.replace("dkim=pass", "dkim=fail"),
    good.replace("dmarc=pass", "dmarc=fail"),
    good.replace("header.i=@banco.example", "header.i=@evil.example"),
    "Authentication-Results: mx.google.com; dkim=fail; dmarc=fail\r\n" + good,
  ])
    assert.equal(authenticatedBankHeader(header, sender, allowed), false);
  assert.equal(authenticatedBankHeader(good, "other@banco.example", allowed), false);
});
const settingsURL = url(
  compile(await read("src/lib/recharges/settings.ts"))
    .replaceAll('"zod"', JSON.stringify(import.meta.resolve("zod")))
    .replaceAll("'zod'", JSON.stringify(import.meta.resolve("zod"))),
);
const { paymentDetails, rechargeSettings } = await import(settingsURL);
const settings = {
  enabled: false,
  email: "private@example.com",
  senders: [sender],
  bank: "Banco",
  holder: "Fixture",
  account: "000000000000000000",
  note: "",
  minimum: 10,
  maximum: 5000,
  minutes: 60,
  openLimit: 2,
  dailyLimit: 0,
  uniqueCents: false,
  bonusPercent: 0,
};
test("customer payment details exclude mailbox settings and secrets", () => {
  const safe = paymentDetails({ ...settings, password_cipher: "secret", password: "secret" });
  for (const k of ["email", "senders", "password", "password_cipher"])
    assert.equal(safe[k], undefined);
  assert.equal(safe.bank, "Banco");
  assert.throws(() => rechargeSettings.parse({ ...settings, maximum: 1 }));
});
const factory = url(
  `export const createServerFn=()=>({validator:v=>({handler:h=>async({data})=>h({data:v(data)})})});`,
);
const auth = url(
  `export const requireAdminCode=async code=>{if(code!=='ma2s_valid')throw new Error('Unauthorized')};`,
);
const server = url(
  `export const portalClient=async(id,t)=>{if(id!==globalThis.__recharge.id||t!=='t'.repeat(72))throw new Error('Denied');};export const opsDB=()=>({rpc:async(name,data)=>{globalThis.__recharge.calls.push({name,data});return {data:{id:'request'}};},from:name=>{globalThis.__recharge.calls.push({table:name});const q={select:()=>q,eq:(key,value)=>{globalThis.__recharge.calls.push({key,value});return q;},order:()=>q,limit:async()=>({data:[]}),update:()=>q,maybeSingle:async()=>({data:{id:'request'}})};return q;}});`,
);
const mail = url(`export const readConfig=async()=>({settings:${JSON.stringify(settings)}});`);
let source = compile(await read("src/lib/recharges/recharges.functions.ts"));
for (const [key, value] of Object.entries({
  "@tanstack/react-start": factory,
  zod: import.meta.resolve("zod"),
  "./settings": settingsURL,
  "./parser": parserURL,
  "@/lib/notify/notify.server": auth,
  "@/lib/workspace/operations.server": server,
  "./mail.server": mail,
}))
  source = source
    .replaceAll(`'${key}'`, JSON.stringify(value))
    .replaceAll(`"${key}"`, JSON.stringify(value));
const api = await import(url(source));
const fixture = () => (globalThis.__recharge = { id: crypto.randomUUID(), calls: [] });
test("private recharge endpoints reject unauthorized access before database reads", async () => {
  const s = fixture();
  for (const [fn, extra] of [
    [api.rechargeAdminLoad, {}],
    [api.rechargeSave, { settings, password: "secret", version: 0 }],
    [api.rechargeTestConnection, {}],
    [api.rechargeScan, {}],
    [api.rechargeRetry, { eventId: crypto.randomUUID() }],
    [api.rechargeParseTest, { text: notice }],
  ])
    await assert.rejects(fn({ data: { code: "wrong", ...extra } }), /Unauthorized/);
  assert.equal(s.calls.length, 0);
});
test("customer recharge actions validate portal ownership before database writes", async () => {
  const s = fixture();
  const data = {
    id: crypto.randomUUID(),
    token: "t".repeat(72),
    amount: 15,
    requestId: crypto.randomUUID(),
  };
  for (const fn of [api.rechargePortalLoad, api.rechargeCreate, api.rechargeCancel])
    await assert.rejects(fn({ data }), /Denied/);
  assert.equal(s.calls.length, 0);
  await api.rechargeCreate({ data: { ...data, id: s.id } });
  assert.deepEqual(s.calls[0], {
    name: "ma2_recharge_create",
    data: { p_client: s.id, p_amount: 1500 },
  });
  await api.rechargeCancel({ data: { ...data, id: s.id } });
  assert.ok(s.calls.some((c) => c.key === "client_id" && c.value === s.id));
  assert.ok(s.calls.some((c) => c.key === "status" && c.value === "pending"));
});
