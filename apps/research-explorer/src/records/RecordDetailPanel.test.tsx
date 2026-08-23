import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordDetailPanel } from "./RecordDetailPanel";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";

/**
 * Slice 1 (docs/design/research-explorer-design-foundations.md): meaning
 * before metadata, compact provenance near the top, exhaustive technical
 * inspection closed-by-default but reachable, exact reference paths
 * preserved, no PRB context switcher on non-PRB records. EVD-000127 (the
 * REDUX-001/003 acceptance fixture named in the review) stands in for the
 * real corpus record of the same ID.
 */
const EVD_127_SUMMARY: RecordSummary = {
  id: "EVD-000127",
  type: "EVD-",
  label: "SASUE considera o processo atual de candidatura a alojamento em residência totalmente op...",
  file: "research/evidence/EVD-000127.yaml",
  // "analysis.contribution" is included here, matching real read-model.js
  // output (buildSummaryFields() includes every schema-declared enum field,
  // and analysis.contribution is one) — this is what exposed the duplicate
  // contribution rendering the tests below guard against.
  summaryFields: { strength: "primary-authoritative", verification: "REPORTED", "analysis.contribution": "CONTRADICTS" },
};

const EVD_127_DETAIL: RecordDetail = {
  id: "EVD-000127",
  type: "EVD-",
  file: "research/evidence/EVD-000127.yaml",
  record: {
    evidence_id: "EVD-000127",
    type: "stakeholder",
    observation: { summary: "SASUE considera o processo atual de candidatura a alojamento em residência totalmente operacional." },
    analysis: { contribution: "CONTRADICTS", related_problems: ["PRB-0006"] },
    personal_data: { present: false },
  },
  outgoingEdges: [{ field: "analysis.related_problems", ordinal: 0, to: "PRB-0006" }],
  incomingEdges: [],
};

const EVD_128_SUMMARY: RecordSummary = {
  id: "EVD-000128",
  type: "EVD-",
  label: "Serviço municipal confirma o horário de atendimento presencial.",
  file: "research/evidence/EVD-000128.yaml",
  summaryFields: { "analysis.contribution": "CONFIRMS" },
};

/** A non-contradictory contribution (CONFIRMS) with the same related-Problem shape as EVD-000127, to prove no contradiction-specific sentence leaks onto other canonical values. */
const EVD_128_DETAIL: RecordDetail = {
  id: "EVD-000128",
  type: "EVD-",
  file: "research/evidence/EVD-000128.yaml",
  record: {
    evidence_id: "EVD-000128",
    type: "institutional",
    observation: { summary: "Serviço municipal confirma o horário de atendimento presencial." },
    analysis: { contribution: "CONFIRMS", related_problems: ["PRB-0006"] },
    personal_data: { present: false },
  },
  outgoingEdges: [{ field: "analysis.related_problems", ordinal: 0, to: "PRB-0006" }],
  incomingEdges: [],
};

const PRB_0006_SUMMARY: RecordSummary = {
  id: "PRB-0006",
  type: "PRB-",
  label: "Adequate and affordable housing is difficult to access for some population groups",
  file: "research/problems/PRB-0006.yaml",
  summaryFields: { status: "OPEN" },
};

const PRB_0006_DETAIL: RecordDetail = {
  id: "PRB-0006",
  type: "PRB-",
  file: "research/problems/PRB-0006.yaml",
  record: { problem_id: "PRB-0006", status: "OPEN" },
  outgoingEdges: [],
  incomingEdges: [{ field: "analysis.related_problems", ordinal: 0, from: "EVD-000127" }],
};

const WID_0001_SUMMARY: RecordSummary = {
  id: "WID-0001",
  type: "WID-",
  label: "WID-0001",
  file: "research/widgets/WID-0001.yaml",
  summaryFields: {},
};

const WID_0001_DETAIL: RecordDetail = {
  id: "WID-0001",
  type: "WID-",
  file: "research/widgets/WID-0001.yaml",
  record: { widget_id: "WID-0001", nested: { flag: true } },
  outgoingEdges: [],
  // Deliberately connected to a PRB- record via a field name that is *not*
  // a canonical "related problem" reference, to prove connectivity alone
  // never triggers "Ver como Problema" (see the boundary test below).
  incomingEdges: [{ field: "widgets", ordinal: 0, from: "PRB-0006" }],
};

const ASM_0001_SUMMARY: RecordSummary = {
  id: "ASM-0001",
  type: "ASM-",
  label: "Avaliação de PRB-0006",
  file: "research/assessments/ASM-0001.yaml",
  summaryFields: { assessment_status: "CURRENT" },
};

const ASM_0001_DETAIL: RecordDetail = {
  id: "ASM-0001",
  type: "ASM-",
  file: "research/assessments/ASM-0001.yaml",
  record: { assessment_id: "ASM-0001", problem: "PRB-0006" },
  outgoingEdges: [{ field: "problem", ordinal: null, to: "PRB-0006" }],
  incomingEdges: [],
};

function buildLookup(...summaries: RecordSummary[]): Map<string, RecordSummary> {
  return new Map(summaries.map((s) => [s.id, s]));
}

function fakeProvider(details: Record<string, RecordDetail>): DataProvider {
  return {
    getManifest: () => Promise.reject(new Error("not used")),
    listRecords: () => Promise.reject(new Error("not used")),
    getRecord: (id: string) => (details[id] ? Promise.resolve(details[id]) : Promise.reject(new Error(`no fixture for ${id}`))),
    getEdges: () => Promise.reject(new Error("not used")),
  };
}

function noop() {}

