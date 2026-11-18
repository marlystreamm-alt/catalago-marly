import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
export const customerSalt = () => randomBytes(16).toString("hex");
export async function customerHash(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, key) =>
      e ? reject(e) : resolve(key.toString("hex")),
    ),
  );
}
export async function customerMatches(password: string, salt: string, hash: string) {
  const actual = await customerHash(password, salt),
    expected = /^[a-f0-9]{64}$/.test(hash) ? hash : "0".repeat(64);
  return (
    timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex")) && hash === expected
  );
}
