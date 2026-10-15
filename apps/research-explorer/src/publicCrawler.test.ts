import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCTION_ORIGIN, PUBLIC_SITEMAP_PATHS, escapeXml, robotsTxt, sitemapUrls, sitemapXml } from "./publicCrawler";

describe("public crawler files", () => {
  it("uses the canonical public domain as the production origin", () => {
    expect(PRODUCTION_ORIGIN).toBe("https://openevora.pt");
  });

  it("lists exactly the approved path-based public routes deterministically", () => {
    expect(sitemapUrls()).toEqual([
      "https://openevora.pt/",
      "https://openevora.pt/about",
      "https://openevora.pt/methodology",
      "https://openevora.pt/corrections",
      "https://openevora.pt/contact",
      "https://openevora.pt/privacy",
    ]);
    expect(sitemapXml()).toBe(sitemapXml());
  });

  it("excludes query, fragment, duplicate, preview, and non-production URLs", () => {
    const urls = sitemapUrls();
    expect(urls).toHaveLength(PUBLIC_SITEMAP_PATHS.length);
    expect(new Set(urls).size).toBe(urls.length);
    for (const value of urls) {
      const url = new URL(value);
      expect(url.origin).toBe(PRODUCTION_ORIGIN);
      expect(url.search).toBe("");
      expect(url.hash).toBe("");
      expect(url.hostname).toBe("openevora.pt");
    }
  });

  it("contains home and every approved trust route as valid XML", () => {
    const xml = sitemapXml();
    const document = new DOMParser().parseFromString(xml, "application/xml");
    expect(document.querySelector("parsererror")).toBeNull();
    expect([...document.querySelectorAll("loc")].map((node) => node.textContent)).toEqual(sitemapUrls());
  });

  it("escapes XML location values", () => {
    expect(escapeXml(`a&b<c>d"e'f`)).toBe("a&amp;b&lt;c&gt;d&quot;e&apos;f");
  });

  it("keeps the approved crawler policy", () => {
    expect(robotsTxt()).toBe("User-agent: *\nAllow: /\nSitemap: https://openevora.pt/sitemap.xml\n");
  });
});

describe("static HTML entry canonical metadata", () => {
  const PATH_ENTRIES = ["/about", "/methodology", "/corrections", "/contact", "/privacy", "/out-of-scope"];

  function staticHead(entryPath: string): Document {
    const html = readFileSync(path.join(__dirname, "..", entryPath, "index.html"), "utf-8");
    return new DOMParser().parseFromString(html, "text/html");
  }

  it.each(PATH_ENTRIES)("%s declares its own production URL as canonical and og:url", (entryPath) => {
    const head = staticHead(entryPath);
    const canonical = head.querySelectorAll('link[rel="canonical"]');
    const ogUrl = head.querySelectorAll('meta[property="og:url"]');
    expect(canonical).toHaveLength(1);
    expect(ogUrl).toHaveLength(1);
    expect(canonical[0].getAttribute("href")).toBe(`${PRODUCTION_ORIGIN}${entryPath}`);
    expect(ogUrl[0].getAttribute("content")).toBe(`${PRODUCTION_ORIGIN}${entryPath}`);
  });

  it("every sitemap trust route has a static entry with matching canonical metadata", () => {
    for (const route of PUBLIC_SITEMAP_PATHS.filter((value) => value !== "/")) {
      expect(PATH_ENTRIES).toContain(route);
    }
  });

  // The root entry also serves query-state deep links (Problem and Record
  // selection); a static canonical/og:url would collapse every shared deep
  // link onto the home page.
  it("leaves the root entry without a static canonical or og:url so deep links keep their own URL", () => {
    const head = staticHead("");
    expect(head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(head.querySelector('meta[property="og:url"]')).toBeNull();
  });

  it("references no previous deployment domain in any static entry", () => {
    for (const entryPath of ["", ...PATH_ENTRIES]) {
      const html = readFileSync(path.join(__dirname, "..", entryPath, "index.html"), "utf-8");
      expect(html).not.toMatch(/vercel\.app/);
    }
  });
});
