import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRODUCTION_ORIGIN,
  PUBLIC_SITEMAP_PATHS,
  SOCIAL_SHARE_IMAGE_PATH,
  SOCIAL_SHARE_IMAGE_SOURCE,
  escapeXml,
  robotsTxt,
  sitemapUrls,
  sitemapXml,
} from "./publicCrawler";

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

describe("static HTML entry social sharing metadata", () => {
  const ENTRIES = ["", "/about", "/methodology", "/corrections", "/contact", "/privacy", "/out-of-scope"];
  const SHARE_IMAGE_URL = `${PRODUCTION_ORIGIN}${SOCIAL_SHARE_IMAGE_PATH}`;

  function staticHead(entryPath: string): Document {
    const html = readFileSync(path.join(__dirname, "..", entryPath, "index.html"), "utf-8");
    return new DOMParser().parseFromString(html, "text/html");
  }

  function single(head: Document, selector: string): string {
    const nodes = head.querySelectorAll(selector);
    expect(nodes, selector).toHaveLength(1);
    return nodes[0].getAttribute("content") ?? "";
  }

  it.each(ENTRIES)("%s carries a complete Open Graph identity with the global share image", (entryPath) => {
    const head = staticHead(entryPath);
    expect(single(head, 'meta[property="og:site_name"]')).toBe("Open Évora");
    expect(single(head, 'meta[property="og:locale"]')).toBe("pt_PT");
    expect(single(head, 'meta[property="og:type"]')).toBe("website");
    expect(single(head, 'meta[property="og:title"]')).toMatch(/^Open Évora — \S/);
    expect(single(head, 'meta[property="og:description"]')).not.toBe("");
    expect(single(head, 'meta[property="og:image"]')).toBe(SHARE_IMAGE_URL);
    expect(single(head, 'meta[property="og:image:type"]')).toBe("image/png");
    expect(single(head, 'meta[property="og:image:width"]')).toBe("1200");
    expect(single(head, 'meta[property="og:image:height"]')).toBe("630");
    expect(single(head, 'meta[property="og:image:alt"]')).toContain("Open Évora");
  });

  it.each(ENTRIES)("%s mirrors its Open Graph card as a large-image Twitter Card", (entryPath) => {
    const head = staticHead(entryPath);
    expect(single(head, 'meta[name="twitter:card"]')).toBe("summary_large_image");
    expect(single(head, 'meta[name="twitter:title"]')).toBe(single(head, 'meta[property="og:title"]'));
    expect(single(head, 'meta[name="twitter:description"]')).toBe(single(head, 'meta[property="og:description"]'));
    expect(single(head, 'meta[name="twitter:image"]')).toBe(single(head, 'meta[property="og:image"]'));
    expect(single(head, 'meta[name="twitter:image:alt"]')).toBe(single(head, 'meta[property="og:image:alt"]'));
  });

  it("names each trust page in its share title while the root keeps the Explorer title", () => {
    const titles = Object.fromEntries(ENTRIES.map((entryPath) => [entryPath, single(staticHead(entryPath), 'meta[property="og:title"]')]));
    expect(titles[""]).toBe("Open Évora — Explorador de Investigação");
    expect(titles["/about"]).toBe("Open Évora — Sobre");
    expect(titles["/methodology"]).toBe("Open Évora — Metodologia");
    expect(titles["/corrections"]).toBe("Open Évora — Correções");
    expect(titles["/contact"]).toBe("Open Évora — Contacto");
    expect(titles["/privacy"]).toBe("Open Évora — Privacidade");
    expect(titles["/out-of-scope"]).toBe("Open Évora — Registos fora do âmbito");
  });

  it("ships the share image as a 1200×630 PNG matching the declared dimensions", () => {
    const bytes = readFileSync(path.join(__dirname, "..", SOCIAL_SHARE_IMAGE_SOURCE));
    expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(630);
  });
});
