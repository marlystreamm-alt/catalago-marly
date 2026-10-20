import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const galleryDataImage = z.string().max(1_800_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'Selecciona una imagen válida');
const auth = z.object({ code: z.string().min(4).max(100) });
const reference = auth.extend({ id: z.string().uuid() });
export type GalleryImage = { id: string; title: string; platform: string; thumbnail: string; created_at: string };
async function authorized(code: string) {
  const { requireAdminCode, admin } = await import('@/lib/notify/notify.server');
  await requireAdminCode(code);
  return admin();
}
export const galleryList = createServerFn({ method: 'POST' })
  .validator((d: unknown) => auth.extend({ platform: z.string().max(100).default(''), page: z.number().int().min(0).max(10000).default(0) }).parse(d))
  .handler(async ({ data }): Promise<{ images: GalleryImage[]; hasMore: boolean }> => {
    const db = await authorized(data.code);
    let query = db.from('ma2_platform_gallery' as any).select('id,title,platform,thumbnail,created_at').is('archived_at', null);
    if (data.platform.trim()) query = query.ilike('platform', `%${data.platform.trim()}%`);
    const result = await query.order('created_at', { ascending: false }).order('id').range(data.page * 24, data.page * 24 + 24);
    if (result.error) throw new Error('No se pudo cargar la galería');
    const rows = (result.data ?? []) as unknown as GalleryImage[];
    return { images: rows.slice(0, 24), hasMore: rows.length > 24 };
  });
export const gallerySave = createServerFn({ method: 'POST' })
  .validator((d: unknown) => auth.extend({ title: z.string().trim().min(1).max(150), platform: z.string().trim().min(1).max(100), image: galleryDataImage, thumbnail: galleryDataImage.refine(v => v.length <= 60_000, 'Vista previa demasiado grande') }).parse(d))
  .handler(async ({ data }) => {
    const db = await authorized(data.code);
    const { encryptPayload } = await import('@/lib/deliveries/deliveries.server');
    const result = await db.from('ma2_platform_gallery' as any).insert({ title: data.title, platform: data.platform, image_cipher: await encryptPayload({ image: data.image }), thumbnail: data.thumbnail }).select('id').single();
    if (result.error || !result.data) throw new Error('No se pudo guardar la imagen en la galería');
    return { ok: true as const };
  });
export const galleryGetImage = createServerFn({ method: 'POST' })
  .validator((d: unknown) => reference.parse(d))
  .handler(async ({ data }) => {
    const db = await authorized(data.code);
    const result = await db.from('ma2_platform_gallery' as any).select('image_cipher').eq('id', data.id).is('archived_at', null).maybeSingle();
    if (result.error || !result.data) throw new Error('La imagen ya no está disponible en la galería');
    const { decryptPayload } = await import('@/lib/deliveries/deliveries.server');
    const payload = await decryptPayload<{image: string}>((result.data as any).image_cipher);
    return { image: galleryDataImage.parse(payload.image) };
  });
export const galleryArchive = createServerFn({ method: 'POST' })
  .validator((d: unknown) => reference.parse(d))
  .handler(async ({ data }) => {
    const db = await authorized(data.code);
    const result = await db.from('ma2_platform_gallery' as any).update({ archived_at: new Date().toISOString() }).eq('id', data.id).is('archived_at', null).select('id').maybeSingle();
    if (result.error || !result.data) throw new Error('No se pudo retirar la imagen');
    return { ok: true as const };
  });
