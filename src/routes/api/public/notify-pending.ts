/** Recordatorios: vuelve a avisar de los pedidos pendientes (lo llama el programador de la nube). */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/notify-pending")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
        if (!expected || apikey !== expected) {
          return new Response("No autorizado", { status: 401 });
        }

        const { loadSettings, admin, rowToOrder, notifyOrder, withinSchedule } = await import(
          "@/lib/notify/notify.server"
        );
        const settings = await loadSettings();
        if (!settings.enabled || !settings.repeatEnabled || !withinSchedule(settings)) {
          return Response.json({ skipped: true });
        }

        const cutoff = new Date(Date.now() - settings.repeatMinutes * 60_000).toISOString();
        const db = await admin();
        const { data, error } = await db
          .from("orders")
          .select("*")
          .eq("status", "nuevo")
          .or(`notified_at.is.null,notified_at.lt.${cutoff}`)
          .order("created_at", { ascending: true })
          .limit(20);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        let sent = 0;
        for (const row of data ?? []) {
          try {
            await notifyOrder(rowToOrder(row as Record<string, unknown>), settings, true);
            sent += 1;
          } catch (e) {
            console.error("Recordatorio falló:", e);
          }
        }
        return Response.json({ ok: true, sent });
      },
    },
  },
});
