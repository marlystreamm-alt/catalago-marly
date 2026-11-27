/** Acceso del dueño de un catálogo vendido: /acceso */
import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ownerSignIn } from "@/lib/menus/owner.functions";
import { StoreBusinessPage } from "@/components/sales/store-business-page";
import { saveOwnerToken } from "@/lib/menus/owner-session";

export const Route = createFileRoute("/acceso")({
  head: () => ({
    meta: [
      { title: "Mi tienda — Acceso para negocios | MA² Connect" },
      {
        name: "description",
        content: "Entra a tu catálogo con la contraseña que te dio MA² Connect y edítalo.",
      },
      { property: "og:title", content: "Mi tienda — Acceso para negocios" },
      {
        property: "og:description",
        content: "Entra a tu catálogo con la contraseña que te dio MA² Connect y edítalo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccessPage,
});

function AccessPage() {
  const navigate = useNavigate();
  const requestedCatalog =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("catalogo") || ""
      : "";
  const requestedUsername =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("usuario") || ""
      : "";
  const [username, setUsername] = useState(requestedUsername);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await ownerSignIn({
        data: { username: username.trim().toLowerCase(), password },
      });
      saveOwnerToken(res.token);
      toast.success("Bienvenido");
      if (requestedCatalog)
        window.location.assign(`/mi-catalogo?catalogo=${encodeURIComponent(requestedCatalog)}`);
      else void navigate({ to: "/mi-catalogo" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo entrar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <StoreBusinessPage actions={<Button size="sm" variant="ghost" asChild><Link to="/plataforma">Ver planes</Link></Button>}>
      <div className="mx-auto max-w-md px-4 py-6 sm:py-10">
      <form
        onSubmit={submit}
        className="seller-card space-y-4"
      >
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <KeyRound className="size-5 text-primary" aria-hidden="true" /> Acceso a mi negocio
        </h1>
        <div className="space-y-1.5">
          <Label htmlFor="username">Usuario</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Tu usuario"
            required
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pass">Contraseña</Label>
          <Input
            id="pass"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <Button type="submit" disabled={busy} className="w-full rounded-xl">
          {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
          Entrar
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          ¿Olvidaste tu contraseña? Pídele una nueva a MA² Connect.
        </p>

      </form>
      </div>
    </StoreBusinessPage>
  );
}
