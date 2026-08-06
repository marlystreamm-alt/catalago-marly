# Unir MA² Connect dentro de MA² Menús

## Situación confirmada

Busqué "MA² Connect" desde este proyecto y **no es accesible**: solo alcanzo MA² Menús (este), MA² OS Hub (37) y Tailored Web Solutions. Eso pasa cuando el proyecto está en otro espacio de trabajo, o tiene desactivado el uso compartido entre proyectos.

Sin acceso no puedo leer su código ni copiar su contenido, así que la fusión no puede empezar todavía.

## Paso 1 — Darme acceso (lo haces tú, 1 minuto)

Abre **MA² Connect** y revisa dos cosas:

1. Que esté en el **mismo espacio de trabajo** que MA² Menús. Si no lo está: tarjeta del proyecto → menú de tres puntos → "Transferir a espacio de trabajo" y eliges el mismo.
2. Que **no** tenga bloqueado el uso compartido entre proyectos, en Configuración del proyecto → General.

Cuando lo hagas, me avisas y vuelvo a verificar el acceso.

## Paso 2 — Inventario de lo que hay allá

Ya con acceso, reviso MA² Connect y te entrego una lista clara de:

- Catálogos, servicios y precios que tenga y que aquí no existan.
- Pantallas o funciones distintas (por ejemplo su propio panel o vista de tabla).
- Si guarda datos en el navegador o en base de datos.

No copio nada hasta que apruebes esa lista, para no pisar tus catálogos actuales.

## Paso 3 — Fusión aquí

Con tu visto bueno:

- **Datos**: traigo sus servicios/catálogos y los agrego a los de aquí. Antes de mezclar, genero un respaldo JSON del estado actual de MA² Menús para poder revertir.
- **Duplicados**: si un servicio existe en ambos, te pregunto qué precio y descripción se quedan (o dejo el de MA² Menús por defecto y marco los distintos para que los revises).
- **Funciones**: si MA² Connect tiene alguna pantalla útil que aquí no está, la traigo respetando el diseño actual (lila/aqua, tarjetas, catálogo público sin controles de admin).
- **Imágenes/logos**: copio los que hagan falta.

Al final este proyecto queda como el único catálogo, publicado en catalago-marly.lovable.app, y MA² Connect lo puedes archivar o borrar cuando confirmes que todo quedó.

## Si prefieres no dar acceso

Alternativa manual: en MA² Connect exportas el respaldo JSON del catálogo, me lo subes aquí como archivo y lo importo. Funciona igual para los datos, pero no para copiar pantallas o código.

## Detalles técnicos

- El copiado entre proyectos es de una sola dirección: otro proyecto → este. Por eso la fusión se ejecuta desde aquí y no al revés.
- Los datos de este proyecto viven en `localStorage` bajo el store de catálogos; la mezcla se hará por el mismo formato de respaldo JSON que ya usa la app, sin tocar las tablas de avisos/pedidos.
- Nada se borra en MA² Connect: solo se lee.
