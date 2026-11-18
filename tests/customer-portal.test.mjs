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
const password = await import(url(compile(await read("src/lib/customer/password.server.ts"))));
test("customer passwords use independent salts and reject wrong passwords", async () => {
  const a = password.customerSalt(),
    b = password.customerSalt();
  assert.notEqual(a, b);
  const h = await password.customerHash("Fixture-password-123", a);
  assert.equal(h.length, 64);
  assert.notEqual(h, await password.customerHash("Fixture-password-123", b));
  assert.equal(await password.customerMatches("Fixture-password-123", a, h), true);
  assert.equal(await password.customerMatches("wrong", a, h), false);
  assert.equal(await password.customerMatches("Fixture-password-123", a, ""), false);
});
const factory = url(
  `export const createServerFn=()=>({handler:h=>h,validator:v=>({handler:h=>async({data})=>h({data:v(data)})})});`,
);
const auth = url(
  `export const requireAdminCode=async code=>{if(code!=='ma2s_valid')throw new Error('Unauthorized')};`,
);
const ctx = url(
  `export const customerContext=async slug=>{if(!globalThis.__customer.allowed)throw new Error('Denied');return globalThis.__customer.context;};export const customerRecords=async()=>globalThis.__customer.records;export const customerShop=async()=>globalThis.__customer.context.shop;export const customerThrottle=async()=>{};export const customerOwner=async token=>{if(token!=='owner_valid')throw new Error('Unauthorized owner');return{business:{id:globalThis.__customer.context.shop.id}}};export const customerLogoutSession=async()=>{};`,
);
const ops = url(
  `export const opsDB=()=>({from:table=>{const calls=globalThis.__customer.calls;calls.push({table});const q={select:()=>q,eq:(key,value)=>{calls.push({key,value});return q;},is:(key,value)=>{calls.push({key,value});return q;},not:()=>q,neq:()=>q,gt:()=>q,order:()=>q,limit:()=>q,update:value=>{calls.push({update:value});return q;},in:()=>q,maybeSingle:async()=>({data:globalThis.__customer.single,error:null}),single:async()=>({data:globalThis.__customer.single,error:null}),then:(resolve,reject)=>Promise.resolve({data:table==='stock_items'?globalThis.__customer.stock:[],error:null}).then(resolve,reject)};return q;},rpc:async(name,data)=>{globalThis.__customer.calls.push({name,data});return{data:'request-id',error:null}}});export const walletEntries=async()=>[];export const readRecords=async()=>globalThis.__customer.records;export const readRecord=async()=>globalThis.__customer.record;export const totals=()=>({balance:0,debt:0});export const createRecord=async(module,title,status,data)=>{globalThis.__customer.calls.push({module,title,status,data})};`,
);
const decrypt = url(`export const decryptPayload=async()=>({password:'fixture-password'});`);
const date = url(`export const businessToday=()=>new Date().toISOString().slice(0,10);`);
async function moduleAt(path) {
  let s = compile(await read(path));
  for (const [name, target] of Object.entries({
    "@tanstack/react-start": factory,
    zod: import.meta.resolve("zod"),
    "./customer.server": ctx,
    "@/lib/workspace/operations.server": ops,
    "@/lib/notify/notify.server": auth,
    "@/lib/deliveries/deliveries.server": decrypt,
    "@/lib/stock/duration": date,
  }))
    s = s
      .replaceAll(`'${name}'`, JSON.stringify(target))
      .replaceAll(`"${name}"`, JSON.stringify(target));
  return import(url(s));
}
const api = await moduleAt("src/lib/customer/customer.functions.ts"),
  manage = await moduleAt("src/lib/customer/manage.functions.ts");
