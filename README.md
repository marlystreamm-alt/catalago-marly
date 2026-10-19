# MA² Connect

Catálogos públicos, carrito y herramientas privadas de administración.

La vista pública muestra dos tarjetas por fila, también en celular. La autenticación administrativa se valida en el servidor; la recuperación por correo verifica la cuenta autorizada antes de modificar la contraseña.

## Desarrollo

```sh
npm ci
npm run dev
npm run build
```

El despliegue usa TanStack Start y Netlify. Las credenciales privadas se configuran como variables del alojamiento; no deben guardarse en este repositorio.
