/** Shared neutral entry screen: never renders either workspace before access resolves. */
export function AccessLoading() {
  return (
    <main className="seller-app grid min-h-dvh place-items-center p-6" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-cyan-400 via-violet-400 to-pink-400 text-2xl font-extrabold text-white shadow-lg">MA²</span>
        <span className="size-6 rounded-full border-2 border-primary/20 border-t-primary motion-safe:animate-spin" aria-hidden="true" />
        <p className="text-sm font-medium text-muted-foreground">Abriendo MA²…</p>
      </div>
    </main>
  );
}
