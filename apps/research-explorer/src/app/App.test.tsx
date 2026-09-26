import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { DataLoadError, type DataProvider, type ReadModelManifest } from "../dataProvider/types";

const manifest: ReadModelManifest = {
  readModelVersion: "1.0.0",
  generatedAt: "2026-01-01T00:00:00.000Z",
  generator: "fixture",
  sourceCommit: null,
  corpusFingerprint: "fixture",
  totalRecords: 0,
  counts: {},
  schemaPrefixes: [],
};

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

it("retries a failed startup manifest load", async () => {
  let attempts = 0;
  const provider: DataProvider = {
    getManifest: () => (attempts++ === 0 ? Promise.reject(new DataLoadError("temporary manifest failure", "network")) : Promise.resolve(manifest)),
    listRecords: () => Promise.resolve([]),
    getRecord: () => Promise.reject(new Error("not used")),
    getEdges: () => Promise.resolve([]),
  };
  const user = userEvent.setup();
  window.history.replaceState(null, "", "/?view=records&id=SRC-0001");
  render(<App dataProvider={provider} />);

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("temporary manifest failure");
  await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
  // The manifest summary renders on Record Detail (Overview, the Records
  // landing and the PRB views each end on their own terminal band).
  expect(await screen.findByText(/Corpus: 0/)).toBeTruthy();
  expect(attempts).toBe(2);
});

// F06 regression: the skip link must bypass ExplorerHeader's global
// navigation, not merely land at the top of the shared <main> landmark that
// still wraps both header and content (see skipTarget.ts's SKIP_TARGET_ID
// doc comment, and Explorer.tsx's own skip-target node placed right after
// ExplorerHeader).
describe("App — skip link bypasses global navigation (F06)", () => {
  const provider: DataProvider = {
    getManifest: () => Promise.resolve(manifest),
    listRecords: () => Promise.resolve([]),
    getRecord: () => Promise.reject(new Error("not used")),
    getEdges: () => Promise.resolve([]),
  };

  it("keeps exactly one <main> landmark, with the skip target after global navigation in document order", async () => {
    render(<App dataProvider={provider} />);
    await screen.findByRole("button", { name: "Abrir menu" });

    expect(screen.getAllByRole("main")).toHaveLength(1);
    const nav = screen.getByRole("navigation", { name: "Navegação principal", hidden: true });
    const skipTarget = document.getElementById("explorer-content-start");
    expect(skipTarget).not.toBeNull();
    expect(skipTarget).not.toBe(nav);
    expect(nav.compareDocumentPosition(skipTarget!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("activating the skip link focuses the content target, not the global navigation container", async () => {
    const user = userEvent.setup();
    render(<App dataProvider={provider} />);
    await screen.findByRole("button", { name: "Abrir menu" });

    await user.tab();
    const skipLink = screen.getByRole("link", { name: "Saltar para o conteúdo" });
    expect(document.activeElement).toBe(skipLink);

    await user.keyboard("{Enter}");
    const skipTarget = document.getElementById("explorer-content-start");
    expect(document.activeElement).toBe(skipTarget);
    expect(document.activeElement).not.toBe(screen.getByRole("navigation", { name: "Navegação principal", hidden: true }));
    // Never the header's own menu toggle — activating the skip link must not
    // require the keyboard user to traverse global nav at all.
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "Abrir menu" }));
  });

  it("keeps a valid skip destination while the startup manifest is still loading", async () => {
    const pendingProvider: DataProvider = {
      getManifest: () => new Promise(() => {}),
      listRecords: () => Promise.resolve([]),
      getRecord: () => Promise.reject(new Error("not used")),
      getEdges: () => Promise.resolve([]),
    };
    render(<App dataProvider={pendingProvider} />);

    await screen.findByRole("status");
    const skipTarget = document.getElementById("explorer-content-start");
    expect(skipTarget).not.toBeNull();
    expect(skipTarget?.getAttribute("tabindex")).toBe("-1");
  });

  it("keeps a valid skip destination on a startup error", async () => {
    const erroringProvider: DataProvider = {
      getManifest: () => Promise.reject(new DataLoadError("boom", "network")),
      listRecords: () => Promise.resolve([]),
      getRecord: () => Promise.reject(new Error("not used")),
      getEdges: () => Promise.resolve([]),
    };
    render(<App dataProvider={erroringProvider} />);

    await screen.findByRole("alert");
    const skipTarget = document.getElementById("explorer-content-start");
    expect(skipTarget).not.toBeNull();
    expect(skipTarget?.getAttribute("role")).toBe("alert");
  });

  it("keeps a valid accessible skip destination on a public trust page, after that page's own navigation", async () => {
    window.history.pushState(null, "", "/about");
    render(<App dataProvider={provider} />);

    const trustNav = await screen.findByRole("navigation", { name: "Informação sobre o Open Évora" });
    const skipTarget = document.getElementById("explorer-content-start");
    expect(skipTarget).not.toBeNull();
    expect(trustNav.compareDocumentPosition(skipTarget!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("main")).toHaveLength(1);

    window.history.pushState(null, "", "/");
  });
});

it("qualifies the manifest timestamp as build/generation time, distinct from research currentness (ODM-020)", async () => {
  const provider: DataProvider = {
    getManifest: () => Promise.resolve(manifest),
    listRecords: () => Promise.resolve([]),
    getRecord: () => Promise.reject(new Error("not used")),
    getEdges: () => Promise.resolve([]),
  };
  window.history.replaceState(null, "", "/?view=records&id=SRC-0001");
  render(<App dataProvider={provider} />);

  // Rendered on Record Detail — see the preceding test's own comment.
  const summary = await screen.findByText(/Corpus: 0/);
  expect(summary.textContent).toContain("não indica a atualidade da investigação");
  const time = summary.querySelector("time");
  expect(time?.getAttribute("dateTime")).toBe(manifest.generatedAt);
});
