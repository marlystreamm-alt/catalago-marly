import { normalizeAppearance, type Appearance } from "@/lib/appearance/theme";

export function BusinessCover({
  appearance,
  name,
}: {
  appearance?: Partial<Appearance>;
  name: string;
}) {
  const { coverImage, logoImage } = normalizeAppearance(appearance);
  if (coverImage) {
    return <img src={coverImage} alt={`Portada de ${name}`} className="ma2-business-banner" />;
  }
  if (!logoImage) return null;
  return (
    <div className="ma2-business-cover">
      <img src={logoImage} alt={`Logo de ${name}`} className="ma2-business-logo" />
    </div>
  );
}