describe("RecordDetailPanel — meaning-first hierarchy (REDUX-001/003)", () => {
  it("renders meaning before technical inspection, and provenance before the exhaustive field list, for EVD-000127", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "EVD-000127": EVD_127_DETAIL })}
        lookup={buildLookup(EVD_127_SUMMARY, PRB_0006_SUMMARY)}
        selectedId="EVD-000127"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;

    // The plain-language observation itself is on screen in the meaning
    // zone specifically — not just present somewhere in the raw field dump
    // (the same text also appears, correctly, inside the technical
    // disclosure below, so this assertion is scoped to the meaning zone).
    const meaningZone = await within(panel).findByLabelText("Significado");
    const meaning = within(meaningZone).getByText(/totalmente operacional/);

    const provenance = within(panel).getByText(/registo\(s\) relacionado\(s\)/).closest("section")!;
    const technicalSummary = within(panel).getByText("Inspeção técnica completa — todos os campos canónicos");
    const relacoes = within(panel).getByLabelText("Relações");

    // DOM order encodes reading order: meaning zone, then provenance, then
    // the technical disclosure, then full relationship detail.
    const order = meaning.compareDocumentPosition(provenance);
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(provenance.compareDocumentPosition(technicalSummary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(technicalSummary.compareDocumentPosition(relacoes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("defaults the technical field disclosure to closed", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "EVD-000127": EVD_127_DETAIL })}
        lookup={buildLookup(EVD_127_SUMMARY, PRB_0006_SUMMARY)}
        selectedId="EVD-000127"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByText("Inspeção técnica completa — todos os campos canónicos");
    const details = panel.querySelector(".technical-disclosure") as HTMLDetailsElement;
    expect(details.open).toBe(false);
  });

  it("keeps every canonical field reachable inside the technical disclosure, including nested/private fields", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "EVD-000127": EVD_127_DETAIL })}
        lookup={buildLookup(EVD_127_SUMMARY, PRB_0006_SUMMARY)}
        selectedId="EVD-000127"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByText("evidence_id");
    // Nested field names/values are still rendered, unmodified.
    expect(within(panel).getByText("analysis")).toBeTruthy();
    expect(within(panel).getByText("contribution")).toBeTruthy();
    expect(within(panel).getByText("CONTRADICTS")).toBeTruthy();
    expect(within(panel).getByText("present")).toBeTruthy();
    expect(within(panel).getByText("Não")).toBeTruthy();
  });

  it("shows compact provenance (unique related-record count, distinct from path counts) without requiring the technical disclosure to be opened", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "EVD-000127": EVD_127_DETAIL })}
        lookup={buildLookup(EVD_127_SUMMARY, PRB_0006_SUMMARY)}
        selectedId="EVD-000127"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    // EVD-000127 has 1 outgoing path (to PRB-0006) and 0 incoming paths — 1 unique related record.
    const provenance = await within(panel).findByText(/registo\(s\) relacionado\(s\)/);
    expect(provenance.textContent).toContain("1 registo(s) relacionado(s)");
    expect(provenance.textContent).toContain("0 caminho(s) de entrada");
    expect(provenance.textContent).toContain("1 caminho(s) de saída");
  });

  it("preserves exact outgoing reference-path notation (via <field>[ordinal]) in Relações", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "EVD-000127": EVD_127_DETAIL })}
        lookup={buildLookup(EVD_127_SUMMARY, PRB_0006_SUMMARY)}
        selectedId="EVD-000127"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const relacoes = within(panel).getByLabelText("Relações");
    expect(relacoes.textContent).toContain("referencia através de");
    expect(relacoes.textContent).toContain("analysis.related_problems");
    expect(relacoes.textContent).toContain("[0]");
    expect(relacoes.textContent).toContain("PRB-0006");
  });

  it("offers a 'Ver como Problema' action for a related PRB without implying it is a view of the EVD itself", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "EVD-000127": EVD_127_DETAIL })}
        lookup={buildLookup(EVD_127_SUMMARY, PRB_0006_SUMMARY)}
        selectedId="EVD-000127"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    expect(await within(panel).findByRole("button", { name: "Ver como Problema (PRB-0006)" })).toBeTruthy();
  });

  it("does not render the PRB Detalhe/Problema/Grafo context switcher on non-PRB Detail", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "EVD-000127": EVD_127_DETAIL })}
        lookup={buildLookup(EVD_127_SUMMARY, PRB_0006_SUMMARY)}
        selectedId="EVD-000127"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByText("Inspeção técnica completa — todos os campos canónicos");
    expect(within(panel).queryByRole("button", { name: "Ver como Problema (contexto completo)" })).toBeNull();
    expect(within(panel).queryByText("Detalhe · Problema · Grafo")).toBeNull();
    expect(within(panel).queryByRole("navigation", { name: /Navegação de/ })).toBeNull();
  });

  it("shows a persistent Detalhe/Problema/Grafo context switcher with Detalhe active on PRB Record Detail, preserving the PRB identity when navigating", async () => {
    const onViewAsProblem = vi.fn();
    const onViewInGraph = vi.fn();
    const user = userEvent.setup();
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "PRB-0006": PRB_0006_DETAIL })}
        lookup={buildLookup(PRB_0006_SUMMARY)}
        selectedId="PRB-0006"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={onViewAsProblem}
        onViewInGraph={onViewInGraph}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const switcher = within(panel).getByRole("navigation", { name: /PRB-0006/ });
    const detalheButton = within(switcher).getByRole("button", { name: "Detalhe" });
    expect(detalheButton.getAttribute("aria-current")).toBe("page");

    await user.click(within(switcher).getByRole("button", { name: "Problema" }));
    expect(onViewAsProblem).toHaveBeenCalledWith("PRB-0006");
  });

  it("UX-F: the Detalhe/Problema/Grafo context switcher's Grafo tab is visible but disabled, and cannot invoke onViewInGraph", async () => {
    const onViewInGraph = vi.fn();
    const user = userEvent.setup();
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "PRB-0006": PRB_0006_DETAIL })}
        lookup={buildLookup(PRB_0006_SUMMARY)}
        selectedId="PRB-0006"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={onViewInGraph}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const switcher = within(panel).getByRole("navigation", { name: /PRB-0006/ });
    const grafoTab = within(switcher).getByRole("button", { name: "Grafo" }) as HTMLButtonElement;
    expect(grafoTab.disabled).toBe(false);
    expect(grafoTab.getAttribute("aria-disabled")).toBe("true");
    expect(grafoTab.getAttribute("title")).toBe("Em desenvolvimento");

    grafoTab.focus();
    expect(document.activeElement).toBe(grafoTab);

    await user.click(grafoTab);
    expect(onViewInGraph).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    expect(onViewInGraph).not.toHaveBeenCalled();

    await user.keyboard(" ");
    expect(onViewInGraph).not.toHaveBeenCalled();
  });

  it("renders a future/unknown schema-shaped record generically, with no meaning-zone crash, and no fabricated meaning text", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "WID-0001": WID_0001_DETAIL })}
        lookup={buildLookup(WID_0001_SUMMARY, PRB_0006_SUMMARY)}
        selectedId="WID-0001"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    // No title/name/hypothesis/problem_statement/observation.summary field
    // exists on this fixture — the meaning zone must fall back honestly
    // (its own ID + an explicit "no meaning field" note) rather than
    // inventing content.
    await within(panel).findByText(/sem campo de significado canónico identificado/);
    // The generic technical field tree still renders the record correctly.
    expect(within(panel).getByText("widget_id")).toBeTruthy();
    expect(within(panel).getByText("flag")).toBeTruthy();
    expect(within(panel).getByText("Sim")).toBeTruthy();
  });

  it("does NOT offer 'Ver como Problema' merely because an edge happens to resolve to a PRB- record via a non-canonical field", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "WID-0001": WID_0001_DETAIL })}
        lookup={buildLookup(WID_0001_SUMMARY, PRB_0006_SUMMARY)}
        selectedId="WID-0001"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByText("widget_id");
    // WID-0001 has an incoming edge from PRB-0006, but via field "widgets" —
    // not a canonical "related problem" reference — so generic connectivity
    // must not be inferred as "this is the record's Problem".
    expect(within(panel).queryByRole("button", { name: /Ver como Problema/ })).toBeNull();
  });

  it("offers 'Ver como Problema' for a non-EVD record via its own schema's canonical `problem` reference field", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "ASM-0001": ASM_0001_DETAIL })}
        lookup={buildLookup(ASM_0001_SUMMARY, PRB_0006_SUMMARY)}
        selectedId="ASM-0001"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    expect(await within(panel).findByRole("button", { name: "Ver como Problema (PRB-0006)" })).toBeTruthy();
  });

  it("moves focus onto the freshly-loaded detail content (no regression to existing focus behavior)", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "EVD-000127": EVD_127_DETAIL })}
        lookup={buildLookup(EVD_127_SUMMARY, PRB_0006_SUMMARY)}
        selectedId="EVD-000127"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const content = await screen.findByLabelText("Detalhe de EVD-000127");
    expect(document.activeElement).toBe(content);
  });

  it("renders a breadcrumb back to Registos and invokes onBackToRecords when it is activated", async () => {
    const user = userEvent.setup();
    const onBackToRecords = vi.fn();
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "EVD-000127": EVD_127_DETAIL })}
        lookup={buildLookup(EVD_127_SUMMARY, PRB_0006_SUMMARY)}
        selectedId="EVD-000127"
        onSelect={noop}
        onBackToRecords={onBackToRecords}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const breadcrumb = await screen.findByLabelText("Localização");
    await within(breadcrumb).findByText("EVD-000127");
    await user.click(within(breadcrumb).getByRole("button", { name: "Registos" }));
    expect(onBackToRecords).toHaveBeenCalledTimes(1);
  });

  it("pairs CONTRADICTS with its contradiction-specific relationship sentence (approved Prototype A wording)", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "EVD-000127": EVD_127_DETAIL })}
        lookup={buildLookup(EVD_127_SUMMARY, PRB_0006_SUMMARY)}
        selectedId="EVD-000127"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const meaningZone = await within(panel).findByLabelText("Significado");
    expect(within(meaningZone).getByText(/desafia a leitura de/)).toBeTruthy();
  });

  it("does not attach the contradiction-specific sentence to a non-contradictory contribution value (CONFIRMS)", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "EVD-000128": EVD_128_DETAIL })}
        lookup={buildLookup(EVD_128_SUMMARY, PRB_0006_SUMMARY)}
        selectedId="EVD-000128"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const meaningZone = await within(panel).findByLabelText("Significado");
    // The canonical chip/label still renders — only the invented
    // contradiction-specific narrative is withheld.
    expect(within(meaningZone).getByText("Confirma")).toBeTruthy();
    expect(within(meaningZone).queryByText(/desafia a leitura de/)).toBeNull();
  });

  it("renders CONTRADICTS as exactly one contribution representation (chip only, not also via the generic summary fields), and keeps the target sentence", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "EVD-000127": EVD_127_DETAIL })}
        lookup={buildLookup(EVD_127_SUMMARY, PRB_0006_SUMMARY)}
        selectedId="EVD-000127"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const meaningZone = await within(panel).findByLabelText("Significado");
    // Exactly one "Contradiz" text node in the meaning zone — the dedicated
    // ContributionChip — not a second one from the generic summaryFields
    // (analysis.contribution) rendering.
    expect(within(meaningZone).getAllByText("Contradiz")).toHaveLength(1);
    expect(within(meaningZone).getByText(/desafia a leitura de/)).toBeTruthy();
    // The other schema-driven summary fields (strength, verification) are
    // untouched by the analysis.contribution exclusion.
    expect(within(meaningZone).getByText(/Força da evidência/)).toBeTruthy();
  });

  it("renders CONFIRMS as exactly one contribution representation and no contradiction-specific sentence", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "EVD-000128": EVD_128_DETAIL })}
        lookup={buildLookup(EVD_128_SUMMARY, PRB_0006_SUMMARY)}
        selectedId="EVD-000128"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const meaningZone = await within(panel).findByLabelText("Significado");
    expect(within(meaningZone).getAllByText("Confirma")).toHaveLength(1);
    expect(within(meaningZone).queryByText(/desafia a leitura de/)).toBeNull();
  });
});

