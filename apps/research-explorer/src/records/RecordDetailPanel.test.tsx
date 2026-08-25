import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordDetailPanel } from "./RecordDetailPanel";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";

/**
 * Meaning before metadata, compact provenance near the top, exhaustive
 * technical inspection closed-by-default but reachable, exact reference
 * paths preserved, no PRB context switcher on non-PRB records. EVD-000127
 * stands in for the real corpus record of the same ID.
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
    // No title/name/problem_statement/observation.summary field
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
 * PRB→EVD paths, 11 incoming paths (the same 10 EVDs → PRB, plus one
 * incoming-only EVD-000011 → PRB) = 21 exact paths total, but only 11
 * unique related records (10 EVDs reciprocally referenced in both
 * directions, plus 1 incoming-only EVD). `edges.length` alone (10 or 11 or
 * 21) must never be presented as "records".
 */
function buildPrb0001Fixture() {
  const evdIds = Array.from({ length: 10 }, (_, i) => `EVD-${String(i + 1).padStart(6, "0")}`);
  const incomingOnlyId = "EVD-000011";
  const evdSummaries = evdIds.map(
    (id): RecordSummary => ({
      id,
      type: "EVD-",
      label: `Evidência ${id}`,
      file: `research/evidence/${id}.yaml`,
      summaryFields: {},
    })
  );
  const incomingOnlySummary: RecordSummary = {
    id: incomingOnlyId,
    type: "EVD-",
    label: "Evidência EVD-000011 (apenas entrada)",
    file: "research/evidence/EVD-000011.yaml",
    summaryFields: {},
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
    { field: "analysis.related_problems", ordinal: 0, from: incomingOnlyId },
  ];

  const prbDetail: RecordDetail = {
    id: "PRB-0001",
    type: "PRB-",
    file: "research/problems/PRB-0001.yaml",
    record: { problem_id: "PRB-0001" },
    outgoingEdges,
    incomingEdges,
  };

  return { prbDetail, lookup: buildLookup(prbSummary, incomingOnlySummary, ...evdSummaries), incomingOnlyId };
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

    // RD-01E: PRB Proveniência no longer repeats relationship counts (that
    // "1 registo(s) relacionado(s)" line only exists in the generic,
    // non-PRB ProvenancePanel) — unique-record cardinality (11, distinct
    // from the raw edge counts of 10 outgoing/11 incoming/21 total) is
    // instead directly observable as the length of each Relações no corpus
    // direction list below.
    // RD-01D: PRB Relações no corpus groups by direction with unique IDs per direction — 10 unique outgoing (evidence[0..9] all reciprocated) + 11 unique incoming (10 reciprocal + 1 incoming-only).
    const relacoes = within(panel).getByLabelText("Relações");
    const relationsBoundary = within(relacoes).getByLabelText("Relações no corpus");
    const outgoingHeading = within(relationsBoundary).getByText(/Referências de saída/);
    const incomingHeading = within(relationsBoundary).getByText(/Referências de entrada/);
    const outgoingList = outgoingHeading.nextElementSibling as HTMLElement;
    const incomingList = incomingHeading.nextElementSibling as HTMLElement;
    expect(within(outgoingList).getAllByRole("button")).toHaveLength(10);
    expect(within(incomingList).getAllByRole("button")).toHaveLength(11);
  });

  it("RD-01D: lists a record referenced through both directions once per direction, without repeating canonical field paths", async () => {
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
    const relationsBoundary = within(relacoes).getByLabelText("Relações no corpus");

    // EVD-000001 is reciprocal (outgoing evidence[0] + incoming analysis.related_problems[0]) — appears exactly once in each direction's list, never with path notation.
    expect(within(relationsBoundary).getAllByRole("button", { name: /EVD-000001/ })).toHaveLength(2);
    expect(relationsBoundary.textContent).not.toContain("evidence[0]");
    expect(relationsBoundary.textContent).not.toContain("analysis.related_problems");
    expect(relationsBoundary.textContent).not.toContain("referencia através de");
    expect(relationsBoundary.textContent).not.toContain("referenciado através de");
  });

  it("RD-01D: preserves the incoming-only EVD-000011 related record in the incoming list only", async () => {
    const { prbDetail, lookup, incomingOnlyId } = buildPrb0001Fixture();
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
    const relationsBoundary = within(relacoes).getByLabelText("Relações no corpus");
    const outgoingHeading = within(relationsBoundary).getByText(/Referências de saída/);
    const incomingHeading = within(relationsBoundary).getByText(/Referências de entrada/);
    const outgoingList = outgoingHeading.nextElementSibling as HTMLElement;
    const incomingList = incomingHeading.nextElementSibling as HTMLElement;

    expect(within(incomingList).getByRole("button", { name: new RegExp(incomingOnlyId) })).toBeTruthy();
    expect(within(outgoingList).queryByRole("button", { name: new RegExp(incomingOnlyId) })).toBeNull();
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

  it("keeps the PI-01 canonical Problem fields (causal_reading, investigation.*, solution_landscape_status) inspectable in the generic technical disclosure, with no projection assumption tied to the removed fields", async () => {
    const piDetail: RecordDetail = {
      id: "PRB-0100",
      type: "PRB-",
      file: "research/problems/PRB-0100.yaml",
      record: {
        problem_id: "PRB-0100",
        status: "OPEN",
        causal_reading: "A bounded, unvalidated causal reading.",
        investigation: {
          open_questions: [{ question: "What remains unresolved?" }],
          path: { initial_signal: { summary: "First signal." } },
        },
        solution_landscape_status: "assessed",
      },
      outgoingEdges: [],
      incomingEdges: [],
    };
    const piSummary: RecordSummary = {
      id: "PRB-0100",
      type: "PRB-",
      label: "PI-01 fixture",
      file: "research/problems/PRB-0100.yaml",
      summaryFields: { status: "OPEN", solution_landscape_status: "assessed" },
    };

    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "PRB-0100": piDetail })}
        lookup={buildLookup(piSummary)}
        selectedId="PRB-0100"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    // RD-01E: PRB records label the raw fallback "Estrutura técnica completa" rather than the generic "Inspeção técnica completa — todos os campos canónicos".
    await within(panel).findByText("Estrutura técnica completa");
    const disclosure = within(panel).getByText("Estrutura técnica completa").closest("details") as HTMLElement;
    // Raw canonical field paths for the new PI-01 fields remain inspectable, untranslated.
    expect(within(disclosure).getByText("causal_reading")).toBeTruthy();
    expect(within(disclosure).getByText("investigation")).toBeTruthy();
    expect(within(disclosure).getByText("solution_landscape_status")).toBeTruthy();
    // No leftover rendering assumption tied to the fields PI-01 removed.
    expect(within(disclosure).queryByText("current_journey")).toBeNull();
    expect(within(disclosure).queryByText("reported_consequences")).toBeNull();
    expect(within(disclosure).queryByText("possible_root_causes")).toBeNull();
    expect(within(disclosure).queryByText("existing_solutions")).toBeNull();
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

describe("RecordDetailPanel — RD-01A PRB Detail header + technical metadata", () => {
  const PRB_RD01A_DETAIL: RecordDetail = {
    id: "PRB-0001",
    type: "PRB-",
    file: "research/problems/PRB-0001.yaml",
    record: {
      problem_id: "PRB-0001",
      title: "A utilidade prática dos transportes públicos varia consoante os horários e os territórios",
      domain: ["MOB"],
      geography: { level: "municipality", area: "Évora" },
      problem_statement: "A cobertura dos transportes públicos em Évora é, em termos globais, ampla...",
      evidence_status: "corroborated",
      validation_status: "unvalidated",
      digital_tractability: "not_assessed",
      solution_landscape_status: "not_assessed",
      status: "OPEN",
      decision_basis: { contract_version: "0.1" },
    },
    outgoingEdges: [],
    incomingEdges: [],
  };
  const PRB_RD01A_SUMMARY: RecordSummary = {
    id: "PRB-0001",
    type: "PRB-",
    label: "PRB-0001",
    file: "research/problems/PRB-0001.yaml",
    summaryFields: { status: "OPEN" },
  };

  async function renderPrb001() {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "PRB-0001": PRB_RD01A_DETAIL })}
        lookup={buildLookup(PRB_RD01A_SUMMARY)}
        selectedId="PRB-0001"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    return (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
  }

  it("replaces the meaning-oriented hero with ID, canonical title, and the technical orientation sentence — never problem_statement", async () => {
    const panel = await renderPrb001();
    const meaning = within(panel).getByLabelText("Significado");
    expect(within(meaning).getByText("Inspeção técnica do registo canónico.")).toBeTruthy();
    expect(within(meaning).getByText(PRB_RD01A_DETAIL.record.title as string)).toBeTruthy();
    expect(within(meaning).queryByText(/A cobertura dos transportes públicos/)).toBeNull();
    // PRB ID is carried by the breadcrumb and the Metadados section, not duplicated here.
    expect(within(panel).getAllByText("PRB-0001").length).toBeGreaterThan(0);
  });

  it("renders the compact Metadados section with canonical field/value fidelity", async () => {
    const panel = await renderPrb001();
    const metadata = within(panel).getByLabelText("Metadados");
    expect(within(metadata).getByText("ID")).toBeTruthy();
    expect(within(metadata).getByText("PRB-0001")).toBeTruthy();
    expect(within(metadata).getByText("Tipo")).toBeTruthy();
    expect(within(metadata).getByText("PRB")).toBeTruthy();
    expect(within(metadata).getByText("Domínio")).toBeTruthy();
    expect(within(metadata).getByText("MOB")).toBeTruthy();
    expect(within(metadata).getByText("Nível geográfico")).toBeTruthy();
    expect(within(metadata).getByText("municipality")).toBeTruthy();
    expect(within(metadata).getByText("Área")).toBeTruthy();
    expect(within(metadata).getByText("Évora")).toBeTruthy();
    expect(within(metadata).getByText("Ficheiro canónico")).toBeTruthy();
    expect(within(metadata).getByText("research/problems/PRB-0001.yaml")).toBeTruthy();
    expect(within(metadata).getByText("Contrato")).toBeTruthy();
    expect(within(metadata).getByText("0.1")).toBeTruthy();
  });

  it("omits Contrato when decision_basis.contract_version is absent, rather than inventing a value", async () => {
    const detail: RecordDetail = {
      ...PRB_RD01A_DETAIL,
      record: { ...PRB_RD01A_DETAIL.record, decision_basis: undefined },
    };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "PRB-0001": detail })}
        lookup={buildLookup(PRB_RD01A_SUMMARY)}
        selectedId="PRB-0001"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const metadata = within(panel).getByLabelText("Metadados");
    expect(within(metadata).queryByText("Contrato")).toBeNull();
  });

  it("renders the compact Estado canónico section with PT-PT label, canonical field name, and exact stored value for each status dimension", async () => {
    const panel = await renderPrb001();
    const state = within(panel).getByLabelText("Estado canónico");
    expect(within(state).getByText("Estado")).toBeTruthy();
    expect(within(state).getByText("status")).toBeTruthy();
    expect(within(state).getByText("OPEN")).toBeTruthy();
    expect(within(state).getByText("Estado da evidência")).toBeTruthy();
    expect(within(state).getByText("evidence_status")).toBeTruthy();
    expect(within(state).getByText("corroborated")).toBeTruthy();
    expect(within(state).getByText("Estado de validação")).toBeTruthy();
    expect(within(state).getByText("validation_status")).toBeTruthy();
    expect(within(state).getByText("unvalidated")).toBeTruthy();
    expect(within(state).getByText("Tratabilidade digital")).toBeTruthy();
    expect(within(state).getByText("digital_tractability")).toBeTruthy();
    expect(within(state).getByText("Estado das soluções existentes")).toBeTruthy();
    expect(within(state).getByText("solution_landscape_status")).toBeTruthy();
    // digital_tractability and solution_landscape_status share the same stored value here.
    expect(within(state).getAllByText("not_assessed")).toHaveLength(2);
  });

  it("does not render these PRB sections for non-PRB records (generic Record Detail unchanged)", async () => {
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
    expect(within(panel).queryByLabelText("Metadados")).toBeNull();
    expect(within(panel).queryByLabelText("Estado canónico")).toBeNull();
    expect(within(panel).queryByLabelText("Campos canónicos")).toBeNull();
  });
});

