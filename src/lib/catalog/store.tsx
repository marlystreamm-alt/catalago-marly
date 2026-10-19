import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  clearFailedAttempts,
  formatLockWait,
  getLockStatus,
  registerFailedAttempt,
  completeRecoveryFromEmail,
  requestRecoveryEmail,
  resetWithRecoveryCode,
} from "./auth";
import {
  adminSessionLogin,
  adminSessionLogout,
  adminSessionChangePassword,
  adminSessionValidate,
} from "@/lib/admin-session.functions";
import {
  findClientByCredentials,
  loadClients,
  saveClients,
  type ClientAccess,
  type Permission,
} from "./client-access";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type CatalogPrefs, type PrefsMap } from "./prefs";
import { createEmptyCatalog, createSeedState } from "./seed";
import { loadState, normalizeState, saveState } from "./storage";
import { catalogSyncLoad, catalogSyncSave } from "./sync.functions";
import { clearCode, getSavedCode, saveCode } from "@/lib/notify/client";

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
  type SpaceType,
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

const ADMIN_SESSION_KEY = "ma2-admin-session-v2";
const LEGACY_ADMIN_SESSION_KEY = "ma2-admin-session-v1";

function getRememberedAdminSession() {
  if (typeof window === "undefined" || !window.localStorage) return "";
  try {
    window.localStorage.removeItem(LEGACY_ADMIN_SESSION_KEY);
    return window.localStorage.getItem(ADMIN_SESSION_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberAdminSession(token: string) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    if (token) window.localStorage.setItem(ADMIN_SESSION_KEY, token);
    else window.localStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {
    // Si el navegador bloquea almacenamiento, la sesión seguirá funcionando hasta recargar.
  }
}

interface StoreValue {
  state: AppState;
  hydrated: boolean;
  catalogId: CatalogId;
  catalog: Catalog;
  visibleCatalogIds: CatalogId[];
  allCatalogIds: CatalogId[];
  addCatalog: (data: {
    name: string;
    subtitle: string;
    spaceType: SpaceType;
    imageUrl?: string;
  }) => void;
  duplicateCatalog: (id: CatalogId) => void;
  deleteCatalog: (id: CatalogId) => void;
  updateCatalogMeta: (
    id: CatalogId,
    patch: Partial<
      Pick<
        Catalog,
        | "name"
        | "subtitle"
        | "spaceType"
        | "imageUrl"
        | "sectionLabels"
        | "sectionTabs"
        | "commercialFieldsEnabled"
      >
    >,
  ) => void;
  moveCatalog: (id: CatalogId, direction: -1 | 1) => void;
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
  requestRecoveryEmail: () => Promise<{ ok: boolean; error?: string; email?: string }>;
  completeEmailRecovery: (
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
  clientLogin: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
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
  const [adminToken, setAdminToken] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [prefsMap, setPrefsMap] = useState<PrefsMap>(() => loadPrefs());
  const [clients, setClients] = useState<ClientAccess[]>([]);
  const [clientSession, setClientSession] = useState<ClientAccess | null>(null);
  const syncQueue = useRef<Promise<void>>(Promise.resolve());
  const syncSuccessNotified = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const local = loadState();
    setPrefsMap(loadPrefs());
    setClients(loadClients());
    const remembered = getRememberedAdminSession();
    if (remembered)
      void adminSessionValidate({ data: { token: remembered } })
        .then((session) => {
          if (cancelled) return;
          setAdminToken(remembered);
          setIsAdmin(true);
          setMustChangePassword(session.mustChangePassword);
        })
        .catch(() => {
          rememberAdminSession("");
          clearCode();
        });
    void (async () => {
      try {
        const remote = await catalogSyncLoad();
        if (cancelled) return;
        // Supabase manda cuando ya existe un estado compartido. Si todavía no existe,
        // se conserva el estado local del administrador para subirlo sin perder cambios.
        setState(remote.state ? normalizeState(remote.state) : local);
      } catch (error) {
        console.error("No se pudo cargar el catálogo compartido:", error);
        if (!cancelled) setState(local);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
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

  useEffect(() => {
    if (!hydrated || !isAdmin) return;
    const timer = window.setTimeout(() => {
      const code = getSavedCode();
      syncQueue.current = syncQueue.current
        .catch(() => undefined)
        .then(async () => {
          await catalogSyncSave({ data: { code, state } });
          if (!syncSuccessNotified.current) {
            syncSuccessNotified.current = true;
            toast.success("Catálogos y subsecciones sincronizados con Supabase");
          }
        })
        .catch((error) => {
          console.error("No se pudo sincronizar con Supabase:", error);
          toast.error(
            "No se pudo sincronizar el catálogo. Revisa el código administrador y vuelve a intentarlo.",
          );
        });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [state, hydrated, isAdmin]);

  const allCatalogIds = useMemo(() => Object.keys(state.catalogs), [state]);

  const visibleCatalogIds = useMemo(() => {
    if (isAdmin) return allCatalogIds;
    if (clientSession) {
      const allowed = (
        clientSession.catalogIds?.length ? clientSession.catalogIds : [clientSession.catalogId]
      ).filter((id) => !!state.catalogs[id] && !state.catalogs[id].hidden);
      return allowed.length
        ? allowed
        : [clientSession.catalogId].filter((id) => !!state.catalogs[id]);
    }
    const shown = allCatalogIds.filter((id) => !state.catalogs[id].hidden);
    return shown.length ? shown : [allCatalogIds[0]];
  }, [state, isAdmin, clientSession, allCatalogIds]);

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

    /**
     * Segunda barrera: aunque alguien manipule la interfaz, solo se conservan
     * los campos que el permiso de la clienta autoriza; el resto vuelve al valor previo.
     */
    const FIELD_PERMS: Array<[Permission, (keyof Service)[]]> = [
      ["editNombre", ["name"]],
      ["editPrecio", ["price", "priceText"]],
      ["editDescripcion", ["description"]],
      ["editImagen", ["icon"]],
      [
        "editDetalles",
        [
          "categoryId",
          "subsectionId",
          "devices",
          "profiles",
          "delivery",
          "warranty",
          "plan",
          "users",
          "vigencia",
          "requirements",
          "sectionId",
        ],
      ],
      ["editEstado", ["active"]],
      ["editWhatsappTarjeta", ["whatsapp", "whatsappMessage"]],
    ];

    const sanitizeService = <T extends Partial<Service>>(next: T, prev?: Service): T => {
      if (isAdmin || !clientSession || !prev) return next;
      const out = { ...prev, ...({} as T) } as unknown as T;
      // Campos neutros que no dependen de un permiso concreto.
      (out as Partial<Service>).favorite = next.favorite ?? prev.favorite;
      (out as Partial<Service>).sortIndex = next.sortIndex ?? prev.sortIndex;
      for (const [perm, keys] of FIELD_PERMS) {
        if (!can(perm)) continue;
        for (const key of keys) {
          if (key in next) (out as Record<string, unknown>)[key] = next[key as keyof T];
        }
      }
      return out;
    };

    return {
      state,
      hydrated,
      catalogId: activeId,
      catalog,
      visibleCatalogIds,
      allCatalogIds,
      addCatalog: ({ name, subtitle, spaceType, imageUrl }) =>
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
          const fresh = createEmptyCatalog(
            id,
            clean,
            subtitle.trim(),
            spaceType,
            imageUrl?.trim() ?? "",
          );
          fresh.log = [entry("catalogo", clean, "Catálogo creado")];
          setState((prev) => ({ ...prev, catalogs: { ...prev.catalogs, [id]: fresh } }));
          setCatalogIdRaw(id);
          toast.success(`Catálogo "${clean}" creado`);
        }),
      duplicateCatalog: (id) =>
        guard(() => {
          const source = state.catalogs[id];
          if (!source) return;
          const base = `${id}-copia`;
          let nextId = base;
          let n = 2;
          while (state.catalogs[nextId]) nextId = `${base}-${n++}`;
          const copy = JSON.parse(JSON.stringify(source)) as Catalog;
          copy.id = nextId;
          copy.name = `${source.name} copia`;
          copy.hidden = true;
          copy.log = [
            entry("catalogo", copy.name, `Duplicado de ${source.name}`),
            ...(copy.log || []),
          ].slice(0, MAX_LOG_ENTRIES);
          setState((prev) => ({ ...prev, catalogs: { ...prev.catalogs, [nextId]: copy } }));
          setCatalogIdRaw(nextId);
          toast.success(`Catálogo duplicado: ${copy.name}`);
        }),
      deleteCatalog: (id) =>
        guard(() => {
          const target = state.catalogs[id];
          if (!target) return;
          const ids = Object.keys(state.catalogs);
          if (ids.length <= 1) {
            toast.error("Debe existir al menos un espacio");
            return;
          }
          const fallback = ids.find((x) => x !== id) ?? ids[0];
          setState((prev) => {
            const catalogs = { ...prev.catalogs };
            delete catalogs[id];
            return { ...prev, catalogs };
          });
          setCatalogIdRaw((prev) => (prev === id ? fallback : prev));
          toast.success(`Espacio "${target.name}" eliminado`);
        }),
      updateCatalogMeta: (id, patch) =>
        guard(() => {
          const target = state.catalogs[id];
          if (!target) return;
          const cleanPatch = { ...patch };
          if (typeof cleanPatch.name === "string")
            cleanPatch.name = cleanPatch.name.trim() || target.name;
          if (cleanPatch.spaceType && cleanPatch.spaceType !== target.spaceType) {
            if (cleanPatch.spaceType === "catalog") {
              cleanPatch.sectionLabels = {
                perfiles: "Perfiles",
                completas: "Completas",
                tramites: "Trámites",
              };
              cleanPatch.sectionTabs = target.sectionTabs?.length
                ? target.sectionTabs
                : [
                    { id: "perfiles", name: "Perfiles", hidden: false },
                    { id: "completas", name: "Completas", hidden: false },
                    { id: "tramites", name: "Trámites", hidden: false },
                  ];
            } else {
              cleanPatch.sectionTabs = [];
              cleanPatch.sectionLabels = undefined;
            }
          }
          mutate(
            (c) => ({ ...c, ...cleanPatch }),
            entry("catalogo", cleanPatch.name ?? target.name, "Datos del espacio actualizados"),
            id,
          );
          if (
            patch.name !== undefined ||
            patch.subtitle !== undefined ||
            patch.spaceType !== undefined ||
            patch.imageUrl !== undefined
          )
            toast.success("Espacio actualizado");
        }),
      moveCatalog: (id, direction) =>
        guard(() => {
          setState((prev) => {
            const ids = Object.keys(prev.catalogs);
            const from = ids.indexOf(id);
            const to = from + direction;
            if (from < 0 || to < 0 || to >= ids.length) return prev;
            const nextIds = [...ids];
            const [moved] = nextIds.splice(from, 1);
            nextIds.splice(to, 0, moved);
            const catalogs = Object.fromEntries(nextIds.map((key) => [key, prev.catalogs[key]]));
            return { ...prev, catalogs };
          });
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
        try {
          const result = await adminSessionLogin({
            data: { code: password, actorName: "Marla" },
          });
          clearFailedAttempts();
          saveCode(password);
          setAdminToken(result.token);
          setIsAdmin(true);
          setMustChangePassword(result.mustChangePassword);
          rememberAdminSession(result.token);
          toast.success("Sesión de administradora iniciada");
          return true;
        } catch {
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
      },

      changePassword: async (current: string, next: string) => {
        const token = adminToken || getRememberedAdminSession();
        if (!token) return { ok: false, error: "La sesión expiró. Inicia sesión nuevamente." };
        try {
          await adminSessionChangePassword({
            data: { token, currentCode: current, newCode: next },
          });
          saveCode(next);
          setMustChangePassword(false);
          mutate(
            (c) => c,
            entry("sistema", catalog.name, "Contraseña de administrador actualizada"),
          );
          toast.success("Contraseña actualizada");
          return { ok: true };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "No se pudo cambiar la contraseña";
          toast.error(message);
          return { ok: false, error: message };
        }
      },
      resetPassword: async (code: string, next: string) => {
        const result = await resetWithRecoveryCode(code, next);
        if (!result.ok) {
          toast.error(result.error ?? "No se pudo restablecer la contraseña");
          return result;
        }
        setIsAdmin(false);
        setMustChangePassword(false);
        rememberAdminSession("");
        toast.success("Contraseña restablecida, inicia sesión de nuevo");
        return result;
      },
      requestRecoveryEmail: async () => {
        const result = await requestRecoveryEmail();
        if (!result.ok) toast.error(result.error ?? "No se pudo enviar el correo de recuperación");
        else toast.success(`Enlace enviado a ${result.email}`);
        return result;
      },
      completeEmailRecovery: async (next: string) => {
        const result = await completeRecoveryFromEmail(next);
        if (!result.ok) {
          toast.error(result.error ?? "No se pudo restablecer la contraseña");
          return result;
        }
        setIsAdmin(false);
        setMustChangePassword(false);
        rememberAdminSession("");
        toast.success("Contraseña restablecida. Inicia sesión con la nueva contraseña.");
        return result;
      },
      logout: () => {
        const token = adminToken || getRememberedAdminSession();
        setIsAdmin(false);
        setAdminToken("");
        setMustChangePassword(false);
        rememberAdminSession("");
        clearCode();
        if (token) void adminSessionLogout({ data: { token } }).catch(() => undefined);
        toast.success("Sesión cerrada. Las herramientas privadas quedaron ocultas.");
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
      clientLogin: async (username: string, password: string) => {
        const result = await findClientByCredentials(username, password, loadClients());
        if (!result.ok) {
          return { ok: false, error: result.error };
        }
        setClients(loadClients());
        setClientSession(result.client);
        const firstAllowed = result.client.catalogIds?.[0] || result.client.catalogId;
        if (firstAllowed && state.catalogs[firstAllowed]) {
          setCatalogIdRaw(firstAllowed);
        }
        toast.success(`Bienvenida, ${result.client.business || "cliente"}`);
        return { ok: true };
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
      resetPrefs: () =>
        setPrefsMap((prev) => {
          const current = prev[activeId] ?? DEFAULT_PREFS;
          return {
            ...prev,
            [activeId]: {
              ...DEFAULT_PREFS,
              themeMode: current.themeMode,
              accentColor: current.accentColor,
              backgroundStyle: current.backgroundStyle,
              markedIds: current.markedIds,
            },
          };
        }),
      updateCatalog: (patch) =>
        gp(["ajustesCatalogo"])(() => {
          const changes: string[] = [];
          const entries: LogEntry[] = [];
          if (patch.name && patch.name !== catalog.name) {
            changes.push(`nombre → ${patch.name}`);
            entries.push(
              entry(
                "catalogo",
                patch.name,
                `Nombre del catálogo: "${catalog.name}" → "${patch.name}"`,
                {
                  field: "Nombre del catálogo",
                  before: catalog.name,
                  after: patch.name,
                },
              ),
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
          if (
            patch.whatsappNumber !== undefined &&
            patch.whatsappNumber !== catalog.whatsappNumber
          ) {
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
      saveService: (incoming) =>
        gp([
          "editNombre",
          "editPrecio",
          "editDescripcion",
          "editImagen",
          "editDetalles",
          "agregarServicio",
        ])(() => {
          const prev = incoming.id ? catalog.services.find((s) => s.id === incoming.id) : undefined;
          if (!prev && !isAdmin && !can("agregarServicio")) {
            toast.error("Tu acceso no permite agregar servicios");
            return;
          }
          const service = sanitizeService(incoming, prev);
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
                      changes.length
                        ? `Se actualizó ${changes.join(", ")}`
                        : "Guardado sin cambios",
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
        gp([
          "editNombre",
          "editPrecio",
          "editDescripcion",
          "editImagen",
          "editDetalles",
          "editEstado",
          "agregarServicio",
          "eliminarServicio",
        ])(() => {
          // Se vuelve a validar campo por campo: la interfaz nunca es la única barrera.
          let safe = services as Service[];
          if (!isAdmin && clientSession) {
            const byId = new Map(catalog.services.map((s) => [s.id, s]));
            safe = services
              .filter((s) => byId.has(s.id) || can("agregarServicio"))
              .map((s) => sanitizeService(s, byId.get(s.id)) as Service);
            if (!can("eliminarServicio")) {
              const kept = new Set(safe.map((s) => s.id));
              for (const old of catalog.services) if (!kept.has(old.id)) safe.push(old);
            }
          }
          mutate(
            (c) => ({ ...c, services: safe.map((s, i) => ({ ...s, sortIndex: i })) }),
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
      auditLog: allCatalogIds
        .flatMap((id) =>
          state.catalogs[id].log.map((e) => ({
            ...e,
            catalogId: id,
            catalogName: state.catalogs[id].name,
          })),
        )
        .sort((a, b) => b.at.localeCompare(a.at)),

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
    adminToken,
    mustChangePassword,
    prefsMap,
    mutate,
    visibleCatalogIds,
    allCatalogIds,
    clients,
    clientSession,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useCatalogStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useCatalogStore debe usarse dentro de CatalogProvider");
  return ctx;
}
