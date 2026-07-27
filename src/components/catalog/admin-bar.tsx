import { useRef, useState } from "react";
import { Download, LockKeyhole, LogOut, RotateCcw, Upload } from "lucide-react";
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

export function AdminBar() {
  const { isAdmin, login, logout, exportBackup, importBackup, resetAll } = useCatalogStore();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!isAdmin) {
    return (
      <>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <LockKeyhole className="size-4" />
          Administrador
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Acceso de administrador</DialogTitle>
              <DialogDescription>Escribe la contraseña para editar los catálogos.</DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (login(password)) {
                  setPassword("");
                  setOpen(false);
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
              <DialogFooter>
                <Button type="submit">Entrar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
    </div>
  );
}
