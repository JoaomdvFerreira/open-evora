import { expect, it } from "vitest";
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

it("retries a failed startup manifest load", async () => {
  let attempts = 0;
  const provider: DataProvider = {
    getManifest: () => (attempts++ === 0 ? Promise.reject(new DataLoadError("temporary manifest failure", "network")) : Promise.resolve(manifest)),
    listRecords: () => Promise.resolve([]),
    getRecord: () => Promise.reject(new Error("not used")),
    getEdges: () => Promise.resolve([]),
  };
  const user = userEvent.setup();
  render(<App dataProvider={provider} />);

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("temporary manifest failure");
  await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
  // Manifest summary is omitted on Overview (Overview visual completion —
  // it has its own metrics ruler); navigate to Records (via the header's
  // Fontes action), where it still renders. `hidden: true` (visual-
  // completion compact pass, task §2): the header nav now sits inside the
  // collapsed-by-default `.explorer-chrome-menu`, shown at >=768px only via
  // a CSS override jsdom does not evaluate — see ExplorerHeader.test.tsx's
  // own module doc.
  await user.click(await screen.findByRole("button", { name: "Fontes", hidden: true }));
  expect(await screen.findByText(/Corpus: 0/)).toBeTruthy();
  expect(attempts).toBe(2);
});

it("moves focus to the main content when the skip link is activated", async () => {
  const provider: DataProvider = {
    getManifest: () => Promise.resolve(manifest),
    listRecords: () => Promise.resolve([]),
    getRecord: () => Promise.reject(new Error("not used")),
    getEdges: () => Promise.resolve([]),
  };
  const user = userEvent.setup();
  render(<App dataProvider={provider} />);

  await user.tab();
  const skipLink = screen.getByRole("link", { name: "Saltar para o conteúdo" });
  expect(document.activeElement).toBe(skipLink);

  await user.keyboard("{Enter}");
  expect(document.activeElement).toBe(document.getElementById("main-content"));

  // The Header's own first interactive element (visual-completion compact
  // pass, task §2): jsdom has no media-query/layout engine, so it cannot
  // evaluate the `>=768px` CSS override that keeps nav/CTA visible on real
  // desktop — every render here behaves like the collapsed compact state,
  // where the menu toggle (not the now `hidden`-attributed "Problemas") is
  // the first genuinely focusable element after the identity heading. This
  // is also the true compact-viewport tab order in a real browser; only the
  // >=768px case (not reproducible in jsdom) differs, and is covered
  // instead by ExplorerHeader.test.tsx's own disclosure-behaviour tests.
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Abrir menu" }));
});

it("qualifies the manifest timestamp as build/generation time, distinct from research currentness (ODM-020)", async () => {
  const provider: DataProvider = {
    getManifest: () => Promise.resolve(manifest),
    listRecords: () => Promise.resolve([]),
    getRecord: () => Promise.reject(new Error("not used")),
    getEdges: () => Promise.resolve([]),
  };
  const user = userEvent.setup();
  render(<App dataProvider={provider} />);

  // Manifest summary is omitted on Overview (Overview visual completion —
  // it has its own metrics ruler); navigate to Records (via the header's
  // Fontes action), where it still renders. `hidden: true` — see the
  // preceding test's own comment.
  await user.click(await screen.findByRole("button", { name: "Fontes", hidden: true }));
  const summary = await screen.findByText(/Corpus: 0/);
  expect(summary.textContent).toContain("não indica a atualidade da investigação");
  const time = summary.querySelector("time");
  expect(time?.getAttribute("dateTime")).toBe(manifest.generatedAt);
});
