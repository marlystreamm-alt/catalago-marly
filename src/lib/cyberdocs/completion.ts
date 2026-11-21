/** Preserve the committed document even if the separate closing transaction fails. */
export async function completeSavedDelivery<T>(
  order: T,
  complete: () => Promise<T>,
): Promise<{ order: T; completionError: string | null }> {
  try {
    return { order: await complete(), completionError: null };
  } catch {
    return {
      order,
      completionError: "Documento guardado; el pedido sigue pendiente de cierre. Puedes reintentar sin generar otro documento.",
    };
  }
}