# Portal de compradores y tiendas por mensualidad

- Compradores de MA²: `/tienda/ma2` (también `/cuenta`).
- Contratación de tiendas: `/plataforma`; precios e instrucciones se configuran en **Ventas**. Si la venta pública está apagada, la página ofrece contacto, sin publicar precios nuevos.
- Negocios: `/acceso` → `/mi-catalogo`. Cada negocio comparte `/tienda/SU-SLUG` con sus compradores.

## Compradores

Pueden crear una cuenta con correo, WhatsApp y contraseña propia. El correo funciona como identificador de acceso; no se envía un mensaje de verificación. Las cuentas pertenecen a una sola tienda y no se enlazan automáticamente con clientes anteriores por coincidencia de correo o teléfono.

Para clientes que ya tienen saldo, la administradora usa **Clientes → Habilitar acceso a un cliente que ya tiene saldo**. Selecciona el registro correcto y asigna el correo verificado con el titular. Así se conserva el mismo historial. No deben registrarse de nuevo si ya tienen saldo en un registro anterior.

El portal contiene inicio, tienda, recargas, compras/entregas, reportes y pedidos por encargo, avisos, movimientos y cuenta. Solo ofrece compra con saldo de stock disponible, con precio positivo y credenciales completas. Las tarjetas sin precio o con credenciales pendientes siguen en el catálogo para atención manual; no se inventan precios.

Al comprar, el servidor obtiene la identidad de la sesión. La base de datos valida precio, tienda, disponibilidad, vigencia y saldo. El débito, la asignación y la copia privada de entrega se guardan en una transacción. Reintentar la misma solicitud devuelve la compra existente sin descontar dos veces. No se entregan costos ni contraseñas de paneles de proveedores.

Las instrucciones de galería de MA² aparecen cuando la plataforma de la compra coincide con la etiqueta de la imagen. No se comparten imágenes privadas de MA² con las tiendas de otros negocios.

La recuperación del comprador se atiende por WhatsApp. Tras verificar al titular, el negocio genera una contraseña temporal desde su panel; el cliente debe cambiarla al ingresar. El ingreso de la administradora no cambia.

## Vender una tienda mensual

1. Configura los planes, precios e instrucciones de pago en **Ventas** y activa la contratación pública cuando estén correctos.
2. El interesado registra su solicitud en `/contratar`.
3. Verifica el pago y marca la solicitud como **Pagado**.
4. Pulsa **Preparar tienda mensual**. Se crea una tienda con enlace propio, usuario y contraseña temporal, primer mes activo y precio de renovación tomado de la solicitud.
5. Copia el acceso y entrégalo al comprador por tu canal habitual. No se envía automáticamente un mensaje.
6. Ajusta permisos, datos, fecha de vencimiento, renovación y suspensión desde **Negocios**. El vencimiento se verifica con fecha de Monterrey. No hay cargos automáticos a tarjetas ni renovación por un pago no verificado.

Las tiendas empiezan sin productos de muestra. Cada negocio carga sus propios productos, precios y credenciales. Sus compradores, saldos y compras se separan de las demás tiendas. El panel permite acreditar pagos verificados, atender solicitudes, suspender cuentas y recuperar acceso.

**Recargas:** Gmail automático corresponde a MA² y requiere conectar la cuenta privada existente. Las tiendas vendidas reciben recargas a través de su propio soporte; su dueño verifica el pago y acredita saldo manualmente. No se reutiliza el buzón bancario de MA² para otros negocios.

## Verificación

- `node --test tests/*.test.mjs`
- `npx tsc --noEmit`
- `npm run build`
- `tests/customer-portal.integration.sql`: operaciones sintéticas con `BEGIN` y `ROLLBACK`, sin conservar cuentas ni movimientos de prueba.

Las tablas son privadas, con RLS y sin permisos de acceso público. La API del servidor aplica autorización por cliente y negocio. Las sesiones de compradores usan cookies HttpOnly, SameSite=Lax y Secure en producción; el servidor conserva únicamente el hash del token. Contraseñas con scrypt y sal independiente.
