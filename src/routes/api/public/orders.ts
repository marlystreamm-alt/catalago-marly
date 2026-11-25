/** Registro público de pedidos: el cliente avisa que hizo un pedido por WhatsApp. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  requestId: z.string().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/).optional(),
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
        const db = await admin();
        const { requestId, ...details } = order;
        const id = requestId ? (await import("@/lib/customer/purchase-identity.server")).purchaseRecordId("public-order", requestId, JSON.stringify(details)) : undefined;
        const row = {
            ...(id ? { id } : {}),
            catalog_id: order.catalogId,
            catalog_name: order.catalogName,
            service_name: order.serviceName,
            total: order.total,
            items: order.items,
            message: order.message,
            link: order.link,
            recipient: order.recipient,
          };
        const query = id ? db.from("orders").upsert(row, { onConflict: "id", ignoreDuplicates: true }) : db.from("orders").insert(row);
        const { data, error } = await query
          .select("*")
          .maybeSingle();
        if (!error && !data && id) return Response.json({ ok: true, id, duplicate: true });
        if (error || !data) {
          console.error("No se pudo registrar el pedido:", error);
          return Response.json({ error: "No se pudo registrar" }, { status: 500 });
        }

        const cloudOrder = rowToOrder(data as Record<string, unknown>);
        if (settings.enabled && withinSchedule(settings)) {
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
