import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
/** Existing tools keep their own behavior and dialogs while also working as panel pages. */
export function ToolFrame({
  embedded,
  open,
  onOpenChange,
  trigger,
  className,
  children,
}: {
  embedded?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={embedded ? false : open} onOpenChange={onOpenChange}>
      {embedded ? (
        <section className="seller-tool space-y-4">{children}</section>
      ) : (
        <>
          <DialogTrigger asChild>{trigger}</DialogTrigger>
          <DialogContent className={className}>{children}</DialogContent>
        </>
      )}
    </Dialog>
  );
}
