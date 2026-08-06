# Unir MA² Menús dentro de MA² Connect

## Aclaración del nombre

Ya lo confirmé revisando ambos proyectos: **este proyecto es MA² Connect** (los catálogos Mis Clientes / Cyberdoc / Revendedores, con tarjetas, "Pedir por WhatsApp", avisos de pedidos y accesos de clientes). No fue un duplicado ni un error: se ve como nuevo en tu lista porque cambió de nombre.

**MA² Menús** es un proyecto distinto y con contenido propio. Al leerlo encontré que es otra aplicación:

- Sirve **menús de varios negocios**, cada uno con su propia página pública (`/m/nombre-del-negocio`).
- Tiene panel de negocios, formulario de negocio, editor de menú y panel de WhatsApp.
- Guarda los menús en **base de datos** (tablas de categorías y platillos por negocio), no en el navegador.
- Entrada por **código de acceso** por negocio, con colores de marca (menta, durazno, lavanda, carbón).

O sea: MA² Connect es tu catálogo de servicios; MA² Menús es un sistema de menús para otros negocios. Se pueden juntar, pero es una fusión de dos apps distintas, no de dos copias.

## Cómo quedaría unido

MA² Connect se vuelve la app única, con una sección nueva de Menús de negocios:

```text
MA² Connect (esta app)
├── Catálogos          -> lo de hoy, sin cambios
└── Negocios (nuevo)   -> lista de negocios + editor de menú
    └── /m/{negocio}   -> menú público de cada negocio
```

## Plan por etapas

**Etapa 1 — Base de datos**
Crear en el backend de este proyecto las tablas de negocios, categorías de menú y platillos, con sus permisos y protección de acceso. Nada de lo actual (catálogos, pedidos, avisos) se toca.

**Etapa 2 — Panel de negocios**
Traer las pantallas de MA² Menús: lista de negocios, alta/edición de negocio, editor de menú (categorías, platillos, precio, foto, disponible) y ajustes de WhatsApp. Se adaptan al diseño actual lila/aqua de esta app, no al suyo.

**Etapa 3 — Página pública del menú**
Crear la ruta `/m/{negocio}` con el menú público de cada negocio y su botón de pedido por WhatsApp.

**Etapa 4 — Accesos**
Unificar la entrada: el administrador entra con su contraseña actual, y los dueños de negocio entran con su clave desde el botón "Mi menú" que ya existe aquí, reutilizando los permisos que ya tienes.

**Etapa 5 — Traer tus datos**
Los negocios y menús que ya tengas cargados en MA² Menús viven en la base de datos de ese proyecto, y esa base no se puede copiar desde aquí. Los pasamos con un respaldo: en MA² Menús exportas o me pasas la lista, y aquí los cargo. Si son pocos negocios es rápido; si son muchos te preparo una pantalla de importación.

## Antes de empezar, dime

1. ¿Cuántos negocios y menús tienes cargados hoy en MA² Menús? Eso define si la migración de datos es a mano o con importador.
2. ¿Quieres las 4 primeras etapas de una vez, o empezamos solo por el panel de negocios y el menú público y lo demás después?

Sugerencia: hacerlo por etapas. Es mucho trabajo para un solo cambio y así puedes revisar cada parte funcionando antes de seguir.

## Detalles técnicos

- El copiado entre proyectos es de una sola dirección (otro proyecto → este), por eso la fusión se ejecuta aquí y MA² Menús solo se lee; allá no se borra ni se modifica nada.
- MA² Menús usa `subscription_id` para separar los datos de cada negocio; aquí se replica ese aislamiento con políticas de acceso por negocio.
- Su tipo `MenuItem` incluye precio numérico y precio en texto libre; se conserva igual para no perder los precios escritos a mano.
- Los catálogos actuales seguirán en el almacenamiento del navegador como hoy; esta fusión no los migra a base de datos.
