## Objetivo

Mostrar el catálogo como una tabla simple de "Plataforma / Precio", donde lo único editable es el precio.

## Qué se construye

1. **Vista de tabla** por catálogo, con columnas:
   - Plataforma (nombre + estrella de favorito + marca "oculto")
   - Precio en MXN
   - Acción (pedir por WhatsApp)
   - Checkbox de selección, para reutilizar el pedido múltiple existente

2. **Edición de precio en línea (solo administrador)**
   - Se toca el precio y se convierte en un campo numérico; Enter o ✓ guarda, Esc cancela.
   - Validación: número válido ≥ 0 en MXN; si falla, error visual y no guarda.
   - El nombre y los demás campos NO se editan aquí (para eso sigue el formulario completo).
   - Guarda con la misma función del store, así queda en historial y bitácora con precio anterior → nuevo.
   - En modo público no aparece ningún control de edición: solo lectura.

3. **Interruptor de vista** en la barra de filtros: "Tarjetas / Tabla", guardado en las preferencias por catálogo (localStorage), igual que orden y favoritos.

## Detalles técnicos

```text
src/components/catalog/service-table.tsx   (nuevo)  ← tabla + edición de precio en línea
src/lib/catalog/prefs.ts                   ← nuevo campo viewMode: "tarjetas" | "tabla"
src/routes/index.tsx                       ← selector de vista y render condicional
```

- La tabla usa `sorted`, que ya trae aplicados búsqueda, categoría, solo activos, favoritos y orden.
- Reutiliza `saveService` y `buildWhatsappLink`; no se agrega lógica de negocio nueva.
- Nota: quedó un cambio parcial en `src/routes/index.tsx` que referencia `viewMode` y `ServiceTable`; la implementación lo completa y deja el build limpio.

## Prueba antes de terminar

Cambiar a Tabla, entrar como administrador, editar un precio en línea, confirmar que se refleja en las tarjetas y en el historial, y abrir el enlace de WhatsApp desde una fila.
