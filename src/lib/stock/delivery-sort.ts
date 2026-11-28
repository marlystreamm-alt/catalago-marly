const clock = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Monterrey", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

/** Date-only records retain their recorded day; known timestamps break ties on that day. */
export function deliveryDateKey(date?: string | null, time?: string): string {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const local = time && Number.isFinite(Date.parse(time)) ? clock.format(new Date(time)) : "";
    return local.startsWith(date) ? local : `${date} 00:00:00`;
  }
  if (date && Number.isFinite(Date.parse(date))) return clock.format(new Date(date));
  return "9999-99-99";
}
