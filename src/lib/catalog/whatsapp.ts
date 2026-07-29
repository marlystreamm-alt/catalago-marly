import type { Catalog, Service } from "./types";

export function formatMXN(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function serviceDetails(service: Service, catalog: Catalog) {
  const category = catalog.categories.find((c) => c.id === service.categoryId);
  const subsection = category?.subsections.find((s) => s.id === service.subsectionId);
  const parts = [
    category ? `Categoría: ${category.name}` : null,
    subsection ? `Subsección: ${subsection.name}` : null,
    service.description ? service.description : null,
    service.devices ? `Dispositivos: ${service.devices}` : null,
    service.profiles ? `Perfiles: ${service.profiles}` : null,
    service.delivery ? `Entrega: ${service.delivery}` : null,
    service.warranty ? `Garantía: ${service.warranty}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function buildWhatsappMessage(service: Service, catalog: Catalog) {
  const template =
    catalog.whatsappTemplate || "Hola, me interesa {servicio} por {precio}. {detalles}";
  return template
    .replaceAll("{servicio}", service.name)
    .replaceAll("{precio}", formatMXN(service.price))
    .replaceAll("{detalles}", serviceDetails(service, catalog))
    .replaceAll("{catalogo}", catalog.name);
}

export function buildWhatsappLink(service: Service, catalog: Catalog) {
  const number = (catalog.whatsappNumber || "").replace(/\D/g, "");
  const text = encodeURIComponent(buildWhatsappMessage(service, catalog));
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}

/** Mensaje único para pedir varias plataformas a la vez. */
export function buildBulkWhatsappMessage(services: Service[], catalog: Catalog) {
  const lines = services.map(
    (s, i) => `${i + 1}. ${s.name} — ${formatMXN(s.price)}${
      serviceDetails(s, catalog) ? `\n   ${serviceDetails(s, catalog)}` : ""
    }`,
  );
  const total = services.reduce((sum, s) => sum + s.price, 0);
  return [
    `Hola, me interesan estos servicios de ${catalog.name}:`,
    lines.join("\n"),
    `Total: ${formatMXN(total)}`,
  ].join("\n");
}

export function buildBulkWhatsappLink(services: Service[], catalog: Catalog) {
  const number = (catalog.whatsappNumber || "").replace(/\D/g, "");
  const text = encodeURIComponent(buildBulkWhatsappMessage(services, catalog));
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}
