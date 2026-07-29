/** Utilidades para exportar historial y búsquedas como CSV o PDF (vía impresión). */

const escapeCsv = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function toCsv(headers: string[], rows: (string | number)[][]) {
  const lines = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.map(escapeCsv).join(","))];
  // BOM para que Excel en español abra los acentos correctamente.
  return `\uFEFF${lines.join("\r\n")}`;
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const blob = new Blob([toCsv(headers, rows)], { type: "text/csv;charset=utf-8;" });
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
): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  const html = `<!doctype html>
<html lang="es-MX"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; color: #1f2430; margin: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.sub { margin: 0 0 16px; color: #6b7280; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  th { background: #f3f0ff; font-weight: 600; }
  tr:nth-child(even) td { background: #fafafa; }
  @media print { body { margin: 12mm; } }
</style></head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="sub">${escapeHtml(subtitle)}</p>
  <table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
  <tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 250); };</scr" + "ipt>
</body></html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}

export const stamp = () => new Date().toISOString().slice(0, 10);
