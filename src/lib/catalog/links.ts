import type { CatalogId } from "./types";

export interface ShareFilters {
  q?: string;
  categoria?: string;
  activos?: boolean;
  fav?: boolean;
  orden?: string;
  /** Servicio específico que se abrirá con su detalle listo para pedir. */
  svc?: string;
}

/** Construye un enlace público con catálogo, filtros y servicio opcional. */
export function buildCatalogLink(catalogId: CatalogId, filters: ShareFilters = {}) {
  const params = new URLSearchParams({ cat: catalogId });
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.categoria) params.set("categoria", filters.categoria);
  if (filters.activos) params.set("activos", "1");
  if (filters.fav) params.set("fav", "1");
  if (filters.orden && filters.orden !== "categoria") params.set("orden", filters.orden);
  if (filters.svc) params.set("svc", filters.svc);
  const origin =
    typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "/";
  return `${origin}?${params.toString()}`;
}

/** Enlace directo a un servicio, conservando los filtros actuales de la URL. */
export function buildServiceLink(catalogId: CatalogId, serviceId: string) {
  const current =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  current.set("cat", catalogId);
  current.set("svc", serviceId);
  const origin =
    typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "/";
  return `${origin}?${current.toString()}`;
}
