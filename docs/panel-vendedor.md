# Panel de vendedor MA²

Diseño basado en los dos videos proporcionados por Marla: encabezado fijo, menú lateral, fondo pastel, indicadores compactos y páginas de administración.

## Funciones conectadas

- Inventario, lotes de completas/perfiles, división de cuentas, credenciales, entrega manual y pedidos Cyberdoc reutilizan los servicios existentes.
- Duración de cuentas en meses; inicio desde compra o propuesta automática desde entrega. Los meses se ajustan al último día del mes y las fechas usan America/Monterrey.
- Inicio y ventas calculan cifras a partir del stock registrado, sin inventar datos ni duplicar costos heredados de perfiles.
- Clientes, reportes, preguntas, proveedores, avisos, preguntas frecuentes, referidos, biblioteca musical, documentos y códigos se guardan en `ma2_ops_records`. Los payloads están cifrados; las escrituras verifican versión.
- El apartado de clientes permite importar contactos de entregas existentes. Cada enlace de atención se genera con un token aleatorio; generar otro revoca el anterior. El titular puede enviar consultas/reportes/encargos y consultar sus respuestas, códigos vigentes y documentos asignados.
- Saldo y crédito son registros internos en MXN con historial inmutable. Las operaciones se serializan por cliente, exigen referencias únicas y rechazan retiros sin saldo o abonos superiores a la deuda. No transfieren dinero ni cargan una cuenta bancaria.
- Los avisos activos marcados para portada también aparecen en el catálogo público. El endpoint público devuelve exclusivamente los campos públicos de esos avisos.
- Ayudantes utiliza la administración existente del equipo de cada catálogo vendido; no concede acceso al panel principal de la administradora.
- Apariencia conserva portada, logo, imagen de tarjetas, fondo, temporada y transparencia del catálogo. Galería y entregas protegidas conservan su funcionamiento anterior.
- Música reproduce videos de YouTube guardados por la administradora. Los juegos de tres en raya y memoria se ejecutan localmente.
- Planes y suscripciones utiliza las ventas/demos/contratos de catálogos ya existentes; no modifica la facturación del proveedor de hosting.

## Conexiones externas pendientes

La carga automática de pagos bancarios, la extracción de códigos desde IMAP y la IA generativa requieren servicios y credenciales adicionales. No se simulan estas conexiones: recargas y códigos se registran manualmente, y el asistente actual realiza búsquedas y cálculos sobre registros reales. Los referidos son códigos y conteos registrados; las comisiones no se pagan automáticamente. Los pedidos por encargo requieren atención y entrega de la administradora.

## Verificación

TypeScript, build de producción, pruebas unitarias de autorización/aislamiento/fechas y verificaciones transaccionales en Postgres con rollback. Revisión visual del inicio, menú y vista móvil con una ruta temporal de datos de prueba eliminada antes de publicar. La sesión privada de producción no estuvo abierta en el navegador de pruebas; no se modificaron credenciales.
