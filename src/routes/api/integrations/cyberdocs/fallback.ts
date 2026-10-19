import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  message: z.string().min(20).max(20_000),
  sourceId: z.string().max(200).optional(),
  senderUsername: z.string().max(120).optional(),
});

function sameSecret(received: string, expected: string) {
  if (!received || !expected || received.length !== expected.length) return false;
  let different = 0;
  for (let index = 0; index < received.length; index += 1) {
    different |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return different === 0;
}

export const Route = createFileRoute("/api/integrations/cyberdocs/fallback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supplied = request.headers.get("x-ma2-fallback-secret") || "";
        const expected = process.env["CYBERDOCS_FALLBACK_SECRET"] || "";
        if (!sameSecret(supplied, expected)) {
          return Response.json({ error: "No autorizado" }, { status: 401 });
        }
        const declared = Number(request.headers.get("content-length") || 0);
        if (declared > 100_000)
          return Response.json({ error: "Payload demasiado grande" }, { status: 413 });
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "JSON inválido" }, { status: 400 });
        }
        const parsed = payloadSchema.safeParse(body);
        if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
        const sourceId = parsed.data.sourceId || crypto.randomUUID();
        try {
          const server = await import("@/lib/cyberdocs/cyberdocs.server");
          const result = await server.ingestCyberDocsOrder({
            source: "webhook_fallback",
            eventKey: `fallback:${sourceId}`,
            senderUsername: parsed.data.senderUsername || "authenticated_fallback",
            rawMessage: parsed.data.message,
            rawPayload: { ...parsed.data, receivedAt: new Date().toISOString() },
          });
          return Response.json(result);
        } catch (error) {
          console.error("CyberDocs fallback falló:", error);
          return Response.json({ error: "No se pudo respaldar el pedido" }, { status: 500 });
        }
      },
    },
  },
});
