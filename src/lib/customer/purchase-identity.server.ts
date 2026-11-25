import { createHash } from "node:crypto";

/** Domain-separated IDs for idempotent purchase-related records. */
export function purchaseRecordId(kind: "notice" | "document" | "renewal" | "public-order", purchaseId: string, expiry = "") {
  const hash = createHash("sha256").update(`ma2-purchase:${kind}:${purchaseId}:${expiry}`).digest("hex").slice(0,32);
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20)}`;
}
