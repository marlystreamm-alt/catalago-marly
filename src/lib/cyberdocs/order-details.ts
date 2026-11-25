/** The card header and contact editor already display these fields. */
export function extraOrderDetails(fields: Record<string, string>) {
  const normalize = (v: string) => v.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const standard = new Set(["id","pedidoid","idpedido","cliente","nombrecliente","servicio","plataforma","fecha","fechahora","origen","whatsapp","contactowhatsapp","numeroparacontactarwhatsapp","whatsappdelcliente"]);
  const seen = new Set<string>();
  return Object.entries(fields).filter(([key,value]) => {
    const label = normalize(key);
    if (!String(value ?? "").trim() || standard.has(label) || seen.has(label)) return false;
    seen.add(label);
    return true;
  });
}
