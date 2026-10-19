/**
 * Copia texto con fallback para Safari/iOS y navegadores donde Clipboard API
 * no está disponible o es bloqueada por permisos.
 */
export async function copyText(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Continúa con el fallback DOM.
    }
  }

  if (typeof document === "undefined") {
    throw new Error("No se puede copiar en este entorno");
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const ok = typeof document.execCommand === "function" && document.execCommand("copy");
  textarea.remove();
  if (!ok) throw new Error("No se pudo copiar automáticamente");
}
