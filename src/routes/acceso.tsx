/** Acceso del dueño de un catálogo vendido: /acceso */
import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ownerSignIn } from "@/lib/menus/owner.functions";
import { saveOwnerToken } from "@/lib/menus/owner-session";

export const Route = createFileRoute("/acceso")({
  head: () => ({
    meta: [
      { title: "Mi menú — Acceso para dueños | MA² Connect" },
      {
        name: "description",
        content: "Entra a tu catálogo con la contraseña que te dio MA² Connect y edítalo.",
      },
      { property: "og:title", content: "Mi menú — Acceso para dueños" },
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
  const [slug, setSlug] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await ownerSignIn({ data: { slug: slug.trim().toLowerCase(), password } });
      saveOwnerToken(res.token);
      toast.success("Bienvenido");
      void navigate({ to: "/mi-catalogo" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo entrar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background via-background to-secondary/40 px-4 py-10">
      <form
        onSubmit={submit}
        className="card-soft w-full max-w-sm space-y-4 rounded-3xl border border-border bg-card p-6"
      >
        <div className="text-center">
          <KeyRound className="mx-auto mb-2 size-7 text-primary" />
          <h1 className="text-xl font-bold">Mi menú</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entra con el nombre de tu enlace y tu contraseña.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug">Tu enlace</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="tacos-don-beto"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pass">Contraseña</Label>
          <Input
            id="pass"
            type="password"
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
        <Button asChild variant="ghost" size="sm" className="w-full rounded-xl">
          <Link to="/">Volver al inicio</Link>
        </Button>
      </form>
    </main>
  );
}
