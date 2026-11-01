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
