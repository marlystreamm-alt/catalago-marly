import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder con la misma silueta de una tarjeta de servicio. */
function ServiceCardSkeleton() {
  return (
    <div className="card-soft rounded-3xl border border-border/70 bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <Skeleton className="size-16 shrink-0 rounded-2xl sm:size-24" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>
      <Skeleton className="mt-3 h-3 w-full rounded-full" />
      <Skeleton className="mt-2 h-3 w-4/5 rounded-full" />
      <Skeleton className="mt-4 h-11 w-full rounded-full" />
    </div>
  );
}

/** Lista de placeholders mientras se cargan o filtran los servicios. */
export function ServiceListSkeleton({
  count = 4,
  label = "Cargando servicios…",
}: {
  count?: number;
  label?: string;
}) {
  return (
    <div className="grid gap-3" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }).map((_, i) => (
        <ServiceCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Barra sutil de progreso indeterminado para búsquedas y filtros. */
export function InlineLoader({ label = "Actualizando resultados…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
      <span className="relative block h-1 w-24 overflow-hidden rounded-full bg-muted">
        <span className="loader-sweep absolute inset-y-0 left-0 w-1/2 rounded-full bg-primary/70" />
      </span>
      {label}
    </div>
  );
}
