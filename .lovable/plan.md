# Deshacer cambios de descripción antes de guardar

En la Vista Lista del administrador, cada servicio tiene un campo de descripción que se edita libremente y solo se aplica al catálogo cuando tocas "Guardar cambios". Hoy, si borras o reescribes ese texto por error, no hay forma de volver al texto anterior sin salir sin guardar (lo que también pierde el resto de las ediciones).

## Qué se agrega

- Un botón **Deshacer descripción** junto al campo de descripción de cada servicio.
- Aparece solo cuando esa descripción cambió respecto al texto guardado; si no hay cambios, no se muestra (la fila se mantiene compacta).
- Al tocarlo, ese campo vuelve al texto que está guardado en el catálogo, sin tocar ningún otro campo ni la descripción de los demás servicios.
- Toques repetidos deshacen paso a paso los cambios hechos en esa descripción durante la sesión de edición, hasta llegar al texto guardado.
- Aviso breve de confirmación ("Descripción restaurada") y actualización inmediata de la vista previa en tarjetas.
- Al guardar, el punto de referencia se actualiza: lo recién guardado pasa a ser el nuevo texto base para futuros "deshacer".

Los botones actuales ("Usar sugerida y editar" y "Quitar descripción personalizada") se conservan tal cual.

## Alcance

- Solo modo administrador, solo la Vista Lista.
- No cambia el catálogo público, las tarjetas, los precios ni ninguna otra función.

## Detalles técnicos

- Archivo: `src/components/catalog/admin-list.tsx`.
- Al cargar el catálogo en `rows` (y después de `saveAll`), se guarda un mapa `baselineDescriptions: Record<serviceId, string>` con la descripción persistida.
- Se agrega una pila por fila `descUndo: Record<serviceId, string[]>`: cada cambio de descripción desde el `Textarea` empuja el valor previo (con agrupación simple para no apilar carácter por carácter: se apila solo cuando la edición anterior fue de otro campo/fila o pasó un intervalo corto).
- El botón hace `pop()` de la pila y aplica ese valor con el `patch` existente; si la pila queda vacía, restaura `baselineDescriptions[id]`.
- Visibilidad del botón: `s.description !== (baselineDescriptions[s.id] ?? "")`.
- Filas nuevas (aún sin guardar) usan `""` como base.
