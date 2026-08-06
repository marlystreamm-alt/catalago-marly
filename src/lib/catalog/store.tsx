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
  clearFailedAttempts,
  ensureAuthRecord,
  formatLockWait,
  getLockStatus,
  registerFailedAttempt,
  resetWithRecoveryCode,
  rotatePassword,
  verifyPassword,
} from "./auth";
import {
  findClientByCode,
  loadClients,
  saveClients,
  type ClientAccess,
  type Permission,
} from "./client-access";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type CatalogPrefs, type PrefsMap } from "./prefs";
import { createEmptyCatalog, createSeedState } from "./seed";
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
  detail?: { field?: string; before?: string; after?: string; user?: string },
): LogEntry => ({
  id: newId(),
  at: new Date().toISOString(),
  action,
  target,
  summary,
  user: detail?.user ?? "Administrador",
  field: detail?.field,
  before: detail?.before,
  after: detail?.after,
});

const mxn = (n: number) => `$${Number(n || 0).toLocaleString("es-MX")} MXN`;


interface StoreValue {
  state: AppState;
  hydrated: boolean;
  catalogId: CatalogId;
  catalog: Catalog;
  visibleCatalogIds: CatalogId[];
  allCatalogIds: CatalogId[];
  addCatalog: (data: { name: string; subtitle: string }) => void;
  deleteCatalog: (id: CatalogId) => void;
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
  /** Sesión de cliente ("Mi menú") con permisos limitados. */
  clientSession: ClientAccess | null;
  isClient: boolean;
  /** Permisos efectivos: el administrador puede todo. */
  can: (perm: Permission) => boolean;
  /** Puede realizar alguna edición (administrador o cliente con permisos). */
  canEdit: boolean;
  clients: ClientAccess[];
  saveClient: (client: ClientAccess) => void;
  deleteClient: (id: string) => void;
  clientLogin: (code: string) => Promise<boolean>;
  clientLogout: () => void;

  prefs: CatalogPrefs;
  setPrefs: (patch: Partial<CatalogPrefs>) => void;
  resetPrefs: () => void;
  updateCatalog: (patch: Partial<Omit<Catalog, "id" | "log">>) => void;
  toggleCatalogHidden: (id: CatalogId) => void;
  saveService: (service: Omit<Service, "id"> & { id?: string }) => void;
  /** Guarda de una sola vez toda la lista de servicios del catálogo activo. */
  replaceServices: (services: Service[], summary?: string) => void;
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
  const [clients, setClients] = useState<ClientAccess[]>([]);
  const [clientSession, setClientSession] = useState<ClientAccess | null>(null);

