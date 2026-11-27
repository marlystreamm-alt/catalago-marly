import { useEffect, useState, type ReactNode } from "react";
import { mainAppearanceLoad } from "@/lib/appearance/main-store.functions";
import { appearanceStyle, normalizeAppearance } from "@/lib/appearance/theme";
import { useMa2Appearance } from "@/hooks/use-ma2-appearance";

export function StoreBusinessPage({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const [appearance, setAppearance] = useState(() => normalizeAppearance({}));
  useMa2Appearance(appearance);
  useEffect(() => {
    let active = true;
    void mainAppearanceLoad().then((next) => {
      if (active) setAppearance(normalizeAppearance(next));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  return (
    <main className="buyer-app seller-app ma2-unified" style={appearanceStyle(appearance)} data-season={appearance.season}>
      <header className="buyer-top flex-wrap">
        <a href="/" className="flex min-w-0 items-center gap-2 text-sm font-bold">
          <span className="seller-logo">
            {appearance.logoImage ? <img src={appearance.logoImage} alt="" className="size-full object-contain" /> : "MA²"}
          </span>
          Mi tienda MA²
        </a>
        {actions && <nav aria-label="Accesos MA²" className="flex flex-wrap gap-1">{actions}</nav>}
      </header>
      {children}
    </main>
  );
}
