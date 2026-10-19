import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  CyberDocsIntegrationStatus,
  CyberDocsOrder,
  CyberDocsOrderEvent,
  CyberDocsStockOption,
  TelegramOrderBot,
} from "./types";

const code = z.string().min(4).max(100);
const adminInput = z.object({ code });
const orderInput = adminInput.extend({ orderId: z.string().uuid() });

async function authorize(value: string) {
  const { requireAdminCode } = await import("@/lib/notify/notify.server");
  await requireAdminCode(value);
}

export const cyberdocsIntegrationStatus = createServerFn({ method: "POST" })
  .validator((value: unknown) => adminInput.parse(value))
  .handler(async ({ data }): Promise<CyberDocsIntegrationStatus> => {
    await authorize(data.code);
    const server = await import("./cyberdocs.server");
    return server.getCyberDocsIntegrationStatus();
  });

export const cyberdocsRegisterWebhook = createServerFn({ method: "POST" })
  .validator((value: unknown) => adminInput.parse(value))
  .handler(async ({ data }): Promise<CyberDocsIntegrationStatus> => {
    await authorize(data.code);
    const server = await import("./cyberdocs.server");
    return server.registerCyberDocsWebhook();
  });

export const cyberdocsSaveTelegramBots = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    adminInput.extend({
      bots: z.array(z.object({
        username: z.string().trim().regex(/^@?[A-Za-z0-9_]{5,32}$/, "Usuario de Telegram no válido"),
        label: z.string().trim().min(1).max(80),
      })).max(10),
    }).parse(value),
  )
  .handler(async ({ data }): Promise<CyberDocsIntegrationStatus> => {
    await authorize(data.code);
    const server = await import("./cyberdocs.server");
    return server.saveAdditionalTelegramBots(data.bots as TelegramOrderBot[]);
  });

export const cyberdocsListOrders = createServerFn({ method: "POST" })
  .validator((value: unknown) => adminInput.parse(value))
  .handler(async ({ data }): Promise<CyberDocsOrder[]> => {
    await authorize(data.code);
    const server = await import("./cyberdocs.server");
    return server.listCyberDocsOrders();
  });

export const cyberdocsListEvents = createServerFn({ method: "POST" })
  .validator((value: unknown) => orderInput.parse(value))
  .handler(async ({ data }): Promise<CyberDocsOrderEvent[]> => {
    await authorize(data.code);
    const server = await import("./cyberdocs.server");
    return server.listCyberDocsOrderEvents(data.orderId);
  });

export const cyberdocsListStock = createServerFn({ method: "POST" })
  .validator((value: unknown) => adminInput.parse(value))
  .handler(async ({ data }): Promise<CyberDocsStockOption[]> => {
    await authorize(data.code);
    const server = await import("./cyberdocs.server");
    return server.listAvailableStock();
  });

export const cyberdocsSetStockDecision = createServerFn({ method: "POST" })
  .validator((value: unknown) => orderInput.extend({ assign: z.boolean() }).parse(value))
  .handler(async ({ data }): Promise<CyberDocsOrder> => {
    await authorize(data.code);
    const server = await import("./cyberdocs.server");
    return server.setStockDecision(data.orderId, data.assign);
  });

export const cyberdocsUpdateWhatsApp = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    orderInput.extend({ whatsapp: z.string().trim().max(40) }).parse(value),
  )
  .handler(async ({ data }): Promise<CyberDocsOrder> => {
    await authorize(data.code);
    const server = await import("./cyberdocs.server");
    return server.updateOrderWhatsApp(data.orderId, data.whatsapp);
  });

export const cyberdocsAssignStock = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    orderInput
      .extend({
        stockItemId: z.string().uuid(),
        accessPassword: z.string().max(200).default(""),
        expiresAt: z.string().datetime(),
        maxViews: z.number().int().min(1).max(1000).nullable(),
        notes: z.string().max(2000).default(""),
        withPassword: z.boolean().default(true),
        attachment: z.object({ name: z.string().min(1).max(240), type: z.string().max(160).default("application/octet-stream"), dataUrl: z.string().max(8_000_000) }).nullable().default(null),
      })
      .parse(value),
  )
  .handler(async ({ data }): Promise<{ order: CyberDocsOrder; token: string; platformMessage: string; passwordMessage: string }> => {
    await authorize(data.code);
    const server = await import("./cyberdocs.server");
    return server.assignStockToOrder(data);
  });


export const cyberdocsManualDelivery = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    orderInput.extend({
      deliveryType: z.enum(["link", "full", "profile"]),
      platform: z.string().min(1).max(120),
      username: z.string().max(250).default(""),
      password: z.string().max(1000).default(""),
      profilePin: z.string().max(100).default(""),
      link: z.string().max(2000).default(""),
      panelUsername: z.string().max(250).default(""),
      panelPassword: z.string().max(1000).default(""),
      accessPassword: z.string().max(200).default(""),
      withPassword: z.boolean().default(true),
      expiresAt: z.string().datetime(),
      maxViews: z.number().int().min(1).max(1000).nullable(),
      notes: z.string().max(2000).default(""),
      attachment: z.object({ name: z.string().min(1).max(240), type: z.string().max(160).default("application/octet-stream"), dataUrl: z.string().max(8_000_000) }).nullable().default(null),
    }).parse(value),
  )
  .handler(async ({ data }): Promise<{ order: CyberDocsOrder; token: string; platformMessage: string; passwordMessage: string }> => {
    await authorize(data.code);
    const server = await import("./cyberdocs.server");
    return server.createManualDeliveryForOrder(data);
  });

