import type { Catalog, Service } from "./types";

export function formatMXN(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Precio visible: usa el texto libre si existe, si no el precio en MXN. */
export function displayPrice(service: Service) {
  const text = service.priceText?.trim();
  if (text) return text;
  return formatMXN(service.price);
}

/** Líneas con etiqueta fija; los valores vacíos se omiten por completo. */
export function serviceFacts(service: Service, catalog?: Catalog): { label: string; value: string }[] {
  const extra = (service.customFields ?? []).filter((f) => f.visible !== false && f.label?.trim() && f.value?.trim()).map((f) => ({ label: f.label.trim(), value: f.value.trim() }));
  const legacy = catalog ? ["clientes", "cyberdoc", "revendedores"].includes(catalog.id) : true;
  if (catalog && !legacy) {
    if (catalog.spaceType === "marketplace") {
      return [
        { label: "Estado", value: service.plan || "Nuevo" },
        { label: "Precio", value: displayPrice(service) },
      ];
    }
    if (catalog.spaceType === "menu") {
      return [
        { label: "Presentación / extras", value: service.plan ?? "" },
        { label: "Preparación", value: service.delivery },
        { label: "Disponibilidad", value: service.vigencia ?? "" },
      ].filter((f) => f.value && f.value.trim()).concat(extra);
    }
    if (catalog.spaceType === "directory" || catalog.spaceType === "provider") {
      const methods = service.paymentMethods ?? [];
      return [
        { label: catalog.spaceType === "provider" ? "Servicio / especialidad" : "Categoría / tipo", value: service.plan ?? "" },
        { label: catalog.spaceType === "provider" ? "Teléfono / contacto" : "Teléfono", value: service.users ?? "" },
        { label: "📅 Días de servicio", value: service.serviceDays ?? "" },
        { label: "🕐 Horario", value: service.businessHours ?? service.delivery },
        { label: "📍 Dirección", value: service.address ?? service.requirements ?? "" },
        ...(service.homeDelivery ? [{ label: "🛵 Servicio a domicilio", value: "Sí ✓" }] : []),
        ...(methods.includes("cash") ? [{ label: "💵 Efectivo", value: "Sí ✓" }] : []),
        ...(methods.includes("transfer") ? [{ label: "📲 Transferencia", value: "Sí ✓" }] : []),
        ...(methods.includes("card") ? [{ label: "💳 Tarjeta", value: "Sí ✓" }] : []),
      ].filter((f) => f.value && f.value.trim()).concat(extra);
    }
    return [
      { label: "Tipo / modalidad", value: service.plan ?? "" },
      { label: "Entrega / disponibilidad", value: service.delivery },
      { label: "Vigencia / duración", value: service.vigencia ?? "" },
    ].filter((f) => f.value && f.value.trim()).concat(extra);
  }
  return [
    { label: "Plan", value: service.plan ?? "" },
    { label: "Dispositivos", value: service.devices },
    { label: "Perfiles", value: service.profiles },
    { label: "Usuarios", value: service.users ?? "" },
    { label: "Tiempo de entrega", value: service.delivery },
    { label: "Garantía", value: service.warranty },
    { label: "Vigencia", value: service.vigencia ?? "" },
    { label: "Requisitos", value: service.requirements ?? "" },
  ].filter((f) => f.value && f.value.trim()).concat(extra);
}

export function serviceDetails(service: Service, catalog: Catalog) {
  const category = catalog.categories.find((c) => c.id === service.categoryId);
  const subsection = category?.subsections.find((s) => s.id === service.subsectionId);
  const parts = [
    category ? `Categoría: ${category.name}` : null,
    subsection ? `Subsección: ${subsection.name}` : null,
    service.description ? service.description : null,
    ...serviceFacts(service, catalog).map((f) => `${f.label}: ${f.value.trim()}`),
  ].filter(Boolean);
  return parts.join(" · ");
}

export function buildWhatsappMessage(service: Service, catalog: Catalog) {
  const personal = (catalog.spaceType === "directory" || catalog.spaceType === "provider") && service.personalWhatsappEnabled === true;
  const template =
    personal && service.whatsappMessage?.trim()
      ? service.whatsappMessage
      : catalog.whatsappTemplate || "Hola, me interesa {servicio} por {precio}. {detalles}";
  return template
    .replaceAll("{servicio}", service.name)
    .replaceAll("{precio}", displayPrice(service))
    .replaceAll("{detalles}", serviceDetails(service, catalog))
    .replaceAll("{catalogo}", catalog.name);
}

export function buildWhatsappLink(service: Service, catalog: Catalog) {
  const personal = (catalog.spaceType === "directory" || catalog.spaceType === "provider") && service.personalWhatsappEnabled === true;
  const source = personal && service.whatsapp?.trim() ? service.whatsapp : catalog.whatsappNumber;
  const number = (source || "").replace(/\D/g, "");
  const text = encodeURIComponent(buildWhatsappMessage(service, catalog));
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}

/** Mensaje único para pedir varias plataformas a la vez. */
export function buildBulkWhatsappMessage(services: Service[], catalog: Catalog) {
  const lines = services.map(
    (s, i) => `${i + 1}. ${s.name} — ${displayPrice(s)}${
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
