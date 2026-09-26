import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Explorer } from "./Explorer";
import { StaticDataProvider } from "../dataProvider/StaticDataProvider";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";

const INDEX: RecordSummary[] = [
  { id: "PRB-0005", type: "PRB-", label: "Pressão de estacionamento com uma descrição…", file: "research/problems/PRB-0005.yaml", summaryFields: { status: "OPEN" } },
  { id: "EVD-000105", type: "EVD-", label: "Via Verde Parking Buddy", file: "research/evidence/EVD-000105.yaml", summaryFields: { strength: "primary-authoritative" } },
  { id: "SRC-0092", type: "SRC-", label: "Via Verde Estacionar", file: "research/sources/SRC-0092.yaml", summaryFields: {} },
  {
    id: "WID-0001",
    type: "WID-",
    label: "WID-0001",
    file: "research/widgets/WID-0001.yaml",
    summaryFields: { status: "ativo" },
  },
];

const DETAILS: Record<string, RecordDetail> = {
  "PRB-0005": {
    id: "PRB-0005",
    type: "PRB-",
    file: "research/problems/PRB-0005.yaml",
    record: { title: "Pressão de estacionamento com uma descrição canónica completa que não pode ser truncada", domain: ["mobility"], evidence: [{ evidence_id: "EVD-000105", effects: ["REFINES"], research_roles: ["COMPARATIVE_MECHANISM"] }] },
    outgoingEdges: [{ field: "evidence", ordinal: 0, to: "EVD-000105" }],
    incomingEdges: [],
  },
  "EVD-000105": {
    id: "EVD-000105",
    type: "EVD-",
    file: "research/evidence/EVD-000105.yaml",
    record: { observation: { summary: "Fixture" }, provenance: { sources: ["SRC-0092"], extracted_at: "2026-08-11" }, scope: { geography: { level: "city", area: "Évora" }, populations: [], temporal: { as_of: "2026" } }, domains: ["MOB"], evidence_nature: "fact", claim_authority: "authoritative", inference_limits: ["Limite de fixture."] },
    outgoingEdges: [{ field: "provenance.sources", ordinal: 0, to: "SRC-0092" }],
    incomingEdges: [{ field: "evidence", ordinal: 0, from: "PRB-0005" }],
  },
  "SRC-0092": {
    id: "SRC-0092",
    type: "SRC-",
    file: "research/sources/SRC-0092.yaml",
    record: { publisher: "Via Verde", name: "Estacionar" },
    outgoingEdges: [],
    incomingEdges: [{ field: "provenance.sources", ordinal: 0, from: "EVD-000105" }],
  },
  "WID-0001": {
    id: "WID-0001",
    type: "WID-",
    file: "research/widgets/WID-0001.yaml",
    record: {
      widget_id: "WID-0001",
      nested: { a: 1, list: [1, 2, 3], flag: true, empty: null },
    },
    outgoingEdges: [],
    incomingEdges: [],
  },
};

async function getDetailPanel(): Promise<HTMLElement> {
  return (await screen.findByText("Detalhes")).closest("section") as HTMLElement;
}

function recordsHeading(): HTMLElement {
  return screen.getByRole("heading", { name: "Registos" });
}

/** The Records type-filter button whose visible label is `label` (its accessible name also carries the count). */
function typeFilterButton(label: string): HTMLElement {
  const group = screen.getByRole("group", { name: "Tipo de registo" });
  return within(group).getByRole("button", { name: new RegExp(`^${label} `) });
}

function activeTypeFilterLabel(): string | undefined {
  const group = screen.getByRole("group", { name: "Tipo de registo" });
  const pressed = within(group).getAllByRole("button").find((button) => button.getAttribute("aria-pressed") === "true");
  return pressed?.textContent?.replace(/\s*\d+$/, "");
}

/** PRB-0005 with an authored open question that references EVD-000105 — scoped to PRB Details tests so generic Record Detail fixtures stay unchanged. */
function withOpenQuestionEvidence(): Partial<DataProvider> {
  const prb = DETAILS["PRB-0005"];
  const detail: RecordDetail = { ...prb, record: { ...prb.record, investigation: { open_questions: [{ question: "Questão de fixture?", evidence: ["EVD-000105"] }] } } };
  return { getRecord: (id: string) => (id === "PRB-0005" ? Promise.resolve(detail) : fakeProvider().getRecord(id)) };
}

function fakeProvider(overrides: Partial<DataProvider> = {}): DataProvider {
  return {
    getManifest: () => Promise.reject(new Error("not used in Explorer tests")),
    listRecords: () => Promise.resolve(INDEX),
    getRecord: (id: string) => {
      const detail = DETAILS[id];
      return detail ? Promise.resolve(detail) : Promise.reject(new Error(`no fixture detail for ${id}`));
    },
    getEdges: () => Promise.resolve([]),
    ...overrides,
  };
}

beforeEach(() => {
  // jsdom does not implement scrollIntoView — only exercised when a test's
  // URL carries a real, resolvable fragment (F07/F08's applyInitialFragment
  // path below); harmless no-op stub for every other test.
  Element.prototype.scrollIntoView = vi.fn() as unknown as typeof Element.prototype.scrollIntoView;
  // Most workflow tests exercise the existing Records flow explicitly; root
  // routing itself is covered in the Overview suite below.
  window.history.replaceState(null, "", "/?view=records");
});