describe("RecordDetailPanel — RD-01B PRB canonical field inspector", () => {
  const PRB_INSPECTOR_DETAIL: RecordDetail = {
    id: "PRB-0001",
    type: "PRB-",
    file: "research/problems/PRB-0001.yaml",
    record: {
      problem_id: "PRB-0001",
      title: "Título canónico",
      domain: ["MOB"],
      geography: { level: "municipality", area: "Évora" },
      affected_populations: ["residentes que dependem dos transportes públicos"],
      problem_statement: "A cobertura dos transportes públicos em Évora é ampla, mas varia.",
      causal_reading: null,
      evidence: ["EVD-000001", "EVD-000002"],
      investigation: {
        open_questions: [{ question: "Quais as linhas mais afetadas?", why_open: "Sem dados por linha." }],
        path: { initial_signal: { summary: "Primeiro sinal.", evidence: ["EVD-000001"] } },
      },
      decision_basis: {
        contract_version: "0.1",
        eligibility_basis: "Texto de elegibilidade.",
        supporting_evidence: ["EVD-000001", "EVD-000002"],
        boundary_evidence: [],
      },
      evidence_status: "corroborated",
      validation_status: "unvalidated",
      digital_tractability: "not_assessed",
      solution_landscape_status: "not_assessed",
      status: "OPEN",
      custom_extra_field: "valor extra não coberto por Metadados/Estado",
    },
    outgoingEdges: [],
    incomingEdges: [],
  };
  const PRB_INSPECTOR_SUMMARY: RecordSummary = {
    id: "PRB-0001",
    type: "PRB-",
    label: "PRB-0001",
    file: "research/problems/PRB-0001.yaml",
    summaryFields: { status: "OPEN" },
  };
  const EVD_REF_SUMMARY: RecordSummary = {
    id: "EVD-000001",
    type: "EVD-",
    label: "EVD-000001",
    file: "research/evidence/EVD-000001.yaml",
    summaryFields: {},
  };

  async function renderInspectorFixture(record: Record<string, unknown> = PRB_INSPECTOR_DETAIL.record) {
    const detail: RecordDetail = { ...PRB_INSPECTOR_DETAIL, record };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "PRB-0001": detail })}
        lookup={buildLookup(PRB_INSPECTOR_SUMMARY, EVD_REF_SUMMARY)}
        selectedId="PRB-0001"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    return within(panel).getByLabelText("Campos canónicos");
  }

  it("exposes problem_statement, affected_populations, causal_reading, evidence, investigation, and decision_basis by their exact canonical field names", async () => {
    const inspector = await renderInspectorFixture();
    expect(within(inspector).getByText("problem_statement")).toBeTruthy();
    expect(within(inspector).getByText(/A cobertura dos transportes públicos em Évora é ampla/)).toBeTruthy();
    expect(within(inspector).getByText("affected_populations")).toBeTruthy();
    expect(within(inspector).getByText("residentes que dependem dos transportes públicos")).toBeTruthy();
    expect(within(inspector).getByText("causal_reading")).toBeTruthy();
    expect(within(inspector).getAllByText("evidence").length).toBeGreaterThan(0);
    expect(within(inspector).getByText("investigation")).toBeTruthy();
    expect(within(inspector).getByText("decision_basis")).toBeTruthy();
  });

  it("does not translate canonical labels into Problem View editorial headings", async () => {
    const inspector = await renderInspectorFixture();
    for (const editorialLabel of ["O que observamos", "Consequências conhecidas", "Atualidade", "Âmbito conhecido", "O que ainda não sabemos", "Como chegámos a este problema"]) {
      expect(within(inspector).queryByText(editorialLabel)).toBeNull();
    }
  });

  it("preserves array indexes and nested object hierarchy", async () => {
    const inspector = await renderInspectorFixture();
    expect(within(inspector).getAllByText("[0]").length).toBeGreaterThan(0);
    expect(within(inspector).getByText("open_questions")).toBeTruthy();
    expect(within(inspector).getByText("question")).toBeTruthy();
    expect(within(inspector).getByText("Quais as linhas mais afetadas?")).toBeTruthy();
    expect(within(inspector).getByText("why_open")).toBeTruthy();
    expect(within(inspector).getByText("path")).toBeTruthy();
    expect(within(inspector).getByText("initial_signal")).toBeTruthy();
    expect(within(inspector).getByText("summary")).toBeTruthy();
  });

  it("renders decision_basis sub-fields in canonical contract order and only the sub-keys actually present", async () => {
    const inspector = await renderInspectorFixture();
    expect(within(inspector).getByText("contract_version")).toBeTruthy();
    expect(within(inspector).getByText("eligibility_basis")).toBeTruthy();
    expect(within(inspector).getByText("supporting_evidence")).toBeTruthy();
    // corroboration_basis is a known decision_basis key but absent on this fixture's decision_basis object — not invented.
    expect(within(inspector).queryByText("corroboration_basis")).toBeNull();
  });

  it("distinguishes missing field, explicit null, empty array, and empty object", async () => {
    const inspector = await renderInspectorFixture();
    // causal_reading: explicit null.
    const causalRow = within(inspector).getByText("causal_reading").closest(".inspector-field") as HTMLElement;
    expect(within(causalRow).getByText("null")).toBeTruthy();
    // decision_basis.boundary_evidence: empty array.
    expect(within(inspector).getByText("[ ] · 0 elementos")).toBeTruthy();
    // decision_basis.scope: known optional field, absent -> Não registado.
    const scopeRow = within(inspector).getByText("scope").closest(".inspector-field") as HTMLElement;
    expect(within(scopeRow).getByText("Não registado")).toBeTruthy();
  });

  it("shows Não registado only for the bounded set of known-absent PRB fields, not for arbitrary theoretical schema properties", async () => {
    const recordWithoutCausalOrInvestigation = { ...PRB_INSPECTOR_DETAIL.record };
    delete (recordWithoutCausalOrInvestigation as Record<string, unknown>).causal_reading;
    delete (recordWithoutCausalOrInvestigation as Record<string, unknown>).investigation;
    delete (recordWithoutCausalOrInvestigation as Record<string, unknown>).decision_basis;
    const inspector = await renderInspectorFixture(recordWithoutCausalOrInvestigation);
    const causalRow = within(inspector).getByText("causal_reading").closest(".inspector-field") as HTMLElement;
    expect(within(causalRow).getByText("Não registado")).toBeTruthy();
    const investigationRow = within(inspector).getByText("investigation").closest(".inspector-field") as HTMLElement;
    expect(within(investigationRow).getByText("Não registado")).toBeTruthy();
    const decisionBasisRow = within(inspector).getByText("decision_basis").closest(".inspector-field") as HTMLElement;
    expect(within(decisionBasisRow).getByText("Não registado")).toBeTruthy();
    // A field the fixture never carries and that isn't a known PRB inspector field is never invented as a "Não registado" row.
    expect(within(inspector).queryByText("nonexistent_hypothetical_field")).toBeNull();
  });

  it("exposes a top-level PRB field not owned by Metadados/Estado canónico, without duplicating fields those sections already show", async () => {
    const inspector = await renderInspectorFixture();
    expect(within(inspector).getByText("custom_extra_field")).toBeTruthy();
    expect(within(inspector).getByText("valor extra não coberto por Metadados/Estado")).toBeTruthy();
    // problem_id/title/domain/geography/status/evidence_status/etc. are owned by RD-01A sections — not duplicated here.
    expect(within(inspector).queryByText("problem_id")).toBeNull();
    expect(within(inspector).queryByText("title")).toBeNull();
    expect(within(inspector).queryByText("domain")).toBeNull();
    expect(within(inspector).queryByText("geography")).toBeNull();
    expect(within(inspector).queryByText("status")).toBeNull();
  });

  it("renders EVD- record IDs inside a value as exact plain text, not a duplicate navigation control (Relações already owns record navigation)", async () => {
    const inspector = await renderInspectorFixture();
    expect(within(inspector).getAllByText("EVD-000001").length).toBeGreaterThan(0);
    expect(within(inspector).getAllByText("EVD-000002").length).toBeGreaterThan(0);
    expect(within(inspector).queryByRole("button", { name: "EVD-000001" })).toBeNull();
    expect(within(inspector).queryByRole("button", { name: "EVD-000002" })).toBeNull();
  });

  it("does not render Campos canónicos for non-PRB records", async () => {
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
    expect(within(panel).queryByLabelText("Campos canónicos")).toBeNull();
  });
});

