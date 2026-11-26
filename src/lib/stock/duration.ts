/** Calendar months, clamped to the target month's last day (Jan 31 -> Feb 28/29). */
export function expiresAfterMonths(start: string, months: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isInteger(months) || months < 1 || months > 36)
    throw new Error("Vigencia inválida");
  const source = new Date(start + "T12:00:00Z");
  if (Number.isNaN(source.getTime()) || source.toISOString().slice(0, 10) !== start)
    throw new Error("Fecha inválida");
  const target = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1, 12));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(last, source.getUTCDate()));
  return target.toISOString().slice(0, 10);
}
export function businessToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Monterrey",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Orders without a subscription term do not get a renewal date. */
export function orderSubscriptionMonths(serviceName: string): number | null {
  const name = serviceName.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const term = /\b(\d{1,2})\s*(mes(?:es)?|anos?)\b/.exec(name);
  if (term) {
    const months = Number(term[1]) * (term[2].startsWith("ano") ? 12 : 1);
    return months >= 1 && months <= 36 ? months : null;
  }
  if (/\banual(?:es)?\b/.test(name)) return 12;
  if (/\b(?:netflix|disney|hbo|max(?:\s+(?:premium|platino|estandar|bug|hulu)|$)|paramount|crunchyroll|vix|mubi|kocowa|spotify|fox one|prime video|apple tv)\b/.test(name)) return 1;
  return null;
}
