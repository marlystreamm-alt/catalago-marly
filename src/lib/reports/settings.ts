export const REPORT_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const REPORT_TIME_ZONE = "America/Monterrey";

export type ReportSettings = {
  days: number[];
  from: string;
  until: string;
  requireEvidence: boolean;
  allowManual: boolean;
};

export const DEFAULT_REPORT_SETTINGS: ReportSettings = {
  days: [0, 1, 2, 3, 4, 5, 6],
  from: "00:00",
  until: "23:59",
  requireEvidence: false,
  allowManual: true,
};

const localClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: REPORT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const localDate = new Intl.DateTimeFormat("es-MX", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function reportAvailability(settings: ReportSettings, now = new Date()) {
  const parts = Object.fromEntries(localClock.formatToParts(now).map(({ type, value }) => [type, value]));
  const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const day = (date.getUTCDay() + 6) % 7;
  const time = `${parts.hour}:${parts.minute}`;
  const overnight = settings.from > settings.until;
  const pastOpening = time >= settings.from;
  const beforeClosing = time <= settings.until;
  const open = overnight
    ? (settings.days.includes(day) && pastOpening)
      || (settings.days.includes((day + 6) % 7) && beforeClosing)
    : settings.days.includes(day) && pastOpening && beforeClosing;
  if (open) return { open: true, next: null };

  for (let offset = pastOpening ? 1 : 0; offset <= 7; offset++) {
    if (!settings.days.includes((day + offset) % 7)) continue;
    date.setUTCDate(date.getUTCDate() + offset);
    return { open: false, next: `${localDate.format(date)} a las ${settings.from}` };
  }
  return { open: false, next: null };
}

export function reportClosedMessage(next: string | null) {
  return next
    ? `La recepción de reportes está cerrada. Vuelve el ${next} (hora de Saltillo).`
    : "La recepción de reportes está pausada.";
}
