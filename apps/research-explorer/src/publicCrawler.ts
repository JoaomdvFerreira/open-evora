export const PRODUCTION_ORIGIN = "https://open-evora.vercel.app";

/**
 * WU047 intentionally lists only existing, path-based public routes. Explorer
 * problem and record selection is query-state routing, so detail URLs are not
 * sitemap entries until a separately authorised routing change exists.
 */
export const PUBLIC_SITEMAP_PATHS = [
  "/",
  "/about",
  "/methodology",
  "/corrections",
  "/contact",
  "/privacy",
] as const;

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&apos;",
  })[character] as string);
}

export function sitemapUrls(paths = PUBLIC_SITEMAP_PATHS): string[] {
  return paths.map((path) => `${PRODUCTION_ORIGIN}${path}`);
}

export function sitemapXml(paths = PUBLIC_SITEMAP_PATHS): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls(paths).map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n")}\n</urlset>\n`;
}

export function robotsTxt(): string {
  return `User-agent: *\nAllow: /\nSitemap: ${PRODUCTION_ORIGIN}/sitemap.xml\n`;
}
