/* Notificaciones push de pedidos MA² (se carga dentro del service worker de la app). */
self.addEventListener("push", (event) => {
  let data = { title: "Pedido nuevo", body: "Tienes un pedido por atender", url: "/?pedidos=1" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    /* payload no JSON: se usan los valores por defecto */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "pedido",
      renotify: true,
      requireInteraction: true,
      data: { url: data.url || "/?pedidos=1" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/?pedidos=1";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
