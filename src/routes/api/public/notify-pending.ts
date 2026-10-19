/** Recordatorios: vuelve a avisar de los pedidos pendientes (lo llama el programador de la nube). */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/notify-pending")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supplied = request.headers.get("x-ma2-cron-secret") ?? "";
        const netlify = (globalThis as typeof globalThis & {
          Netlify?: { env?: { get?: (name: string) => string | undefined } };
        }).Netlify;
        const expected = netlify?.env?.get?.("MA2_CRON_SECRET") ?? process.env["MA2_CRON_SECRET"] ?? "";
        if (!expected || supplied !== expected) {
          return new Response("No autorizado", { status: 401 });
        }

        const { runPendingReminders } = await import("@/lib/notify/notify.server");
        return Response.json(await runPendingReminders());
      },
    },
  },
});