describe("Explorer — Records workflow (fake provider)", () => {
  it("retries a failed record index load", async () => {
    let attempts = 0;
    const provider = fakeProvider({ listRecords: () => (attempts++ === 0 ? Promise.reject(new Error("temporary index failure")) : Promise.resolve(INDEX)) });
    const user = userEvent.setup();
    render(<Explorer dataProvider={provider} />);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/temporary index failure/)).toBeTruthy();
    await user.click(within(alert).getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("button", { name: /PRB-0005/ })).toBeTruthy();
    expect(attempts).toBe(2);
  });

  it("shows the Records table before any selection, and does not eagerly load a detail", async () => {
    const getRecord = vi.fn(fakeProvider().getRecord);
    render(<Explorer dataProvider={fakeProvider({ getRecord })} />);
    await screen.findByRole("button", { name: /PRB-0005/ });
    expect(recordsHeading()).toBeTruthy();
    expect(getRecord).not.toHaveBeenCalled();
  });

  it("selecting a record triggers exactly one lazy getRecord() call, not one per row", async () => {
    const user = userEvent.setup();
    const getRecord = vi.fn(fakeProvider().getRecord);
    render(<Explorer dataProvider={fakeProvider({ getRecord })} />);

    const button = await screen.findByRole("button", { name: /PRB-0005/ });
    await user.click(button);

    await screen.findByText("Estrutura técnica completa");
    expect(getRecord).toHaveBeenCalledTimes(1);
    expect(getRecord).toHaveBeenCalledWith("PRB-0005");
  });

  it("resolves outgoing PRB references to related summary labels via Referências canónicas", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));

    const detailPanel = (await screen.findByText("Detalhes")).closest("section")!;
    // RD-01G: PRB Relações no corpus now shows only incoming records — PRB-0005's outgoing evidence[0] -> EVD-000105 reference is owned exclusively by Referências canónicas.
    const referenciasCanonicas = within(detailPanel).getByLabelText("Referências canónicas");
    expect(within(referenciasCanonicas).getByRole("button", { name: /EVD-000105/ })).toBeTruthy();
  });

  it("resolves incoming relationships to related summary labels from the index", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));

    let detailPanel = await getDetailPanel();
    const referenciasCanonicas = within(detailPanel).getByLabelText("Referências canónicas");
    const outgoingButton = await within(referenciasCanonicas).findByRole("button", { name: /EVD-000105/ });
    await user.click(outgoingButton);

    detailPanel = await getDetailPanel();
    await within(detailPanel).findByText(/Pressão de estacionamento/);
    expect(within(detailPanel).getByText("Mecanismo comparativo")).toBeTruthy();
  });

  it("navigates PRB-0005 -> EVD-000105 -> SRC-0092, each step reachable back to Registos via the breadcrumb", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);

    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    await screen.findByText("Estrutura técnica completa");

    let detailPanel = await getDetailPanel();
    // RD-01G: PRB-0005's outgoing reference to EVD-000105 is owned by Referências canónicas, not Relações no corpus.
    await user.click(await within(within(detailPanel).getByLabelText("Referências canónicas")).findByRole("button", { name: /EVD-000105/ }));
    detailPanel = await getDetailPanel();
    await within(detailPanel).findByText(/Via Verde/);

    await user.click(await within(detailPanel).findByRole("button", { name: "Via Verde Estacionar" }));

    detailPanel = await getDetailPanel();
    expect(within(detailPanel).getAllByText("SRC-0092").length).toBeGreaterThan(0);
    // V2: Record Detail is a full-page composition, not a persistent
    // split-view — the table itself is gone while a record is selected;
    // "Registos" is reachable again only via the breadcrumb.
    expect(screen.queryByRole("heading", { name: "Registos" })).toBeNull();
    const breadcrumb = within(detailPanel).getByLabelText("Localização");
    await user.click(within(breadcrumb).getByRole("button", { name: "Registos" }));
    expect(recordsHeading()).toBeTruthy();
    expect(await screen.findByRole("button", { name: /PRB-0005/ })).toBeTruthy();
  });

  it("renders a future generic record type (WID-) through the same generic detail renderer, including nested objects/arrays", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);

    await user.click(await screen.findByRole("button", { name: /WID-0001/ }));
    const detailPanel = await getDetailPanel();
    await within(detailPanel).findByText("widget_id");
    expect(within(detailPanel).getByText("nested")).toBeTruthy();
    expect(within(detailPanel).getByText("Sim")).toBeTruthy(); // boolean `true` rendered as "Sim"
    expect(within(detailPanel).getByText("—")).toBeTruthy(); // null rendered as an em dash placeholder
  });

  it("a malformed/failed detail load produces a local actionable error, still reachable back to Records via the breadcrumb", async () => {
    const user = userEvent.setup();
    const getRecord = () => Promise.reject(new Error("boom: malformed JSON"));
    render(<Explorer dataProvider={fakeProvider({ getRecord })} />);

    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    await screen.findByRole("alert");
    expect(screen.getByText(/boom: malformed JSON/)).toBeTruthy();
    // V2: the error still renders inside the Record Detail composition, so
    // the breadcrumb (not a persistent table) is the way back to Records.
    const breadcrumb = screen.getByLabelText("Localização");
    await user.click(within(breadcrumb).getByRole("button", { name: "Registos" }));
    expect(recordsHeading()).toBeTruthy();
    expect(await screen.findByRole("button", { name: /EVD-000105/ })).toBeTruthy();
  });

  it("retries a failed record detail and restores the selected detail", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const getRecord = (id: string) => (attempts++ === 0 ? Promise.reject(new Error("temporary detail failure")) : Promise.resolve(DETAILS[id]));
    render(<Explorer dataProvider={fakeProvider({ getRecord })} />);

    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    const detailPanel = await getDetailPanel();
    const alert = await within(detailPanel).findByRole("alert");
    await user.click(within(alert).getByRole("button", { name: "Tentar novamente" }));
    expect(await within(detailPanel).findByText("Estrutura técnica completa")).toBeTruthy();
    expect(attempts).toBe(2);
  });

  it("filters rows as the user types, case- and diacritic-insensitively", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("button", { name: /PRB-0005/ });

    const search = screen.getByLabelText("Pesquisar");
    await user.type(search, "PRESSAO");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /PRB-0005/ })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /EVD-000105/ })).toBeNull();
    });
  });
});

describe("Explorer — Overview view", () => {
  it("uses Overview at the root and projects only current PRBs with dynamic counts and mapped statuses", async () => {
    window.history.replaceState(null, "", "/");
    render(<Explorer dataProvider={fakeProvider()} />);

    await screen.findByRole("heading", { name: "Visão geral" });
    const discoveryRegion = screen.getByRole("region", { name: "Explorar problemas" });
    expect(discoveryRegion).toBeTruthy();
    // Compact inline metric presentation (visual-convergence pass): value
    // and label share one line, e.g. "1 Problema" — no separate stacked
    // label element.
    const metricValues = screen.getAllByText("1", { selector: ".overview-metric-value" });
    expect(metricValues[0].closest(".overview-metric")?.textContent).toBe("1 Problema");
    expect(metricValues[1].closest(".overview-metric")?.textContent).toBe("1 Registo de evidência");
    expect(await screen.findByText("Pressão de estacionamento com uma descrição canónica completa que não pode ser truncada")).toBeTruthy();
    expect(within(discoveryRegion).getByRole("list")).toBeTruthy();
    expect(screen.queryByText("Pressão de estacionamento com uma descrição…")).toBeNull();
    expect(screen.queryByText("Via Verde Parking Buddy")).toBeNull();
    expect(screen.getByText("Projeto independente — não oficial")).toBeTruthy();
    expect(screen.queryByText("Como ler o Explorer")).toBeNull();
    expect(screen.queryByText(/Estado de validação:/)).toBeNull();
    expect(screen.queryByText(/Estado da evidência:/)).toBeNull();
    expect(screen.getByRole("button", { name: "Problemas", hidden: true }).getAttribute("aria-current")).toBe("page");
  });

  it("UX-D §4: renders Evidência as its own explicitly labeled dimension in the row, never merged with Validação", async () => {
    // The editorial problem-list row (Overview visual-completion) shows
    // evidenceStatus inline via the restrained reading chip; validationStatus
    // stays available only through the canonical VALIDAÇÃO filter rail, not
    // repeated per row (never merged, never dropped — just not duplicated at
    // this density).
    const statusIndex: RecordSummary[] = [
      {
        id: "PRB-0005",
        type: "PRB-",
        label: "Pressão de estacionamento com uma descrição…",
        file: "research/problems/PRB-0005.yaml",
        summaryFields: { status: "OPEN", validation_status: "unvalidated", evidence_status: "corroborated" },
      },
    ];
    const statusDetails: Record<string, RecordDetail> = {
      "PRB-0005": { ...DETAILS["PRB-0005"], record: { ...DETAILS["PRB-0005"].record, validation_status: "unvalidated", evidence_status: "corroborated" } },
    };
    window.history.replaceState(null, "", "/");
    render(
      <Explorer
        dataProvider={fakeProvider({
          listRecords: () => Promise.resolve(statusIndex),
          getRecord: (id: string) => (statusDetails[id] ? Promise.resolve(statusDetails[id]) : Promise.reject(new Error(`no fixture detail for ${id}`))),
        })}
      />
    );

    await screen.findByRole("heading", { name: "Visão geral" });
    expect(screen.queryByText("Por validar · Corroborado")).toBeNull();
    expect(screen.queryByText("Por validar · Corroborada")).toBeNull();
    // F01: compact label agrees grammatically with "Evidência" (feminine), not "Corroborado".
    const evidenceChip = await screen.findByText("Evidência:");
    expect(evidenceChip.closest(".prb-status-chip")?.textContent).toMatch(/Evidência:\s*Corroborada/);
    expect(evidenceChip.closest(".prb-status-chip")?.textContent).not.toMatch(/Evidência:\s*Corroborado\b/);
    expect(screen.queryByText("Validação:")).toBeNull();
  });

  it("opens the exact PRB in Problem View when Explore is selected", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/");
    render(<Explorer dataProvider={fakeProvider()} />);

    await user.click(await screen.findByRole("button", { name: /Explorar/ }));
    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });
    expect(window.location.search).toContain("view=problem");
    expect(window.location.search).toContain("id=PRB-0005");
  });

  it("keeps explicit Records navigation available from the root Overview via the header's Registos action", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/");
    render(<Explorer dataProvider={fakeProvider()} />);

    await user.click(await screen.findByRole("button", { name: "Registos", hidden: true }));
    expect(await screen.findByRole("heading", { name: "Registos" })).toBeTruthy();
    expect(within(globalNav()).getByRole("button", { name: "Registos", hidden: true }).getAttribute("aria-current")).toBe("page");
  });
});

