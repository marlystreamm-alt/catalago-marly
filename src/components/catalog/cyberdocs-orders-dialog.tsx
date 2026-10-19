import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Archive,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  Database,
  FileUp,
  History,
  KeyRound,
  Link2,
  Loader2,
  PackageCheck,
  MessageCircle,
  Monitor,
  Pencil,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Settings2,
  Smartphone,
  Webhook,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "@/lib/browser/clipboard";
import {
  cyberdocsAssignStock,
  cyberdocsClose,
  cyberdocsExportBackup,
  cyberdocsEditFinalNotes,
  cyberdocsFinalize,
  cyberdocsFinalizeMany,
  cyberdocsGetDeliveryLink,
  cyberdocsIntegrationStatus,
  cyberdocsListEvents,
  cyberdocsListOrders,
  cyberdocsListStock,
  cyberdocsManualFallback,
  cyberdocsManualDelivery,
  cyberdocsRegisterWebhook,
  cyberdocsRenewalContacted,
  cyberdocsSaveTelegramBots,
  cyberdocsReleaseStock,
  cyberdocsSetStockDecision,
  cyberdocsUpdateWhatsApp,
  cyberdocsUpdateRenewal,
} from "@/lib/cyberdocs/cyberdocs.functions";
import {
  CYBERDOCS_STATUS_TEXT,
  type CyberDocsIntegrationStatus,
  type CyberDocsOrder,
  type CyberDocsOrderEvent,
  type CyberDocsStockOption,
} from "@/lib/cyberdocs/types";
import type { DeliveryAttachment } from "@/lib/deliveries/types";
import { getPrimaryFichaTemplate, renderDeliveryFicha, loadPanelPresets, type PanelPreset } from "@/lib/delivery-fichas";
import { getSavedCode } from "@/lib/notify/client";
import { useIsMobile } from "@/hooks/use-mobile";

const errorText = (error: unknown) => (error instanceof Error ? error.message : "Ocurrió un error");
const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(
        new Date(value),
      )
    : "Sin registro";
const terminal = (order: CyberDocsOrder) =>
  ["completed", "rejected", "cancelled"].includes(order.status);
const normalizeWhatsApp = (value: string) => {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10) digits = `52${digits}`;
  if (digits.length === 13 && digits.startsWith("521")) digits = `52${digits.slice(3)}`;
  return digits.length >= 11 ? digits : "";
};
const todayDate = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });
const daysUntilDate = (value: string | null) => {
  if (!value) return null;
  const start = Date.parse(`${todayDate()}T12:00:00Z`);
  const end = Date.parse(`${value}T12:00:00Z`);
  return Math.round((end - start) / 86_400_000);
};

function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}


async function fileToAttachment(file: File): Promise<DeliveryAttachment> {
  if (file.size > 5_000_000) throw new Error("El documento debe pesar máximo 5 MB");
  const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png", "image/webp"];
  if (file.type && !allowed.includes(file.type)) throw new Error("Puedes adjuntar PDF, Word o una imagen");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer el documento"));
    reader.readAsDataURL(file);
  });
  return { name: file.name, type: file.type || "application/octet-stream", dataUrl };
}

