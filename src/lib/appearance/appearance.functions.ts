import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeAppearance } from "./theme";
const credentials = z.object({
  code: z.string().min(4).max(100).optional(),
  ownerToken: z.string().min(10).optional(),
});
async function authorize(
  data: z.infer<typeof credentials>,
  businessId?: string,
) {
  const { supabaseAdmin: db } =
    await import("@/integrations/supabase/client.server");
  if (data.ownerToken) {
    const s = await import("@/lib/menus/menus.server");
    const ctx = await s.requireOwnerCtx(data.ownerToken);
    s.requireFeature(ctx.business, "edit_business");
    if (businessId && businessId !== ctx.business.id)
      throw new Error("No tienes acceso a este negocio");
    return { db, businessId: ctx.business.id };
  }
  const { requireAdminCode } = await import("@/lib/notify/notify.server");
  await requireAdminCode(data.code || "");
  return { db, businessId: businessId || null };
}
export const appearanceUploadTicket = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    credentials
      .extend({
        contentType: z.enum([
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
        ]),
        size: z.number().int().positive().max(5_242_880),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const { db, businessId } = await authorize(data);
    const ext =
      data.contentType === "image/jpeg"
        ? "jpg"
        : data.contentType.split("/")[1];
    const path = `branding/${businessId || "ma2"}/${crypto.randomUUID()}.${ext}`;
    const result = await db.storage
      .from("ma2-images")
      .createSignedUploadUrl(path, { upsert: false });
    if (result.error || !result.data)
      throw new Error("No se pudo preparar la imagen");
    return {
      path,
      token: result.data.token,
      url: db.storage.from("ma2-images").getPublicUrl(path).data.publicUrl,
    };
  });
export const businessSaveAppearance = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    credentials
      .extend({
        businessId: z.string().uuid(),
        appearance: z.object({
          coverImage: z.string().max(2000),
          logoImage: z.string().max(2000),
          cardImage: z.string().max(2000),
          pageImage: z.string().max(2000),
          cardOpacity: z.number().min(0).max(100),
          imageOpacity: z.number().min(0).max(100),
          season: z.enum(["normal", "halloween", "navidad", "primavera"]),
        }),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const { db } = await authorize(data, data.businessId);
    const result = await db
      .from("menu_businesses")
      .update({ appearance: normalizeAppearance(data.appearance) })
      .eq("id", data.businessId)
      .select("id")
      .maybeSingle();
    if (result.error || !result.data)
      throw new Error("No se pudo guardar la apariencia");
    return { ok: true as const };
  });