function fixture() {
  const id = crypto.randomUUID();
  return (globalThis.__customer = {
    allowed: true,
    context: {
      account: { id: crypto.randomUUID() },
      client: { id, title: "Fixture", data: {} },
      shop: { id: null, slug: "ma2" },
    },
    records: [],
    calls: [],
    stock: [],
    single: null,
    record: null,
  });
}
test("every customer operation requires server-validated session before database access", async () => {
  const s = fixture();
  s.allowed = false;
  const id = crypto.randomUUID();
  for (const [fn, extra] of [
    [api.customerLoad, {}],
    [api.customerProducts, {}],
    [api.customerBuy, { stockId: id, priceCents: 1500, requestId: id }],
    [api.customerDelivery, { orderId: id }],
    [api.customerDocument, { documentId: id }],
    [api.customerSubmit, { module: "reports", title: "Fixture", message: "Fixture" }],
    [api.customerChangePassword, { currentPassword: "old", password: "Fixture-123456" }],
    [api.customerRechargeLoad, {}],
    [api.customerRechargeCreate, { amount: 15 }],
    [api.customerRechargeCancel, { requestId: id }],
  ])
    await assert.rejects(fn({ data: { slug: "ma2", ...extra } }), /Denied/);
  assert.equal(s.calls.length, 0);
});
test("purchase derives identity from session and passes exact integer cents and retry identifier", async () => {
  const s = fixture(),
    stockId = crypto.randomUUID(),
    requestId = crypto.randomUUID();
  await api.customerBuy({
    data: { slug: "ma2", stockId, requestId, priceCents: 1500, accountId: "forged" },
  });
  assert.deepEqual(s.calls[0], {
    name: "ma2_customer_buy",
    data: {
      p_account: s.context.account.id,
      p_stock: stockId,
      p_price: 1500,
      p_request: requestId,
    },
  });
  await assert.rejects(
    api.customerBuy({ data: { slug: "ma2", stockId, requestId, priceCents: 15.2 } }),
  );
});
test("store listings scope inventory and never serialize passwords, supplier panels or costs", async () => {
  const s = fixture(),
    id = crypto.randomUUID();
  s.stock = [
    {
      id,
      platform: "Fixture",
      account_type: "Completa",
      stock_kind: "complete",
      sale_price: 15,
      duration_months: 1,
      starts_on_sale: true,
      password_cipher: "SECRET-CIPHER",
      username: "SECRET-USERNAME",
      panel_password_cipher: "SECRET-PANEL",
      provider: "SECRET-PROVIDER",
      cost: 1,
      parent_stock_id: null,
    },
  ];
  const list = await api.customerProducts({ data: { slug: "ma2" } });
  assert.equal(list[0].priceCents, 1500);
  assert.equal(JSON.stringify(list).includes("SECRET"), false);
  assert.ok(s.calls.some((c) => c.key === "business_id" && c.value === null));
});
test("delivery requests recheck client ownership and expiry before decrypting snapshot", async () => {
  const s = fixture(),
    orderId = crypto.randomUUID();
  s.single = null;
  await assert.rejects(api.customerDelivery({ data: { slug: "ma2", orderId } }), /no disponible/);
  assert.ok(s.calls.some((c) => c.key === "client_id" && c.value === s.context.client.id));
  s.single = {
    id: orderId,
    title: "Fixture",
    detail: { password_cipher: "secret" },
    expires_on: "2000-01-01",
  };
  await assert.rejects(api.customerDelivery({ data: { slug: "ma2", orderId } }), /venció/);
});
test("portal returns only own records and shared notices without attachments or credentials", async () => {
  const s = fixture();
  s.records = [
    {
      id: "own",
      module: "reports",
      title: "Own",
      status: "pending",
      data: {
        clientId: s.context.client.id,
        message: "Own",
        attachment: "SECRET",
        password: "SECRET",
      },
    },
    {
      id: "other",
      module: "reports",
      title: "Other",
      status: "pending",
      data: { clientId: crypto.randomUUID(), message: "SECRET" },
    },
    {
      id: "public",
      module: "notices",
      title: "Notice",
      status: "active",
      data: { message: "Shared" },
    },
  ];
  const v = await api.customerLoad({ data: { slug: "ma2" } });
  assert.deepEqual(
    v.records.map((r) => r.id),
    ["own", "public"],
  );
  assert.equal(JSON.stringify(v).includes("SECRET"), false);
});
test("merchant customer recharges never use the main shop mailbox or references", async () => {
  const s = fixture();
  s.context.shop.id = crypto.randomUUID();
  const v = await api.customerRechargeLoad({ data: { slug: "merchant" } });
  assert.equal(v.settings, null);
  await assert.rejects(
    api.customerRechargeCreate({ data: { slug: "merchant", amount: 15 } }),
    /esta tienda/,
  );
  assert.equal(s.calls.length, 0);
});
test("customer reports cannot forge another client or privileged reply", async () => {
  const s = fixture();
  await api.customerSubmit({
    data: {
      slug: "ma2",
      module: "reports",
      title: "Fixture",
      message: "Fixture",
      clientId: "forged",
      reply: "forged",
    },
  });
  assert.equal(s.calls[0].data.clientId, s.context.client.id);
  assert.equal(s.calls[0].data.reply, undefined);
});
test("business management endpoints authorize before reading accounts or posting funds", async () => {
  const s = fixture(),
    id = crypto.randomUUID();
  for (const [fn, extra] of [
    [manage.customerManageLoad, {}],
    [manage.customerManageCredit, { accountId: id, amount: 15, note: "Fixture", requestId: id }],
    [manage.customerManageReset, { accountId: id }],
    [manage.customerManageInvite, { clientId: id, email: "fixture@example.invalid" }],
    [manage.customerManageReply, { id, version: 1, reply: "Fixture", status: "resolved" }],
    [manage.customerManageActive, { accountId: id, active: false }],
  ])
    await assert.rejects(fn({ data: { code: "wrong", ...extra } }), /Unauthorized/);
  assert.equal(s.calls.length, 0);
});
test("merchant credit cannot target an account outside the authorized business", async () => {
  const s = fixture();
  s.context.shop.id = crypto.randomUUID();
  s.single = null;
  await assert.rejects(
    manage.customerManageCredit({
      data: {
        ownerToken: "owner_valid",
        accountId: crypto.randomUUID(),
        amount: 15,
        note: "Fixture",
        requestId: crypto.randomUUID(),
      },
    }),
    /esta tienda/,
  );
  assert.ok(s.calls.some((c) => c.key === "business_id" && c.value === s.context.shop.id));
  assert.equal(
    s.calls.some((c) => c.name === "ma2_wallet_post"),
    false,
  );
});
const sales = await moduleAt("src/lib/sales/sales.functions.ts");
test("public shop signup receipts reject executable URLs and SVG before database access", async () => {
  const s = fixture();
  for (const receiptDataUrl of [
    "javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "data:image/svg+xml;base64,PHN2Zz4=",
  ])
    await assert.rejects(
      sales.salesCreateRequest({
        data: {
          customerName: "Fixture",
          whatsapp: "0000000000",
          businessName: "Fixture",
          planId: "fixture",
          receiptDataUrl,
        },
      }),
    );
  assert.equal(s.calls.length, 0);
});
const menuTypes = await import(url(compile(await read("src/lib/menus/types.ts"))));
test("monthly expiry uses Monterrey date during the UTC date boundary", () => {
  const RealDate = Date;
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : ["2026-11-18T03:00:00Z"]));
    }
    static now() {
      return new RealDate("2026-11-18T03:00:00Z").getTime();
    }
  };
  try {
    assert.equal(
      menuTypes.businessStatus({ active: true, expiresOn: "2026-11-17", graceDays: 0 }),
      "activo",
    );
    assert.equal(
      menuTypes.businessStatus({ active: true, expiresOn: "2026-11-16", graceDays: 0 }),
      "vencido",
    );
  } finally {
    globalThis.Date = RealDate;
  }
});
const cookieAPI=url(`export const getCookie=()=>globalThis.__session.cookie;export const getRequestHeader=()=>"fixture-ip";export const setCookie=(name,value,options)=>{globalThis.__session.set={name,value,options}};export const deleteCookie=()=>{};`);
const sessionOps=url(`import{createHash}from'node:crypto';export const hashToken=async v=>createHash('sha256').update(v).digest('hex');export const readRecords=async()=>globalThis.__session.config||[];export const readRecord=async()=>globalThis.__session.client;export const opsDB=()=>({from:table=>{let active;const q={select:()=>q,eq:(k,v)=>{if(k==='active')active=v;return q;},maybeSingle:async()=>({data:table==='catalog_app_state'?null:table==='ma2_customer_sessions'?globalThis.__session.session:table==='ma2_customer_accounts'?(active===true&&!globalThis.__session.account.active?null:globalThis.__session.account):null,error:null}),insert:async value=>{globalThis.__session.insert={table,value};return{error:null}}};return q;}});`);
let sessionSource=compile(await read('src/lib/customer/customer.server.ts'));
for(const [name,target]of Object.entries({'@tanstack/react-start/server':cookieAPI,'@/lib/workspace/operations.server':sessionOps}))sessionSource=sessionSource.replaceAll(`'${name}'`,JSON.stringify(target)).replaceAll(`"${name}"`,JSON.stringify(target));
const sessionAPI=await import(url(sessionSource));
function sessionFixture(){return globalThis.__session={cookie:crypto.randomUUID()+crypto.randomUUID(),client:{id:crypto.randomUUID(),module:'clients',status:'active',title:'Fixture'},session:{account_id:crypto.randomUUID(),expires_at:new Date(Date.now()+60000).toISOString()},account:{id:crypto.randomUUID(),business_id:null,client_id:crypto.randomUUID(),active:true},set:null,insert:null};}
test('customer cookies are HttpOnly and persist only a SHA-256 token hash on the server',async()=>{const s=sessionFixture();await sessionAPI.customerSession(s.account.id);assert.equal(s.set.options.httpOnly,true);assert.equal(s.set.options.sameSite,'lax');assert.equal(s.set.options.path,'/');assert.equal(s.set.value.length,72);assert.equal(s.insert.value.token_hash.length,64);assert.equal(JSON.stringify(s.insert).includes(s.set.value),false);});
test('customer session validation rejects missing, expired, suspended and other-shop sessions',async()=>{let s=sessionFixture();s.cookie='';await assert.rejects(sessionAPI.customerContext('ma2'),/Inicia sesión/);s=sessionFixture();s.session.expires_at='2000-01-01';await assert.rejects(sessionAPI.customerContext('ma2'),/sesión terminó/);s=sessionFixture();s.account.business_id=crypto.randomUUID();await assert.rejects(sessionAPI.customerContext('ma2'),/esta tienda/);s=sessionFixture();s.account.active=false;await assert.rejects(sessionAPI.customerContext('ma2'),/esta tienda/);s=sessionFixture();s.client.status='inactive';await assert.rejects(sessionAPI.customerContext('ma2'),/suspendido/);});
test('an active customer session resolves the server-side account and client',async()=>{const s=sessionFixture();const ctx=await sessionAPI.customerContext('ma2');assert.equal(ctx.client.id,s.client.id);assert.equal(ctx.account.id,s.account.id);assert.equal(ctx.shop.id,null);});

test("main shop recovery ignores the original template phone number",async()=>{const s=sessionFixture();s.config=[{status:"active",data:{whatsapp:"5215500000000"}}];assert.equal((await sessionAPI.customerShop("ma2")).whatsapp,"528443852364");s.config=[{status:"active",data:{whatsapp:"844 385 2364"}}];assert.equal((await sessionAPI.customerShop("ma2")).whatsapp,"844 385 2364");});
