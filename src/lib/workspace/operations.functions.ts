import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MODULES, DEFINITIONS, validatePayload, phoneNumber, type Payload } from "./model";
const auth = z.object({ code: z.string().min(4).max(200) });
const id = z.string().uuid();
const payload = z.record(z.string().max(7_100_000));
async function gate(code: string) {
  await (await import("@/lib/notify/notify.server")).requireAdminCode(code);
  return import("./operations.server");
}
export const opsLoad = createServerFn({ method: "POST" })
  .validator((v: unknown) => auth.parse(v))
  .handler(async ({ data }) => {
    const s = await gate(data.code);
    const [records, entries] = await Promise.all([s.readRecords(), s.walletEntries()]);
    return {
      records: records.map((r) => {
        const { portalHash, attachment, ...data } = r.data;
        return { ...r, data };
      }),
      entries,
    };
  });
export const opsGet = createServerFn({ method: "POST" })
  .validator((v: unknown) => auth.extend({ id }).parse(v))
  .handler(async ({ data }) => {
    const s = await gate(data.code);
    const r = await s.readRecord(data.id);
    const { portalHash, ...safe } = r.data;
    return { ...r, data: safe };
  });
export const opsSave = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    auth
      .extend({
        id: id.optional(),
        version: z.number().int().positive().optional(),
        module: z.enum(MODULES),
        title: z.string().trim().min(1).max(160),
        status: z.string().max(40),
        payload,
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const s = await gate(data.code);
    if (!DEFINITIONS[data.module].statuses.includes(data.status))
      throw new Error("Estado inválido");
    validatePayload(data.module, data.payload);
    if (
      data.module === "codes" &&
      data.status === "active" &&
      Date.parse(data.payload.expiresAt) <= Date.now()
    )
      throw new Error("El código activo debe tener una vigencia futura");
    if (data.module === "clients") {
      const clients = await s.readRecords("clients");
      if (
        clients.some(
          (r) =>
            r.id !== data.id &&
            phoneNumber(r.data.whatsapp || "") === phoneNumber(data.payload.whatsapp),
        )
      )
        throw new Error("Ya existe un cliente con ese WhatsApp");
    }
    if (
      Object.entries(data.payload).some(
        ([key, value]) => value.length > (key === "attachment" ? 4_100_000 : 10000),
      )
    )
      throw new Error("El archivo o texto supera el tamaño permitido");
    const fields = new Set([
      ...DEFINITIONS[data.module].fields.map((f) => f.key),
      "attachment",
      "filename",
      "filetype",
    ]);
    const clean: Payload = {};
    for (const [key, v] of Object.entries(data.payload)) if (fields.has(key)) clean[key] = v;
    if (
      clean.attachment &&
      !/^data:(application\/pdf|image\/(jpeg|png|webp));base64,[A-Za-z0-9+/=]+$/.test(
        clean.attachment,
      )
    )
      throw new Error("Adjunta PDF o imagen JPG, PNG o WebP");
    if (data.module === "referrals") {
      const all = await s.readRecords("referrals");
      if (
        all.some((r) => r.id !== data.id && r.data.code.toLowerCase() === clean.code.toLowerCase())
      )
        throw new Error("Ese código ya existe");
    }
    if (clean.clientId) {
      const client = await s.readRecord(clean.clientId);
      if (client.module !== "clients") throw new Error("Cliente inválido");
    }
    if (data.id) {
      const old = await s.readRecord(data.id);
      if (old.module !== data.module || old.version !== data.version)
        throw new Error("El registro cambió. Actualiza antes de guardar.");
      if (old.data.portalHash) clean.portalHash = old.data.portalHash;
      return s.changeRecord(old, { title: data.title, status: data.status, data: clean });
    }
    return s.createRecord(data.module, data.title, data.status, clean);
  });
export const opsArchive = createServerFn({ method: "POST" })
  .validator((v: unknown) => auth.extend({ id, version: z.number().int() }).parse(v))
  .handler(async ({ data }) => {
    const s = await gate(data.code);
    const r = await s.readRecord(data.id);
    if (r.version !== data.version) throw new Error("Actualiza el registro antes de retirarlo");
    if (r.module === "clients") {
      const totals = s.totals(await s.walletEntries(r.id));
      if (Math.round(totals.balance * 100) !== 0 || Math.round(totals.debt * 100) !== 0)
        throw new Error("Primero salda el saldo y el crédito del cliente antes de retirarlo");
    }
    await s.changeRecord(r, { archived_at: new Date().toISOString() });
    return { ok: true };
  });
export const walletPost = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    auth
      .extend({
        clientId: id,
        amount: z.number().finite().positive().max(1_000_000),
        kind: z.enum(["recharge", "withdrawal", "credit", "repayment"]),
        note: z.string().trim().min(1).max(500),
        requestId: id,
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const s = await gate(data.code);
    const amount =
      Math.round(data.amount * 100) *
      (data.kind === "withdrawal" || data.kind === "repayment" ? -1 : 1);
    const result = await s.opsDB().rpc("ma2_wallet_post", {
      p_client: data.clientId,
      p_amount: amount,
      p_kind: data.kind,
      p_note: data.note,
      p_request: data.requestId,
    });
    if (result.error)
      throw new Error(
        /insuficiente|supera|disponible/.test(result.error.message)
          ? result.error.message
          : "No se pudo registrar el movimiento",
      );
    return { ok: true };
  });
