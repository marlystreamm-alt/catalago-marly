import { createFileRoute } from "@tanstack/react-router";

type Row = Record<string, unknown>;

function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const paths = new Set<string>(["/"]);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: spaces } = await supabaseAdmin.from("menu_spaces").select("slug,business_id,hidden").eq("hidden", false);
          const ids = [...new Set((spaces ?? []).map((r) => String((r as Row)["business_id"] ?? "")).filter(Boolean))];
          const active = new Set<string>();
          if (ids.length) {
            const { data: businesses } = await supabaseAdmin.from("menu_businesses").select("id,active,expires_on").in("id", ids).eq("active", true);
            const today = new Date().toISOString().slice(0, 10);
            for (const row of businesses ?? []) {
              const r = row as Row;
              const expires = String(r["expires_on"] ?? "");
              if (!expires || expires >= today) active.add(String(r["id"] ?? ""));
            }
          }
          for (const row of spaces ?? []) {
            const r = row as Row;
            const id = String(r["business_id"] ?? "");
            const slug = String(r["slug"] ?? "").trim();
            if (slug && active.has(id)) paths.add(`/${encodeURIComponent(slug)}`);
          }
        } catch (error) {
          console.error("No se pudieron cargar enlaces del sitemap", error);
        }

        const urls = [...paths].map((path) => [
          "  <url>",
          `    <loc>${esc(`${origin}${path}`)}</loc>`,
          `    <changefreq>${path === "/" ? "weekly" : "daily"}</changefreq>`,
          `    <priority>${path === "/" ? "1.0" : "0.8"}</priority>`,
          "  </url>",
        ].join("\n"));

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls,
          "</urlset>",
        ].join("\n");
        return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
