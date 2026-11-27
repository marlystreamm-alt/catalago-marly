import type { CSSProperties } from "react";
export type Appearance = {
  palette?: "ma2" | "rosa" | "lavanda";
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
    palette: a.palette === "rosa" || a.palette === "lavanda" ? a.palette : "ma2",
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
  const palette = {
    ma2: ["oklch(.60 .105 216)","oklch(.73 .10 213)","#cbf3f7","#ece1fa"],
    rosa: ["oklch(.55 .17 347)","oklch(.74 .12 347)","#fce0ec","#f1e1fb"],
    lavanda: ["oklch(.53 .16 292)","oklch(.74 .13 292)","#e5e0fc","#d8f1fa"],
  }[a.palette || "ma2"];
  return {
    "--ma2-accent": palette[0],
    "--ma2-accent-light": palette[1],
    "--ma2-wash-one": palette[2],
    "--ma2-wash-two": palette[3],
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
