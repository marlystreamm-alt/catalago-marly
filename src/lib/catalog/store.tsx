import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  ensureAuthRecord,
  resetWithRecoveryCode,
  rotatePassword,
  verifyPassword,
} from "./auth";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type CatalogPrefs, type PrefsMap } from "./prefs";
import { createSeedState } from "./seed";
import { loadState, normalizeState, saveState } from "./storage";
import {
  CATALOG_IDS,
  MAX_LOG_ENTRIES,
  type AppState,
  type Catalog,
  type CatalogId,
  type Category,
  type LogAction,
  type LogEntry,
  type Service,
  type Subsection,
} from "./types";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const entry = (
  action: LogAction,
  target: string,
  summary: string,
  user = "Administrador",
): LogEntry => ({
  id: newId(),
  at: new Date().toISOString(),
  action,
  target,
  summary,
  user,
});


interface StoreValue {
  state: AppState;
  hydrated: boolean;
  catalogId: CatalogId;
  catalog: Catalog;
  visibleCatalogIds: CatalogId[];
  setCatalogId: (id: CatalogId) => void;
  isAdmin: boolean;
  mustChangePassword: boolean;
  login: (password: string) => Promise<boolean>;
  changePassword: (
    current: string,
    next: string,
  ) => Promise<{ ok: boolean; error?: string; recoveryCode?: string }>;
  resetPassword: (
    code: string,
    next: string,
  ) => Promise<{ ok: boolean; error?: string; recoveryCode?: string }>;
  logout: () => void;
  prefs: CatalogPrefs;
  setPrefs: (patch: Partial<CatalogPrefs>) => void;
  resetPrefs: () => void;
  updateCatalog: (patch: Partial<Omit<Catalog, "id" | "log">>) => void;
  toggleCatalogHidden: (id: CatalogId) => void;
  saveService: (service: Omit<Service, "id"> & { id?: string }) => void;
  duplicateService: (id: string) => void;
  deleteService: (id: string) => void;
  toggleService: (id: string) => void;
  toggleFavorite: (id: string) => void;
  saveCategory: (category: { id?: string; name: string }) => void;
  deleteCategory: (id: string) => void;
  saveSubsection: (categoryId: string, sub: { id?: string; name: string }) => void;
  deleteSubsection: (categoryId: string, subId: string) => void;
  clearLog: () => void;
  auditLog: (LogEntry & { catalogId: CatalogId; catalogName: string })[];

