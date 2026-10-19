export function friendlyServerError(error: unknown, fallback = "No se pudo completar la operación") {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (/<!DOCTYPE html>|Login Redirect|edge-access|app\.netlify\.com\/edge-access|Please enable JavaScript/i.test(raw)) {
    return "Netlify bloqueó temporalmente la conexión con el servidor. Vuelve a intentar desde el sitio publicado.";
  }
  if (/Failed to fetch|NetworkError|fetch failed/i.test(raw)) return "No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.";
  return raw && raw.length < 500 ? raw : fallback;
}
