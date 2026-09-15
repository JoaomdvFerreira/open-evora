import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const APP_ROOT = fileURLToPath(new URL(".", import.meta.url));
const PRODUCTION_ORIGIN = "https://open-evora.vercel.app";
const TRUST_PAGE_INPUTS = ["about", "methodology", "corrections", "contact", "privacy"];

function publicCrawlerFiles(): Plugin {
  return {
    name: "public-crawler-files",
    generateBundle() {
      const index = JSON.parse(readFileSync(new URL("./generated/index.json", import.meta.url), "utf8")) as Array<{ id: string; type: string }>;
      const urls = [
        `${PRODUCTION_ORIGIN}/`,
        ...index.filter((record) => record.type === "PRB-").map((record) => `${PRODUCTION_ORIGIN}/?view=problem&amp;id=${encodeURIComponent(record.id)}`),
        ...index.map((record) => `${PRODUCTION_ORIGIN}/?view=records&amp;id=${encodeURIComponent(record.id)}`),
        ...TRUST_PAGE_INPUTS.map((path) => `${PRODUCTION_ORIGIN}/${path}`),
      ];
      this.emitFile({ type: "asset", fileName: "robots.txt", source: `User-agent: *\nAllow: /\nSitemap: ${PRODUCTION_ORIGIN}/sitemap.xml\n` });
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n")}\n</urlset>\n` });
    },
  };
}

// Static deployment portability (docs/explorerarchitecture.md): `base` defaults to
// "/" but can be overridden at build time (e.g. `VITE_BASE_PATH=/open-evora/
// npm run build`) for a future sub-path deployment such as GitHub Pages,
// without any application code change — see src/dataProvider/StaticDataProvider.ts,
// which always builds asset URLs from `import.meta.env.BASE_URL` rather than
// a hardcoded "/". Not configured/deployed yet (that is RE-07 scope).
const basePath = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  plugins: [react(), publicCrawlerFiles()],
  // RE-01's generated read model (apps/research-explorer/generated/) is
  // served directly as static assets, in both dev and production build, via
  // Vite's publicDir mechanism — no second, manually-maintained copy of the
  // data. `generated/` is gitignored and must exist before `vite dev`/`vite
  // build` run; the root `npm run explorer`/`explorer:build` commands always
  // run the RE-01 adapter first to guarantee that.
  publicDir: "generated",
  server: {
    strictPort: false,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        ...Object.fromEntries(TRUST_PAGE_INPUTS.map((path) => [path, `${APP_ROOT}${path}/index.html`])),
      },
    },
  },
  test: {
    // RE-02B adds a small number of interaction-level tests (row selection ->
    // lazy detail load, relationship navigation) that cannot be verified as
    // pure functions — jsdom + @testing-library/react are the minimal,
    // standard pairing for that, not "browser/E2E infrastructure" (no real
    // browser, no Playwright/Cypress). Most tests here remain plain
    // business/runtime-contract tests (StaticDataProvider, search/filter
    // logic, the records reducer) that don't touch the DOM at all.
    environment: "jsdom",
    setupFiles: ["src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