/**
 * PRB-0001 acceptance case (relationship semantics correction): 10 outgoing
 * PRB→EVD paths, 11 incoming paths (the same 10 EVDs → PRB, plus ASM-0001 →
 * PRB) = 21 exact paths total, but only 11 unique related records (10 EVDs +
 * 1 ASM, since every EVD is reciprocally referenced in both directions).
 * `edges.length` alone (10 or 11 or 21) must never be presented as "records".
 */
function buildPrb0001Fixture() {
  const evdIds = Array.from({ length: 10 }, (_, i) => `EVD-${String(i + 1).padStart(6, "0")}`);
  const evdSummaries = evdIds.map(
    (id): RecordSummary => ({
      id,
      type: "EVD-",
      label: `Evidência ${id}`,
      file: `research/evidence/${id}.yaml`,
      summaryFields: {},
    })
  );
  const asmSummary: RecordSummary = {
    id: "ASM-0001",
    type: "ASM-",
    label: "Avaliação de PRB-0001",
    file: "research/assessments/ASM-0001.yaml",
    summaryFields: { assessment_status: "CURRENT" },
  };
  const prbSummary: RecordSummary = {
    id: "PRB-0001",
    type: "PRB-",
    label: "Problema PRB-0001",
    file: "research/problems/PRB-0001.yaml",
    summaryFields: { status: "OPEN" },
  };

  const outgoingEdges = evdIds.map((id, index) => ({ field: "evidence", ordinal: index, to: id }));
  const incomingEdges = [
    ...evdIds.map((id) => ({ field: "analysis.related_problems", ordinal: 0, from: id })),
    { field: "problem", ordinal: null, from: "ASM-0001" },
  ];

  const prbDetail: RecordDetail = {
    id: "PRB-0001",
    type: "PRB-",
    file: "research/problems/PRB-0001.yaml",
    record: { problem_id: "PRB-0001" },
    outgoingEdges,
    incomingEdges,
  };

  return { prbDetail, lookup: buildLookup(prbSummary, asmSummary, ...evdSummaries) };
}

