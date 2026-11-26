import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
const shop = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,100}$/) });
const password = z
  .string()
  .min(10, "Usa al menos 10 caracteres")
  .max(128)
  .refine((v) => /[a-záéíóúñ]/i.test(v) && /\d/.test(v), "Incluye letras y números");
const credentials = shop.extend({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128),
});
const server = () => import("./customer.server"),
  ops = () => import("@/lib/workspace/operations.server");
export const customerShopInfo = createServerFn({ method: "GET" })
  .validator((v: unknown) => shop.parse(v))
  .handler(async ({ data }) => (await server()).customerShop(data.slug));
export const customerSignUp = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    credentials
      .extend({
        password,
        name: z.string().trim().min(2).max(100),
        whatsapp: z.string().regex(/^\+?[\d\s()-]{10,25}$/),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const c = await server(),
      s = await ops(),
      store = await c.customerShop(data.slug);
    const {validWhatsApp,phoneNumber,validFullName}=await import("@/lib/workspace/model");
    if(!validFullName(data.name))throw new Error("Escribe tu nombre completo y apellido");
    if(!validWhatsApp(data.whatsapp)) throw new Error("Escribe un WhatsApp válido con lada");
    await c.customerThrottle("signup", store.slug + ":" + data.email, 5);
    if(!store.id&&data.email===(await import("./main-admin.server")).mainAdminEmail())throw new Error("No se pudo crear la cuenta. Si ya tienes acceso, inicia sesión.");
    const p = await import("./password.server"),
      salt = p.customerSalt();
    const payload = await (
      await import("@/lib/deliveries/deliveries.server")
    ).encryptPayload({ email: data.email, whatsapp: phoneNumber(data.whatsapp), shopId: store.id || "main" });
    const r = await s.opsDB().rpc("ma2_customer_register", {
      p_business: store.id,
      p_email: data.email,
      p_hash: await p.customerHash(data.password, salt),
      p_salt: salt,
      p_name: data.name,
      p_payload: payload,
    });
    if (r.error)
      throw new Error(
        "No se pudo crear la cuenta. Si ya te registraste en esta tienda, inicia sesión.",
      );
    await c.customerSession(String(r.data));
    return { ok: true };
  });
export const customerSignIn = createServerFn({ method: "POST" })
  .validator((v: unknown) => credentials.parse(v))
  .handler(async ({ data }) => {
    const c = await server(),
      s = await ops(),
      store = await c.customerShop(data.slug);
    await c.customerThrottle("login", store.slug + ":" + data.email, 10);
    if(!store.id&&data.email===(await import("./main-admin.server")).mainAdminEmail()){
      try{
        const session=await (await import("./main-admin.server")).mainAdminSignIn(data.password);
        await c.customerLogoutSession();
        return {ok:true as const,role:"admin" as const,token:session.token,mustChangePassword:session.mustChangePassword};
      }catch{throw new Error("Correo o contraseña incorrectos");}
    }
    let q = s.opsDB().from("ma2_customer_accounts").select("*").eq("email", data.email);
    q = store.id ? q.eq("business_id", store.id) : q.is("business_id", null);
    const { data: a, error } = await q.maybeSingle();
    if (error) throw new Error("No se pudo comprobar el acceso");
    const p = await import("./password.server");
    const matches = await p.customerMatches(
      data.password,
      a?.salt || "0".repeat(32),
      a?.password_hash || "0".repeat(64),
    );
    if (!a || !a.active || !matches) throw new Error("Correo o contraseña incorrectos");
    const client=await s.readRecord(a.client_id);
    if(client.module!=="clients"||client.status!=="active")throw new Error("Correo o contraseña incorrectos");
    await c.customerSession(a.id);
    return {ok:true as const,role:(!store.id&&a.price_tier==="reseller"?"reseller":"customer") as "reseller"|"customer"};
  });
