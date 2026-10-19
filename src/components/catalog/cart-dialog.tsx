import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCatalogStore } from "@/lib/catalog/store";
import { clearCart, readCart, writeCart, type CartLine } from "@/lib/catalog/cart";
import { reportOrder } from "@/lib/notify/client";

const money = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

export function CartDialog() {
  const { catalog } = useCatalogStore();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [sending, setSending] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerWhatsapp, setCustomerWhatsapp] = useState("");

  useEffect(() => {
    const sync = () =>
      setLines(readCart().filter((line) => !line.catalogId || line.catalogId === catalog.id));
    sync();
    window.addEventListener("ma2-cart-change", sync);
    return () => window.removeEventListener("ma2-cart-change", sync);
  }, [catalog.id]);

  const total = useMemo(() => lines.reduce((n, line) => n + line.price * line.qty, 0), [lines]);

  const patch = (id: string, qty: number) => {
    const next = lines
      .map((line) => (line.id === id ? { ...line, qty } : line))
      .filter((line) => line.qty > 0);
    writeCart(next);
    setLines(next);
  };

  const send = async () => {
    if (!lines.length || sending) return;
    const digits = (catalog.whatsappNumber || "").replace(/\D/g, "");
    const phone = digits.length === 10 ? `52${digits}` : digits;
    const detail = lines
      .map(
        (line) =>
          `• ${line.qty} x ${line.name}${line.price > 0 ? ` — ${money(line.price * line.qty)}` : ""}`,
      )
      .join("\n");
    const customer = [
      customerName.trim() ? `Cliente: ${customerName.trim()}` : "",
      customerWhatsapp.trim() ? `WhatsApp del cliente: ${customerWhatsapp.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const message = `Hola, quiero hacer este pedido en ${catalog.name}:\n\n${detail}${total > 0 ? `\n\nTotal: ${money(total)}` : ""}${customer ? `\n\n${customer}` : ""}`;
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    // Abrir la ventana durante el clic para evitar que el navegador bloquee WhatsApp.
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    setSending(true);
    const saved = await reportOrder({
      catalogId: catalog.id,
      catalogName: catalog.name,
      serviceName: lines
        .map((line) => `${line.qty} x ${line.name}`)
        .join(", ")
        .slice(0, 200),
      total,
      items: lines.map((line) => ({
        name: `${line.qty} x ${line.name}`,
        price: line.price * line.qty,
      })),
      message,
      link: window.location.href,
      recipient: phone,
    });
    setSending(false);
    if (saved) {
      clearCart();
      setLines([]);
      toast.success("Pedido registrado. Se abrió WhatsApp para enviarlo.");
    } else {
      toast.error(
        "WhatsApp se abrió, pero no se pudo registrar el pedido. Intenta de nuevo con internet.",
      );
    }
  };

  if (catalog.spaceType === "directory" || catalog.spaceType === "provider") return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="relative">
          <ShoppingCart className="size-4" /> Carrito
          {lines.length ? (
            <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
              {lines.reduce((n, line) => n + line.qty, 0)}
            </span>
          ) : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Carrito · {catalog.name}</DialogTitle>
        </DialogHeader>
        {!lines.length ? (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Tu carrito está vacío.
          </p>
        ) : (
          <div className="grid gap-2">
            {lines.map((line) => (
              <div key={line.id} className="flex items-center gap-2 rounded-2xl border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{line.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {line.price > 0 ? money(line.price) : line.priceText || "Consultar"}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => patch(line.id, line.qty - 1)}
                  aria-label="Quitar uno"
                >
                  <Minus className="size-4" />
                </Button>
                <span className="w-6 text-center text-sm font-semibold">{line.qty}</span>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => patch(line.id, line.qty + 1)}
                  aria-label="Agregar uno"
                >
                  <Plus className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => patch(line.id, 0)}
                  aria-label="Eliminar"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-2xl bg-muted p-3">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-primary">
                {total > 0 ? money(total) : "Consultar"}
              </span>
            </div>
            <div className="grid gap-3 rounded-2xl border p-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="cart-customer-name">Tu nombre</Label>
                <Input
                  id="cart-customer-name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Nombre del cliente"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cart-customer-whatsapp">Tu WhatsApp</Label>
                <Input
                  id="cart-customer-whatsapp"
                  inputMode="tel"
                  value={customerWhatsapp}
                  onChange={(event) => setCustomerWhatsapp(event.target.value)}
                  placeholder="Ej. 669 123 4567"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={sending}
                onClick={() => {
                  clearCart();
                  setLines([]);
                }}
              >
                Vaciar
              </Button>
              <Button
                className="flex-1"
                disabled={
                  !catalog.whatsappNumber ||
                  sending ||
                  !customerName.trim() ||
                  !customerWhatsapp.trim()
                }
                onClick={() => void send()}
              >
                {sending ? "Registrando pedido…" : "Finalizar pedido por WhatsApp"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
