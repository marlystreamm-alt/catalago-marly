export type DeliveryFichaData = {
  platform?: string; username?: string; password?: string; link?: string;
  profilePin?: string; panelUrl?: string; panelUsername?: string; panelPassword?: string;
};

export const DEFAULT_FICHA_TEMPLATE = `📺: {plataforma}\n✉️: {correo}\n🔑: {contraseña}\n📎: {link}\n👤 Usuario panel: {usuario_panel}\n🔑 Contraseña panel: {contraseña_panel}\n🔢 Perfil / PIN: {perfil_pin}`;

export function renderDeliveryFicha(template: string, data: DeliveryFichaData) {
  const values: Record<string, string> = {
    "{plataforma}": data.platform || "",
    "{correo}": data.username || "",
    "{contraseña}": data.password || "",
    "{link}": data.panelUrl || data.link || "",
    "{usuario_panel}": data.panelUsername || "",
    "{contraseña_panel}": data.panelPassword || "",
    "{perfil_pin}": data.profilePin || "",
  };
  let out = template;
  Object.entries(values).forEach(([key, value]) => { out = out.replaceAll(key, value); });
  return out.split("\n").filter((line) => !line.trim().endsWith(":" ) && !/^[^:]+:\s*$/.test(line.trim())).join("\n").trim();
}

export type FichaTemplate = { id: string; name: string; body: string };
const KEY = "ma2_ficha_templates_v1";
export function loadFichaTemplates(): FichaTemplate[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {}
  return [{ id: "default", name: "Entrega completa", body: DEFAULT_FICHA_TEMPLATE }];
}
export function saveFichaTemplates(items: FichaTemplate[]) { localStorage.setItem(KEY, JSON.stringify(items)); }
export function getPrimaryFichaTemplate() { return loadFichaTemplates()[0]?.body || DEFAULT_FICHA_TEMPLATE; }

export type PanelPreset = { id: string; name: string; url: string; username: string; password: string };
const PANEL_KEY = "ma2_panel_presets_v1";
export function loadPanelPresets(): PanelPreset[] { try { const p=JSON.parse(localStorage.getItem(PANEL_KEY)||"[]"); return Array.isArray(p)?p:[]; } catch { return []; } }
export function savePanelPresets(items: PanelPreset[]) { localStorage.setItem(PANEL_KEY, JSON.stringify(items)); }