export const opsPortalLink = createServerFn({ method: "POST" })
  .validator((v: unknown) => auth.extend({ id }).parse(v))
  .handler(async ({ data }) => {
    const s = await gate(data.code);
    const r = await s.readRecord(data.id);
    if (r.module !== "clients" || r.status !== "active")
      throw new Error("Selecciona un cliente activo");
    const token = crypto.randomUUID() + crypto.randomUUID();
    await s.changeRecord(r, { data: { ...r.data, portalHash: await s.hashToken(token) } });
    return { id: r.id, token };
  });
const portal = z.object({ id, token: z.string().min(60).max(100) });
export const portalLoad = createServerFn({ method: "POST" })
  .validator((v: unknown) => portal.parse(v))
  .handler(async ({ data }) => {
    const s = await import("./operations.server");
    const client = await s.portalClient(data.id, data.token);
    const [records, entries] = await Promise.all([s.readRecords(), s.walletEntries(client.id)]);
    const now = Date.now();
    const own = records.filter(
      (r) =>
        r.data.clientId === client.id &&
        ["reports", "questions", "requests", "codes", "documents"].includes(r.module) &&
        !(
          r.module === "documents" &&
          (r.status !== "active" || (r.data.expiresAt && Date.parse(r.data.expiresAt) <= now))
        ),
    );
    const shared = records.filter(
      (r) =>
        ["notices", "faq", "config"].includes(r.module) &&
        r.status === "active" &&
        (!r.data.expiresAt || Date.parse(r.data.expiresAt) > now),
    );
    return {
      name: client.title,
      ...s.totals(entries),
      entries: entries.slice(0, 50),
      records: [...own, ...shared].map((r) => {
        const { attachment, ...metadata } = r.data;
        return r.module === "codes" &&
          (r.status !== "active" || Date.parse(r.data.expiresAt) <= now)
          ? { ...r, data: { ...metadata, value: "" }, status: "expired" }
          : { ...r, data: metadata };
      }),
    };
  });
export const portalSubmit = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    portal
      .extend({
        module: z.enum(["reports", "questions", "requests"]),
        title: z.string().trim().min(1).max(160),
        message: z.string().trim().min(1).max(2000),
        platform: z.string().max(100).default(""),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const s = await import("./operations.server");
    const client = await s.portalClient(data.id, data.token);
    const records = await s.readRecords(data.module);
    if (records.filter((r) => r.data.clientId === client.id && r.status === "pending").length >= 20)
      throw new Error("Tienes 20 solicitudes pendientes. Espera atención antes de enviar más.");
    await s.createRecord(data.module, data.title, "pending", {
      clientId: client.id,
      message: data.message,
      platform: data.platform,
    });
    return { ok: true };
  });
export const storeNotices = createServerFn({ method: "GET" }).handler(async () => {
  const s = await import("./operations.server");
  const records = await s.readRecords("notices");
  return records
    .filter(
      (r) =>
        r.status === "active" &&
        r.data.public === "Sí" &&
        (!r.data.expiresAt || Date.parse(r.data.expiresAt) > Date.now()),
    )
    .sort((a, b) => Number(b.data.pinned === "Sí") - Number(a.data.pinned === "Sí"))
    .slice(0, 10)
    .map((r) => ({
      id: r.id,
      title: r.title,
      message: r.data.message || "",
      kind: r.data.kind || "Información",
    }));
});
export const opsImportClients = createServerFn({ method: "POST" })
  .validator((v: unknown) => auth.parse(v))
  .handler(async ({ data }) => {
    const s = await gate(data.code);
    const { phoneNumber } = await import("./model");
    const stock = await (await import("@/lib/stock/stock.server")).listStock(null);
    const existing = new Set(
      (await s.readRecords("clients")).map((r) => phoneNumber(r.data.whatsapp || "")),
    );
    let count = 0;
    for (const item of stock) {
      const phone = phoneNumber(item.clientWhatsapp);
      if (phone.length < 10 || existing.has(phone) || !item.clientName.trim()) continue;
      await s.createRecord("clients", item.clientName.slice(0, 160), "active", {
        whatsapp: phone,
        notes: "Importado de una entrega registrada en el stock",
      });
      existing.add(phone);
      count++;
    }
    return { count };
  });

export const portalDocument = createServerFn({ method: "POST" })
  .validator((v: unknown) => portal.extend({ documentId: id }).parse(v))
  .handler(async ({ data }) => {
    const s = await import("./operations.server");
    const client = await s.portalClient(data.id, data.token);
    const doc = await s.readRecord(data.documentId);
    if (
      doc.module !== "documents" ||
      doc.status !== "active" ||
      doc.data.clientId !== client.id ||
      (doc.data.expiresAt && Date.parse(doc.data.expiresAt) <= Date.now()) ||
      !doc.data.attachment
    )
      throw new Error("Documento no disponible");
    return { attachment: doc.data.attachment, filename: doc.data.filename || "documento" };
  });
