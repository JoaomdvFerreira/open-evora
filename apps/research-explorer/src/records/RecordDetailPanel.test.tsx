import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordDetailPanel } from "./RecordDetailPanel";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";
import { formatPublicPartialDate } from "../presentation";

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
  it("RD-01G: PRB-0001-equivalent fixture: 11 incoming paths resolve to 11 unique incoming-referencing records, and outgoing edges are not shown here", async () => {
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

    // RD-01G: PRB Relações no corpus now shows only the incoming direction
    // (other records → this PRB) — outgoing references belong exclusively to
    // Referências canónicas. 11 unique incoming records (10 reciprocal + 1
    // incoming-only), deduplicated across their 11 raw incoming edges.
    const relacoes = within(panel).getByLabelText("Relações");
    const relationsBoundary = within(relacoes).getByLabelText("Relações no corpus");
    const incomingHeading = within(relationsBoundary).getByText(/Referenciado por/);
    const incomingList = incomingHeading.nextElementSibling as HTMLElement;
    expect(within(incomingList).getAllByRole("button")).toHaveLength(11);
  });

  it("RD-01G: lists an incoming-referencing record once even if referenced through more than one incoming edge, without canonical field paths", async () => {
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

    // EVD-000001 references this PRB via incoming analysis.related_problems[0] — appears exactly once, never with path notation.
    expect(within(relationsBoundary).getAllByRole("button", { name: /EVD-000001/ })).toHaveLength(1);
    expect(relationsBoundary.textContent).not.toContain("evidence[0]");
    expect(relationsBoundary.textContent).not.toContain("analysis.related_problems");
    expect(relationsBoundary.textContent).not.toContain("referencia através de");
    expect(relationsBoundary.textContent).not.toContain("referenciado através de");
  });

  it("RD-01G: preserves the incoming-only EVD-000011 related record", async () => {
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

    expect(within(relationsBoundary).getByRole("button", { name: new RegExp(incomingOnlyId) })).toBeTruthy();
  });

  it("RD-01G: does not render an outgoing group or heading in Relações no corpus", async () => {
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

    expect(within(relationsBoundary).queryByText(/Referências de saída/)).toBeNull();
    expect(relationsBoundary.textContent).not.toContain("→");
  });

  it("RD-01G: an outgoing-only related record (no incoming edge) does not appear in Relações no corpus", async () => {
    const outgoingOnlyDetail: RecordDetail = {
      id: "PRB-0001",
      type: "PRB-",
      file: "research/problems/PRB-0001.yaml",
      record: { problem_id: "PRB-0001" },
      outgoingEdges: [{ field: "evidence", ordinal: 0, to: "EVD-000099" }],
      incomingEdges: [],
    };
    const outgoingOnlySummary: RecordSummary = {
      id: "EVD-000099",
      type: "EVD-",
      label: "Evidência EVD-000099 (apenas saída)",
      file: "research/evidence/EVD-000099.yaml",
      summaryFields: {},
    };
    const prbSummary: RecordSummary = {
      id: "PRB-0001",
      type: "PRB-",
      label: "Problema PRB-0001",
      file: "research/problems/PRB-0001.yaml",
      summaryFields: { status: "OPEN" },
    };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "PRB-0001": outgoingOnlyDetail })}
        lookup={buildLookup(prbSummary, outgoingOnlySummary)}
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

    expect(within(relationsBoundary).queryByRole("button", { name: /EVD-000099/ })).toBeNull();
    expect(within(relationsBoundary).getByText("Nenhum registo referencia este PRB.")).toBeTruthy();
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

