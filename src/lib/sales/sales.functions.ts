import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { DemoAccess, SaleRequest, SalesConfig } from "./types";

const adminCode = z.object({ code: z.string().min(4) });
const CONFIG_CHANNEL = "ma2_config";
const SALE_CHANNEL = "ma2_sale";
const DEMO_CHANNEL = "ma2_demo";
const DEFAULT: SalesConfig = {
  enabled: false,
  demoMinutes: 20,
  paymentInstructions: "",
  plans: [
    { id: "basico", name: "Básico", monthly: 39, description: "Funciones esenciales para empezar" },
    { id: "negocio", name: "Negocio", monthly: 69, description: "La opción recomendada para administrar y vender" },
    { id: "pro", name: "Pro", monthly: 99, description: "Más herramientas para negocios con mayor movimiento" },
  ],
  updatedAt: new Date(0).toISOString(),
};

async function db() { const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); return supabaseAdmin; }
async function gate(code: string) { const { requireAdminCode } = await import("@/lib/notify/notify.server"); await requireAdminCode(code); }
async function cryptoLib() { return import("@/lib/deliveries/deliveries.server"); }

async function loadConfig(): Promise<SalesConfig> {
  const d = await db();
  const { data, error } = await d.from("notification_log").select("detail").eq("channel", CONFIG_CHANNEL).eq("kind", "sales_config").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT;
  try { return { ...DEFAULT, ...(await (await cryptoLib()).decryptPayload<SalesConfig>(String(data.detail ?? ""))) }; } catch { return DEFAULT; }
}

export const salesGetConfigAdmin = createServerFn({ method: "POST" })
  .validator((v: unknown) => adminCode.parse(v)).handler(async ({ data }) => { await gate(data.code); return loadConfig(); });

export const salesSaveConfig = createServerFn({ method: "POST" })
  .validator((v: unknown) => adminCode.extend({ config: z.object({
    enabled: z.boolean(), demoMinutes: z.union([z.literal(20), z.literal(30), z.literal(60)]), paymentInstructions: z.string().max(1500),
    plans: z.array(z.object({ id: z.string().min(1).max(30), name: z.string().min(1).max(60), monthly: z.number().min(0).max(100000), description: z.string().max(300) })).min(1).max(6),
  }) }).parse(v)).handler(async ({ data }) => {
    await gate(data.code); const d = await db(); const c = { ...data.config, updatedAt: new Date().toISOString() } satisfies SalesConfig;
    const detail = await (await cryptoLib()).encryptPayload(c);
    const { error } = await d.from("notification_log").insert({ channel: CONFIG_CHANNEL, kind: "sales_config", attempt: 1, status: c.enabled ? "active" : "disabled", detail });
    if (error) throw new Error(error.message); return c;
  });

export const salesGetPublicConfig = createServerFn({ method: "GET" }).handler(async () => {
  const c = await loadConfig();
  return { enabled: c.enabled, plans: c.enabled ? c.plans : [], paymentInstructions: c.enabled ? c.paymentInstructions : "" };
});

function ref() { const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000; return `MA2-${String(n).padStart(6, "0")}`; }

export const salesCreateRequest = createServerFn({ method: "POST" }).validator((v: unknown) => z.object({
  customerName: z.string().min(2).max(100), whatsapp: z.string().min(7).max(30), businessName: z.string().min(2).max(120), planId: z.string().min(1), receiptDataUrl: z.string().max(2_000_000).default(""),
}).parse(v)).handler(async ({ data }) => {
  const c = await loadConfig(); if (!c.enabled) throw new Error("Las contrataciones todavía no están habilitadas");
  const plan = c.plans.find((p) => p.id === data.planId); if (!plan) throw new Error("Plan no disponible");
  const d = await db(); const now = new Date().toISOString();
  const draft: SaleRequest = { id: crypto.randomUUID(), createdAt: now, reference: ref(), customerName: data.customerName.trim(), whatsapp: data.whatsapp.trim(), businessName: data.businessName.trim(), planId: plan.id, planName: plan.name, amount: plan.monthly, status: "pending", receiptDataUrl: data.receiptDataUrl, notes: "" };
  const detail = await (await cryptoLib()).encryptPayload(draft);
  const { data: row, error } = await d.from("notification_log").insert({ channel: SALE_CHANNEL, kind: "request", attempt: 1, status: "pending", detail }).select("id,created_at").single();
  if (error) throw new Error(error.message); draft.id = String(row.id); draft.createdAt = String(row.created_at);
  const fixed = await (await cryptoLib()).encryptPayload(draft); await d.from("notification_log").update({ detail: fixed }).eq("id", draft.id);
  return { request: draft, paymentInstructions: c.paymentInstructions };
});

