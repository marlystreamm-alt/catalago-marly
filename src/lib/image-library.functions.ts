import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

function safeName(value: string) {
  return (
    (value || "imagen")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "imagen"
  );
}

export const createImageUploadTicket = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    z
      .object({
        code: z.string().min(4).max(32),
        name: z.string().min(1).max(255),
        contentType: z.enum(imageTypes),
        size: z.number().int().positive().max(5_242_880),
      })
      .parse(value),
  )
  .handler(async ({ data }) => {
    const { requireAdminCode } = await import("@/lib/notify/notify.server");
    await requireAdminCode(data.code);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const base = safeName(data.name.replace(/\.[^.]+$/, ""));
    const extension = data.contentType === "image/jpeg" ? "jpg" : data.contentType.split("/")[1];
    const storagePath = `library/${crypto.randomUUID()}__${base}.${extension}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("ma2-images")
      .createSignedUploadUrl(storagePath, { upsert: false });

    if (error || !signed)
      throw new Error(`No se pudo preparar la imagen: ${error?.message ?? "error desconocido"}`);
    const { data: publicData } = supabaseAdmin.storage.from("ma2-images").getPublicUrl(storagePath);
    return {
      storagePath,
      uploadToken: signed.token,
      name: base,
      publicUrl: publicData.publicUrl,
    };
  });

export const deleteStoredLibraryImage = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    z
      .object({
        code: z.string().min(4).max(32),
        storagePath: z.string().regex(/^library\/[a-zA-Z0-9._-]{1,180}$/),
      })
      .parse(value),
  )
  .handler(async ({ data }) => {
    const { requireAdminCode } = await import("@/lib/notify/notify.server");
    await requireAdminCode(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage.from("ma2-images").remove([data.storagePath]);
    if (error) throw new Error(`No se pudo eliminar la imagen: ${error.message}`);
    return { ok: true as const };
  });
