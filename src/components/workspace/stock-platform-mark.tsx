import { useState } from "react";
import { Tv } from "lucide-react";
import { findPlatform } from "@/lib/catalog/platforms";

export function StockPlatformMark({ name }: { name: string }) {
  const image = name.includes(" + ") ? "" : findPlatform(name)?.image;
  const [failed, setFailed] = useState("");
  return (
    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-primary">
      {image && failed !== image ? <img onError={() => setFailed(image)} src={image} alt="" loading="lazy" className="size-full object-cover" /> : <Tv className="size-4" />}
    </span>
  );
}