export const customerSignOut = createServerFn({ method: "POST" }).handler(async () => {
  await (await server()).customerLogoutSession();
  return { ok: true };
});
export const customerLoad = createServerFn({ method: "POST" })
  .validator((v: unknown) => shop.parse(v))
  .handler(async ({ data }) => {
    const c = await server(),
      s = await ops(),
      ctx = await c.customerContext(data.slug);
    const [entries, orders, records] = await Promise.all([
      s.walletEntries(ctx.client.id),
      s
        .opsDB()
        .from("ma2_customer_orders")
        .select("id,title,amount_cents,expires_on,created_at")
        .eq("client_id", ctx.client.id)
        .order("created_at", { ascending: false })
        .limit(100),
      c.customerRecords(ctx.client.id, !ctx.shop.id),
    ]);
    if (orders.error) throw new Error("No se pudieron cargar tus compras");
    const webRequestIds = ctx.shop.id ? [] : entries.filter(entry=>entry.kind==="purchase" && entry.note.startsWith("Pedido web por encargo · ")).slice(0,100).map(entry=>entry.request_id);
    const webOrders = [];
    if (webRequestIds.length) {
      const db = s.opsDB();
      const [requests, fulfillment] = await Promise.all([
        db.from("orders").select("id, service_name, total, status").eq("catalog_id","store-ma2").in("id",webRequestIds).order("created_at",{ascending:false}),
        db.from("cyberdocs_orders").select("notification_order_id,status").eq("source_key","web_catalog").in("notification_order_id",webRequestIds),
      ]);
      if (requests.error || fulfillment.error) throw new Error("No se pudieron cargar tus pedidos por encargo");
      const status = new Map((fulfillment.data || []).map(r=>[r.notification_order_id,r.status]));
      webOrders.push(...(requests.data || []).map(r=>({id:String(r.id),title:String(r.service_name),total:Number(r.total),status:String(status.get(r.id) || (r.status==="atendido"?"completed":"new"))})));
    }
    const now = Date.now();
    return {
      shop: ctx.shop,
      name: ctx.client.title,
      email: String(ctx.account.email),
      clientReference:ctx.client.clientReference||"",
      priceTier: !ctx.shop.id && ctx.account.price_tier === "reseller" ? "reseller" as const : "retail" as const,
      mustChange: Boolean(ctx.account.must_change),
      ...s.totals(entries),
      entries: entries.slice(0, 100),
      webOrders,
      orders: orders.data as {
        id: string;
        title: string;
        amount_cents: number;
        expires_on: string | null;
        created_at: string;
      }[],
      records: records
        .filter(
          (r) =>
            ((r.data.clientId === ctx.client.id &&
              ["reports", "questions", "requests", "documents", "codes"].includes(r.module)) ||
              (!ctx.shop.id && ["notices", "faq"].includes(r.module) && r.status === "active")) &&
            (!r.data.expiresAt || Date.parse(r.data.expiresAt) > now) &&
            (!["documents", "codes"].includes(r.module) || r.status === "active"),
        )
        .map((r) => ({
          id: r.id,
          module: r.module,
          title: r.title,
          status: r.status,
          message: r.data.message || "",
          reply: r.data.reply || "",
          deliveryUrl: r.data.deliveryUrl || "",
          orderId: r.data.orderId || "",
          purchaseTitle: r.data.purchaseTitle || "",
          value: r.module === "codes" ? r.data.value || "" : "",
          expiresAt: r.data.expiresAt || "",
        })),
    };
  });
export const customerProducts = createServerFn({ method: "POST" })
  .validator((v: unknown) => shop.parse(v))
  .handler(async ({ data }) => {
    const ctx = await (await server()).customerContext(data.slug),
      s = await ops();
    let q = s
      .opsDB()
      .from("stock_items")
      .select(
        "id,platform,account_type,stock_kind,sale_price,duration_months,expires_on,starts_on_sale",
      )
      .eq("status", "available")
      .neq("username", "")
      .neq("password_cipher", "")
      .order("created_at", { ascending: true })
      .limit(1000);
    q = ctx.shop.id ? q.eq("business_id", ctx.shop.id).gt("sale_price",0) : q.is("business_id", null);
    const r = await q;
    if (r.error) throw new Error("No se pudo cargar la tienda");
    let children = s
      .opsDB()
      .from("stock_items")
      .select("parent_stock_id")
      .not("parent_stock_id", "is", null);
    children = ctx.shop.id
      ? children.eq("business_id", ctx.shop.id)
      : children.is("business_id", null);
    const cr = await children;
    if (cr.error) throw new Error("No se pudo comprobar el stock");
    const parents = new Set((cr.data || []).map((v: any) => v.parent_stock_id)),
      today = (await import("@/lib/stock/duration")).businessToday();
    const eligible=(r.data || [])
      .filter(
        (v: any) =>
          !parents.has(v.id) &&
          v.account_type !== "split_parent" &&
          (!v.expires_on || v.expires_on >= today),
      );
    const priceMap=new Map<string,number>();
    if(!ctx.shop.id&&eligible.length) {
      const prices=await s.opsDB().rpc("ma2_customer_prices",{p_account:ctx.account.id,p_stock_ids:eligible.map((v:any)=>v.id)});
      if(prices.error) throw new Error("No se pudo comprobar tu tarifa");
      for(const v of prices.data||[]) if(Number(v.price_cents)>0) priceMap.set(String(v.stock_id), Number(v.price_cents));
    }
    return eligible.filter((v:any)=>ctx.shop.id||priceMap.has(String(v.id)))
      .map((v: any) => ({
        id: String(v.id),
        name: String(v.platform),
        type: String(v.account_type),
        kind: String(v.stock_kind),
        priceCents: ctx.shop.id ? Math.round(Number(v.sale_price) * 100) : priceMap.get(String(v.id))!,
        months: Number(v.duration_months),
        expiresOn: v.starts_on_sale ? null : (v.expires_on as string | null),
      }));
  });
