import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
const auth = z.object({
  ownerToken: z.string().max(500).optional(),
  code: z.string().max(200).optional(),
});
async function context(data: z.infer<typeof auth>) {
  const s = await import("@/lib/workspace/operations.server");
  if (data.ownerToken) {
    const c = await (await import("./customer.server")).customerOwner(data.ownerToken);
    return { business: c.business.id as string | null, s };
  }
  await (await import("@/lib/notify/notify.server")).requireAdminCode(data.code || "");
  return { business: null as string | null, s };
}
async function account(ctx: Awaited<ReturnType<typeof context>>, id: string) {
  let q = ctx.s.opsDB().from("ma2_customer_accounts").select("*").eq("id", id);
  q = ctx.business ? q.eq("business_id", ctx.business) : q.is("business_id", null);
  const r = await q.maybeSingle();
  if (r.error || !r.data) throw new Error("Cliente no disponible en esta tienda");
  return r.data;
}
export const customerManageLoad = createServerFn({ method: "POST" })
  .validator((v: unknown) => auth.parse(v))
  .handler(async ({ data }) => {
    const ctx = await context(data);
    let q = ctx.s
      .opsDB()
      .from("ma2_customer_accounts")
      .select("id,client_id,email,active,must_change,price_tier")
      .order("created_at", { ascending: false })
      .limit(200);
    q = ctx.business ? q.eq("business_id", ctx.business) : q.is("business_id", null);
    const r = await q;
    if (r.error) throw new Error("No se pudieron cargar los clientes");
    const ids = (r.data || []).map((a: any) => a.client_id);
    const e = ids.length
      ? await ctx.s
          .opsDB()
          .from("ma2_wallet_entries")
          .select("client_id,amount_cents,kind")
          .in("client_id", ids)
      : { data: [], error: null };
    if (e.error) throw new Error("No se pudieron cargar los saldos");
    const records = await ctx.s.readRecords();
    return {
      accounts: (r.data || []).map((a: any) => ({
        ...a,
        name: records.find((c) => c.id === a.client_id)?.title || "Cliente",
        balance:
          (e.data || [])
            .filter(
              (v: any) => v.client_id === a.client_id && !["credit", "repayment"].includes(v.kind),
            )
            .reduce((n: number, v: any) => n + Number(v.amount_cents), 0) / 100,
      })) as {
        id: string;
        client_id: string;
        name: string;
        email: string;
        active: boolean;
        must_change: boolean;
        balance: number;
        price_tier: "retail" | "reseller";
      }[],
      requests: records
        .filter(
          (r) =>
            ids.includes(r.data.clientId) &&
            ["reports", "questions", "requests"].includes(r.module),
        )
        .map((r) => ({
          id: r.id,
          version: r.version,
          title: r.title,
          status: r.status,
          clientId: r.data.clientId,
          message: r.data.message || "",
          reply: r.data.reply || "",
        })),
    };
  });
export const customerContactTier = createServerFn({method:"POST"})
  .validator((v:unknown)=>auth.extend({clientId:z.string().uuid(),tier:z.enum(["retail","reseller"])}).parse(v))
  .handler(async ({data})=>{
    const ctx=await context(data);
    if(ctx.business || data.ownerToken) throw new Error("Solo MA² puede cambiar esta tarifa");
    const contact=await ctx.s.readRecord(data.clientId);
    if(contact.module!=="clients" || (contact.data.shopId && contact.data.shopId!=="main")) throw new Error("Cliente no disponible");
    await saveContactTier(ctx,contact.id,data.tier);
    return {ok:true};
  });
async function saveContactTier(ctx:Awaited<ReturnType<typeof context>>,clientId:string,tier:"retail"|"reseller"){
  const result=await ctx.s.opsDB().from("ma2_ops_records").update({price_tier:tier}).eq("id",clientId).eq("module","clients").is("archived_at",null).select("id").maybeSingle();
  if(result.error || !result.data) throw new Error("No se pudo guardar el tipo de cliente");
}
export const customerManageTier = createServerFn({method:"POST"}).validator((v:unknown)=>auth.extend({accountId:z.string().uuid(),tier:z.enum(["retail","reseller"])}).parse(v)).handler(async({data})=>{
  const ctx=await context(data);if(ctx.business||data.ownerToken) throw new Error("Solo MA² puede administrar estas tarifas");
  const a=await account(ctx,data.accountId);
  await saveContactTier(ctx,a.client_id,data.tier);return {ok:true};
});
export const customerManageCredit = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    auth
      .extend({
        accountId: z.string().uuid(),
        amount: z
          .number()
          .positive()
          .max(1000000)
          .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001),
        note: z.string().trim().min(3).max(400),
        requestId: z.string().uuid(),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const ctx = await context(data),
      a = await account(ctx, data.accountId);
    const r = await ctx.s.opsDB().rpc("ma2_wallet_post", {
      p_client: a.client_id,
      p_amount: Math.round(data.amount * 100),
      p_kind: "recharge",
      p_note: data.note,
      p_request: data.requestId,
    });
    if (r.error) throw new Error("No se pudo acreditar. Actualiza el saldo antes de reintentar");
    return { ok: true };
  });
