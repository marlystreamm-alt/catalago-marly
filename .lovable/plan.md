## Objetivo

Que al **editar** (modo administrador) veas una lista simple tipo la de tu captura —plataforma y precio en filas— y que el **catálogo público** siempre se vea con las tarjetas normales, sin importar la vista que hayas dejado activa.

## Qué cambia

**1. El público siempre ve tarjetas**
Hoy el modo de vista (tarjetas / tabla / lista) se guarda como preferencia y se sigue aplicando aunque cierres sesión de administrador, por eso el catálogo puede quedarse en modo tabla. Se forzará: si no hay sesión de administrador, siempre se renderizan las tarjetas normales. La preferencia se conserva para cuando vuelvas a entrar como admin.

**2. La vista de edición se simplifica al estilo de tu captura**
La "Vista lista (editar)" pasa a mostrar filas compactas: icono/estrella, nombre de la plataforma y precio (texto libre), con el resto de los campos —plan, dispositivos, perfiles, usuarios, tiempo de entrega, garantía, vigencia, requisitos, descripción— ocultos dentro de un desplegable por fila ("Más datos"). Así editas nombre y precio de corrido y solo abres el detalle cuando lo necesitas.

Se conservan tal cual: las tres pestañas (Perfiles, Completas, Trámites), buscar, filtrar activos/desactivados, seleccionar, agregar/duplicar/eliminar fila, activar/desactivar, reordenar y el botón único **Guardar todos los cambios**.

**3. Selector de vista más claro**
Solo dos opciones visibles para el admin: **Editar** (lista) y **Vista pública** (tarjetas, para revisar cómo queda). La vista "tabla" actual se deja disponible pero deja de ser lo que puede "escaparse" al público.

## Lo que NO cambia

- Diseño, colores, tamaños y comportamiento de las tarjetas públicas.
- Campos de texto libre sin mínimos ni números forzados.
- Ocultamiento de líneas vacías en las tarjetas.
- Toda la lógica de datos, WhatsApp, respaldos e historial.

## Detalles técnicos

- `src/routes/index.tsx`: el render usa `isAdmin ? viewMode : "tarjetas"`; se ajustan las etiquetas del selector.
- `src/components/catalog/admin-list.tsx`: se reestructura la fila a un layout de dos columnas (nombre + precio) con `Collapsible` para el resto de campos; misma lógica de estado y `replaceServices`.
- Sin cambios en `store.tsx`, `types.ts`, `whatsapp.ts` ni `service-card.tsx`.

## Verificación

Prueba en el navegador: entrar como admin, editar dos precios y un nombre en la lista, guardar una sola vez, abrir "Más datos" de una fila, cerrar sesión y confirmar que el catálogo público aparece con tarjetas normales.
