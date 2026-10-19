import { copyText } from "@/lib/browser/clipboard";
import { useEffect, useRef, useState } from "react";
import { Copy, Download, KeyRound, LockKeyhole, LogOut, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
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
import { useCatalogStore } from "@/lib/catalog/store";
import { RECOVERY_EMAIL } from "@/lib/catalog/auth";
import { ConfirmButton } from "./confirm-button";

function RecoveryNotice({ code }: { code: string }) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
      <p className="text-sm font-semibold text-foreground">Código de recuperación</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Guárdalo en un lugar seguro. Es la única forma de restablecer la contraseña en este
        dispositivo y solo se muestra una vez.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 select-all rounded-xl bg-card px-3 py-2 text-center text-sm font-bold tracking-widest">
          {code}
        </code>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Copiar código"
          onClick={async () => {
            try {
              await copyText(code);
              toast.success("Código copiado");
            } catch {
              toast.error("Copia el código manualmente");
            }
          }}
        >
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function PasswordDialog({
  open,
  onOpenChange,
  forced,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forced?: boolean;
}) {
  const { changePassword } = useCatalogStore();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCurrent("");
      setNext("");
      setRepeat("");
      setError(null);
      setCode(null);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (forced && !code && !value) return;
        onOpenChange(value);
      }}
    >
      <DialogContent
        className="sm:max-w-sm"
        hideClose={Boolean(forced && !code)}
        onEscapeKeyDown={(event) => {
          if (forced && !code) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (forced && !code) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {forced ? "Cambia la contraseña inicial" : "Cambiar contraseña"}
          </DialogTitle>
          <DialogDescription>
            {forced
              ? "Por seguridad, rota la contraseña temporal antes de seguir editando."
              : "La contraseña se guarda protegida en el servidor y se aplica a tus herramientas privadas."}
          </DialogDescription>
        </DialogHeader>

        {code ? (
          <div className="grid gap-3">
            <RecoveryNotice code={code} />
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Listo</Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              if (next !== repeat) {
                setError("Las contraseñas nuevas no coinciden");
                return;
              }
              setBusy(true);
              const result = await changePassword(current, next);
              setBusy(false);
              if (!result.ok) {
                setError(result.error ?? "No se pudo cambiar la contraseña");
                return;
              }
              if (result.recoveryCode) setCode(result.recoveryCode);
              else onOpenChange(false);
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="cur-pass">Contraseña actual</Label>
              <Input
                id="cur-pass"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-pass">Nueva contraseña</Label>
              <Input
                id="new-pass"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 8 caracteres, con letra y número.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rep-pass">Repetir contraseña</Label>
              <Input
                id="rep-pass"
                type="password"
                autoComplete="new-password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                {busy ? "Guardando…" : "Guardar contraseña"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LoginDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { login, resetPassword, requestRecoveryEmail, completeEmailRecovery } = useCatalogStore();
  const [mode, setMode] = useState<"login" | "reset" | "email-reset">("login");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setMode("login");
      setPassword("");
      setCode("");
      setNext("");
      setError(null);
      setNewCode(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === "login" ? "Acceso de administrador" : "Restablecer contraseña"}
          </DialogTitle>
          <DialogDescription>
            {mode === "login"
              ? "Escribe la contraseña para editar los catálogos."
              : mode === "email-reset"
                ? `El enlace de recuperación se envía a ${RECOVERY_EMAIL}.`
                : "Usa tu código de recuperación para crear una contraseña nueva."}
          </DialogDescription>
        </DialogHeader>

        {newCode ? (
          <div className="grid gap-3">
            <RecoveryNotice code={newCode} />
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Listo</Button>
            </DialogFooter>
          </div>
        ) : mode === "login" ? (
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const ok = await login(password);
              setBusy(false);
              if (ok) {
                setPassword("");
                onOpenChange(false);
              }
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="admin-pass">Contraseña</Label>
              <Input
                id="admin-pass"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMode("email-reset")}
              >
                ¿Olvidaste tu contraseña?
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Validando…" : "Entrar"}
              </Button>
            </DialogFooter>
          </form>
        ) : mode === "email-reset" ? (
          <div className="grid gap-3">
            <div className="rounded-2xl border bg-muted/30 p-3 text-sm">
              <p className="font-medium">Correo de recuperación</p>
              <p className="mt-1 text-muted-foreground">{RECOVERY_EMAIL}</p>
            </div>
            <Button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                const result = await requestRecoveryEmail();
                setBusy(false);
                if (!result.ok) setError(result.error ?? "No se pudo enviar el correo");
              }}
            >
              {busy ? "Enviando…" : "Enviar enlace a mi correo"}
            </Button>
            <div className="grid gap-1.5">
              <Label htmlFor="email-rec-pass">Nueva contraseña</Label>
              <Input
                id="email-rec-pass"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={busy || next.length < 8}
              onClick={async () => {
                setBusy(true);
                setError(null);
                const result = await completeEmailRecovery(next);
                setBusy(false);
                if (!result.ok) {
                  setError(result.error ?? "No se pudo restablecer la contraseña");
                  return;
                }
                setNewCode(result.recoveryCode ?? null);
              }}
            >
              Ya abrí el enlace · Guardar nueva contraseña
            </Button>
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            <div className="flex justify-between gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode("login")}>
                Volver
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode("reset")}>
                Usar código de recuperación
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setBusy(true);
              const result = await resetPassword(code, next);
              setBusy(false);
              if (!result.ok) {
                setError(result.error ?? "No se pudo restablecer la contraseña");
                return;
              }
              setNewCode(result.recoveryCode ?? null);
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="rec-code">Código de recuperación</Label>
              <Input
                id="rec-code"
                value={code}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rec-pass">Nueva contraseña</Label>
              <Input
                id="rec-pass"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            <DialogFooter className="sm:justify-between">
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode("login")}>
                Volver
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Guardando…" : "Restablecer"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AdminBar() {
  const { isAdmin, mustChangePassword, logout, exportBackup, importBackup, resetAll } =
    useCatalogStore();
  const [open, setOpen] = useState(false);
  const [passOpen, setPassOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdmin && mustChangePassword) setPassOpen(true);
  }, [isAdmin, mustChangePassword]);

  if (!isAdmin) {
    return (
      <>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <LockKeyhole className="size-4" />
          Administrador
        </Button>
        <LoginDialog open={open} onOpenChange={setOpen} />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setToolsOpen(true)}>
          <KeyRound className="size-4" />
          Cuenta y respaldo
        </Button>
        <Button variant="secondary" size="sm" onClick={logout}>
          <LogOut className="size-4" />
          Cerrar sesión
        </Button>
      </div>
      <Dialog open={toolsOpen} onOpenChange={setToolsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cuenta y respaldo</DialogTitle>
            <DialogDescription>
              Acceso, contraseña y respaldo general de MA² en un solo lugar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button variant="outline" className="justify-start" onClick={exportBackup}>
              <Download className="size-4" /> Exportar respaldo general
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" /> Importar respaldo general
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const text = await file.text();
                importBackup(text);
              }}
            />
            <Button
              variant={mustChangePassword ? "default" : "outline"}
              className="justify-start"
              onClick={() => setPassOpen(true)}
            >
              <KeyRound className="size-4" /> Cambiar contraseña
            </Button>
            <ConfirmButton
              title="¿Restaurar los catálogos iniciales?"
              description="Se perderán los cambios que no hayas exportado."
              confirmLabel="Restaurar"
              onConfirm={resetAll}
            >
              <Button variant="outline" className="w-full justify-start">
                <RotateCcw className="size-4" /> Restaurar catálogos iniciales
              </Button>
            </ConfirmButton>
            <Button variant="secondary" className="justify-start" onClick={logout}>
              <LogOut className="size-4" /> Cerrar sesión de administradora
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <PasswordDialog open={passOpen} onOpenChange={setPassOpen} forced={mustChangePassword} />
    </>
  );
}