describe("RecordDetailPanel — RD-01C PRB canonical references", () => {
  const PRB_REFERENCES_DETAIL: RecordDetail = {
    id: "PRB-0001",
    type: "PRB-",
    file: "research/problems/PRB-0001.yaml",
    record: {
      problem_id: "PRB-0001",
      title: "Título canónico",
      evidence: ["EVD-000001", "EVD-000002"],
      investigation: {
        open_questions: [{ question: "Quais as linhas mais afetadas?", evidence: ["EVD-000084"] }],
        path: { initial_signal: { summary: "Primeiro sinal.", evidence: ["EVD-000001"] } },
      },
      decision_basis: {
        contract_version: "0.1",
        manifestation: { evidence: ["EVD-000082"] },
        supporting_evidence: ["EVD-000001", "EVD-000083"],
        boundary_evidence: [],
      },
      status: "OPEN",
    },
    outgoingEdges: [],
    incomingEdges: [],
  };
  const PRB_REFERENCES_SUMMARY: RecordSummary = {
    id: "PRB-0001",
    type: "PRB-",
    label: "PRB-0001",
    file: "research/problems/PRB-0001.yaml",
    summaryFields: { status: "OPEN" },
  };

  async function renderReferencesFixture(record: Record<string, unknown> = PRB_REFERENCES_DETAIL.record, onSelect: (id: string) => void = noop) {
    const detail: RecordDetail = { ...PRB_REFERENCES_DETAIL, record };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "PRB-0001": detail })}
        lookup={buildLookup(PRB_REFERENCES_SUMMARY)}
        selectedId="PRB-0001"
        onSelect={onSelect}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    return within(panel).getByLabelText("Referências canónicas");
  }

  it("lists every canonical reference with its exact field path, including nested array indexes", async () => {
    const section = await renderReferencesFixture();
    expect(within(section).getByText("evidence[0]")).toBeTruthy();
    expect(within(section).getByText("evidence[1]")).toBeTruthy();
    expect(within(section).getByText("decision_basis.manifestation.evidence[0]")).toBeTruthy();
    expect(within(section).getByText("decision_basis.supporting_evidence[1]")).toBeTruthy();
    expect(within(section).getByText("investigation.open_questions[0].evidence[0]")).toBeTruthy();
    expect(within(section).getByText("investigation.path.initial_signal.evidence[0]")).toBeTruthy();
  });

  it("does not deduplicate by target ID — the same target through different paths appears as separate rows", async () => {
    const section = await renderReferencesFixture();
    expect(within(section).getAllByText("EVD-000001").length).toBe(3);
  });

  it("does not surface the record's own problem_id as a self-reference", async () => {
    const section = await renderReferencesFixture();
    expect(within(section).queryByText("problem_id")).toBeNull();
  });

  it("collects SRC-/EVD-/PRB- record IDs but not a non-record string with the same generic PREFIX-suffix shape (e.g. PT-PT)", async () => {
    const section = await renderReferencesFixture({
      problem_id: "PRB-0001",
      title: "Título canónico",
      language: "PT-PT",
      evidence: ["EVD-000001"],
      decision_basis: { supporting_evidence: ["PRB-0002"], boundary_evidence: ["SRC-0092"] },
      status: "OPEN",
    });
    expect(within(section).getByText("EVD-000001")).toBeTruthy();
    expect(within(section).getByText("PRB-0002")).toBeTruthy();
    expect(within(section).getByText("SRC-0092")).toBeTruthy();
    expect(within(section).queryByText("PT-PT")).toBeNull();
    expect(within(section).queryByText("language")).toBeNull();
  });

  it("RD-01F/F03: rejects prose that begins with, or merely contains, a valid record ID — only an exact PREFIX-digits value is a reference", async () => {
    const section = await renderReferencesFixture({
      problem_id: "PRB-0001",
      title: "Título canónico",
      decision_basis: {
        // Begins with a valid record ID, but the field's stored value is prose, not a reference.
        eligibility_basis: "PRB-0006 constitui um problema de investigação distinto e bem definido.",
        // Contains a valid record ID mid-sentence.
        corroboration_statement: "A evidência EVD-000031 sustenta esta leitura, mas o campo continua a ser texto.",
      },
      // Merely starts with a known prefix without the PREFIX-digits shape.
      note: "SRC-team reviewed this record",
      status: "OPEN",
    });
    expect(within(section).queryByText(/PRB-0006 constitui/)).toBeNull();
    expect(within(section).queryByText(/A evidência EVD-000031 sustenta/)).toBeNull();
    expect(within(section).queryByText("SRC-team reviewed this record")).toBeNull();
    expect(within(section).getByText("Nenhuma referência canónica registada.")).toBeTruthy();
  });

  it("RD-01F/F03: still accepts an exact record ID even when a sibling field in the same object is prose containing that same ID", async () => {
    const section = await renderReferencesFixture({
      problem_id: "PRB-0001",
      title: "Título canónico",
      decision_basis: {
        eligibility_basis: "Ver EVD-000031 para detalhe.",
        manifestation: { evidence: ["EVD-000031"] },
      },
      status: "OPEN",
    });
    expect(within(section).getByText("decision_basis.manifestation.evidence[0]")).toBeTruthy();
    expect(within(section).getByText("EVD-000031")).toBeTruthy();
    expect(within(section).queryByText("decision_basis.eligibility_basis")).toBeNull();
  });

  it("renders each reference as a navigable control with a path-specific accessible name, calling onSelect with the target ID", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const section = await renderReferencesFixture(PRB_REFERENCES_DETAIL.record, onSelect);
    const button = within(section).getByRole("button", { name: "Abrir EVD-000082 referenciado em decision_basis.manifestation.evidence[0]" });
    await user.click(button);
    expect(onSelect).toHaveBeenCalledWith("EVD-000082");
  });

  it("gives repeated occurrences of the same target ID distinct accessible names", async () => {
    const section = await renderReferencesFixture();
    expect(within(section).getByRole("button", { name: "Abrir EVD-000001 referenciado em evidence[0]" })).toBeTruthy();
    expect(within(section).getByRole("button", { name: "Abrir EVD-000001 referenciado em decision_basis.supporting_evidence[0]" })).toBeTruthy();
    expect(within(section).getByRole("button", { name: "Abrir EVD-000001 referenciado em investigation.path.initial_signal.evidence[0]" })).toBeTruthy();
  });

  it("renders a deterministic empty state without hiding the section when no canonical references exist", async () => {
    const section = await renderReferencesFixture({ problem_id: "PRB-0001", title: "Sem referências", status: "OPEN" });
    expect(within(section).getByText("Nenhuma referência canónica registada.")).toBeTruthy();
  });

  it("does not render Referências canónicas for non-PRB records", async () => {
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
    expect(within(panel).queryByLabelText("Referências canónicas")).toBeNull();
  });
});

