import { createFileRoute } from "@tanstack/react-router";
import { matchAllowedTelegramBot } from "@/lib/cyberdocs/parser";

type Obj = Record<string, unknown>;

function objectOf(value: unknown): Obj {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {};
}

function stringOf(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function sameSecret(received: string, expected: string) {
  if (!received || !expected || received.length !== expected.length) return false;
  let different = 0;
  for (let index = 0; index < received.length; index += 1) {
    different |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return different === 0;
}

async function readJson(request: Request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > 500_000) throw new Error("Payload demasiado grande");
  const text = await request.text();
  if (text.length > 500_000) throw new Error("Payload demasiado grande");
  return JSON.parse(text) as Obj;
}

function messageFrom(update: Obj) {
  if (update["business_message"])
    return { message: objectOf(update["business_message"]), business: true };
  if (update["edited_business_message"])
    return { message: objectOf(update["edited_business_message"]), business: true };
  if (update["message"]) return { message: objectOf(update["message"]), business: false };
  if (update["edited_message"])
    return { message: objectOf(update["edited_message"]), business: false };
  return null;
}

export const Route = createFileRoute("/api/integrations/cyberdocs/telegram")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supplied = request.headers.get("x-telegram-bot-api-secret-token") || "";
        const expected = process.env["TELEGRAM_WEBHOOK_SECRET"] || "";
        if (!sameSecret(supplied, expected)) {
          return Response.json({ error: "No autorizado" }, { status: 401 });
        }

        let update: Obj;
        try {
          update = await readJson(request);
        } catch {
          return Response.json({ error: "JSON inválido" }, { status: 400 });
        }

        const extracted = messageFrom(update);
        if (!extracted) {
          // Telegram también envía business_connection; no contiene un pedido.
          return Response.json({ ok: true, ignored: true });
        }
        const message = extracted.message;
        const from = objectOf(message["from"]);
        const chat = objectOf(message["chat"]);
        const senderBusinessBot = objectOf(message["sender_business_bot"]);
        const viaBot = objectOf(message["via_bot"]);
        const usernames = [
          stringOf(from["username"]),
          stringOf(chat["username"]),
          stringOf(senderBusinessBot["username"]),
          stringOf(viaBot["username"]),
        ];
        const server = await import("@/lib/cyberdocs/cyberdocs.server");
        const matchedBot = matchAllowedTelegramBot(usernames, await server.getAllowedTelegramBots());
        if (!matchedBot) {
          // Defensa adicional: no se conserva contenido de otros chats.
          return Response.json({ ok: true, ignored: true, reason: "Remitente no permitido" });
        }
        const rawMessage = stringOf(message["text"]) || stringOf(message["caption"]);
        const updateId = stringOf(update["update_id"]);
        const messageId = stringOf(message["message_id"]);
        const eventKey = `telegram:${updateId || `${stringOf(chat["id"]) || "chat"}:${messageId || crypto.randomUUID()}`}`;

        try {
          const result = await server.ingestCyberDocsOrder({
            source: extracted.business ? "telegram_business" : "telegram_message",
            eventKey,
            telegramUpdateId: updateId,
            sourceMessageId: messageId,
            sourceChatId: stringOf(chat["id"]),
            businessConnectionId: stringOf(message["business_connection_id"]),
            senderUsername: usernames.find(Boolean) || "",
            sourceKey: matchedBot.username,
            sourceLabel: matchedBot.label,
            rawMessage,
            rawPayload: update,
          });
          return Response.json(result);
        } catch (error) {
          console.error("CyberDocs webhook falló:", error);
          return Response.json({ error: "No se pudo respaldar el pedido" }, { status: 500 });
        }
      },
    },
  },
});