export const customerManageReset = createServerFn({ method: "POST" })
  .validator((v: unknown) => auth.extend({ accountId: z.string().uuid() }).parse(v))
  .handler(async ({ data }) => {
    const ctx = await context(data),
      a = await account(ctx, data.accountId),
      p = await import("./password.server"),
      salt = p.customerSalt(),
      password = "MA2-" + crypto.randomUUID().replaceAll("-", "").slice(0, 20);
    const r = await ctx.s
      .opsDB()
      .from("ma2_customer_accounts")
      .update({ salt, password_hash: await p.customerHash(password, salt), must_change: true })
      .eq("id", a.id)
      .eq("password_hash", a.password_hash)
      .select("id")
      .maybeSingle();
    if (r.error || !r.data) throw new Error("La cuenta cambió. Actualiza antes de continuar");
    const revoke = await ctx.s
      .opsDB()
      .from("ma2_customer_sessions")
      .delete()
      .eq("account_id", a.id);
    if (revoke.error)
      throw new Error("No se pudieron cerrar las sesiones. Reintenta la recuperación");
    return { password };
  });
export const customerManageInvite = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    auth
      .extend({
        clientId: z.string().uuid(),
        email: z
          .string()
          .trim()
          .email()
          .max(254)
          .transform((v) => v.toLowerCase()),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const ctx = await context(data),
      client = await ctx.s.readRecord(data.clientId);
    if (
      client.module !== "clients" ||
      client.status !== "active" ||
      (ctx.business
        ? client.data.shopId !== ctx.business
        : Boolean(client.data.shopId && client.data.shopId !== "main"))
    )
      throw new Error("Cliente no disponible en esta tienda");
    const p = await import("./password.server"),
      salt = p.customerSalt(),
      password = "MA2-" + crypto.randomUUID().replaceAll("-", "").slice(0, 20);
    const r = await ctx.s
      .opsDB()
      .from("ma2_customer_accounts")
      .insert({
        client_id: client.id,
        business_id: ctx.business,
        email: data.email,
        salt,
        password_hash: await p.customerHash(password, salt),
        must_change: true,
      });
    if (r.error)
      throw new Error(
        "El cliente o correo ya tienen acceso. Usa Recuperar acceso para una cuenta existente",
      );
    return { password };
  });
export const customerManageReply = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    auth
      .extend({
        id: z.string().uuid(),
        version: z.number().int(),
        reply: z.string().max(2000),
        status: z.enum(["pending", "in_progress", "resolved", "completed", "cancelled"]),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const ctx = await context(data),
      r = await ctx.s.readRecord(data.id);
    if (!["reports", "questions", "requests"].includes(r.module))
      throw new Error("Solicitud no disponible");
    let q = ctx.s
      .opsDB()
      .from("ma2_customer_accounts")
      .select("id")
      .eq("client_id", r.data.clientId);
    q = ctx.business ? q.eq("business_id", ctx.business) : q.is("business_id", null);
    const a = await q.maybeSingle();
    if (a.error || !a.data || r.version !== data.version)
      throw new Error("Solicitud no disponible o modificada");
    await ctx.s.changeRecord(r, { status: data.status, data: { ...r.data, reply: data.reply } });
    if(!ctx.business && ((r.module==="reports" && data.status==="resolved") || (r.module==="requests" && ["completed","cancelled"].includes(data.status)))){
      await ctx.s.opsDB().from("orders").update({status:"atendido",attended_at:new Date().toISOString()}).eq("id",r.id).eq("catalog_id",r.module==="reports"?"customer-report":"customer-request");
    }
    return { ok: true };
  });
export const customerManageActive = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    auth.extend({ accountId: z.string().uuid(), active: z.boolean() }).parse(v),
  )
  .handler(async ({ data }) => {
    const ctx = await context(data),
      a = await account(ctx, data.accountId);
    const r = await ctx.s
      .opsDB()
      .from("ma2_customer_accounts")
      .update({ active: data.active })
      .eq("id", a.id);
    if (r.error) throw new Error("No se pudo actualizar el acceso");
    if (!data.active) {
      const d = await ctx.s.opsDB().from("ma2_customer_sessions").delete().eq("account_id", a.id);
      if (d.error) throw new Error("Acceso suspendido, pero no se pudieron cerrar sus sesiones");
    }
    return { ok: true };
  });
