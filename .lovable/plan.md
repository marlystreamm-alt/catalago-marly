# Arreglar el desbordamiento horizontal en la vista de edición (iPhone)

En el video, al editar en la Vista Lista la pantalla se puede arrastrar hacia los lados: las filas quedan más anchas que el iPhone, los precios y el botón de "más datos" se salen del borde y todo el diseño se ve descuadrado.

## Causa

El carrusel de "Vista previa en vivo" contiene tarjetas de ancho fijo (una por cada servicio). Aunque tiene su propio scroll horizontal, sus contenedores padres no están limitados al ancho de la pantalla, así que estiran toda la página al ancho total de las tarjetas juntas. Por eso las filas de edición también se ven cortadas.

## Cambios

1. Limitar el ancho del bloque de vista previa a la pantalla (contenedor con ancho máximo y recorte), dejando el desplazamiento solo dentro del carrusel.
2. Añadir la misma protección de ancho a la sección de la Vista Lista y al contenedor donde se inserta en la página, para que ninguna fila pueda estirar el diseño.
3. Revisar que las filas de edición (nombre, precio, chevron) se mantengan dentro del ancho en pantallas pequeñas.

## Detalles técnicos

- `src/components/catalog/admin-list.tsx`: agregar `min-w-0`/`max-w-full` + `overflow-hidden` al contenedor de la vista previa y `min-w-0` a la `section` raíz.
- `src/routes/index.tsx`: agregar `min-w-0` al contenedor `grid gap-6` que envuelve `AdminList` (los ítems de grid tienen `min-width: auto` por defecto).
- Sin cambios en la lógica de negocio, datos ni en el catálogo público.
