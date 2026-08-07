# Historial por negocio más claro y panel de administrador ordenado

Dos partes: (1) mejorar el historial de cambios de cada negocio vendido, (2) ordenar el panel de administrador y unificar lo repetido con autorización aceptada por mi ,del catálogo público se ocultan los botones no autorizados.

## 1. Historial de cambios por negocio

En el bloque "Historial de cambios" (dentro de la ficha de cada cliente):

- **Orden**: selector "Más recientes primero / Más antiguos primero".
- **Paginación**: 20 movimientos por página, con "Anterior / Siguiente", indicador "Página 1 de 5" y selector de 20 / 50 / 100 por página. Al cambiar cualquier filtro vuelve a la página 1.
- **Buscador** de texto libre (producto, campo, valor) además de los filtros que ya existen (administrador, tipo de cambio, desde, hasta).
- **Chips de filtros activos** con una X para quitar cada uno y un botón "Limpiar filtros".
- **Limpieza visual**: filtros agrupados en una fila compacta y plegable, movimientos separados por día con encabezado de fecha ("Hoy", "Ayer", "12 ago"), cada fila muestra hora, quién, etiqueta de tipo y el cambio anterior → nuevo en una sola línea legible.
- Contador "Mostrando 1-20 de 137 movimientos".

También aplico la misma limpieza ligera a la lista de respaldos (orden por versión y máximo visible con "ver más") para que las tres secciones se vean parejas.

## 2. Panel de administrador: orden y elementos repetidos

Estas son las repeticiones que encontré. **Ninguna se toca sin tu visto bueno**: dime cuáles apruebo y con cuáles no.

1. **"Historial" y "Bitácora"** — son dos botones y dos ventanas casi iguales: uno muestra los movimientos del catálogo actual y el otro los de todos. Propuesta: un solo botón **"Historial"** con un filtro arriba "Este catálogo / Todos los catálogos".
2. **"Mostrar catálogos" y "Catálogos" (el gestor del encabezado)** — los dos administran los mismos catálogos. Propuesta: mover mostrar/ocultar dentro de **"Catálogos"** y quitar el botón suelto.
3. **"Volver al catálogo"** — hace lo mismo que el selector de vista "Vista pública (tarjetas)". Propuesta: dejar solo el selector.
4. **Interruptores "Ver detalles" y "Compartir"** — están entre los filtros, pero no filtran nada: controlan los botones de las tarjetas. Propuesta: moverlos a un grupo aparte llamado **"Botones en las tarjetas"**.
5. **"Ajustes del catálogo" y "Categorías"** usan iconos parecidos y quedan sueltos entre exportaciones. Propuesta: reagrupar sin quitar nada.

Reorganización del panel de Herramientas en cuatro bloques claros, en este orden:

```text
Resumen        Total · Activos · Categorías · Ocultos · Favoritos
Buscar y ver   categoría · orden · vista · favoritos · solo activos + chips
Editar         Agregar servicio · Ajustes · Categorías · Catálogos · Historial
Compartir      Enlace con filtros · CSV · PDF · Accesos de clientes
```

Y en el encabezado dejo una sola fila ordenada: **Mi menú · Catálogos · Avisos · Mis clientes · Administrador**, con el mismo estilo de botón para todos.

## Detalles técnicos

- `src/components/catalog/business-tools.tsx`: estado nuevo de orden, página, tamaño de página y búsqueda; el filtrado ya existente se extiende y se corta con `slice`; agrupación por día con `Intl.DateTimeFormat`. Sin cambios de servidor: `menusAudit` ya devuelve hasta 300 movimientos.
- `src/routes/index.tsx`: reordenar los grupos del panel y quitar los botones duplicados según lo que apruebes.
- `src/components/catalog/history-dialog.tsx`: `HistoryDialog` y `AuditDialog` se fusionan en un solo diálogo con selector de alcance (solo si apruebas el punto 1); `CatalogVisibilityDialog` pasa a vivir dentro de `catalog-manager.tsx` (punto 2).
- Sin cambios en base de datos, en las tarjetas públicas ni en la vista del dueño.