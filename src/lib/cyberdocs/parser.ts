import type { ParsedCyberDocsOrder, TelegramOrderBot } from "./types";

const MAX_MESSAGE_LENGTH = 20_000;

function clean(value: string) {
  return Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || code >= 32;
    })
    .join("")
    .trim();
}

function lineValue(text: string, labels: string[]) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(
      `(?:^|\\n)\\s*(?:[^\\p{L}\\p{N}\\n]{0,4})?${escaped}\\s*:\\s*([^\\n]+)`,
      "imu",
    ).exec(text);
    if (match?.[1]) return clean(match[1]);
  }
  return "";
}

export function normalizeTelegramUsername(value: string | null | undefined) {
  return (value || "").trim().replace(/^@/, "").toLowerCase();
}

/** Analiza únicamente el formato de pedidos que CyberDocs envía a proveedores. */
export function parseCyberDocsMessage(raw: string): ParsedCyberDocsOrder {
  const text = clean(String(raw || "").slice(0, MAX_MESSAGE_LENGTH)).replace(/\r\n?/g, "\n");
  const isOrder = /nuevo\s+pedido\s+asignado/i.test(text);
  const rawId = lineValue(text, ["ID", "Id", "id"]);
  const uuid =
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.exec(
      rawId,
    )?.[0] ?? "";
  const orderId = uuid || rawId.replace(/[^a-z0-9-]/gi, "").slice(0, 160);
  const clientName = lineValue(text, ["Cliente"]);
  const serviceName = lineValue(text, ["Servicio"]);
  const whatsapp = lineValue(text, [
    "Número para contactar whatsapp",
    "Número para contactar WhatsApp",
    "WhatsApp",
  ]);
  const email = lineValue(text, ["Correo solicitante", "Correo"]);
  const contactLabel = whatsapp ? "WhatsApp" : email ? "Correo" : "";
  const contactValue = whatsapp || email;

  const fields: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const match = /^\s*(?:[^\p{L}\p{N}\n]{0,4})?([^:\n]{2,80})\s*:\s*(.+?)\s*$/u.exec(line);
    if (!match?.[1] || !match[2]) continue;
    const key = clean(match[1]).toLowerCase().replace(/\s+/g, "_").slice(0, 80);
    if (key && !["número_de_seguro_social", "numero_de_seguro_social"].includes(key)) {
      fields[key] = clean(match[2]).slice(0, 1000);
    }
  }

  return { isOrder, orderId, clientName, serviceName, contactLabel, contactValue, fields };
}

export function isExpectedCyberDocsSender(
  usernames: Array<string | null | undefined>,
  expected = process.env["CYBERDOCS_BOT_USERNAME"] || "cyberdocsmx_bot",
) {
  const wanted = normalizeTelegramUsername(expected);
  return usernames.some((value) => normalizeTelegramUsername(value) === wanted);
}

export function matchAllowedTelegramBot(
  usernames: Array<string | null | undefined>,
  bots: TelegramOrderBot[],
) {
  const received = new Set(usernames.map(normalizeTelegramUsername).filter(Boolean));
  return bots.find((bot) => received.has(normalizeTelegramUsername(bot.username))) || null;
}
