/**
 * Catálogo de plataformas conocidas: imagen e información descriptiva.
 * Se usa solo como respaldo visual cuando un servicio no tiene imagen o
 * descripción propia; cualquier valor capturado por el administrador manda.
 */
import canva from "@/assets/platforms/canva.jpg.asset.json";
import clarovideo from "@/assets/platforms/clarovideo.jpg.asset.json";
import crunchyroll from "@/assets/platforms/crunchyroll.jpg.asset.json";
import disney from "@/assets/platforms/disney.jpg.asset.json";
import foxone from "@/assets/platforms/foxone.jpg.asset.json";
import gemini from "@/assets/platforms/gemini.jpg.asset.json";
import hbomax from "@/assets/platforms/hbomax.jpg.asset.json";
import iptv from "@/assets/platforms/iptv.jpg.asset.json";
import mubi from "@/assets/platforms/mubi.jpg.asset.json";
import paramount from "@/assets/platforms/paramount.jpg.asset.json";
import plex from "@/assets/platforms/plex.jpg.asset.json";
import primevideo from "@/assets/platforms/primevideo.jpg.asset.json";
import spotify from "@/assets/platforms/spotify.jpg.asset.json";
import vix from "@/assets/platforms/vix.jpg.asset.json";
import youtube from "@/assets/platforms/youtube.jpg.asset.json";

export type PlatformMeta = {
  /** Palabras clave (ya normalizadas) que identifican la plataforma. */
  keys: string[];
  image: string;
  description: string;
};

export const PLATFORMS: PlatformMeta[] = [
  {
    keys: ["netflix"],
    image: "",
    description:
      "Series, películas y documentales originales en HD. Compatible con celular, tablet, computadora y Smart TV.",
  },
  {
    keys: ["disney"],
    image: disney.url,
    description:
      "Todo Disney, Pixar, Marvel, Star Wars, National Geographic y Star en un solo lugar.",
  },
  {
    keys: ["hbo", "max"],
    image: hbomax.url,
    description:
      "Estrenos de Warner, series HBO, DC y contenido para toda la familia con calidad Full HD.",
  },
  {
    keys: ["prime video", "prime"],
    image: primevideo.url,
    description:
      "Películas, series y producciones originales de Amazon, con opción de descargar para ver sin internet.",
  },
  {
    keys: ["crunchyroll"],
    image: crunchyroll.url,
    description:
      "El catálogo más grande de anime, con estrenos simultáneos con Japón y sin anuncios.",
  },
  {
    keys: ["paramount"],
    image: paramount.url,
    description:
      "Series y películas de Paramount, MTV, Nickelodeon y Showtime, además de deportes en vivo.",
  },
  {
    keys: ["vix"],
    image: vix.url,
    description:
      "Contenido en español: novelas, cine mexicano, deportes y canales en vivo sin costo extra.",
  },
  {
    keys: ["fox one", "fox"],
    image: foxone.url,
    description: "Deportes en vivo, entretenimiento y noticias de la señal FOX en un solo servicio.",
  },
  {
    keys: ["plex"],
    image: plex.url,
    description: "Películas y estrenos organizados en una biblioteca personal, lista para ver.",
  },
  {
    keys: ["mubi"],
    image: mubi.url,
    description: "Cine de autor, clásicos e independiente seleccionado por curadores cada semana.",
  },
  {
    keys: ["claro video", "claro"],
    image: clarovideo.url,
    description: "Cine, series y canales en vivo incluidos, con contenido para toda la familia.",
  },
  {
    keys: ["iptv"],
    image: iptv.url,
    description:
      "Cientos de canales en vivo: deportes, películas y TV abierta, incluidos eventos especiales.",
  },
  {
    keys: ["spotify"],
    image: spotify.url,
    description: "Música y podcasts sin anuncios, con descargas para escuchar sin conexión.",
  },
  {
    keys: ["youtube"],
    image: youtube.url,
    description:
      "YouTube sin anuncios, con reproducción en segundo plano, descargas y YouTube Music.",
  },
  {
    keys: ["canva"],
    image: canva.url,
    description:
      "Diseño profesional con plantillas premium, quita fondos y миллones de recursos listos para usar.",
  },
  {
    keys: ["gemini"],
    image: gemini.url,
    description:
      "Asistente de inteligencia artificial de Google para escribir, estudiar y crear más rápido.",
  },
  {
    keys: ["apple tv"],
    image: "",
    description: "Series y películas originales de Apple, incluidos los partidos de la MLS.",
  },
];

const normalize = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Devuelve la información de la plataforma que coincide con el nombre del servicio. */
export function findPlatform(name: string): PlatformMeta | undefined {
  const n = normalize(name);
  let best: PlatformMeta | undefined;
  let bestLen = 0;
  for (const p of PLATFORMS) {
    for (const key of p.keys) {
      if (n.includes(key) && key.length > bestLen) {
        best = p;
        bestLen = key.length;
      }
    }
  }
  return best;
}

/** Imagen y descripción efectivas de un servicio (lo propio primero). */
export function resolveServiceMedia(service: { name: string; icon?: string; description?: string }) {
  const meta = findPlatform(service.name);
  return {
    icon: service.icon?.trim() || meta?.image || "",
    description: service.description?.trim() || meta?.description || "",
  };
}
