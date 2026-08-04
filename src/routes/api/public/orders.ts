/** Registro público de pedidos: el cliente avisa que hizo un pedido por WhatsApp. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  catalogId: z.string().max(80).default(""),
  catalogName: z.string().max(120).default(""),
  serviceName: z.string().max(200).default("Servicio"),
  total: z.number().finite().min(0).max(1_000_000).default(0),
  items: z
    .array(z.object({ name: z.string().max(200), price: z.number().finite().min(0).max(1_000_000) }))
    .max(40)
    .default([]),
  message: z.string().max(4000).default(""),
  link: z.string().max(2000).default(""),
  recipient: z.string().max(40).default(""),
});

export const Route = createFileRoute("/api/public/orders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: "JSON inválido" }, { status: 400 });
        }
        const parsed = bodySchema.safeParse(payload);
        if (!parsed.success) {
          return Response.json({ error: "Datos inválidos" }, { status: 400 });
        }
        const order = parsed.data;

        const { loadSettings, admin, rowToOrder, notifyOrder, withinSchedule } = await import(
          "@/lib/notify/notify.server"
        );
        const settings = await loadSettings();
        if (!settings.enabled) return Response.json({ skipped: true });

        const db = await admin();
        const { data, error } = await db
          .from("orders")
          .insert({
            catalog_id: order.catalogId,
            catalog_name: order.catalogName,
            service_name: order.serviceName,
            total: order.total,
            items: order.items,
            message: order.message,
            link: order.link,
            recipient: order.recipient,
          })
          .select("*")
          .single();
        if (error || !data) {
          console.error("No se pudo registrar el pedido:", error);
          return Response.json({ error: "No se pudo registrar" }, { status: 500 });
        }

        const cloudOrder = rowToOrder(data as Record<string, unknown>);
        if (withinSchedule(settings)) {
          try {
            await notifyOrder(cloudOrder, settings, false);
          } catch (e) {
            console.error("Aviso falló:", e);
          }
        }
        return Response.json({ ok: true, id: cloudOrder.id });
      },
    },
  },
});