export const customerBuy = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    shop
      .extend({
        stockId: z.string().uuid(),
        priceCents: z.number().int().min(1).max(100000000),
        requestId: z.string().uuid(),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const ctx = await (await server()).customerContext(data.slug),
      s = await ops();
    const r = await s.opsDB().rpc("ma2_customer_buy", {
      p_account: ctx.account.id,
      p_stock: data.stockId,
      p_price: data.priceCents,
      p_request: data.requestId,
    });
    if (r.error)
      throw new Error(
        /insuficiente|disponible|precio|contraseña|sesión/i.test(r.error.message)
          ? r.error.message
          : "No se pudo completar. Revisa Mis compras antes de reintentar.",
      );
    // The purchase is already committed. Contact metadata must not turn it into a failed sale.
    try {
      const contact = await s
        .opsDB()
        .from("stock_items")
        .update({ client_whatsapp: ctx.client.data.whatsapp || "" })
        .eq("id", data.stockId)
        .eq("related_order_id", String(r.data));
      if (contact.error) console.warn("Customer purchase contact metadata was not updated");
    } catch {
      console.warn("Customer purchase contact metadata was not updated");
    }
    try {
      await (await import("./purchase-notify.server")).notifyPaidPurchase(String(r.data), ctx.shop.id);
    } catch {
      console.warn("Customer purchase committed; notification could not be registered");
    }
    return { id: String(r.data) };
  });
export const customerDelivery = createServerFn({ method: "POST" })
  .validator((v: unknown) => shop.extend({ orderId: z.string().uuid() }).parse(v))
  .handler(async ({ data }) => {
    const ctx = await (await server()).customerContext(data.slug),
      s = await ops();
    const { data: o, error } = await s
      .opsDB()
      .from("ma2_customer_orders")
      .select("id,title,detail,expires_on")
      .eq("id", data.orderId)
      .eq("client_id", ctx.client.id)
      .maybeSingle();
    if (error || !o) throw new Error("Entrega no disponible");
    if (o.expires_on && o.expires_on < (await import("@/lib/stock/duration")).businessToday())
      throw new Error("La entrega venció. Contacta a soporte para renovar");
    const cryptoLib = await import("@/lib/deliveries/deliveries.server"),
      secret = await cryptoLib.decryptPayload<{ password: string }>(o.detail.password_cipher);
    const guides: { title: string; image: string }[] = [];
    if (!ctx.shop.id) {
      const r = await s
        .opsDB()
        .from("ma2_platform_gallery")
        .select("title,image_cipher")
        .eq("platform", String(o.title).split(" · ")[0])
        .is("archived_at", null)
        .limit(4);
      for (const row of r.error ? [] : r.data || []) {
        try {
          const img = await cryptoLib.decryptPayload<{ image: string }>(row.image_cipher);
          if (
            /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(img.image) &&
            guides.reduce((n, g) => n + g.image.length, 0) + img.image.length < 2_500_000
          )
            guides.push({ title: String(row.title), image: img.image });
        } catch {}
      }
    }
    return {
      id: String(o.id),
      title: String(o.title),
      username: String(o.detail.username),
      password: secret.password,
      profilePin: String(o.detail.profilePin || ""),
      expiresOn: o.expires_on as string | null,
      link: "",
      notes: "",
      guides,
    };
  });
export const customerWebDelivery = createServerFn({ method: "POST" })
  .validator((v: unknown) => shop.extend({ orderId: z.string().uuid() }).parse(v))
  .handler(async ({ data }) => {
    const ctx = await (await server()).customerContext(data.slug);
    if (ctx.shop.id || ctx.account.must_change) throw new Error("Entrega no disponible");
    return (await import("./order-access-guide.server")).readWebOrderDelivery(ctx.client.id, data.orderId);
  });

