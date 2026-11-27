export const cyberdocRates = [
  ["Crunchyroll perfil", 30],
  ["Crunchyroll completa", 60],
  ["Disney+ completa", 130],
  ["Disney+ estándar completa", 85],
  ["Fox One perfil", 35],
  ["Fox One completa", 50],
  ["HBO Max perfil", 40],
  ["HBO Max completa", 65],
  ["Netflix privada", 85],
  ["Paramount+ perfil", 35],
  ["Paramount+ completa", 65],
  ["Prime Video perfil", 35],
  ["Prime Video completa", 60],
  ["ViX completa mes", 40],
  ["ViX anual completa", 100],
  ["Netflix privado, Disney+ Premium, Paramount+ y HBO Max", 160],
  ["Prime Video, Paramount+ y HBO Max", 107],
  ["HBO Max, Paramount+ y ViX", 98],
  ["Netflix privado, Disney+ Premium, Prime Video, Paramount+ y HBO Max", 180],
  ["Kocowa, Disney+ y HBO Max", 110],
  ["Disney+ Premium, HBO Max, Paramount+ y ViX", 150],
  ["Kocowa, Crunchyroll, Prime Video y HBO Max", 115],
  ["Canva 1 mes, Disney+ Premium, Paramount+ y HBO Max", 170],
  ["Disney + ViX anual", 170],
  ["Bot para grupos de WhatsApp · 1 mes", 90],
  ["Canva · 1 mes", 45],
  ["Canva · 12 meses", 230],
  ["Duolingo · 12 meses", 100],
  ["Gemini · 6 meses", 100],
  ["Drive con más de 250 libros", 80],
  ["Drive con más de 270 películas", 80],
  ["Certificado INEA (trabajo, verificable)", 149],
  ["Tienda web P de streaming, reportes y gestión personalizada anual", 1300],
] as const;
const normalize = (name: string) => name.normalize("NFD").toLowerCase()
  .replace(/\p{M}/gu, "").replace(/[^a-z0-9+]+/g, " ").trim();
const prices = new Map(cyberdocRates.map(([name, mxn]) => [normalize(name), mxn * 100]));
export const cyberdocRate = (service: string) => prices.get(normalize(service));

const local = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Monterrey", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
export function cyberdocCut(instant: string) {
  const [day, time] = local.format(new Date(instant)).split(" ");
  if (time < "22:00") return day;
  const next = new Date(day + "T00:00:00Z");
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}
