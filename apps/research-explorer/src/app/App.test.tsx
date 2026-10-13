import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { DataLoadError, type DataProvider, type ReadModelManifest, type RecordDetail, type RecordSummary } from "../dataProvider/types";
import { prb0005DataProvider } from "../problem/prb0005Fixture";
import prb0007Generated from "../../generated/record-detail/PRB-0007.json";

const generateDossierInWorker = vi.hoisted(() => vi.fn());
vi.mock("../problem/pdf/prbDossierWorkerClient", () => ({ generateDossierInWorker }));

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

it("opens a CLOSED OUT_OF_SCOPE PRB through the ordinary direct Problem route", async () => {
  const detail = prb0007Generated as unknown as RecordDetail;
  const record = detail.record;
  const title = String(record.title);
  const evidenceIds = Array.isArray((record.evidence))
    ? record.evidence.flatMap((entry) => entry && typeof entry === "object" && typeof (entry as Record<string, unknown>).evidence_id === "string" ? [(entry as Record<string, unknown>).evidence_id as string] : [])
    : [];
  const summary: RecordSummary = {
    id: detail.id, type: detail.type, label: title, file: detail.file,
    summaryFields: { status: record.status, validation_status: record.validation_status, evidence_status: record.evidence_status },
  };
  const summaries: RecordSummary[] = [summary, ...evidenceIds.map((id) => ({ id, type: "EVD-", label: id, file: `research/evidence/${id}.yaml`, summaryFields: {} }))];
  const evidenceDetails = Object.fromEntries(evidenceIds.map((id) => [id, { id, type: "EVD-", file: `research/evidence/${id}.yaml`, record: {}, outgoingEdges: [], incomingEdges: [] }]));
  const directProvider: DataProvider = {
    getManifest: async () => ({ ...manifest, totalRecords: summaries.length, counts: { "PRB-": 1, "EVD-": evidenceIds.length }, schemaPrefixes: ["PRB-", "EVD-"] }),
    listRecords: async () => summaries,
    getRecord: async (id) => { if (id === detail.id) return detail; const evidence = evidenceDetails[id]; if (evidence) return evidence; throw new Error("not found"); },
    getEdges: async () => [],
  };
  window.history.replaceState(null, "", "/?view=problem&id=PRB-0007");
  render(<App dataProvider={directProvider} />);

  expect(await screen.findByRole("heading", { level: 2, name: title })).toBeTruthy();
  expect(screen.getByText("Problema encerrado")).toBeTruthy();
  expect(screen.queryByText("Problema em investigação")).toBeNull();
  expect(screen.getByRole("region", { name: "Encerramento" })).toBeTruthy();
  const closure = record.closure as Record<string, unknown>;
  expect(screen.getByText(String(closure.explanation))).toBeTruthy();
  expect(screen.getAllByText("Questões que ficaram por responder")).toHaveLength(2);
  expect(screen.queryByText("Questões abertas")).toBeNull();
  expect(screen.queryByText(/questões? em acompanhamento/)).toBeNull();
  expect(screen.queryByText("Porque continua em aberto")).toBeNull();
  expect(screen.queryByText("Ação atual")).toBeNull();
  expect(screen.getAllByText("Porque ficou por responder")).toHaveLength(2);
  expect(screen.getAllByText("Ação registada")).toHaveLength(2);
  const questions = (record.investigation as Record<string, unknown>).open_questions as Array<Record<string, unknown>>;
  for (const question of questions) expect(screen.getByText(String(question.question))).toBeTruthy();
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
  window.history.replaceState(null, "", "/?view=records&id=WID-0001");
  render(<App dataProvider={provider} />);

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("temporary manifest failure");
  await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
  // The manifest summary renders on generic Record Detail (Overview, the Records
  // landing, the PRB views and EVD/SRC Record Detail each end on their own terminal band).
  expect(await screen.findByText(/Corpus: 0/)).toBeTruthy();
  expect(attempts).toBe(2);
});

it("uses the startup manifest identity for the PRB dossier without fetching it again", async () => {
  generateDossierInWorker.mockRejectedValue(new Error("worker unavailable in test"));
  const getManifest = vi.fn(async () => ({ ...manifest, sourceCommit: "full-startup-commit", corpusFingerprint: "full-startup-fingerprint" }));
  const provider: DataProvider = { ...prb0005DataProvider, getManifest };
  window.history.replaceState(null, "", "/?view=problem&id=PRB-0005");
  render(<App dataProvider={provider} />);

  const button = await screen.findByRole("button", { name: /Descarregar dossiê \(PDF\)/ });
  expect(button).toHaveProperty("disabled", false);
  expect(getManifest).toHaveBeenCalledTimes(1);
  await userEvent.click(button);
  await vi.waitFor(() => expect(generateDossierInWorker).toHaveBeenCalledTimes(1));
  expect(generateDossierInWorker.mock.calls[0][1]).toMatchObject({ sourceCommit: "full-startup-commit", corpusFingerprint: "full-startup-fingerprint" });
  expect(getManifest).toHaveBeenCalledTimes(1);
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
    expect(screen.getByTestId("app-skeleton")).toBeTruthy();
    expect(screen.getAllByRole("status")).toHaveLength(1);
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
  window.history.replaceState(null, "", "/?view=records&id=WID-0001");
  render(<App dataProvider={provider} />);

  // Rendered on Record Detail — see the preceding test's own comment.
  const summary = await screen.findByText(/Corpus: 0/);
  expect(summary.textContent).toContain("não indica a atualidade da investigação");
  const time = summary.querySelector("time");
  expect(time?.getAttribute("dateTime")).toBe(manifest.generatedAt);
});
