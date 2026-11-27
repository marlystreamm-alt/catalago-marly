import type { CSSProperties } from "react";
export const APPEARANCE_PALETTES = {
  ma2: { label: "Turquesa y lavanda · MA²", accent: "oklch(.60 .105 216)", highlight: "oklch(.73 .10 213)", background: ["#cbf3f7", "#ece1fa"] },
  rosa: { label: "Rosa pastel", accent: "oklch(.55 .17 347)", highlight: "oklch(.74 .12 347)", background: ["#fce0ec", "#f1e1fb"] },
  lavanda: { label: "Lavanda y azul", accent: "oklch(.53 .16 292)", highlight: "oklch(.74 .13 292)", background: ["#e5e0fc", "#d8f1fa"] },
  menta: { label: "Menta y crema", accent: "#276557", highlight: "#8edac3", background: ["#dcf8ed", "#fff7df"] },
  durazno: { label: "Durazno y coral", accent: "#9d4539", highlight: "#ffab99", background: ["#ffeadc", "#ffe4e8"] },
  celeste: { label: "Azul cielo y nube", accent: "#305d91", highlight: "#91c9f0", background: ["#dceeff", "#f4f9ff"] },
  miel: { label: "Miel y vainilla", accent: "#795412", highlight: "#e8bb62", background: ["#fff0c6", "#fff9eb"] },
  salvia: { label: "Verde salvia y marfil", accent: "#506547", highlight: "#a9c39c", background: ["#e7efdc", "#fdf8eb"] },
  frambuesa: { label: "Frambuesa y crema", accent: "#913a61", highlight: "#e8a4c1", background: ["#f9dfe9", "#fff3e7"] },
  perla: { label: "Perla y azul grisáceo", accent: "#465a72", highlight: "#a7bdd1", background: ["#eef1f6", "#e3edf6"] },
} as const;

type AppearancePalette = keyof typeof APPEARANCE_PALETTES;
export function isAppearancePalette(value: unknown): value is AppearancePalette {
  return typeof value === "string" && Object.hasOwn(APPEARANCE_PALETTES, value);
}

export type Appearance = {
  palette?: AppearancePalette;
  coverImage: string;
  logoImage: string;
  cardImage: string;
  pageImage: string;
  cardOpacity: number;
  imageOpacity: number;
  season: "normal" | "halloween" | "navidad" | "primavera" | "verano";
};
export const DEFAULT_APPEARANCE: Appearance = {
  palette: "ma2",
  coverImage: "",
  logoImage: "",
  cardImage: "",
  pageImage: "",
  cardOpacity: 95,
  imageOpacity: 18,
  season: "normal",
};
export function safeAppearanceImage(value: unknown) {
  return typeof value === "string" &&
    value.length <= 2000 &&
    /^https:\/\/[^\s"'<>\\]+$/.test(value)
    ? value
    : "";
}
export function normalizeAppearance(raw: unknown): Appearance {
  const a = (raw && typeof raw === "object" ? raw : {}) as Partial<Appearance>;
  const percent = (v: unknown, d: number) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.min(100, Math.max(0, v))
      : d;
  return {
    palette: isAppearancePalette(a.palette) ? a.palette : "ma2",
    coverImage: safeAppearanceImage(a.coverImage),
    logoImage: safeAppearanceImage(a.logoImage),
    cardImage: safeAppearanceImage(a.cardImage),
    pageImage: safeAppearanceImage(a.pageImage),
    cardOpacity: percent(a.cardOpacity, 95),
    imageOpacity: percent(a.imageOpacity, 18),
    season: ["halloween", "navidad", "primavera", "verano"].includes(a.season || "")
      ? a.season!
      : "normal",
  };
}
export function appearanceStyle(raw: unknown): CSSProperties {
  const a = normalizeAppearance(raw);
  const palette = APPEARANCE_PALETTES[a.palette ?? "ma2"];
  return {
    "--ma2-accent": palette.accent,
    "--ma2-accent-light": palette.highlight,
    "--ma2-wash-one": palette.background[0],
    "--ma2-wash-two": palette.background[1],
    "--ma2-card-opacity": `${a.cardOpacity}%`,
    "--ma2-decoration-opacity": a.imageOpacity / 100,
    "--ma2-card-image": a.cardImage ? `url("${a.cardImage}")` : "none",
    ...(a.pageImage
      ? {
          backgroundImage: `linear-gradient(color-mix(in oklch, var(--background) 35%, transparent),color-mix(in oklch, var(--background) 35%, transparent)),url("${a.pageImage}")`,
          backgroundSize: "cover",
          backgroundAttachment: "fixed",
          backgroundPosition: "center",
        }
      : {}),
  } as CSSProperties;
}
