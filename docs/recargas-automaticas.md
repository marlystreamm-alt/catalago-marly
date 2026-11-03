# Recargas automáticas

En el panel del vendedor, abre **Recargas → Ajustes**. Configura banco, titular, cuenta o CLABE, límites, vigencia y remitentes bancarios permitidos. No hay un banco fijo.

1. Guarda con las recargas apagadas el Gmail que recibe los avisos y una contraseña de aplicación de Google. Usa una bandeja dedicada a los avisos de esa cuenta receptora.
2. Pulsa **Probar conexión**. No se envían, modifican ni borran correos. La contraseña queda cifrada en una tabla privada y no se devuelve al navegador.
3. Activa las recargas y guarda. El lector revisa cada cinco minutos; **Revisar correo ahora** permite comprobarlo al momento. Solo se procesan correos recibidos desde que se guardaron las credenciales actuales.
4. El cliente abre su enlace privado de atención, genera una referencia y transfiere el importe exacto dentro del plazo. Si se usan centavos únicos, debe incluirlos.
5. Comprueba la primera transferencia real en **Avisos leídos**, la referencia acreditada y el saldo del cliente. Una prueba de conexión valida el acceso a Gmail; no sustituye esta primera comprobación bancaria.

El formato compatible identifica una transferencia recibida con un campo `Monto:`, `Importe:` o `Cantidad:`, una referencia de siete dígitos y una `Clave de rastreo:`. Las imágenes o cantidades decorativas se ignoran. El lector exige un remitente permitido y DKIM y DMARC válidos según los encabezados añadidos por Gmail. No acredita correos reenviados o formatos desconocidos sin coincidencia verificable. Los bancos que no exponen una referencia coincidente pueden usar centavos únicos; los avisos sin clave de rastreo requieren atención manual.

Se comprueban referencia e importe juntos; a falta de una referencia conocida, se admite una sola coincidencia de centavos únicos dentro de su vigencia. La clave de rastreo y el identificador de solicitud impiden abonos duplicados. El registro del abono y la confirmación de pago se realizan en una misma transacción.

**Avisos leídos** muestra los pagos sin coincidencia o sin autenticación para revisión. **Revisar coincidencia otra vez** conserva las mismas validaciones. No fuerza un abono. La recarga manual existente sigue disponible debajo del lector automático para casos que debas verificar por tu cuenta.

Cambiar correo, contraseña de aplicación, remitentes o cuenta cancela las referencias pendientes y exige probar la conexión nuevamente. Apagar el lector impide nuevas referencias y acreditaciones hasta reactivarlo. Los retrasos del aviso bancario pueden aumentar el tiempo de acreditación; se usa la fecha de recepción de Gmail para validar la vigencia.

## Validación

- `node --test tests/*.test.mjs`
- `npx tsc --noEmit`
- `npm run build`
- `tests/recharges.integration.sql`: prueba transaccional con registros ficticios y `ROLLBACK`. Verifica importe, regalo, duplicados, autenticación, cambios de configuración, centavos, vigencia y permisos sin conservar movimientos ficticios. Ejecutar con una cuenta administrativa de base de datos.

El ingreso del administrador y los recordatorios de pedidos no cambian.
