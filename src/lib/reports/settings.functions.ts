import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const admin = z.object({ code: z.string().min(4).max(1000) });
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const reportSettingsLoad = createServerFn({ method: "POST" })
  .validator((value: unknown) => admin.parse(value))
  .handler(async ({ data }) => {
    await (await import("@/lib/notify/notify.server")).requireAdminCode(data.code);
    return (await import("./settings.server")).loadReportSettings();
  });

export const reportSettingsSave = createServerFn({ method: "POST" })
  .validator((value: unknown) => admin.extend({
    settings: z.object({
      days: z.array(z.number().int().min(0).max(6)).max(7),
      from: time,
      until: time,
      requireEvidence: z.boolean(),
      allowManual: z.boolean(),
    }),
  }).parse(value))
  .handler(async ({ data }) => {
    await (await import("@/lib/notify/notify.server")).requireAdminCode(data.code);
    return (await import("./settings.server")).saveReportSettings(data.settings);
  });
