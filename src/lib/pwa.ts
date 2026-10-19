/** Registra y conserva el service worker usado por MA² para notificaciones push. */
export function registerPwa() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  void (async () => {
    try {
      // Mantener un único worker de push estable. No lo eliminamos al recargar,
      // porque hacerlo invalida la suscripción del iPhone y obliga a registrar
      // el dispositivo una y otra vez.
      const registrations = await navigator.serviceWorker.getRegistrations();
      const pushRegistration = registrations.find((registration) =>
        registration.active?.scriptURL.endsWith("/push-sw.js") ||
        registration.waiting?.scriptURL.endsWith("/push-sw.js") ||
        registration.installing?.scriptURL.endsWith("/push-sw.js"),
      );

      if (!pushRegistration) {
        await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
      } else {
        // Busca actualizaciones sin eliminar el registro existente.
        void pushRegistration.update().catch(() => undefined);
      }
    } catch {
      // El fallo del worker no debe impedir que el catálogo cargue.
    }
  })();
}
