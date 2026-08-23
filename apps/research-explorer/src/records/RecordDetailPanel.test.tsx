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
