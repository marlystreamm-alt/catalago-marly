import type { InstructionMethod } from "./types";

type Row = Record<string, unknown>;
const CHANNEL = "instruction_method";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function requireAdminCode(code: string) {
  const { requireAdminCode } = await import("@/lib/notify/notify.server");
  await requireAdminCode(code);
}

function parse(row: Row): InstructionMethod | null {
  try {
    const data = JSON.parse(String(row["detail"] ?? "{}")) as Partial<InstructionMethod>;
    if (!data.name) return null;
    return {
      id: String(row["id"]),
      name: String(data.name ?? ""),
      instruction: String(data.instruction ?? ""),
      notes: String(data.notes ?? ""),
      link: String(data.link ?? ""),
      image: String(data.image ?? ""),
      active: data.active !== false,
      sortOrder: Number(data.sortOrder ?? 0),
      createdAt: String(data.createdAt ?? row["created_at"] ?? new Date().toISOString()),
      updatedAt: String(data.updatedAt ?? data.createdAt ?? row["created_at"] ?? new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

export async function listMethods() {
  const db = await admin();
  const { data, error } = await db
    .from("notification_log")
    .select("id,detail,created_at")
    .eq("channel", CHANNEL)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[])
    .map(parse)
    .filter((x): x is InstructionMethod => Boolean(x))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es"));
}

export async function insertMethod(method: Omit<InstructionMethod, "id">) {
  const db = await admin();
  const { data, error } = await db
    .from("notification_log")
    .insert({ channel: CHANNEL, kind: "method", attempt: method.sortOrder, status: method.active ? "active" : "hidden", detail: JSON.stringify(method) })
    .select("id,created_at")
    .single();
  if (error) throw new Error(error.message);
  return { ...method, id: String(data.id), createdAt: String(data.created_at) } as InstructionMethod;
}

export async function updateMethod(id: string, method: Omit<InstructionMethod, "id">) {
  const db = await admin();
  const { error } = await db
    .from("notification_log")
    .update({ attempt: method.sortOrder, status: method.active ? "active" : "hidden", detail: JSON.stringify(method) })
    .eq("id", id)
    .eq("channel", CHANNEL);
  if (error) throw new Error(error.message);
  return { ...method, id } as InstructionMethod;
}

export async function deleteMethod(id: string) {
  const db = await admin();
  const { error } = await db.from("notification_log").delete().eq("id", id).eq("channel", CHANNEL);
  if (error) throw new Error(error.message);
}
