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
export function readCart(): CartLine[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as CartLine[];
  } catch {
    return [];
  }
}
export function writeCart(lines: CartLine[]) {
  localStorage.setItem(KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event("ma2-cart-change"));
}
export function addToCart(service: Service, catalogId?: string) {
  const lines = readCart().filter(
    (line) => !catalogId || !line.catalogId || line.catalogId === catalogId,
  );
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
  writeCart(lines);
}
export function clearCart() {
  writeCart([]);
}
