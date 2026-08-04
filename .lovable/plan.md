# Avisos de pedidos nuevos para el administrador

Hoy, cuando un cliente toca "Pedir por WhatsApp", solo se abre WhatsApp en el teléfono del cliente: el pedido no queda registrado en ningún lado, así que la app no tiene forma de avisarte. El plan agrega un registro de pedidos en la nube (activable/desactivable) y cuatro canales de aviso.

## 1. Interruptor general

En el panel de administrador se agrega una sección "Avisos de pedidos" con:

- Interruptor maestro: **Registrar pedidos en la nube** (encendido/apagado). Apagado = la app funciona exactamente como hoy, sin registro ni avisos.
- Un interruptor por canal: notificación al celular, correo, WhatsApp a tu número, panel dentro de la app.
- Campo para tu correo y tu número de WhatsApp de avisos.
- Interruptor "Recordarme cada 15 minutos hasta marcar como atendido".
- **Horario de avisos**: hora de inicio y hora de fin configurables (por ejemplo 8:00 a 00:00, zona horaria de México). Fuera de ese horario no se envía ningún aviso ni recordatorio; los pedidos se siguen registrando y aparecen en el panel, y los pendientes se avisan al llegar la hora de inicio.
- Interruptor "Apagar automáticamente a las 12 de la noche" (activado por defecto, con la hora editable) y opción de encender o apagar los avisos manualmente en cualquier momento sin importar el horario.

## 2. Registro del pedido

Al enviar un pedido (individual o múltiple, en línea o desde la cola offline), la app guarda en la nube: catálogo, servicios, precios, total, mensaje, fecha y estado (nuevo / atendido).

## 3. Canales de aviso

- **Panel dentro de la app**: lista "Pedidos recibidos" con contador de pendientes, sonido y actualización en vivo; botones "Marcar como atendido" y "Abrir WhatsApp".
- **Notificación al celular (push)**: aviso aunque la app esté cerrada. En iPhone solo funciona con la app instalada en la pantalla de inicio (Compartir → Agregar a inicio) y aceptando el permiso; el sistema te pedirá autorización una vez.
- **Correo electrónico**: correo con el detalle del pedido. Requiere conectar un servicio de envío de correo (Resend), gratuito para volúmenes bajos.
- **WhatsApp a tu número**: mensaje automático a tu WhatsApp. Requiere un proveedor externo de pago (Twilio WhatsApp API) y verificación de número. Se deja preparado y se activa cuando decidas contratarlo; mientras tanto ese interruptor queda visible con aviso de "requiere configuración".
- **Alexa (bocina en casa)**: sí se puede. Amazon no permite que una app cualquiera hable directo en tu Alexa, pero sí funciona con una skill puente gratuita:
  - Instalas en la app Alexa la skill **Notify Me** (o **Voice Monkey**), te llega por correo un código de acceso y lo pegas en el panel de administrador.
  - Con eso, cada pedido nuevo hace que tu Alexa suene y anuncie por ejemplo: "Tienes un pedido nuevo de Mis Clientes por 250 pesos".
  - Con Notify Me la bocina da el tono de notificación y lees/escuchas el aviso al decir "Alexa, lee mis notificaciones"; con Voice Monkey el anuncio se escucha solo. El interruptor de Alexa respeta el mismo horario que los demás avisos (nada de anuncios de madrugada).
  - Si no pegas el código, el interruptor queda visible con el aviso "requiere configuración" y no se envía nada.

## 4. Recordatorios cada 15 minutos

Un proceso programado en la nube revisa cada 15 minutos los pedidos con estado "nuevo" y reenvía el aviso por los canales activos hasta que lo marques como atendido, siempre dentro del horario configurado. Puedes desactivar el recordatorio y dejar solo el primer aviso.

## Detalles técnicos

- Activar Lovable Cloud. Tablas: `orders` (datos del pedido, estado, `notified_at`, `attempts`), `notification_settings` (canales, correo, número, recordatorios, interruptor maestro, `quiet_start`, `quiet_end`, `timezone` = America/Monterrey), `push_subscriptions` (endpoints Web Push del admin).
- Endpoint público `src/routes/api/public/orders.ts` (POST) para registrar el pedido desde el cliente, con validación Zod y sin PII; lectura del panel vía server functions protegidas con `requireSupabaseAuth` o clave de admin existente.
- Web Push con VAPID: se generan las llaves como secretos, service worker de mensajería aparte del app-shell (no toca el PWA actual).
- Correo vía conector Resend; WhatsApp vía Twilio (secretos añadidos solo si lo activas); Alexa vía POST a Notify Me (`https://api.notifymyecho.com/v1/NotifyMe`) o Voice Monkey, con el código de acceso guardado como secreto del proyecto.
- Recordatorios: `pg_cron` llamando a `api/public/notify-pending` protegido con secreto.
- El código cliente solo publica el pedido cuando el interruptor maestro está encendido; si falla la red, el pedido queda en la cola local existente y se publica al reconectar.

## Fuera de alcance

No se cambia el diseño ni el comportamiento del catálogo público ni de las tarjetas.