export function CyberDocsOrdersDialog() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<CyberDocsOrder[]>([]);
  const [stock, setStock] = useState<CyberDocsStockOption[]>([]);
  const [status, setStatus] = useState<CyberDocsIntegrationStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [events, setEvents] = useState<CyberDocsOrderEvent[]>([]);
  const [stockItemId, setStockItemId] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [days, setDays] = useState(7);
  const [maxViews, setMaxViews] = useState("0");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [withPassword, setWithPassword] = useState(true);
  const [deliverySource, setDeliverySource] = useState<"stock" | "manual" | "">("");
  const [manualType, setManualType] = useState<"link" | "full" | "profile">("full");
  const [manualPlatform, setManualPlatform] = useState("");
  const [manualUsername, setManualUsername] = useState("");
  const [manualPassword, setManualPassword] = useState("");
  const [manualPin, setManualPin] = useState("");
  const [manualLink, setManualLink] = useState("");
  const [manualPanelUsername, setManualPanelUsername] = useState("");
  const [manualPanelPassword, setManualPanelPassword] = useState("");
  const [panelPresets, setPanelPresets] = useState<PanelPreset[]>(() => loadPanelPresets());
  const [manualMessage, setManualMessage] = useState("");
  const [deliveryAttachment, setDeliveryAttachment] = useState<DeliveryAttachment | null>(null);
  const [linkTemplate, setLinkTemplate] = useState("Hola {cliente} 😊 Te entrego tu servicio de {plataforma}.\n🔗 Documento: {link}\n⚠️ Soporte únicamente al número de WhatsApp 8443852364, evita perder garantía.");
  const [passwordTemplate, setPasswordTemplate] = useState("Hola {cliente} 😊\n🔐 Contraseña de tu documento protegido: {contraseña}\n🔗 El link de tu compra está disponible en la plataforma Cyberdoc.");
  const [combinedTemplate, setCombinedTemplate] = useState("Hola {cliente} 👋\nTe hago entrega de los datos correspondientes a tu compra de {plataforma}.\n🔗 Enlace: {link}\n🔐 Contraseña: {contraseña}");
  const [lastLinkMessage, setLastLinkMessage] = useState("");
  const [lastPasswordMessage, setLastPasswordMessage] = useState("");
  const [lastCombinedMessage, setLastCombinedMessage] = useState("");
  const [lastDeliveryLink, setLastDeliveryLink] = useState("");
  const [showFallback, setShowFallback] = useState(false);
  const [newBotUsername, setNewBotUsername] = useState("");
  const [newBotLabel, setNewBotLabel] = useState("");
  const [orderWhatsApp, setOrderWhatsApp] = useState("");
  const [deliveredOn, setDeliveredOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [renewalWarningDays, setRenewalWarningDays] = useState("3");
  const [orderFilter, setOrderFilter] = useState<"all" | "pending" | "in_process" | "completed">("all");
  const code = getSavedCode();
  const fillTemplate = useCallback((template: string, values: Record<string,string>) => template
    .replaceAll("{cliente}", values.cliente || "")
    .replaceAll("{plataforma}", values.plataforma || "")
    .replaceAll("{link}", values.link || "")
    .replaceAll("{contraseña}", values.contraseña || ""), []);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("ma2_delivery_message_templates") || "{}");
      if (typeof saved.link === "string" && saved.link) setLinkTemplate(saved.link);
      if (typeof saved.password === "string" && saved.password) setPasswordTemplate(saved.password);
      if (typeof saved.combined === "string" && saved.combined) setCombinedTemplate(saved.combined);
    } catch { /* usa plantillas predeterminadas */ }
  }, []);
  const saveMessageTemplates = () => {
    localStorage.setItem("ma2_delivery_message_templates", JSON.stringify({ link: linkTemplate, password: passwordTemplate, combined: combinedTemplate }));
    toast.success("Mensajes de entrega guardados");
  };

  const selected = useMemo(
    () => orders.find((order) => order.id === selectedId) || null,
    [orders, selectedId],
  );
  const selectedWhatsApp = orderWhatsApp || selected?.whatsapp ||
    (selected?.contactLabel === "WhatsApp" ? selected.contactValue : "");
  const openWhatsApp = async (message = "") => {
    const digits = normalizeWhatsApp(selectedWhatsApp);
    if (!digits) {
      if (message) await copyText(message);
      toast.info(message ? "Agrega el WhatsApp; mientras tanto el mensaje quedó copiado" : "Agrega un WhatsApp válido");
      return;
    }
    const query = message ? `?text=${encodeURIComponent(message)}` : "";
    window.open(`https://wa.me/${digits}${query}`, "_blank", "noopener,noreferrer");
  };
  const sortedStock = useMemo(() => {
    const needle = (selected?.serviceName || "").toLowerCase();
    return [...stock].sort((a, b) => {
      const aMatch = `${a.platform} ${a.accountType}`.toLowerCase().includes(needle) ? 1 : 0;
      const bMatch = `${b.platform} ${b.accountType}`.toLowerCase().includes(needle) ? 1 : 0;
      return bMatch - aMatch || a.platform.localeCompare(b.platform, "es");
    });
  }, [selected?.serviceName, stock]);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [nextOrders, nextStatus, nextStock] = await Promise.all([
        cyberdocsListOrders({ data: { code } }),
        cyberdocsIntegrationStatus({ data: { code } }),
        cyberdocsListStock({ data: { code } }),
      ]);
      setOrders(nextOrders);
      setCheckedIds((current) =>
        new Set([...current].filter((id) => nextOrders.some((order) => order.id === id && !terminal(order)))),
      );
      setStatus(nextStatus);
      setStock(nextStock);
      setSelectedId((current) =>
        current && nextOrders.some((order) => order.id === current)
          ? current
          : nextOrders[0]?.id || null,
      );
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }, [code]);

  const loadEvents = useCallback(
    async (orderId: string) => {
      try {
        setEvents(await cyberdocsListEvents({ data: { code, orderId } }));
      } catch (error) {
        toast.error(errorText(error));
      }
    },
    [code],
  );

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);
  useEffect(() => {
    if (open && selectedId) void loadEvents(selectedId);
    else setEvents([]);
    setLastLinkMessage("");
    setLastPasswordMessage("");
    setLastCombinedMessage("");
    setLastDeliveryLink("");
  }, [open, selectedId, loadEvents]);
  useEffect(() => {
    setOrderWhatsApp(
      selected?.whatsapp || (selected?.contactLabel === "WhatsApp" ? selected.contactValue : ""),
    );
  }, [selected?.id, selected?.whatsapp, selected?.contactLabel, selected?.contactValue]);
  useEffect(() => {
    setDeliveredOn(selected?.deliveredOn || selected?.finalizedAt?.slice(0, 10) || "");
    setExpiresOn(selected?.expiresOn || "");
    setRenewalWarningDays(String(selected?.renewalWarningDays ?? 3));
  }, [selected?.id, selected?.deliveredOn, selected?.expiresOn, selected?.finalizedAt, selected?.renewalWarningDays]);

  const replaceOrder = (order: CyberDocsOrder) => {
    setOrders((current) => current.map((item) => (item.id === order.id ? order : item)));
    void loadEvents(order.id);
  };

  const decide = async (assign: boolean) => {
    if (!selected) return;
    if (
      selected.stockItemId &&
      !assign &&
      !window.confirm(
        "Se liberará la cuenta asignada y se revocará su documento protegido. ¿Continuar?",
      )
    )
      return;
    setBusy(true);
    try {
      replaceOrder(
        await cyberdocsSetStockDecision({ data: { code, orderId: selected.id, assign } }),
      );
      toast.success(
        assign
          ? "Se habilitó la asignación manual desde stock"
          : "El pedido seguirá sin usar stock",
      );
      await refresh();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const deliveryMessages = async (result: { order: CyberDocsOrder; token: string; platformMessage: string; passwordMessage: string }) => {
    const deliveryId = result.order.protectedDeliveryId;
    if (!deliveryId) return;
    const absoluteLink = `${window.location.origin}/e/${deliveryId}?t=${encodeURIComponent(result.token)}`;
    const linkMessage = fillTemplate(linkTemplate, { cliente: result.order.clientName || "", plataforma: result.order.serviceName || "", link: absoluteLink, contraseña: "" });
    const passMessage = withPassword ? fillTemplate(passwordTemplate, { cliente: result.order.clientName || "", plataforma: result.order.serviceName || "", link: absoluteLink, contraseña: accessPassword }) : "";
    setLastDeliveryLink(absoluteLink);
    setLastLinkMessage(linkMessage);
    setLastPasswordMessage(passMessage);
    setLastCombinedMessage(withPassword ? fillTemplate(combinedTemplate, { cliente: result.order.clientName || "", plataforma: result.order.serviceName || "", link: absoluteLink, contraseña: accessPassword }) : "");
    toast.success(withPassword ? "Entrega creada · mensajes listos para enviar" : "Entrega sin contraseña creada · mensaje de link listo");
  };

  const copyLinkMessage = async () => {
    if (!lastLinkMessage) return toast.info("Primero crea una entrega");
    await copyText(lastLinkMessage);
    toast.success("Mensaje con link copiado");
  };
  const sendLinkWhatsApp = async () => {
    if (!lastLinkMessage) return toast.info("Primero crea una entrega");
    await openWhatsApp(lastLinkMessage);
  };
  const copyPasswordMessage = async () => {
    if (!lastPasswordMessage) return toast.info("Esta entrega no tiene contraseña");
    await copyText(lastPasswordMessage);
    toast.success("Mensaje con contraseña copiado");
  };
  const sendPasswordWhatsApp = async () => {
    if (!lastPasswordMessage) return toast.info("Esta entrega no tiene contraseña");
    await openWhatsApp(lastPasswordMessage);
  };

  const copyCombinedMessage = async () => { if (!lastCombinedMessage) return toast.info("Esta entrega no tiene enlace + contraseña"); await copyText(lastCombinedMessage); toast.success("Enlace + contraseña copiados"); };
  const sendCombinedWhatsApp = async () => { if (!lastCombinedMessage) return toast.info("Esta entrega no tiene enlace + contraseña"); await openWhatsApp(lastCombinedMessage); };

  const saveOrderWhatsApp = async () => {
    if (!selected) return;
    if (orderWhatsApp.trim() && !normalizeWhatsApp(orderWhatsApp)) return toast.error("Escribe un WhatsApp válido");
    setBusy(true);
    try {
      replaceOrder(await cyberdocsUpdateWhatsApp({ data: { code, orderId: selected.id, whatsapp: orderWhatsApp.trim() } }));
      toast.success("WhatsApp guardado para este pedido");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const saveRenewalDates = async () => {
    if (!selected) return;
    const warningDays = Number(renewalWarningDays);
    if (!Number.isInteger(warningDays) || warningDays < 0 || warningDays > 90)
      return toast.error("El aviso debe ser entre 0 y 90 días antes");
    if (deliveredOn && expiresOn && expiresOn < deliveredOn)
      return toast.error("El vencimiento no puede ser anterior a la entrega");
    setBusy(true);
    try {
      replaceOrder(await cyberdocsUpdateRenewal({
        data: { code, orderId: selected.id, deliveredOn, expiresOn, warningDays },
      }));
      toast.success(expiresOn ? "Fechas y recordatorio guardados" : "Fecha de entrega guardada");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const offerRenewal = async () => {
    if (!selected || !selected.expiresOn) return toast.info("Primero guarda la fecha de vencimiento");
    const digits = normalizeWhatsApp(selectedWhatsApp);
    const message = `Hola ${selected.clientName || ""} 😊 Tu servicio de ${selected.serviceName || "streaming"} vence el ${selected.expiresOn}. ¿Deseas renovarlo nuevamente para conservar tu acceso?`;
    if (!digits) {
      await copyText(message);
      return toast.info("El mensaje quedó copiado; agrega el WhatsApp del cliente");
    }
    try {
      replaceOrder(await cyberdocsRenewalContacted({ data: { code, orderId: selected.id } }));
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
      toast.success("Aviso de renovación registrado");
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  const assign = async () => {
    if (!selected || !stockItemId) return toast.error("Selecciona una cuenta disponible");
    if (withPassword && (accessPassword.length < 4 || accessPassword !== confirmPassword))
      return toast.error("Revisa la contraseña del documento protegido");
    setBusy(true);
    try {
      const result = await cyberdocsAssignStock({ data: {
        code, orderId: selected.id, stockItemId,
        accessPassword: withPassword ? accessPassword : "",
        withPassword,
        expiresAt: new Date(Date.now() + Math.max(1, days) * 86_400_000).toISOString(),
        maxViews: Number(maxViews) > 0 ? Number(maxViews) : null,
        notes: deliveryNotes, attachment: deliveryAttachment,
      }});
      replaceOrder(result.order);
      await deliveryMessages(result);
      setAccessPassword(""); setConfirmPassword(""); setStockItemId(""); setDeliveryNotes(""); setDeliveryAttachment(null); setDeliverySource("");
      await refresh();
    } catch (error) { toast.error(errorText(error)); } finally { setBusy(false); }
  };

  const manualDeliver = async () => {
    if (!selected) return;
    if (!manualPlatform.trim()) return toast.error("Indica la plataforma");
    if (manualType === "link" && !manualLink.trim()) return toast.error("Agrega el link");
    if (manualType !== "link" && !manualUsername.trim()) return toast.error("Agrega el correo o usuario");
    if (withPassword && (accessPassword.length < 4 || accessPassword !== confirmPassword)) return toast.error("Revisa la contraseña del documento protegido");
    setBusy(true);
    try {
      const result = await cyberdocsManualDelivery({ data: {
        code, orderId: selected.id, deliveryType: manualType, platform: manualPlatform.trim(),
        username: manualUsername, password: manualPassword, profilePin: manualPin, link: manualLink,
        panelUsername: manualPanelUsername, panelPassword: manualPanelPassword,
        accessPassword: withPassword ? accessPassword : "", withPassword,
        expiresAt: new Date(Date.now() + Math.max(1, days) * 86_400_000).toISOString(),
        maxViews: Number(maxViews) > 0 ? Number(maxViews) : null, notes: deliveryNotes, attachment: deliveryAttachment,
      }});
      replaceOrder(result.order);
      await deliveryMessages(result);
      const ficha = renderDeliveryFicha(getPrimaryFichaTemplate(), { platform: manualPlatform.trim(), username: manualUsername, password: manualPassword, profilePin: manualPin, link: manualType === "link" ? manualLink : "", panelUrl: manualType === "full" ? manualLink : "", panelUsername: manualPanelUsername, panelPassword: manualPanelPassword });
      if (ficha) { await copyText(ficha); toast.success("Entrega realizada · ficha copiada"); }
      setAccessPassword(""); setConfirmPassword(""); setDeliveryNotes(""); setDeliveryAttachment(null); setDeliverySource("");
      setManualUsername(""); setManualPassword(""); setManualPin(""); setManualLink(""); setManualPanelUsername(""); setManualPanelPassword("");
      await refresh();
    } catch (error) { toast.error(errorText(error)); } finally { setBusy(false); }
  };

  const release = async () => {
    if (
      !selected ||
      !window.confirm(
        "¿Liberar la cuenta y revocar el documento protegido? El historial permanecerá respaldado.",
      )
    )
      return;
    setBusy(true);
    try {
      replaceOrder(
        await cyberdocsReleaseStock({
          data: {
            code,
            orderId: selected.id,
            reason: "Liberación manual desde el panel CyberDocs",
          },
        }),
      );
      toast.success("Asignación liberada; el historial se conservó");
      await refresh();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const copyDocumentPassword = async (show = false) => {
    if (!selected) return;
    try {
      const result = await cyberdocsGetDeliveryLink({ data: { code, orderId: selected.id } });
      if (!result.accessPassword) return toast.info("Este documento no tiene contraseña de protección");
      if (show) window.alert(`Contraseña del documento: ${result.accessPassword}`);
      else { await copyText(result.accessPassword); toast.success("Contraseña del documento copiada"); }
    } catch (error) { toast.error(errorText(error)); }
  };

  const copyDelivery = async () => {
    if (!selected) return;
    try {
      const result = await cyberdocsGetDeliveryLink({ data: { code, orderId: selected.id } });
      await copyText(
        `${window.location.origin}/e/${result.id}?t=${encodeURIComponent(result.token)}`,
      );
      toast.success(
        result.status === "active"
          ? "Enlace protegido copiado"
          : `Enlace copiado; estado: ${result.status}`,
      );
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  const finalize = async () => {
    if (!selected) return;
    const pin = window.prompt("PIN para finalizar el pedido:", getSavedCode())?.trim();
    if (!pin) return;
    const notes = window.prompt("Nota final opcional:", selected.finalNotes || "") ?? null;
    if (
      notes === null ||
      !window.confirm(
        "¿Confirmas que el proceso terminó? Esta acción cerrará el pedido manualmente.",
      )
    )
      return;
    setBusy(true);
    try {
      replaceOrder(
        await cyberdocsFinalize({ data: { code: pin, orderId: selected.id, pin, confirm: true, notes } }),
      );
      toast.success("Pedido finalizado manualmente");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const finalizeSelected = async () => {
    const orderIds = [...checkedIds];
    if (!orderIds.length) return toast.info("Selecciona al menos un pedido pendiente");
    const pin = window.prompt("PIN para marcar los pedidos como entregados:", getSavedCode())?.trim();
    if (!pin) return;
    const notes = window.prompt(
      "Nota para los pedidos seleccionados:",
      "Entrega confirmada manualmente",
    );
    if (notes === null) return;
    if (!window.confirm(`¿Marcar ${orderIds.length} pedido${orderIds.length === 1 ? "" : "s"} como entregado${orderIds.length === 1 ? "" : "s"}?`)) return;

    setBusy(true);
    try {
      const result = await cyberdocsFinalizeMany({
        data: { code: pin, orderIds, pin, confirm: true, notes },
      });
      const replacements = new Map(result.orders.map((order) => [order.id, order]));
      setOrders((current) => current.map((order) => replacements.get(order.id) || order));
      setCheckedIds(new Set());
      setSelectedId((current) => (current && replacements.has(current) ? null : current));
      toast.success(`${result.orders.length} pedido${result.orders.length === 1 ? "" : "s"} marcado${result.orders.length === 1 ? "" : "s"} como entregado${result.orders.length === 1 ? "" : "s"}`);
      if (result.skipped) toast.info(`${result.skipped} ya estaba cerrado y no se modificó`);
      await refresh();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const closeOrder = async (kind: "rejected" | "cancelled") => {
    if (!selected) return;
    const reason = window
      .prompt(kind === "rejected" ? "Motivo del rechazo:" : "Motivo de la cancelación:", "")
      ?.trim();
    if (
      !reason ||
      !window.confirm(
        "La asignación se liberará si existe y todo quedará en el historial. ¿Continuar?",
      )
    )
      return;
    setBusy(true);
    try {
      replaceOrder(
        await cyberdocsClose({
          data: { code, orderId: selected.id, status: kind, reason, confirm: true },
        }),
      );
      toast.success(kind === "rejected" ? "Pedido rechazado" : "Pedido cancelado");
      await refresh();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const register = async () => {
    setBusy(true);
    try {
      const next = await cyberdocsRegisterWebhook({ data: { code } });
      setStatus(next);
      toast.success("Webhook de Telegram registrado y verificado");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const importFallback = async () => {
    if (manualMessage.trim().length < 20) return toast.error("Pega el mensaje completo del pedido");
    setBusy(true);
    try {
      const result = await cyberdocsManualFallback({
        data: { code, message: manualMessage.trim() },
      });
      if (result.ignored) throw new Error(result.reason || "No se reconoció el pedido");
      setManualMessage("");
      toast.success(
        result.duplicate
          ? "Ese pedido ya estaba respaldado"
          : "Pedido importado por la ruta de respaldo",
      );
      await refresh();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const backup = async () => {
    if (
      !window.confirm(
        "El respaldo contiene datos privados de pedidos. ¿Descargarlo en este dispositivo?",
      )
    )
      return;
    setBusy(true);
    try {
      const data = await cyberdocsExportBackup({ data: { code } });
      downloadJson(`ma2-cyberdocs-respaldo-${new Date().toISOString().slice(0, 10)}.json`, data);
      toast.success("Respaldo completo exportado");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const saveBots = async (bots: Array<{ username: string; label: string }>) => {
    setBusy(true);
    try {
      const next = await cyberdocsSaveTelegramBots({ data: { code, bots } });
      setStatus(next);
      setNewBotUsername("");
      setNewBotLabel("");
      toast.success("Bots de Telegram actualizados");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const addBot = () => {
    const username = newBotUsername.trim().replace(/^@/, "");
    const label = newBotLabel.trim();
    if (!username || !label) return toast.error("Escribe el usuario del bot y el nombre que verás en los avisos");
    const current = (status?.allowedBots || []).slice(1);
    if ((status?.allowedBots || []).some((bot) => bot.username.toLowerCase() === username.toLowerCase())) return toast.error("Ese bot ya está agregado");
    void saveBots([...current, { username, label }]);
  };

  const ready = Boolean(
    status?.telegramTokenConfigured &&
    status.webhookSecretConfigured &&
    status.publicUrlConfigured &&
    status.webhookRegistered,
  );
  const pending = orders.filter((order) => !terminal(order)).length;
  const visibleOrders = useMemo(() => [...orders]
    .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter((order) => orderFilter === "all" || (orderFilter === "pending" ? order.status === "new" : order.status === orderFilter)), [orders, orderFilter]);
  const selectableVisibleIds = useMemo(
    () => visibleOrders.filter((order) => !terminal(order)).map((order) => order.id),
    [visibleOrders],
  );
  const allVisibleChecked = Boolean(
    selectableVisibleIds.length && selectableVisibleIds.every((id) => checkedIds.has(id)),
  );
  const toggleAllVisible = (checked: boolean) => {
    setCheckedIds((current) => {
      const next = new Set(current);
      for (const id of selectableVisibleIds) checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl">
          <ClipboardList className="mr-1.5 size-4" /> Pedidos {pending ? `(${pending})` : ""}
        </Button>
      </DialogTrigger>
      <DialogContent className="h-[100dvh] w-screen max-w-none gap-3 overflow-y-auto rounded-none p-3 sm:h-[94vh] sm:w-[calc(100vw-1.5rem)] sm:max-w-6xl sm:rounded-3xl sm:p-6">
        <DialogHeader className="sticky top-0 z-20 -mx-3 -mt-3 border-b bg-background/95 px-4 py-3 text-left backdrop-blur sm:static sm:mx-0 sm:mt-0 sm:border-0 sm:bg-transparent sm:p-0">
          <div className="flex items-center justify-between gap-2 pr-8 sm:pr-0">
            <Button type="button" size="sm" variant="outline" className="shrink-0 rounded-full" onClick={() => setOpen(false)}>
              <ArrowLeft className="mr-1 size-4" />Regresar
            </Button>
            <Badge variant="secondary" className="shrink-0">
              {isMobile ? <Smartphone className="mr-1 size-3.5" /> : <Monitor className="mr-1 size-3.5" />}
              Vista {isMobile ? "celular" : "computadora"}
            </Badge>
          </div>
          <DialogTitle className="pt-1">Pedidos</DialogTitle>
          <DialogDescription>
            Aquí ves en orden qué llegó, de dónde, de quién es, la fecha, la hora y su estatus.
          </DialogDescription>
        </DialogHeader>

        <details className="rounded-2xl border bg-muted/20 p-3">
          <summary className="cursor-pointer text-sm font-semibold">Mensajes de entrega · Link y contraseña</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Mensaje para LINK</Label>
              <Textarea rows={5} value={linkTemplate} onChange={(e) => setLinkTemplate(e.target.value)} placeholder="Usa {cliente}, {plataforma} y {link}" />
              <p className="text-[11px] text-muted-foreground">Variables: {'{cliente}'} · {'{plataforma}'} · {'{link}'}</p>
            </div>
            <div className="grid gap-2">
              <Label>Mensaje para CONTRASEÑA</Label>
              <Textarea rows={5} value={passwordTemplate} onChange={(e) => setPasswordTemplate(e.target.value)} placeholder="Usa {cliente} y {contraseña}" />
              <p className="text-[11px] text-muted-foreground">Variables: {'{cliente}'} · {'{contraseña}'}</p>
            </div>
            <div className="grid gap-2 sm:col-span-2"><Label>Mensaje alternativo · LINK + CONTRASEÑA</Label><Textarea rows={5} value={combinedTemplate} onChange={(e) => setCombinedTemplate(e.target.value)} placeholder="Usa {cliente}, {plataforma}, {link} y {contraseña}" /><p className="text-[11px] text-muted-foreground">Variables: {'{cliente}'} · {'{plataforma}'} · {'{link}'} · {'{contraseña}'}</p></div><Button type="button" variant="outline" className="sm:col-span-2" onClick={saveMessageTemplates}>Guardar mensajes</Button>
          </div>
        </details>

        <details className="rounded-2xl border bg-muted/20 p-3">
          <summary className="cursor-pointer text-sm font-semibold">Bots y conexión de Telegram</summary>
          <section className="mt-3 grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge>
              <Webhook className="mr-1 size-3" />
              Conexión obligatoria
            </Badge>
            <Badge>
              <ClipboardList className="mr-1 size-3" />
              Recepción obligatoria
            </Badge>
            <Badge variant="secondary">
              <PackageCheck className="mr-1 size-3" />
              Asignación manual
            </Badge>
            <Badge variant="secondary">
              <Database className="mr-1 size-3" />
              Auditoría completa
            </Badge>
          </div>
          <div className="grid gap-2 text-xs sm:grid-cols-3">
            <p className="rounded-xl bg-background p-2">
              <b>Telegram:</b> {ready ? "Conectado" : "Pendiente de registrar"}
            </p>
            <p className="rounded-xl bg-background p-2">
              <b>Último evento:</b> {dateTime(status?.lastEventAt || null)}
            </p>
            <p className="rounded-xl bg-background p-2">
              <b>Último pedido:</b> {dateTime(status?.lastOrderAt || null)}
            </p>
          </div>
          <div className="rounded-xl border bg-background p-3">
            <p className="text-sm font-semibold">Bots que pueden generar avisos</p>
            <p className="mt-1 text-xs text-muted-foreground">CyberDocs permanece conectado. Aquí puedes autorizar otros bots que envíen el mismo formato de pedido.</p>
            <div className="mt-3 grid gap-2">
              {(status?.allowedBots || []).map((bot, index) => <div key={bot.username} className="flex items-center gap-2 rounded-xl bg-muted/40 p-2 text-sm"><Bot className="size-4 text-primary"/><span className="min-w-0 flex-1"><b>{bot.label}</b> · @{bot.username}</span>{index > 0 ? <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={()=>void saveBots((status?.allowedBots || []).slice(1).filter((item)=>item.username!==bot.username))}>Quitar</Button> : <Badge variant="secondary">Principal</Badge>}</div>)}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input value={newBotUsername} onChange={(event)=>setNewBotUsername(event.target.value)} placeholder="@usuario_del_bot" autoCapitalize="none" autoCorrect="off"/>
              <Input value={newBotLabel} onChange={(event)=>setNewBotLabel(event.target.value)} placeholder="Nombre, por ejemplo Ziondocs"/>
              <Button type="button" variant="outline" onClick={addBot} disabled={busy || !newBotUsername.trim() || !newBotLabel.trim()}>Agregar bot</Button>
            </div>
          </div>
          {status && !ready ? (
            <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-950">
              <p className="font-semibold">Falta completar la conexión del servidor</p>
              <p>
                Token: {status.telegramTokenConfigured ? "listo" : "falta"} · secreto:{" "}
                {status.webhookSecretConfigured ? "listo" : "falta"} · URL pública:{" "}
                {status.publicUrlConfigured ? "lista" : "falta"} · webhook:{" "}
                {status.webhookRegistered ? "registrado" : "pendiente"}.
              </p>
              {status.webhookError ? <p className="mt-1">Telegram: {status.webhookError}</p> : null}
            </div>
          ) : null}
          {status?.lastError ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {status.lastError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => void register()}
              disabled={
                busy ||
                !status?.telegramTokenConfigured ||
                !status?.webhookSecretConfigured ||
                !status?.publicUrlConfigured
              }
            >
              <KeyRound className="mr-1 size-4" />
              Registrar/verificar Telegram
            </Button>
            <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={busy}>
              <RefreshCw className="mr-1 size-4" />
              Actualizar
            </Button>
            <Button size="sm" variant="outline" onClick={() => void backup()} disabled={busy}>
              <Archive className="mr-1 size-4" />
              Exportar respaldo
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowFallback((value) => !value)}>
              Ruta de respaldo
            </Button>
          </div>
          {showFallback ? (
            <div className="grid gap-2 rounded-xl border bg-background p-3">
              <p className="text-sm font-semibold">
                Respaldo si Telegram no entrega un mensaje entre bots
              </p>
              <p className="text-xs text-muted-foreground">
                La recepción principal sigue siendo automática. Sólo si falta un pedido, pega aquí
                el mensaje completo; el ID evita duplicados.
              </p>
              <Textarea
                rows={6}
                value={manualMessage}
                onChange={(event) => setManualMessage(event.target.value)}
                placeholder="Pega aquí el mensaje completo de ‘Nuevo pedido asignado’"
              />
              <Button
                size="sm"
                className="w-fit"
                onClick={() => void importFallback()}
                disabled={busy || manualMessage.trim().length < 20}
              >
                Importar y respaldar
              </Button>
              <p className="text-[11px] text-muted-foreground">
                También queda disponible el endpoint autenticado{" "}
                <code>/api/integrations/cyberdocs/fallback</code> para un relevo automático.
              </p>
            </div>
          ) : null}
          </section>
        </details>

        <div className="-mx-3 flex flex-nowrap gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => { const target = orders.find(o => !terminal(o)); if (target) { setSelectedId(target.id); setDeliverySource("manual"); setManualPlatform(target.serviceName || ""); setManualType("full"); } else toast.info("No hay pedidos pendientes para entrega manual"); }}>Entrega manual</Button>
          {[
            ["all","Todos"],
            ["pending",`Pendientes (${orders.filter(o=>o.status==="new").length})`],
            ["in_process",`En proceso (${orders.filter(o=>o.status==="in_process").length})`],
            ["completed",`Entregadas (${orders.filter(o=>o.status==="completed").length})`],
          ].map(([key,label])=><Button key={key} size="sm" className="shrink-0" variant={orderFilter===key?"default":"outline"} onClick={()=>setOrderFilter(key as typeof orderFilter)}>{label}</Button>)}
        </div>

        {busy ? (
          <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Guardando y respaldando…
          </div>
        ) : null}

        <section className="grid gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Pedidos ({visibleOrders.length})</p>
            <Badge variant="outline">Pendientes {pending}</Badge>
          </div>
          {selectableVisibleIds.length ? (
            <div className="sticky top-[68px] z-10 grid gap-2 rounded-2xl border border-primary/30 bg-background/95 p-3 shadow-sm backdrop-blur sm:static sm:flex sm:items-center">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={allVisibleChecked}
                  onCheckedChange={(value) => toggleAllVisible(value === true)}
                  aria-label="Seleccionar todos los pedidos visibles"
                />
                Seleccionar todos los pendientes visibles
              </label>
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => void finalizeSelected()}
                disabled={busy || checkedIds.size === 0}
              >
                <PackageCheck className="mr-1 size-4" />
                Marcar entregados ({checkedIds.size})
              </Button>
              {checkedIds.size ? (
                <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={() => setCheckedIds(new Set())} disabled={busy}>
                  Limpiar selección
                </Button>
              ) : null}
            </div>
          ) : null}
          {!visibleOrders.length && !busy ? (
            <p className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">No hay pedidos en este filtro.</p>
          ) : null}

          <div className="grid gap-2 lg:grid-cols-2 lg:gap-3">
            {visibleOrders.map((order) => {
              const expanded = selectedId === order.id;
              const renewalDays = daysUntilDate(order.expiresOn);
              return (
                <article key={order.id} className={`min-w-0 rounded-2xl border bg-card transition ${expanded ? "border-primary shadow-sm lg:col-span-2" : ""}`}>
                  <div className="flex items-start gap-1 p-3">
                    {!terminal(order) ? (
                      <Checkbox
                        className="mt-0.5 shrink-0"
                        checked={checkedIds.has(order.id)}
                        onCheckedChange={(value) => setCheckedIds((current) => {
                          const next = new Set(current);
                          value === true ? next.add(order.id) : next.delete(order.id);
                          return next;
                        })}
                        aria-label={`Seleccionar pedido ${order.cyberdocsOrderId}`}
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(expanded ? null : order.id);
                        setDeliverySource("");
                        setManualPlatform(order.serviceName || "");
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{order.serviceName || "Pedido CyberDocs"}</p>
                        <p className="truncate text-xs text-muted-foreground">{order.clientName || "Cliente sin nombre"}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{order.sourceLabel || "Telegram"} · {dateTime(order.createdAt)} · {order.cyberdocsOrderId}</p>
                        {order.expiresOn ? <p className="mt-1 text-[11px] font-medium text-amber-700">Vence {order.expiresOn}{renewalDays !== null ? ` · ${renewalDays < 0 ? "vencido" : renewalDays === 0 ? "hoy" : `en ${renewalDays} día(s)`}` : ""}</p> : null}
                      </div>
                      <Badge variant={terminal(order) ? "secondary" : "default"}>{CYBERDOCS_STATUS_TEXT[order.status]}</Badge>
                    </div>
                    </button>
                  </div>

                  {expanded && selected ? (
                    <div className="grid gap-3 border-t p-3 sm:p-4">
                      <div className="grid gap-2 rounded-xl bg-muted/30 p-3 text-xs sm:grid-cols-2">
                        <p><b>Cliente:</b> {selected.clientName || "Sin nombre"}</p>
                        <p><b>Contacto original:</b> {selected.contactValue || "Sin dato"}</p>
                        <p><b>Fecha y hora:</b> {dateTime(selected.createdAt)}</p>
                        <p><b>Origen:</b> {selected.sourceLabel || "Telegram"} · @{selected.sourceKey}</p>
                        {Object.entries(selected.parsedPayload || {}).map(([k,v]) => <p key={k}><b>{k}:</b> {String(v)}</p>)}
                        <div className="grid gap-2 sm:col-span-2">
                          <Label htmlFor={`whatsapp-${selected.id}`}>WhatsApp para la entrega</Label>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Input id={`whatsapp-${selected.id}`} value={orderWhatsApp} onChange={(event) => setOrderWhatsApp(event.target.value)} placeholder="844 123 4567" inputMode="tel" />
                            <Button type="button" size="sm" variant="outline" onClick={() => void saveOrderWhatsApp()} disabled={busy}>Guardar</Button>
                            <Button type="button" size="sm" onClick={() => void openWhatsApp()} disabled={!normalizeWhatsApp(selectedWhatsApp)}><MessageCircle className="mr-1 size-4" />Abrir WhatsApp</Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground">Se llena con el número del pedido. Puedes corregirlo o agregarlo sin guardar el contacto en el teléfono.</p>
                        </div>
                      </div>

                      {!(["rejected", "cancelled"] as string[]).includes(selected.status) ? (
                        <div className="grid gap-3 rounded-xl border border-amber-300/60 bg-amber-50/50 p-3">
                          <div>
                            <p className="flex items-center gap-1.5 text-sm font-semibold"><CalendarDays className="size-4" />Entrega, vencimiento y renovación</p>
                            <p className="text-xs text-muted-foreground">El sistema revisa estas fechas cada 15 minutos y te avisa antes del vencimiento.</p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div><Label>Fecha de entrega</Label><Input type="date" value={deliveredOn} onChange={(event) => setDeliveredOn(event.target.value)} /></div>
                            <div><Label>Fecha de vencimiento</Label><Input type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} /></div>
                            <div><Label>Avisar días antes</Label><Input type="number" min={0} max={90} value={renewalWarningDays} onChange={(event) => setRenewalWarningDays(event.target.value)} /></div>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <Button type="button" size="sm" variant="outline" onClick={() => void saveRenewalDates()} disabled={busy}><CalendarDays className="mr-1 size-4" />Guardar fechas</Button>
                            {selected.status === "completed" && selected.expiresOn ? <Button type="button" size="sm" onClick={() => void offerRenewal()} disabled={busy}><MessageCircle className="mr-1 size-4" />Ofrecer renovación por WhatsApp</Button> : null}
                          </div>
                          {selected.expiresOn ? <p className="text-xs"><b>Recordatorio:</b> {daysUntilDate(selected.expiresOn) === 0 ? "vence hoy" : (daysUntilDate(selected.expiresOn) ?? 0) < 0 ? `venció hace ${Math.abs(daysUntilDate(selected.expiresOn) ?? 0)} día(s)` : `vence en ${daysUntilDate(selected.expiresOn)} día(s)`} · aviso {selected.renewalWarningDays} día(s) antes{selected.renewalStatus ? ` · ${selected.renewalStatus}` : ""}</p> : null}
                        </div>
                      ) : null}

                      {!terminal(selected) && !selected.protectedDeliveryId && !selected.stockItemId ? (
                        <div className="rounded-xl border p-3">
                          <p className="text-sm font-semibold">Entregar este pedido</p>
                          <p className="mb-3 text-xs text-muted-foreground">Elige stock o entrega manual. Todo se despliega aquí mismo y se guarda en este pedido.</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Button type="button" variant={deliverySource === "stock" ? "default" : "outline"} onClick={() => { setDeliverySource("stock"); setStockItemId(""); setWithPassword(true); setAccessPassword(""); setConfirmPassword(""); }} disabled={busy}>
                              <PackageCheck className="mr-1 size-4" />Cuentas disponibles
                            </Button>
                            <Button type="button" variant={deliverySource === "manual" ? "default" : "outline"} onClick={() => { setDeliverySource("manual"); setManualPlatform(selected.serviceName || ""); setWithPassword(true); setAccessPassword(""); setConfirmPassword(""); }} disabled={busy}>
                              Entrega manual
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      {deliverySource === "stock" && !selected.stockItemId && !selected.protectedDeliveryId && !terminal(selected) ? (
                        <div className="grid gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <Label>Cuenta disponible</Label>
                            <Select value={stockItemId} onValueChange={setStockItemId}>
                              <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                              <SelectContent>{sortedStock.map((item) => <SelectItem key={item.id} value={item.id}>{item.platform}{item.accountType ? ` · ${item.accountType}` : ""} · {item.username || "sin usuario"}</SelectItem>)}</SelectContent>
                            </Select>
                            {!sortedStock.length ? <p className="mt-1 text-xs text-destructive">No hay cuentas disponibles.</p> : null}
                          </div>

                          <div className="sm:col-span-2 space-y-2"><Label>Agregar documento desde tu celular (opcional)</Label><Input type="file" accept=".pdf,.doc,.docx,image/*" onChange={async (e) => { const file = e.target.files?.[0]; e.currentTarget.value = ""; if (!file) return; try { setDeliveryAttachment(await fileToAttachment(file)); } catch (error) { toast.error(errorText(error)); } }} />{deliveryAttachment ? <div className="flex items-center gap-2 rounded-xl border p-2 text-sm"><FileUp className="size-4" /><span className="min-w-0 flex-1 truncate">{deliveryAttachment.name}</span><Button type="button" size="sm" variant="ghost" onClick={() => setDeliveryAttachment(null)}>Quitar</Button></div> : <p className="text-[11px] text-muted-foreground">PDF, Word o imagen · máximo 5 MB.</p>}</div>
                          <div className="sm:col-span-2">
                            <p className="mb-2 text-xs font-semibold">Documento protegido · elige una opción</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <Button type="button" variant={withPassword ? "default" : "outline"} onClick={() => setWithPassword(true)}>Con contraseña</Button>
                              <Button type="button" variant={!withPassword ? "default" : "outline"} onClick={() => { setWithPassword(false); setAccessPassword(""); setConfirmPassword(""); }}>Sin contraseña</Button>
                            </div>
                          </div>
                          {withPassword ? <>
                            <div><Label>Contraseña del documento</Label><Input type="password" value={accessPassword} onChange={(e) => setAccessPassword(e.target.value)} /></div>
                            <div><Label>Confirmar contraseña</Label><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
                          </> : null}
                          <div><Label>Vigencia (días)</Label><Input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value) || 1)} /></div>
                          <div><Label>Límite de accesos</Label><Input type="number" min={0} max={1000} value={maxViews} onChange={(e) => setMaxViews(e.target.value)} placeholder="0 = sin límite" /></div>
                          <div className="sm:col-span-2"><Label>Notas del cliente</Label><Textarea value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} placeholder="⚠️ Soporte únicamente al número de WhatsApp 8443852364, evita perder garantía." /></div>
                          <Button className="sm:col-span-2" onClick={() => void assign()} disabled={busy || !stockItemId || (withPassword && (accessPassword.length < 4 || accessPassword !== confirmPassword))}>
                            <ShieldCheck className="mr-1 size-4" />Crear entrega {withPassword ? "con contraseña" : "sin contraseña"}
                          </Button>
                        </div>
                      ) : null}

                      {deliverySource === "manual" && !selected.stockItemId && !selected.protectedDeliveryId && !terminal(selected) ? (
                        <div className="grid gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <Label>Tipo de entrega</Label>
                            <div className="mt-1 grid gap-2 sm:grid-cols-3">
                              <Button type="button" size="sm" variant={manualType === "link" ? "default" : "outline"} onClick={() => setManualType("link")}>Link</Button>
                              <Button type="button" size="sm" variant={manualType === "full" ? "default" : "outline"} onClick={() => setManualType("full")}>Cuenta completa</Button>
                              <Button type="button" size="sm" variant={manualType === "profile" ? "default" : "outline"} onClick={() => setManualType("profile")}>Perfil</Button>
                            </div>
                          </div>
                          <div className="sm:col-span-2"><Label>Plataforma</Label><Input value={manualPlatform} onChange={(e) => setManualPlatform(e.target.value)} /></div>
                          {manualType === "link" ? <div className="sm:col-span-2"><Label>Link</Label><Input value={manualLink} onChange={(e) => setManualLink(e.target.value)} placeholder="https://..." /></div> : <>
                            <div><Label>Correo / usuario</Label><Input value={manualUsername} onChange={(e) => setManualUsername(e.target.value)} /></div>
                            <div><Label>Contraseña</Label><Input value={manualPassword} onChange={(e) => setManualPassword(e.target.value)} /></div>
                            {manualType === "profile" ? <div className="sm:col-span-2"><Label>Perfil / PIN</Label><Input value={manualPin} onChange={(e) => setManualPin(e.target.value)} /></div> : null}
                            {manualType === "full" ? <>
                              <div className="sm:col-span-2"><Label>Panel guardado (opcional)</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue="" onFocus={() => setPanelPresets(loadPanelPresets())} onChange={(e) => { const p = loadPanelPresets().find(x => x.id === e.target.value); if (!p) return; setManualLink(p.url); setManualPanelUsername(p.username); setManualPanelPassword(p.password); }}><option value="">Seleccionar panel…</option>{panelPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                              <div><Label>Usuario del panel</Label><Input value={manualPanelUsername} onChange={(e) => setManualPanelUsername(e.target.value)} /></div>
                              <div><Label>Contraseña del panel</Label><Input value={manualPanelPassword} onChange={(e) => setManualPanelPassword(e.target.value)} /></div>
                              <div className="sm:col-span-2"><Label>Link / panel (opcional)</Label><Input value={manualLink} onChange={(e) => setManualLink(e.target.value)} /></div>
                            </> : null}
                          </>}

                          <div className="sm:col-span-2 space-y-2"><Label>Agregar documento desde tu celular (opcional)</Label><Input type="file" accept=".pdf,.doc,.docx,image/*" onChange={async (e) => { const file = e.target.files?.[0]; e.currentTarget.value = ""; if (!file) return; try { setDeliveryAttachment(await fileToAttachment(file)); } catch (error) { toast.error(errorText(error)); } }} />{deliveryAttachment ? <div className="flex items-center gap-2 rounded-xl border p-2 text-sm"><FileUp className="size-4" /><span className="min-w-0 flex-1 truncate">{deliveryAttachment.name}</span><Button type="button" size="sm" variant="ghost" onClick={() => setDeliveryAttachment(null)}>Quitar</Button></div> : <p className="text-[11px] text-muted-foreground">PDF, Word o imagen · máximo 5 MB.</p>}</div>
                          <div className="sm:col-span-2">
                            <p className="mb-2 text-xs font-semibold">Documento protegido · elige una opción</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <Button type="button" variant={withPassword ? "default" : "outline"} onClick={() => setWithPassword(true)}>Con contraseña</Button>
                              <Button type="button" variant={!withPassword ? "default" : "outline"} onClick={() => { setWithPassword(false); setAccessPassword(""); setConfirmPassword(""); }}>Sin contraseña</Button>
                            </div>
                          </div>
                          {withPassword ? <>
                            <div><Label>Contraseña del documento</Label><Input type="password" value={accessPassword} onChange={(e) => setAccessPassword(e.target.value)} /></div>
                            <div><Label>Confirmar contraseña</Label><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
                          </> : null}
                          <div><Label>Vigencia (días)</Label><Input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value) || 1)} /></div>
                          <div><Label>Límite de accesos</Label><Input type="number" min={0} max={1000} value={maxViews} onChange={(e) => setMaxViews(e.target.value)} /></div>
                          <div className="sm:col-span-2"><Label>Notas del cliente</Label><Textarea value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} /></div>
                          <Button className="sm:col-span-2" onClick={() => void manualDeliver()} disabled={busy || (withPassword && (accessPassword.length < 4 || accessPassword !== confirmPassword))}>
                            <ShieldCheck className="mr-1 size-4" />Crear entrega manual {withPassword ? "con contraseña" : "sin contraseña"}
                          </Button>
                        </div>
                      ) : null}

                      {selected.protectedDeliveryId ? (
                        <div className="rounded-xl border border-emerald-300/50 bg-emerald-50 p-3 text-emerald-950">
                          <p className="text-sm font-semibold">Entrega vinculada a este pedido</p>
                          <p className="text-xs">Un solo documento protegido. {selected.stockItemId ? "La cuenta de stock quedó asignada automáticamente." : "Entrega manual registrada."}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => void copyDelivery()}><Link2 className="mr-1 size-4" />Copiar enlace</Button><Button size="sm" variant="outline" onClick={() => void copyDocumentPassword(true)}><KeyRound className="mr-1 size-4" />Ver contraseña</Button><Button size="sm" variant="outline" onClick={() => void copyDocumentPassword()}><Copy className="mr-1 size-4" />Copiar contraseña</Button>
                            {selected.stockItemId && !terminal(selected) ? <Button size="sm" variant="outline" onClick={() => void release()}><RotateCcw className="mr-1 size-4" />Liberar cuenta</Button> : null}
                          </div>
                        </div>
                      ) : null}

                      {lastLinkMessage ? (
                        <div className="rounded-xl border bg-background p-3">
                          <p className="mb-2 text-sm font-semibold">Mensajes de esta entrega</p>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => void copyLinkMessage()}><Copy className="mr-1 size-4" />Copiar mensaje LINK</Button>
                            <Button size="sm" variant="outline" onClick={() => void sendLinkWhatsApp()}><MessageCircle className="mr-1 size-4" />WhatsApp LINK</Button>
                            {lastPasswordMessage ? <><Button size="sm" variant="outline" onClick={() => void copyPasswordMessage()}><Copy className="mr-1 size-4" />Copiar mensaje CONTRASEÑA</Button><Button size="sm" variant="outline" onClick={() => void sendPasswordWhatsApp()}><MessageCircle className="mr-1 size-4" />WhatsApp CONTRASEÑA</Button><Button size="sm" variant="outline" onClick={() => void copyCombinedMessage()}><Copy className="mr-1 size-4" />Copiar LINK + CONTRASEÑA</Button><Button size="sm" variant="outline" onClick={() => void sendCombinedWhatsApp()}><MessageCircle className="mr-1 size-4" />WhatsApp LINK + CONTRASEÑA</Button></> : null}
                          </div>
                        </div>
                      ) : null}

                      {terminal(selected) && selected.status === "completed" ? (
                        <div className="rounded-xl border border-emerald-300/50 bg-emerald-50 p-3 text-emerald-950">
                          <p className="text-sm font-semibold">Entrega finalizada</p>
                          <p className="text-xs">Este pedido quedó en Entregadas. Puedes consultar y copiar lo necesario sin volver a procesarlo.</p>
                          <div className="mt-2 grid gap-2">
                            <div className="flex flex-wrap gap-2">
                              {selected.protectedDeliveryId ? <><Button size="sm" variant="outline" onClick={() => void copyDelivery()}><Link2 className="mr-1 size-4" />Copiar link</Button><Button size="sm" variant="outline" onClick={() => void copyDocumentPassword(true)}><KeyRound className="mr-1 size-4" />Ver contraseña</Button><Button size="sm" variant="outline" onClick={() => void copyDocumentPassword()}><Copy className="mr-1 size-4" />Copiar contraseña</Button></> : null}
                              {selected.protectedDeliveryId ? <Button size="sm" variant="outline" onClick={async () => { try { const r = await cyberdocsGetDeliveryLink({ data: { code, orderId: selected.id } }); const link = `${window.location.origin}/e/${r.id}?t=${encodeURIComponent(r.token)}`; const text = `Hola ${selected.clientName || ""} 😊 Aquí tienes tu entrega: ${link}`; await openWhatsApp(text); } catch (e) { toast.error(errorText(e)); } }}><MessageCircle className="mr-1 size-4" />WhatsApp</Button> : null}
                              {selected.protectedDeliveryId ? <Button size="sm" variant="outline" onClick={async () => { try { const r = await cyberdocsGetDeliveryLink({ data: { code, orderId: selected.id } }); window.open(`${window.location.origin}/e/${r.id}?t=${encodeURIComponent(r.token)}`, "_blank", "noopener,noreferrer"); } catch (e) { toast.error(errorText(e)); } }}><Link2 className="mr-1 size-4" />Abrir página</Button> : null}
                              <Button size="sm" variant="outline" onClick={() => toast.info(`Pedido ${selected.cyberdocsOrderId} · ${dateTime(selected.finalizedAt || selected.updatedAt)}`)}><Settings2 className="mr-1 size-4" />Configuración</Button>
                              <Button size="sm" variant="outline" onClick={async () => { const notes = window.prompt("Editar nota final:", selected.finalNotes || ""); if (notes === null) return; const pin = window.prompt("PIN para editar:", getSavedCode())?.trim(); if (!pin) return; try { replaceOrder(await cyberdocsEditFinalNotes({ data: { code: pin, orderId: selected.id, pin, notes } })); toast.success("Entrega actualizada"); } catch (e) { toast.error(errorText(e)); } }}><Pencil className="mr-1 size-4" />Editar</Button>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {!terminal(selected) ? (
                        <div className="grid gap-2 border-t pt-3 sm:flex sm:flex-wrap">
                          <Button className="w-full sm:w-auto" onClick={() => void finalize()} disabled={busy}><PackageCheck className="mr-1 size-4" />Finalizar manualmente</Button>
                          <Button className="w-full sm:w-auto" variant="outline" onClick={() => void closeOrder("rejected")}>Rechazar</Button>
                          <Button className="w-full text-destructive sm:w-auto" variant="ghost" onClick={() => void closeOrder("cancelled")}>Cancelar</Button>
                        </div>
                      ) : null}

                      <details className="rounded-xl border p-3">
                        <summary className="cursor-pointer text-xs font-semibold"><History className="mr-1 inline size-4" />Historial</summary>
                        <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">{events.map((event) => <p key={event.id} className="rounded-lg bg-muted/40 p-2 text-xs"><b>{dateTime(event.createdAt)}</b> · {event.detail || event.action}</p>)}</div>
                      </details>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
