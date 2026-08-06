# Menús como producto: catálogo de negocios, interruptores y accesos por dueño

Tu catálogo actual (Mis Clientes, Cyberdoc, Revendedores) **no se toca**. Todo esto vive dentro del apartado **Menús** del modo administrador.

## 1. Catálogo de negocios (solo para ti)

Dentro de Menús, la lista de negocios pasa a ser tu catálogo de ventas: por cada negocio ves en una sola tarjeta

- nombre, dueño y WhatsApp,
- estado (activo / apagado / vencido),
- el enlace público de su menú, con botón para copiar y abrir,
- cuántos platillos y categorías tiene,
- la clave de acceso del dueño y hasta cuándo le vale.

Con buscador y filtro por estado, para cuando ya tengas varios.

## 2. Interruptor general del negocio

Un switch grande **Activo / Apagado** por negocio:

- Apagado: su enlace público deja de mostrar el menú y aparece un aviso de "menú no disponible", y el dueño no puede entrar a editar.
- Encendido: todo vuelve exactamente como estaba (no se borra nada).

También se apaga solo cuando pasa la fecha de vencimiento que le pongas.

## 3. Interruptores de funciones (lo que tú autorizas)

Por cada negocio decides, con switches, qué está permitido. Se dividen en dos grupos:

**Lo que ve el cliente final en el menú público**
- Mostrar precios
- Mostrar fotos de los platillos
- Mostrar descripciones
- Botón "Pedir por WhatsApp"
- Mostrar dirección del negocio

**Lo que el dueño puede editar en su panel**
- Editar precios
- Editar nombre y descripción de platillos
- Cambiar fotos
- Agregar platillos
- Eliminar platillos
- Manejar categorías
- Activar/desactivar platillos
- Cambiar datos del negocio (nombre, WhatsApp, dirección)

Cada mejora nueva que agreguemos después entra con su propio switch aquí. Los switches solo los mueve el administrador; el dueño ve apagado lo que no le autorizaste.

## 4. Acceso del dueño con su propia clave

- Desde la ficha del negocio generas una clave tipo `MA2-4F7K-92QX`, la copias y se la mandas.
- El dueño entra por una pantalla de acceso, escribe su clave y solo ve **su** negocio: edita su menú dentro de los permisos que le diste.
- Puedes regenerar la clave, suspenderla o ponerle fecha de vencimiento cuando quieras.
- La clave nunca se guarda legible; se guarda cifrada y se valida en el servidor.

## Detalles técnicos

- Nuevas columnas en `menu_businesses`: `expires_on`, `access_salt`, `access_hash`, `access_updated_at`, y un `jsonb features` con los interruptores (valores por defecto seguros). Nueva migración; RLS sigue cerrada (`using false`) y todo pasa por funciones de servidor.
- `menus.server.ts` / `menus.functions.ts`: nuevas funciones para guardar features, generar/revocar clave y validar clave del dueño (PBKDF2-SHA256, 100 000 iteraciones, igual que `client-access.ts`, pero del lado servidor).
- Sesión del dueño: token firmado en cookie con el `businessId`; toda función de edición del dueño valida ese token contra el negocio y contra sus `features` antes de escribir. Nunca se confía en el `businessId` que mande el navegador.
- `loadPublicMenu` respeta `active`, `expires_on` y los `features` de vista: si "mostrar precios" está apagado, el precio no sale del servidor, no solo se oculta en pantalla.
- Nueva ruta pública `/menu-acceso` para el login del dueño y `/mi-menu` para su editor (reutiliza los componentes del editor actual de `menus-dialog.tsx`, extraídos a componentes compartidos).
- El panel de administrador se queda en `menus-dialog.tsx`, ampliado con las pestañas Negocio / Interruptores / Acceso.
- Los accesos de cliente actuales (`client-access.ts`, para catálogos) siguen igual; esto es un sistema aparte para menús.

## Orden de trabajo

1. Migración de base de datos (columnas y features).
2. Panel de administrador: catálogo de negocios, interruptor general e interruptores de funciones.
3. Generación de claves y pantalla de acceso del dueño con su editor limitado.
4. Menú público respetando estado, vencimiento e interruptores.
