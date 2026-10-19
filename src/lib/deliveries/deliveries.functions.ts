import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { DeliveryPublicView, ProtectedDelivery, ProtectedDeliveryAdminView, ProtectedDeliveryPrivate } from "./types";

const adminSchema = z.object({ code: z.string().min(4) });
const idSchema = z.object({ id: z.string().uuid(), token: z.string().min(20) });
const accessSchema = idSchema.extend({ accessPassword: z.string().max(200).default("") });
const attachmentSchema = z.object({
  name: z.string().min(1).max(240),
  type: z.string().max(160).default("application/octet-stream"),
  dataUrl: z.string().max(8_000_000),
}).nullable();


function publicOf(d: ProtectedDeliveryPrivate): ProtectedDelivery {
  const { password: _password, token: _token, accessPassword: _accessPassword, link: _link, panelUsername: _panelUsername, panelPassword: _panelPassword, ...safe } = d;
  return { ...safe, protectedWithPassword: Boolean(d.accessPassword) };
}

function expired(d: ProtectedDeliveryPrivate) {
  return new Date(d.expiresAt).getTime() <= Date.now();
}

function canOpen(d: ProtectedDeliveryPrivate) {
  if (d.status !== "active") return false;
  if (expired(d)) return false;
  if (d.maxViews !== null && d.viewCount >= d.maxViews) return false;
  return true;
}

export const deliveriesList = createServerFn({ method: "POST" })
  .validator((v: unknown) => adminSchema.parse(v))
  .handler(async ({ data }): Promise<ProtectedDelivery[]> => {
    const s = await import("./deliveries.server");
    await s.requireAdminCode(data.code);
    const rows = await s.listDeliveryRows();
    const out: ProtectedDelivery[] = [];
    for (const row of rows) {
      try {
        const payload = await s.decryptPayload<ProtectedDeliveryPrivate>(String(row["detail"] ?? ""));
        const normalized = { ...payload, images: Array.isArray(payload.images) ? payload.images.slice(0, 2) : [], attachment: payload.attachment ?? null, imageCount: Array.isArray(payload.images) ? payload.images.length : 0, id: String(row["id"] ?? payload.id) };
        out.push(publicOf(normalized));
      } catch {
        // Ignora filas antiguas/no compatibles del log.
      }
    }
    return out;
  });

const createSchema = adminSchema.extend({
  platform: z.string().min(1).max(80),
  client: z.string().max(120).default(""),
  whatsapp: z.string().max(40).default(""),
  username: z.string().max(200).default(""),
  password: z.string().max(500).default(""),
  link: z.string().max(2000).default(""),
  panelUsername: z.string().max(250).default(""),
  panelPassword: z.string().max(1000).default(""),
  accessPassword: z.string().max(200).default(""),
  platformMessage: z.string().max(4000).default(""),
  passwordMessage: z.string().max(4000).default(""),
  notes: z.string().max(2000).default(""),
  images: z.array(z.string().max(3_000_000)).max(2).default([]),
  attachment: attachmentSchema.default(null),
  expiresAt: z.string().datetime(),
  maxViews: z.number().int().min(1).max(1000).nullable(),
});

export const deliveriesCreate = createServerFn({ method: "POST" })
  .validator((v: unknown) => createSchema.parse(v))
  .handler(async ({ data }) => {
    const s = await import("./deliveries.server");
    await s.requireAdminCode(data.code);
    const now = new Date().toISOString();
    const token = s.randomToken();
    const draft: ProtectedDeliveryPrivate = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      platform: data.platform.trim(),
      client: data.client.trim(),
      whatsapp: data.whatsapp.trim(),
      username: data.username.trim(),
      password: data.password,
      link: data.link.trim(),
      panelUsername: data.panelUsername.trim(),
      panelPassword: data.panelPassword,
      accessPassword: data.accessPassword,
      platformMessage: data.platformMessage.trim(),
      passwordMessage: data.passwordMessage.trim(),
      notes: data.notes.trim(),
      images: data.images.slice(0, 2),
      attachment: data.attachment,
      imageCount: data.images.length,
      protectedWithPassword: Boolean(data.accessPassword),
      expiresAt: data.expiresAt,
      maxViews: data.maxViews,
      viewCount: 0,
      lastViewedAt: null,
      status: "active",
      token,
      history: [{ at: now, kind: "created", detail: "Entrega creada" }],
    };
    const inserted = await s.insertDelivery(draft);
    draft.id = inserted.id;
    draft.createdAt = inserted.createdAt;
    draft.history[0]!.at = inserted.createdAt;
    await s.saveDeliveryRow(inserted.id, draft);
    return { delivery: publicOf(draft), token };
  });

