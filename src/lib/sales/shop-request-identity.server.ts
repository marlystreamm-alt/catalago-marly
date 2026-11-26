import { createHash } from "node:crypto";

export function normalizeShopWhatsApp(value: string) {
  const digits = value.replace(/[^0-9]/g, "");
  if (/^521[0-9]{10}$/.test(digits)) return digits.slice(3);
  if (/^52[0-9]{10}$/.test(digits)) return digits.slice(2);
  return digits;
}

export function shopRequestId(businessName: string, whatsapp: string) {
  const name = businessName
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
  const key = JSON.stringify([name, normalizeShopWhatsApp(whatsapp)]);
  const hash = createHash("sha256").update("ma2-shop-request:").update(key).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