describe("RecordDetailPanel — SRC original-source action (SUI-02A, SRC v2 eligibility)", () => {
  const SRC_PUBLIC_SUMMARY: RecordSummary = {
    id: "SRC-0002",
    type: "SRC-",
    label: "Plano de Desenvolvimento Social de Évora 2024-2027",
    file: "research/sources/SRC-0002.yaml",
    summaryFields: {},
  };

  function srcDetail(overrides: Record<string, unknown>): RecordDetail {
    const { access: accessOverride, ...rest } = overrides;
    return {
      id: "SRC-0002",
      type: "SRC-",
      file: "research/sources/SRC-0002.yaml",
      record: {
        source_id: "SRC-0002",
        publisher: "Município de Évora",
        access: { level: "public", availability: "available", machine_readable: false, ...(accessOverride as Record<string, unknown> | undefined) },
        canonical_reference: "https://www.cm-evora.pt/exemplo.pdf",
        ...rest,
      },
      outgoingEdges: [],
      incomingEdges: [],
    };
  }

  function renderSrc(detail: RecordDetail) {
    return render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0002": detail })}
        lookup={buildLookup(SRC_PUBLIC_SUMMARY)}
        selectedId="SRC-0002"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
  }

  it("shows 'Abrir fonte original ↗' with a safe external link when public + available + valid HTTPS", async () => {
    renderSrc(srcDetail({}));

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const link = await within(panel).findByRole("link", { name: "Abrir fonte original ↗" });
    expect(link.getAttribute("href")).toBe("https://www.cm-evora.pt/exemplo.pdf");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("shows 'Abrir fonte' when public + available + valid HTTP", async () => {
    renderSrc(srcDetail({ canonical_reference: "http://www.cm-evora.pt/exemplo.pdf" }));

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const link = await within(panel).findByRole("link", { name: /Abrir fonte/ });
    expect(link.getAttribute("href")).toBe("http://www.cm-evora.pt/exemplo.pdf");
  });

  it("does not show the action when access.level is restricted, even if available", async () => {
    renderSrc(srcDetail({ access: { level: "restricted", availability: "available" } }));

    await screen.findByText("Detalhes");
    expect(screen.queryByRole("link", { name: /Abrir fonte/ })).toBeNull();
  });

  it("does not show the action when access.level is public but availability is unavailable", async () => {
    renderSrc(srcDetail({ access: { level: "public", availability: "unavailable" } }));

    await screen.findByText("Detalhes");
    expect(screen.queryByRole("link", { name: /Abrir fonte/ })).toBeNull();
  });

  it("does not show the action when access.level is public but availability is unknown", async () => {
    renderSrc(srcDetail({ access: { level: "public", availability: "unknown" } }));

    await screen.findByText("Detalhes");
    expect(screen.queryByRole("link", { name: /Abrir fonte/ })).toBeNull();
  });

  it("does not show the action when canonical_reference is missing", async () => {
    renderSrc(srcDetail({ canonical_reference: undefined }));

    await screen.findByText("Detalhes");
    expect(screen.queryByRole("link", { name: /Abrir fonte/ })).toBeNull();
  });

  it("does not show the action for a non-HTTP(S) canonical_reference", async () => {
    renderSrc(srcDetail({ canonical_reference: "ftp://internal/file.pdf" }));

    await screen.findByText("Detalhes");
    expect(screen.queryByRole("link", { name: /Abrir fonte/ })).toBeNull();
  });

  it("does not show the action for a malformed canonical_reference string", async () => {
    renderSrc(srcDetail({ canonical_reference: "not a url" }));

    await screen.findByText("Detalhes");
    expect(screen.queryByRole("link", { name: /Abrir fonte/ })).toBeNull();
  });

  it("renders the source link for an SRC-0093-shaped SRC v2 fixture", async () => {
    const detail: RecordDetail = {
      id: "SRC-0093",
      type: "SRC-",
      file: "research/sources/SRC-0093.yaml",
      record: {
        source_id: "SRC-0093",
        publisher: "Câmara Municipal de Évora",
        name: "Portal de Dados Abertos de Évora",
        resource_type: "dataset",
        scope: { geography: { level: "municipality", area: "Évora" }, domains: ["mobility"] },
        access: { level: "public", availability: "available", machine_readable: true },
        acquisition: { method: "public_web" },
        canonical_reference: "https://dados.cm-evora.pt/dataset/exemplo",
        licensing: { status: "known", licence: "CC-BY-4.0", reuse: "permitted" },
        temporal: { last_checked_at: "2026-01-01" },
      },
      outgoingEdges: [],
      incomingEdges: [],
    };
    const summary: RecordSummary = { id: "SRC-0093", type: "SRC-", label: "Portal de Dados Abertos de Évora", file: detail.file, summaryFields: {} };

    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": detail })}
        lookup={buildLookup(summary)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const link = await within(panel).findByRole("link", { name: "Abrir fonte original ↗" });
    expect(link.getAttribute("href")).toBe("https://dados.cm-evora.pt/dataset/exemplo");
  });

  it("renders the SRC external-source action in the main content, before 'Visão geral', and not in the rail", async () => {
    renderSrc(srcDetail({}));

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const link = await within(panel).findByRole("link", { name: "Abrir fonte original ↗" });
    const overview = within(panel).getByLabelText("Visão geral");
    const rail = within(panel).getByLabelText("Mais ações");

    expect(link.compareDocumentPosition(overview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rail.contains(link)).toBe(false);
    expect(within(rail).queryByRole("link", { name: /Abrir fonte/ })).toBeNull();
  });

  it("renders exactly one external-source action for an eligible SRC", async () => {
    renderSrc(srcDetail({}));

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByRole("link", { name: "Abrir fonte original ↗" });
    expect(within(panel).getAllByRole("link", { name: /Abrir fonte/ })).toHaveLength(1);
  });

  it("renders no external-source action anywhere (main content or rail) when ineligible", async () => {
    renderSrc(srcDetail({ access: { level: "restricted", availability: "available" } }));

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Visão geral");
    expect(within(panel).queryByRole("link", { name: /Abrir fonte/ })).toBeNull();
  });

  it("still renders the SRC type explanation card in the rail after the action moves out of it", async () => {
    renderSrc(srcDetail({}));

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const rail = await within(panel).findByLabelText("Mais ações");
    expect(rail.querySelector(".detail-rail-type-note")).toBeTruthy();
  });

  /**
   * SUI-03I3: SRC rail cleanup — the agreed final SRC rail is only the type
   * explanatory card (+ a future "Nesta fonte" index, not built in this
   * slice). "Ver como Problema" is not covered by a dedicated removal here:
   * it is already structurally unreachable for SRC, since its only source,
   * `PROBLEM_REFERENCE_FIELDS` (`analysis.related_problems`), is an EVD-only
   * schema field (research/schemas/evidence.schema.json) that always targets
   * PRB-, never SRC- — `findRelatedProblemId` can therefore never resolve for
   * a SRC detail regardless of its edges.
   */
  describe("SUI-03I3: SRC rail cleanup", () => {
    it("renders only the SRC type explanatory card and the Nesta fonte index in the rail — no action buttons", async () => {
      renderSrc(srcDetail({}));

      const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
      const rail = await within(panel).findByLabelText("Mais ações");
      expect(rail.querySelector(".detail-rail-type-note")).toBeTruthy();
      expect(rail.querySelectorAll("button")).toHaveLength(0);
      expect(within(rail).getByLabelText("Nesta fonte")).toBeTruthy();
    });

    it("does not render 'Ver no Grafo' in the SRC rail", async () => {
      renderSrc(srcDetail({}));

      const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
      const rail = await within(panel).findByLabelText("Mais ações");
      expect(within(rail).queryByRole("button", { name: /Ver no Grafo/ })).toBeNull();
    });

    it("does not render the repository YAML path (detail.file) in the SRC rail", async () => {
      renderSrc(srcDetail({}));

      const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
      const rail = await within(panel).findByLabelText("Mais ações");
      expect(rail.querySelector(".detail-rail-file")).toBeNull();
      expect(within(rail).queryByText("research/sources/SRC-0002.yaml")).toBeNull();
    });

    it("never renders 'Ver como Problema' for SRC — already structurally impossible (analysis.related_problems is EVD-only and always targets PRB-)", async () => {
      const srcWithIncomingProblemLikeEdge = srcDetail({});
      srcWithIncomingProblemLikeEdge.incomingEdges = [{ from: "PRB-0006", field: "analysis.related_problems", ordinal: null }];

      renderSrc(srcWithIncomingProblemLikeEdge);

      const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
      const rail = await within(panel).findByLabelText("Mais ações");
      expect(within(rail).queryByRole("button", { name: /Ver como Problema/ })).toBeNull();
    });

    it("renders no empty .detail-rail-actions wrapper for SRC once all actions are absent", async () => {
      renderSrc(srcDetail({}));

      const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
      const rail = await within(panel).findByLabelText("Mais ações");
      expect(rail.querySelector(".detail-rail-actions")).toBeNull();
    });

    it("keeps 'Abrir fonte original ↗' present exactly once in the main Source content, not the rail", async () => {
      renderSrc(srcDetail({}));

      const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
      const rail = await within(panel).findByLabelText("Mais ações");
      const links = within(panel).getAllByRole("link", { name: "Abrir fonte original ↗" });
      expect(links).toHaveLength(1);
      expect(rail.contains(links[0])).toBe(false);
    });

    it("does not affect EVD rail behavior — graph action, file path, and 'Ver como Problema' remain available", async () => {
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
      const rail = await within(panel).findByLabelText("Mais ações");
      expect(within(rail).getByRole("button", { name: "Ver no Grafo" })).toBeTruthy();
      expect(within(rail).getByRole("button", { name: "Ver como Problema (PRB-0006)" })).toBeTruthy();
      expect(rail.querySelector(".detail-rail-file")).toBeTruthy();
    });

    it("does not affect PRB rail behavior — no graph action (unchanged), file path still renders", async () => {
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
      const rail = await within(panel).findByLabelText("Mais ações");
      expect(within(rail).queryByRole("button", { name: /Ver no Grafo/ })).toBeNull();
      expect(rail.querySelector(".detail-rail-file")).toBeTruthy();
    });

    it("keeps onViewInGraph available/functional outside the SRC rail (EVD)", async () => {
      const onViewInGraph = vi.fn();
      render(
        <RecordDetailPanel
          dataProvider={fakeProvider({ "EVD-000127": EVD_127_DETAIL })}
          lookup={buildLookup(EVD_127_SUMMARY, PRB_0006_SUMMARY)}
          selectedId="EVD-000127"
          onSelect={noop}
          onBackToRecords={noop}
          onViewAsProblem={noop}
          onViewInGraph={onViewInGraph}
        />
      );

      const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
      const rail = await within(panel).findByLabelText("Mais ações");
      const button = within(rail).getByRole("button", { name: "Ver no Grafo" });
      button.click();
      expect(onViewInGraph).toHaveBeenCalledWith("EVD-000127");
    });

    it("does not change any Source View main-content sections", async () => {
      renderSrc(srcDetail({}));

      const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
      await within(panel).findByLabelText("Visão geral");
      expect(await within(panel).findByLabelText("O que encontrámos")).toBeTruthy();
      expect(within(panel).getByLabelText("Cobertura")).toBeTruthy();
      expect(within(panel).getByLabelText("Datas e acesso")).toBeTruthy();
      expect(within(panel).getByLabelText("Licenciamento")).toBeTruthy();
      // "Limitações" only renders when the record carries caveats — this
      // fixture has none, matching SourceCaveatsSection's own contract; not
      // asserted here since this slice does not touch that section.
      expect(within(panel).getByLabelText("Informação técnica")).toBeTruthy();
    });
  });

  it("never shows the action on a non-SRC record, even with an SRC v2-shaped access field of the same name", async () => {
    const evdDetail: RecordDetail = {
      id: "EVD-0001",
      type: "EVD-",
      file: "research/evidence/EVD-0001.yaml",
      record: {
        evidence_id: "EVD-0001",
        access: { level: "public", availability: "available" },
        canonical_reference: "https://example.org/not-a-source",
      },
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

  it("renders the SRC Visão geral overview with publisher from existing canonical data, and does not render the retired SRC quick-read block", async () => {
    const detail: RecordDetail = {
      id: "SRC-0002",
      type: "SRC-",
      file: "research/sources/SRC-0002.yaml",
      record: {
        source_id: "SRC-0002",
        name: "Plano de Desenvolvimento Social de Évora 2024-2027",
        publisher: "Município de Évora",
        access: { level: "public", availability: "available", machine_readable: true },
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
    const overview = await within(panel).findByLabelText("Visão geral");
    expect(within(overview).getByText("Município de Évora")).toBeTruthy();
    // The retired SRC quick-read block no longer renders at all.
    expect(within(panel).queryByLabelText("Leitura rápida")).toBeNull();
    // publisher appears exactly once outside SourceTechnicalSection's raw
    // exhaustive disclosure (which independently echoes every canonical
    // field verbatim, unaffected by this integration) — i.e. exactly once
    // in Visão geral.
    const disclosure = within(panel).getByText("Inspeção completa do registo canónico").closest("details") as HTMLElement;
    expect(within(panel).getAllByText("Município de Évora").filter((el) => !disclosure.contains(el))).toHaveLength(1);

    // The existing "Abrir fonte original" action still renders exactly once
    // (in the Source header area, before Visão geral), unaffected by the
    // overview integration.
    expect(within(panel).getAllByRole("link", { name: /Abrir fonte/ })).toHaveLength(1);
  });

  it("still renders Visão geral, without inventing rows, when only a publisher-less v2 access block is present", async () => {
    const detail: RecordDetail = {
      id: "SRC-0004",
      type: "SRC-",
      file: "research/sources/SRC-0004.yaml",
      record: {
        source_id: "SRC-0004",
        access: { level: "public", availability: "available", machine_readable: false },
      },
      outgoingEdges: [],
      incomingEdges: [],
    };
    const summary: RecordSummary = { id: "SRC-0004", type: "SRC-", label: "SRC-0004", file: detail.file, summaryFields: {} };

    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0004": detail })}
        lookup={buildLookup(summary)}
        selectedId="SRC-0004"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByText("source_id");
    expect(within(panel).getByLabelText("Visão geral")).toBeTruthy();
    expect(within(panel).queryByLabelText("Leitura rápida")).toBeNull();
    expect(within(panel).queryByText("Editor")).toBeNull();
  });

  it("still renders Visão geral without inventing rows when the SRC record has no overview-relevant fields", async () => {
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
    expect(within(panel).getByLabelText("Visão geral")).toBeTruthy();
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

describe("RecordDetailPanel — SUI-03B2 Source View Visão geral integration", () => {
  /** Mirrors research/sources/SRC-0093.yaml exactly (matches SourceOverviewSection.test.tsx's fixture). */
  const SRC_0093_DETAIL: RecordDetail = {
    id: "SRC-0093",
    type: "SRC-",
    file: "research/sources/SRC-0093.yaml",
    record: {
      source_id: "SRC-0093",
      publisher: "Scientific Reports (Springer Nature)",
      creators: ["Giacomo Dalla Chiara", "Klaas Fiete Krutein", "Andisheh Ranjbari", "Anne Goodchild"],
      name: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
      resource_type: "document",
      identity: {
        persistent_identifier: { scheme: "doi", value: "10.1038/s41598-022-23987-z" },
      },
      scope: {
        geography: { level: "local_area", area: "Belltown, Seattle, Washington, EUA" },
        domains: ["MOB", "DIG"],
      },
      access: {
        level: "public",
        availability: "available",
        machine_readable: false,
        method: "browser",
        format: "html",
      },
      acquisition: { method: "public_web" },
      canonical_reference: "https://doi.org/10.1038/s41598-022-23987-z",
      licensing: {
        status: "known",
        licence: "CC BY 4.0",
        reuse: "permitted",
        attribution: "Giacomo Dalla Chiara, Klaas Fiete Krutein, Andisheh Ranjbari e Anne Goodchild",
      },
      temporal: { published_at: "2022-11-11", last_checked_at: "2026-08-25" },
      caveats: ["O estudo é um experimento controlado realizado numa área de 10 quarteirões em Belltown, Seattle, com 11 condutores, 33 rotas e 495 entregas simuladas."],
    },
    outgoingEdges: [],
    incomingEdges: [],
  };
  const SRC_0093_SUMMARY: RecordSummary = {
    id: "SRC-0093",
    type: "SRC-",
    label: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
    file: SRC_0093_DETAIL.file,
    summaryFields: {},
  };

  it("renders Visão geral for an SRC-0093-shaped fixture with editor, document type, all creators, and the Open Évora verification date", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const overview = await within(panel).findByLabelText("Visão geral");
    expect(within(overview).getByText("Scientific Reports (Springer Nature)")).toBeTruthy();
    expect(within(overview).getByText("Documento")).toBeTruthy();
    expect(within(overview).getByText("Giacomo Dalla Chiara, Klaas Fiete Krutein, Andisheh Ranjbari, Anne Goodchild")).toBeTruthy();
    expect(within(overview).getByText(/Verificada pela Open Évora em/)).toBeTruthy();

    // publisher appears exactly once outside SourceTechnicalSection's raw
    // exhaustive disclosure (which independently echoes every canonical
    // field verbatim, unaffected by this integration) — i.e. exactly once
    // in Visão geral.
    const disclosure = within(panel).getByText("Inspeção completa do registo canónico").closest("details") as HTMLElement;
    expect(within(panel).getAllByText("Scientific Reports (Springer Nature)").filter((el) => !disclosure.contains(el))).toHaveLength(1);

    // The retired SRC quick-read block no longer renders separately.
    expect(within(panel).queryByLabelText("Leitura rápida")).toBeNull();

    // Existing external-link action (SUI-02A eligibility) still renders, now
    // in the Source header area rather than the rail.
    const link = within(panel).getByRole("link", { name: /Abrir fonte original/ });
    expect(link.getAttribute("href")).toBe("https://doi.org/10.1038/s41598-022-23987-z");

    // Existing breadcrumb/type/title/orientation content remains present.
    const breadcrumb = within(panel).getByLabelText("Localização");
    expect(within(breadcrumb).getByText("SRC-0093")).toBeTruthy();
    const meaningZone = within(panel).getByLabelText("Significado");
    expect(within(meaningZone).getByText(SRC_0093_SUMMARY.label)).toBeTruthy();
    expect(within(meaningZone).getByText(/Este é um registo técnico da investigação/)).toBeTruthy();

    // SourceTechnicalSection's disclosure remains present.
    expect(within(panel).getByText("Inspeção completa do registo canónico")).toBeTruthy();
  });

  it("positions Visão geral after the meaning zone and before the technical content, for SRC", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const meaningZone = await within(panel).findByLabelText("Significado");
    const overview = within(panel).getByLabelText("Visão geral");
    const technicalSection = within(panel).getByLabelText("Informação técnica");

    expect(meaningZone.compareDocumentPosition(overview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(overview.compareDocumentPosition(technicalSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("SRC no longer renders the generic Relações section, even when the fixture provides edges", async () => {
    const srcWithRelation: RecordDetail = {
      ...SRC_0093_DETAIL,
      incomingEdges: [{ field: "analysis.related_problems", ordinal: 0, from: "EVD-000127" }],
    };
    const evdSummary: RecordSummary = { id: "EVD-000127", type: "EVD-", label: "Alguma evidência.", file: "research/evidence/EVD-000127.yaml", summaryFields: {} };

    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": srcWithRelation })}
        lookup={buildLookup(SRC_0093_SUMMARY, evdSummary)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Visão geral");
    expect(within(panel).queryByLabelText("Relações")).toBeNull();
  });

  it("does not render Visão geral (SourceOverviewSection) for an EVD record", async () => {
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
    expect(within(panel).queryByLabelText("Visão geral")).toBeNull();
  });

  it("does not render Visão geral (SourceOverviewSection) for a PRB record", async () => {
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
    await screen.findByText("Detalhes");
    expect(within(panel).queryByLabelText("Visão geral")).toBeNull();
  });
});

describe("RecordDetailPanel — SUI-03C2 Source View O que encontrámos integration", () => {
  /** Mirrors research/sources/SRC-0093.yaml and research/evidence/EVD-000106.yaml exactly (acceptance case). */
  const SRC_0093_DETAIL: RecordDetail = {
    id: "SRC-0093",
    type: "SRC-",
    file: "research/sources/SRC-0093.yaml",
    record: {
      source_id: "SRC-0093",
      publisher: "Scientific Reports (Springer Nature)",
      name: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
      resource_type: "document",
      access: { level: "public", availability: "available", machine_readable: false },
      canonical_reference: "https://doi.org/10.1038/s41598-022-23987-z",
    },
    outgoingEdges: [],
    incomingEdges: [{ field: "source.source_id", ordinal: null, from: "EVD-000106" }],
  };
  const SRC_0093_SUMMARY: RecordSummary = {
    id: "SRC-0093",
    type: "SRC-",
    label: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
    file: SRC_0093_DETAIL.file,
    summaryFields: {},
  };
  const EVD_000106_DETAIL: RecordDetail = {
    id: "EVD-000106",
    type: "EVD-",
    file: "research/evidence/EVD-000106.yaml",
    record: {
      evidence_id: "EVD-000106",
      source: { source_id: "SRC-0093" },
      observation: {
        summary: "A apresentação de informação sobre disponibilidade junto ao passeio reduziu o tempo de circulação à procura de estacionamento.",
      },
      evidence_nature: "measurement",
      analysis: { related_problems: ["PRB-0005"] },
    },
    outgoingEdges: [{ field: "analysis.related_problems", ordinal: 0, to: "PRB-0005" }],
    incomingEdges: [],
  };
  const EVD_000106_SUMMARY: RecordSummary = {
    id: "EVD-000106",
    type: "EVD-",
    label: "A apresentação de informação sobre disponibilidade junto ao passeio reduziu o tempo de circulação à procura de estacionamento.",
    file: EVD_000106_DETAIL.file,
    summaryFields: {},
  };

  function slowProvider(details: Record<string, RecordDetail>, pending: Set<string>): DataProvider {
    return {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.reject(new Error("not used")),
      getRecord: (id: string) => {
        if (pending.has(id)) return new Promise<RecordDetail>(() => {});
        return details[id] ? Promise.resolve(details[id]) : Promise.reject(new Error(`no fixture for ${id}`));
      },
      getEdges: () => Promise.reject(new Error("not used")),
    };
  }

  function failingProvider(srcDetail: RecordDetail): DataProvider {
    return {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.reject(new Error("not used")),
      getRecord: (id: string) => (id === srcDetail.id ? Promise.resolve(srcDetail) : Promise.reject(new Error("relation load failed"))),
      getEdges: () => Promise.reject(new Error("not used")),
    };
  }

  it("1+2+3+10. SRC-0093 acceptance: loads SourceEvidenceRelations, renders 'O que encontrámos' after 'Visão geral', with primary EVD-000106 observation", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL, "EVD-000106": EVD_000106_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY, EVD_000106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const overview = await within(panel).findByLabelText("Visão geral");
    const findings = await within(panel).findByLabelText("O que encontrámos");

    expect(overview.compareDocumentPosition(findings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(findings).getByText("EVD-000106")).toBeTruthy();
    const evdSummary = (EVD_000106_DETAIL.record.observation as { summary: string }).summary;
    expect(within(findings).getByText(evdSummary)).toBeTruthy();
    expect(within(findings).getByText("Evidência retirada desta fonte")).toBeTruthy();
  });

  it("4. renders the additional EVD under 'Evidência que também usa esta fonte'", async () => {
    const srcWithAdditional: RecordDetail = {
      ...SRC_0093_DETAIL,
      incomingEdges: [{ field: "additional_sources", ordinal: 0, from: "EVD-000106" }],
    };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": srcWithAdditional, "EVD-000106": EVD_000106_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY, EVD_000106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const findings = await within(panel).findByLabelText("O que encontrámos");
    expect(within(findings).getByText("Evidência que também usa esta fonte")).toBeTruthy();
    expect(within(findings).queryByText("Evidência retirada desta fonte")).toBeNull();
  });

  it("5+6+10. EVD-000106 identifier is actionable and selecting it invokes the existing record-navigation mechanism with the correct ID", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL, "EVD-000106": EVD_000106_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY, EVD_000106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={onSelect}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const findings = await within(panel).findByLabelText("O que encontrámos");
    const evdButton = within(findings).getByRole("button", { name: "EVD-000106" });
    await user.click(evdButton);
    expect(onSelect).toHaveBeenCalledWith("EVD-000106");
  });

  it("7. zero-backlink SRC renders the exact empty state after successful relation loading", async () => {
    const isolatedSrc: RecordDetail = { ...SRC_0093_DETAIL, incomingEdges: [] };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": isolatedSrc })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const findings = await within(panel).findByLabelText("O que encontrámos");
    expect(within(findings).getByText("Ainda não existem observações da investigação ligadas explicitamente a esta fonte.")).toBeTruthy();
  });

  it("8. loading state does not prematurely render the zero-EVD empty state", async () => {
    render(
      <RecordDetailPanel
        dataProvider={slowProvider({ "SRC-0093": SRC_0093_DETAIL }, new Set(["EVD-000106"]))}
        lookup={buildLookup(SRC_0093_SUMMARY, EVD_000106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const findings = await within(panel).findByLabelText("O que encontrámos");
    expect(within(findings).queryByText("Ainda não existem observações da investigação ligadas explicitamente a esta fonte.")).toBeNull();
    expect(within(findings).getByRole("status")).toBeTruthy();
  });

  it("9. relation-load failure does not render the zero-EVD empty state as a false conclusion", async () => {
    render(
      <RecordDetailPanel
        dataProvider={failingProvider(SRC_0093_DETAIL)}
        lookup={buildLookup(SRC_0093_SUMMARY, EVD_000106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const findings = await within(panel).findByLabelText("O que encontrámos");
    expect(within(findings).queryByText("Ainda não existem observações da investigação ligadas explicitamente a esta fonte.")).toBeNull();
    expect(within(findings).getByRole("alert")).toBeTruthy();
  });

  it("11. notes / comparator / mechanism wording remains absent", async () => {
    const evdWithNotes: RecordDetail = {
      ...EVD_000106_DETAIL,
      record: { ...EVD_000106_DETAIL.record, notes: "Comparator/mechanism evidence, not Évora-specific." },
    };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL, "EVD-000106": evdWithNotes })}
        lookup={buildLookup(SRC_0093_SUMMARY, EVD_000106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const findings = await within(panel).findByLabelText("O que encontrámos");
    expect(within(findings).queryByText(/Comparator\/mechanism/)).toBeNull();
  });

  it("12. no PRB navigation/content is introduced in O que encontrámos", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL, "EVD-000106": EVD_000106_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY, EVD_000106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const findings = await within(panel).findByLabelText("O que encontrámos");
    expect(within(findings).queryByText(/PRB-0005/)).toBeNull();
    expect(within(findings).queryByRole("button", { name: /PRB-/ })).toBeNull();
  });

  it("13. EVD detail does not trigger Source relation loading (no 'O que encontrámos' section)", async () => {
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
    expect(within(panel).queryByLabelText("O que encontrámos")).toBeNull();
  });

  it("13b. PRB detail does not trigger Source relation loading (no 'O que encontrámos' section)", async () => {
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
    await screen.findByText("Detalhes");
    expect(within(panel).queryByLabelText("O que encontrámos")).toBeNull();
  });

  it("14. existing external-source action and Visão geral remain unchanged alongside O que encontrámos", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL, "EVD-000106": EVD_000106_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY, EVD_000106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const link = await within(panel).findByRole("link", { name: "Abrir fonte original ↗" });
    expect(link.getAttribute("href")).toBe("https://doi.org/10.1038/s41598-022-23987-z");
    expect(within(panel).getByLabelText("Visão geral")).toBeTruthy();
  });
});

describe("RecordDetailPanel — SUI-03D2 Source View Cobertura integration", () => {
  /** Mirrors research/sources/SRC-0093.yaml exactly (matches SourceCoverageSection.test.tsx's fixture). */
  const SRC_0093_DETAIL: RecordDetail = {
    id: "SRC-0093",
    type: "SRC-",
    file: "research/sources/SRC-0093.yaml",
    record: {
      source_id: "SRC-0093",
      publisher: "Scientific Reports (Springer Nature)",
      name: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
      resource_type: "document",
      scope: {
        geography: { level: "local_area", area: "Belltown, Seattle, Washington, EUA" },
        domains: ["MOB", "DIG"],
      },
      access: { level: "public", availability: "available", machine_readable: false },
      canonical_reference: "https://doi.org/10.1038/s41598-022-23987-z",
    },
    outgoingEdges: [],
    incomingEdges: [],
  };
  const SRC_0093_SUMMARY: RecordSummary = {
    id: "SRC-0093",
    type: "SRC-",
    label: SRC_0093_DETAIL.record.name as string,
    file: SRC_0093_DETAIL.file,
    summaryFields: {},
  };

  it("1. SRC detail renders 'Cobertura'", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    expect(await within(panel).findByLabelText("Cobertura")).toBeTruthy();
  });

  it("2. section order is Visão geral, O que encontrámos, Cobertura", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const overview = await within(panel).findByLabelText("Visão geral");
    const findings = await within(panel).findByLabelText("O que encontrámos");
    const coverage = await within(panel).findByLabelText("Cobertura");

    expect(overview.compareDocumentPosition(findings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(findings.compareDocumentPosition(coverage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("3. SRC-0093-shaped fixture renders Área local, Belltown Seattle Washington EUA, MOB, DIG", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const coverage = await within(panel).findByLabelText("Cobertura");
    expect(within(coverage).getByText("Área local")).toBeTruthy();
    expect(within(coverage).getByText("Belltown, Seattle, Washington, EUA")).toBeTruthy();
    expect(within(coverage).getByText("MOB, DIG")).toBeTruthy();
  });

  it("4. no temporal coverage is invented for SRC-0093", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const coverage = await within(panel).findByLabelText("Cobertura");
    expect(within(coverage).queryByText("Data de referência")).toBeNull();
    expect(within(coverage).queryByText("Início")).toBeNull();
    expect(within(coverage).queryByText("Fim")).toBeNull();
  });

  it("5. SRC fixture with scope.temporal.as_of renders the correct preserved-granularity value", async () => {
    const srcWithAsOf: RecordDetail = {
      ...SRC_0093_DETAIL,
      record: {
        ...SRC_0093_DETAIL.record,
        scope: { ...(SRC_0093_DETAIL.record.scope as Record<string, unknown>), temporal: { as_of: "2024-08" } },
      },
    };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": srcWithAsOf })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const coverage = await within(panel).findByLabelText("Cobertura");
    expect(within(coverage).getByText("Data de referência")).toBeTruthy();
    expect(within(coverage).getByText("agosto de 2024")).toBeTruthy();
  });

  it("6. SRC fixture with scope.temporal interval renders Início/Fim correctly", async () => {
    const srcWithInterval: RecordDetail = {
      ...SRC_0093_DETAIL,
      record: {
        ...SRC_0093_DETAIL.record,
        scope: { ...(SRC_0093_DETAIL.record.scope as Record<string, unknown>), temporal: { start: "2020", end: "2024-08-25" } },
      },
    };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": srcWithInterval })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const coverage = await within(panel).findByLabelText("Cobertura");
    expect(within(coverage).getByText("Início")).toBeTruthy();
    expect(within(coverage).getByText("2020")).toBeTruthy();
    expect(within(coverage).getByText("Fim")).toBeTruthy();
    expect(within(coverage).getByText(/25 de agosto de 2024/)).toBeTruthy();
  });

  it("7. EVD detail does not render SourceCoverageSection", async () => {
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
    expect(within(panel).queryByLabelText("Cobertura")).toBeNull();
  });

  it("8. PRB detail does not render SourceCoverageSection", async () => {
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
    await screen.findByText("Detalhes");
    expect(within(panel).queryByLabelText("Cobertura")).toBeNull();
  });

  it("9. existing source action remains unchanged", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const link = await within(panel).findByRole("link", { name: "Abrir fonte original ↗" });
    expect(link.getAttribute("href")).toBe("https://doi.org/10.1038/s41598-022-23987-z");
  });

  it("10. existing findings loading/error behavior remains unchanged", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const findings = await within(panel).findByLabelText("O que encontrámos");
    expect(within(findings).getByText("Ainda não existem observações da investigação ligadas explicitamente a esta fonte.")).toBeTruthy();
  });

  it("11. existing lower technical disclosure/relations remain present", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    expect(await within(panel).findByLabelText("Informação técnica")).toBeTruthy();
    expect(within(panel).queryByLabelText("Proveniência")).toBeNull();
    expect(within(panel).queryByLabelText("Campos do registo")).toBeNull();
  });
});

describe("RecordDetailPanel — SUI-03E2 Source View Datas e acesso integration", () => {
  /** Mirrors research/sources/SRC-0093.yaml exactly (matches SourceDatesAccessSection.test.tsx's fixture). */
  const SRC_0093_DETAIL: RecordDetail = {
    id: "SRC-0093",
    type: "SRC-",
    file: "research/sources/SRC-0093.yaml",
    record: {
      source_id: "SRC-0093",
      publisher: "Scientific Reports (Springer Nature)",
      name: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
      resource_type: "document",
      scope: {
        geography: { level: "local_area", area: "Belltown, Seattle, Washington, EUA" },
        domains: ["MOB", "DIG"],
      },
      access: { level: "public", availability: "available", machine_readable: false, method: "browser", format: "html" },
      canonical_reference: "https://doi.org/10.1038/s41598-022-23987-z",
      temporal: { published_at: "2022-11-11", last_checked_at: "2026-08-25" },
    },
    outgoingEdges: [],
    incomingEdges: [],
  };
  const SRC_0093_SUMMARY: RecordSummary = {
    id: "SRC-0093",
    type: "SRC-",
    label: SRC_0093_DETAIL.record.name as string,
    file: SRC_0093_DETAIL.file,
    summaryFields: {},
  };

  it("1. SRC detail renders 'Datas e acesso'", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    expect(await within(panel).findByLabelText("Datas e acesso")).toBeTruthy();
  });

  it("2. section order is Visão geral, O que encontrámos, Cobertura, Datas e acesso", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const overview = await within(panel).findByLabelText("Visão geral");
    const findings = await within(panel).findByLabelText("O que encontrámos");
    const coverage = await within(panel).findByLabelText("Cobertura");
    const datesAccess = await within(panel).findByLabelText("Datas e acesso");

    expect(overview.compareDocumentPosition(findings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(findings.compareDocumentPosition(coverage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(coverage.compareDocumentPosition(datesAccess) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("3. SRC-0093-shaped fixture renders publication, last-checked, access, and canonical_reference rows", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const datesAccess = await within(panel).findByLabelText("Datas e acesso");
    expect(within(datesAccess).getByText("Publicação")).toBeTruthy();
    expect(within(datesAccess).getByText(/11 de novembro de 2022/)).toBeTruthy();
    expect(within(datesAccess).getByText("Última verificação pela Open Évora")).toBeTruthy();
    expect(within(datesAccess).getByText(formatPublicPartialDate("2026-08-25"))).toBeTruthy();
    expect(within(datesAccess).queryByText("25/08/2026")).toBeNull();
    expect(within(datesAccess).getByText("Nível de acesso")).toBeTruthy();
    expect(within(datesAccess).getByText("Público")).toBeTruthy();
    expect(within(datesAccess).getByText("Disponibilidade")).toBeTruthy();
    expect(within(datesAccess).getByText("Disponível")).toBeTruthy();
    expect(within(datesAccess).getByText("Leitura automática")).toBeTruthy();
    expect(within(datesAccess).getByText("Não")).toBeTruthy();
    expect(within(datesAccess).getByText("Forma de consulta")).toBeTruthy();
    expect(within(datesAccess).getByText("Navegador")).toBeTruthy();
    expect(within(datesAccess).getByText("Formato")).toBeTruthy();
    expect(within(datesAccess).getByText("HTML")).toBeTruthy();
    expect(within(datesAccess).getByText("https://doi.org/10.1038/s41598-022-23987-z")).toBeTruthy();
  });

  it("4. no updated_at or update_frequency row is invented for SRC-0093", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const datesAccess = await within(panel).findByLabelText("Datas e acesso");
    expect(within(datesAccess).queryByText("Última atualização da fonte")).toBeNull();
    expect(within(datesAccess).queryByText("Frequência de atualização")).toBeNull();
  });

  it("5. year-only published_at preserves year precision", async () => {
    const srcYearOnly: RecordDetail = {
      ...SRC_0093_DETAIL,
      record: {
        ...SRC_0093_DETAIL.record,
        temporal: { ...(SRC_0093_DETAIL.record.temporal as Record<string, unknown>), published_at: "2022" },
      },
    };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": srcYearOnly })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const datesAccess = await within(panel).findByLabelText("Datas e acesso");
    expect(within(datesAccess).getByText("2022")).toBeTruthy();
  });

  it("6. year-month updated_at preserves month precision", async () => {
    const srcYearMonthUpdated: RecordDetail = {
      ...SRC_0093_DETAIL,
      record: {
        ...SRC_0093_DETAIL.record,
        temporal: { ...(SRC_0093_DETAIL.record.temporal as Record<string, unknown>), updated_at: "2022-11" },
      },
    };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": srcYearMonthUpdated })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const datesAccess = await within(panel).findByLabelText("Datas e acesso");
    expect(within(datesAccess).getByText("Última atualização da fonte")).toBeTruthy();
    expect(within(datesAccess).getByText("novembro de 2022")).toBeTruthy();
  });

  it("7. update_frequency renders through existing vocabulary", async () => {
    const srcWithFrequency: RecordDetail = {
      ...SRC_0093_DETAIL,
      record: {
        ...SRC_0093_DETAIL.record,
        temporal: { ...(SRC_0093_DETAIL.record.temporal as Record<string, unknown>), update_frequency: "quarterly" },
      },
    };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": srcWithFrequency })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const datesAccess = await within(panel).findByLabelText("Datas e acesso");
    expect(within(datesAccess).getByText("Frequência de atualização")).toBeTruthy();
    expect(within(datesAccess).getByText("Trimestral")).toBeTruthy();
  });

  it("8. machine_readable 'unknown' renders 'Desconhecida', not 'Não'", async () => {
    const srcUnknownMachineReadable: RecordDetail = {
      ...SRC_0093_DETAIL,
      record: {
        ...SRC_0093_DETAIL.record,
        access: { ...(SRC_0093_DETAIL.record.access as Record<string, unknown>), machine_readable: "unknown" },
      },
    };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": srcUnknownMachineReadable })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const datesAccess = await within(panel).findByLabelText("Datas e acesso");
    expect(within(datesAccess).getByText("Desconhecida")).toBeTruthy();
    expect(within(datesAccess).queryByText("Não")).toBeNull();
  });

  it("9. scope.temporal remains exclusive to Cobertura and is not duplicated in Datas e acesso", async () => {
    const srcWithScopeTemporal: RecordDetail = {
      ...SRC_0093_DETAIL,
      record: {
        ...SRC_0093_DETAIL.record,
        scope: { ...(SRC_0093_DETAIL.record.scope as Record<string, unknown>), temporal: { as_of: "2024-08-25" } },
      },
    };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": srcWithScopeTemporal })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const coverage = await within(panel).findByLabelText("Cobertura");
    const datesAccess = await within(panel).findByLabelText("Datas e acesso");
    expect(within(coverage).getByText("Data de referência")).toBeTruthy();
    expect(within(datesAccess).queryByText("Data de referência")).toBeNull();
  });

  it("10. EVD detail does not render SourceDatesAccessSection", async () => {
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
    expect(within(panel).queryByLabelText("Datas e acesso")).toBeNull();
  });

  it("11. PRB detail does not render SourceDatesAccessSection", async () => {
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
    await screen.findByText("Detalhes");
    expect(within(panel).queryByLabelText("Datas e acesso")).toBeNull();
  });

  it("12. existing Abrir fonte original, Visão geral, O que encontrámos, Cobertura remain unchanged", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const link = await within(panel).findByRole("link", { name: "Abrir fonte original ↗" });
    expect(link.getAttribute("href")).toBe("https://doi.org/10.1038/s41598-022-23987-z");
    expect(within(panel).getByLabelText("Visão geral")).toBeTruthy();
    expect(within(panel).getByLabelText("O que encontrámos")).toBeTruthy();
    expect(within(panel).getByLabelText("Cobertura")).toBeTruthy();
  });

  it("13. existing findings loading/error behavior remains unchanged", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const findings = await within(panel).findByLabelText("O que encontrámos");
    expect(within(findings).getByText("Ainda não existem observações da investigação ligadas explicitamente a esta fonte.")).toBeTruthy();
  });

  it("14. existing lower technical disclosure/relations remain present", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    expect(await within(panel).findByLabelText("Informação técnica")).toBeTruthy();
    expect(within(panel).queryByLabelText("Proveniência")).toBeNull();
    expect(within(panel).queryByLabelText("Campos do registo")).toBeNull();
  });
});

describe("RecordDetailPanel — SUI-03F2 Source View Licenciamento integration", () => {
  /** Mirrors research/sources/SRC-0093.yaml exactly (matches SourceLicensingSection.test.tsx's fixture). */
  const SRC_0093_DETAIL: RecordDetail = {
    id: "SRC-0093",
    type: "SRC-",
    file: "research/sources/SRC-0093.yaml",
    record: {
      source_id: "SRC-0093",
      publisher: "Scientific Reports (Springer Nature)",
      name: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
      resource_type: "document",
      scope: {
        geography: { level: "local_area", area: "Belltown, Seattle, Washington, EUA" },
        domains: ["MOB", "DIG"],
      },
      access: { level: "public", availability: "available", machine_readable: false, method: "browser", format: "html" },
      canonical_reference: "https://doi.org/10.1038/s41598-022-23987-z",
      licensing: {
        status: "known",
        licence: "CC BY 4.0",
        reuse: "permitted",
        attribution: "Giacomo Dalla Chiara, Klaas Fiete Krutein, Andisheh Ranjbari e Anne Goodchild",
      },
      temporal: { published_at: "2022-11-11", last_checked_at: "2026-08-25" },
    },
    outgoingEdges: [],
    incomingEdges: [],
  };
  const SRC_0093_SUMMARY: RecordSummary = {
    id: "SRC-0093",
    type: "SRC-",
    label: SRC_0093_DETAIL.record.name as string,
    file: SRC_0093_DETAIL.file,
    summaryFields: {},
  };

  it("1. SRC detail renders 'Licenciamento'", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    expect(await within(panel).findByLabelText("Licenciamento")).toBeTruthy();
  });

  it("2. section order is Visão geral, O que encontrámos, Cobertura, Datas e acesso, Licenciamento", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const overview = await within(panel).findByLabelText("Visão geral");
    const findings = await within(panel).findByLabelText("O que encontrámos");
    const coverage = await within(panel).findByLabelText("Cobertura");
    const datesAccess = await within(panel).findByLabelText("Datas e acesso");
    const licensing = await within(panel).findByLabelText("Licenciamento");

    expect(overview.compareDocumentPosition(findings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(findings.compareDocumentPosition(coverage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(coverage.compareDocumentPosition(datesAccess) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(datesAccess.compareDocumentPosition(licensing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("3. SRC-0093-shaped fixture renders Estado do licenciamento, Licença, Reutilização, and canonical attribution", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const licensing = await within(panel).findByLabelText("Licenciamento");
    expect(within(licensing).getByText("Estado do licenciamento")).toBeTruthy();
    expect(within(licensing).getByText("Conhecido")).toBeTruthy();
    expect(within(licensing).getByText("Licença")).toBeTruthy();
    expect(within(licensing).getByText("CC BY 4.0")).toBeTruthy();
    expect(within(licensing).getByText("Reutilização")).toBeTruthy();
    expect(within(licensing).getByText("Permitida")).toBeTruthy();
    expect(within(licensing).getByText("Atribuição")).toBeTruthy();
    expect(within(licensing).getByText("Giacomo Dalla Chiara, Klaas Fiete Krutein, Andisheh Ranjbari e Anne Goodchild")).toBeTruthy();
  });

  it("4. unknown licensing values render Desconhecido / Desconhecida", async () => {
    const srcUnknownLicensing: RecordDetail = {
      ...SRC_0093_DETAIL,
      record: {
        ...SRC_0093_DETAIL.record,
        licensing: { status: "unknown", reuse: "unknown" },
      },
    };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": srcUnknownLicensing })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const licensing = await within(panel).findByLabelText("Licenciamento");
    expect(within(licensing).getByText("Estado do licenciamento")).toBeTruthy();
    expect(within(licensing).getByText("Desconhecido")).toBeTruthy();
    expect(within(licensing).getByText("Reutilização")).toBeTruthy();
    expect(within(licensing).getByText("Desconhecida")).toBeTruthy();
  });

  it("5. unknown reuse is not presented as prohibited", async () => {
    const srcUnknownLicensing: RecordDetail = {
      ...SRC_0093_DETAIL,
      record: {
        ...SRC_0093_DETAIL.record,
        licensing: { status: "unknown", reuse: "unknown" },
      },
    };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": srcUnknownLicensing })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const licensing = await within(panel).findByLabelText("Licenciamento");
    expect(within(licensing).queryByText("Proibida")).toBeNull();
  });

  it("6. restricted reuse renders 'Restrita'", async () => {
    const srcRestrictedReuse: RecordDetail = {
      ...SRC_0093_DETAIL,
      record: {
        ...SRC_0093_DETAIL.record,
        licensing: { ...(SRC_0093_DETAIL.record.licensing as Record<string, unknown>), reuse: "restricted" },
      },
    };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": srcRestrictedReuse })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const licensing = await within(panel).findByLabelText("Licenciamento");
    expect(within(licensing).getByText("Reutilização")).toBeTruthy();
    expect(within(licensing).getByText("Restrita")).toBeTruthy();
  });

  it("7. absent licence/attribution rows remain omitted", async () => {
    const srcNoLicenceOrAttribution: RecordDetail = {
      ...SRC_0093_DETAIL,
      record: {
        ...SRC_0093_DETAIL.record,
        licensing: { status: "known", reuse: "permitted" },
      },
    };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": srcNoLicenceOrAttribution })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const licensing = await within(panel).findByLabelText("Licenciamento");
    expect(within(licensing).queryByText("Licença")).toBeNull();
    expect(within(licensing).queryByText("Atribuição")).toBeNull();
  });

  it("8. EVD detail does not render SourceLicensingSection", async () => {
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
    expect(within(panel).queryByLabelText("Licenciamento")).toBeNull();
  });

  it("9. PRB detail does not render SourceLicensingSection", async () => {
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
    await screen.findByText("Detalhes");
    expect(within(panel).queryByLabelText("Licenciamento")).toBeNull();
  });

  it("10. existing Visão geral, O que encontrámos, Cobertura, Datas e acesso remain unchanged", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    expect(within(panel).getByLabelText("Visão geral")).toBeTruthy();
    expect(within(panel).getByLabelText("O que encontrámos")).toBeTruthy();
    expect(within(panel).getByLabelText("Cobertura")).toBeTruthy();
    expect(within(panel).getByLabelText("Datas e acesso")).toBeTruthy();
  });

  it("11. existing findings loading/error behavior remains unchanged", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const findings = await within(panel).findByLabelText("O que encontrámos");
    expect(within(findings).getByText("Ainda não existem observações da investigação ligadas explicitamente a esta fonte.")).toBeTruthy();
  });

  it("12. existing lower technical disclosure/relations remain present", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    expect(await within(panel).findByLabelText("Informação técnica")).toBeTruthy();
    expect(within(panel).queryByLabelText("Proveniência")).toBeNull();
    expect(within(panel).queryByLabelText("Campos do registo")).toBeNull();
  });
});

describe("RecordDetailPanel — SUI-03G2 Source View Limitações integration", () => {
  /** Mirrors research/sources/SRC-0093.yaml exactly (matches SourceCaveatsSection.test.tsx's fixture). */
  const SRC_0093_DETAIL: RecordDetail = {
    id: "SRC-0093",
    type: "SRC-",
    file: "research/sources/SRC-0093.yaml",
    record: {
      source_id: "SRC-0093",
      publisher: "Scientific Reports (Springer Nature)",
      name: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
      resource_type: "document",
      scope: {
        geography: { level: "local_area", area: "Belltown, Seattle, Washington, EUA" },
        domains: ["MOB", "DIG"],
      },
      access: { level: "public", availability: "available", machine_readable: false, method: "browser", format: "html" },
      canonical_reference: "https://doi.org/10.1038/s41598-022-23987-z",
      licensing: {
        status: "known",
        licence: "CC BY 4.0",
        reuse: "permitted",
        attribution: "Giacomo Dalla Chiara, Klaas Fiete Krutein, Andisheh Ranjbari e Anne Goodchild",
      },
      temporal: { published_at: "2022-11-11", last_checked_at: "2026-08-25" },
      caveats: ["O estudo é um experimento controlado realizado numa área de 10 quarteirões em Belltown, Seattle, com 11 condutores, 33 rotas e 495 entregas simuladas."],
    },
    outgoingEdges: [],
    incomingEdges: [],
  };
  const SRC_0093_SUMMARY: RecordSummary = {
    id: "SRC-0093",
    type: "SRC-",
    label: SRC_0093_DETAIL.record.name as string,
    file: SRC_0093_DETAIL.file,
    summaryFields: {},
  };

  it("1. SRC with caveats renders 'Limitações'", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    expect(await within(panel).findByLabelText("Limitações")).toBeTruthy();
  });

  it("2. section order is Visão geral, O que encontrámos, Cobertura, Datas e acesso, Licenciamento, Limitações", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const overview = await within(panel).findByLabelText("Visão geral");
    const findings = await within(panel).findByLabelText("O que encontrámos");
    const coverage = await within(panel).findByLabelText("Cobertura");
    const datesAccess = await within(panel).findByLabelText("Datas e acesso");
    const licensing = await within(panel).findByLabelText("Licenciamento");
    const caveats = await within(panel).findByLabelText("Limitações");

    expect(overview.compareDocumentPosition(findings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(findings.compareDocumentPosition(coverage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(coverage.compareDocumentPosition(datesAccess) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(datesAccess.compareDocumentPosition(licensing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(licensing.compareDocumentPosition(caveats) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("3. SRC-0093 canonical caveat renders verbatim", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const caveats = await within(panel).findByLabelText("Limitações");
    expect(
      within(caveats).getByText(
        "O estudo é um experimento controlado realizado numa área de 10 quarteirões em Belltown, Seattle, com 11 condutores, 33 rotas e 495 entregas simuladas."
      )
    ).toBeTruthy();
  });

  it("4. multiple caveats preserve order", async () => {
    const srcMultipleCaveats: RecordDetail = {
      ...SRC_0093_DETAIL,
      record: {
        ...SRC_0093_DETAIL.record,
        caveats: ["Primeira limitação.", "Segunda limitação.", "Terceira limitação."],
      },
    };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": srcMultipleCaveats })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const caveats = await within(panel).findByLabelText("Limitações");
    const items = within(caveats).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Primeira limitação.", "Segunda limitação.", "Terceira limitação."]);
  });

  it("5. empty caveats array: no 'Limitações' heading", async () => {
    const srcEmptyCaveats: RecordDetail = {
      ...SRC_0093_DETAIL,
      record: {
        ...SRC_0093_DETAIL.record,
        caveats: [],
      },
    };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": srcEmptyCaveats })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Licenciamento");
    expect(within(panel).queryByLabelText("Limitações")).toBeNull();
    expect(within(panel).queryByRole("heading", { name: "Limitações" })).toBeNull();
  });

  it("6. absent caveats: no 'Limitações' heading", async () => {
    const srcNoCaveatsField: RecordDetail = {
      ...SRC_0093_DETAIL,
      record: (() => {
        const { caveats: _caveats, ...rest } = SRC_0093_DETAIL.record;
        return rest;
      })(),
    };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": srcNoCaveatsField })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Licenciamento");
    expect(within(panel).queryByLabelText("Limitações")).toBeNull();
    expect(within(panel).queryByRole("heading", { name: "Limitações" })).toBeNull();
  });

  it("7. no placeholder or 'sem limitações' wording appears", async () => {
    const srcNoCaveatsField: RecordDetail = {
      ...SRC_0093_DETAIL,
      record: (() => {
        const { caveats: _caveats, ...rest } = SRC_0093_DETAIL.record;
        return rest;
      })(),
    };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": srcNoCaveatsField })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Licenciamento");
    expect(within(panel).queryByText(/Sem limitações/i)).toBeNull();
    expect(within(panel).queryByText(/Nenhuma limitação conhecida/i)).toBeNull();
    expect(within(panel).queryByText(/Não foram identificadas limitações/i)).toBeNull();
  });

  it("8. EVD notes / research-role-like fields do not leak into the section", async () => {
    const srcWithNoiseFields: RecordDetail = {
      ...SRC_0093_DETAIL,
      record: {
        ...SRC_0093_DETAIL.record,
        caveats: ["Limitação canónica."],
        notes: "Nota de evidência que não deve aparecer aqui.",
        representativeness: "low",
        verification: "unverified",
        temporal_relevance: "current",
        research_role: "primary",
      },
    };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": srcWithNoiseFields })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const caveats = await within(panel).findByLabelText("Limitações");
    expect(within(caveats).queryByText("Nota de evidência que não deve aparecer aqui.")).toBeNull();
    expect(within(caveats).queryByText(/representativeness/i)).toBeNull();
    expect(within(caveats).queryByText(/verification/i)).toBeNull();
    expect(within(caveats).queryByText(/temporal_relevance/i)).toBeNull();
    expect(within(caveats).queryByText(/research_role/i)).toBeNull();
  });

  it("9. EVD detail does not render SourceCaveatsSection", async () => {
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
    expect(within(panel).queryByLabelText("Limitações")).toBeNull();
  });

  it("10. PRB detail does not render SourceCaveatsSection", async () => {
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
    await screen.findByText("Detalhes");
    expect(within(panel).queryByLabelText("Limitações")).toBeNull();
  });

  it("11. existing Visão geral, O que encontrámos, Cobertura, Datas e acesso, Licenciamento remain unchanged", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    expect(within(panel).getByLabelText("Visão geral")).toBeTruthy();
    expect(within(panel).getByLabelText("O que encontrámos")).toBeTruthy();
    expect(within(panel).getByLabelText("Cobertura")).toBeTruthy();
    expect(within(panel).getByLabelText("Datas e acesso")).toBeTruthy();
    expect(within(panel).getByLabelText("Licenciamento")).toBeTruthy();
  });

  it("12. existing findings loading/error behavior remains unchanged", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const findings = await within(panel).findByLabelText("O que encontrámos");
    expect(within(findings).getByText("Ainda não existem observações da investigação ligadas explicitamente a esta fonte.")).toBeTruthy();
  });

  it("13. lower ProvenancePanel/TechnicalDisclosure/RelationshipList are absent for SRC, replaced by SourceTechnicalSection", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    expect(await within(panel).findByLabelText("Informação técnica")).toBeTruthy();
    expect(within(panel).queryByLabelText("Proveniência")).toBeNull();
    expect(within(panel).queryByLabelText("Campos do registo")).toBeNull();
  });
});

describe("RecordDetailPanel — SUI-03H2 Source View Na investigação integration", () => {
  /** Mirrors research/sources/SRC-0093.yaml and research/evidence/EVD-000106.yaml exactly (acceptance case). */
  const SRC_0093_DETAIL: RecordDetail = {
    id: "SRC-0093",
    type: "SRC-",
    file: "research/sources/SRC-0093.yaml",
    record: {
      source_id: "SRC-0093",
      publisher: "Scientific Reports (Springer Nature)",
      name: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
      resource_type: "document",
      access: { level: "public", availability: "available", machine_readable: false },
      canonical_reference: "https://doi.org/10.1038/s41598-022-23987-z",
      licensing: { status: "known", licence: "CC BY 4.0", reuse: "permitted", attribution: "Autores" },
    },
    outgoingEdges: [],
    incomingEdges: [{ field: "source.source_id", ordinal: null, from: "EVD-000106" }],
  };
  const SRC_0093_SUMMARY: RecordSummary = {
    id: "SRC-0093",
    type: "SRC-",
    label: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
    file: SRC_0093_DETAIL.file,
    summaryFields: {},
  };
  const SRC_0093_WITH_CAVEATS: RecordDetail = {
    ...SRC_0093_DETAIL,
    record: { ...SRC_0093_DETAIL.record, caveats: ["Limitação canónica."] },
  };
  const EVD_000106_DETAIL: RecordDetail = {
    id: "EVD-000106",
    type: "EVD-",
    file: "research/evidence/EVD-000106.yaml",
    record: {
      evidence_id: "EVD-000106",
      source: { source_id: "SRC-0093" },
      observation: {
        summary: "A apresentação de informação sobre disponibilidade junto ao passeio reduziu o tempo de circulação à procura de estacionamento.",
      },
      evidence_nature: "measurement",
      analysis: { related_problems: ["PRB-0005"] },
    },
    outgoingEdges: [{ field: "analysis.related_problems", ordinal: 0, to: "PRB-0005" }],
    incomingEdges: [],
  };
  const EVD_000106_SUMMARY: RecordSummary = {
    id: "EVD-000106",
    type: "EVD-",
    label: "A apresentação de informação sobre disponibilidade junto ao passeio reduziu o tempo de circulação à procura de estacionamento.",
    file: EVD_000106_DETAIL.file,
    summaryFields: {},
  };
  /** No `analysis.related_problems` edge at all — related EVD, but no related PRB. */
  const EVD_NO_PRB_DETAIL: RecordDetail = {
    id: "EVD-NOPRB",
    type: "EVD-",
    file: "research/evidence/EVD-NOPRB.yaml",
    record: {
      evidence_id: "EVD-NOPRB",
      source: { source_id: "SRC-0093" },
      observation: { summary: "Observação sem problema relacionado." },
    },
    outgoingEdges: [],
    incomingEdges: [],
  };

  function slowProvider(details: Record<string, RecordDetail>, pending: Set<string>): DataProvider {
    return {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.reject(new Error("not used")),
      getRecord: (id: string) => {
        if (pending.has(id)) return new Promise<RecordDetail>(() => {});
        return details[id] ? Promise.resolve(details[id]) : Promise.reject(new Error(`no fixture for ${id}`));
      },
      getEdges: () => Promise.reject(new Error("not used")),
    };
  }

  function failingProvider(srcDetail: RecordDetail): DataProvider {
    return {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.reject(new Error("not used")),
      getRecord: (id: string) => (id === srcDetail.id ? Promise.resolve(srcDetail) : Promise.reject(new Error("relation load failed"))),
      getEdges: () => Promise.reject(new Error("not used")),
    };
  }

  it("1+6. SRC-0093 acceptance: one shared relation load supplies both sections — count 1, PRB-0005, via EVD-000106", async () => {
    const getRecordSpy = vi.fn((id: string) => {
      const details: Record<string, RecordDetail> = { "SRC-0093": SRC_0093_DETAIL, "EVD-000106": EVD_000106_DETAIL };
      return details[id] ? Promise.resolve(details[id]) : Promise.reject(new Error(`no fixture for ${id}`));
    });
    const dataProvider: DataProvider = {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.reject(new Error("not used")),
      getRecord: getRecordSpy,
      getEdges: () => Promise.reject(new Error("not used")),
    };

    render(
      <RecordDetailPanel
        dataProvider={dataProvider}
        lookup={buildLookup(SRC_0093_SUMMARY, EVD_000106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const findings = await within(panel).findByLabelText("O que encontrámos");
    expect(within(findings).getByText("EVD-000106")).toBeTruthy();

    const investigation = await within(panel).findByLabelText("Na investigação");
    expect(within(investigation).getByText("1")).toBeTruthy();
    expect(within(investigation).getByText("PRB-0005")).toBeTruthy();
    expect(within(investigation).getByText("Através de: EVD-000106")).toBeTruthy();

    // 2. no duplicate relation load: getRecord("EVD-000106") — fetched only by
    // loadSourceEvidenceRelations, never by useRecordDetail itself — is called
    // exactly once, proving a single SourceEvidenceRelations load rather than
    // one per section.
    const evdCalls = getRecordSpy.mock.calls.filter(([id]) => id === "EVD-000106");
    expect(evdCalls).toHaveLength(1);
  });

  it("3+5. caveats absent: Na investigação renders directly after Licenciamento", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL, "EVD-000106": EVD_000106_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY, EVD_000106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const licensing = await within(panel).findByLabelText("Licenciamento");
    const investigation = await within(panel).findByLabelText("Na investigação");
    expect(within(panel).queryByLabelText("Limitações")).toBeNull();
    expect(licensing.compareDocumentPosition(investigation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("3+4. caveats present: Limitações renders before Na investigação", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_WITH_CAVEATS, "EVD-000106": EVD_000106_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY, EVD_000106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const caveats = await within(panel).findByLabelText("Limitações");
    const investigation = await within(panel).findByLabelText("Na investigação");
    expect(caveats.compareDocumentPosition(investigation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("7+8. PRB id is actionable when onSelect supplied, and clicking it calls onSelect('PRB-0005')", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL, "EVD-000106": EVD_000106_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY, EVD_000106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={onSelect}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const investigation = await within(panel).findByLabelText("Na investigação");
    const button = within(investigation).getByRole("button", { name: "PRB-0005" });
    await user.click(button);
    expect(onSelect).toHaveBeenCalledWith("PRB-0005");
  });

  it("9. viaEvidenceIds remain plain text, not separately actionable", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL, "EVD-000106": EVD_000106_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY, EVD_000106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const investigation = await within(panel).findByLabelText("Na investigação");
    expect(within(investigation).queryByRole("button", { name: "EVD-000106" })).toBeNull();
    expect(within(investigation).getByText("Através de: EVD-000106")).toBeTruthy();
  });

  it("10. related EVD but no related PRB: findings render, investigation section absent", async () => {
    const srcNoPrb: RecordDetail = { ...SRC_0093_DETAIL, incomingEdges: [{ field: "source.source_id", ordinal: null, from: "EVD-NOPRB" }] };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": srcNoPrb, "EVD-NOPRB": EVD_NO_PRB_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const findings = await within(panel).findByLabelText("O que encontrámos");
    expect(within(findings).getByText("Observação sem problema relacionado.")).toBeTruthy();
    expect(within(panel).queryByLabelText("Na investigação")).toBeNull();
  });

  it("11. zero-EVD ready case: findings empty state renders, investigation absent", async () => {
    const isolatedSrc: RecordDetail = { ...SRC_0093_DETAIL, incomingEdges: [] };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": isolatedSrc })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const findings = await within(panel).findByLabelText("O que encontrámos");
    expect(within(findings).getByText("Ainda não existem observações da investigação ligadas explicitamente a esta fonte.")).toBeTruthy();
    expect(within(panel).queryByLabelText("Na investigação")).toBeNull();
  });

  it("12. loading: investigation absent, existing findings loading state unchanged", async () => {
    render(
      <RecordDetailPanel
        dataProvider={slowProvider({ "SRC-0093": SRC_0093_DETAIL }, new Set(["EVD-000106"]))}
        lookup={buildLookup(SRC_0093_SUMMARY, EVD_000106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const findings = await within(panel).findByLabelText("O que encontrámos");
    expect(within(findings).getByRole("status")).toBeTruthy();
    expect(within(panel).queryByLabelText("Na investigação")).toBeNull();
  });

  it("13. relation-load error: investigation absent, existing findings error/retry unchanged", async () => {
    render(
      <RecordDetailPanel
        dataProvider={failingProvider(SRC_0093_DETAIL)}
        lookup={buildLookup(SRC_0093_SUMMARY, EVD_000106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const findings = await within(panel).findByLabelText("O que encontrámos");
    expect(within(findings).getByRole("alert")).toBeTruthy();
    expect(within(findings).getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
    expect(within(panel).queryByLabelText("Na investigação")).toBeNull();
  });

  it("14. EVD detail does not load/render Source investigation", async () => {
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
    expect(within(panel).queryByLabelText("Na investigação")).toBeNull();
  });

  it("15. PRB detail does not load/render Source investigation", async () => {
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
    await screen.findByText("Detalhes");
    expect(within(panel).queryByLabelText("Na investigação")).toBeNull();
  });

  it("16. no research_role / comparator / mechanism / PRB semantic content introduced", async () => {
    const evdWithSemantics: RecordDetail = {
      ...EVD_000106_DETAIL,
      record: {
        ...EVD_000106_DETAIL.record,
        notes: "Comparator/mechanism evidence, not Évora-specific.",
        analysis: { ...(EVD_000106_DETAIL.record.analysis as Record<string, unknown>), research_role: "primary" },
      },
    };
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL, "EVD-000106": evdWithSemantics })}
        lookup={buildLookup(SRC_0093_SUMMARY, EVD_000106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const investigation = await within(panel).findByLabelText("Na investigação");
    expect(within(investigation).queryByText(/Comparator\/mechanism/)).toBeNull();
    expect(within(investigation).queryByText(/research_role/)).toBeNull();
    expect(within(investigation).queryByText(/PRB-0005 —/)).toBeNull();
  });
});

describe("RecordDetailPanel — SUI-03I2 Source View Informação técnica integration", () => {
  /** Mirrors research/sources/SRC-0093.yaml and research/evidence/EVD-000106.yaml exactly (acceptance case). */
  const SRC_0093_DETAIL: RecordDetail = {
    id: "SRC-0093",
    type: "SRC-",
    file: "research/sources/SRC-0093.yaml",
    record: {
      source_id: "SRC-0093",
      publisher: "Scientific Reports (Springer Nature)",
      name: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
      resource_type: "document",
      scope: {
        geography: { level: "local_area", area: "Belltown, Seattle, Washington, EUA" },
        domains: ["MOB", "DIG"],
      },
      access: { level: "public", availability: "available", machine_readable: false, method: "browser", format: "html" },
      canonical_reference: "https://doi.org/10.1038/s41598-022-23987-z",
      licensing: {
        status: "known",
        licence: "CC BY 4.0",
        reuse: "permitted",
        attribution: "Giacomo Dalla Chiara, Klaas Fiete Krutein, Andisheh Ranjbari e Anne Goodchild",
      },
      temporal: { published_at: "2022-11-11", last_checked_at: "2026-08-25" },
    },
    outgoingEdges: [],
    incomingEdges: [{ field: "source.source_id", ordinal: null, from: "EVD-000106" }],
  };
  const SRC_0093_SUMMARY: RecordSummary = {
    id: "SRC-0093",
    type: "SRC-",
    label: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
    file: SRC_0093_DETAIL.file,
    summaryFields: {},
  };
  const SRC_0093_WITH_CAVEATS: RecordDetail = {
    ...SRC_0093_DETAIL,
    record: { ...SRC_0093_DETAIL.record, caveats: ["Limitação canónica."] },
  };
  const EVD_000106_DETAIL: RecordDetail = {
    id: "EVD-000106",
    type: "EVD-",
    file: "research/evidence/EVD-000106.yaml",
    record: {
      evidence_id: "EVD-000106",
      source: { source_id: "SRC-0093" },
      observation: {
        summary: "A apresentação de informação sobre disponibilidade junto ao passeio reduziu o tempo de circulação à procura de estacionamento.",
      },
      evidence_nature: "measurement",
      analysis: { related_problems: ["PRB-0005"] },
    },
    outgoingEdges: [{ field: "analysis.related_problems", ordinal: 0, to: "PRB-0005" }],
    incomingEdges: [],
  };
  const EVD_000106_SUMMARY: RecordSummary = {
    id: "EVD-000106",
    type: "EVD-",
    label: "A apresentação de informação sobre disponibilidade junto ao passeio reduziu o tempo de circulação à procura de estacionamento.",
    file: EVD_000106_DETAIL.file,
    summaryFields: {},
  };

  it("1. SRC renders 'Informação técnica'", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    expect(await within(panel).findByLabelText("Informação técnica")).toBeTruthy();
  });

  it("2. section order ends with Limitações, Na investigação, Informação técnica (caveats present)", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_WITH_CAVEATS, "EVD-000106": EVD_000106_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY, EVD_000106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const caveats = await within(panel).findByLabelText("Limitações");
    const investigation = await within(panel).findByLabelText("Na investigação");
    const technical = await within(panel).findByLabelText("Informação técnica");

    expect(caveats.compareDocumentPosition(investigation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(investigation.compareDocumentPosition(technical) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("2b. section order ends with Na investigação, Informação técnica (no caveats)", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL, "EVD-000106": EVD_000106_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY, EVD_000106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    expect(within(panel).queryByLabelText("Limitações")).toBeNull();
    const investigation = await within(panel).findByLabelText("Na investigação");
    const technical = await within(panel).findByLabelText("Informação técnica");

    expect(investigation.compareDocumentPosition(technical) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("3. SourceTechnicalSection disclosure is collapsed by default", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const technical = await within(panel).findByLabelText("Informação técnica");
    const details = within(technical).getByText("Inspeção completa do registo canónico").closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
  });

  it("4. opening it reveals the canonical record tree", async () => {
    const user = userEvent.setup();
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const technical = await within(panel).findByLabelText("Informação técnica");
    const summary = within(technical).getByText("Inspeção completa do registo canónico");
    await user.click(summary);
    const details = summary.closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(true);
    expect(within(technical).getByText("SRC-0093")).toBeTruthy();
    expect(within(technical).getByText("publisher")).toBeTruthy();
  });

  it("5. SRC no longer renders the generic 'Proveniência' section", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Visão geral");
    expect(within(panel).queryByLabelText("Proveniência")).toBeNull();
  });

  it("6. SRC no longer renders the generic 'Relações' section", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Visão geral");
    expect(within(panel).queryByLabelText("Relações")).toBeNull();
  });

  it("7+8. SRC no longer renders the generic TechnicalDisclosure summary, and does render the new SourceTechnicalSection summary", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Visão geral");
    expect(within(panel).queryByText("Inspeção técnica completa — todos os campos canónicos")).toBeNull();
    expect(within(panel).getByText("Inspeção completa do registo canónico")).toBeTruthy();
  });

  it("9. detail.file / repository YAML path is not introduced into the main Source content", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const main = await within(panel).findByLabelText("Visão geral");
    const content = main.closest(".record-detail-main") as HTMLElement;
    expect(within(content).queryByText(/\.yaml/)).toBeNull();
    expect(within(content).queryByText("research/sources/SRC-0093.yaml")).toBeNull();
  });

  it("10. generic relation count is absent from SRC", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Visão geral");
    expect(within(panel).queryByText(/registo\(s\) relacionado\(s\)/)).toBeNull();
  });

  it("11. raw edge/path syntax is absent from SRC", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Visão geral");
    expect(within(panel).queryByText(/caminho\(s\) de entrada/)).toBeNull();
    expect(within(panel).queryByLabelText("Registos relacionados")).toBeNull();
  });

  it("12. 'O que encontrámos' remains unchanged", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL, "EVD-000106": EVD_000106_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY, EVD_000106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const findings = await within(panel).findByLabelText("O que encontrámos");
    expect(within(findings).getByText("EVD-000106")).toBeTruthy();
  });

  it("13. 'Na investigação' remains unchanged", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL, "EVD-000106": EVD_000106_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY, EVD_000106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const investigation = await within(panel).findByLabelText("Na investigação");
    expect(within(investigation).getByText("PRB-0005")).toBeTruthy();
    expect(within(investigation).getByText("Através de: EVD-000106")).toBeTruthy();
  });

  it("14. SRC-0093 renders EVD-000106 in findings, PRB-0005 in investigation, and the full canonical SRC record inside Informação técnica", async () => {
    const user = userEvent.setup();
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL, "EVD-000106": EVD_000106_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY, EVD_000106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const findings = await within(panel).findByLabelText("O que encontrámos");
    expect(within(findings).getByText("EVD-000106")).toBeTruthy();

    const investigation = await within(panel).findByLabelText("Na investigação");
    expect(within(investigation).getByText("PRB-0005")).toBeTruthy();

    const technical = await within(panel).findByLabelText("Informação técnica");
    await user.click(within(technical).getByText("Inspeção completa do registo canónico"));
    expect(within(technical).getByText("SRC-0093")).toBeTruthy();
    expect(within(technical).getByText("canonical_reference")).toBeTruthy();
    expect(within(technical).getByText("licensing")).toBeTruthy();
  });

  it("15. EVD detail still renders its existing generic ProvenancePanel, TechnicalDisclosure, and RelationshipList", async () => {
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
    expect(await within(panel).findByLabelText("Proveniência")).toBeTruthy();
    expect(within(panel).getByText("Inspeção técnica completa — todos os campos canónicos")).toBeTruthy();
    const relacoes = within(panel).getByLabelText("Relações");
    expect(within(relacoes).getByText(/PRB-0006/)).toBeTruthy();
    expect(within(panel).queryByLabelText("Informação técnica")).toBeNull();
  });

  it("16. PRB behavior remains unchanged", async () => {
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
    await screen.findByText("Detalhes");
    expect(within(panel).queryByLabelText("Proveniência")).toBeNull();
    expect(within(panel).getByLabelText("Metadados")).toBeTruthy();
    expect(within(panel).getByText("Estrutura técnica completa")).toBeTruthy();
    expect(within(panel).queryByLabelText("Informação técnica")).toBeNull();
  });

  it("17. no duplicate raw technical disclosure appears for SRC", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Visão geral");
    expect(within(panel).getAllByText(/^Inspeção/).length).toBe(1);
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

describe("RecordDetailPanel — RD-01E/RD-01G PRB raw technical boundary (Proveniência removed)", () => {
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

  it("RD-01G: does not render a Proveniência section for PRB records — Ficheiro canónico/Tipo de registo are already in Metadados", async () => {
    const panel = await renderProvenanceFixture();
    expect(within(panel).queryByLabelText("Proveniência")).toBeNull();
    // The two values Proveniência used to repeat are already present in Metadados.
    const metadados = within(panel).getByLabelText("Metadados");
    expect(within(metadados).getByText("research/problems/PRB-0001.yaml")).toBeTruthy();
    expect(within(metadados).getByText("PRB")).toBeTruthy();
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

  it("orders PRB Detail sections as Metadados, Estado canónico, Campos canónicos, Referências canónicas, Relações no corpus, Estrutura técnica completa", async () => {
    const panel = await renderProvenanceFixture();
    const metadados = within(panel).getByLabelText("Metadados");
    const estadoCanonico = within(panel).getByLabelText("Estado canónico");
    const camposCanonicos = within(panel).getByLabelText("Campos canónicos");
    const referenciasCanonicas = within(panel).getByLabelText("Referências canónicas");
    const relacoes = within(panel).getByLabelText("Relações");
    const rawDisclosure = within(panel).getByText("Estrutura técnica completa").closest("section") as HTMLElement;

    const sections = [metadados, estadoCanonico, camposCanonicos, referenciasCanonicas, relacoes, rawDisclosure];
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

describe("RecordDetailPanel — SUI-03J1A Source View anchor IDs", () => {
  /** Full SRC-0093-shaped fixture: every optional section present (coverage, dates-access, licensing, caveats, investigation via related PRB). */
  const SRC_FULL_DETAIL: RecordDetail = {
    id: "SRC-0093",
    type: "SRC-",
    file: "research/sources/SRC-0093.yaml",
    record: {
      source_id: "SRC-0093",
      publisher: "Scientific Reports (Springer Nature)",
      name: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
      resource_type: "document",
      scope: {
        geography: { level: "local_area", area: "Belltown, Seattle, Washington, EUA" },
        domains: ["MOB", "DIG"],
      },
      access: { level: "public", availability: "available", machine_readable: false },
      canonical_reference: "https://doi.org/10.1038/s41598-022-23987-z",
      licensing: { status: "known", licence: "CC BY 4.0", reuse: "permitted", attribution: "Autores" },
      temporal: { published_at: "2022-11-11", last_checked_at: "2026-08-25" },
      caveats: ["Limitação canónica registada para SRC-0093."],
    },
    outgoingEdges: [],
    incomingEdges: [{ field: "source.source_id", ordinal: null, from: "EVD-000106" }],
  };
  const SRC_FULL_SUMMARY: RecordSummary = {
    id: "SRC-0093",
    type: "SRC-",
    label: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
    file: SRC_FULL_DETAIL.file,
    summaryFields: {},
  };
  const EVD_106_DETAIL: RecordDetail = {
    id: "EVD-000106",
    type: "EVD-",
    file: "research/evidence/EVD-000106.yaml",
    record: {
      evidence_id: "EVD-000106",
      source: { source_id: "SRC-0093" },
      observation: { summary: "Observação ligada a SRC-0093." },
      analysis: { related_problems: ["PRB-0005"] },
    },
    outgoingEdges: [{ field: "analysis.related_problems", ordinal: 0, to: "PRB-0005" }],
    incomingEdges: [],
  };
  const EVD_106_SUMMARY: RecordSummary = {
    id: "EVD-000106",
    type: "EVD-",
    label: "Observação ligada a SRC-0093.",
    file: EVD_106_DETAIL.file,
    summaryFields: {},
  };

  /** Minimal SRC: no caveats field, no incoming EVD edges (no related PRB) — every optional section absent. */
  const SRC_MINIMAL_DETAIL: RecordDetail = {
    id: "SRC-0001",
    type: "SRC-",
    file: "research/sources/SRC-0001.yaml",
    record: {
      source_id: "SRC-0001",
      name: "Minimal source",
      resource_type: "webpage",
      access: { level: "unknown", availability: "unknown", machine_readable: "unknown" },
    },
    outgoingEdges: [],
    incomingEdges: [],
  };
  const SRC_MINIMAL_SUMMARY: RecordSummary = {
    id: "SRC-0001",
    type: "SRC-",
    label: "Minimal source",
    file: SRC_MINIMAL_DETAIL.file,
    summaryFields: {},
  };

  const ALL_SOURCE_ANCHOR_IDS = [
    "source-overview",
    "source-findings",
    "source-coverage",
    "source-dates-access",
    "source-licensing",
    "source-caveats",
    "source-investigation",
    "source-technical",
  ];

  it("1+2+3+13. SRC-0093-shaped full case exposes all eight unique anchor IDs, each once, in canonical order — matching sourceSectionIndex()", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_FULL_DETAIL, "EVD-000106": EVD_106_DETAIL })}
        lookup={buildLookup(SRC_FULL_SUMMARY, EVD_106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );

    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");

    const foundElements = ALL_SOURCE_ANCHOR_IDS.map((id) => {
      const matches = panel.querySelectorAll(`#${id}`);
      expect(matches.length).toBe(1);
      return matches[0] as HTMLElement;
    });

    for (let i = 0; i < foundElements.length - 1; i++) {
      expect(foundElements[i].compareDocumentPosition(foundElements[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("4. findings ready-with-evidence: source-findings exists", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_FULL_DETAIL, "EVD-000106": EVD_106_DETAIL })}
        lookup={buildLookup(SRC_FULL_SUMMARY, EVD_106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const evdId = await within(panel).findByText("EVD-000106");
    const findings = evdId.closest("section") as HTMLElement;
    expect(findings.id).toBe("source-findings");
  });

  it("5. findings ready-empty: source-findings exists", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0001": SRC_MINIMAL_DETAIL })}
        lookup={buildLookup(SRC_MINIMAL_SUMMARY)}
        selectedId="SRC-0001"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const emptyState = await within(panel).findByText(/Ainda não existem observações/);
    const findings = emptyState.closest("section") as HTMLElement;
    expect(findings.id).toBe("source-findings");
  });

  it("6. findings loading: source-findings still exists, loading status unchanged", async () => {
    const pendingProvider: DataProvider = {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.reject(new Error("not used")),
      getRecord: (id: string) => (id === "SRC-0093" ? Promise.resolve(SRC_FULL_DETAIL) : new Promise<RecordDetail>(() => {})),
      getEdges: () => Promise.reject(new Error("not used")),
    };
    render(
      <RecordDetailPanel
        dataProvider={pendingProvider}
        lookup={buildLookup(SRC_FULL_SUMMARY, EVD_106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const status = await within(panel).findByText("A carregar observações da investigação…");
    const findings = status.closest("section") as HTMLElement;
    expect(findings.id).toBe("source-findings");
    expect(within(findings).getByRole("status")).toBeTruthy();
  });

  it("7. findings error: source-findings still exists, error/retry behavior unchanged", async () => {
    const failingProvider: DataProvider = {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.reject(new Error("not used")),
      getRecord: (id: string) => (id === "SRC-0093" ? Promise.resolve(SRC_FULL_DETAIL) : Promise.reject(new Error("relation load failed"))),
      getEdges: () => Promise.reject(new Error("not used")),
    };
    render(
      <RecordDetailPanel
        dataProvider={failingProvider}
        lookup={buildLookup(SRC_FULL_SUMMARY, EVD_106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const alert = await within(panel).findByRole("alert");
    const findings = alert.closest("section") as HTMLElement;
    expect(findings.id).toBe("source-findings");
    expect(within(findings).getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
  });

  it("8. caveats absent: source-caveats absent", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0001": SRC_MINIMAL_DETAIL })}
        lookup={buildLookup(SRC_MINIMAL_SUMMARY)}
        selectedId="SRC-0001"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Informação técnica");
    expect(panel.querySelector("#source-caveats")).toBeNull();
  });

  it("9. caveats present: source-caveats present", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_FULL_DETAIL, "EVD-000106": EVD_106_DETAIL })}
        lookup={buildLookup(SRC_FULL_SUMMARY, EVD_106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    expect(panel.querySelector("#source-caveats")).not.toBeNull();
  });

  it("10. investigation absent: source-investigation absent", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0001": SRC_MINIMAL_DETAIL })}
        lookup={buildLookup(SRC_MINIMAL_SUMMARY)}
        selectedId="SRC-0001"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Informação técnica");
    expect(panel.querySelector("#source-investigation")).toBeNull();
  });

  it("11. investigation present: source-investigation present", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_FULL_DETAIL, "EVD-000106": EVD_106_DETAIL })}
        lookup={buildLookup(SRC_FULL_SUMMARY, EVD_106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const investigation = await within(panel).findByLabelText("Na investigação");
    expect(investigation.id).toBe("source-investigation");
  });

  it("12. technical always present for SRC", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0001": SRC_MINIMAL_DETAIL })}
        lookup={buildLookup(SRC_MINIMAL_SUMMARY)}
        selectedId="SRC-0001"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const technical = await within(panel).findByLabelText("Informação técnica");
    expect(technical.id).toBe("source-technical");
  });

  it("14. EVD detail receives none of the source-* anchor IDs", async () => {
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
    await within(panel).findByLabelText("Proveniência");
    for (const id of ALL_SOURCE_ANCHOR_IDS) {
      expect(panel.querySelector(`#${id}`)).toBeNull();
    }
  });

  it("15. PRB detail receives none of the source-* anchor IDs", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "PRB-0006": PRB_0006_DETAIL })}
        lookup={buildLookup(PRB_0006_SUMMARY, EVD_127_SUMMARY)}
        selectedId="PRB-0006"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Metadados");
    for (const id of ALL_SOURCE_ANCHOR_IDS) {
      expect(panel.querySelector(`#${id}`)).toBeNull();
    }
  });

  it("16. no Source section headings/copy change as a consequence of adding IDs", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_FULL_DETAIL, "EVD-000106": EVD_106_DETAIL })}
        lookup={buildLookup(SRC_FULL_SUMMARY, EVD_106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    for (const label of ["Visão geral", "O que encontrámos", "Cobertura", "Datas e acesso", "Licenciamento", "Limitações", "Na investigação", "Informação técnica"]) {
      expect(within(panel).getByLabelText(label)).toBeTruthy();
      expect(within(panel).getByRole("heading", { name: label, level: 3 })).toBeTruthy();
    }
  });

  it("4. all 8 Source top-level sections carry the shared record-editorial-section class", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_FULL_DETAIL, "EVD-000106": EVD_106_DETAIL })}
        lookup={buildLookup(SRC_FULL_SUMMARY, EVD_106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    for (const id of ALL_SOURCE_ANCHOR_IDS) {
      const section = panel.querySelector(`#${id}`) as HTMLElement;
      expect(section.classList.contains("record-editorial-section")).toBe(true);
    }
  });

  it("5+6+7. findings ready/loading/error states all carry record-editorial-section", async () => {
    const { unmount: unmountReady } = render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_FULL_DETAIL, "EVD-000106": EVD_106_DETAIL })}
        lookup={buildLookup(SRC_FULL_SUMMARY, EVD_106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const readyPanel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const evdId = await within(readyPanel).findByText("EVD-000106");
    expect((evdId.closest("section") as HTMLElement).classList.contains("record-editorial-section")).toBe(true);
    unmountReady();

    const pendingProvider: DataProvider = {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.reject(new Error("not used")),
      getRecord: (id: string) => (id === "SRC-0093" ? Promise.resolve(SRC_FULL_DETAIL) : new Promise<RecordDetail>(() => {})),
      getEdges: () => Promise.reject(new Error("not used")),
    };
    const { unmount: unmountLoading } = render(
      <RecordDetailPanel
        dataProvider={pendingProvider}
        lookup={buildLookup(SRC_FULL_SUMMARY, EVD_106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const loadingPanel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const status = await within(loadingPanel).findByText("A carregar observações da investigação…");
    expect((status.closest("section") as HTMLElement).classList.contains("record-editorial-section")).toBe(true);
    unmountLoading();

    const failingProvider: DataProvider = {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.reject(new Error("not used")),
      getRecord: (id: string) => (id === "SRC-0093" ? Promise.resolve(SRC_FULL_DETAIL) : Promise.reject(new Error("relation load failed"))),
      getEdges: () => Promise.reject(new Error("not used")),
    };
    render(
      <RecordDetailPanel
        dataProvider={failingProvider}
        lookup={buildLookup(SRC_FULL_SUMMARY, EVD_106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const errorPanel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const alert = await within(errorPanel).findByRole("alert");
    expect((alert.closest("section") as HTMLElement).classList.contains("record-editorial-section")).toBe(true);
  });

  it("8. caveats absent: no empty record-editorial-section wrapper for source-caveats", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0001": SRC_MINIMAL_DETAIL })}
        lookup={buildLookup(SRC_MINIMAL_SUMMARY)}
        selectedId="SRC-0001"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Informação técnica");
    expect(panel.querySelector("#source-caveats")).toBeNull();
    expect(panel.querySelectorAll(".record-editorial-section").length).toBe(panel.querySelectorAll("[id^='source-']").length);
  });

  it("9. investigation absent: no empty record-editorial-section wrapper for source-investigation", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0001": SRC_MINIMAL_DETAIL })}
        lookup={buildLookup(SRC_MINIMAL_SUMMARY)}
        selectedId="SRC-0001"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Informação técnica");
    expect(panel.querySelector("#source-investigation")).toBeNull();
    expect(panel.querySelectorAll(".record-editorial-section").length).toBe(panel.querySelectorAll("[id^='source-']").length);
  });
});

describe("RecordDetailPanel — SUI-03J1B desktop Source View 'Nesta fonte' rail index", () => {
  /** Full SRC-0093-shaped fixture: every optional section present (coverage, dates-access, licensing, caveats, investigation via related PRB). */
  const SRC_FULL_DETAIL: RecordDetail = {
    id: "SRC-0093",
    type: "SRC-",
    file: "research/sources/SRC-0093.yaml",
    record: {
      source_id: "SRC-0093",
      publisher: "Scientific Reports (Springer Nature)",
      name: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
      resource_type: "document",
      scope: {
        geography: { level: "local_area", area: "Belltown, Seattle, Washington, EUA" },
        domains: ["MOB", "DIG"],
      },
      access: { level: "public", availability: "available", machine_readable: false },
      canonical_reference: "https://doi.org/10.1038/s41598-022-23987-z",
      licensing: { status: "known", licence: "CC BY 4.0", reuse: "permitted", attribution: "Autores" },
      temporal: { published_at: "2022-11-11", last_checked_at: "2026-08-25" },
      caveats: ["Limitação canónica registada para SRC-0093."],
    },
    outgoingEdges: [],
    incomingEdges: [{ field: "source.source_id", ordinal: null, from: "EVD-000106" }],
  };
  const SRC_FULL_SUMMARY: RecordSummary = {
    id: "SRC-0093",
    type: "SRC-",
    label: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
    file: SRC_FULL_DETAIL.file,
    summaryFields: {},
  };
  const EVD_106_DETAIL: RecordDetail = {
    id: "EVD-000106",
    type: "EVD-",
    file: "research/evidence/EVD-000106.yaml",
    record: {
      evidence_id: "EVD-000106",
      source: { source_id: "SRC-0093" },
      observation: { summary: "Observação ligada a SRC-0093." },
      analysis: { related_problems: ["PRB-0005"] },
    },
    outgoingEdges: [{ field: "analysis.related_problems", ordinal: 0, to: "PRB-0005" }],
    incomingEdges: [],
  };
  const EVD_106_SUMMARY: RecordSummary = {
    id: "EVD-000106",
    type: "EVD-",
    label: "Observação ligada a SRC-0093.",
    file: EVD_106_DETAIL.file,
    summaryFields: {},
  };

  /** Same EVD backlink as EVD_106_DETAIL, but without a related-Problem edge — ready relations, zero related PRB. */
  const EVD_106_NO_PRB_DETAIL: RecordDetail = {
    ...EVD_106_DETAIL,
    record: { ...EVD_106_DETAIL.record, analysis: undefined },
    outgoingEdges: [],
  };

  /** Minimal SRC: no caveats field, no incoming EVD edges (no related PRB) — every optional section absent. */
  const SRC_MINIMAL_DETAIL: RecordDetail = {
    id: "SRC-0001",
    type: "SRC-",
    file: "research/sources/SRC-0001.yaml",
    record: {
      source_id: "SRC-0001",
      name: "Minimal source",
      resource_type: "webpage",
      access: { level: "unknown", availability: "unknown", machine_readable: "unknown" },
    },
    outgoingEdges: [],
    incomingEdges: [],
  };
  const SRC_MINIMAL_SUMMARY: RecordSummary = {
    id: "SRC-0001",
    type: "SRC-",
    label: "Minimal source",
    file: SRC_MINIMAL_DETAIL.file,
    summaryFields: {},
  };

  const FULL_SRC_LABELS_IN_ORDER = ["Visão geral", "O que encontrámos", "Cobertura", "Datas e acesso", "Licenciamento", "Limitações", "Na investigação", "Informação técnica"];

  function renderFull() {
    return render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_FULL_DETAIL, "EVD-000106": EVD_106_DETAIL })}
        lookup={buildLookup(SRC_FULL_SUMMARY, EVD_106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
  }

  function renderMinimal() {
    return render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0001": SRC_MINIMAL_DETAIL })}
        lookup={buildLookup(SRC_MINIMAL_SUMMARY)}
        selectedId="SRC-0001"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
  }

  it("1. renders the existing SRC type explanatory card", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const rail = await within(panel).findByLabelText("Mais ações");
    await within(panel).findByLabelText("Na investigação");
    expect(rail.querySelector(".detail-rail-type-note")).toBeTruthy();
  });

  it("2. renders a 'Nesta fonte' nav", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    const rail = within(panel).getByLabelText("Mais ações");
    const nav = within(rail).getByLabelText("Nesta fonte");
    expect(nav.tagName).toBe("NAV");
  });

  it("3. full SRC-0093 case renders exactly the 8 expected index labels in canonical order", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    const rail = within(panel).getByLabelText("Mais ações");
    const nav = within(rail).getByLabelText("Nesta fonte");
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(FULL_SRC_LABELS_IN_ORDER);
  });

  it("4. every index link href matches the corresponding anchor from sourceSectionIndex()", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    const rail = within(panel).getByLabelText("Mais ações");
    const nav = within(rail).getByLabelText("Nesta fonte");
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "#source-overview",
      "#source-findings",
      "#source-coverage",
      "#source-dates-access",
      "#source-licensing",
      "#source-caveats",
      "#source-investigation",
      "#source-technical",
    ]);
  });

  it("5. no duplicate index entries", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    const rail = within(panel).getByLabelText("Mais ações");
    const nav = within(rail).getByLabelText("Nesta fonte");
    const hrefs = within(nav).getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("6. caveats absent: Limitações absent from the index", async () => {
    renderMinimal();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Informação técnica");
    const rail = within(panel).getByLabelText("Mais ações");
    const nav = within(rail).getByLabelText("Nesta fonte");
    expect(within(nav).queryByRole("link", { name: "Limitações" })).toBeNull();
  });

  it("7. caveats present: Limitações present in the index, in the correct position", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    const rail = within(panel).getByLabelText("Mais ações");
    const nav = within(rail).getByLabelText("Nesta fonte");
    const links = within(nav).getAllByRole("link");
    const labels = links.map((link) => link.textContent);
    expect(labels.indexOf("Limitações")).toBe(labels.indexOf("Licenciamento") + 1);
    expect(labels.indexOf("Limitações")).toBe(labels.indexOf("Na investigação") - 1);
  });

  it("8. relation state loading: O que encontrámos present, Na investigação absent", async () => {
    const pendingProvider: DataProvider = {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.reject(new Error("not used")),
      getRecord: (id: string) => (id === "SRC-0093" ? Promise.resolve(SRC_FULL_DETAIL) : new Promise<RecordDetail>(() => {})),
      getEdges: () => Promise.reject(new Error("not used")),
    };
    render(
      <RecordDetailPanel
        dataProvider={pendingProvider}
        lookup={buildLookup(SRC_FULL_SUMMARY, EVD_106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const rail = await within(panel).findByLabelText("Mais ações");
    const nav = await within(rail).findByLabelText("Nesta fonte");
    expect(within(nav).getByRole("link", { name: "O que encontrámos" })).toBeTruthy();
    expect(within(nav).queryByRole("link", { name: "Na investigação" })).toBeNull();
  });

  it("9. relation state error: O que encontrámos present, Na investigação absent", async () => {
    const failingProvider: DataProvider = {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.reject(new Error("not used")),
      getRecord: (id: string) => (id === "SRC-0093" ? Promise.resolve(SRC_FULL_DETAIL) : Promise.reject(new Error("relation load failed"))),
      getEdges: () => Promise.reject(new Error("not used")),
    };
    render(
      <RecordDetailPanel
        dataProvider={failingProvider}
        lookup={buildLookup(SRC_FULL_SUMMARY, EVD_106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByRole("alert");
    const rail = within(panel).getByLabelText("Mais ações");
    const nav = within(rail).getByLabelText("Nesta fonte");
    expect(within(nav).getByRole("link", { name: "O que encontrámos" })).toBeTruthy();
    expect(within(nav).queryByRole("link", { name: "Na investigação" })).toBeNull();
  });

  it("10. ready with EVD but no related PRB: Na investigação absent", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_FULL_DETAIL, "EVD-000106": EVD_106_NO_PRB_DETAIL })}
        lookup={buildLookup(SRC_FULL_SUMMARY, EVD_106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByText("EVD-000106");
    const rail = within(panel).getByLabelText("Mais ações");
    const nav = await within(rail).findByLabelText("Nesta fonte");
    expect(within(nav).queryByRole("link", { name: "Na investigação" })).toBeNull();
  });

  it("11. ready with related PRB: Na investigação present", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    const rail = within(panel).getByLabelText("Mais ações");
    const nav = within(rail).getByLabelText("Nesta fonte");
    expect(within(nav).getByRole("link", { name: "Na investigação" })).toBeTruthy();
  });

  it("12. Informação técnica always present in the index", async () => {
    renderMinimal();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Informação técnica");
    const rail = within(panel).getByLabelText("Mais ações");
    const nav = within(rail).getByLabelText("Nesta fonte");
    expect(within(nav).getByRole("link", { name: "Informação técnica" })).toBeTruthy();
  });

  it("13. every rendered rail href resolves to exactly one matching DOM id in a full ready Source detail", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    const rail = within(panel).getByLabelText("Mais ações");
    const nav = within(rail).getByLabelText("Nesta fonte");
    const hrefs = within(nav).getAllByRole("link").map((link) => link.getAttribute("href")!);
    for (const href of hrefs) {
      const id = href.slice(1);
      expect(panel.querySelectorAll(`#${id}`).length).toBe(1);
    }
  });

  it("14. no legacy SRC rail items return: no 'Ver no Grafo', 'Ver como Problema', repository/YAML path, or 'Abrir fonte original' inside the rail", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    const rail = within(panel).getByLabelText("Mais ações");
    expect(within(rail).queryByRole("button", { name: /Ver no Grafo/ })).toBeNull();
    expect(within(rail).queryByRole("button", { name: /Ver como Problema/ })).toBeNull();
    expect(rail.querySelector(".detail-rail-file")).toBeNull();
    expect(within(rail).queryByRole("link", { name: /Abrir fonte original/ })).toBeNull();
    expect(within(rail).queryByText("research/sources/SRC-0093.yaml")).toBeNull();
  });

  it("15. 'Abrir fonte original' remains exactly once in the main Source content", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    const links = within(panel).getAllByRole("link", { name: "Abrir fonte original ↗" });
    expect(links).toHaveLength(1);
    const rail = within(panel).getByLabelText("Mais ações");
    expect(rail.contains(links[0])).toBe(false);
  });

  it("16. no second SourceEvidenceRelations load occurs because of the index — EVD backlink fetched exactly once", async () => {
    // SRC-0093 itself is legitimately fetched twice regardless of this
    // index: once by useRecordDetail (the record's own detail load) and once
    // by loadSourceEvidenceRelations (to read its incomingEdges) — both
    // pre-existing, unrelated to the rail. The invariant this index must not
    // break is that EVD-000106 (fetched only by the one shared relations
    // load "O que encontrámos"/"Na investigação" already consume) is never
    // fetched a second time for the rail's own sake.
    const getRecordSpy = vi.fn((id: string) => {
      if (id === "SRC-0093") return Promise.resolve(SRC_FULL_DETAIL);
      if (id === "EVD-000106") return Promise.resolve(EVD_106_DETAIL);
      return Promise.reject(new Error(`no fixture for ${id}`));
    });
    const spiedProvider: DataProvider = {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.reject(new Error("not used")),
      getRecord: getRecordSpy,
      getEdges: () => Promise.reject(new Error("not used")),
    };
    render(
      <RecordDetailPanel
        dataProvider={spiedProvider}
        lookup={buildLookup(SRC_FULL_SUMMARY, EVD_106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    const calledIds = getRecordSpy.mock.calls.map((call) => call[0]);
    expect(calledIds.filter((id) => id === "EVD-000106").length).toBe(1);
  });

  it("17. EVD rail behavior remains unchanged", async () => {
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
    const rail = await within(panel).findByLabelText("Mais ações");
    expect(within(rail).getByRole("button", { name: "Ver no Grafo" })).toBeTruthy();
    expect(within(rail).getByRole("button", { name: "Ver como Problema (PRB-0006)" })).toBeTruthy();
    expect(rail.querySelector(".detail-rail-file")).toBeTruthy();
    expect(within(rail).queryByLabelText("Nesta fonte")).toBeNull();
  });

  it("18. PRB rail behavior remains unchanged", async () => {
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
    const rail = await within(panel).findByLabelText("Mais ações");
    expect(within(rail).queryByRole("button", { name: /Ver no Grafo/ })).toBeNull();
    expect(rail.querySelector(".detail-rail-file")).toBeTruthy();
    expect(within(rail).queryByLabelText("Nesta fonte")).toBeNull();
  });

  it("19. compact Source index is present in the DOM alongside the desktop rail index (SUI-03J2B integrates it; CSS governs visibility)", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    expect(within(panel).getByLabelText("Nesta fonte (versão compacta)")).toBeTruthy();
    // Both the desktop rail nav and the compact nav render — CSS decides which is visible.
    expect(within(panel).getAllByLabelText("Nesta fonte")).toHaveLength(1);
  });
});

describe("RecordDetailPanel — SUI-03J2B compact Source View 'Nesta fonte' index integration", () => {
  const SRC_FULL_DETAIL: RecordDetail = {
    id: "SRC-0093",
    type: "SRC-",
    file: "research/sources/SRC-0093.yaml",
    record: {
      source_id: "SRC-0093",
      publisher: "Scientific Reports (Springer Nature)",
      name: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
      resource_type: "document",
      scope: {
        geography: { level: "local_area", area: "Belltown, Seattle, Washington, EUA" },
        domains: ["MOB", "DIG"],
      },
      access: { level: "public", availability: "available", machine_readable: false },
      canonical_reference: "https://doi.org/10.1038/s41598-022-23987-z",
      licensing: { status: "known", licence: "CC BY 4.0", reuse: "permitted", attribution: "Autores" },
      temporal: { published_at: "2022-11-11", last_checked_at: "2026-08-25" },
      caveats: ["Limitação canónica registada para SRC-0093."],
    },
    outgoingEdges: [],
    incomingEdges: [{ field: "source.source_id", ordinal: null, from: "EVD-000106" }],
  };
  const SRC_FULL_SUMMARY: RecordSummary = {
    id: "SRC-0093",
    type: "SRC-",
    label: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
    file: SRC_FULL_DETAIL.file,
    summaryFields: {},
  };
  const EVD_106_DETAIL: RecordDetail = {
    id: "EVD-000106",
    type: "EVD-",
    file: "research/evidence/EVD-000106.yaml",
    record: {
      evidence_id: "EVD-000106",
      source: { source_id: "SRC-0093" },
      observation: { summary: "Observação ligada a SRC-0093." },
      analysis: { related_problems: ["PRB-0005"] },
    },
    outgoingEdges: [{ field: "analysis.related_problems", ordinal: 0, to: "PRB-0005" }],
    incomingEdges: [],
  };
  const EVD_106_SUMMARY: RecordSummary = {
    id: "EVD-000106",
    type: "EVD-",
    label: "Observação ligada a SRC-0093.",
    file: EVD_106_DETAIL.file,
    summaryFields: {},
  };
  const EVD_106_NO_PRB_DETAIL: RecordDetail = {
    ...EVD_106_DETAIL,
    record: { ...EVD_106_DETAIL.record, analysis: undefined },
    outgoingEdges: [],
  };
  const SRC_MINIMAL_DETAIL: RecordDetail = {
    id: "SRC-0001",
    type: "SRC-",
    file: "research/sources/SRC-0001.yaml",
    record: {
      source_id: "SRC-0001",
      name: "Minimal source",
      resource_type: "webpage",
      access: { level: "unknown", availability: "unknown", machine_readable: "unknown" },
    },
    outgoingEdges: [],
    incomingEdges: [],
  };
  const SRC_MINIMAL_SUMMARY: RecordSummary = {
    id: "SRC-0001",
    type: "SRC-",
    label: "Minimal source",
    file: SRC_MINIMAL_DETAIL.file,
    summaryFields: {},
  };

  const FULL_SRC_LABELS_IN_ORDER = ["Visão geral", "O que encontrámos", "Cobertura", "Datas e acesso", "Licenciamento", "Limitações", "Na investigação", "Informação técnica"];

  function renderFull() {
    return render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_FULL_DETAIL, "EVD-000106": EVD_106_DETAIL })}
        lookup={buildLookup(SRC_FULL_SUMMARY, EVD_106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
  }

  function renderMinimal() {
    return render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0001": SRC_MINIMAL_DETAIL })}
        lookup={buildLookup(SRC_MINIMAL_SUMMARY)}
        selectedId="SRC-0001"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
  }

  it("1. renders the desktop SourceReadingRailIndex structure", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    const rail = within(panel).getByLabelText("Mais ações");
    expect(within(rail).getByLabelText("Nesta fonte").tagName).toBe("NAV");
  });

  it("2. renders the compact SourceCompactSectionIndex structure", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    const details = within(panel).getByText("Nesta fonte", { selector: "summary" }).closest("details");
    expect(details).not.toBeNull();
    expect(details!.className).toContain("source-compact-section-index");
  });

  it("3. both indexes are driven from equivalent sourceSectionIndex inputs (same labels, same order)", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    const rail = within(panel).getByLabelText("Mais ações");
    const desktopNav = within(rail).getByLabelText("Nesta fonte");
    const compactNav = within(panel).getByLabelText("Nesta fonte (versão compacta)");
    const desktopLabels = within(desktopNav).getAllByRole("link").map((l) => l.textContent);
    const compactLabels = within(compactNav).getAllByRole("link").map((l) => l.textContent);
    expect(compactLabels).toEqual(desktopLabels);
    expect(desktopLabels).toEqual(FULL_SRC_LABELS_IN_ORDER);
  });

  it("4. both receive the same resolved relation context (related PRB present in both)", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    const rail = within(panel).getByLabelText("Mais ações");
    const desktopNav = within(rail).getByLabelText("Nesta fonte");
    const compactNav = within(panel).getByLabelText("Nesta fonte (versão compacta)");
    expect(within(desktopNav).getByRole("link", { name: "Na investigação" })).toBeTruthy();
    expect(within(compactNav).getByRole("link", { name: "Na investigação" })).toBeTruthy();
  });

  it("5. no second SourceEvidenceRelations load occurs — EVD backlink fetched exactly once with both indexes rendered", async () => {
    const getRecordSpy = vi.fn((id: string) => {
      if (id === "SRC-0093") return Promise.resolve(SRC_FULL_DETAIL);
      if (id === "EVD-000106") return Promise.resolve(EVD_106_DETAIL);
      return Promise.reject(new Error(`no fixture for ${id}`));
    });
    const spiedProvider: DataProvider = {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.reject(new Error("not used")),
      getRecord: getRecordSpy,
      getEdges: () => Promise.reject(new Error("not used")),
    };
    render(
      <RecordDetailPanel
        dataProvider={spiedProvider}
        lookup={buildLookup(SRC_FULL_SUMMARY, EVD_106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    within(panel).getByLabelText("Nesta fonte (versão compacta)");
    const calledIds = getRecordSpy.mock.calls.map((call) => call[0]);
    expect(calledIds.filter((id) => id === "EVD-000106").length).toBe(1);
  });

  it("6. compact index is placed before 'Visão geral' in DOM order", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    const main = panel.querySelector(".record-detail-main") as HTMLElement;
    const compactDetails = within(main).getByText("Nesta fonte", { selector: "summary" }).closest("details")!;
    const overviewHeading = within(main).getByRole("heading", { name: "Visão geral" });
    const position = compactDetails.compareDocumentPosition(overviewHeading);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("7. compact index remains outside SourceOverviewSection", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    const overviewSection = within(panel).getByLabelText("Visão geral");
    expect(within(overviewSection).queryByText("Nesta fonte", { selector: "summary" })).toBeNull();
  });

  it("8. full SRC-0093 case produces identical 8 entries in desktop and compact indexes", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    const rail = within(panel).getByLabelText("Mais ações");
    const desktopHrefs = within(within(rail).getByLabelText("Nesta fonte"))
      .getAllByRole("link")
      .map((l) => l.getAttribute("href"));
    const compactHrefs = within(within(panel).getByLabelText("Nesta fonte (versão compacta)"))
      .getAllByRole("link")
      .map((l) => l.getAttribute("href"));
    expect(desktopHrefs).toHaveLength(8);
    expect(compactHrefs).toEqual(desktopHrefs);
  });

  it("9. caveats absent: both omit Limitações", async () => {
    renderMinimal();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Informação técnica");
    const rail = within(panel).getByLabelText("Mais ações");
    expect(within(within(rail).getByLabelText("Nesta fonte")).queryByRole("link", { name: "Limitações" })).toBeNull();
    expect(within(within(panel).getByLabelText("Nesta fonte (versão compacta)")).queryByRole("link", { name: "Limitações" })).toBeNull();
  });

  it("10. related PRB absent: both omit Na investigação", async () => {
    render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_FULL_DETAIL, "EVD-000106": EVD_106_NO_PRB_DETAIL })}
        lookup={buildLookup(SRC_FULL_SUMMARY, EVD_106_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByText("EVD-000106");
    const rail = within(panel).getByLabelText("Mais ações");
    const desktopNav = await within(rail).findByLabelText("Nesta fonte");
    expect(within(desktopNav).queryByRole("link", { name: "Na investigação" })).toBeNull();
    expect(within(within(panel).getByLabelText("Nesta fonte (versão compacta)")).queryByRole("link", { name: "Na investigação" })).toBeNull();
  });

  it("11. related PRB present: both include Na investigação", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    const rail = within(panel).getByLabelText("Mais ações");
    expect(within(within(rail).getByLabelText("Nesta fonte")).getByRole("link", { name: "Na investigação" })).toBeTruthy();
    expect(within(within(panel).getByLabelText("Nesta fonte (versão compacta)")).getByRole("link", { name: "Na investigação" })).toBeTruthy();
  });

  it("12. compact links resolve to the same Source anchors as desktop links", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    const rail = within(panel).getByLabelText("Mais ações");
    const desktopHrefs = within(within(rail).getByLabelText("Nesta fonte"))
      .getAllByRole("link")
      .map((l) => l.getAttribute("href")!);
    for (const href of desktopHrefs) {
      const id = href.slice(1);
      expect(panel.querySelectorAll(`#${id}`).length).toBe(1);
    }
    const compactHrefs = within(within(panel).getByLabelText("Nesta fonte (versão compacta)"))
      .getAllByRole("link")
      .map((l) => l.getAttribute("href")!);
    expect(compactHrefs).toEqual(desktopHrefs);
  });

  it("13. 'Abrir fonte original' remains exactly once", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    expect(within(panel).getAllByRole("link", { name: "Abrir fonte original ↗" })).toHaveLength(1);
  });

  it("14. no legacy Source rail actions/path reappear", async () => {
    renderFull();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Na investigação");
    expect(within(panel).queryByRole("button", { name: /Ver no Grafo/ })).toBeNull();
    expect(within(panel).queryByRole("button", { name: /Ver como Problema/ })).toBeNull();
    expect(within(panel).queryByText("research/sources/SRC-0093.yaml")).toBeNull();
  });

  it("15. EVD does not render SourceCompactSectionIndex", async () => {
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
    await within(panel).findByLabelText("Mais ações");
    expect(within(panel).queryByLabelText("Nesta fonte (versão compacta)")).toBeNull();
  });

  it("16. PRB does not render SourceCompactSectionIndex", async () => {
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
    await within(panel).findByLabelText("Mais ações");
    expect(within(panel).queryByLabelText("Nesta fonte (versão compacta)")).toBeNull();
  });
});

describe("RecordDetailPanel — SUI-03K1 suppress obsolete SRC roleFields chip row", () => {
  /** Mirrors research/sources/SRC-0093.yaml, with summaryFields populated exactly as real read-model.js buildSummaryFields() output (SUI-03K0's 9-chip case). */
  const SRC_0093_DETAIL: RecordDetail = {
    id: "SRC-0093",
    type: "SRC-",
    file: "research/sources/SRC-0093.yaml",
    record: {
      source_id: "SRC-0093",
      publisher: "Scientific Reports (Springer Nature)",
      creators: ["Giacomo Dalla Chiara", "Klaas Fiete Krutein", "Andisheh Ranjbari", "Anne Goodchild"],
      name: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
      resource_type: "document",
      scope: {
        geography: { level: "local_area", area: "Belltown, Seattle, Washington, EUA" },
        domains: ["MOB", "DIG"],
      },
      access: {
        level: "public",
        availability: "available",
        machine_readable: false,
        method: "browser",
        format: "html",
      },
      acquisition: { method: "public_web" },
      canonical_reference: "https://doi.org/10.1038/s41598-022-23987-z",
      licensing: {
        status: "known",
        licence: "CC BY 4.0",
        reuse: "permitted",
        attribution: "Giacomo Dalla Chiara, Klaas Fiete Krutein, Andisheh Ranjbari e Anne Goodchild",
      },
      temporal: { published_at: "2022-11-11", last_checked_at: "2026-08-25" },
      caveats: ["O estudo é um experimento controlado realizado numa área de 10 quarteirões em Belltown, Seattle, com 11 condutores, 33 rotas e 495 entregas simuladas."],
    },
    outgoingEdges: [],
    incomingEdges: [],
  };
  /** SUI-03K0's exact 9-chip reproduction: every schema-declared enum field buildSummaryFields() would surface for this record. */
  const SRC_0093_SUMMARY: RecordSummary = {
    id: "SRC-0093",
    type: "SRC-",
    label: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
    file: SRC_0093_DETAIL.file,
    summaryFields: {
      "resource_type": "document",
      "scope.geography.level": "local_area",
      "access.level": "public",
      "access.availability": "available",
      "access.method": "browser",
      "access.format": "html",
      "acquisition.method": "public_web",
      "licensing.status": "known",
      "licensing.reuse": "permitted",
    },
  };

  /** Sparse SRC-0113-shaped fixture: fewer optional sections, but still a 7-field summaryFields set (SUI-03K0's second reproduction). */
  const SRC_0113_DETAIL: RecordDetail = {
    id: "SRC-0113",
    type: "SRC-",
    file: "research/sources/SRC-0113.yaml",
    record: {
      source_id: "SRC-0113",
      name: "Minimal municipal webpage",
      resource_type: "webpage",
      access: { level: "public", availability: "available", machine_readable: false },
      acquisition: { method: "public_web" },
      licensing: { status: "known", reuse: "permitted" },
    },
    outgoingEdges: [],
    incomingEdges: [],
  };
  const SRC_0113_SUMMARY: RecordSummary = {
    id: "SRC-0113",
    type: "SRC-",
    label: "Minimal municipal webpage",
    file: SRC_0113_DETAIL.file,
    summaryFields: {
      "resource_type": "webpage",
      "access.level": "public",
      "access.availability": "available",
      "acquisition.method": "public_web",
      "licensing.status": "known",
      "licensing.reuse": "permitted",
      "access.machine_readable": "false",
    },
  };

  const FORMER_SRC_CHIP_VALUES = ["document", "local_area", "public", "available", "browser", "html", "public_web", "known", "permitted"];

  function renderSrc0093() {
    return render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0093": SRC_0093_DETAIL })}
        lookup={buildLookup(SRC_0093_SUMMARY)}
        selectedId="SRC-0093"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
  }

  function renderSrc0113() {
    return render(
      <RecordDetailPanel
        dataProvider={fakeProvider({ "SRC-0113": SRC_0113_DETAIL })}
        lookup={buildLookup(SRC_0113_SUMMARY)}
        selectedId="SRC-0113"
        onSelect={noop}
        onBackToRecords={noop}
        onViewAsProblem={noop}
        onViewInGraph={noop}
      />
    );
  }

  it("1. SRC-0093 detail renders no generic roleFields chip row", async () => {
    renderSrc0093();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const meaningZone = await within(panel).findByLabelText("Significado");
    expect(meaningZone.querySelector(".record-role-fields")).toBeNull();
    expect(within(meaningZone).queryAllByText((_, el) => el?.classList.contains("record-role-chip") ?? false)).toHaveLength(0);
  });

  it("2. former SRC chip values are not rendered in the header role-fields surface", async () => {
    renderSrc0093();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const meaningZone = await within(panel).findByLabelText("Significado");
    for (const value of FORMER_SRC_CHIP_VALUES) {
      expect(within(meaningZone).queryByText(new RegExp(value, "i"))).toBeNull();
    }
  });

  it("3. SRC-0113-shaped sparse record also renders no generic roleFields row", async () => {
    renderSrc0113();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const meaningZone = await within(panel).findByLabelText("Significado");
    expect(meaningZone.querySelector(".record-role-fields")).toBeNull();
  });

  it("4. no raw acquisition.method / public_web presentation appears in the SRC header", async () => {
    renderSrc0093();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const meaningZone = await within(panel).findByLabelText("Significado");
    expect(within(meaningZone).queryByText(/acquisition\.method/)).toBeNull();
    expect(within(meaningZone).queryByText(/public_web/)).toBeNull();
  });

  it("5. Source title remains present", async () => {
    renderSrc0093();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const meaningZone = await within(panel).findByLabelText("Significado");
    expect(within(meaningZone).getByText(SRC_0093_SUMMARY.label)).toBeTruthy();
  });

  it("6. SRC type identity treatment remains present", async () => {
    renderSrc0093();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const breadcrumb = within(panel).getByLabelText("Localização");
    expect(within(breadcrumb).getByText("SRC-0093")).toBeTruthy();
  });

  it("7. Abrir fonte original remains present exactly once", async () => {
    renderSrc0093();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Visão geral");
    expect(within(panel).getAllByRole("link", { name: "Abrir fonte original ↗" })).toHaveLength(1);
  });

  it("8. Visão geral remains present", async () => {
    renderSrc0093();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    expect(await within(panel).findByLabelText("Visão geral")).toBeTruthy();
  });

  it("9. compact Source index integration remains unchanged (renders before Visão geral)", async () => {
    renderSrc0093();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Visão geral");
    const main = panel.querySelector(".record-detail-main") as HTMLElement;
    const compactDetails = within(main).getByText("Nesta fonte", { selector: "summary" }).closest("details")!;
    const overviewHeading = within(main).getByRole("heading", { name: "Visão geral" });
    const position = compactDetails.compareDocumentPosition(overviewHeading);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("10. desktop Source rail/index remains unchanged", async () => {
    renderSrc0093();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    await within(panel).findByLabelText("Visão geral");
    const rail = within(panel).getByLabelText("Mais ações");
    expect(within(rail).getByLabelText("Nesta fonte")).toBeTruthy();
  });

  it("11. EVD roleFields rendering remains unchanged", async () => {
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
    expect(within(meaningZone).getByText(/Força da evidência/)).toBeTruthy();
    expect(meaningZone.querySelector(".record-role-fields")).toBeTruthy();
  });

  it("12. PRB behavior remains unchanged (still uses status summary field)", async () => {
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
    const meaningZone = await within(panel).findByLabelText("Significado");
    expect(meaningZone.querySelector(".record-role-fields")).toBeTruthy();
  });

  it("13. no Source section metadata was removed from its dedicated human-readable section (Visão geral still shows resource_type)", async () => {
    renderSrc0093();
    const panel = (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
    const overview = await within(panel).findByLabelText("Visão geral");
    expect(within(overview).getByText("Documento")).toBeTruthy();
  });

  it("14. no presentation vocabulary was added for acquisition.method", async () => {
    const presentation = await import("../presentation");
    expect(() => presentation.publicFieldCaption("acquisition.method")).not.toThrow();
    // Falls back to the raw field string — no dedicated caption/enum mapping exists for it.
    expect(presentation.publicFieldCaption("acquisition.method")).toBe("acquisition.method");
    expect(presentation.publicEnumLabel("acquisition.method", "public_web")).toBe("public_web");
  });
});
