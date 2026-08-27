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

  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Visão geral" }));
});
