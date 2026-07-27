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
import { createSeedState } from "./seed";
import { loadState, normalizeState, saveState } from "./storage";
import type { AppState, Catalog, CatalogId, Category, Service, Subsection } from "./types";

const ADMIN_PASSWORD = "Artu1802";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

interface StoreValue {
  state: AppState;
  hydrated: boolean;
  catalogId: CatalogId;
  catalog: Catalog;
  setCatalogId: (id: CatalogId) => void;
  isAdmin: boolean;
  login: (password: string) => boolean;
  logout: () => void;
  updateCatalog: (patch: Partial<Omit<Catalog, "id">>) => void;
  saveService: (service: Omit<Service, "id"> & { id?: string }) => void;
  duplicateService: (id: string) => void;
  deleteService: (id: string) => void;
  toggleService: (id: string) => void;
  saveCategory: (category: { id?: string; name: string }) => void;
  deleteCategory: (id: string) => void;
  saveSubsection: (categoryId: string, sub: { id?: string; name: string }) => void;
  deleteSubsection: (categoryId: string, subId: string) => void;
  exportBackup: () => void;
  importBackup: (json: string) => boolean;
  resetAll: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => createSeedState());
  const [hydrated, setHydrated] = useState(false);
  const [catalogId, setCatalogId] = useState<CatalogId>("clientes");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const result = saveState(state);
    if (!result.ok && result.error) {
      toast.error("No se pudo guardar en este dispositivo");
    }
  }, [state, hydrated]);

  const catalog = state.catalogs[catalogId];

  const mutate = useCallback(
    (fn: (c: Catalog) => Catalog) => {
      setState((prev) => ({
        ...prev,
        catalogs: { ...prev.catalogs, [catalogId]: fn(prev.catalogs[catalogId]) },
      }));
    },
    [catalogId],
  );

  const value = useMemo<StoreValue>(() => {
    return {
      state,
      hydrated,
      catalogId,
      catalog,
      setCatalogId,
      isAdmin,
      login: (password: string) => {
        if (password === ADMIN_PASSWORD) {
          setIsAdmin(true);
          toast.success("Modo administrador activado");
          return true;
        }
        toast.error("Contraseña incorrecta");
        return false;
      },
      logout: () => {
        setIsAdmin(false);
        toast.success("Saliste del modo administrador");
      },
      updateCatalog: (patch) => {
        mutate((c) => ({ ...c, ...patch }));
        toast.success("Cambios guardados");
      },
      saveService: (service) => {
        mutate((c) => {
          if (service.id && c.services.some((s) => s.id === service.id)) {
            return {
              ...c,
              services: c.services.map((s) =>
                s.id === service.id ? ({ ...s, ...service, id: s.id } as Service) : s,
              ),
            };
          }
          return { ...c, services: [{ ...service, id: newId() } as Service, ...c.services] };
        });
        toast.success(service.id ? "Servicio actualizado" : "Servicio agregado");
      },
      duplicateService: (id) => {
        mutate((c) => {
          const found = c.services.find((s) => s.id === id);
          if (!found) return c;
          const index = c.services.indexOf(found);
          const copy: Service = { ...found, id: newId(), name: `${found.name} (copia)` };
          const services = [...c.services];
          services.splice(index + 1, 0, copy);
          return { ...c, services };
        });
        toast.success("Servicio duplicado");
      },
      deleteService: (id) => {
        mutate((c) => ({ ...c, services: c.services.filter((s) => s.id !== id) }));
        toast.success("Servicio eliminado");
      },
      toggleService: (id) => {
        let nowActive = false;
        mutate((c) => ({
          ...c,
          services: c.services.map((s) => {
            if (s.id !== id) return s;
            nowActive = !s.active;
            return { ...s, active: nowActive };
          }),
        }));
        toast.success(nowActive ? "Servicio activado" : "Servicio desactivado");
      },
      saveCategory: ({ id, name }) => {
        mutate((c) => {
          if (id) {
            return {
              ...c,
              categories: c.categories.map((cat) => (cat.id === id ? { ...cat, name } : cat)),
            };
          }
          const category: Category = { id: newId(), name, subsections: [] };
          return { ...c, categories: [...c.categories, category] };
        });
        toast.success(id ? "Categoría actualizada" : "Categoría agregada");
      },
      deleteCategory: (id) => {
        mutate((c) => ({
          ...c,
          categories: c.categories.filter((cat) => cat.id !== id),
          services: c.services.filter((s) => s.categoryId !== id),
        }));
        toast.success("Categoría eliminada");
      },
      saveSubsection: (categoryId, sub) => {
        mutate((c) => ({
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
        }));
        toast.success(sub.id ? "Subsección actualizada" : "Subsección agregada");
      },
      deleteSubsection: (categoryId, subId) => {
        mutate((c) => ({
          ...c,
          categories: c.categories.map((cat) =>
            cat.id === categoryId
              ? { ...cat, subsections: cat.subsections.filter((s) => s.id !== subId) }
              : cat,
          ),
          services: c.services.map((s) =>
            s.subsectionId === subId ? { ...s, subsectionId: null } : s,
          ),
        }));
        toast.success("Subsección eliminada");
      },
      exportBackup: () => {
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
      },
      importBackup: (json: string) => {
        try {
          const parsed = JSON.parse(json);
          setState(normalizeState(parsed));
          toast.success("Respaldo importado");
          return true;
        } catch (error) {
          console.error(error);
          toast.error("El archivo no es un respaldo válido");
          return false;
        }
      },
      resetAll: () => {
        setState(createSeedState());
        toast.success("Catálogos restaurados");
      },
    };
  }, [state, hydrated, catalogId, catalog, isAdmin, mutate]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useCatalogStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useCatalogStore debe usarse dentro de CatalogProvider");
  return ctx;
}