describe("Explorer — URL-addressable state", () => {
  it("selecting a record updates the URL with view/id", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));

    expect(window.location.search).toContain("id=PRB-0005");
  });

  it("typing a search query updates the URL without spamming history (replace, not push)", async () => {
    const user = userEvent.setup();
    const pushSpy = vi.spyOn(window.history, "pushState");
    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("button", { name: /PRB-0005/ });

    await user.type(screen.getByLabelText("Pesquisar"), "PRB");

    expect(window.location.search).toContain("q=PRB");
    expect(pushSpy).not.toHaveBeenCalled();
    pushSpy.mockRestore();
  });

  it("does not add history entries for semantically unchanged view or type filter actions", async () => {
    const user = userEvent.setup();
    const pushSpy = vi.spyOn(window.history, "pushState");
    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("button", { name: /PRB-0005/ });

    await user.click(typeFilterButton("Todos"));
    expect(pushSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /PRB-0005/ }));
    expect(pushSpy).toHaveBeenCalledTimes(1);
    pushSpy.mockRestore();
  });

  it("selecting the same already-selected record again (via breadcrumb back, then reselect) adds exactly one further history entry", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    const detailPanel = await getDetailPanel();
    const breadcrumb = within(detailPanel).getByLabelText("Localização");

    const pushSpy = vi.spyOn(window.history, "pushState");
    await user.click(within(breadcrumb).getByRole("button", { name: "Registos" }));
    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    expect(pushSpy).toHaveBeenCalledTimes(2);
    pushSpy.mockRestore();
  });

  it("a URL with view/id/query/type on initial load restores that state (bookmark/reload)", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?view=records&id=PRB-0005&q=PRB&type=PRB-");
    render(<Explorer dataProvider={fakeProvider()} />);

    // The Record Detail composition for id=PRB-0005 renders immediately —
    // query/type are preserved in the URL and surface in the Records
    // controls once the breadcrumb clears the selection.
    await screen.findByText("Estrutura técnica completa");
    expect(window.location.search).toContain("q=PRB");
    expect(window.location.search).toContain("type=PRB-");

    const detailPanel = await getDetailPanel();
    const breadcrumb = within(detailPanel).getByLabelText("Localização");
    await user.click(within(breadcrumb).getByRole("button", { name: "Registos" }));

    expect((await screen.findByLabelText("Pesquisar") as HTMLInputElement).value).toBe("PRB");
    expect(activeTypeFilterLabel()).toBe("Problemas");
  });

  it("browser back restores the previous selection after navigating to a related record", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);

    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    await screen.findByText("Estrutura técnica completa");
    let detailPanel = await getDetailPanel();
    // RD-01G: PRB-0005's outgoing reference to EVD-000105 is owned by Referências canónicas, not Relações no corpus.
    await user.click(await within(within(detailPanel).getByLabelText("Referências canónicas")).findByRole("button", { name: /EVD-000105/ }));
    detailPanel = await getDetailPanel();
    await within(detailPanel).findByText(/Via Verde/);
    expect(window.location.search).toContain("id=EVD-000105");

    window.history.back();
    // jsdom dispatches popstate asynchronously on back(); the URL updates
    // first, then the detail panel re-selects and re-fetches PRB-0005.
    await waitFor(() => expect(window.location.search).toContain("id=PRB-0005"));
    await waitFor(async () => {
      detailPanel = await getDetailPanel();
      expect(within(detailPanel).getByLabelText("Localização").textContent).toContain("PRB-0005");
    });
  });

  it("an invalid/unknown record ID in the URL degrades to a safe, actionable error — not a bypassed fetch", async () => {
    // fakeProvider's getRecord rejects generically for unknown IDs (unlike
    // StaticDataProvider's real invalid_id/not_found distinction, already
    // covered by StaticDataProvider.test.ts) — what this test actually
    // proves is that an arbitrary URL-sourced ID flows through the exact
    // same getRecord() path as any other selection, degrading to a local
    // error rather than crashing or bypassing the provider.
    window.history.replaceState(null, "", "/?view=records&id=PRB-9999-does-not-exist");
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("heading", { level: 3, name: "Falha ao carregar o registo" })).toBeTruthy();
    // V2: Records is reachable again via the breadcrumb, not a persistent table.
    const breadcrumb = screen.getByLabelText("Localização");
    await user.click(within(breadcrumb).getByRole("button", { name: "Registos" }));
    expect(recordsHeading()).toBeTruthy();
    expect(await screen.findByRole("button", { name: /EVD-000105/ })).toBeTruthy();
  });

  it("a stale/unknown type filter in the URL degrades to 'all' rather than breaking the table", async () => {
    window.history.replaceState(null, "", "/?view=records&type=NOPE-");
    render(<Explorer dataProvider={fakeProvider()} />);

    await screen.findByRole("button", { name: /PRB-0005/ });
    expect(activeTypeFilterLabel()).toBe("Todos");
    expect(screen.getByRole("button", { name: /PRB-0005/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /EVD-000105/ })).toBeTruthy();
  });

  describe("Registos — header entry into the complete, unfiltered Records area", () => {
    it("is a single history entry that sets view=records and clears selection, query and type filter (Todos)", async () => {
      const user = userEvent.setup();
      window.history.replaceState(null, "", "/?view=problem&id=PRB-0005&q=stale-query&type=EVD-");
      const pushSpy = vi.spyOn(window.history, "pushState");
      render(<Explorer dataProvider={fakeProvider()} />);
      await screen.findByRole("heading", { name: /Pressão de estacionamento/ });

      await user.click(within(globalNav()).getByRole("button", { name: "Registos", hidden: true }));

      expect(pushSpy).toHaveBeenCalledTimes(1);
      expect(window.location.search).toBe("?view=records");
      expect(await screen.findByRole("heading", { name: "Registos" })).toBeTruthy();
      expect((await screen.findByLabelText("Pesquisar") as HTMLInputElement).value).toBe("");
      expect(activeTypeFilterLabel()).toBe("Todos");
      for (const id of ["PRB-0005", "EVD-000105", "SRC-0092", "WID-0001"]) {
        expect(screen.getByRole("button", { name: new RegExp(id) })).toBeTruthy();
      }
      pushSpy.mockRestore();
    });

    it("from a filtered Records view, returns to Todos", async () => {
      const user = userEvent.setup();
      window.history.replaceState(null, "", "/?view=records&type=SRC-");
      render(<Explorer dataProvider={fakeProvider()} />);
      await screen.findByRole("button", { name: /SRC-0092/ });

      await user.click(within(globalNav()).getByRole("button", { name: "Registos", hidden: true }));

      await waitFor(() => expect(activeTypeFilterLabel()).toBe("Todos"));
      expect(window.location.search).not.toContain("type=");
    });

    it("leaves unrelated existing state (graph depth) untouched", async () => {
      const user = userEvent.setup();
      window.history.replaceState(null, "", "/?view=records&q=PRB&type=PRB-&d=2");
      render(<Explorer dataProvider={fakeProvider()} />);
      await screen.findByRole("button", { name: /PRB-0005/ });

      await user.click(within(globalNav()).getByRole("button", { name: "Registos", hidden: true }));

      await screen.findByRole("heading", { name: "Registos" });
      expect(window.location.search).toContain("d=2");
    });

    it("stays active throughout the Records area — every type filter and Record Detail", async () => {
      const user = userEvent.setup();
      const registos = () => within(globalNav()).getByRole("button", { name: "Registos", hidden: true });
      render(<Explorer dataProvider={fakeProvider()} />);
      await screen.findByRole("button", { name: /PRB-0005/ });
      expect(registos().getAttribute("aria-current")).toBe("page");

      for (const label of ["Problemas", "Fontes", "Evidências", "Todos"]) {
        await user.click(typeFilterButton(label));
        expect(activeTypeFilterLabel()).toBe(label);
        expect(registos().getAttribute("aria-current")).toBe("page");
      }

      await user.click(screen.getByRole("button", { name: /SRC-0092/ }));
      await getDetailPanel();
      expect(registos().getAttribute("aria-current")).toBe("page");
      expect(within(globalNav()).getByRole("button", { name: "Problemas", hidden: true }).getAttribute("aria-current")).toBeNull();
    });

    it("is not active outside the Records area", async () => {
      window.history.replaceState(null, "", "/?view=problem&id=PRB-0005");
      render(<Explorer dataProvider={fakeProvider()} />);
      await screen.findByRole("heading", { name: /Pressão de estacionamento/ });
      expect(within(globalNav()).getByRole("button", { name: "Registos", hidden: true }).getAttribute("aria-current")).toBeNull();
    });
  });

  it("selecting a type filter is a URL-synced push navigation, restorable with browser back", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("button", { name: /PRB-0005/ });

    await user.click(typeFilterButton("Fontes"));
    expect(window.location.search).toContain("type=SRC-");
    expect(screen.getByRole("button", { name: /SRC-0092/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /PRB-0005/ })).toBeNull();

    window.history.back();
    await waitFor(() => expect(activeTypeFilterLabel()).toBe("Todos"));
    expect(window.location.search).not.toContain("type=");
  });
});