export const customerDocument = createServerFn({ method: "POST" })
  .validator((v: unknown) => shop.extend({ documentId: z.string().uuid() }).parse(v))
  .handler(async ({ data }) => {
    const ctx = await (await server()).customerContext(data.slug),
      s = await ops(),
      r = await s.readRecord(data.documentId);
    if (
      r.module !== "documents" ||
      r.status !== "active" ||
      r.data.clientId !== ctx.client.id ||
      (r.data.expiresAt && Date.parse(r.data.expiresAt) <= Date.now()) ||
      !/^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/.test(r.data.attachment || "")
    )
      throw new Error("Documento no disponible");
    return { filename: r.data.filename || "documento.pdf", attachment: r.data.attachment };
  });
export const customerSubmit = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    shop
      .extend({
        module: z.enum(["reports", "questions", "requests"]),
        title: z.string().trim().min(2).max(160),
        message: z.string().trim().min(2).max(2000),
        orderId: z.string().uuid().optional(),
        evidence: z.string().max(1_800_000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/).optional(),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const c = await server(),
      ctx = await c.customerContext(data.slug),
      s = await ops();
    let purchaseTitle = "";
    if (data.orderId) {
      const db = s.opsDB();
      const o = await db.from("ma2_customer_orders").select("title")
        .eq("id", data.orderId).eq("client_id", ctx.client.id).maybeSingle();
      if (o.error) throw new Error("No se pudo comprobar la compra");
      if (o.data) purchaseTitle = String(o.data.title);
      else if (!ctx.shop.id) {
        const payment = await db.from("ma2_wallet_entries").select("note")
          .eq("request_id", data.orderId).eq("client_id", ctx.client.id).eq("kind","purchase").maybeSingle();
        if (payment.error) throw new Error("No se pudo comprobar el pago de la compra");
        if (payment.data?.note.startsWith("Pedido web por encargo · ")) {
          const request = await db.from("orders").select("service_name,status")
            .eq("id",data.orderId).eq("catalog_id","store-ma2").maybeSingle();
          if (request.error) throw new Error("No se pudo consultar el pedido");
          if (request.data) purchaseTitle = String(request.data.service_name);
        }
      }
      if (!purchaseTitle) throw new Error("Selecciona una compra de tu cuenta");
    }
    const records = await c.customerRecords(ctx.client.id);
    if (records.filter((r) => r.module === data.module && r.status === "pending").length >= 20)
      throw new Error("Espera la atención de tus solicitudes pendientes");
    if(data.module==="reports" && data.orderId && records.some(r=>r.module==="reports" && r.data.orderId===data.orderId && ["pending","in_progress"].includes(r.status)))
      throw new Error("Esta compra ya tiene un reporte pendiente. Consulta su seguimiento en Mis reportes.");
    const record=await s.createRecord(data.module, data.title, "pending", {
      clientId: ctx.client.id,
      shopId: ctx.shop.id || "main",
      message: data.message,
      ...(data.module==="requests"?{platform:data.title}:{}),
      orderId: data.orderId || "",
      purchaseTitle,
      ...(data.module === "reports" ? { platform: purchaseTitle || data.title } : {}),
      ...(data.module === "reports" && data.evidence ? { attachment: data.evidence, filename: "captura-de-falla.jpg", filetype: "image/jpeg" } : {}),
    });
    let replaced=false;
    if(data.module==="reports" && !ctx.shop.id && data.orderId && data.evidence){
      try {
        const {purchaseRecordId}=await import("./purchase-identity.server");
        const result=await s.opsDB().rpc("ma2_auto_replace_purchase",{
          p_purchase:data.orderId,p_client:ctx.client.id,p_report:record.id,
          p_document:purchaseRecordId("document",data.orderId),p_name:ctx.client.title,p_phone:ctx.client.data.whatsapp||"",
        });
        if(!result.error&&result.data===true){
          await s.changeRecord(record,{status:"resolved",data:{...record.data,reply:"Tu reposición fue realizada sin costo. Abre Mis compras para consultar el acceso actualizado. Conservas tu fecha de vencimiento original."}});
          replaced=true;
        }
      } catch { /* El reporte ya quedó guardado para revisión. */ }
    }
    if((data.module==="requests"||data.module==="reports")&&!ctx.shop.id){
      try{
        const notify=await import("@/lib/notify/notify.server"),db=await notify.admin();
        const isReport=data.module==="reports";
        const {data:row,error}=await db.from("orders").upsert({id:record.id,catalog_id:isReport?"customer-report":"customer-request",catalog_name:isReport?"Página web MA² · Reportes":"Página web MA² · Por encargo",service_name:replaced?"Reposición automática · "+purchaseTitle:data.title,total:0,items:[{name:data.title,price:0}],message:"Cliente: "+ctx.client.title+"\n"+(replaced?"Reposición realizada sin cobro":isReport?"Reporte de falla: "+data.message:"Solicitud por encargo: "+data.message),link:"/?panel=1",recipient:"",...(replaced?{status:"atendido" as const,attended_at:new Date().toISOString()}:{})},{onConflict:"id",ignoreDuplicates:true}).select("*").maybeSingle();
        if(error)throw error;
        if(row){const settings=await notify.loadSettings();if(settings.enabled&&notify.withinSchedule(settings))await notify.notifyOrder(notify.rowToOrder(row as Record<string,unknown>),settings);}
      }catch{/* La solicitud está guardada; no volver a crearla por un fallo de aviso. */}
    }
    return { ok: true };
  });