  useEffect(() => {
    setState(loadState());
    setPrefsMap(loadPrefs());
    setClients(loadClients());
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

  const allCatalogIds = useMemo(() => Object.keys(state.catalogs), [state]);

  const visibleCatalogIds = useMemo(() => {
    if (isAdmin) return allCatalogIds;
    const shown = allCatalogIds.filter((id) => !state.catalogs[id].hidden);
    return shown.length ? shown : [allCatalogIds[0]];
  }, [state, isAdmin, allCatalogIds]);

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
    const can = (perm: Permission) =>
      isAdmin || (clientSession ? clientSession.permissions[perm] === true : false);

    // Toda escritura exige administrador o un cliente con ese permiso concreto.
    const guard = (fn: () => void, perms?: Permission[]) => {
      if (isAdmin) {
        fn();
        return;
      }
      if (clientSession && perms?.some((p) => can(p))) {
        fn();
        return;
      }
      toast.error(
        clientSession
          ? "Tu acceso no tiene permiso para este cambio"
          : "Necesitas iniciar sesión como administrador",
      );
    };
    /** Azúcar: gp(["editPrecio"])(() => { … }) */
    const gp = (perms: Permission[]) => (fn: () => void) => guard(fn, perms);




    return {
      state,
      hydrated,
      catalogId: activeId,
      catalog,
      visibleCatalogIds,
      allCatalogIds,
      addCatalog: ({ name, subtitle }) =>
        guard(() => {
          const clean = name.trim();
          if (!clean) {
            toast.error("Escribe un nombre para el catálogo");
            return;
          }
          const slug =
            clean
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "") || "catalogo";
          let id = slug;
          let n = 2;
          while (state.catalogs[id]) id = `${slug}-${n++}`;
          const fresh = createEmptyCatalog(id, clean, subtitle.trim());
          fresh.log = [entry("catalogo", clean, "Catálogo creado")];
          setState((prev) => ({ ...prev, catalogs: { ...prev.catalogs, [id]: fresh } }));
          setCatalogIdRaw(id);
          toast.success(`Catálogo "${clean}" creado`);
        }),
      deleteCatalog: (id) =>
        guard(() => {
          if (CATALOG_IDS.includes(id)) {
            toast.error("Los catálogos base no se pueden eliminar");
            return;
          }
          const target = state.catalogs[id];
          if (!target) return;
          setState((prev) => {
            const catalogs = { ...prev.catalogs };
            delete catalogs[id];
            return { ...prev, catalogs };
          });
          setCatalogIdRaw((prev) => (prev === id ? CATALOG_IDS[0] : prev));
          toast.success(`Catálogo "${target.name}" eliminado`);
        }),
      setCatalogId: (id: CatalogId) => {
        if (!visibleCatalogIds.includes(id)) return;
        setCatalogIdRaw(id);
      },
      isAdmin,
      mustChangePassword,
      login: async (password: string) => {
        const lock = getLockStatus();
        if (lock.locked) {
          toast.error(
            `Acceso bloqueado por seguridad. Intenta de nuevo en ${formatLockWait(lock.remainingMs)}.`,
          );
          return false;
        }
        const result = await verifyPassword(password);
        if (!result.ok) {
          const state = registerFailedAttempt();
          if (state.locked) {
            toast.error(
              `Demasiados intentos fallidos. Acceso bloqueado ${formatLockWait(state.remainingMs)}.`,
            );
          } else {
            toast.error(
              `Contraseña incorrecta. Te quedan ${state.attemptsLeft} intento(s) antes del bloqueo.`,
            );
          }
          return false;
        }
        clearFailedAttempts();
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
        mutate((c) => c, entry("sistema", catalog.name, "Contraseña de administrador actualizada"));
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
      clientSession,
      isClient: !!clientSession,
      can,
      canEdit:
        isAdmin ||
        (!!clientSession &&
          Object.entries(clientSession.permissions).some(
            ([key, on]) => on && key.startsWith("edit"),
          )) ||
        (!!clientSession &&
          (clientSession.permissions.agregarServicio ||
            clientSession.permissions.eliminarServicio ||
            clientSession.permissions.ajustesCatalogo)),
      clients,
      saveClient: (client) => {
        if (!isAdmin) {
          toast.error("Necesitas iniciar sesión como administrador");
          return;
        }
        setClients((prev) => {
          const exists = prev.some((c) => c.id === client.id);
          const next = exists
            ? prev.map((c) => (c.id === client.id ? client : c))
            : [client, ...prev];
          saveClients(next);
          return next;
        });
        setClientSession((prev) => (prev && prev.id === client.id ? client : prev));
      },
      deleteClient: (id) => {
        if (!isAdmin) {
          toast.error("Necesitas iniciar sesión como administrador");
          return;
        }
        setClients((prev) => {
          const next = prev.filter((c) => c.id !== id);
          saveClients(next);
          return next;
        });
        setClientSession((prev) => (prev && prev.id === id ? null : prev));
        toast.success("Acceso eliminado");
      },
      clientLogin: async (code: string) => {
        const result = await findClientByCode(code, loadClients());
        if (!result.ok) {
          toast.error(result.error);
          return false;
        }
        setClients(loadClients());
        setClientSession(result.client);
        if (result.client.catalogId && state.catalogs[result.client.catalogId]) {
          setCatalogIdRaw(result.client.catalogId);
        }
        toast.success(`Bienvenida, ${result.client.business || "cliente"}`);
        return true;
      },
      clientLogout: () => {
        setClientSession(null);
        toast.success("Saliste de tu menú");
      },

      prefs: prefsMap[activeId] ?? DEFAULT_PREFS,
      setPrefs: (patch) =>
        setPrefsMap((prev) => ({
          ...prev,
          [activeId]: { ...(prev[activeId] ?? DEFAULT_PREFS), ...patch },
        })),
      resetPrefs: () => setPrefsMap((prev) => ({ ...prev, [activeId]: { ...DEFAULT_PREFS } })),
      updateCatalog: (patch) =>
        gp(["ajustesCatalogo"])(() => {
          const changes: string[] = [];
          const entries: LogEntry[] = [];
          if (patch.name && patch.name !== catalog.name) {
            changes.push(`nombre → ${patch.name}`);
            entries.push(
              entry("catalogo", patch.name, `Nombre del catálogo: "${catalog.name}" → "${patch.name}"`, {
                field: "Nombre del catálogo",
                before: catalog.name,
                after: patch.name,
              }),
            );
          }
          if (patch.subtitle !== undefined && patch.subtitle !== catalog.subtitle) {
            changes.push("subtítulo");
            entries.push(
              entry("catalogo", patch.name ?? catalog.name, "Se cambió el subtítulo", {
                field: "Subtítulo",
                before: catalog.subtitle,
                after: patch.subtitle,
              }),
            );
          }
          if (patch.whatsappNumber !== undefined && patch.whatsappNumber !== catalog.whatsappNumber) {
            changes.push("número de WhatsApp");
            entries.push(
              entry("catalogo", patch.name ?? catalog.name, "Se cambió el número de WhatsApp", {
                field: "Número de WhatsApp",
                before: catalog.whatsappNumber || "(vacío)",
                after: patch.whatsappNumber || "(vacío)",
              }),
            );
          }
          if (
            patch.whatsappTemplate !== undefined &&
            patch.whatsappTemplate !== catalog.whatsappTemplate
          ) {
            changes.push("plantilla de mensaje");
            entries.push(
              entry("catalogo", patch.name ?? catalog.name, "Se cambió la plantilla de mensaje", {
                field: "Plantilla de mensaje",
                before: catalog.whatsappTemplate,
                after: patch.whatsappTemplate,
              }),
            );
          }
          mutate(
            (c) => ({ ...c, ...patch }),
            entries.length
              ? entries
              : entry("catalogo", catalog.name, "Ajustes guardados sin cambios"),
          );
          toast.success(
            changes.length ? `Cambios guardados: ${changes.join(", ")}` : "Cambios guardados",
          );
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
        gp(["editNombre","editPrecio","editDescripcion","editImagen","editDetalles","agregarServicio"])(() => {
          const prev = service.id ? catalog.services.find((s) => s.id === service.id) : undefined;
          const changes: string[] = [];
          const details: LogEntry[] = [];
          if (prev) {
            if (prev.name !== service.name) changes.push(`nombre → ${service.name}`);
            if (prev.price !== service.price) {
              changes.push(`precio ${prev.price} → ${service.price}`);
              details.push(
                entry(
                  "edicion",
                  service.name,
                  `Precio: ${mxn(prev.price)} → ${mxn(service.price)}`,
                  { field: "Precio", before: mxn(prev.price), after: mxn(service.price) },
                ),
              );
            }
            if (prev.categoryId !== service.categoryId) changes.push("categoría");
            if (prev.subsectionId !== service.subsectionId) changes.push("subsección");
            if (prev.description !== service.description) changes.push("descripción");
            if (prev.devices !== service.devices) changes.push(`dispositivos → ${service.devices}`);
            if (prev.profiles !== service.profiles) changes.push(`perfiles → ${service.profiles}`);
            if (prev.delivery !== service.delivery) changes.push("entrega");
            if (prev.warranty !== service.warranty) changes.push("garantía");
            if (prev.active !== service.active) {
              changes.push(service.active ? "activado" : "desactivado");
              details.push(
                entry(
                  "estado",
                  service.name,
                  `Estado: ${prev.active ? "Activo" : "Oculto"} → ${service.active ? "Activo" : "Oculto"}`,
                  {
                    field: "Estado",
                    before: prev.active ? "Activo" : "Oculto",
                    after: service.active ? "Activo" : "Oculto",
                  },
                ),
              );
            }
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
              ? details.length
                ? details
                : [
                    entry(
                      "edicion",
                      service.name,
                      changes.length ? `Se actualizó ${changes.join(", ")}` : "Guardado sin cambios",
                    ),
                  ]

              : entry("creacion", service.name, `Servicio creado en ${mxn(service.price)}`, {
                  field: "Precio",
                  before: "—",
                  after: mxn(service.price),
                }),
          );
          toast.success(prev ? "Servicio actualizado" : "Servicio agregado");
        }),

      replaceServices: (services, summary) =>
        gp(["editNombre","editPrecio","editDescripcion","editImagen","editDetalles","editEstado","agregarServicio","eliminarServicio"])(() => {
          mutate(
            (c) => ({ ...c, services: services.map((s, i) => ({ ...s, sortIndex: i })) }),
            entry("edicion", catalog.name, summary ?? "Se guardaron cambios desde la vista lista"),
          );
        }),
      duplicateService: (id) =>
        gp(["agregarServicio"])(() => {
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
        gp(["eliminarServicio"])(() => {
          const found = catalog.services.find((s) => s.id === id);
          mutate(
            (c) => ({ ...c, services: c.services.filter((s) => s.id !== id) }),
            entry("eliminacion", found?.name ?? "Servicio", "Servicio eliminado del catálogo"),
          );
          toast.success("Servicio eliminado");
        }),
      toggleService: (id) =>
        gp(["editEstado"])(() => {
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
              `Estado: ${found.active ? "Activo" : "Oculto"} → ${nowActive ? "Activo" : "Oculto"}`,
              {
                field: "Estado",
                before: found.active ? "Activo" : "Oculto",
                after: nowActive ? "Activo" : "Oculto",
              },
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
      auditLog: allCatalogIds.flatMap((id) =>
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
            catalogs: Object.keys(parsed.catalogs).reduce(
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
    allCatalogIds,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useCatalogStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useCatalogStore debe usarse dentro de CatalogProvider");
  return ctx;
}