// `{ hidden: true }` (visual-completion compact pass, task §2): the global
// nav now lives inside `.explorer-chrome-menu`, collapsed by default (native
// `hidden` attribute) and shown at >=768px only via a CSS override jsdom
// does not evaluate (no layout/media-query engine — see ExplorerHeader.tsx's
// own module doc). These tests exercise routing/business-logic wiring, not
// the disclosure itself (covered separately by ExplorerHeader.test.tsx), so
// hidden elements must be included here exactly as production's own
// >=768px desktop rendering always shows them.
function globalNav(): HTMLElement {
  return screen.getByRole("navigation", { name: "Navegação principal", hidden: true });
}

describe("Explorer — chrome header identity", () => {
  it("renders the Open Évora logo alongside the public chrome navigation", async () => {
    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("button", { name: /PRB-0005/ });

    expect(screen.getAllByAltText("Open Évora").length).toBeGreaterThan(0);
    expect(globalNav()).toBeTruthy();
    expect(within(globalNav()).getByRole("button", { name: "Problemas", hidden: true })).toBeTruthy();
    expect(within(globalNav()).getByRole("link", { name: "Método", hidden: true })).toBeTruthy();
    expect(within(globalNav()).getByRole("button", { name: "Registos", hidden: true })).toBeTruthy();
    expect(within(globalNav()).getByRole("link", { name: "Sobre", hidden: true })).toBeTruthy();
    expect(within(globalNav()).queryByRole("button", { name: "Visão geral" })).toBeNull();
    expect(within(globalNav()).queryByRole("button", { name: "Fontes", hidden: true })).toBeNull();
    expect(within(globalNav()).queryByRole("button", { name: "Grafo" })).toBeNull();
  });

  it("renders Método/Sobre as ordinary pathname links and the CTA as a normal link to Contact", async () => {
    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("button", { name: /PRB-0005/ });

    expect(within(globalNav()).getByRole("link", { name: "Método", hidden: true }).getAttribute("href")).toBe("/methodology");
    expect(within(globalNav()).getByRole("link", { name: "Sobre", hidden: true }).getAttribute("href")).toBe("/about");
    expect(screen.getByRole("link", { name: "Contribuir com evidência", hidden: true }).getAttribute("href")).toBe("/contact");
  });

  it("Problemas' active state covers Overview, Problem detail, and Problem history alike", async () => {
    window.history.replaceState(null, "", "/");
    const { unmount: unmountOverview } = render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("heading", { name: "Visão geral" });
    expect(within(globalNav()).getByRole("button", { name: "Problemas", hidden: true }).getAttribute("aria-current")).toBe("page");
    unmountOverview();

    window.history.replaceState(null, "", "/?view=problem&id=PRB-0005");
    const { unmount: unmountProblem } = render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });
    expect(within(globalNav()).getByRole("button", { name: "Problemas", hidden: true }).getAttribute("aria-current")).toBe("page");
    unmountProblem();

    window.history.replaceState(null, "", "/?view=history&id=PRB-0005");
    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });
    expect(within(globalNav()).getByRole("button", { name: "Problemas", hidden: true }).getAttribute("aria-current")).toBe("page");
  });
});

