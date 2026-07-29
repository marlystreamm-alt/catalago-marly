/** Utilidades para exportar historial y búsquedas como CSV o PDF (vía impresión). */

const escapeCsv = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /["\,\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** Datos de auditoría que acompañan a cada exportación. */
export interface ExportMeta {
  label: string;
  value: string;
}

export const formatStamp = (iso = new Date().toISOString()) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

/** Marca de tiempo lista para nombres de archivo: 2026-07-29_1305. */
export const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
};

/** Metadatos base: cuándo se generó y qué filtros estaban aplicados. */
export function buildMeta(extra: ExportMeta[] = []): ExportMeta[] {
  const now = new Date();
  return [
    { label: "Generado el", value: formatStamp(now.toISOString()) },
    { label: "Marca de tiempo ISO", value: now.toISOString() },
    ...extra,
  ];
}

export function toCsv(headers: string[], rows: (string | number)[][], meta: ExportMeta[] = []) {
  const metaLines = meta.map((m) => [escapeCsv(m.label), escapeCsv(m.value)].join(","));
  const lines = [
    ...metaLines,
    ...(metaLines.length ? [""] : []),
    headers.map(escapeCsv).join(","),
    ...rows.map((r) => r.map(escapeCsv).join(",")),
  ];
  // BOM para que Excel en español abra los acentos correctamente.
  return `\uFEFF${lines.join("\r\n")}`;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
  meta: ExportMeta[] = [],
) {
  const blob = new Blob([toCsv(headers, rows, meta)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

/**
 * Abre la vista de impresión del navegador con una tabla lista para
 * "Guardar como PDF" (funciona igual en Safari de iPhone).
 */
export function printPdf(
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][],
  meta: ExportMeta[] = [],
): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  const metaHtml = meta.length
    ? `<dl class="meta">${meta
        .map(
          (m) => `<div><dt>${escapeHtml(m.label)}</dt><dd>${escapeHtml(m.value)}</dd></div>`,
        )
        .join("")}</dl>`
    : "";
  const html = `<!doctype html>
<html lang="es-MX"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; color: #1f2430; margin: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.sub { margin: 0 0 12px; color: #6b7280; font-size: 12px; }
  dl.meta { margin: 0 0 16px; padding: 10px 12px; background: #f6f3ff; border-radius: 10px; font-size: 11px; }
  dl.meta div { display: flex; gap: 6px; padding: 2px 0; }
  dl.meta dt { margin: 0; font-weight: 600; color: #4b5563; }
  dl.meta dd { margin: 0; color: #1f2430; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  th { background: #f3f0ff; font-weight: 600; }
  tr:nth-child(even) td { background: #fafafa; }
  @media print { body { margin: 12mm; } }
</style></head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="sub">${escapeHtml(subtitle)}</p>
  ${metaHtml}
  <table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
  <tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 250); };</script>
</body></html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
