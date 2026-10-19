import { copyText } from "@/lib/browser/clipboard";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Copy, Eye, EyeOff, LogOut, Plus, Store, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCatalogStore } from "@/lib/catalog/store";
import {
  DEFAULT_PERMISSIONS,
  PERMISSIONS,
  addMonths,
  hashCode,
  randomHex,
  statusOf,
  todayISO,
  type ClientAccess,
  type Permissions,
} from "@/lib/catalog/client-access";
import { ConfirmButton } from "./confirm-button";

const STATUS_STYLES: Record<string, string> = {
  activo: "bg-primary/10 text-primary",
  suspendido: "bg-muted text-muted-foreground",
  vencido: "bg-destructive/10 text-destructive",
};

const emptyDraft = (catalogId: string): ClientAccess => ({
  id: randomHex(8),
  business: "",
  owner: "",
  whatsapp: "",
  username: "",
  notes: "",
  catalogId,
  catalogIds: [catalogId],
  startsOn: todayISO(),
  expiresOn: addMonths(todayISO(), 1),
  suspended: false,
  permissions: { ...DEFAULT_PERMISSIONS },
  salt: "",
  hash: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

/** Botón + panel para que el administrador cree accesos y decida qué puede editar cada clienta. */
export function ClientAccessDialog() {
  const { isAdmin, clients, saveClient, deleteClient, state, allCatalogIds, catalogId } =
    useCatalogStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ClientAccess | null>(null);
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setDraft(null);
      setNewCode("");
      setConfirmCode("");
      setShowCode(false);
    }
  }, [open]);

  const sorted = useMemo(
    () => [...clients].sort((a, b) => a.business.localeCompare(b.business, "es-MX")),
    [clients],
  );

  if (!isAdmin) return null;

  const startNew = () => {
    setDraft(emptyDraft(catalogId));
    setNewCode("");
    setConfirmCode("");
  };

  const setPerm = (key: keyof Permissions, value: boolean) =>
    setDraft((prev) =>
      prev ? { ...prev, permissions: { ...prev.permissions, [key]: value } } : prev,
    );

  const submit = async () => {
    if (!draft) return;
    if (!draft.business.trim()) {
      toast.error("Escribe el nombre del negocio");
      return;
    }
    const username = draft.username.trim().toLowerCase();
    if (username.length < 3) {
      toast.error("Escribe un usuario de al menos 3 caracteres");
      return;
    }
    if (clients.some((c) => c.id !== draft.id && c.username.trim().toLowerCase() === username)) {
      toast.error("Ese usuario ya está asignado a otro cliente");
      return;
    }
    if (!(draft.catalogIds?.length || draft.catalogId)) {
      toast.error("Selecciona al menos un catálogo");
      return;
    }
    if (!draft.hash && newCode.length < 6) {
      toast.error("Escribe una contraseña de al menos 6 caracteres");
      return;
    }
    if (newCode && newCode !== confirmCode) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setBusy(true);
    try {
      let { salt, hash } = draft;
      if (newCode.trim()) {
        salt = randomHex(16);
        hash = await hashCode(newCode.trim(), salt);
      }
      if (!hash) {
        toast.error("Genera una clave de acceso para este cliente");
        return;
      }
      saveClient({
        ...draft,
        business: draft.business.trim(),
        owner: draft.owner.trim(),
        username,
        whatsapp: draft.whatsapp.replace(/\D/g, ""),
        catalogId: (draft.catalogIds?.[0] || draft.catalogId),
        catalogIds: draft.catalogIds?.length ? draft.catalogIds : [draft.catalogId],
        salt,
        hash,
        updatedAt: new Date().toISOString(),
      });
      toast.success("Acceso guardado");
      setDraft(null);
      setNewCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserCog className="size-4" />
        Accesos de clientes
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Accesos de clientes</DialogTitle>
            <DialogDescription>
              Da una clave a cada clienta y decide qué puede ver y editar en su menú.
            </DialogDescription>
          </DialogHeader>

          {draft ? (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cl-business">Negocio *</Label>
                <Input
                  id="cl-business"
                  value={draft.business}
                  onChange={(e) => setDraft({ ...draft, business: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="cl-owner">Responsable</Label>
                  <Input
                    id="cl-owner"
                    value={draft.owner}
                    onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cl-wa">WhatsApp</Label>
                  <Input
                    id="cl-wa"
                    inputMode="tel"
                    value={draft.whatsapp}
                    onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <div>
                  <Label>Catálogos que puede ver</Label>
                  <p className="text-xs text-muted-foreground">Marca uno o varios. Si marcas uno, solo verá ese catálogo.</p>
                </div>
                <div className="grid gap-2 rounded-xl border p-2 sm:grid-cols-2">
                  {allCatalogIds.map((id) => {
                    const selected = (draft.catalogIds?.length ? draft.catalogIds : [draft.catalogId]).includes(id);
                    return (
                      <label key={id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={selected}
                          onChange={(e) => {
                            const current = draft.catalogIds?.length ? draft.catalogIds : [draft.catalogId];
                            const next = e.target.checked ? [...new Set([...current, id])] : current.filter((x) => x !== id);
                            setDraft({ ...draft, catalogIds: next, catalogId: next[0] || draft.catalogId });
                          }}
                        />
                        <span className="truncate">{state.catalogs[id].name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="cl-start">Inicio</Label>
                  <Input
                    id="cl-start"
                    type="date"
                    value={draft.startsOn}
                    onChange={(e) => setDraft({ ...draft, startsOn: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cl-end">Vence</Label>
                  <Input
                    id="cl-end"
                    type="date"
                    value={draft.expiresOn}
                    onChange={(e) => setDraft({ ...draft, expiresOn: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl border border-border bg-muted/30 p-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="cl-user">Usuario</Label>
                  <Input id="cl-user" value={draft.username} placeholder="Ej. cliente01" autoCapitalize="none" autoCorrect="off" onChange={(e) => setDraft({ ...draft, username: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cl-code">Contraseña</Label>
                  <div className="relative">
                    <Input id="cl-code" type={showCode ? "text" : "password"} value={newCode} placeholder={draft.hash ? "Escribe una nueva solo si deseas cambiarla" : "Mínimo 6 caracteres"} onChange={(e) => setNewCode(e.target.value)} className="pr-10" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 size-8 -translate-y-1/2" onClick={() => setShowCode((v) => !v)} aria-label={showCode ? "Ocultar contraseña" : "Mostrar contraseña"}>{showCode ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cl-code2">Confirmar contraseña</Label>
                  <Input id="cl-code2" type={showCode ? "text" : "password"} value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} className={newCode && confirmCode && newCode !== confirmCode ? "border-destructive" : undefined} />
                  {newCode && confirmCode && newCode !== confirmCode ? <p className="text-xs font-medium text-destructive">Las contraseñas no coinciden.</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={!newCode} onClick={async () => { try { await copyText(newCode); toast.success("Contraseña copiada"); } catch { toast.error("Copia la contraseña manualmente"); } }}><Copy className="mr-1 size-4" />Copiar contraseña</Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Tú eliges el usuario y la contraseña. La contraseña se guarda cifrada y no se muestra después de guardar.</p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/40 p-3">
                <p className="text-sm font-semibold text-foreground">Funciones y permisos del cliente</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Tú decides qué verá y qué podrá editar. Tu modo administradora conserva todas las funciones.</p>
                {[
                  ["ver", "Contenido visible"],
                  ["funciones", "Botones del catálogo"],
                  ["editar", "Permisos de edición"],
                ].map(([group, title]) => (
                  <div key={group} className="mt-3 rounded-xl border border-border bg-card p-2.5">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
                    <div className="grid gap-2">
                      {PERMISSIONS.filter((p) => p.group === group).map((p) => (
                        <label key={p.key} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-foreground">{p.label}</span>
                          <Switch checked={draft.permissions[p.key]} onCheckedChange={(v) => setPerm(p.key, v)} />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <label className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-sm">
                <span>Acceso suspendido</span>
                <Switch
                  checked={draft.suspended}
                  onCheckedChange={(v) => setDraft({ ...draft, suspended: v })}
                />
              </label>

              <div className="grid gap-1.5">
                <Label htmlFor="cl-notes">Notas</Label>
                <Textarea
                  id="cl-notes"
                  rows={2}
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </div>

              <DialogFooter className="sm:justify-between">
                <Button variant="ghost" onClick={() => setDraft(null)}>
                  Volver
                </Button>
                <Button onClick={submit} disabled={busy}>
                  {busy ? "Guardando…" : "Guardar acceso"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="grid gap-3">
              <Button size="sm" onClick={startNew}>
                <Plus className="size-4" />
                Nuevo acceso
              </Button>
              {sorted.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Aún no hay clientes con acceso.
                </p>
              ) : (
                sorted.map((c) => {
                  const status = statusOf(c);
                  const perms = PERMISSIONS.filter((p) => c.permissions[p.key]).length;
                  return (
                    <article
                      key={c.id}
                      className="card-soft rounded-2xl border border-border bg-card p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {c.business || "Sin nombre"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {(c.catalogIds?.length ? c.catalogIds : [c.catalogId]).map((id) => state.catalogs[id]?.name ?? id).join(" · ")} · vence {c.expiresOn}{" "}
                            · {perms} permiso(s)
                          </p>
                        </div>
                        <Badge className={STATUS_STYLES[status]}>{status}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDraft(c);
                            setNewCode("");
                            setConfirmCode("");
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            saveClient({
                              ...c,
                              suspended: !c.suspended,
                              updatedAt: new Date().toISOString(),
                            })
                          }
                        >
                          {c.suspended ? "Activar" : "Suspender"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            saveClient({
                              ...c,
                              expiresOn: addMonths(
                                c.expiresOn < todayISO() ? todayISO() : c.expiresOn,
                                1,
                              ),
                              suspended: false,
                              updatedAt: new Date().toISOString(),
                            })
                          }
                        >
                          Renovar 1 mes
                        </Button>
                        <ConfirmButton
                          title={`¿Eliminar el acceso de ${c.business || "este cliente"}?`}
                          description="Su clave dejará de funcionar."
                          confirmLabel="Eliminar"
                          onConfirm={() => deleteClient(c.id)}
                        >
                          <Button size="sm" variant="ghost" className="text-destructive">
                            Eliminar
                          </Button>
                        </ConfirmButton>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Botón "Mi menú": entrada de clientes con su clave. */
export function ClientMenuButton() {
  const { isAdmin, isClient, clientSession, clientLogin, clientLogout, catalog } =
    useCatalogStore();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setError("");
  }, [open]);

  if (isAdmin) return null;

  if (isClient) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className="h-10 rounded-full px-4"
        onClick={clientLogout}
      >
        <LogOut className="size-4" />
        <span className="max-w-[9rem] truncate">
          Salir de {clientSession?.business || "mi menú"}
        </span>
      </Button>
    );
  }

  const waNumber = (catalog.whatsappNumber || "").replace(/\D/g, "");
  const askLink = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(
        "Hola MA², quiero solicitar una clave de acceso para mi menú.",
      )}`
    : null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-10 rounded-full border-primary/30 px-4 font-semibold text-primary"
        onClick={() => setOpen(true)}
      >
        <Store className="size-4" />
        Mi menú
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Entrar a mi menú</DialogTitle>
            <DialogDescription>
              Escribe el usuario y contraseña que te asignó MA².
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const res = await clientLogin(username, code);
              setBusy(false);
              if (res.ok) {
                setUsername("");
                setCode("");
                setOpen(false);
              } else {
                setError(res.error ?? "No pudimos validar tu clave");
              }
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="client-user">Usuario</Label>
              <Input id="client-user" value={username} placeholder="Tu usuario" autoCapitalize="none" autoCorrect="off" onChange={(e) => { setUsername(e.target.value); if (error) setError(""); }} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="client-code">Contraseña</Label>
              <div className="relative">
                <Input id="client-code" type={showPassword ? "text" : "password"} value={code} placeholder="Tu contraseña" aria-invalid={!!error} className={`${error ? "border-destructive " : ""}pr-10`} onChange={(e) => { setCode(e.target.value); if (error) setError(""); }} />
                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 size-8 -translate-y-1/2" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>
              </div>
            </div>

            <p className="text-[12px] leading-snug text-muted-foreground">
              ¿Tienes tu propio catálogo hecho con MA² (tu enlace martgor.shop)?{" "}
              <a href="/acceso" className="font-semibold text-primary underline">
                Entra aquí con tu contraseña
              </a>
              .
            </p>

            {error ? (
              <div
                role="alert"
                className="grid gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3"
              >
                <p className="flex items-start gap-2 text-sm font-semibold text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {error}
                </p>
                <p className="text-[12px] leading-snug text-muted-foreground">
                  Revisa que la clave esté completa y sin espacios. Si ya
                  venció o sigue sin funcionar, pide a MA² que te renueve el acceso.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-full text-xs"
                    onClick={() => {
                      setUsername("");
                      setCode("");
                      setError("");
                      document.getElementById("client-code")?.focus();
                    }}
                  >
                    Volver a intentar
                  </Button>
                  {askLink ? (
                    <Button
                      asChild
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 rounded-full text-xs"
                    >
                      <a href={askLink} target="_blank" rel="noreferrer">
                        Solicitar acceso por WhatsApp
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <Button type="submit" disabled={busy}>
                {busy ? "Validando…" : "Entrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