describe("Explorer — GlobalNav destination semantics (UX-D §1)", () => {
  it("navigating from a selected Problem to global Registos clears selectedId (no hidden-context leak)", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?view=problem&id=PRB-0005");
    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });

    await user.click(within(globalNav()).getByRole("button", { name: "Registos", hidden: true }));

    expect(await screen.findByRole("heading", { name: "Registos" })).toBeTruthy();
    expect(window.location.search).toContain("view=records");
    expect(window.location.search).not.toContain("id=PRB-0005");
    // Records renders its unfiltered list, not Record Detail.
    expect(screen.getByRole("button", { name: /SRC-0092/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /PRB-0005/ })).toBeTruthy();
  });

  it("GlobalNav Problemas / Registos remain fully navigable", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("button", { name: /PRB-0005/ });

    await user.click(within(globalNav()).getByRole("button", { name: "Registos", hidden: true }));
    expect(await screen.findByRole("heading", { name: "Registos" })).toBeTruthy();

    await user.click(within(globalNav()).getByRole("button", { name: "Problemas", hidden: true }));
    await screen.findByRole("heading", { name: "Visão geral" });
    expect(within(globalNav()).getByRole("button", { name: "Problemas", hidden: true }).getAttribute("aria-current")).toBe("page");
  });

  it("navigating from a selected Record Detail to global Problemas clears the hidden selectedId", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    await screen.findByText("Estrutura técnica completa");
    expect(window.location.search).toContain("id=PRB-0005");

    await user.click(within(globalNav()).getByRole("button", { name: "Problemas", hidden: true }));

    await screen.findByRole("heading", { name: "Visão geral" });
    expect(window.location.search).not.toContain("id=PRB-0005");
  });

  it("does not erase existing Records search/type-filter state when navigating away via GlobalNav Problemas and back via browser history", async () => {
    // GlobalNav has no plain "go back to Records as it was" destination —
    // Registos deliberately clears query/type to always open the complete
    // Records area. This proves Problemas' own navigation
    // (clearSelectionAndSetView) doesn't mutate the Records state it left
    // behind; a browser Back still restores it unchanged.
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?view=records&q=PRB&type=PRB-");
    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("button", { name: /PRB-0005/ });

    await user.click(within(globalNav()).getByRole("button", { name: "Problemas", hidden: true }));
    await screen.findByRole("heading", { name: "Visão geral" });

    window.history.back();
    await waitFor(() => expect(window.location.search).toContain("q=PRB"));
    expect((await screen.findByLabelText("Pesquisar") as HTMLInputElement).value).toBe("PRB");
    expect(activeTypeFilterLabel()).toBe("Problemas");
  });

  it("PRB-local Detalhes|Histórico navigation preserves PRB identity, unlike GlobalNav", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    const detailPanel = await getDetailPanel();
    expect(within(detailPanel).queryByRole("navigation", { name: "Vistas do problema" })).toBeNull();

    await user.click(await within(detailPanel).findByRole("button", { name: "Ver página do problema" }));
    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });
    expect(window.location.search).toContain("view=problem");
    expect(window.location.search).toContain("id=PRB-0005");

    const problemNav = await screen.findByRole("navigation", { name: "Vistas do problema" });
    expect(within(problemNav).getByText("Detalhes").getAttribute("aria-current")).toBe("page");
    await user.click(within(problemNav).getByRole("button", { name: "Histórico" }));
    expect(await screen.findByText("Não existe histórico material registado para este problema.")).toBeTruthy();
    expect(window.location.search).toContain("view=history");
    expect(window.location.search).toContain("id=PRB-0005");

    const historyNav = await screen.findByRole("navigation", { name: "Vistas do problema" });
    expect(within(historyNav).getByText("Histórico").getAttribute("aria-current")).toBe("page");
    await user.click(within(historyNav).getByRole("button", { name: "Detalhes" }));
    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });
    expect(window.location.search).toContain("view=problem");
    expect(window.location.search).toContain("id=PRB-0005");
  });

  it("Histórico's Verificar opens the same PRB's Detalhes at its audit section in one history entry", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?view=history&id=PRB-0005");
    render(<Explorer dataProvider={fakeProvider()} />);
    const history = (await screen.findByRole("heading", { level: 2, name: /Pressão de estacionamento/ })).closest("article");
    expect(history?.className).toBe("prb-history-view");

    const pushSpy = vi.spyOn(window.history, "pushState");
    await user.click(screen.getByRole("button", { name: "Verificar" }));
    const audit = await screen.findByRole("region", { name: "Evidência e auditoria" });
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(window.location.search).toContain("view=problem");
    expect(window.location.search).toContain("id=PRB-0005");
    expect(window.location.hash).toBe("#prb-auditoria");
    await waitFor(() => expect(document.activeElement).toBe(audit));
    expect(screen.getByRole("heading", { level: 2, name: /Pressão de estacionamento/ }).closest("article")?.className).toBe("prb-details-view");
  });

  it("browser back after a GlobalNav area change restores the prior area and selection deterministically", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    await screen.findByText("Estrutura técnica completa");

    await user.click(within(globalNav()).getByRole("button", { name: "Problemas", hidden: true }));
    await screen.findByRole("heading", { name: "Visão geral" });

    window.history.back();
    await waitFor(() => expect(window.location.search).toContain("id=PRB-0005"));
    await screen.findByText("Estrutura técnica completa");
  });
});

