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

        const { loadSettings, admin, rowToOrder, notifyOrder, withinSchedule, escalateOrder } =
          await import("@/lib/notify/notify.server");
        const settings = await loadSettings();
        if (!settings.enabled || !withinSchedule(settings)) {
          return Response.json({ skipped: true });
        }

        const db = await admin();
        let sent = 0;
        let escalated = 0;

        if (settings.repeatEnabled) {
          const cutoff = new Date(Date.now() - settings.repeatMinutes * 60_000).toISOString();
          const { data, error } = await db
            .from("orders")
            .select("*")
            .eq("status", "nuevo")
            .or(`notified_at.is.null,notified_at.lt.${cutoff}`)
            .order("created_at", { ascending: true })
            .limit(20);
          if (error) return Response.json({ error: error.message }, { status: 500 });
          for (const row of data ?? []) {
            try {
              await notifyOrder(rowToOrder(row as Record<string, unknown>), settings, true);
              sent += 1;
            } catch (e) {
              console.error("Recordatorio falló:", e);
            }
          }
        }

        // Escalamiento: pedidos sin atender después de X minutos, por el canal alterno.
        if (settings.escalateEnabled) {
          const limit = new Date(Date.now() - settings.escalateMinutes * 60_000).toISOString();
          const { data } = await db
            .from("orders")
            .select("*")
            .eq("status", "nuevo")
            .is("escalated_at", null)
            .lt("created_at", limit)
            .order("created_at", { ascending: true })
            .limit(20);
          for (const row of data ?? []) {
            try {
              await escalateOrder(rowToOrder(row as Record<string, unknown>), settings);
              escalated += 1;
            } catch (e) {
              console.error("Escalamiento falló:", e);
            }
          }
        }

        return Response.json({ ok: true, sent, escalated });
      },
    },
  },
});
