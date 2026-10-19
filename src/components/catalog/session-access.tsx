import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  BookOpen,
  FileDown,
  FileText,
  Eye,
  EyeOff,
  History,
  KeyRound,
  LogIn,
  LogOut,
  Menu,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Settings2,
  Shield,
  ShoppingBag,
  Store,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCatalogStore } from "@/lib/catalog/store";
import { ownerSignIn } from "@/lib/menus/owner.functions";
import { saveOwnerToken } from "@/lib/menus/owner-session";
import { NotificationsDialog } from "./notifications-dialog";
import { CyberDocsOrdersDialog } from "./cyberdocs-orders-dialog";
import { MenusDialog } from "./menus-dialog";
import { MethodsDialog } from "./methods-dialog";
import { SalesDialog } from "./sales-dialog";
import { SystemStatusDialog } from "./system-status-dialog";
import { SecurityPinDialog } from "./security-pin-dialog";
import { StockManagerDialog } from "./stock-manager-dialog";
import { AdminBar } from "./admin-bar";
import { CatalogManager } from "./catalog-manager";
import { ALL_CATEGORIES } from "@/lib/catalog/prefs";

type AdminDrawerProps = {
  onAddService: () => void;
  onCatalogSettings: () => void;
  onCategories: () => void;
  onHistory: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  exportDisabled?: boolean;
};

