import { normalizeAppearance, type Appearance } from "@/lib/appearance/theme";
export function BusinessCover({
  appearance,
  name,
}: {
  appearance?: Partial<Appearance>;
  name: string;
}) {
  const a = normalizeAppearance(appearance);
  if (!a.coverImage && !a.logoImage) return null;
  return (
    <div
      className="ma2-business-cover"
      style={
        a.coverImage ? { backgroundImage: `url("${a.coverImage}")` } : undefined
      }
      aria-label={`Portada de ${name}`}
    >
      {a.logoImage ? (
        <img
          src={a.logoImage}
          alt={`Logo de ${name}`}
          className="ma2-business-logo"
        />
      ) : null}
    </div>
  );
}