  exportBackup: () => void;
  importBackup: (json: string) => boolean;
  resetAll: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => createSeedState());
  const [hydrated, setHydrated] = useState(false);
  const [catalogId, setCatalogIdRaw] = useState<CatalogId>("clientes");
  const [isAdmin, setIsAdmin] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [prefsMap, setPrefsMap] = useState<PrefsMap>(() => loadPrefs());

  useEffect(() => {
    setState(loadState());
    setPrefsMap(loadPrefs());
    setHydrated(true);
    void ensureAuthRecord();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    savePrefs(prefsMap);
  }, [prefsMap, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const result = saveState(state);
    if (!result.ok && result.error) {
      toast.error("No se pudo guardar en este dispositivo");
    }
  }, [state, hydrated]);

  const visibleCatalogIds = useMemo(() => {
    if (isAdmin) return CATALOG_IDS;
    const shown = CATALOG_IDS.filter((id) => !state.catalogs[id].hidden);
    return shown.length ? shown : [CATALOG_IDS[0]];
  }, [state, isAdmin]);

  // Si el catálogo actual queda oculto en modo público, se cambia al primero visible.
  useEffect(() => {
    if (!visibleCatalogIds.includes(catalogId)) setCatalogIdRaw(visibleCatalogIds[0]);
  }, [visibleCatalogIds, catalogId]);

  const activeId = visibleCatalogIds.includes(catalogId) ? catalogId : visibleCatalogIds[0];
  const catalog = state.catalogs[activeId];

  const mutate = useCallback(
    (fn: (c: Catalog) => Catalog, log?: LogEntry | LogEntry[], id: CatalogId = activeId) => {
      setState((prev) => {
        const next = fn(prev.catalogs[id]);
        const entries = log ? (Array.isArray(log) ? log : [log]) : [];
        return {
          ...prev,
          catalogs: {
            ...prev.catalogs,
            [id]: entries.length
              ? { ...next, log: [...entries, ...next.log].slice(0, MAX_LOG_ENTRIES) }
              : next,
          },
        };
      });
    },
    [activeId],
  );

  const value = useMemo<StoreValue>(() => {
    // Toda acción de escritura exige modo administrador, incluso si se invoca directamente.
    const guard = (fn: () => void) => {
      if (!isAdmin) {
        toast.error("Necesitas iniciar sesión como administrador");
        return;
      }
      fn();
    };

    return {
      state,
      hydrated,
      catalogId: activeId,
      catalog,
      visibleCatalogIds,
      setCatalogId: (id: CatalogId) => {
        if (!visibleCatalogIds.includes(id)) return;
        setCatalogIdRaw(id);
      },
      isAdmin,
      mustChangePassword,
      login: async (password: string) => {
        const result = await verifyPassword(password);
        if (!result.ok) {
          toast.error("Contraseña incorrecta");
          return false;
        }
        setIsAdmin(true);
        setMustChangePassword(result.mustChange);
        if (result.mustChange) {
          toast.warning("Cambia la contraseña inicial para proteger tus catálogos");
        } else {
          toast.success("Modo administrador activado");
        }
        return true;
      },
      changePassword: async (current: string, next: string) => {
        const result = await rotatePassword(current, next);
        if (!result.ok) {
          toast.error(result.error ?? "No se pudo cambiar la contraseña");
          return result;
        }
        setMustChangePassword(false);
        mutate(
          (c) => c,
          entry("sistema", catalog.name, "Contraseña de administrador actualizada"),
        );
        toast.success("Contraseña actualizada");
        return result;
      },
      resetPassword: async (code: string, next: string) => {
        const result = await resetWithRecoveryCode(code, next);
        if (!result.ok) {
          toast.error(result.error ?? "No se pudo restablecer la contraseña");
          return result;
        }
        setIsAdmin(false);
        setMustChangePassword(false);
        toast.success("Contraseña restablecida, inicia sesión de nuevo");
        return result;
      },
      logout: () => {
        setIsAdmin(false);
        setMustChangePassword(false);
        toast.success("Saliste del modo administrador");
      },
      prefs: prefsMap[activeId] ?? DEFAULT_PREFS,
      setPrefs: (patch) =>
        setPrefsMap((prev) => ({
          ...prev,
          [activeId]: { ...(prev[activeId] ?? DEFAULT_PREFS), ...patch },
        })),
      resetPrefs: () =>
        setPrefsMap((prev) => ({ ...prev, [activeId]: { ...DEFAULT_PREFS } })),
      updateCatalog: (patch) =>
        guard(() => {
          const changes: string[] = [];
          if (patch.name && patch.name !== catalog.name) changes.push(`nombre → ${patch.name}`);
          if (patch.subtitle !== undefined && patch.subtitle !== catalog.subtitle)
            changes.push("subtítulo");
          if (patch.whatsappNumber !== undefined && patch.whatsappNumber !== catalog.whatsappNumber)
            changes.push("número de WhatsApp");
          if (
            patch.whatsappTemplate !== undefined &&
            patch.whatsappTemplate !== catalog.whatsappTemplate
          )
            changes.push("plantilla de mensaje");
          mutate(
            (c) => ({ ...c, ...patch }),
            entry(
              "catalogo",
              patch.name ?? catalog.name,
              changes.length ? `Se actualizó ${changes.join(", ")}` : "Ajustes guardados sin cambios",
            ),
          );
          toast.success("Cambios guardados");
        }),
      toggleCatalogHidden: (id) =>
        guard(() => {
          const target = state.catalogs[id];
          const nowHidden = !target.hidden;
          mutate(
            (c) => ({ ...c, hidden: nowHidden }),
            entry(
              "catalogo",
              target.name,
              nowHidden ? "Catálogo oculto al público" : "Catálogo visible al público",
            ),
            id,
          );
          toast.success(nowHidden ? "Catálogo oculto" : "Catálogo visible");
        }),
      saveService: (service) =>
        guard(() => {
          const prev = service.id ? catalog.services.find((s) => s.id === service.id) : undefined;
          const changes: string[] = [];
          if (prev) {
            if (prev.name !== service.name) changes.push(`nombre → ${service.name}`);
            if (prev.price !== service.price) changes.push(`precio ${prev.price} → ${service.price}`);
            if (prev.categoryId !== service.categoryId) changes.push("categoría");
            if (prev.subsectionId !== service.subsectionId) changes.push("subsección");
            if (prev.description !== service.description) changes.push("descripción");
            if (prev.devices !== service.devices) changes.push(`dispositivos → ${service.devices}`);
            if (prev.profiles !== service.profiles) changes.push(`perfiles → ${service.profiles}`);
            if (prev.delivery !== service.delivery) changes.push("entrega");
            if (prev.warranty !== service.warranty) changes.push("garantía");
            if (prev.active !== service.active)
              changes.push(service.active ? "activado" : "desactivado");
          }
          mutate(
            (c) => {
              if (service.id && c.services.some((s) => s.id === service.id)) {
                return {
                  ...c,
                  services: c.services.map((s) =>
                    s.id === service.id ? ({ ...s, ...service, id: s.id } as Service) : s,
                  ),
                };
              }
              return { ...c, services: [{ ...service, id: newId() } as Service, ...c.services] };
            },
            prev
              ? entry(
                  "edicion",
                  service.name,
                  changes.length ? `Se actualizó ${changes.join(", ")}` : "Guardado sin cambios",
                )
              : entry("creacion", service.name, `Servicio creado en $${service.price} MXN`),
          );
          toast.success(prev ? "Servicio actualizado" : "Servicio agregado");
        }),
      duplicateService: (id) =>
        guard(() => {
          const found = catalog.services.find((s) => s.id === id);
          if (!found) return;
          mutate(
            (c) => {
              const index = c.services.findIndex((s) => s.id === id);
              const copy: Service = { ...found, id: newId(), name: `${found.name} (copia)` };
              const services = [...c.services];
              services.splice(index + 1, 0, copy);
              return { ...c, services };
            },
            entry("creacion", `${found.name} (copia)`, `Duplicado de ${found.name}`),
          );
          toast.success("Servicio duplicado");
        }),
      deleteService: (id) =>
        guard(() => {
          const found = catalog.services.find((s) => s.id === id);
          mutate(
            (c) => ({ ...c, services: c.services.filter((s) => s.id !== id) }),
            entry("eliminacion", found?.name ?? "Servicio", "Servicio eliminado del catálogo"),
          );
          toast.success("Servicio eliminado");
        }),
      toggleService: (id) =>
        guard(() => {
          const found = catalog.services.find((s) => s.id === id);
          if (!found) return;
          const nowActive = !found.active;
          mutate(
            (c) => ({
              ...c,
              services: c.services.map((s) => (s.id === id ? { ...s, active: nowActive } : s)),
            }),
            entry(
              "estado",
              found.name,
              nowActive ? "Servicio activado (visible)" : "Servicio desactivado (oculto)",
            ),
          );
          toast.success(nowActive ? "Servicio activado" : "Servicio desactivado");
        }),
      toggleFavorite: (id) => {
        let nowFav = false;
        mutate((c) => ({
          ...c,
          services: c.services.map((s) => {
            if (s.id !== id) return s;
            nowFav = !s.favorite;
            return { ...s, favorite: nowFav };
          }),
        }));
        toast.success(nowFav ? "Agregado a favoritos" : "Quitado de favoritos");
      },
      saveCategory: ({ id, name }) =>
        guard(() => {
          mutate(
            (c) => {
              if (id) {
                return {
                  ...c,
                  categories: c.categories.map((cat) => (cat.id === id ? { ...cat, name } : cat)),
                };
              }
              const category: Category = { id: newId(), name, subsections: [] };
              return { ...c, categories: [...c.categories, category] };
            },
            entry("categoria", name, id ? "Categoría renombrada" : "Categoría creada"),
          );
          toast.success(id ? "Categoría actualizada" : "Categoría agregada");
        }),
      deleteCategory: (id) =>
        guard(() => {
          const found = catalog.categories.find((c) => c.id === id);
          const count = catalog.services.filter((s) => s.categoryId === id).length;
          mutate(
            (c) => ({
              ...c,
              categories: c.categories.filter((cat) => cat.id !== id),
              services: c.services.filter((s) => s.categoryId !== id),
            }),
            entry(
              "categoria",
              found?.name ?? "Categoría",
              `Categoría eliminada junto con ${count} servicio(s)`,
            ),
          );
          toast.success("Categoría eliminada");
        }),
      saveSubsection: (categoryId, sub) =>
        guard(() => {
          mutate(
            (c) => ({
              ...c,
              categories: c.categories.map((cat) => {
                if (cat.id !== categoryId) return cat;
                if (sub.id) {
                  return {
                    ...cat,
                    subsections: cat.subsections.map((s) =>
                      s.id === sub.id ? { ...s, name: sub.name } : s,
                    ),
                  };
                }
                const created: Subsection = { id: newId(), name: sub.name };
                return { ...cat, subsections: [...cat.subsections, created] };
              }),
            }),
            entry("categoria", sub.name, sub.id ? "Subsección renombrada" : "Subsección creada"),
          );
          toast.success(sub.id ? "Subsección actualizada" : "Subsección agregada");
        }),
      deleteSubsection: (categoryId, subId) =>
        guard(() => {
          const name =
            catalog.categories
              .find((c) => c.id === categoryId)
              ?.subsections.find((s) => s.id === subId)?.name ?? "Subsección";
          mutate(
            (c) => ({
              ...c,
              categories: c.categories.map((cat) =>
                cat.id === categoryId
                  ? { ...cat, subsections: cat.subsections.filter((s) => s.id !== subId) }
                  : cat,
              ),
              services: c.services.map((s) =>
                s.subsectionId === subId ? { ...s, subsectionId: null } : s,
              ),
            }),
            entry("categoria", name, "Subsección eliminada"),
          );
          toast.success("Subsección eliminada");
        }),
      clearLog: () =>
        guard(() => {
          mutate((c) => ({ ...c, log: [] }), entry("sistema", catalog.name, "Historial vaciado"));
          toast.success("Historial vaciado");
        }),
      auditLog: CATALOG_IDS.flatMap((id) =>
        state.catalogs[id].log.map((e) => ({
          ...e,
          catalogId: id,
          catalogName: state.catalogs[id].name,
        })),
      ).sort((a, b) => b.at.localeCompare(a.at)),

      exportBackup: () =>
        guard(() => {
          try {
            const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `ma2-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast.success("Respaldo exportado");
          } catch (error) {
            console.error(error);
            toast.error("No se pudo exportar el respaldo");
          }
        }),
      importBackup: (json: string) => {
        if (!isAdmin) {
          toast.error("Necesitas iniciar sesión como administrador");
          return false;
        }
        try {
          const parsed = normalizeState(JSON.parse(json));
          const stamped: AppState = {
            ...parsed,
            catalogs: CATALOG_IDS.reduce(
              (acc, id) => {
                const c = parsed.catalogs[id];
                acc[id] = {
                  ...c,
                  log: [entry("sistema", c.name, "Respaldo importado"), ...c.log].slice(
                    0,
                    MAX_LOG_ENTRIES,
                  ),
                };
                return acc;
              },
              {} as Record<CatalogId, Catalog>,
            ),
          };
          setState(stamped);
          toast.success("Respaldo importado");
          return true;
        } catch (error) {
          console.error(error);
          toast.error("El archivo no es un respaldo válido");
          return false;
        }
      },
      resetAll: () =>
        guard(() => {
          setState(createSeedState());
          toast.success("Catálogos restaurados");
        }),
    };
  }, [
    state,
    hydrated,
    activeId,
    catalog,
    isAdmin,
    mustChangePassword,
    prefsMap,
    mutate,
    visibleCatalogIds,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useCatalogStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useCatalogStore debe usarse dentro de CatalogProvider");
  return ctx;
}
