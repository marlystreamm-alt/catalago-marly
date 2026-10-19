/** Cliente: reporta pedidos a la nube y registra el dispositivo para avisos push. */
import type { OrderInput } from "./types";

const CODE_KEY = "ma2-avisos-code-v1";

export function getSavedCode() {
  if (typeof window === "undefined") return "";
  try {
    const session = window.localStorage.getItem("ma2-admin-session-v2") ?? "";
    if (session.startsWith("ma2s_")) return session;
    return window.localStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** The PIN form must not display or save an internal session token as a PIN. */
export function getSavedPin() {
  if (typeof window === "undefined") return "";
  try {
    const value = window.localStorage.getItem(CODE_KEY) ?? "";
    return value.startsWith("ma2s_") ? "" : value;
  } catch {
    return "";
  }
}

export function saveCode(code: string) {
  if (typeof window === "undefined") return;
  if (code.startsWith("ma2s_")) return;
  try {
    window.localStorage.setItem(CODE_KEY, code);
  } catch {
    /* almacenamiento no disponible */
  }
}

export function clearCode() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CODE_KEY);
  } catch {
    /* almacenamiento no disponible */
  }
}

/**
 * Avisa a la nube que se hizo un pedido. Nunca interrumpe al cliente:
 * si falla (sin internet, etc.) simplemente se ignora.
 */
export async function reportOrder(order: OrderInput): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const response = await fetch("/api/public/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64: string) {
  const clean = base64.trim().replace(/\s+/g, "");
  const padding = "=".repeat((4 - (clean.length % 4)) % 4);
  const normalized = (clean + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  if (output.length !== 65 || output[0] !== 4) {
    throw new Error("La llave de notificaciones no es válida. Vuelve a abrir la app y reintenta.");
  }
  return output;
}

export interface PushResult {
  ok: boolean;
  reason?: string;
  subscription?: { endpoint: string; p256dh: string; auth: string };
}

/** Pide permiso y devuelve la suscripción push de este dispositivo. */
export async function subscribeToPush(vapidPublicKey: string): Promise<PushResult> {
  if (typeof window === "undefined") return { ok: false, reason: "No disponible" };
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return {
      ok: false,
      reason:
        "Este navegador no permite avisos. En iPhone agrega la app a la pantalla de inicio y ábrela desde ahí.",
    };
  }
  if (!vapidPublicKey) return { ok: false, reason: "Faltan las llaves de notificación" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "No diste permiso de notificaciones" };

  let registration = await navigator.serviceWorker.getRegistration("/").catch(() => undefined);
  if (!registration || !registration.active?.scriptURL.endsWith("/push-sw.js")) {
    registration = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
  }
  const ready = await navigator.serviceWorker.ready.catch(() => null);
  if (!ready) {
    return {
      ok: false,
      reason: "Instala la app en la pantalla de inicio y vuelve a intentar (aquí no hay soporte).",
    };
  }
  registration = ready;

  // Si hubo intentos anteriores con otra llave VAPID, esa suscripción ya no sirve.
  // La eliminamos y creamos una limpia con la llave vigente.
  const existing = await registration.pushManager.getSubscription();
  if (existing) await existing.unsubscribe().catch(() => false);
  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, reason: "No se pudo registrar el dispositivo" };
  }
  return {
    ok: true,
    subscription: { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}
