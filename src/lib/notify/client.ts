/** Cliente: reporta pedidos a la nube y registra el dispositivo para avisos push. */
import type { OrderInput } from "./types";

const CODE_KEY = "ma2-avisos-code-v1";

export function getSavedCode() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveCode(code: string) {
  if (typeof window === "undefined") return;
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
export function reportOrder(order: OrderInput) {
  if (typeof window === "undefined") return;
  try {
    void fetch("/api/public/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* sin conexión: el pedido igual se envía por WhatsApp */
  }
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
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

  const registration = await navigator.serviceWorker.ready.catch(() => null);
  if (!registration) {
    return {
      ok: false,
      reason: "Instala la app en la pantalla de inicio y vuelve a intentar (aquí no hay soporte).",
    };
  }

  const existing = await registration.pushManager.getSubscription();
  const sub =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, reason: "No se pudo registrar el dispositivo" };
  }
  return {
    ok: true,
    subscription: { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}