export const salesListRequests = createServerFn({ method: "POST" }).validator((v: unknown) => adminCode.parse(v)).handler(async ({ data }): Promise<SaleRequest[]> => {
  await gate(data.code); const d = await db(); const { data: rows, error } = await d.from("notification_log").select("*").eq("channel", SALE_CHANNEL).order("created_at", { ascending: false }).limit(250); if (error) throw new Error(error.message);
  const out: SaleRequest[] = []; const c = await cryptoLib(); for (const r of rows ?? []) { try { out.push(await c.decryptPayload(String((r as Record<string, unknown>)["detail"] ?? "")) as SaleRequest); } catch {} } return out;
});

export const salesSetStatus = createServerFn({ method: "POST" }).validator((v: unknown) => adminCode.extend({ id: z.string().uuid(), status: z.enum(["pending","paid","active","suspended","cancelled"]) }).parse(v)).handler(async ({ data }) => {
  await gate(data.code); const d = await db(); const { data: row } = await d.from("notification_log").select("detail").eq("id", data.id).eq("channel", SALE_CHANNEL).maybeSingle(); if (!row) throw new Error("Solicitud no encontrada");
  const c = await cryptoLib(); const item = await c.decryptPayload(String(row.detail ?? "")) as SaleRequest; item.status = data.status; const detail = await c.encryptPayload(item); const { error } = await d.from("notification_log").update({ detail, status: data.status }).eq("id", data.id); if (error) throw new Error(error.message); return item;
});

export const salesCreateDemo = createServerFn({ method: "POST" }).validator((v: unknown) => adminCode.extend({ minutes: z.union([z.literal(20),z.literal(30),z.literal(60)]), label: z.string().max(100).default("") }).parse(v)).handler(async ({ data }) => {
  await gate(data.code); const d = await db(); const now = new Date(); const token = (await cryptoLib()).randomToken(); const draft: DemoAccess = { id: crypto.randomUUID(), token, createdAt: now.toISOString(), expiresAt: new Date(now.getTime()+data.minutes*60_000).toISOString(), minutes: data.minutes, label: data.label.trim() };
  const c = await cryptoLib(); const detail = await c.encryptPayload(draft); const { data: row, error } = await d.from("notification_log").insert({ channel: DEMO_CHANNEL, kind: "demo", attempt: 0, status: "active", detail }).select("id,created_at").single(); if (error) throw new Error(error.message); draft.id = String(row.id); draft.createdAt = String(row.created_at); await d.from("notification_log").update({ detail: await c.encryptPayload(draft) }).eq("id", draft.id); return draft;
});

export const salesValidateDemo = createServerFn({ method: "POST" }).validator((v: unknown) => z.object({ id: z.string().uuid(), token: z.string().min(20) }).parse(v)).handler(async ({ data }) => {
  const d = await db(); const { data: row } = await d.from("notification_log").select("detail,status").eq("id", data.id).eq("channel", DEMO_CHANNEL).maybeSingle(); if (!row) throw new Error("Demo no disponible"); const c = await cryptoLib(); const demo = await c.decryptPayload(String(row.detail ?? "")) as DemoAccess;
  if (demo.token !== data.token) throw new Error("Enlace de demo no válido"); if (String(row.status) !== "active" || new Date(demo.expiresAt).getTime() <= Date.now()) throw new Error("La demostración ya terminó"); return { expiresAt: demo.expiresAt, label: demo.label };
});