export const customerChangePassword = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    shop.extend({ currentPassword: z.string().max(128), password }).parse(v),
  )
  .handler(async ({ data }) => {
    const c = await server(),
      ctx = await c.customerContext(data.slug),
      s = await ops();
    await c.customerThrottle("change", ctx.account.id, 5);
    const p = await import("./password.server");
    if (
      !(await p.customerMatches(data.currentPassword, ctx.account.salt, ctx.account.password_hash))
    )
      throw new Error("La contraseña actual no es correcta");
    const salt = p.customerSalt();
    const r = await s
      .opsDB()
      .from("ma2_customer_accounts")
      .update({
        salt,
        password_hash: await p.customerHash(data.password, salt),
        must_change: false,
      })
      .eq("id", ctx.account.id)
      .eq("password_hash", ctx.account.password_hash)
      .select("id")
      .maybeSingle();
    if (r.error || !r.data) throw new Error("La cuenta cambió. Vuelve a entrar");
    const old = await s
      .opsDB()
      .from("ma2_customer_sessions")
      .delete()
      .eq("account_id", ctx.account.id);
    if (old.error)
      throw new Error(
        "Contraseña guardada, pero no se pudieron cerrar las sesiones. Contacta a soporte",
      );
    await c.customerSession(ctx.account.id);
    return { ok: true };
  });
export const customerRechargeLoad = createServerFn({ method: "POST" })
  .validator((v: unknown) => shop.parse(v))
  .handler(async ({ data }) => {
    const ctx = await (await server()).customerContext(data.slug),
      s = await ops();
    if (ctx.shop.id)
      return {
        settings: null,
        requests: [] as import("@/lib/recharges/settings").RechargeRequest[],
      };
    const cfg = await (await import("@/lib/recharges/mail.server")).readConfig(),
      { paymentDetails } = await import("@/lib/recharges/settings");
    const r = await s
      .opsDB()
      .from("ma2_recharge_requests")
      .select("*")
      .eq("client_id", ctx.client.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (r.error) throw new Error("No se pudieron cargar las recargas");
    return {
      settings: cfg ? paymentDetails(cfg.settings) : null,
      requests: r.data as import("@/lib/recharges/settings").RechargeRequest[],
    };
  });
export const customerRechargeCreate = createServerFn({ method: "POST" })
  .validator((v: unknown) => shop.extend({ amount: z.number().int().min(1).max(1000000) }).parse(v))
  .handler(async ({ data }) => {
    const ctx = await (await server()).customerContext(data.slug);
    if (ctx.shop.id) throw new Error("Solicita la recarga por soporte de esta tienda");
    const s = await ops(),
      r = await s
        .opsDB()
        .rpc("ma2_recharge_create", { p_client: ctx.client.id, p_amount: data.amount * 100 });
    if (r.error)
      throw new Error(
        /l[ií]mite|referencias|Importe|recargas|centavos/i.test(r.error.message)
          ? r.error.message
          : "No se pudo generar la referencia",
      );
    return r.data as import("@/lib/recharges/settings").RechargeRequest;
  });
export const customerRechargeCancel = createServerFn({ method: "POST" })
  .validator((v: unknown) => shop.extend({ requestId: z.string().uuid() }).parse(v))
  .handler(async ({ data }) => {
    const ctx = await (await server()).customerContext(data.slug),
      s = await ops(),
      r = await s
        .opsDB()
        .from("ma2_recharge_requests")
        .update({ status: "cancelled" })
        .eq("id", data.requestId)
        .eq("client_id", ctx.client.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
    if (r.error || !r.data) throw new Error("La referencia cambió. Actualiza antes de continuar");
    return { ok: true };
  });
