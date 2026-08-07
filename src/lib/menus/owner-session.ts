/** Sesión del dueño en el navegador (solo guarda el token firmado por el servidor). */
const KEY = "ma2-owner-token";

export function saveOwnerToken(token: string) {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    /* almacenamiento no disponible */
  }
}

export function getOwnerToken() {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function clearOwnerToken() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* almacenamiento no disponible */
  }
}
