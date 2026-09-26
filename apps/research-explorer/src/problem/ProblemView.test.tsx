import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ProblemView } from "./ProblemView";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";

const index: RecordSummary[] = [
  { id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} },
  { id: "PRB-2", type: "PRB-", label: "Segundo problema", file: "", summaryFields: {} },
  { id: "PRB-3", type: "PRB-", label: "Terceiro problema", file: "", summaryFields: {} },
  ...["1", "2"].map((id) => ({ id: `EVD-${id}`, type: "EVD-" as const, label: `Evidência ${id}`, file: "", summaryFields: {} })),
];
const prbRecord = {
  title: "Problema de teste",
  problem_statement: "Formulação delimitada.",
  causal_reading: "Leitura causal registada.",
  status: "OPEN",
  evidence: [
    { evidence_id: "EVD-1", effects: ["SUPPORTS"], research_roles: ["LOCAL_OBSERVATION"] },
    { evidence_id: "EVD-2", effects: ["BOUNDS", "REFINES"] },
  ],
  investigation: {
    open_questions: [{ question: "Questão em aberto.", why_open: "Ainda não resolvida.", evidence: ["EVD-1"] }],
    path: { initial_signal: { summary: "Sinal inicial registado.", evidence: ["EVD-2"] } },
  },
};
const records: Record<string, RecordDetail> = {
  "PRB-1": { id: "PRB-1", type: "PRB-", file: "", outgoingEdges: ["1", "2"].map((id, ordinal) => ({ field: "evidence", ordinal, to: `EVD-${id}` })), incomingEdges: [], record: prbRecord },
  "PRB-2": { id: "PRB-2", type: "PRB-", file: "", outgoingEdges: [], incomingEdges: [], record: { title: "Segundo problema" } },
  "PRB-3": { id: "PRB-3", type: "PRB-", file: "", outgoingEdges: [], incomingEdges: [], record: { title: "Terceiro problema" } },
  ...Object.fromEntries(["1", "2"].map((id) => [`EVD-${id}`, { id: `EVD-${id}`, type: "EVD-", file: "", incomingEdges: [], outgoingEdges: [], record: { observation: { summary: `Observação ${id}.` } } }])),
};
const provider: DataProvider = { getManifest: async () => { throw Error("unused"); }, listRecords: async () => index, getEdges: async () => [], getRecord: async (id) => records[id] };
const props = { dataProvider: provider, onOpenGeneric: vi.fn(), onBackToRecords: vi.fn(), onBackToOverview: vi.fn(), onViewHistory: vi.fn() };

function prbTitle(name: string | RegExp) {
  return screen.findByRole("heading", { level: 2, name });
}

beforeEach(() => {
  // jsdom does not implement scrollIntoView (applyInitialFragment calls it on a resolved fragment target).
  Element.prototype.scrollIntoView = vi.fn() as unknown as typeof Element.prototype.scrollIntoView;
});

afterEach(() => {
  window.location.hash = "";
});

describe("ProblemView — record index and selection guards", () => {
  it("shows index loading, then an actionable index error that retries", async () => {
    let attempts = 0;
    const flakyProvider: DataProvider = {
      ...provider,
      listRecords: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("index failure");
        return index;
      },
    };
    render(<ProblemView {...props} dataProvider={flakyProvider} problemId="PRB-1" />);
    expect(screen.getByText("A carregar…")).toBeTruthy();
    expect(await screen.findByText("Não foi possível carregar os registos")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await prbTitle("Problema de teste")).toBeTruthy();
    expect(attempts).toBe(2);
  });

  it("keeps an empty selection explicit and routes back to Records", async () => {
    const onBackToRecords = vi.fn();
    render(<ProblemView {...props} problemId={null} onBackToRecords={onBackToRecords} />);
    expect(await screen.findByText("Nenhum Problema selecionado.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Procurar um Problema em Registos" }));
    expect(onBackToRecords).toHaveBeenCalled();
  });

  it("refuses a non-PRB selection and offers its generic record detail instead", async () => {
    const onOpenGeneric = vi.fn();
    const getRecord = vi.fn(provider.getRecord);
    render(<ProblemView {...props} dataProvider={{ ...provider, getRecord }} problemId="EVD-1" onOpenGeneric={onOpenGeneric} />);
    expect(await screen.findByText("Este registo não é um Problema")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver detalhe genérico" }));
    expect(onOpenGeneric).toHaveBeenCalledWith("EVD-1");
    expect(getRecord).not.toHaveBeenCalled();
    expect(document.getElementById("prb-identity-title")).toBeNull();
  });
});