describe("Explorer — Problem view (RE-03)", () => {
  it("opens a problem directly via URL into the PRB Details surface, without visiting Records first", async () => {
    window.history.replaceState(null, "", "/?view=problem&id=PRB-0005");
    render(<Explorer dataProvider={fakeProvider(withOpenQuestionEvidence())} />);

    const title = await screen.findByRole("heading", { level: 2, name: /Pressão de estacionamento/ });
    expect(title.id).toBe("prb-identity-title");
    expect(title.closest("article")?.className).toBe("prb-details-view");
    expect(screen.getByRole("region", { name: "O que ainda não sabemos" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Evidência e auditoria" })).toBeTruthy();
    // The retired Problem View presentation is gone from the public route.
    expect(document.querySelector(".problem-view, .problem-reading-rail, #problem-evidencia")).toBeNull();
  });

  it("the PRB Record Detail 'Ver página do problema' action switches to the Problem view for the same ID", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);

    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    const detailPanel = await getDetailPanel();
    await user.click(await within(detailPanel).findByRole("button", { name: "Ver página do problema" }));

    const heading = await screen.findByRole("heading", { name: /Pressão de estacionamento/ });
    expect(window.location.search).toContain("view=problem");
    expect(window.location.search).toContain("id=PRB-0005");
    expect(document.title).toBe("Problema PRB-0005 — Explorador de Investigação Open Évora");
    expect(document.activeElement).toBe(heading);
  });

  it("UX-F: a direct Graph URL with a valid PRB id normalizes to that PRB's Problem view, not Graph", async () => {
    window.history.replaceState(null, "", "/?view=graph&id=PRB-0005");
    render(<Explorer dataProvider={fakeProvider()} />);

    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });
    expect(screen.queryByRole("heading", { name: "Grafo", level: 2 })).toBeNull();
    expect(window.location.search).toContain("view=problem");
    expect(window.location.search).toContain("id=PRB-0005");
  });

  it("UX-F: a direct Graph URL without a usable PRB selection normalizes to Overview, not Graph", async () => {
    window.history.replaceState(null, "", "/?view=graph");
    render(<Explorer dataProvider={fakeProvider()} />);

    await screen.findByRole("heading", { name: "Visão geral" });
    expect(screen.queryByRole("heading", { name: "Grafo", level: 2 })).toBeNull();
    expect(window.location.search).not.toContain("view=graph");
  });

  it("UX-F: a direct Graph URL for a non-PRB id also normalizes to Overview, dropping the id", async () => {
    window.history.replaceState(null, "", "/?view=graph&id=EVD-000105");
    render(<Explorer dataProvider={fakeProvider()} />);

    await screen.findByRole("heading", { name: "Visão geral" });
    expect(window.location.search).not.toContain("view=graph");
    expect(window.location.search).not.toContain("id=EVD-000105");
  });

  it("UX-F: a stale/unknown PRB-shaped Graph URL still normalizes to Problem view, which then shows its own not-found recovery", async () => {
    window.history.replaceState(null, "", "/?view=graph&id=PRB-9999-does-not-exist");
    render(<Explorer dataProvider={fakeProvider()} />);

    await waitFor(() => expect(window.location.search).toContain("view=problem"));
    expect(screen.queryByRole("heading", { name: "Grafo", level: 2 })).toBeNull();
  });

  it("UX-F: browser Back/Forward across a normalized Graph URL stays deterministic and never lands on Graph", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    await screen.findByText("Estrutura técnica completa");

    window.history.pushState(null, "", "/?view=graph&id=PRB-0005");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });
    expect(window.location.search).toContain("view=problem");

    window.history.back();
    await waitFor(() => expect(window.location.search).not.toContain("view=problem"));
    expect(screen.queryByRole("heading", { name: "Grafo", level: 2 })).toBeNull();

    window.history.forward();
    await waitFor(() => expect(window.location.search).toContain("view=problem"));
    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });
    expect(screen.queryByRole("heading", { name: "Grafo", level: 2 })).toBeNull();
  });

  it("UX-D §2: Problem View's breadcrumb points to Visão geral (not Registos), clearing the selected id", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?q=PRB-0005&view=problem&id=PRB-0005");
    render(<Explorer dataProvider={fakeProvider()} />);

    // Problem View is a public problem-reading surface, not conceptually a
    // child of Records — its breadcrumb reads "Visão geral › PRB-0005", and
    // its first action returns to Overview, clearing the selection outright.
    const problemBreadcrumb = await screen.findByLabelText("Localização");
    expect(within(problemBreadcrumb).queryByRole("button", { name: "Registos" })).toBeNull();
    await user.click(within(problemBreadcrumb).getByRole("button", { name: "Visão geral" }));

    await screen.findByRole("heading", { name: "Visão geral" });
    expect(window.location.search).not.toContain("view=problem");
    expect(window.location.search).not.toContain("id=PRB-0005");
  });

  it("generic Record Detail's breadcrumb remains Registos-based, unlike Problem View's", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await user.click(await screen.findByRole("button", { name: /EVD-000105/ }));

    const detailPanel = await getDetailPanel();
    const breadcrumb = within(detailPanel).getByLabelText("Localização");
    expect(within(breadcrumb).getByRole("button", { name: "Registos" })).toBeTruthy();
    expect(within(breadcrumb).queryByRole("button", { name: "Visão geral" })).toBeNull();
  });

  it("Problem View's PRB-local navigation offers only Detalhes|Histórico — generic Record Detail is not a PRB-local destination", async () => {
    window.history.replaceState(null, "", "/?view=problem&id=PRB-0005");
    render(<Explorer dataProvider={fakeProvider()} />);

    const nav = await screen.findByRole("navigation", { name: "Vistas do problema" });
    expect(nav.textContent).toBe("DetalhesHistórico");
    expect(within(nav).queryByRole("button", { name: "Detalhe" })).toBeNull();
    expect(within(nav).queryByRole("button", { name: "Problema" })).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("a Problem-view URL survives reload (bookmark/share)", async () => {
    window.history.replaceState(null, "", "/?view=problem&id=PRB-0005");
    const { unmount } = render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });
    unmount();

    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });
  });

  it("clicking a related Evidence identifier in PRB Details opens it through the generic Records detail", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?view=problem&id=PRB-0005");
    render(<Explorer dataProvider={fakeProvider(withOpenQuestionEvidence())} />);

    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });
    const openQuestions = screen.getByRole("region", { name: "O que ainda não sabemos" });
    await user.click(within(openQuestions).getByRole("button", { name: "Abrir EVD-000105" }));

    // V2: opens the Record Detail composition for EVD-000105 (Records view,
    // not Problem view) — not the Records table, since a record is selected.
    const detailPanel = await getDetailPanel();
    await within(detailPanel).findByText(/Via Verde/);
    expect(window.location.search).toContain("id=EVD-000105");
    expect(window.location.search).not.toContain("view=problem");
  });

  it("UX-C: the global reading guide is absent on Records, including Record Detail", async () => {
    window.history.replaceState(null, "", "/?view=records");
    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("button", { name: /PRB-0005/ });
    expect(screen.queryByText("Como ler o Explorer")).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /PRB-0005/ }));
    await screen.findByText("Estrutura técnica completa");
    expect(screen.queryByText("Como ler o Explorer")).toBeNull();
  });

  it("UX-C: the global reading guide is absent on Problem View", async () => {
    window.history.replaceState(null, "", "/?view=problem&id=PRB-0005");
    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });
    expect(screen.queryByText("Como ler o Explorer")).toBeNull();
  });

  // UX-F: Graph is temporarily unavailable — a "/?view=graph" URL now
  // normalizes to Overview (see the "UX-F" describe block above), so the
  // reading guide's Graph-specific rendering is no longer publicly
  // reachable through Explorer. The guide's own conditional logic is
  // untouched; GraphExplorer.test.tsx / graph/* tests continue to exercise
  // it directly at the component level.

  it("UX-C: PRB Details does not link to a #reading-guide that doesn't exist on this surface", async () => {
    window.history.replaceState(null, "", "/?view=problem&id=PRB-0005");
    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });

    expect(screen.queryByRole("link", { name: /Orientação completa do Explorer/ })).toBeNull();
    expect(document.querySelector('a[href="#reading-guide"]')).toBeNull();
  });
});

describe("Explorer — global manifest summary placement", () => {
  const manifestProps = { totalRecords: 4, generatedAt: "2026-09-01T10:00:00Z" };
  const manifestSummary = () => document.querySelector(".manifest-summary");

  it("is absent on PRB Details, whose audit band is the terminal content band", async () => {
    window.history.replaceState(null, "", "/?view=problem&id=PRB-0005");
    render(<Explorer dataProvider={fakeProvider()} {...manifestProps} />);
    await screen.findByRole("region", { name: "Evidência e auditoria" });
    expect(manifestSummary()).toBeNull();
    expect(screen.queryByText(/Corpus:/)).toBeNull();
  });

  it("is absent on Overview", async () => {
    window.history.replaceState(null, "", "/");
    render(<Explorer dataProvider={fakeProvider()} {...manifestProps} />);
    await screen.findByRole("heading", { name: "Visão geral" });
    expect(manifestSummary()).toBeNull();
  });

  it("is absent on the Records landing, whose pagination row is the terminal content band, and present on Record Detail", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} {...manifestProps} />);
    await screen.findByRole("button", { name: /PRB-0005/ });
    expect(manifestSummary()).toBeNull();
    await user.click(screen.getByRole("button", { name: /EVD-000105/ }));
    await getDetailPanel();
    expect(manifestSummary()?.textContent).toContain("Corpus: 4 registos");
  });

  it("is absent on PRB Histórico, whose material-history section is the terminal content band", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?view=problem&id=PRB-0005");
    render(<Explorer dataProvider={fakeProvider()} {...manifestProps} />);
    const nav = await screen.findByRole("navigation", { name: "Vistas do problema" });
    expect(manifestSummary()).toBeNull();
    await user.click(within(nav).getByRole("button", { name: "Histórico" }));
    await screen.findByText("Não existe histórico material registado para este problema.");
    expect(window.location.search).toContain("view=history");
    expect(manifestSummary()).toBeNull();
    expect(screen.queryByText(/Corpus:/)).toBeNull();
  });
});

