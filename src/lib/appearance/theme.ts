import type { CSSProperties } from "react";
export type Appearance = {
  coverImage: string;
  logoImage: string;
  cardImage: string;
  pageImage: string;
  cardOpacity: number;
  imageOpacity: number;
  season: "normal" | "halloween" | "navidad" | "primavera";
};
export const DEFAULT_APPEARANCE: Appearance = {
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
    coverImage: safeAppearanceImage(a.coverImage),
    logoImage: safeAppearanceImage(a.logoImage),
    cardImage: safeAppearanceImage(a.cardImage),
    pageImage: safeAppearanceImage(a.pageImage),
    cardOpacity: percent(a.cardOpacity, 95),
    imageOpacity: percent(a.imageOpacity, 18),
    season: ["halloween", "navidad", "primavera"].includes(a.season || "")
      ? a.season!
      : "normal",
  };
}
export function appearanceStyle(raw: unknown): CSSProperties {
  const a = normalizeAppearance(raw);
  return {
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