describe("RecordDetailPanel — unique related-record cardinality (relationship semantics correction)", () => {
  it("PRB-0001-equivalent fixture: 21 exact paths (10 outgoing + 11 incoming) resolve to 11 unique related records, not 10 or 21", async () => {
    const { prbDetail, lookup } = buildPrb0001Fixture();
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "PRB-0001": prbDetail })}
        lookup={lookup}
        selectedId="PRB-0001"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const provenance = await within(panel).findByText(/registo\(s\) relacionado\(s\)/);
    // Unique-record cardinality (11) must differ from, and not be confused with, the raw edge counts (10 outgoing, 11 incoming, 21 total).
    expect(provenance.textContent).toContain("11 registo(s) relacionado(s)");
    expect(provenance.textContent).toContain("11 caminho(s) de entrada");
    expect(provenance.textContent).toContain("10 caminho(s) de saída");

    const relacoes = within(panel).getByLabelText("Relações");
    const relatedGroup = within(relacoes).getByLabelText("Registos relacionados");
    // Exactly 11 related-record entries (10 EVDs + 1 ASM), each rendered once.
    expect(within(relatedGroup).getAllByRole("button")).toHaveLength(11);
  });

  it("groups reciprocal incoming+outgoing paths to the same ID into a single related-record entry, with both directions and exact field/ordinal preserved", async () => {
    const { prbDetail, lookup } = buildPrb0001Fixture();
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "PRB-0001": prbDetail })}
        lookup={lookup}
        selectedId="PRB-0001"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const relacoes = within(panel).getByLabelText("Relações");
    const evdButton = await within(relacoes).findByRole("button", { name: /EVD-000001/ });
    const evdEntry = evdButton.closest("li") as HTMLElement;

    // Both directions are visible beneath the single EVD-000001 entry.
    expect(evdEntry.textContent).toContain("Saída");
    expect(evdEntry.textContent).toContain("Entrada");
    expect(evdEntry.textContent).toContain("evidence");
    expect(evdEntry.textContent).toContain("[0]");
    expect(evdEntry.textContent).toContain("analysis.related_problems");

    // Only one <li> (one related-record group) exists for EVD-000001, not two.
    const allEvd1Entries = within(relacoes).getAllByRole("button", { name: /EVD-000001/ });
    expect(allEvd1Entries).toHaveLength(1);
  });

  it("preserves the ASM-0001 (incoming-only) related record alongside the reciprocal EVDs, with its own exact path", async () => {
    const { prbDetail, lookup } = buildPrb0001Fixture();
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "PRB-0001": prbDetail })}
        lookup={lookup}
        selectedId="PRB-0001"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const relacoes = within(panel).getByLabelText("Relações");
    const asmButton = await within(relacoes).findByRole("button", { name: /ASM-0001/ });
    const asmEntry = asmButton.closest("li") as HTMLElement;

    expect(asmEntry.textContent).toContain("Entrada");
    expect(asmEntry.textContent).not.toContain("Saída");
    expect(asmEntry.textContent).toContain("problem");
  });

  it("still excludes generic connectivity from 'Ver como Problema' semantics — unrelated to the cardinality fix", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "WID-0001": WID_0001_DETAIL })}
        lookup={buildLookup(WID_0001_SUMMARY, PRB_0006_SUMMARY)}
        selectedId="WID-0001"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByText("widget_id");
    expect(within(panel).queryByRole("button", { name: /Ver como Problema/ })).toBeNull();
  });

  it("renders the correct gender-agreeing empty state ('Nenhum registo relacionado.') for a record with zero incoming/outgoing relationships", async () => {
    const isolatedSummary: RecordSummary = {
      id: "WID-0002",
      type: "WID-",
      label: "WID-0002",
      file: "research/widgets/WID-0002.yaml",
      summaryFields: {},
    };
    const isolatedDetail: RecordDetail = {
      id: "WID-0002",
      type: "WID-",
      file: "research/widgets/WID-0002.yaml",
      record: { widget_id: "WID-0002" },
      outgoingEdges: [],
      incomingEdges: [],
    };

    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "WID-0002": isolatedDetail })}
        lookup={buildLookup(isolatedSummary)}
        selectedId="WID-0002"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const relacoes = within(panel).getByLabelText("Relações");
    const relatedGroup = within(relacoes).getByLabelText("Registos relacionados");
    expect(within(relatedGroup).getByText("Nenhum registo relacionado.")).toBeTruthy();
    expect(within(relatedGroup).queryByText("Nenhuma.")).toBeNull();
  });
});