/**
 * F03: Overview owns important discovery context (search, topic filter, the
 * `Alterados esta semana` shortcut, sort order, current page) that used to
 * live as `Overview`'s own local `useState` — reset on every remount.
 * Opening a PRB unmounts Overview (Explorer switches to view=problem);
 * returning (browser Back, or the Problem breadcrumb's "Visão geral") used
 * to mount a fresh Overview instance with that context lost. This state now
 * lives in `Explorer` (`useOverviewDiscoveryState`, overview/Overview.tsx),
 * which stays mounted across the switch, so it survives. A bounded synthetic
 * fixture (30 PRBs across two topics, `PRB-0021` on) exercises a second page
 * — the shared `INDEX`/`DETAILS` fixtures above are too small for that,
 * never canonical research data.
 */
describe("Explorer — Overview discovery-context preservation across Problem navigation (F03)", () => {
  function makeDiscoveryProblems(count: number): { index: RecordSummary[]; details: Record<string, RecordDetail> } {
    const index: RecordSummary[] = [];
    const details: Record<string, RecordDetail> = {};
    const today = new Date().toISOString().slice(0, 10);
    for (let i = 1; i <= count; i += 1) {
      const id = `PRB-${String(i).padStart(4, "0")}`;
      const domain = i % 2 === 0 ? "PUB" : "MOB";
      const title = i === 1 ? "Pressão de estacionamento em Évora" : `Problema sintético ${String(i).padStart(2, "0")}`;
      index.push({ id, type: "PRB-", label: title, file: "", summaryFields: {} });
      details[id] = {
        id,
        type: "PRB-",
        file: "",
        // PRB-0001 alone carries a this-week material change, so the
        // `Alterados esta semana` shortcut (test C below) has exactly one
        // real result to open, rather than filtering to zero.
        record: { title, domain: [domain], history: i === 1 ? [{ date: today, summary: "Alteração desta semana." }] : undefined },
        outgoingEdges: [],
        incomingEdges: [],
      };
    }
    return { index, details };
  }

  function discoveryProvider(count: number): DataProvider {
    const { index, details } = makeDiscoveryProblems(count);
    return {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.resolve(index),
      getRecord: (id: string) => (details[id] ? Promise.resolve(details[id]) : Promise.reject(new Error(`no fixture detail for ${id}`))),
      getEdges: () => Promise.resolve([]),
    };
  }

  function overviewDrawer() {
    return screen.getByRole("button", { name: /^Filtros/ });
  }

  /** Configures search + topic filter + sort in the open Overview, leaving a non-default, non-page-1 state ready to assert against after returning. */
  async function configureOverviewDiscovery(user: ReturnType<typeof userEvent.setup>) {
    await screen.findByText("30 problemas");
    await user.type(screen.getByLabelText("Pesquisar problemas"), "sintético");
    await user.click(overviewDrawer());
    const drawer = screen.getByRole("group", { name: "Filtrar por tema" });
    await user.click(within(drawer).getByRole("button", { name: /^Mobilidade/ }));
    await user.selectOptions(screen.getByLabelText("Ordenar por"), "Identificador ↑");
  }

  it("A: preserves search/filter/sort across Overview -> PRB -> browser Back", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/");
    render(<Explorer dataProvider={discoveryProvider(30)} />);

    await configureOverviewDiscovery(user);
    const search = screen.getByLabelText("Pesquisar problemas") as HTMLInputElement;
    expect(search.value).toBe("sintético");

    await user.click(screen.getAllByRole("button", { name: /Explorar/ })[0]);
    await screen.findByRole("heading", { name: /Problema sintético/ });

    window.history.back();
    await screen.findByRole("heading", { name: "Visão geral" });

    expect((screen.getByLabelText("Pesquisar problemas") as HTMLInputElement).value).toBe("sintético");
    // The category drawer's own open/closed state is transient presentation
    // state (never preserved, per F03's scope) — the restored active
    // category is asserted via Filtros' own restrained active-state naming
    // (existing behaviour, Overview.test.tsx's "gives Filtros a restrained
    // active state" case) rather than by reaching into a collapsed drawer.
    expect(screen.getByRole("button", { name: /Filtros — Mobilidade/ })).toBeTruthy();
    expect((screen.getByLabelText("Ordenar por") as HTMLSelectElement).value).toBe("id");
  });

  it("B: preserves search/filter/sort across Overview -> PRB -> the Problem breadcrumb's Visão geral", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/");
    render(<Explorer dataProvider={discoveryProvider(30)} />);

    await configureOverviewDiscovery(user);

    await user.click(screen.getAllByRole("button", { name: /Explorar/ })[0]);
    await screen.findByRole("heading", { name: /Problema sintético/ });

    const breadcrumb = screen.getByLabelText("Localização");
    await user.click(within(breadcrumb).getByRole("button", { name: "Visão geral" }));
    await screen.findByRole("heading", { name: "Visão geral" });

    expect((screen.getByLabelText("Pesquisar problemas") as HTMLInputElement).value).toBe("sintético");
    expect(screen.getByRole("button", { name: /Filtros — Mobilidade/ })).toBeTruthy();
    expect((screen.getByLabelText("Ordenar por") as HTMLSelectElement).value).toBe("id");
  });

  it("C: preserved topic/weekly-shortcut mutual exclusion survives the round trip", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/");
    render(<Explorer dataProvider={discoveryProvider(30)} />);

    await screen.findByText("30 problemas");
    await user.click(overviewDrawer());
    const drawer = screen.getByRole("group", { name: "Filtrar por tema" });
    await user.click(within(drawer).getByRole("button", { name: /^Alterados esta semana/ }));
    expect(screen.getByRole("button", { name: /^Alterados esta semana/ }).getAttribute("aria-pressed")).toBe("true");
    await screen.findByText("1 problemas");

    await user.click(screen.getAllByRole("button", { name: /Explorar/ })[0]);
    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });

    window.history.back();
    await screen.findByRole("heading", { name: "Visão geral" });

    // The shortcut selection survived the round trip (asserted via Filtros'
    // own restrained active-state naming, since the drawer itself is
    // transient/collapsed again on remount — see test A's own comment);
    // selecting a normal topic must still clear it, exactly as before
    // Overview ever unmounted.
    expect(screen.getByRole("button", { name: /Filtros — Alterados esta semana/ })).toBeTruthy();
    await user.click(overviewDrawer());
    const reopenedDrawer = screen.getByRole("group", { name: "Filtrar por tema" });
    expect(within(reopenedDrawer).getByRole("button", { name: /^Alterados esta semana/ }).getAttribute("aria-pressed")).toBe("true");

    await user.click(within(reopenedDrawer).getByRole("button", { name: /^Mobilidade/ }));
    expect(screen.getByRole("button", { name: /^Alterados esta semana/ }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: /^Mobilidade/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("D: a preserved-upstream discovery-input change still resets pagination to page 1", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/");
    render(<Explorer dataProvider={discoveryProvider(30)} />);

    await screen.findByText("30 problemas");
    await user.click(screen.getByRole("button", { name: "Seguinte" }));
    await screen.findByText(/^Página 2 de 2/);

    await user.click(screen.getAllByRole("button", { name: /Explorar/ })[0]);
    await screen.findByRole("heading", { name: /Problema/ });
    window.history.back();
    await screen.findByRole("heading", { name: "Visão geral" });

    // Page 2 itself survived the round trip (page is part of the preserved
    // discovery context)...
    await screen.findByText(/^Página 2 de 2/);

    // ...but changing a preserved upstream input (search) still resets to
    // page 1 — the existing page-reset rule keeps applying to the lifted
    // state exactly as it did to Overview's own former local state.
    await user.type(screen.getByLabelText("Pesquisar problemas"), "sintético");
    await screen.findByText(/^Página 1 de/);
  });
});

