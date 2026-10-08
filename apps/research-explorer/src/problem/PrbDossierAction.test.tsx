import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "../presentation/Toast";
import { isDeploymentChunkLoadError, PrbDossierAction, prbDossierFileName } from "./PrbDossierAction";
import { buildPrbDossierData, type PrbDossierData } from "./prbDossierProjection";

const generate = vi.hoisted(() => vi.fn<(dossier: PrbDossierData, generation: { generatedAt: string; sourceCommit: string | null; corpusFingerprint: string }) => Promise<Blob>>());
const rendererImported = vi.hoisted(() => vi.fn());
vi.mock("./pdf/prbDossierWorkerClient", () => ({ generateDossierInWorker: generate }));
vi.mock("./pdf/generatePrbDossierPdf", () => {
  rendererImported();
  return { generatePrbDossierPdf: vi.fn() };
});

const dossier = buildPrbDossierData({
  problem: { id: "PRB-9999", type: "PRB-", file: "", record: { title: "Problema sintético" }, outgoingEdges: [], incomingEdges: [] },
  evidence: [],
});
const identity = { sourceCommit: "full-source-commit", corpusFingerprint: "full-corpus-fingerprint" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderAction(data: PrbDossierData | null = dossier) {
  return render(
    <ToastProvider>
      <PrbDossierAction dossier={data} identity={data ? identity : null} />
    </ToastProvider>,
  );
}

const button = () => screen.getByRole("button", { name: /dossiê \(PDF\)/ });

describe("PRB dossier PDF download action", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let clicked: { href: string; download: string }[];
  const startUrl = window.location.href;
  const originalLocation = window.location;

  beforeEach(() => {
    generate.mockReset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T10:11:12.000Z"));
    clicked = [];
    createObjectURL = vi.fn(() => "blob:dossie");
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.getAttribute("href") ?? "", download: this.download });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    vi.useRealTimers();
  });

  it("names the file after the PRB identifier", () => {
    expect(prbDossierFileName("PRB-0005")).toBe("open-evora-PRB-0005-dossie.pdf");
  });

  it("is enabled when dossier data is available and disabled without it", () => {
    renderAction();
    expect(button()).toHaveProperty("disabled", false);
    renderAction(null);
    expect(screen.getAllByRole("button", { name: /dossiê \(PDF\)/ })[1]).toHaveProperty("disabled", true);
  });

  it("delegates the current dossier and one captured timestamp, downloads the returned Blob and confirms only afterwards", async () => {
    const pending = deferred<Blob>();
    generate.mockReturnValue(pending.promise);
    renderAction();

    fireEvent.click(button());
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    expect(generate.mock.calls[0][0]).toBe(dossier);
    expect(generate.mock.calls[0][1]).toEqual({ generatedAt: "2026-10-08T10:11:12.000Z", ...identity });
    expect(screen.queryByText("Dossiê PDF preparado.")).toBeNull();

    const blob = new Blob(["%PDF-1.3"], { type: "application/pdf" });
    await act(async () => pending.resolve(blob));

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked).toEqual([{ href: "blob:dossie", download: "open-evora-PRB-9999-dossie.pdf" }]);
    const toast = await screen.findByText("Dossiê PDF preparado.");
    expect(toast.getAttribute("role")).toBe("status");
    expect(toast.closest(".ui-toast")?.classList.contains("ui-toast--affirmed")).toBe(true);
    expect(window.location.href).toBe(startUrl);
  });

  it("exposes an accessible busy state and ignores repeated activation while generating", async () => {
    const pending = deferred<Blob>();
    generate.mockReturnValue(pending.promise);
    renderAction();

    fireEvent.click(button());
    await vi.waitFor(() => expect(button().getAttribute("aria-busy")).toBe("true"));
    expect(button().getAttribute("aria-disabled")).toBe("true");
    expect(button().textContent).toBe("A preparar dossiê (PDF)…");
    fireEvent.click(button());
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    fireEvent.click(button());
    await Promise.resolve();
    expect(generate).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve(new Blob(["%PDF"], { type: "application/pdf" })));
    expect(button().getAttribute("aria-busy")).toBeNull();
    expect(button().textContent).toBe("↓ Descarregar dossiê (PDF)");
    expect(clicked).toHaveLength(1);
  });

  it("reports a failed generation as an error without downloading or navigating", async () => {
    generate.mockRejectedValue(new Error("layout failed"));
    renderAction();

    fireEvent.click(button());
    const toast = await screen.findByText("Não foi possível gerar o dossiê PDF.");
    expect(toast.getAttribute("role")).toBe("alert");
    expect(toast.closest(".ui-toast")?.classList.contains("ui-toast--error")).toBe(true);
    expect(clicked).toHaveLength(0);
    expect(screen.queryByText("Dossiê PDF preparado.")).toBeNull();
    expect(button().getAttribute("aria-busy")).toBeNull();
    expect(window.location.href).toBe(startUrl);
  });

  it.each([
    "Failed to fetch dynamically imported module: https://example.test/assets/prbDossierWorkerClient-a1b2.js",
    "error loading dynamically imported module: https://example.test/assets/prbDossierWorkerClient-a1b2.js",
    "Importing a module script failed.",
    "Unable to preload CSS for /assets/prbDossierWorkerClient-a1b2.css",
  ])("shows explicit reload recovery for a supported Vite module-load failure: %s", async (message) => {
    expect(isDeploymentChunkLoadError(new TypeError(message))).toBe(true);
    generate.mockRejectedValue(new TypeError(message));
    renderAction();

    fireEvent.click(button());
    expect(await screen.findByText("Esta página publicada pode estar desatualizada")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recarregar página" })).toBeTruthy();
    expect(button()).toHaveProperty("disabled", true);
    expect(screen.queryByText("Não foi possível gerar o dossiê PDF.")).toBeNull();
    expect(screen.queryByText("Dossiê PDF preparado.")).toBeNull();
  });

  it("reloads only after explicit activation of the stale chunk recovery action", async () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload } });
    generate.mockRejectedValue(new TypeError("Failed to fetch dynamically imported module: /assets/pdf-old.js"));
    renderAction();
    fireEvent.click(button());
    fireEvent.click(await screen.findByRole("button", { name: "Recarregar página" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not classify unrelated renderer failures as deployment chunk loss", () => {
    expect(isDeploymentChunkLoadError(new Error("PDF worker failed"))).toBe(false);
    expect(isDeploymentChunkLoadError("Failed to fetch dynamically imported module")).toBe(false);
  });

  it("does not eagerly import the PDF renderer from the action module", async () => {
    expect(rendererImported).not.toHaveBeenCalled();
  });
});
