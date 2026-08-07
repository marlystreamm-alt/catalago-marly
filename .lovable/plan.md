# Vender tu catálogo: cada cliente con el suyo, personalizado según lo que autorices

Tu catálogo actual (Mis Clientes, Cyberdoc, Revendedores) **no se toca**: sigue igual, es tuyo.

Lo nuevo es un producto vendible: le entregas a cada cliente **un catálogo vacío igual al tuyo**, con su propio enlace, y él lo llena y personaliza solo dentro de lo que tú le autorices. El apartado "Menús" que ya empezamos se convierte en esto (se unifica; los negocios de comida y los catálogos de servicios son lo mismo: "clientes").

## 1. Panel de clientes (solo tú)

Dentro del modo administrador, "Menús" pasa a llamarse **Mis clientes / Catálogos vendidos**. Por cada cliente ves en una tarjeta:

- nombre del negocio, dueño y WhatsApp,
- estado: activo / apagado / vencido,
- su enlace público (`martgor.shop/negocio`) con botones de copiar y abrir,
- cuántos productos y categorías tiene cargados,
- su clave de acceso y hasta cuándo le vale.

Con buscador y filtro por estado.

## 2. Interruptor general

Un switch grande **Activo / Apagado** por cliente:

- Apagado: su enlace público muestra un aviso de "catálogo no disponible" y el dueño no puede entrar a editar.
- Encendido: todo vuelve como estaba, no se borra nada.

Se apaga solo al pasar la fecha de vencimiento que le pongas.

## 3. Interruptores de lo que puede hacer

Por cada cliente decides con switches. Dos grupos:

**Lo que ve el público en su catálogo**
- Precios
- Fotos
- Descripciones
- Botón "Pedir por WhatsApp"
- Dirección del negocio

**Lo que el dueño puede editar en su panel**
- Precios
- Nombre y descripción de productos
- Fotos
- Agregar productos
- Eliminar productos
- Categorías
- Activar/desactivar productos
- Datos del negocio (nombre, WhatsApp, dirección, logo)

Todo lo nuevo que agreguemos después entra con su propio switch aquí. Los switches solo los mueves tú; lo que no autorices, el dueño ni lo ve.

## 4. Acceso del dueño con su clave

- Desde su ficha generas una clave tipo `MA2-4F7K-92QX`, la copias y se la mandas.
- El dueño entra por una pantalla de acceso y solo ve **su** catálogo, con el mismo diseño y la misma forma de editar que usas tú.
- Puedes regenerar la clave, suspenderla o ponerle vencimiento.
- La clave se guarda cifrada, nunca legible, y se valida en el servidor.

## 5. Su catálogo público

Cada cliente arranca vacío y carga lo suyo. El enlace queda directo en tu dominio: `martgor.shop/negocio`, con tarjetas, imágenes y botón de WhatsApp, respetando sus interruptores y su estado.

## Detalles técnicos

- `menu_businesses` se reutiliza como tabla de clientes: nuevas columnas `expires_on`, `access_salt`, `access_hash`, `access_updated_at`, `logo_url` y un `jsonb features` con los interruptores (por defecto seguros). RLS sigue cerrada (`using false`); todo pasa por funciones de servidor.
- Ruta pública nueva `/$slug` (raíz del dominio) para el catálogo del cliente, con la ruta actual `/m/$slug` conservada como redirección permanente para no romper enlaces ya compartidos. El `$slug` valida contra una lista de rutas reservadas.
- `menus.server.ts` / `menus.functions.ts`: funciones para guardar features, generar/revocar clave y validar clave del dueño (PBKDF2-SHA256, 100 000 iteraciones, igual que `client-access.ts`).
- Sesión del dueño: token firmado en cookie con el `businessId`; cada función de edición valida el token contra el negocio y contra sus `features`. Nunca se confía en el `businessId` que mande el navegador.
- `loadPublicMenu` respeta `active`, `expires_on` y los features de vista: si "precios" está apagado, el precio no sale del servidor, no solo se oculta.
- Rutas nuevas `/acceso` (login del dueño) y `/mi-catalogo` (su editor), reutilizando los componentes del editor de `menus-dialog.tsx` extraídos a componentes compartidos.
- El panel de administrador se queda en `menus-dialog.tsx`, renombrado y ampliado con pestañas Negocio / Interruptores / Acceso.
- El `client-access.ts` actual (accesos sobre tus catálogos en localStorage) queda intacto; esto es el sistema vendible, aparte.

## Orden de trabajo

1. Migración de base de datos (vencimiento, clave, features, logo).
2. Panel de clientes: catálogo de ventas, interruptor general e interruptores de funciones.
3. Claves de acceso y editor del dueño con permisos.
4. Catálogo público en `martgor.shop/negocio` respetando estado, vencimiento e interruptores.
