export type DeliveryMessageKind = "link" | "password" | "combined";

/** Render the current template using the selected order's saved document. */
export function buildOrderDeliveryMessage(
  templates: Record<DeliveryMessageKind, string>,
  delivery: { client: string; platform: string; link: string; accessPassword: string },
  kind: DeliveryMessageKind,
): string {
  if (kind === "password" && !delivery.accessPassword) return "";
  const template = templates[kind === "combined" && !delivery.accessPassword ? "link" : kind];
  const values: Record<string, string> = {
    cliente: delivery.client, plataforma: delivery.platform,
    link: delivery.link, contraseña: delivery.accessPassword,
  };
  // One pass preserves customer text that itself happens to contain a placeholder.
  return template.replace(/\{(cliente|plataforma|link|contraseña)\}/g, (_, key: string) => values[key]);
}
