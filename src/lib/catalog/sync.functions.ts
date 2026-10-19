import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AppState } from "./types";

/** Supabase is the shared source of truth for the main MA² catalogs. */
export const catalogSyncLoad = createServerFn({ method: "GET" }).handler(async (): Promise<{ state: AppState | null; updatedAt: string | null }> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data, error } = await db.from("catalog_app_state").select("state,updated_at").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  return { state: (data?.state as AppState | undefined) ?? null, updatedAt: data?.updated_at ?? null };
});

export const catalogSyncSave = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ code: z.string().min(4), state: z.any() }).parse(value))
  .handler(async ({ data }): Promise<{ ok: true; updatedAt: string }> => {
    const { requireAdminCode } = await import("@/lib/notify/notify.server");
    await requireAdminCode(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const updatedAt = new Date().toISOString();
    const { error } = await db.from("catalog_app_state").upsert({ id: 1, state: data.state, updated_at: updatedAt }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true, updatedAt };
  });
