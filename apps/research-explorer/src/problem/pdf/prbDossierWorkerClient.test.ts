import { describe, expect, it, vi } from "vitest";
import { buildPrbDossierData, type PrbDossierData } from "../prbDossierProjection";
import { generateDossierInWorker } from "./prbDossierWorkerClient";
import { isPrbDossierWorkerRequest, isPrbDossierWorkerResponse, type PrbDossierWorkerRequest } from "./prbDossierWorkerProtocol";

const generation = { generatedAt: "2026-10-08T10:11:12.000Z", sourceCommit: "commit-full-sha", corpusFingerprint: "fingerprint-full-value" };

const dossier: PrbDossierData = buildPrbDossierData({
  problem: { id: "PRB-9999", type: "PRB-", file: "", record: { title: "Problema" }, outgoingEdges: [], incomingEdges: [] },
  evidence: [],
});

function fakeWorker() {
  const listeners = new Map<string, EventListener>();
  const worker = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn((type: string, listener: EventListener) => listeners.set(type, listener)),
    removeEventListener: vi.fn((type: string) => listeners.delete(type)),
  } as unknown as Worker;
  return {
    worker,
    listeners,
    factory: () => worker,
    message(data: unknown) { listeners.get("message")?.({ data } as MessageEvent); },
    error(type = "error") { listeners.get(type)?.({} as Event); },
  };
}

describe("PRB dossier worker protocol", () => {
  it("sends a typed request with the exact dossier and timestamp and resolves the PDF Blob", async () => {
    const fake = fakeWorker();
    const blob = new Blob(["%PDF-1.7"], { type: "application/pdf" });
    const pending = generateDossierInWorker(dossier, generation, fake.factory);
    expect(fake.worker.postMessage).toHaveBeenCalledWith({
      type: "generate",
      dossier,
      generation,
    } satisfies PrbDossierWorkerRequest);
    const sent = (fake.worker as unknown as { postMessage: ReturnType<typeof vi.fn> }).postMessage.mock.calls[0][0] as PrbDossierWorkerRequest;
    expect(sent.dossier).toBe(dossier);
    fake.message({ type: "success", blob });
    await expect(pending).resolves.toBe(blob);
    expect(fake.worker.terminate).toHaveBeenCalledTimes(1);
    expect(fake.listeners.size).toBe(0);
  });

  it("rejects a worker failure and terminates the worker", async () => {
    const fake = fakeWorker();
    const pending = generateDossierInWorker(dossier, generation, fake.factory);
    fake.message({ type: "failure", error: { message: "layout failed" } });
    await expect(pending).rejects.toThrow("layout failed");
    expect(fake.worker.terminate).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    { type: "success", blob: {} },
    { type: "success", blob: new Blob([], { type: "application/pdf" }) },
    { type: "success", blob: new Blob(["x"], { type: "text/plain" }) },
    { type: "failure", error: { message: "x".repeat(201) } },
    { type: "unexpected", blob: new Blob(["x"], { type: "application/pdf" }) },
  ])("fails closed for malformed worker response %j", async (response) => {
    const fake = fakeWorker();
    const pending = generateDossierInWorker(dossier, generation, fake.factory);
    fake.message(response);
    await expect(pending).rejects.toThrow("Invalid PDF worker response");
    expect(fake.worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("accepts only bounded failure responses and non-empty PDF Blobs", () => {
    expect(isPrbDossierWorkerResponse({ type: "failure", error: { message: "failed" } })).toBe(true);
    expect(isPrbDossierWorkerResponse({ type: "success", blob: new Blob(["%PDF"], { type: "application/pdf" }) })).toBe(true);
    expect(isPrbDossierWorkerResponse({ type: "success", blob: new Blob([], { type: "application/pdf" }) })).toBe(false);
  });

  it("accepts publication metadata and fails closed for malformed request identity", () => {
    expect(isPrbDossierWorkerRequest({ type: "generate", dossier, generation })).toBe(true);
    expect(isPrbDossierWorkerRequest({ type: "generate", dossier, generation: { ...generation, corpusFingerprint: "" } })).toBe(false);
    expect(isPrbDossierWorkerRequest({ type: "generate", dossier, generation: { ...generation, sourceCommit: undefined } })).toBe(false);
  });
});
