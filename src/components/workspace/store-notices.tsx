import { useEffect, useState } from "react";
import { storeNotices } from "@/lib/workspace/operations.functions";
export function StoreNotices() {
  const [notices, setNotices] = useState<Awaited<ReturnType<typeof storeNotices>>>([]);
  useEffect(() => {
    let active = true;
    void storeNotices()
      .then((data) => {
        if (active) setNotices(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return notices.length ? (
    <section aria-label="Avisos de la tienda" className="mt-4 space-y-3">
      {notices.map((n) => (
        <article key={n.id} className="rounded-2xl border border-primary/20 bg-card p-4">
          <h2 className="font-bold text-sm">
            {n.kind === "Urgente" ? "🚨" : n.kind === "Promoción" ? "🎁" : "📢"} {n.title}
          </h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{n.message}</p>
        </article>
      ))}
    </section>
  ) : null;
}
