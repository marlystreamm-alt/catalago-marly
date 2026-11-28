import { useState, type ReactNode } from "react";
import { ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function InventoryFilterMenu({ children, count, onClear }: { children: ReactNode; count: number; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant={count ? "default" : "outline"} size="sm" className="h-10 shrink-0 gap-1.5 px-2.5" aria-label={`Filtros${count ? ` (${count} activos)` : ""}`} title="Filtros">
          <ListFilter className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Filtros</span>
          {count > 0 && <span className="text-xs font-semibold">{count}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 max-w-[calc(100vw_-_2rem)] space-y-3 rounded-2xl" collisionPadding={12}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Filtros</h3>
          <Button type="button" size="sm" variant="ghost" disabled={!count} onClick={onClear}>Limpiar</Button>
        </div>
        <div className="space-y-3">{children}</div>
        <Button type="button" size="sm" className="w-full" onClick={() => setOpen(false)}>Listo</Button>
      </PopoverContent>
    </Popover>
  );
}
