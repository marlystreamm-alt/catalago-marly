import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Section } from "./seller-workspace";

export const SELLER_ONBOARDING_KEY = "ma2-seller-onboarding-v1";

const STEPS: Record<Section, [string, string]> = {
  home: [
    "Abre el menú del panel y entra a Inventario para cargar tu primer producto.",
    "Revisa Productos y precios. Cuando todo esté listo, usa Copiar enlace en Mi tienda web para compartirla.",
  ],
  finance: [
    "Abre Movimientos, elige Entrada o Salida e indica el importe y la cuenta donde se movió el dinero.",
    "Guarda el movimiento y confirma que aparezca en el resumen.",
  ],
  shop: [
    "Busca la plataforma y abre la edición del producto.",
    "Revisa el precio para clientes y revendedores, la visibilidad y guarda tus cambios.",
  ],
  reports: [
    "Abre el reporte pendiente y revisa la falla y la evidencia del cliente.",
    "En Ajustes puedes elegir en qué días y horarios se reciben los reportes.",
  ],
  questions: [
    "Abre una consulta pendiente, escribe tu respuesta y marca la consulta como contestada.",
    "En Preguntas frecuentes puedes guardar respuestas que quieras reutilizar.",
  ],
  expiry: [
    "Empieza por los servicios vencidos y los próximos a vencer.",
    "Abre el servicio correspondiente para avisar al cliente o registrar la renovación.",
  ],
  clients: [
    "Busca un cliente por su nombre o registra uno nuevo con los datos de contacto.",
    "Desde su ficha puedes abrir el saldo o asignarle stock.",
  ],
  wallet: [
    "Revisa la referencia y el importe antes de acreditar una recarga pendiente.",
    "Confirma el movimiento en el historial. Abre Recargas y ajustes manuales si necesitas registrar un ajuste.",
  ],
  credit: [
    "Selecciona al cliente y registra el crédito otorgado o el abono recibido.",
    "Revisa el saldo y el historial antes de registrar otro movimiento.",
  ],
  inventory: [
    "Toca Agregar stock, elige Cuenta completa o Perfil y captura los datos de la plataforma.",
    "Confirma que aparezca en Disponibles. Abre el menú del registro cuando quieras editarlo o entregarlo.",
  ],
  combos: [
    "Elige si vas a entregar perfiles o cuentas completas y selecciona los componentes disponibles.",
    "Revisa el cliente, el importe y las unidades seleccionadas antes de entregar.",
  ],
  orders: [
    "Abre el pedido en la pestaña Pedidos y revisa el servicio solicitado antes de atenderlo.",
    "Prepara la entrega y confirma que el pedido aparezca en Entregadas. Usa Finalizar pedido si el flujo te lo solicita.",
  ],
  providers: [
    "Registra al proveedor con su contacto, las plataformas que maneja y el costo de referencia.",
    "Anota las condiciones y la garantía para consultarlas al atender una falla.",
  ],
  notices: [
    "Crea un aviso, escribe el mensaje y elige su tipo y fecha de retiro.",
    "Activa Mostrar también en portada si quieres que sea visible en la tienda.",
  ],
  referrals: [
    "Selecciona al cliente que recomienda y asigna un código único.",
    "Registra la comisión acordada para tenerla como referencia.",
  ],
  helpers: [
    "Selecciona el negocio donde trabajará el ayudante y elige Crear usuario o Elegir de mis clientes.",
    "Asigna un nombre de usuario y copia su acceso con la contraseña temporal.",
  ],
  codes: [
    "Agrega el código y un título que te ayude a identificarlo.",
    "Busca el registro cuando lo necesites y compártelo por el canal que corresponda.",
  ],
  assistant: [
    "Elige una consulta sobre tu negocio dentro del Asistente.",
    "Abre el apartado correspondiente si necesitas ver el detalle de los registros.",
  ],
  songs: [
    "Agrega una canción con el título y su enlace de YouTube.",
    "Abre el registro para reproducirla desde tu biblioteca.",
  ],
  games: [
    "Toca una casilla libre para marcarla en Tres en raya.",
    "Alternen turnos hasta que alguien complete una línea de tres.",
  ],
  memory: [
    "Voltea dos fichas para buscar una pareja.",
    "Sigue hasta encontrar todas las parejas.",
  ],
  appearance: [
    "Sube tu logo o portada y elige una paleta y una temporada.",
    "Revisa la vista previa y toca Guardar portada y diseño para aplicar los cambios.",
  ],
  settings: [
    "En Notificaciones puedes revisar cómo llegan los avisos de tus pedidos.",
    "Abre Respaldos y sistema para encontrar las opciones de contacto, mensajes y vigencias.",
  ],
  documents: [
    "Agrega el documento con un título que puedas encontrar fácilmente.",
    "Revisa el archivo desde su ficha antes de usarlo en una entrega.",
  ],
  subscription: [
    "Abre la administración de planes para configurar la oferta y las instrucciones de pago.",
    "Revisa las solicitudes y confirma cada activación después de verificar el pago.",
  ],
  gallery: [
    "Elige la plataforma y guarda las imágenes de su guía de ingreso.",
    "Selecciona esa guía cuando prepares una entrega protegida.",
  ],
  deliveries: [
    "Abre la entrega protegida y revisa que corresponda al pedido que vas a enviar.",
    "Comparte el enlace con el cliente. Si tiene contraseña, envíala por separado.",
  ],
  catalogs: [
    "Abre la tienda contratada que quieras configurar y revisa su vigencia.",
    "Ajusta las funciones de acuerdo con el plan contratado y guarda los cambios.",
  ],
  extras: [
    "Elige la herramienta que necesites, como Bóveda de documentos o Entregas protegidas.",
    "Usa la flecha para regresar a Extras.",
  ],
};

export function SellerOnboardingInvite({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <section className="seller-card mb-4 flex flex-wrap items-center justify-between gap-3" aria-label="Recorrido de bienvenida">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <BookOpen className="size-4 text-primary" aria-hidden="true" />
        ¿Primera vez en el panel?
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onStart}>Ver guías</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onSkip}>Ya conozco el panel</Button>
      </div>
    </section>
  );
}

export function SellerOnboarding({ section, onFinish }: { section: Section; onFinish: () => void }) {
  return (
    <details className="seller-card mb-4" open={section === "home" || undefined}>
      <summary className="cursor-pointer rounded-md text-sm font-semibold marker:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
        <span className="ml-1 inline-flex items-center gap-2 align-middle">
          <BookOpen className="size-4 text-primary" aria-hidden="true" />
          {section === "home" ? "Primeros pasos" : "Guía rápida de este apartado"}
        </span>
      </summary>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        {STEPS[section].map((step) => <li key={step}>{step}</li>)}
      </ol>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onFinish}>
        Terminar recorrido
      </Button>
    </details>
  );
}