describe("RecordDetailPanel — SRC original-source action (UX-D §3)", () => {
  const SRC_PUBLIC_SUMMARY: RecordSummary = {
    id: "SRC-0002",
    type: "SRC-",
    label: "Plano de Desenvolvimento Social de Évora 2024-2027",
    file: "research/sources/SRC-0002.yaml",
    summaryFields: {},
  };

  function srcDetail(overrides: Record<string, unknown>): RecordDetail {
    return {
      id: "SRC-0002",
      type: "SRC-",
      file: "research/sources/SRC-0002.yaml",
      record: {
        source_id: "SRC-0002",
        publisher: "Município de Évora",
        access: { public: true },
        canonical_reference: "https://www.cm-evora.pt/exemplo.pdf",
        ...overrides,
      },
      outgoingEdges: [],
      incomingEdges: [],
    };
  }

  it("shows 'Abrir fonte' with a safe external link when the SRC is publicly accessible via HTTPS", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0002": srcDetail({}) })}
        lookup={buildLookup(SRC_PUBLIC_SUMMARY)}
        selectedId="SRC-0002"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const link = await within(panel).findByRole("link", { name: /Abrir fonte/ });
    expect(link.getAttribute("href")).toBe("https://www.cm-evora.pt/exemplo.pdf");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("does not show the action when access.public is false", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0002": srcDetail({ access: { public: false } }) })}
        lookup={buildLookup(SRC_PUBLIC_SUMMARY)}
        selectedId="SRC-0002"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    await screen.findByText("Detalhes");
    expect(screen.queryByRole("link", { name: /Abrir fonte/ })).toBeNull();
  });

  it("does not show the action when canonical_reference is missing", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0002": srcDetail({ canonical_reference: undefined }) })}
        lookup={buildLookup(SRC_PUBLIC_SUMMARY)}
        selectedId="SRC-0002"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    await screen.findByText("Detalhes");
    expect(screen.queryByRole("link", { name: /Abrir fonte/ })).toBeNull();
  });

  it("does not show the action for a non-HTTP(S) canonical_reference", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0002": srcDetail({ canonical_reference: "ftp://internal/file.pdf" }) })}
        lookup={buildLookup(SRC_PUBLIC_SUMMARY)}
        selectedId="SRC-0002"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    await screen.findByText("Detalhes");
    expect(screen.queryByRole("link", { name: /Abrir fonte/ })).toBeNull();
  });

  it("does not show the action for a malformed canonical_reference string", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0002": srcDetail({ canonical_reference: "not a url" }) })}
        lookup={buildLookup(SRC_PUBLIC_SUMMARY)}
        selectedId="SRC-0002"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    await screen.findByText("Detalhes");
    expect(screen.queryByRole("link", { name: /Abrir fonte/ })).toBeNull();
  });

  it("never shows the action on a non-SRC record, even with an HTTP(S)-shaped field of the same name", async () => {
    const evdDetail: RecordDetail = {
      id: "EVD-0001",
      type: "EVD-",
      file: "research/evidence/EVD-0001.yaml",
      record: { evidence_id: "EVD-0001", access: { public: true }, canonical_reference: "https://example.org/not-a-source" },
      outgoingEdges: [],
      incomingEdges: [],
    };
    const evdSummary: RecordSummary = { id: "EVD-0001", type: "EVD-", label: "EVD-0001", file: "research/evidence/EVD-0001.yaml", summaryFields: {} };

    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "EVD-0001": evdDetail })}
        lookup={buildLookup(evdSummary)}
        selectedId="EVD-0001"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    await screen.findByText("Detalhes");
    expect(screen.queryByRole("link", { name: /Abrir fonte/ })).toBeNull();
  });
});

describe("RecordDetailPanel — UX-E record orientation & quick-read", () => {
  it("exposes an EVD quick read with evidence nature and representativeness from existing canonical data, without duplicating relationship navigation", async () => {
    const detail: RecordDetail = {
      id: "EVD-000127",
      type: "EVD-",
      file: "research/evidence/EVD-000127.yaml",
      record: {
        evidence_id: "EVD-000127",
        observation: { summary: "Texto de observação." },
        evidence_nature: "claim",
        analysis: { representativeness: "LIMITED", related_problems: ["PRB-0006"] },
      },
      outgoingEdges: [{ field: "analysis.related_problems", ordinal: 0, to: "PRB-0006" }],
      incomingEdges: [],
    };
    const summary: RecordSummary = { id: "EVD-000127", type: "EVD-", label: "…", file: detail.file, summaryFields: {} };

    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "EVD-000127": detail })}
        lookup={buildLookup(summary, PRB_0006_SUMMARY)}
        selectedId="EVD-000127"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const quickRead = await within(panel).findByLabelText("Leitura rápida");
    expect(within(quickRead).getByText("Alegação")).toBeTruthy();
    expect(within(quickRead).getByText("Limitada")).toBeTruthy();

    // The related PRB still appears exactly once, via the existing
    // Relações section — the quick read does not add a second button.
    const relacoes = within(panel).getByLabelText("Relações");
    expect(within(relacoes).getAllByRole("button", { name: new RegExp(PRB_0006_SUMMARY.label) })).toHaveLength(1);
  });

  it("does not invent EVD quick-read fields that are absent from the canonical record", async () => {
    const detail: RecordDetail = {
      id: "EVD-000129",
      type: "EVD-",
      file: "research/evidence/EVD-000129.yaml",
      record: {
        evidence_id: "EVD-000129",
        observation: { summary: "Texto de observação sem analysis." },
      },
      outgoingEdges: [],
      incomingEdges: [],
    };
    const summary: RecordSummary = { id: "EVD-000129", type: "EVD-", label: "…", file: detail.file, summaryFields: {} };

    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "EVD-000129": detail })}
        lookup={buildLookup(summary)}
        selectedId="EVD-000129"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    // No evidence_nature/representativeness/relationship fields exist on this
    // fixture, and no source is present, so the quick-read section must not render at all.
    await within(panel).findByText("evidence_id");
    expect(within(panel).queryByLabelText("Leitura rápida")).toBeNull();
  });

  it("exposes an SRC quick read with title, publisher, and freshness/access-status labels from existing canonical data", async () => {
    const detail: RecordDetail = {
      id: "SRC-0002",
      type: "SRC-",
      file: "research/sources/SRC-0002.yaml",
      record: {
        source_id: "SRC-0002",
        name: "Plano de Desenvolvimento Social de Évora 2024-2027",
        publisher: "Município de Évora",
        access: { public: true },
        freshness: { status: "UNKNOWN" },
        canonical_reference: "https://www.cm-evora.pt/exemplo.pdf",
      },
      outgoingEdges: [],
      incomingEdges: [],
    };
    const summary: RecordSummary = { id: "SRC-0002", type: "SRC-", label: "Plano de Desenvolvimento Social de Évora 2024-2027", file: detail.file, summaryFields: {} };

    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0002": detail })}
        lookup={buildLookup(summary)}
        selectedId="SRC-0002"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const quickRead = await within(panel).findByLabelText("Leitura rápida");
    expect(within(quickRead).getByText("Plano de Desenvolvimento Social de Évora 2024-2027")).toBeTruthy();
    expect(within(quickRead).getByText("Município de Évora")).toBeTruthy();
    expect(within(quickRead).getByText("Desconhecida")).toBeTruthy();
    expect(within(quickRead).getByText("Sim")).toBeTruthy();

    // The existing "Abrir fonte" action still renders exactly once (in the
    // rail), not duplicated inside the quick read.
    expect(within(panel).getAllByRole("link", { name: /Abrir fonte/ })).toHaveLength(1);
  });

  it("does not invent SRC quick-read fields that are absent from the canonical record", async () => {
    const detail: RecordDetail = {
      id: "SRC-0003",
      type: "SRC-",
      file: "research/sources/SRC-0003.yaml",
      record: { source_id: "SRC-0003" },
      outgoingEdges: [],
      incomingEdges: [],
    };
    const summary: RecordSummary = { id: "SRC-0003", type: "SRC-", label: "SRC-0003", file: detail.file, summaryFields: {} };

    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0003": detail })}
        lookup={buildLookup(summary)}
        selectedId="SRC-0003"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByText("source_id");
    expect(within(panel).queryByLabelText("Leitura rápida")).toBeNull();
  });

  it("shows a plain-language orientation sentence before the technical inspection, for EVD", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "EVD-000127": EVD_127_DETAIL })}
        lookup={buildLookup(EVD_127_SUMMARY, PRB_0006_SUMMARY)}
        selectedId="EVD-000127"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const meaningZone = await within(panel).findByLabelText("Significado");
    const orientation = within(meaningZone).getByText(/Este é um registo técnico da investigação\. Mostra a informação guardada e as suas ligações/);
    const technicalSummary = within(panel).getByText("Inspeção técnica completa — todos os campos canónicos");
    expect(orientation.compareDocumentPosition(technicalSummary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the technical inspection clearly labeled as an audit surface, with canonical raw field paths unchanged", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "EVD-000127": EVD_127_DETAIL })}
        lookup={buildLookup(EVD_127_SUMMARY, PRB_0006_SUMMARY)}
        selectedId="EVD-000127"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByText("Inspeção técnica completa — todos os campos canónicos");
    await within(panel).findByText(/auditabilidade e rastreabilidade/);
    // Raw canonical field names remain untranslated inside the technical disclosure.
    expect(within(panel).getByText("analysis")).toBeTruthy();
    expect(within(panel).getByText("related_problems")).toBeTruthy();
  });

  it("does not add the EVD/SRC quick read for a PRB record, and leaves ContextTabs/navigation unchanged", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "PRB-0006": PRB_0006_DETAIL })}
        lookup={buildLookup(PRB_0006_SUMMARY)}
        selectedId="PRB-0006"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const switcher = within(panel).getByRole("navigation", { name: /PRB-0006/ });
    expect(within(switcher).getByRole("button", { name: "Detalhe" }).getAttribute("aria-current")).toBe("page");
    expect(within(panel).queryByLabelText("Leitura rápida")).toBeNull();
  });
});