describe("RecordDetailPanel — RD-01E PRB provenance + raw technical boundary", () => {
  const PRB_PROVENANCE_DETAIL: RecordDetail = {
    id: "PRB-0001",
    type: "PRB-",
    file: "research/problems/PRB-0001.yaml",
    record: {
      problem_id: "PRB-0001",
      title: "Título canónico",
      domain: ["MOB"],
      geography: { level: "municipality", area: "Évora" },
      status: "OPEN",
      evidence: ["EVD-000001"],
    },
    outgoingEdges: [{ field: "evidence", ordinal: 0, to: "EVD-000001" }],
    incomingEdges: [],
  };
  const PRB_PROVENANCE_SUMMARY: RecordSummary = {
    id: "PRB-0001",
    type: "PRB-",
    label: "PRB-0001",
    file: "research/problems/PRB-0001.yaml",
    summaryFields: { status: "OPEN" },
  };

  async function renderProvenanceFixture() {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "PRB-0001": PRB_PROVENANCE_DETAIL })}
        lookup={buildLookup(PRB_PROVENANCE_SUMMARY)}
        selectedId="PRB-0001"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    return (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
  }

  it("renders a compact Proveniência limited to Ficheiro canónico and Tipo de registo, with no relationship count", async () => {
    const panel = await renderProvenanceFixture();
    const provenance = within(panel).getByLabelText("Proveniência");
    expect(within(provenance).getByText("Ficheiro canónico")).toBeTruthy();
    expect(within(provenance).getByText("research/problems/PRB-0001.yaml")).toBeTruthy();
    expect(within(provenance).getByText("Tipo de registo")).toBeTruthy();
    expect(within(provenance).getByText("PRB")).toBeTruthy();
    // Not repeated: title/domain/geography/canonical state/relationship counts/reference paths.
    expect(within(provenance).queryByText("Título canónico")).toBeNull();
    expect(within(provenance).queryByText("MOB")).toBeNull();
    expect(within(provenance).queryByText("Évora")).toBeNull();
    expect(within(provenance).queryByText(/registo\(s\) relacionado\(s\)/)).toBeNull();
    expect(within(provenance).queryByText(/evidence\[0\]/)).toBeNull();
  });

  it("labels the raw fallback 'Estrutura técnica completa' with the concise orientation sentence, collapsed by default", async () => {
    const panel = await renderProvenanceFixture();
    const summary = within(panel).getByText("Estrutura técnica completa");
    const details = summary.closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(within(panel).getByText("Objeto canónico completo, sem omissões.")).toBeTruthy();
    // Still exhaustive — the raw tree includes fields already shown structurally elsewhere.
    expect(within(details).getByText("problem_id")).toBeTruthy();
    expect(within(details).getByText("title")).toBeTruthy();
    expect(within(details).getByText("status")).toBeTruthy();
  });

  it("orders PRB Detail sections as Metadados, Estado canónico, Campos canónicos, Referências canónicas, Relações no corpus, Proveniência, Estrutura técnica completa", async () => {
    const panel = await renderProvenanceFixture();
    const metadados = within(panel).getByLabelText("Metadados");
    const estadoCanonico = within(panel).getByLabelText("Estado canónico");
    const camposCanonicos = within(panel).getByLabelText("Campos canónicos");
    const referenciasCanonicas = within(panel).getByLabelText("Referências canónicas");
    const relacoes = within(panel).getByLabelText("Relações");
    const provenance = within(panel).getByLabelText("Proveniência");
    const rawDisclosure = within(panel).getByText("Estrutura técnica completa").closest("section") as HTMLElement;

    const sections = [metadados, estadoCanonico, camposCanonicos, referenciasCanonicas, relacoes, provenance, rawDisclosure];
    for (let i = 0; i < sections.length - 1; i++) {
      expect(sections[i].compareDocumentPosition(sections[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("does not change non-PRB Proveniência/technical-disclosure behavior", async () => {
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
    const provenance = within(panel).getByLabelText("Proveniência");
    expect(within(provenance).getByText(/registo\(s\) relacionado\(s\)/)).toBeTruthy();
    expect(within(panel).getByText("Inspeção técnica completa — todos os campos canónicos")).toBeTruthy();
    expect(within(panel).queryByText("Estrutura técnica completa")).toBeNull();
  });
});
