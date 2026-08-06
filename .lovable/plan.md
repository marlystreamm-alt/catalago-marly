# Unir MA² Menús dentro de MA² Connect

## Aclaración del nombre

Ya lo confirmé revisando ambos proyectos: **este proyecto es MA² Connect** (los catálogos Mis Clientes / Cyberdoc / Revendedores, con tarjetas, "Pedir por WhatsApp", avisos de pedidos y accesos de clientes). No fue un duplicado ni un error: se ve como nuevo en tu lista porque cambió de nombre.

**MA² Menús** es un proyecto distinto y con contenido propio. Al leerlo encontré que es otra aplicación:

- Sirve **menús de varios negocios**, cada uno con su propia página pública (`/m/nombre-del-negocio`).
- Tiene panel de negocios, formulario de negocio, editor de menú y panel de WhatsApp.
- Guarda los menús en **base de datos** (tablas de categorías y platillos por negocio), no en el navegador.
- Entrada por **código de acceso** por negocio, con colores de marca (menta, durazno, lavanda, carbón).

O sea: MA² Connect es tu catálogo de servicios; MA² Menús es un sistema de menús para otros negocios. Se pueden juntar, pero es una fusión de dos apps distintas, no de dos copias.

## Cómo quedaría unido (solo administrador)

Menús entra como un **apartado exclusivo del modo administrador**. El público no lo ve ni puede llegar a él: sigue viendo únicamente el catálogo tal como está hoy.

```text
MA² Connect (esta app)
├── Catálogo público      -> lo de hoy, sin cambios
└── Modo administrador
    ├── Catálogos          -> lo de hoy
    └── Menús (nuevo)      -> negocios + editor de menú
```

El botón "Menús" aparece solo cuando la sesión de administrador está activa, junto a las demás herramientas. Si alguien escribe la dirección a mano sin ser administrador, se le regresa al catálogo.

## Plan por etapas

**Etapa 1 — Base de datos**
Crear en el backend de este proyecto las tablas de negocios, categorías de menú y platillos, con permisos cerrados: nada de lectura pública, todo pasa por el servidor validando que sea el administrador. Nada de lo actual (catálogos, pedidos, avisos) se toca.

**Etapa 2 — Apartado Menús en el administrador**
Traer las pantallas de MA² Menús: lista de negocios, alta/edición de negocio y editor de menú (categorías, platillos, precio, foto, disponible). Se adaptan al diseño actual lila/aqua de esta app, no al suyo. Todo vive dentro del panel de administrador.

**Etapa 3 — Traer tus datos**
Los negocios y menús que ya tengas cargados en MA² Menús viven en la base de datos de ese proyecto, y esa base no se puede copiar desde aquí. Los pasamos con un respaldo: en MA² Menús exportas o me pasas la lista, y aquí los cargo. Si son pocos negocios es rápido; si son muchos te preparo una pantalla de importación.

## Antes de empezar, dime

1. Los menús de cada negocio, ¿los usas solo tú desde el administrador, o alguna vez tendrán que verlos los clientes de esos negocios? Si es solo para ti, no hago ninguna página pública de menú.
2. ¿Cuántos negocios y menús tienes cargados hoy en MA² Menús? Eso define si la migración de datos es a mano o con importador.


## Detalles técnicos

- El copiado entre proyectos es de una sola dirección (otro proyecto → este), por eso la fusión se ejecuta aquí y MA² Menús solo se lee; allá no se borra ni se modifica nada.
- MA² Menús usa `subscription_id` para separar los datos de cada negocio; aquí se replica ese aislamiento con políticas de acceso por negocio.
- Su tipo `MenuItem` incluye precio numérico y precio en texto libre; se conserva igual para no perder los precios escritos a mano.
- Los catálogos actuales seguirán en el almacenamiento del navegador como hoy; esta fusión no los migra a base de datos.
