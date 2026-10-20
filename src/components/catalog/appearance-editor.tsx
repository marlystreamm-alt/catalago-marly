import { BusinessCover } from "./business-cover";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  normalizeAppearance,
  appearanceStyle,
  type Appearance,
} from "@/lib/appearance/theme";
import {
  appearanceUploadTicket,
  businessSaveAppearance,
} from "@/lib/appearance/appearance.functions";
import { supabase } from "@/integrations/supabase/client";
import { getSavedCode } from "@/lib/notify/client";
export function AppearanceEditor({
  value,
  onChange,
  ownerToken,
  onBusyChange,
}: {
  value?: Partial<Appearance>;
  onChange: (value: Appearance) => void;
  ownerToken?: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const a = normalizeAppearance(value);
  const [busy, setBusy] = useState("");
  const id = useId();
  const latest = useRef(a);
  latest.current = a;
  const patch = (p: Partial<Appearance>) => {
    latest.current = { ...latest.current, ...p };
    onChange(latest.current);
  };
  return (
    <div className="space-y-4 rounded-2xl border p-3">
      <div>
        <h3 className="text-sm font-semibold">Portada y diseño de temporada</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Los cambios se aplican solo a este catálogo y también se ven en su
          enlace público.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["coverImage", "Foto de portada del encabezado"],
            ["logoImage", "Logo del negocio"],
            ["cardImage", "Imagen de temporada en las tarjetas"],
            ["pageImage", "Fondo de la página"],
          ] as const
        ).map(([field, label]) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={`${id}-${field}`}>{label}</Label>
            <Input
              id={`${id}-${field}`}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={Boolean(busy)}
              onChange={async (e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (!file) return;
                if (file.size > 5_242_880)
                  return toast.error("Selecciona una imagen de máximo 5 MB");
                setBusy(field);
                onBusyChange?.(true);
                try {
                  const ticket = await appearanceUploadTicket({
                    data: {
                      ...(ownerToken
                        ? { ownerToken }
                        : { code: getSavedCode() }),
                      contentType: file.type as
                        "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                      size: file.size,
                    },
                  });
                  const result = await supabase.storage
                    .from("ma2-images")
                    .uploadToSignedUrl(ticket.path, ticket.token, file, {
                      contentType: file.type,
                    });
                  if (result.error)
                    throw new Error("No se pudo subir la imagen");
                  patch({ [field]: ticket.url });
                  toast.success(
                    "Imagen subida. Guarda los ajustes para aplicarla.",
                  );
                } catch (e) {
                  toast.error(
                    e instanceof Error
                      ? e.message
                      : "No se pudo subir la imagen",
                  );
                } finally {
                  setBusy("");
                  onBusyChange?.(false);
                }
              }}
            />
            {busy === field ? (
              <p role="status" className="text-xs">
                Subiendo imagen…
              </p>
            ) : null}
            {a[field] ? (
              <div className="flex items-center gap-2">
                <img
                  src={a[field]}
                  alt={`Vista previa: ${label}`}
                  className="h-20 w-28 rounded-lg border bg-muted/20 object-contain"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => patch({ [field]: "" })}
                >
                  Quitar
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div>
        <Label>Temporada</Label>
        <Select
          value={a.season}
          onValueChange={(season) =>
            patch({ season: season as Appearance["season"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Sin temporada</SelectItem>
            <SelectItem value="halloween">Halloween / otoño</SelectItem>
            <SelectItem value="navidad">Navidad</SelectItem>
            <SelectItem value="primavera">Primavera</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor={`${id}-opacity`}>
          Opacidad del fondo de tarjetas: {a.cardOpacity}%
        </Label>
        <Input
          id={`${id}-opacity`}
          type="range"
          min={0}
          max={100}
          value={a.cardOpacity}
          onChange={(e) => patch({ cardOpacity: Number(e.target.value) })}
        />
        <p className="text-xs text-muted-foreground">
          0% transparente · 100% sólido. El texto conserva su opacidad.
        </p>
      </div>
      <div>
        <Label htmlFor={`${id}-image-opacity`}>
          Intensidad de la imagen de temporada: {a.imageOpacity}%
        </Label>
        <Input
          id={`${id}-image-opacity`}
          type="range"
          min={0}
          max={100}
          value={a.imageOpacity}
          onChange={(e) => patch({ imageOpacity: Number(e.target.value) })}
        />
      </div>
      <div
        className="rounded-xl border p-3"
        style={appearanceStyle(a)}
        data-season={a.season}
      >
        <BusinessCover appearance={a} name="Tu negocio" />
        <div className="ma2-themed-card mt-3 rounded-xl border p-4">
          <b>Vista previa de una tarjeta</b>
          <p className="text-sm">
            El nombre, el precio y los botones siguen visibles.
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        type="button"
        disabled={Boolean(busy)}
        onClick={() => onChange(normalizeAppearance({}))}
      >
        Restablecer diseño
      </Button>
    </div>
  );
}
export function BusinessAppearanceEditor({
  businessId,
  initial,
  ownerToken,
}: {
  businessId: string;
  initial?: Partial<Appearance>;
  ownerToken?: string;
}) {
  const [value, setValue] = useState(normalizeAppearance(initial));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  useEffect(
    () => setValue(normalizeAppearance(initial)),
    [businessId, initial],
  );
  return (
    <div className="space-y-2">
      <AppearanceEditor
        value={value}
        onChange={setValue}
        ownerToken={ownerToken}
        onBusyChange={setUploading}
      />
      <Button
        disabled={busy || uploading}
        onClick={async () => {
          setBusy(true);
          try {
            await businessSaveAppearance({
              data: {
                businessId,
                appearance: value,
                ...(ownerToken ? { ownerToken } : { code: getSavedCode() }),
              },
            });
            toast.success("Diseño guardado para el catálogo del cliente");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "No se pudo guardar");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Guardando…" : "Guardar portada y diseño"}
      </Button>
    </div>
  );
}
