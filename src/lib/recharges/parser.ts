export function parseBankNotice(text: string) {
  const body = text.normalize("NFKC").replace(/\u00a0/g, " ");
  const incoming =
    /recibiste\s+(?:una\s+)?transferencia|(?:has\s+)?recibido\s+(?:una\s+)?transferencia|dep[oó]sito\s+recibido|abono\s+recibido/i.test(
      body,
    ) && !/transferencia\s+(?:rechazada|cancelada)|enviaste\s+una\s+transferencia/i.test(body);
  const amounts = [
    ...body.matchAll(/(?:monto|importe|cantidad)\s*:\s*\$?\s*([\d.,]+)(?:\s*(?:pesos|MXN))?/gi),
  ].map((m) => {
    let n = m[1];
    if (n.includes(".") && n.includes(",")) n = n.replaceAll(",", "");
    else if (/,\d{2}$/.test(n)) n = n.replace(",", ".");
    else n = n.replaceAll(",", "");
    if (!/^\d+(?:\.\d{1,2})?$/.test(n)) return null;
    const [a, b = ""] = n.split(".");
    return Number(a) * 100 + Number(b.padEnd(2, "0"));
  });
  const refs = [...body.matchAll(/(?:referencia|concepto)\s*:\s*(\d{7})(?!\d)/gi)].map((m) => m[1]);
  const traces = [...body.matchAll(/clave\s+de\s+rastreo\s*:\s*([A-Z0-9-]{8,80})/gi)].map((m) =>
    m[1].toUpperCase(),
  );
  const unique = <T>(a: T[]) => [...new Set(a)];
  const a = unique(amounts),
    r = unique(refs),
    t = unique(traces);
  return {
    incoming,
    amountCents: a.length === 1 && a[0] && a[0] > 0 && a[0] <= 100_000_000 ? a[0] : null,
    reference: r.length === 1 ? r[0] : null,
    tracking: t.length === 1 ? t[0] : null,
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
