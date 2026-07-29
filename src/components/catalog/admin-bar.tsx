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
              await navigator.clipboard.writeText(code);
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
    <Dialog open={open} onOpenChange={(v) => (code && !v ? onOpenChange(false) : onOpenChange(v))}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {forced ? "Cambia la contraseña inicial" : "Cambiar contraseña"}
          </DialogTitle>
          <DialogDescription>
            {forced
              ? "Por seguridad, rota la contraseña temporal antes de seguir editando."
              : "La contraseña se guarda cifrada (hash) solo en este dispositivo."}
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
              setCode(result.recoveryCode ?? null);
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
  const { login, resetPassword } = useCatalogStore();
  const [mode, setMode] = useState<"login" | "reset">("login");
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
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode("reset")}>
                ¿Olvidaste tu contraseña?
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Validando…" : "Entrar"}
              </Button>
            </DialogFooter>
          </form>
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
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={exportBackup}>
        <Download className="size-4" />
        Exportar
      </Button>
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
        <Upload className="size-4" />
        Importar
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
        size="sm"
        onClick={() => setPassOpen(true)}
      >
        <KeyRound className="size-4" />
        Contraseña
      </Button>
      <ConfirmButton
        title="¿Restaurar los catálogos iniciales?"
        description="Se perderán los cambios que no hayas exportado."
        confirmLabel="Restaurar"
        onConfirm={resetAll}
      >
        <Button variant="outline" size="sm">
          <RotateCcw className="size-4" />
          Restaurar
        </Button>
      </ConfirmButton>
      <Button variant="secondary" size="sm" onClick={logout}>
        <LogOut className="size-4" />
        Salir
      </Button>
      <PasswordDialog open={passOpen} onOpenChange={setPassOpen} forced={mustChangePassword} />
    </div>
  );
}
