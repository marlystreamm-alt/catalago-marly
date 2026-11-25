import type { Service } from "./types";

export type CartLine = {
  id: string;
  catalogId?: string;
  name: string;
  price: number;
  priceText?: string;
  qty: number;
};
const KEY = "ma2-cart-v1";
function storedLines(): CartLine[] {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(data) ? data.filter(line => line && typeof line.id === "string") : [];
  } catch {
    return [];
  }
}
// Older carts were created in the original customer catalog.
const catalogOf = (line: CartLine) => line.catalogId || "clientes";

export function readCart(catalogId = "clientes"): CartLine[] {
  return storedLines().filter(line => catalogOf(line) === catalogId);
}
export function writeCart(lines: CartLine[], catalogId = "clientes") {
  const otherCarts = storedLines().filter(line => catalogOf(line) !== catalogId);
  localStorage.setItem(KEY, JSON.stringify([...otherCarts, ...lines.map(line => ({ ...line, catalogId }))]));
  window.dispatchEvent(new Event("ma2-cart-change"));
}
export function addToCart(service: Service, catalogId = "clientes") {
  if (service.onRequest) return;
  const lines = readCart(catalogId);
  const i = lines.findIndex((x) => x.id === service.id);
  if (i >= 0)
    lines[i] = { ...lines[i], catalogId: catalogId || lines[i].catalogId, qty: lines[i].qty + 1 };
  else
    lines.push({
      id: service.id,
      catalogId,
      name: service.name,
      price: service.price,
      priceText: service.priceText,
      qty: 1,
    });
  writeCart(lines, catalogId);
}
export function clearCart(catalogId = "clientes") {
  writeCart([], catalogId);
}
