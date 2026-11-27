import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const guides: Partial<Record<string, string>> = {
  inicio: "Recarga saldo, elige un servicio en Tienda y abre Mis compras para ver tu entrega.",
  tienda: "Elige un producto disponible y confirma la compra con tu saldo.",
  saldo: "Sigue las instrucciones de pago y revisa aquí si la recarga ya se acreditó.",
  compras: "Abre una compra para consultar la entrega o reportar una falla.",
  reportes: "Elige la compra, describe la falla y adjunta una captura si se solicita.",
  ayuda: "Envía una pregunta y vuelve a esta sección para ver la respuesta.",
  movimientos: "Consulta tus recargas y compras para revisar cómo cambió tu saldo.",
  cuenta: "Consulta tus datos y opciones de acceso a tu cuenta.",
};

export function CustomerOnboarding({ slug, section }: { slug: string; section: string }) {
  const storageKey = `ma2-customer-guide:${slug}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(storageKey) !== "finished");
    } catch {
      setVisible(true);
    }
  }, [storageKey]);

  const guide = guides[section];
  if (!visible || !guide) return null;
  return (
    <details key={section} className="mb-4 rounded-xl border bg-card px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium">{section === "inicio" ? "¿Primera vez? Ver guía" : "Guía rápida"}</summary>
      <p className="mt-2 text-muted-foreground">{guide}</p>
      <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={() => {
        setVisible(false);
        try {
          window.localStorage.setItem(storageKey, "finished");
        } catch {
          // The guide stays hidden for this visit.
        }
      }}>Ya conozco mi cuenta</Button>
    </details>
  );
}
