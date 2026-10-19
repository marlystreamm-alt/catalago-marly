import { createServerFn } from "@tanstack/react-start";

export type SystemHealth = {
  server: boolean;
  supabase: boolean;
  checkedAt: string;
  detail?: string;
};

export const systemHealth = createServerFn({ method: "GET" }).handler(async (): Promise<SystemHealth> => {
  const checkedAt = new Date().toISOString();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("notification_log").select("id", { head: true, count: "exact" }).limit(1);
    if (error) return { server: true, supabase: false, checkedAt, detail: error.message };
    return { server: true, supabase: true, checkedAt };
  } catch (error) {
    return {
      server: true,
      supabase: false,
      checkedAt,
      detail: error instanceof Error ? error.message : "No se pudo comprobar Supabase",
    };
  }
});
