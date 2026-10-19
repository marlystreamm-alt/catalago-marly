import { supabase } from "@/integrations/supabase/client";
import { createImageUploadTicket, deleteStoredLibraryImage } from "./image-library.functions";
import { getSavedCode } from "./notify/client";

export type LibraryImage = {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: string;
  storagePath: string;
};

const BUCKET = "ma2-images";
const FOLDER = "library";

function displayName(fileName: string) {
  const marker = fileName.indexOf("__");
  return (marker >= 0 ? fileName.slice(marker + 2) : fileName).replace(/\.[^.]+$/, "") || "Imagen";
}

export async function getImageLibrary(): Promise<LibraryImage[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(FOLDER, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw new Error(`No se pudo abrir la biblioteca: ${error.message}`);
  return (data || [])
    .filter((x) => x.name && x.name !== ".emptyFolderPlaceholder")
    .map((x) => {
      const storagePath = `${FOLDER}/${x.name}`;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      return {
        id: x.id || storagePath,
        name: displayName(x.name),
        dataUrl: pub.publicUrl,
        createdAt: x.created_at || "",
        storagePath,
      };
    });
}

export async function saveLibraryImage(file: File): Promise<LibraryImage> {
  if (!file.type.startsWith("image/")) throw new Error("Selecciona una imagen");
  if (file.size > 5_242_880) throw new Error("La imagen debe pesar máximo 5 MB");
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!allowedTypes.has(file.type)) throw new Error("Usa una imagen JPEG, PNG, WebP o GIF");
  const code = getSavedCode();
  if (!code) throw new Error("Primero valida tu PIN de seguridad en Configuración");
  const {
    uploadToken,
    storagePath,
    name: base,
  } = await createImageUploadTicket({
    data: { code, name: file.name, contentType: file.type, size: file.size },
  });
  const { error } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(storagePath, uploadToken, file, {
      cacheControl: "3600",
      contentType: file.type,
    });
  if (error) throw new Error(`No se pudo guardar en Supabase: ${error.message}`);
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return {
    id: storagePath,
    name: base,
    dataUrl: pub.publicUrl,
    createdAt: new Date().toISOString(),
    storagePath,
  };
}

export async function deleteLibraryImage(image: LibraryImage) {
  const code = getSavedCode();
  if (!code) throw new Error("Primero valida tu PIN de seguridad en Configuración");
  await deleteStoredLibraryImage({ data: { code, storagePath: image.storagePath } });
}