export function SessionAccess(props: AdminDrawerProps) {
  const {
    isAdmin,
    isClient,
    clientSession,
    login,
    clientLogout,
    requestRecoveryEmail,
    completeEmailRecovery,
  } = useCatalogStore();
  const [loginOpen, setLoginOpen] = useState(false);
  const [role, setRole] = useState<"cliente" | "admin">("cliente");
  const [password, setPassword] = useState("");
  const [clientUsername, setClientUsername] = useState("");
  const [clientPassword, setClientPassword] = useState("");
  const [showClientPassword, setShowClientPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [adminRecovery, setAdminRecovery] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const loginWasOpen = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin_recovery") !== "1") return;
    setRole("admin");
    setAdminRecovery(true);
    setLoginOpen(true);
    params.delete("admin_recovery");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, []);

  useEffect(() => {
    if (loginWasOpen.current && !loginOpen) {
      setPassword("");
      setClientUsername("");
      setClientPassword("");
      setShowClientPassword(false);
      setError("");
      setBusy(false);
      setAdminRecovery(false);
      setRecoverySent(false);
      setNewPassword("");
    }
    loginWasOpen.current = loginOpen;
  }, [loginOpen]);

  if (isAdmin) return <AdminDrawer {...props} />;

  if (isClient) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="secondary" size="sm" className="h-10 rounded-xl px-3">
            <Menu className="size-4" />
            Menú
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[86vw] max-w-sm overflow-y-auto p-0">
          <div className="border-b bg-card p-5">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-primary">MA²</p>
            <SheetHeader className="text-left">
              <SheetTitle>{clientSession?.business || "Mi menú"}</SheetTitle>
              <SheetDescription>Acceso de cliente</SheetDescription>
            </SheetHeader>
          </div>
          <div className="grid gap-2 p-4">
            <div className="rounded-2xl border bg-muted/30 p-3 text-sm">
              <p className="font-semibold">Tu catálogo</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Aquí verás únicamente las funciones habilitadas para tu acceso.
              </p>
            </div>
            <Button variant="outline" className="justify-start" onClick={clientLogout}>
              <LogOut className="size-4" /> Cerrar sesión
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <>
      <Button size="sm" className="h-10 rounded-xl px-4" onClick={() => setLoginOpen(true)}>
        <LogIn className="size-4" />
        Iniciar sesión
      </Button>
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md rounded-3xl p-5 sm:p-6">
          <DialogHeader className="text-left">
            <div className="mb-2 flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Store className="size-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-primary">MA²</p>
                <DialogTitle className="text-xl">Bienvenido de nuevo</DialogTitle>
              </div>
            </div>
            <DialogDescription>Elige tu tipo de acceso para continuar.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
            <Button
              type="button"
              variant={role === "cliente" ? "default" : "ghost"}
              className="rounded-xl"
              onClick={() => {
                setRole("cliente");
                setError("");
              }}
            >
              <UserRound className="size-4" /> Cliente
            </Button>
            <Button
              type="button"
              variant={role === "admin" ? "default" : "ghost"}
              className="rounded-xl"
              onClick={() => {
                setRole("admin");
                setError("");
              }}
            >
              <Shield className="size-4" /> Administradora
            </Button>
          </div>

          {role === "cliente" ? (
            <form
              className="grid gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const result = await ownerSignIn({
                    data: {
                      username: clientUsername.trim().toLowerCase(),
                      password: clientPassword,
                    },
                  });
                  saveOwnerToken(result.token);
                  setLoginOpen(false);
                  window.location.assign("/mi-catalogo");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Usuario o contraseña incorrectos");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="ma2-client-user">Usuario</Label>
                <Input
                  id="ma2-client-user"
                  value={clientUsername}
                  onChange={(e) => setClientUsername(e.target.value)}
                  placeholder="Ingresa tu usuario"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ma2-client-password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="ma2-client-password"
                    type={showClientPassword ? "text" : "password"}
                    value={clientPassword}
                    onChange={(e) => setClientPassword(e.target.value)}
                    placeholder="Ingresa tu contraseña"
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
                    onClick={() => setShowClientPassword((v) => !v)}
                    aria-label={showClientPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showClientPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
              {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
              <Button
                type="submit"
                className="h-11 rounded-xl"
                disabled={busy || !clientUsername.trim() || !clientPassword}
              >
                {busy ? "Validando…" : "Iniciar sesión"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Tu usuario, contraseña y permisos los administra MA².
              </p>
            </form>
          ) : adminRecovery ? (
            <div className="grid gap-4">
              <div className="rounded-2xl border bg-muted/30 p-3 text-sm">
                <p className="font-semibold">Recuperación segura</p>
                <p className="mt-1 text-muted-foreground">
                  El enlace se enviará únicamente a marlystreamm@gmail.com.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={busy || recoverySent}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  const result = await requestRecoveryEmail();
                  setBusy(false);
                  if (!result.ok) {
                    setError(result.error ?? "No se pudo enviar el correo");
                    return;
                  }
                  setRecoverySent(true);
                }}
              >
                {busy ? "Enviando…" : recoverySent ? "Enlace enviado" : "Enviar enlace a mi correo"}
              </Button>
              {recoverySent ? (
                <p className="rounded-2xl bg-primary/5 p-3 text-sm">
                  Revisa tu correo y abre el enlace. Regresarás aquí para crear tu contraseña nueva.
                </p>
              ) : null}
              <div className="grid gap-1.5">
                <Label htmlFor="ma2-admin-new-pass">Nueva contraseña</Label>
                <Input
                  id="ma2-admin-new-pass"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Mínimo 8 caracteres, letra y número"
                  autoComplete="new-password"
                />
              </div>
              {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
              <Button
                type="button"
                className="h-11 rounded-xl"
                disabled={busy || newPassword.trim().length < 8}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  const result = await completeEmailRecovery(newPassword);
                  if (!result.ok) {
                    setBusy(false);
                    setError(result.error ?? "Abre primero el enlace enviado a tu correo");
                    return;
                  }
                  const loggedIn = await login(newPassword);
                  setBusy(false);
                  if (loggedIn) setLoginOpen(false);
                }}
              >
                {busy ? "Guardando…" : "Guardar contraseña y entrar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setAdminRecovery(false);
                  setError("");
                }}
              >
                Volver al inicio de sesión
              </Button>
            </div>
          ) : (
            <form
              className="grid gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                const ok = await login(password);
                setBusy(false);
                if (!ok) {
                  setError("Contraseña incorrecta o acceso temporalmente bloqueado");
                  return;
                }
                setLoginOpen(false);
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="ma2-admin-pass">Contraseña</Label>
                <Input
                  id="ma2-admin-pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
              <Button type="submit" className="h-11 rounded-xl" disabled={busy}>
                {busy ? "Validando…" : "Entrar como administradora"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAdminRecovery(true);
                  setError("");
                }}
              >
                <KeyRound className="size-4" />
                ¿Olvidaste tu contraseña?
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PanelGroup({ title, description, children, className = "" }: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ma2-panel-group ${className}`} aria-label={title}>
      <div className="ma2-panel-group-heading">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="ma2-panel-actions">{children}</div>
    </section>
  );
}

function AdminDrawer({ onExportCsv, onExportPdf, exportDisabled }: AdminDrawerProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" className="h-10 rounded-xl px-3">
          <Menu className="size-4" /> Panel
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="ma2-admin-panel w-[92vw] max-w-sm overflow-hidden p-0 sm:max-w-sm">
        <header className="ma2-panel-header">
          <div className="ma2-panel-brand" aria-hidden="true">MA²</div>
          <SheetHeader className="min-w-0 text-left">
            <p className="ma2-panel-eyebrow">MI TIENDA MA²</p>
            <SheetTitle className="text-xl leading-tight">Tu panel</SheetTitle>
            <SheetDescription className="text-xs leading-relaxed">
              Todo para administrar tu negocio.
            </SheetDescription>
          </SheetHeader>
        </header>

        <nav aria-label="Administración del negocio" className="ma2-panel-scroll">
          <PanelGroup title="Tu operación" description="Pedidos e inventario, a la mano." className="ma2-panel-primary">
            <CyberDocsOrdersDialog />
            <StockManagerDialog />
          </PanelGroup>

          <PanelGroup title="Clientes y catálogo" description="Organiza tus servicios y tus ventas.">
            <MenusDialog />
            <SalesDialog />
            <SheetClose asChild>
              <Button type="button" variant="outline" onClick={() =>
                setTimeout(() => document.getElementById("ma2-catalog-workspace")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" }), 120)
              }>
                <Store className="size-4" /> Editar servicios del catálogo
              </Button>
            </SheetClose>
          </PanelGroup>

          <PanelGroup title="Avisos e instrucciones" description="Notificaciones y métodos de trabajo.">
            <NotificationsDialog />
            <MethodsDialog />
          </PanelGroup>

          <PanelGroup title="Exportar información" description="Descarga los resultados de tu búsqueda.">
            <div className="ma2-panel-export-grid">
              <Button variant="outline" onClick={onExportCsv} disabled={exportDisabled}>
                <FileDown className="size-4" /> CSV
              </Button>
              <Button variant="outline" onClick={onExportPdf} disabled={exportDisabled}>
                <FileText className="size-4" /> PDF
              </Button>
            </div>
          </PanelGroup>

          <PanelGroup title="Tu cuenta" description="Seguridad, respaldos y configuración.">
            <SecurityPinDialog />
            <SystemStatusDialog />
            <AdminBar />
          </PanelGroup>
          <p className="ma2-panel-footer"><Shield className="size-3.5" aria-hidden="true" /> Área privada de administradora</p>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