describe("ProblemView — projection loading and error", () => {
  it("shows projection loading while the PRB resolves", async () => {
    render(<ProblemView {...props} dataProvider={{ ...provider, getRecord: () => new Promise(() => {}) }} problemId="PRB-1" />);
    expect(await screen.findByText("A carregar Problema PRB-1…")).toBeTruthy();
    expect(document.getElementById("prb-identity-title")).toBeNull();
  });

  it("focuses an actionable projection error that retries into PRB Details", async () => {
    let attempts = 0;
    const flakyProvider: DataProvider = {
      ...provider,
      getRecord: async (id) => {
        if (id === "PRB-1") {
          attempts += 1;
          if (attempts === 1) throw new Error("network failure");
        }
        return records[id];
      },
    };
    render(<ProblemView {...props} dataProvider={flakyProvider} problemId="PRB-1" />);
    const errorTitle = await screen.findByText("Falha ao carregar o Problema");
    await vi.waitFor(() => expect(document.activeElement?.contains(errorTitle)).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await prbTitle("Problema de teste")).toBeTruthy();
    expect(attempts).toBe(2);
  });
});

describe("ProblemView — ready PRB Details", () => {
  it("renders the resolved projection through the PRB Details composition", async () => {
    render(<ProblemView {...props} problemId="PRB-1" />);
    await prbTitle("Problema de teste");
    const article = document.querySelector("article.prb-details-view");
    expect(article?.getAttribute("aria-labelledby")).toBe("prb-identity-title");
    expect(screen.getByText("Formulação delimitada.")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Leitura atual" }).textContent).toContain("Leitura causal registada.");
    expect(screen.getByText("Questão em aberto.")).toBeTruthy();
    expect(screen.getByText("Sinal inicial registado.")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Evidência e auditoria" })).toBeTruthy();
    // Projection-derived counts reach the presentation unchanged: 2 evidence records, 3 effect occurrences.
    const tally = document.querySelector(".prb-audit-evidence-summary")!;
    expect(tally.textContent).toContain("2 registos");
    expect(tally.textContent).toContain("3 efeitos");
  });

  it("renders the PRB title as a focusable h2 and focuses it when no fragment is requested", async () => {
    render(<ProblemView {...props} problemId="PRB-1" />);
    const title = await prbTitle("Problema de teste");
    expect(title.tagName).toBe("H2");
    expect(title.id).toBe("prb-identity-title");
    expect(title.getAttribute("tabindex")).toBe("-1");
    await vi.waitFor(() => expect(document.activeElement).toBe(title));
  });

  it("does not render the retired Problem View presentation", async () => {
    render(<ProblemView {...props} problemId="PRB-1" />);
    await prbTitle("Problema de teste");
    expect(document.querySelector(".problem-view, .problem-reading-rail, #problem-evidencia")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Nesta página" })).toBeNull();
  });

  it("keeps breadcrumb, History and related-evidence callbacks wired", async () => {
    const onBackToOverview = vi.fn();
    const onViewHistory = vi.fn();
    const onOpenGeneric = vi.fn();
    render(<ProblemView {...props} problemId="PRB-1" onBackToOverview={onBackToOverview} onViewHistory={onViewHistory} onOpenGeneric={onOpenGeneric} />);
    await prbTitle("Problema de teste");

    fireEvent.click(within(screen.getByLabelText("Localização")).getByRole("button", { name: "Visão geral" }));
    expect(onBackToOverview).toHaveBeenCalled();

    fireEvent.click(within(screen.getByRole("navigation", { name: "Vistas do problema" })).getByRole("button", { name: "Histórico" }));
    expect(onViewHistory).toHaveBeenCalledWith("PRB-1");

    fireEvent.click(screen.getByRole("button", { name: "Abrir EVD-1" }));
    expect(onOpenGeneric).toHaveBeenCalledWith("EVD-1");
  });
});

describe("ProblemView — initial URL fragment vs. title focus", () => {
  it("applies a valid PRB Details fragment instead of focusing the title", async () => {
    window.location.hash = "#prb-auditoria";
    render(<ProblemView {...props} problemId="PRB-1" />);
    const audit = await screen.findByRole("region", { name: "Evidência e auditoria" });
    await vi.waitFor(() => expect(document.activeElement).toBe(audit));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a fragment for a section this PRB does not render", "#does-not-exist-on-this-prb"],
    ["a retired Problem View fragment", "#problem-evidencia"],
    ["a malformed fragment", "#%E0%A4%A"],
  ])("falls back to focusing the title for %s", async (_label, hash) => {
    window.location.hash = hash;
    render(<ProblemView {...props} problemId="PRB-1" />);
    const title = await prbTitle("Problema de teste");
    await vi.waitFor(() => expect(document.activeElement).toBe(title));
  });

  it("does not reapply the initial fragment on later in-app PRB navigation", async () => {
    window.location.hash = "#prb-auditoria";
    const { rerender } = render(<ProblemView {...props} problemId="PRB-1" />);
    const audit = await screen.findByRole("region", { name: "Evidência e auditoria" });
    await vi.waitFor(() => expect(document.activeElement).toBe(audit));

    // The hash is still in the URL, but a later PRB selection on the same
    // mounted ProblemView must never re-read it: it focuses the new title.
    rerender(<ProblemView {...props} problemId="PRB-2" />);
    const title = await prbTitle("Segundo problema");
    await vi.waitFor(() => expect(document.activeElement).toBe(title));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
  });
});

/**
 * Rapid in-place PRB -> PRB navigation must never present the previous PRB's
 * ready projection as the newly requested PRB's state, nor let a late
 * completion for a superseded PRB replace the current one or steal focus.
 * Only PRB-* root fetches are held back, so each test controls exactly when
 * a PRB's own projection settles.
 */
describe("ProblemView — per-PRB identity boundary", () => {
  function deferredProvider() {
    const pending = new Map<string, { resolve: (detail: RecordDetail) => void; reject: (error: unknown) => void }>();
    const dataProvider: DataProvider = {
      ...provider,
      getRecord: (id) =>
        id.startsWith("PRB-")
          ? new Promise<RecordDetail>((resolve, reject) => {
              pending.set(id, { resolve, reject });
            })
          : Promise.resolve(records[id]),
    };
    return {
      dataProvider,
      resolve(id: string) {
        pending.get(id)?.resolve(records[id]);
        pending.delete(id);
      },
      reject(id: string, error: unknown) {
        pending.get(id)?.reject(error);
        pending.delete(id);
      },
    };
  }

  it("does not present the previous PRB's content as the newly requested PRB, and focuses the new title once ready", async () => {
    const { dataProvider, resolve } = deferredProvider();
    const { rerender } = render(<ProblemView {...props} dataProvider={dataProvider} problemId="PRB-1" />);
    await screen.findByText("A carregar Problema PRB-1…");
    resolve("PRB-1");
    await prbTitle("Problema de teste");

    rerender(<ProblemView {...props} dataProvider={dataProvider} problemId="PRB-2" />);
    await screen.findByText("A carregar Problema PRB-2…");
    expect(screen.queryByRole("heading", { name: "Problema de teste" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Segundo problema" })).toBeNull();

    resolve("PRB-2");
    const title = await prbTitle("Segundo problema");
    await vi.waitFor(() => expect(document.activeElement).toBe(title));
  });

  it("does not let a superseded PRB's late completion replace the current PRB or steal its focus", async () => {
    const { dataProvider, resolve } = deferredProvider();
    const { rerender } = render(<ProblemView {...props} dataProvider={dataProvider} problemId="PRB-1" />);
    await screen.findByText("A carregar Problema PRB-1…");
    rerender(<ProblemView {...props} dataProvider={dataProvider} problemId="PRB-2" />);
    await screen.findByText("A carregar Problema PRB-2…");
    rerender(<ProblemView {...props} dataProvider={dataProvider} problemId="PRB-3" />);
    await screen.findByText("A carregar Problema PRB-3…");

    resolve("PRB-3");
    const title = await prbTitle("Terceiro problema");
    await vi.waitFor(() => expect(document.activeElement).toBe(title));

    resolve("PRB-2");
    resolve("PRB-1");
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByRole("heading", { level: 2, name: "Terceiro problema" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Problema de teste" })).toBeNull();
    expect(document.activeElement).toBe(title);
  });

  it("keeps an error associated with the PRB whose load failed across a transition", async () => {
    const { dataProvider, resolve, reject } = deferredProvider();
    const { rerender } = render(<ProblemView {...props} dataProvider={dataProvider} problemId="PRB-1" />);
    await screen.findByText("A carregar Problema PRB-1…");
    rerender(<ProblemView {...props} dataProvider={dataProvider} problemId="PRB-2" />);
    await screen.findByText("A carregar Problema PRB-2…");
    reject("PRB-2", new Error("network failure"));
    await screen.findByText("Falha ao carregar o Problema");

    resolve("PRB-1");
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText("Falha ao carregar o Problema")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Problema de teste" })).toBeNull();
  });
});
