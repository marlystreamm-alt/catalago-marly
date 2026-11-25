/** Group interchangeable inventory units without mixing prices, variants or validity. */
export function groupProducts<T extends { id: string; name: string; type: string; kind: string; priceCents: number; months: number; expiresOn: string | null }>(products: T[]) {
  const groups = new Map<string, { product: T; count: number }>();
  for (const product of products) {
    const key = JSON.stringify([product.name.trim().normalize("NFKC").toLowerCase(), product.type, product.kind, product.priceCents, product.months, product.expiresOn]);
    const group = groups.get(key);
    if (group) group.count++;
    else groups.set(key, { product, count: 1 });
  }
  return Array.from(groups.values());
}
