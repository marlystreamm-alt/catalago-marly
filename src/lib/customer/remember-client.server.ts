import { phoneNumber } from "@/lib/workspace/model";

export function normalizedClientPhone(value: string) {
  if (!/^\+?[\d\s()-]{10,25}$/.test(value.trim())) return "";
  const phone = phoneNumber(value.trim().replace(/^00/, "+"));
  return /^\d{11,15}$/.test(phone) ? phone : "";
}

/** Use a stable, private identifier to prevent concurrent orders creating the same contact. */
export async function rememberOrderClient(name: string, whatsapp: string, email?: string) {
  const phone = normalizedClientPhone(whatsapp);
  if (!phone || !name.trim()) return null;
  const ops = await import("@/lib/workspace/operations.server");
  const clients = await ops.readRecords("clients");
  const existing = clients.find(c => (!c.data.shopId || c.data.shopId === "main") && normalizedClientPhone(c.data.whatsapp || "") === phone);
  if (existing) return existing.id;
  const secret = process.env.MA2_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("No se pudo guardar el contacto");
  const { createHmac } = await import("node:crypto");
  const hash = createHmac("sha256", secret).update(`ma2-order-client:${phone}`).digest("hex").slice(0, 32);
  const id = `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20)}`;
  const { encryptPayload } = await import("@/lib/deliveries/deliveries.server");
  const { error } = await ops.opsDB().from("ma2_ops_records").upsert({ id, module: "clients", title: name.trim().slice(0, 160), status: "active", payload_cipher: await encryptPayload({ whatsapp: phone, ...(email?{email:email.trim().toLowerCase()}:{}),shopId: "main", notes: "Cliente registrado desde pedidos" }) }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error("No se pudo guardar el contacto");
  return id;
}
