# MA² Connect

Crea una aplicación web real, móvil primero, en español (México), para administrar tres catálogos separados del negocio MA²: Mis Clientes, Cyberdoc y Revendedores. Debe funcionar en Safari de iPhone mediante URL publicada, no depender de abrir archivos HTML locales.

DISEÑO:
- Fondo claro con degradado lila pastel y aqua pastel, tarjetas blancas, texto oscuro.
- Sin modo oscuro por defecto.
- Interfaz limpia, redondeada, tipo aplicación.
- Responsive para iPhone.

ACCESO:
- Vista pública para consultar servicios y usar Pedir por WhatsApp.
- Botón “Administrador”. Contraseña inicial: Artu1802.
- En modo público deben estar totalmente ocultos los controles de edición.
- El modo administrador permite todos los cambios.

CATÁLOGOS:
1) Mis Clientes — subtítulo inicial “Catálogo de servicios”.
2) Cyberdoc — subtítulo inicial “Catálogo de proveedor”.
3) Revendedores — subtítulo inicial “Precios para revendedores”.
Debe existir un selector o navegación clara entre los tres, manteniendo datos/precios independientes.

FUNCIONES OBLIGATORIAS Y REALES:
- Datos precargados desde el primer render; nunca debe mostrar 0 por un fallo de inicialización.
- Buscar.
- Filtrar por categoría.
- Mostrar solo activos.
- Estadísticas: total, activos, categorías y ocultos.
- Agregar, editar, duplicar, eliminar, activar/desactivar servicios.
- Cambiar nombre y subtítulo de cada catálogo.
- Configurar número de WhatsApp y plantilla de mensaje.
- Agregar, editar y eliminar categorías.
- En Streaming crear subsecciones configurables:
  • Perfiles (1 dispositivo)
  • Completas (3 a 4 dispositivos)
- Permitir crear más subsecciones después.
- Cada servicio debe tener: nombre, precio MXN, categoría, subsección, descripción, dispositivos, perfiles, tiempo de entrega, garantía y estado activo.
- Botón “Pedir por WhatsApp” con mensaje que incluya servicio, precio y detalles.
- Exportar e importar respaldo JSON.
- Persistencia confiable. Para la primera versión puede usar localStorage, pero debe estar encapsulado y con manejo de errores.
- Confirmaciones antes de eliminar/restaurar.
- Mensajes visuales de éxito/error.

DATOS INICIALES:
Carga un catálogo amplio con Streaming, IA/productividad, Actas, SAT, IMSS, INFONAVIT y Otros trámites. Incluye ejemplos como Netflix, Disney+, HBO Max, Prime Video, Crunchyroll, Paramount+, ViX, Apple TV+ con MLS, Fox One, Plex, MUBI, Canva, Gemini, actas de nacimiento/matrimonio/divorcio/defunción, Constancia de situación fiscal, Opinión 32-D, Cédula fiscal, NSS, Vigencia IMSS, Semanas cotizadas, Estado de cuenta INFONAVIT y CURP. Los tres catálogos deben iniciar con servicios visibles.

PRUEBAS:
- Antes de terminar, prueba el flujo completo: abrir app, entrar con Artu1802, crear un servicio, editar precio, desactivarlo, volverlo a activar, cambiar nombre del catálogo y generar enlace de WhatsApp.
- Corrige cualquier error de consola.
- No entregues una maqueta ni botones decorativos: todos los controles deben ejecutar su acción.

Usa TypeScript, componentes claros y una arquitectura fácil de ampliar. No agregues imágenes generadas ni ilustraciones innecesarias.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://catalago-marly.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/37c21fe2-6d8c-45a5-8146-b0f793779c4b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
