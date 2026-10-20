/** Preserve the whole instruction image; store a readable copy and a small preview. */
export async function prepareGalleryImage(file: File) {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') throw new Error('Selecciona una fotografía o captura de pantalla');
  if (file.size > 15 * 1024 * 1024) throw new Error('La imagen original debe pesar menos de 15 MB');
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('No se pudo leer la imagen. Prueba con JPG o PNG.')); img.src = url;
    });
    const render = (max: number, quality: number) => {
      const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('No se pudo preparar la imagen');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', quality);
    };
    let full = render(2000, 0.88);
    if (full.length > 1_800_000) full = render(1800, 0.72);
    if (full.length > 1_800_000) full = render(1500, 0.6);
    if (full.length > 1_800_000) throw new Error('La imagen es demasiado grande; reduce su tamaño e inténtalo otra vez');
    return { image: full, thumbnail: render(180, 0.6) };
  } finally { URL.revokeObjectURL(url); }
}
