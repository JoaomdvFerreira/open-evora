import { describe, expect, it } from "vitest";
import { PRODUCTION_ORIGIN, PUBLIC_SITEMAP_PATHS, escapeXml, robotsTxt, sitemapUrls, sitemapXml } from "./publicCrawler";

describe("public crawler files", () => {
  it("lists exactly the approved path-based public routes deterministically", () => {
    expect(sitemapUrls()).toEqual([
      "https://open-evora.vercel.app/",
      "https://open-evora.vercel.app/about",
      "https://open-evora.vercel.app/methodology",
      "https://open-evora.vercel.app/corrections",
      "https://open-evora.vercel.app/contact",
      "https://open-evora.vercel.app/privacy",
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
      expect(url.hostname).toBe("open-evora.vercel.app");
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
    expect(robotsTxt()).toBe("User-agent: *\nAllow: /\nSitemap: https://open-evora.vercel.app/sitemap.xml\n");
  });
});