export const cyberdocsReleaseStock = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    orderInput.extend({ reason: z.string().max(1000).default("") }).parse(value),
  )
  .handler(async ({ data }): Promise<CyberDocsOrder> => {
    await authorize(data.code);
    const server = await import("./cyberdocs.server");
    return server.releaseStockAssignment(
      data.orderId,
      "Administradora",
      data.reason || "Asignación liberada manualmente",
    );
  });

export const cyberdocsFinalize = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    orderInput
      .extend({ pin: z.string().min(4).max(100), confirm: z.literal(true), notes: z.string().max(2000).default("") })
      .parse(value),
  )
  .handler(async ({ data }): Promise<CyberDocsOrder> => {
    await authorize(data.code);
    const server = await import("./cyberdocs.server");
    return server.finalizeCyberDocsOrder(data.orderId, data.notes, "Administradora", data.pin);
  });

export const cyberdocsFinalizeMany = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    adminInput.extend({
      orderIds: z.array(z.string().uuid()).min(1).max(250),
      pin: z.string().min(4).max(100),
      confirm: z.literal(true),
      notes: z.string().max(2000).default(""),
    }).parse(value),
  )
  .handler(async ({ data }): Promise<{ orders: CyberDocsOrder[]; skipped: number }> => {
    await authorize(data.code);
    const server = await import("./cyberdocs.server");
    return server.finalizeCyberDocsOrders(data.orderIds, data.notes, "Administradora", data.pin);
  });

const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal(""));

export const cyberdocsUpdateRenewal = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    orderInput.extend({
      deliveredOn: dateValue,
      expiresOn: dateValue,
      warningDays: z.number().int().min(0).max(90),
    }).parse(value),
  )
  .handler(async ({ data }): Promise<CyberDocsOrder> => {
    await authorize(data.code);
    const server = await import("./cyberdocs.server");
    return server.updateOrderRenewal({
      orderId: data.orderId,
      deliveredOn: data.deliveredOn,
      expiresOn: data.expiresOn,
      warningDays: data.warningDays,
    });
  });

export const cyberdocsRenewalContacted = createServerFn({ method: "POST" })
  .validator((value: unknown) => orderInput.parse(value))
  .handler(async ({ data }): Promise<CyberDocsOrder> => {
    await authorize(data.code);
    const server = await import("./cyberdocs.server");
    return server.markOrderRenewalContacted(data.orderId);
  });


export const cyberdocsEditFinalNotes = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    orderInput.extend({ pin: z.string().min(4).max(100), notes: z.string().max(2000).default("") }).parse(value),
  )
  .handler(async ({ data }): Promise<CyberDocsOrder> => {
    await authorize(data.code);
    const server = await import("./cyberdocs.server");
    return server.editFinalNotes(data.orderId, data.notes, "Administradora", data.pin);
  });

export const cyberdocsClose = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    orderInput
      .extend({
        status: z.enum(["rejected", "cancelled"]),
        reason: z.string().min(3).max(2000),
        confirm: z.literal(true),
      })
      .parse(value),
  )
  .handler(async ({ data }): Promise<CyberDocsOrder> => {
    await authorize(data.code);
    const server = await import("./cyberdocs.server");
    return server.closeCyberDocsOrder(data.orderId, data.status, data.reason);
  });

export const cyberdocsGetDeliveryLink = createServerFn({ method: "POST" })
  .validator((value: unknown) => orderInput.parse(value))
  .handler(async ({ data }): Promise<{ id: string; token: string; status: string; accessPassword: string }> => {
    await authorize(data.code);
    const server = await import("./cyberdocs.server");
    return server.getProtectedDeliveryTokenForOrder(data.orderId);
  });

export const cyberdocsManualFallback = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    adminInput.extend({ message: z.string().min(20).max(20_000) }).parse(value),
  )
  .handler(async ({ data }) => {
    await authorize(data.code);
    const server = await import("./cyberdocs.server");
    const nonce = crypto.randomUUID();
    return server.ingestCyberDocsOrder({
      source: "manual_fallback",
      eventKey: `manual:${nonce}`,
      rawMessage: data.message,
      senderUsername: "manual_admin",
      rawPayload: {
        source: "manual_fallback",
        importedAt: new Date().toISOString(),
        nonce,
        message: data.message,
      },
    });
  });

export const cyberdocsExportBackup = createServerFn({ method: "POST" })
  .validator((value: unknown) => adminInput.parse(value))
  .handler(async ({ data }) => {
    await authorize(data.code);
    const server = await import("./cyberdocs.server");
    return server.buildCyberDocsBackup();
  });
