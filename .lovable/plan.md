# Orden del panel y modo cliente con permisos

Dos cambios: ordenar los controles del administrador (hoy se ven amontonados y sin jerarquía) y crear un acceso de cliente con clave propia, donde tú decides qué puede ver y editar.

## 1. Panel de administrador ordenado

- Arriba queda solo lo esencial: buscador, selector de vista (Editar / Tarjetas / Tabla) y los chips de filtros activos.
- Todo lo demás pasa a un panel desplegable **Herramientas**, con secciones claras:
  - Filtros: categoría, orden, favoritos, solo activos, ver detalles, compartir.
  - Compartir y exportar: enlace con filtros, CSV, PDF.
  - Administrar: agregar servicio, ajustes del catálogo, categorías, historial, bitácora, mostrar catálogos, avisos de pedidos, y el nuevo **Acceso de clientes**.
- Las estadísticas se compactan en una sola fila horizontal desplazable.
- El desplegable recuerda si lo dejaste abierto o cerrado.
- La vista pública no cambia en nada.

## 2. Acceso de clientes (modo cliente con clave)

Nuevo botón **Acceso de clientes** en Herramientas (solo administrador). Ahí se da de alta cada cliente con:

- Nombre del negocio y de la persona, WhatsApp y notas.
- Clave de acceso propia (distinta a la de administrador), con opción de regenerarla y copiarla.
- Catálogo asignado.
- Fecha de inicio y fecha de vencimiento; al vencer el acceso deja de funcionar.
- Estado: activo o suspendido.
- Permisos con interruptores, uno por uno:
  - Ver: precios, descripciones, imágenes, servicios ocultos.
  - Editar: precio, nombre, descripción, imagen, activar/desactivar, agregar servicio, eliminar servicio, ajustes del catálogo (nombre, subtítulo, WhatsApp).
  - Todo apagado por defecto; tú enciendes lo que sí puede tocar.

En la pantalla principal aparece un botón **Mi menú** junto a "Administrador". El cliente entra con su clave y ve su catálogo con solo lo que le habilitaste; cualquier control no permitido queda oculto, no solo deshabilitado. Si su acceso está vencido o suspendido, ve un aviso claro y no puede editar.

## Alcance

- No cambia el catálogo público, ni tarjetas, precios, avisos ni nada existente.
- Los datos y precios siguen siendo los mismos; el cliente edita sobre el catálogo que le asignes.

## Detalles técnicos

- `src/routes/index.tsx`: los bloques de filtros, exportación y administración se mueven a un `Collapsible` "Herramientas"; el estado se guarda en `prefs.ts`.
- Nuevo `src/lib/catalog/client-access.ts`: tipo `ClientAccess` (id, negocio, contacto, catalogId, fechas, suspendido, `permissions: Record<Permiso, boolean>`, hash+salt de la clave con PBKDF2 100k, reutilizando el helper de `auth.ts`). Persistencia en localStorage vía `storage.ts`.
- Nuevo `src/components/catalog/client-access-dialog.tsx`: alta, edición, regenerar clave, suspender/activar, eliminar, y matriz de permisos.
- `store.tsx`: nuevo estado `clientSession` (cliente autenticado) y helper `can(permiso)`; `isAdmin` sigue igual. Las acciones del store validan `can()` cuando la sesión es de cliente.
- Los componentes (`admin-list.tsx`, `service-card.tsx`, `service-table.tsx`, barra de acciones) consultan `can()` para mostrar u ocultar cada control.
- El acceso se valida contra la fecha de vencimiento en cada carga de sesión.
