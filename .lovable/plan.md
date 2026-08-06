# Unificar MA² Menús y MA² OS Hub

## Primero, la duda del nombre

No hay dos proyectos duplicados. En tu cuenta existen:

- **MA² Menús** (este) — los catálogos públicos con "Pedir por WhatsApp", publicado en catalago-marly.lovable.app.
- **MA² OS Hub (37)** — la plataforma interna con base de datos real: inventario, cuentas, pedidos, entregas, finanzas, usuarios, tienda.

"MA² Connect" **no es un proyecto**: es un módulo que vive dentro de MA² OS Hub (pantallas Connect, Connect Precios y Connect Revisión) pensado justamente para sincronizar precios y catálogos con esta app. Por eso aparecía ese nombre en las conversaciones.

## Sí se pueden unir — la dirección importa

MA² OS Hub tiene ~45 pantallas y su propia base de datos con datos reales (inventario, pedidos, clientes). MA² Menús guarda casi todo en el navegador (localStorage). Traer el Hub hacia acá significaría volver a crear toda su base de datos desde cero y perder sus datos: no conviene.

La unificación correcta es al revés: **MA² OS Hub se queda como la app única**, y absorbe el catálogo público de MA² Menús.

```text
   MA² Menús (catálogo público, WhatsApp)
              |
              v  se integra como sección pública
   MA² OS Hub  ->  app única (admin + catálogo + tienda)
```

## Qué haría yo desde aquí

1. Preparar un **respaldo completo** de este proyecto (los 3 catálogos, servicios, precios, categorías, subsecciones, imágenes/logos, descripciones y textos) en un archivo JSON listo para importar.
2. Dejar documentado el diseño y comportamiento del catálogo público (tarjetas, filtros, "Pedir por WhatsApp", enlaces con filtros) para reproducirlo tal cual en el Hub.
3. Añadir en el panel admin de esta app un botón claro **"Exportar para MA² OS Hub"** que genere ese JSON en un solo clic.

## Qué sigue después (en el otro proyecto)

Abres **MA² OS Hub (37)** y pides ahí: "importa el catálogo público de MA² Menús con este JSON y el mismo diseño de tarjetas". Ahí sí se puede escribir código y crear las tablas del catálogo unidas al inventario existente, de modo que el stock y los precios sean los mismos en las dos vistas.

Mientras tanto, esta app sigue publicada y funcionando igual: no se apaga nada hasta que el Hub tenga el catálogo funcionando.

## Alternativa (si prefieres no mover el Hub)

Dejar los dos como están, pero conectados: esta app deja de tener precios propios y los lee del Hub por su módulo Connect. Es menos trabajo, pero seguirías administrando en dos lugares.

## Detalles técnicos

- El copiado entre proyectos es de una sola dirección (otro proyecto → proyecto actual), por eso la fusión real se ejecuta desde MA² OS Hub.
- El export incluiría: `catalogs`, `services`, `categories`, `subsections`, preferencias de WhatsApp (número y plantilla) y descripciones personalizadas por plataforma.
- No se toca la base de datos actual de avisos/pedidos de esta app durante el paso 1-3.