/**
 * UX-G2: ASM current-state comprehension (docs/design/research-explorer/ux-g2-asm-audit.md).
 * Fixtures mirror the shapes of the real corpus cases named in the audit's
 * acceptance coverage: ASM-0001 (normal DEEPEN/current), ASM-0004
 * (UNKNOWN-heavy/thin-evidence), ASM-0005 (mature/multi-revision), ASM-0009
 * (WATCH + civic importance), ASM-0010 (WATCH/posture interpretation).
 */
describe("RecordDetailPanel — UX-G2 ASM current-state comprehension", () => {
  const PRB_0001_SUMMARY: RecordSummary = {
    id: "PRB-0001",
    type: "PRB-",
    label: "Reduced evening/weekend/holiday transport service",
    file: "research/problems/PRB-0001.yaml",
    summaryFields: { status: "OPEN" },
  };

  function asmDetail(id: string, problem: string, overrides: Record<string, unknown>): RecordDetail {
    return {
      id,
      type: "ASM-",
      file: `research/assessments/${id}.yaml`,
      record: {
        assessment_id: id,
        problem,
        as_of: "2026-08-12",
        phase: "D3",
        assessment_status: "CURRENT",
        evidence_confidence: {
          overall: "MEDIUM",
          independence: "MEDIUM",
          coherence: "HIGH",
          adequacy: "MEDIUM",
          relevance: "HIGH",
          currentness: "HIGH",
          contradiction_status: "LOW",
          stakeholder_validation: "PENDING",
        },
        civic_importance: { reach: "MEDIUM", frequency: "UNKNOWN", severity: "MEDIUM", persistence: "HIGH", equity: "UNKNOWN" },
        journey_understanding: "PARTIAL",
        causal_understanding: "PARTIAL",
        existing_solution_understanding: "PARTIAL",
        remaining_gap: "PARTIAL",
        digital_leverage: "not_assessed",
        structure_action: "KEEP",
        decision_gates: {
          problem_real: "PASS",
          civic_importance: "PARTIAL",
          journey_understood: "PARTIAL",
          root_cause_understood: "PARTIAL",
          remaining_gap_supported: "PARTIAL",
          digital_causality: "NOT_ASSESSED",
          operability: "NOT_ASSESSED",
          testability: "NOT_ASSESSED",
        },
        critical_unknowns: {
          U1: { question: "Que linhas sofrem a redução mais acentuada?", decision_impact: "HIGH", target_phase: "D3", best_next_evidence: ["análise de horários"] },
        },
        triage: "DEEPEN",
        next_action: "Do not assume a software solution. Internal operational next step only.",
        notes: "WU017 baseline internal lineage accounting, not for public display.",
        ...overrides,
      },
      outgoingEdges: [{ field: "problem", ordinal: null, to: problem }],
      incomingEdges: [],
    };
  }

  const ASM_0001_LIKE = asmDetail("ASM-0001", "PRB-0001", {});

  function renderAsm(detail: RecordDetail, extraSummaries: RecordSummary[] = []) {
    const summary: RecordSummary = { id: detail.id, type: "ASM-", label: detail.id, file: detail.file, summaryFields: { assessment_status: "CURRENT" } };
    return render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ [detail.id]: detail })}
        lookup={buildLookup(summary, PRB_0001_SUMMARY, ...extraSummaries)}
        selectedId={detail.id}
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
  }

  it("orients the ASM meaning zone to its related PRB, replacing the empty placeholder", async () => {
    renderAsm(ASM_0001_LIKE);
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const meaningZone = await within(panel).findByLabelText("Significado");
    expect(within(meaningZone).getByText(/Avaliação do Problema/)).toBeTruthy();
    expect(within(meaningZone).getByText(/PRB-0001/)).toBeTruthy();
    expect(within(meaningZone).queryByText(/sem campo de significado canónico identificado/)).toBeNull();
  });

  it("shows assessment currentness (assessment_status + as_of) in the orientation", async () => {
    renderAsm(ASM_0001_LIKE);
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const meaningZone = await within(panel).findByLabelText("Significado");
    expect(within(meaningZone).getByText("Atual")).toBeTruthy();
    expect(within(meaningZone).getByText(/2026-08-12/)).toBeTruthy();
  });

  it("offers a route to the Problem representation (Ver como Problema) from an ASM opened directly", async () => {
    renderAsm(ASM_0001_LIKE);
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    expect(await within(panel).findByRole("button", { name: "Ver como Problema (PRB-0001)" })).toBeTruthy();
  });

  it("names all 8 decision_gates individually with their PASS/PARTIAL/FAIL/UNKNOWN/NOT_ASSESSED values and glosses, in canonical protocol order", async () => {
    renderAsm(ASM_0001_LIKE);
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const gates = await within(panel).findByLabelText("Como chegámos à decisão");
    const gateNames = ["Problema real", "Importância cívica", "Percurso compreendido", "Causa-raiz compreendida", "Lacuna remanescente sustentada", "Causalidade digital", "Operacionalidade", "Testabilidade"];
    for (const name of gateNames) {
      expect(within(gates).getByText(name)).toBeTruthy();
    }
    // PARTIAL is distinguished from UNKNOWN/NOT_ASSESSED, not collapsed.
    expect(within(gates).getAllByText("Cumpre parcialmente").length).toBeGreaterThan(0);
    expect(within(gates).getAllByText("Não avaliado").length).toBeGreaterThan(0);

    // Order follows the canonical protocol order (problem_real first, testability last).
    const order = gateNames.map((name) => within(gates).getByText(name).compareDocumentPosition(within(gates).getByText(gateNames[gateNames.length - 1])));
    expect(order.every((bits) => (bits & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 || bits === 0)).toBe(true);
  });

  it("does not synthesize per-gate rationale — no gate row quotes or paraphrases `notes`/`next_action`", async () => {
    renderAsm(ASM_0001_LIKE);
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const gates = await within(panel).findByLabelText("Como chegámos à decisão");
    expect(within(gates).queryByText(/Do not assume a software solution/)).toBeNull();
    expect(within(gates).queryByText(/WU017/)).toBeNull();
  });

  it("groups evidence_confidence and civic_importance dimensions under 'O que sabemos' with field captions, never raw schema paths", async () => {
    renderAsm(ASM_0001_LIKE);
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const known = await within(panel).findByLabelText("O que sabemos");
    expect(within(known).getByText("Confiança na evidência")).toBeTruthy();
    expect(within(known).getByText("Importância cívica")).toBeTruthy();
    // Each dimension chip carries its field caption as an accessible label.
    expect(within(known).getByLabelText(/^Coerência:/)).toBeTruthy();
    expect(within(known).getByLabelText(/^Alcance:/)).toBeTruthy();
    // Raw schema path must never appear in the public-facing layer.
    expect(within(known).queryByText(/evidence_confidence\.coherence/)).toBeNull();
    expect(within(known).queryByText("civic_importance.reach")).toBeNull();
  });

  it("never aggregates civic_importance dimensions into a single score", async () => {
    renderAsm(ASM_0001_LIKE);
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const known = await within(panel).findByLabelText("O que sabemos");
    // All five dimensions render individually, each with its own caption.
    for (const caption of ["Alcance", "Frequência", "Gravidade", "Persistência", "Equidade"]) {
      expect(within(known).getByLabelText(new RegExp(`^${caption}:`))).toBeTruthy();
    }
    // No aggregate/score wording is attached to any individual dimension chip.
    expect(within(known).queryByText(/^\d+([.,]\d+)?$/)).toBeNull();
  });

  it("gives evidence_confidence.contradiction_status safe, non-inverted wording before surfacing it (LOW = coherent, not low confidence)", async () => {
    renderAsm(ASM_0001_LIKE);
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const known = await within(panel).findByLabelText("O que sabemos");
    expect(within(known).getByText(/Baixo grau de contradição/)).toBeTruthy();
  });

  it("shows the WATCH/STOP project-posture caveat for a WATCH triage, distinguishing it from civic importance", async () => {
    const asm0009Like = asmDetail("ASM-0009", "PRB-0009", {
      civic_importance: { reach: "HIGH", frequency: "UNKNOWN", severity: "HIGH", persistence: "MEDIUM", equity: "UNKNOWN" },
      decision_gates: {
        problem_real: "PASS",
        civic_importance: "PASS",
        journey_understood: "FAIL",
        root_cause_understood: "PASS",
        remaining_gap_supported: "PARTIAL",
        digital_causality: "FAIL",
        operability: "NOT_ASSESSED",
        testability: "NOT_ASSESSED",
      },
      digital_leverage: "low",
      triage: "WATCH",
    });
    const prb0009: RecordSummary = { id: "PRB-0009", type: "PRB-", label: "Waste collection reliability", file: "research/problems/PRB-0009.yaml", summaryFields: {} };
    renderAsm(asm0009Like, [prb0009]);

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const summary = await within(panel).findByLabelText("Estado atual e decisão");
    expect(within(summary).getByText("Acompanhar")).toBeTruthy();
    expect(within(summary).getByText(/não é um juízo sobre a importância cívica/)).toBeTruthy();

    // civic_importance itself (PASS / HIGH reach / HIGH severity) still shows separately, unreconciled with triage.
    const known = within(panel).getByLabelText("O que sabemos");
    expect(within(known).getByLabelText(/^Alcance:/)).toBeTruthy();
  });

  it("shows the WATCH/STOP caveat for a second WATCH case (posture interpretation), confirming it is not ASM-0009-specific", async () => {
    const asm0010Like = asmDetail("ASM-0010", "PRB-0010", {
      journey_understanding: "INSUFFICIENT",
      causal_understanding: "SUFFICIENT",
      existing_solution_understanding: "PARTIAL",
      digital_leverage: "low",
      decision_gates: {
        problem_real: "PASS",
        civic_importance: "PARTIAL",
        journey_understood: "FAIL",
        root_cause_understood: "PASS",
        remaining_gap_supported: "PARTIAL",
        digital_causality: "FAIL",
        operability: "NOT_ASSESSED",
        testability: "NOT_ASSESSED",
      },
      triage: "WATCH",
    });
    const prb0010: RecordSummary = { id: "PRB-0010", type: "PRB-", label: "Road surface degradation", file: "research/problems/PRB-0010.yaml", summaryFields: {} };
    renderAsm(asm0010Like, [prb0010]);

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const summary = await within(panel).findByLabelText("Estado atual e decisão");
    expect(within(summary).getByText("Acompanhar")).toBeTruthy();
    expect(within(summary).getByText(/postura do projeto Open Évora/)).toBeTruthy();
  });

  it("does not attach the WATCH/STOP caveat to a DEEPEN triage", async () => {
    renderAsm(ASM_0001_LIKE);
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const summary = await within(panel).findByLabelText("Estado atual e decisão");
    expect(within(summary).getByText("Aprofundar")).toBeTruthy();
    expect(within(summary).queryByText(/postura do projeto Open Évora/)).toBeNull();
  });

  it("pairs existing_solution_understanding with remaining_gap so their distinct meanings cannot be conflated", async () => {
    const asm0005Like = asmDetail("ASM-0005", "PRB-0005", {
      phase: "D4",
      existing_solution_understanding: "SUFFICIENT",
      remaining_gap: "PARTIAL",
      journey_understanding: "PARTIAL",
      causal_understanding: "PARTIAL",
      civic_importance: { reach: "HIGH", frequency: "HIGH", severity: "MEDIUM", persistence: "HIGH", equity: "UNKNOWN" },
    });
    const prb0005: RecordSummary = { id: "PRB-0005", type: "PRB-", label: "Parking pressure", file: "research/problems/PRB-0005.yaml", summaryFields: {} };
    renderAsm(asm0005Like, [prb0005]);

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const unknown = await within(panel).findByLabelText("O que ainda não sabemos");
    const pair = unknown.querySelector(".asm-solution-gap-pair") as HTMLElement;
    expect(pair).toBeTruthy();
    expect(within(pair).getByText(/Compreensão das soluções existentes/)).toBeTruthy();
    expect(within(pair).getByText(/Lacuna remanescente/)).toBeTruthy();
    expect(within(pair).getByText("Suficiente")).toBeTruthy();
    expect(within(pair).getByText("Parcial")).toBeTruthy();
  });

  it("surfaces critical_unknowns using the existing question/impact/phase/next-evidence pattern", async () => {
    renderAsm(ASM_0001_LIKE);
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const unknown = await within(panel).findByLabelText("O que ainda não sabemos");
    expect(within(unknown).getByText("Que linhas sofrem a redução mais acentuada?")).toBeTruthy();
    expect(within(unknown).getByText("análise de horários")).toBeTruthy();
  });

  it("handles an UNKNOWN-heavy, thin-evidence ASM (ASM-0004-like) as a first-class, non-alarming state — UNKNOWN stays distinct from PARTIAL/NOT_ASSESSED", async () => {
    const asm0004Like = asmDetail("ASM-0004", "PRB-0004", {
      evidence_confidence: {
        overall: "MEDIUM",
        independence: "MEDIUM",
        coherence: "MEDIUM",
        adequacy: "LOW",
        relevance: "MEDIUM",
        currentness: "MEDIUM",
        contradiction_status: "UNKNOWN",
        stakeholder_validation: "PENDING",
      },
      civic_importance: { reach: "UNKNOWN", frequency: "UNKNOWN", severity: "UNKNOWN", persistence: "UNKNOWN", equity: "UNKNOWN" },
      journey_understanding: "INSUFFICIENT",
      existing_solution_understanding: "SUFFICIENT",
      decision_gates: {
        problem_real: "PASS",
        civic_importance: "UNKNOWN",
        journey_understood: "FAIL",
        root_cause_understood: "PARTIAL",
        remaining_gap_supported: "PARTIAL",
        digital_causality: "FAIL",
        operability: "NOT_ASSESSED",
        testability: "PARTIAL",
      },
      digital_leverage: "low",
    });
    const prb0004: RecordSummary = { id: "PRB-0004", type: "PRB-", label: "Cycling network discontinuity", file: "research/problems/PRB-0004.yaml", summaryFields: {} };
    renderAsm(asm0004Like, [prb0004]);

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const known = await within(panel).findByLabelText("O que sabemos");
    // All five civic_importance dimensions are UNKNOWN — rendered plainly, not omitted or flagged as an error state.
    const civicGroup = within(known).getByText("Importância cívica").closest(".asm-dimension-group") as HTMLElement;
    expect(within(civicGroup).getAllByText("Desconhecida").length).toBe(5);

    const gates = within(panel).getByLabelText("Como chegámos à decisão");
    expect(within(gates).getByText("Desconhecido")).toBeTruthy(); // civic_importance gate: UNKNOWN
    expect(within(gates).getAllByText("Cumpre parcialmente").length).toBeGreaterThan(0); // root_cause_understood/remaining_gap_supported/testability: PARTIAL, distinct from UNKNOWN
  });

  it("keeps notes and next_action out of the public-facing ASM presentation, reachable only via technical inspection", async () => {
    renderAsm(ASM_0001_LIKE);
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;

    for (const publicRegion of [
      await within(panel).findByLabelText("Significado"),
      within(panel).getByLabelText("Estado atual e decisão"),
      within(panel).getByLabelText("Como chegámos à decisão"),
      within(panel).getByLabelText("O que sabemos"),
      within(panel).getByLabelText("O que ainda não sabemos"),
    ]) {
      expect(within(publicRegion).queryByText(/Do not assume a software solution/)).toBeNull();
      expect(within(publicRegion).queryByText(/WU017 baseline/)).toBeNull();
    }

    // Both remain reachable inside the technical disclosure.
    const technical = within(panel).getByText("Inspeção técnica completa — todos os campos canónicos").closest(".technical-disclosure") as HTMLElement;
    expect(within(technical).getByText("next_action")).toBeTruthy();
    expect(within(technical).getByText("notes")).toBeTruthy();
  });

  it("never surfaces raw schema-path labels (e.g. evidence_confidence.coherence) anywhere in the main ASM presentation", async () => {
    renderAsm(ASM_0001_LIKE);
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;

    for (const publicRegion of [
      await within(panel).findByLabelText("Significado"),
      within(panel).getByLabelText("Estado atual e decisão"),
      within(panel).getByLabelText("Como chegámos à decisão"),
      within(panel).getByLabelText("O que sabemos"),
      within(panel).getByLabelText("O que ainda não sabemos"),
    ]) {
      expect(within(publicRegion).queryByText(/evidence_confidence\./)).toBeNull();
      expect(within(publicRegion).queryByText(/civic_importance\./)).toBeNull();
      expect(within(publicRegion).queryByText(/decision_gates\./)).toBeNull();
    }
  });

  it("preserves the summary/status row (assessment_status, structure_action, digital_leverage) as compact chips", async () => {
    renderAsm(ASM_0001_LIKE);
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const summary = await within(panel).findByLabelText("Estado atual e decisão");
    expect(within(summary).getByText("Atual")).toBeTruthy();
    expect(within(summary).getByText("Manter")).toBeTruthy();
    expect(within(summary).getByText("Não avaliada")).toBeTruthy();
  });
});
