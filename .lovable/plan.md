## Objetivo

Cuando no hay sesión de administrador (modo público), dejar la pantalla limpia: solo el buscador de servicios y el listado. Todo lo marcado en rojo se oculta.

## Qué se oculta en modo público

1. **Fila de estadísticas** (Total, Activos, Categorías, Ocultos, Favoritos).
2. **Controles de la tarjeta de filtros**, dejando únicamente "Buscar servicio…":
   - Selector de categorías
   - Selector de orden (Por categoría / precio / nombre)
   - Selector de vista (Tarjetas / Tabla)
   - Interruptores Favoritos, Ver detalles, Compartir
   - Chips de filtros activos y "Limpiar filtros"
3. **Fila de acciones**: Compartir enlace con filtros, Exportar búsqueda CSV, Exportar búsqueda PDF.

En modo administrador todo sigue igual que hoy.

## Detalles técnicos

- `src/routes/index.tsx`: envolver en `{isAdmin ? … : null}` la sección de estadísticas (líneas ~448-454), el bloque de selects/switches (~467-540), los chips de filtros (~542-568) y la barra de exportar/compartir (~570-611). El input de búsqueda queda siempre visible.
- La lógica de filtrado no cambia: en público se usan los valores por defecto de preferencias (categoría = todas, favoritos apagado, vista según preferencia guardada) y solo se aplica `query`.
- Nota: los enlaces públicos con parámetros (categoría, favoritos, servicio) siguen funcionando aunque los controles no se muestren.

## Prueba antes de terminar

Cerrar sesión de administrador y confirmar que solo aparece el buscador sobre el listado, sin estadísticas ni botones; luego entrar como administrador y verificar que todos los controles reaparecen.
