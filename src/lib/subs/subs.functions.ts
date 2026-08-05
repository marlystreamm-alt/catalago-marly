/** Funciones de servidor de las suscripciones de menús (protegidas con el código del administrador). */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { RenewalEntry, SubStatus, Subscription } from "./types";

const codeSchema = z.object({ code: z.string().min(4) });

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

const subSchema = codeSchema.extend({
  id: z.string().uuid().optional(),
  businessName: z.string().trim().min(2).max(80),
  ownerName: z.string().trim().max(80).default(""),
  whatsapp: z.string().trim().max(20).default(""),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "El enlace solo admite letras, números y guiones"),
  catalogId: z.string().trim().max(60).default("clientes"),
  plan: z.string().trim().max(40).default("mensual"),
  price: z.number().min(0).max(100000).default(0),
  startedOn: dateSchema,
  expiresOn: dateSchema,
  notes: z.string().trim().max(600).default(""),
});

/** Lista todos los negocios con su estado calculado. */
export const subsList = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => codeSchema.parse(d))
  .handler(async ({ data }): Promise<Subscription[]> => {
    const { requireAdminCode } = await import("@/lib/notify/notify.server");
    const { listSubs } = await import("./subs.server");
    await requireAdminCode(data.code);
    return listSubs();
  });

/** Crea o actualiza un negocio. */
export const subsSave = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => subSchema.parse(d))
  .handler(async ({ data }): Promise<Subscription> => {
    const { requireAdminCode } = await import("@/lib/notify/notify.server");
    const { admin, rowToSub, addRenewal } = await import("./subs.server");
    await requireAdminCode(data.code);
    const db = await admin();
    const values = {
      business_name: data.businessName,
      owner_name: data.ownerName,
      whatsapp: data.whatsapp,
      slug: data.slug,
      catalog_id: data.catalogId,
      plan: data.plan,
      price: data.price,
      started_on: data.startedOn,
      expires_on: data.expiresOn,
      notes: data.notes,
    };
    const query = data.id
      ? db.from("menu_subscriptions").update(values).eq("id", data.id)
      : db.from("menu_subscriptions").insert(values);
    const { data: row, error } = await query.select("*").single();
    if (error || !row) throw new Error(error?.message ?? "No se pudo guardar");
    if (!data.id) {
      await addRenewal({
        subscriptionId: String(row["id"]),
        kind: "alta",
        previousExpires: null,
        newExpires: data.expiresOn,
        note: "Alta del negocio",
      });
    }
    return rowToSub(row);
  });

/** Activa o suspende manualmente un negocio. */
export const subsSetSuspended = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    codeSchema.extend({ id: z.string().uuid(), suspended: z.boolean() }).parse(d),
  )
  .handler(async ({ data }): Promise<Subscription> => {
    const { requireAdminCode } = await import("@/lib/notify/notify.server");
    const { admin, rowToSub, addRenewal } = await import("./subs.server");
    const { todayISO, nextExpiry } = await import("./types");
    await requireAdminCode(data.code);
    const db = await admin();
    const { data: current } = await db
      .from("menu_subscriptions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!current) throw new Error("No se encontró el negocio");
    const today = todayISO();
    const expires = String(current["expires_on"] ?? today);
    // Al reactivar un negocio vencido se le da un mes desde hoy para que el menú abra.
    const nextExpires =
      !data.suspended && Date.parse(`${expires}T00:00:00Z`) < Date.parse(`${today}T00:00:00Z`)
        ? nextExpiry(expires, 1, today)
        : expires;
    const { data: row, error } = await db
      .from("menu_subscriptions")
      .update({ suspended: data.suspended, expires_on: nextExpires })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error || !row) throw new Error(error?.message ?? "No se pudo actualizar");
    await addRenewal({
      subscriptionId: data.id,
      kind: data.suspended ? "suspension" : "activacion",
      previousExpires: expires,
      newExpires: nextExpires,
      note: data.suspended ? "Menú suspendido" : "Menú activado",
    });
    return rowToSub(row);
  });

/** Renueva 1 mes o 1 año desde el vencimiento vigente (o desde hoy si ya venció). */
export const subsRenew = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    codeSchema.extend({ id: z.string().uuid(), months: z.union([z.literal(1), z.literal(12)]) }).parse(d),
  )
  .handler(async ({ data }): Promise<Subscription> => {
    const { requireAdminCode } = await import("@/lib/notify/notify.server");
    const { admin, rowToSub, addRenewal } = await import("./subs.server");
    const { nextExpiry, todayISO } = await import("./types");
    await requireAdminCode(data.code);
    const db = await admin();
    const { data: current } = await db
      .from("menu_subscriptions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!current) throw new Error("No se encontró el negocio");
    const today = todayISO();
    const previous = String(current["expires_on"] ?? today);
    const newExpires = nextExpiry(previous, data.months, today);
    const { data: row, error } = await db
      .from("menu_subscriptions")
      .update({ expires_on: newExpires, suspended: false })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error || !row) throw new Error(error?.message ?? "No se pudo renovar");
    await addRenewal({
      subscriptionId: data.id,
      kind: data.months === 12 ? "año" : "mes",
      previousExpires: previous,
      newExpires,
      note: data.months === 12 ? "Renovación de 1 año" : "Renovación de 1 mes",
    });
    return rowToSub(row);
  });

/** Historial de renovaciones de un negocio. */
export const subsHistory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => codeSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<RenewalEntry[]> => {
    const { requireAdminCode } = await import("@/lib/notify/notify.server");
    const { admin } = await import("./subs.server");
    await requireAdminCode(data.code);
    const db = await admin();
    const { data: rows, error } = await db
      .from("subscription_renewals")
      .select("*")
      .eq("subscription_id", data.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((row) => ({
      id: String(row["id"]),
      createdAt: String(row["created_at"] ?? ""),
      kind: String(row["kind"] ?? ""),
      previousExpires: (row["previous_expires"] as string) ?? null,
      newExpires: (row["new_expires"] as string) ?? null,
      note: String(row["note"] ?? ""),
    }));
  });

/** Elimina un negocio (no toca los catálogos). */
export const subsDelete = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => codeSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdminCode } = await import("@/lib/notify/notify.server");
    const { admin } = await import("./subs.server");
    await requireAdminCode(data.code);
    const db = await admin();
    const { error } = await db.from("menu_subscriptions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface PublicMenuState {
  found: boolean;
  businessName: string;
  status: SubStatus | "";
  catalogId: string;
}

/** Estado público de un menú: solo lo necesario para abrirlo o mostrar el aviso. */
export const subsPublicState = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().trim().max(60) }).parse(d))
  .handler(async ({ data }): Promise<PublicMenuState> => {
    const { getSubBySlug } = await import("./subs.server");
    const sub = await getSubBySlug(data.slug).catch(() => null);
    if (!sub) return { found: false, businessName: "", status: "", catalogId: "" };
    return {
      found: true,
      businessName: sub.businessName,
      status: sub.status,
      catalogId: sub.catalogId,
    };
  });