const patchSchema = adminSchema.extend({
  id: z.string().uuid(),
  platform: z.string().min(1).max(80).optional(),
  client: z.string().max(120).optional(),
  whatsapp: z.string().max(40).optional(),
  username: z.string().max(200).optional(),
  password: z.string().max(500).optional(),
  link: z.string().max(2000).optional(),
  panelUsername: z.string().max(250).optional(),
  panelPassword: z.string().max(1000).optional(),
  accessPassword: z.string().max(200).optional(),
  platformMessage: z.string().max(4000).optional(),
  passwordMessage: z.string().max(4000).optional(),
  notes: z.string().max(2000).optional(),
  images: z.array(z.string().max(3_000_000)).max(2).optional(),
  attachment: attachmentSchema.optional(),
  expiresAt: z.string().datetime().optional(),
  maxViews: z.number().int().min(1).max(1000).nullable().optional(),
  status: z.enum(["active", "suspended", "revoked"]).optional(),
});

export const deliveriesPatch = createServerFn({ method: "POST" })
  .validator((v: unknown) => patchSchema.parse(v))
  .handler(async ({ data }) => {
    const s = await import("./deliveries.server");
    await s.requireAdminCode(data.code);
    const row = await s.getDeliveryRow(data.id);
    if (!row) throw new Error("Entrega no encontrada");
    const raw = await s.decryptPayload<ProtectedDeliveryPrivate>(String(row["detail"] ?? ""));
    const d: ProtectedDeliveryPrivate = { ...raw, images: Array.isArray(raw.images) ? raw.images.slice(0, 2) : [], attachment: raw.attachment ?? null, imageCount: Array.isArray(raw.images) ? raw.images.length : 0 };
    const now = new Date().toISOString();
    const next: ProtectedDeliveryPrivate = {
      ...d,
      ...(data.platform !== undefined ? { platform: data.platform.trim() } : {}),
      ...(data.client !== undefined ? { client: data.client.trim() } : {}),
      ...(data.whatsapp !== undefined ? { whatsapp: data.whatsapp.trim() } : {}),
      ...(data.username !== undefined ? { username: data.username.trim() } : {}),
      ...(data.password !== undefined ? { password: data.password } : {}),
      ...(data.link !== undefined ? { link: data.link.trim() } : {}),
      ...(data.panelUsername !== undefined ? { panelUsername: data.panelUsername.trim() } : {}),
      ...(data.panelPassword !== undefined ? { panelPassword: data.panelPassword } : {}),
      ...(data.accessPassword !== undefined ? { accessPassword: data.accessPassword, protectedWithPassword: Boolean(data.accessPassword) } : {}),
      ...(data.platformMessage !== undefined ? { platformMessage: data.platformMessage.trim() } : {}),
      ...(data.passwordMessage !== undefined ? { passwordMessage: data.passwordMessage.trim() } : {}),
      ...(data.notes !== undefined ? { notes: data.notes.trim() } : {}),
      ...(data.images !== undefined ? { images: data.images.slice(0, 2), imageCount: data.images.length } : {}),
      ...(data.attachment !== undefined ? { attachment: data.attachment } : {}),
      ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
      ...(data.maxViews !== undefined ? { maxViews: data.maxViews } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      id: data.id,
      updatedAt: now,
    };
    let kind: ProtectedDeliveryPrivate["history"][number]["kind"] = "edited";
    if (data.status === "suspended") kind = "suspended";
    if (data.status === "active" && d.status === "suspended") kind = "reactivated";
    if (data.status === "revoked") kind = "revoked";
    next.history = [...d.history, { at: now, kind, detail: kind === "edited" ? "Entrega actualizada" : `Estado: ${data.status}` }].slice(-100);
    await s.saveDeliveryRow(data.id, next);
    return publicOf(next);
  });

export const deliveriesGetAdminDetails = createServerFn({ method: "POST" })
  .validator((v: unknown) => adminSchema.extend({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data }): Promise<ProtectedDeliveryAdminView> => {
    const s = await import("./deliveries.server");
    await s.requireAdminCode(data.code);
    const row = await s.getDeliveryRow(data.id);
    if (!row) throw new Error("Entrega no encontrada");
    const raw = await s.decryptPayload<ProtectedDeliveryPrivate>(String(row["detail"] ?? ""));
    const { token: _token, ...detail } = raw;
    return {
      ...detail,
      id: data.id,
      images: Array.isArray(raw.images) ? raw.images.slice(0, 2) : [],
      attachment: raw.attachment ?? null,
      imageCount: Array.isArray(raw.images) ? raw.images.length : 0,
      platformMessage: raw.platformMessage ?? "",
      passwordMessage: raw.passwordMessage ?? "",
    };
  });

export const deliveriesDelete = createServerFn({ method: "POST" })
  .validator((v: unknown) => adminSchema.extend({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data }) => {
    const s = await import("./deliveries.server");
    await s.requireAdminCode(data.code);
    await s.removeDeliveryRow(data.id);
    return { ok: true };
  });

export const deliveriesGetLinkToken = createServerFn({ method: "POST" })
  .validator((v: unknown) => adminSchema.extend({ id: z.string().uuid(), markWhatsapp: z.boolean().default(false) }).parse(v))
  .handler(async ({ data }) => {
    const s = await import("./deliveries.server");
    await s.requireAdminCode(data.code);
    const row = await s.getDeliveryRow(data.id);
    if (!row) throw new Error("Entrega no encontrada");
    const d = await s.decryptPayload<ProtectedDeliveryPrivate>(String(row["detail"] ?? ""));
    if (data.markWhatsapp) {
      const now = new Date().toISOString();
      d.history = [...d.history, { at: now, kind: "whatsapp" as const, detail: "Enlace preparado para WhatsApp" }].slice(-100);
      d.updatedAt = now;
      await s.saveDeliveryRow(data.id, d);
    }
    return { token: d.token, whatsapp: d.whatsapp, platform: d.platform, client: d.client, accessPassword: d.accessPassword ?? "", platformMessage: d.platformMessage ?? "", passwordMessage: d.passwordMessage ?? "" };
  });

export const deliveriesOpen = createServerFn({ method: "POST" })
  .validator((v: unknown) => accessSchema.parse(v))
  .handler(async ({ data }): Promise<DeliveryPublicView> => {
    const s = await import("./deliveries.server");
    const row = await s.getDeliveryRow(data.id);
    if (!row) throw new Error("Este enlace no existe o fue retirado");
    const raw = await s.decryptPayload<ProtectedDeliveryPrivate>(String(row["detail"] ?? ""));
    const d: ProtectedDeliveryPrivate = { ...raw, images: Array.isArray(raw.images) ? raw.images.slice(0, 2) : [], attachment: raw.attachment ?? null, imageCount: Array.isArray(raw.images) ? raw.images.length : 0 };
    if (d.token !== data.token) throw new Error("Enlace no válido");
    const requiredPassword = d.accessPassword ?? "";
    if (requiredPassword && data.accessPassword !== requiredPassword) throw new Error("Contraseña de acceso incorrecta");
    if (d.status === "revoked") throw new Error("Esta entrega fue revocada");
    if (d.status === "suspended") throw new Error("Esta entrega está suspendida temporalmente");
    if (expired(d)) throw new Error("Esta entrega ya venció");
    if (d.maxViews !== null && d.viewCount >= d.maxViews) throw new Error("Esta entrega alcanzó el límite de accesos");
    if (!canOpen(d)) throw new Error("Esta entrega ya no está disponible");
    const now = new Date().toISOString();
    d.viewCount += 1;
    d.lastViewedAt = now;
    d.updatedAt = now;
    d.history = [...d.history, { at: now, kind: "opened" as const, detail: `Acceso #${d.viewCount}` }].slice(-100);
    await s.saveDeliveryRow(data.id, d);
    return {
      id: d.id,
      platform: d.platform,
      client: d.client,
      username: d.username,
      password: d.password,
      link: d.link ?? "",
      panelUsername: d.panelUsername ?? "",
      panelPassword: d.panelPassword ?? "",
      notes: d.notes,
      images: Array.isArray(d.images) ? d.images.slice(0, 2) : [],
      attachment: d.attachment ?? null,
      expiresAt: d.expiresAt,
      remainingViews: d.maxViews === null ? null : Math.max(0, d.maxViews - d.viewCount),
      viewCount: d.viewCount,
    };
  });

export const deliveriesReveal = createServerFn({ method: "POST" })
  .validator((v: unknown) => accessSchema.parse(v))
  .handler(async ({ data }) => {
    const s = await import("./deliveries.server");
    const row = await s.getDeliveryRow(data.id);
    if (!row) throw new Error("Entrega no encontrada");
    const d = await s.decryptPayload<ProtectedDeliveryPrivate>(String(row["detail"] ?? ""));
    if (d.token !== data.token) throw new Error("Enlace no válido");
    const requiredPassword = d.accessPassword ?? "";
    if (requiredPassword && data.accessPassword !== requiredPassword) throw new Error("Contraseña de acceso incorrecta");
    if (d.status !== "active" || expired(d)) throw new Error("Esta entrega ya no está disponible");
    const now = new Date().toISOString();
    d.updatedAt = now;
    d.history = [...d.history, { at: now, kind: "password_viewed" as const, detail: "Contraseña visualizada" }].slice(-100);
    await s.saveDeliveryRow(data.id, d);
    return { password: d.password };
  });

export const deliveriesSaleConfig = createServerFn({ method: "POST" })
  .validator((v: unknown) => adminSchema.extend({ enabled: z.boolean().optional() }).parse(v))
  .handler(async ({ data }) => {
    const s = await import("./deliveries.server");
    await s.requireAdminCode(data.code);
    if (data.enabled !== undefined) await s.saveSaleEnabled(data.enabled);
    return { enabled: await s.loadSaleEnabled() };
  });
