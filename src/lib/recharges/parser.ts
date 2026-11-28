export function parseBankNotice(text: string) {
  const body = text.normalize("NFKC").replace(/\u00a0/g, " ");
  const received = /recibiste\s+(?:una\s+)?transferencia|(?:has\s+)?recibido\s+(?:una\s+)?transferencia|(?:dep[oó]sito|abono)\s+recibido|transferencia\s+recibida/i.test(body);
  const sent = /(?:realizaste|enviaste|hiciste|has\s+(?:enviado|realizado))\s+(?:una\s+)?transferencia|transferencia\s+(?:enviada|realizada)|env[ií]o\s+de\s+transferencia/i.test(body);
  const completed = !/transferencia\s+(?:rechazada|cancelada|pendiente|programada|fallida)|no\s+se\s+(?:pudo\s+)?(?:envi[oó]|enviar|realiz[oó]|realizar)/i.test(body);
  const incoming = completed && received && !sent;
  const outgoing = completed && sent && !received;
  const amounts = [
    ...body.matchAll(/\b(?:monto|importe|cantidad)(?:\s+de\s+(?:la\s+)?transferencia)?\s*:\s*\$?\s*([\d.,]+)(?:\s*(?:pesos|MXN))?/gi),
  ].map((m) => {
    let n = m[1];
    if (n.includes(".") && n.includes(",")) n = n.replaceAll(",", "");
    else if (/,\d{2}$/.test(n)) n = n.replace(",", ".");
    else n = n.replaceAll(",", "");
    if (!/^\d+(?:\.\d{1,2})?$/.test(n)) return null;
    const [a, b = ""] = n.split(".");
    return Number(a) * 100 + Number(b.padEnd(2, "0"));
  });
  const refs = [...body.matchAll(/(?:referencia|concepto)\s*:\s*(MA-\d{6}|\d{7})(?![\w-])/gi)].map((m) => m[1].toUpperCase());
  const traces = [...body.matchAll(/clave\s+de\s+rastreo\s*:\s*([A-Z0-9-]{8,80})/gi)].map((m) =>
    m[1].toUpperCase(),
  );
  const unique = <T>(a: T[]) => [...new Set(a)];
  const a = unique(amounts),
    r = unique(refs),
    t = unique(traces);
  return {
    incoming,
    ...(outgoing ? { outgoing: true } : {}),
    amountCents: a.length === 1 && a[0] && a[0] > 0 && a[0] <= 100_000_000 ? a[0] : null,
    reference: r.length === 1 ? r[0] : null,
    ...(r.length > 1 ? { referenceAmbiguous: true } : {}),
    tracking: t.length === 1 ? t[0] : null,
    ...(t.length === 0 && outgoing
      ? { operation: body.match(/(?:folio|n[uú]mero)\s+de\s+(?:operaci[oó]n|transferencia)\s*:\s*([A-Z0-9-]{5,80})(?![\w-])/i)?.[1]?.toUpperCase() }
      : {}),
  };
}
/** Trust only Gmail's first, server-added Authentication-Results field. */
export function authenticatedBankHeader(source: string, sender: string, allowed: string[]) {
  const from = sender.toLowerCase();
  if (!allowed.map((s) => s.toLowerCase()).includes(from)) return false;
  const header = source.split(/\r?\n\r?\n/, 1)[0].replace(/\r?\n[\t ]+/g, " ");
  const results = header.split(/\r?\n/).filter((l) => /^Authentication-Results:/i.test(l));
  const auth = results[0] || "";
  if (!/^Authentication-Results:\s*mx\.google\.com\s*;/i.test(auth)) return false;
  const domain = from.split("@")[1];
  const dmarc = auth.match(/\bdmarc=pass\b[^;]*\bheader\.from=([^\s;]+)/i)?.[1]?.toLowerCase();
  const dkim = [...auth.matchAll(/\bdkim=pass\b[^;]*\bheader\.(?:d|i)=([^\s;]+)/gi)].map((m) =>
    m[1].toLowerCase().replace(/^.*@/, ""),
  );
  return (
    dmarc === domain &&
    dkim.some((d) => d === domain || domain.endsWith("." + d) || d.endsWith("." + domain))
  );
}
