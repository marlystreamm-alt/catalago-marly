import { opsDB } from "@/lib/workspace/operations.server";
import { DEFAULT_REPORT_SETTINGS, type ReportSettings } from "./settings";

export async function loadReportSettings(): Promise<ReportSettings> {
  const { data, error } = await opsDB()
    .from("ma2_report_settings")
    .select("days,opens_at,closes_at,require_evidence,allow_manual")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error("No se pudieron consultar los ajustes de reportes.");
  return data ? {
    days: data.days,
    from: data.opens_at,
    until: data.closes_at,
    requireEvidence: data.require_evidence,
    allowManual: data.allow_manual,
  } : DEFAULT_REPORT_SETTINGS;
}

export async function saveReportSettings(settings: ReportSettings): Promise<ReportSettings> {
  const days = [...new Set(settings.days)].sort((a, b) => a - b);
  const { error } = await opsDB().from("ma2_report_settings").upsert({
    id: 1,
    days,
    opens_at: settings.from,
    closes_at: settings.until,
    require_evidence: settings.requireEvidence,
    allow_manual: settings.allowManual,
  });
  if (error) throw new Error("No se pudieron guardar los ajustes de reportes.");
  return { ...settings, days };
}