/**
 * F08: `useExplorerUrlState`'s own normalization (correcting the address bar
 * to the canonical serialized query string, via replaceState) reconstructs
 * the URL from pathname+search alone — naively dropping any existing
 * `window.location.hash` in the process. A direct deep link like
 * `?id=EVD-000105&view=records#evd-limits` can have its query param order
 * canonicalized before the asynchronously rendered `#evd-limits` target is
 * ready, silently losing the fragment before F07's applyInitialFragment ever
 * gets a chance to use it. See useExplorerUrlState.ts's own F08 doc comment
 * for the same-location-vs-genuine-navigation distinction these tests cover.
 */
describe("Explorer — URL normalization preserves window.location.hash (F08)", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("preserves a valid hash while normalizing reordered query parameters on initial load", async () => {
    window.history.replaceState(null, "", "/?id=EVD-000105&view=records#evd-limits");
    render(<Explorer dataProvider={fakeProvider()} />);

    await screen.findByText(/Via Verde/);
    expect(window.location.hash).toBe("#evd-limits");
    // The query itself was still canonicalized (view before id) — the
    // normalization actually ran, this isn't merely an untouched URL.
    expect(window.location.search.indexOf("view=")).toBeLessThan(window.location.search.indexOf("id="));
  });

  it("preserves a valid hash while UX-F's view=graph normalization rewrites the query", async () => {
    window.history.replaceState(null, "", "/?view=graph&id=PRB-0005#prb-auditoria");
    render(<Explorer dataProvider={fakeProvider()} />);

    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });
    expect(window.location.search).toContain("view=problem");
    expect(window.location.hash).toBe("#prb-auditoria");
  });

  it("preserves a valid hash across a popstate-driven normalization", async () => {
    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("button", { name: /PRB-0005/ });

    window.history.pushState(null, "", "/?id=EVD-000105&view=records#evd-limits");
    window.location.hash = "#evd-limits";
    window.dispatchEvent(new PopStateEvent("popstate"));

    await waitFor(() => expect(window.location.search.indexOf("view=")).toBeLessThan(window.location.search.indexOf("id=")));
    expect(window.location.hash).toBe("#evd-limits");
  });

  it("typing a search query (replace, same-context refinement) preserves an existing hash", async () => {
    window.history.replaceState(null, "", "/?view=records#evd-limits");
    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("button", { name: /PRB-0005/ });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Pesquisar"), "PRB");

    expect(window.location.search).toContain("q=PRB");
    expect(window.location.hash).toBe("#evd-limits");
  });

  it("a genuine navigation to a different record (push) does not carry over an unrelated stale fragment", async () => {
    window.history.replaceState(null, "", "/?view=records#evd-limits");
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);

    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    await screen.findByText("Estrutura técnica completa");

    expect(window.location.search).toContain("id=PRB-0005");
    expect(window.location.hash).toBe("");
  });

  /**
   * F07 + F08 end-to-end invariant: a direct PRB deep link's
   * `URL query + #section` must survive (1) URL parsing, (2) URL
   * normalization, (3) asynchronous PRB loading, (4) initial fragment
   * application, and (5) default focus management, ending with the
   * requested section focused/scrolled — never overridden by the generic
   * heading-focus fallback, and never lost to F08's own normalization along
   * the way. The un-normalized param order (`id` before `view`) exercises
   * both bugs' real-world trigger at once.
   */
  it("a direct PRB deep link with a reordered query and a section fragment ends with that section focused, not the heading", async () => {
    window.history.replaceState(null, "", "/?id=PRB-0005&view=problem#prb-auditoria");
    render(<Explorer dataProvider={fakeProvider()} />);

    const auditSection = await screen.findByRole("region", { name: "Evidência e auditoria" });
    await waitFor(() => expect(document.activeElement).toBe(auditSection));

    // (2) normalization ran (canonical view-before-id order) without (8)
    // losing the fragment, and (5) the heading was never the final focus.
    expect(window.location.search.indexOf("view=")).toBeLessThan(window.location.search.indexOf("id="));
    expect(window.location.hash).toBe("#prb-auditoria");
    expect(document.activeElement).not.toBe(screen.getByRole("heading", { name: /Pressão de estacionamento/ }));
  });

  it("a direct PRB deep link with a retired Problem View fragment keeps the URL hash but focuses the PRB title", async () => {
    window.history.replaceState(null, "", "/?view=problem&id=PRB-0005#problem-evidencia");
    render(<Explorer dataProvider={fakeProvider()} />);

    const title = await screen.findByRole("heading", { level: 2, name: /Pressão de estacionamento/ });
    await waitFor(() => expect(document.activeElement).toBe(title));
    expect(window.location.hash).toBe("#problem-evidencia");
  });
});

describe("Explorer workflow — never loads edges.json or canonical YAML (real StaticDataProvider)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("index.json")) {
        return Promise.resolve(new Response(JSON.stringify(INDEX), { status: 200 }));
      }
      const match = /record-detail\/([^/]+)\.json$/.exec(url);
      if (match) {
        const detail = DETAILS[decodeURIComponent(match[1])];
        return Promise.resolve(
          detail ? new Response(JSON.stringify(detail), { status: 200 }) : new Response(null, { status: 404 })
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("selecting and navigating records never issues a fetch for edges.json or research/**/*.yaml", async () => {
    const user = userEvent.setup();
    const provider = new StaticDataProvider();
    render(<Explorer dataProvider={provider} />);

    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    await screen.findByText("Estrutura técnica completa");
    let detailPanel = await getDetailPanel();
    // RD-01G: PRB-0005's outgoing reference to EVD-000105 is owned by Referências canónicas, not Relações no corpus.
    await user.click(await within(within(detailPanel).getByLabelText("Referências canónicas")).findByRole("button", { name: /EVD-000105/ }));
    detailPanel = await getDetailPanel();
    await within(detailPanel).findByText(/Via Verde/);

    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(requestedUrls.some((u) => u.includes("edges.json"))).toBe(false);
    expect(requestedUrls.some((u) => u.endsWith(".yaml"))).toBe(false);
    expect(requestedUrls.some((u) => u.includes("research/"))).toBe(false);
  });
});
