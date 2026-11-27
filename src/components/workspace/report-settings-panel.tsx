import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSavedCode } from "@/lib/notify/client";
import { REPORT_DAYS, type ReportSettings } from "@/lib/reports/settings";
import { reportSettingsLoad, reportSettingsSave } from "@/lib/reports/settings.functions";

export function ReportSettingsPanel() {
  const [value, setValue] = useState<ReportSettings | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void reportSettingsLoad({ data: { code: getSavedCode() } }).then(setValue).catch((error: Error) => setError(error.message));
  }, []);

  if (!value) return <p className="seller-card" role={error ? "alert" : "status"}>{error || "Cargando ajustes…"}</p>;

  return (
    <form className="seller-card space-y-5" onSubmit={async (event) => {
      event.preventDefault();
      setSaving(true);
      setError("");
      try {
        setValue(await reportSettingsSave({ data: { code: getSavedCode(), settings: value } }));
        toast.success("Ajustes de reportes guardados");
      } catch (error) {
        setError(error instanceof Error ? error.message : "No se pudieron guardar los ajustes.");
      } finally {
        setSaving(false);
      }
    }}>
      <div>
        <h2 className="font-bold">Horario de recepción</h2>
        <p className="text-sm text-muted-foreground">Fuera del horario, el cliente ve cuándo puedes recibir su reporte. Todas las horas son de Saltillo.</p>
      </div>
      <fieldset className="space-y-3" disabled={saving}>
        <legend className="mb-2 text-sm font-medium">Días de atención</legend>
        <div className="flex flex-wrap gap-2">
          {REPORT_DAYS.map((day, index) => {
            const active = value.days.includes(index);
            return <Button key={day} type="button" variant={active ? "default" : "outline"}
              size="sm" aria-pressed={active} onClick={() => setValue({ ...value, days: active
                ? value.days.filter((day) => day !== index)
                : [...value.days, index] })}>
              {day}
            </Button>;
          })}
        </div>
        {!value.days.length && <p className="text-sm text-muted-foreground">La recepción quedará pausada.</p>}
        <div className="grid grid-cols-2 gap-3">
          <label className="seller-field"><span>Desde</span><Input type="time" required value={value.from}
            onChange={(event) => setValue({ ...value, from: event.target.value })} /></label>
          <label className="seller-field"><span>Hasta</span><Input type="time" required value={value.until}
            onChange={(event) => setValue({ ...value, until: event.target.value })} /></label>
        </div>
        {value.from > value.until && <p className="text-sm text-muted-foreground">El cierre será al día siguiente.</p>}
      </fieldset>
      <fieldset className="space-y-3" disabled={saving}>
        <legend className="mb-2 font-bold">Requisitos del reporte</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value.requireEvidence}
            onChange={(event) => setValue({ ...value, requireEvidence: event.target.checked })} />
          Pedir captura obligatoria
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value.allowManual}
            onChange={(event) => setValue({ ...value, allowManual: event.target.checked })} />
          Aceptar reportes sin compra web vinculada
        </label>
      </fieldset>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button disabled={saving}>{saving ? "Guardando…" : "Guardar ajustes"}</Button>
    </form>
  );
}
