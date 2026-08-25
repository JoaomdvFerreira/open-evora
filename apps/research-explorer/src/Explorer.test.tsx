import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Explorer } from "./Explorer";
import { StaticDataProvider } from "./dataProvider/StaticDataProvider";
import type { DataProvider, RecordDetail, RecordSummary } from "./dataProvider/types";

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
    record: { title: "Pressão de estacionamento com uma descrição canónica completa que não pode ser truncada", domain: ["mobility"], evidence: ["EVD-000105"] },
    outgoingEdges: [{ field: "evidence", ordinal: 0, to: "EVD-000105" }],
    incomingEdges: [],
  },
  "EVD-000105": {
    id: "EVD-000105",
    type: "EVD-",
    file: "research/evidence/EVD-000105.yaml",
    record: { type: "institutional", observation: { summary: "Fixture" } },
    outgoingEdges: [{ field: "source.source_id", ordinal: null, to: "SRC-0092" }],
    incomingEdges: [{ field: "evidence", ordinal: 0, from: "PRB-0005" }],
  },
  "SRC-0092": {
    id: "SRC-0092",
    type: "SRC-",
    file: "research/sources/SRC-0092.yaml",
    record: { publisher: "Via Verde", name: "Estacionar" },
    outgoingEdges: [],
    incomingEdges: [{ field: "source.source_id", ordinal: null, from: "EVD-000105" }],
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

  it("resolves outgoing relationships to related summary labels from the index", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));

    const detailPanel = (await screen.findByText("Detalhes")).closest("section")!;
    // PRB Relações (RD-01D) groups by direction with unique record entries, without repeating field-path notation — the resolved label still appears under "Referências de saída".
    const relacoes = within(detailPanel).getByLabelText("Relações");
    const relationsBoundary = within(relacoes).getByLabelText("Relações no corpus");
    await within(relationsBoundary).findByText(/EVD-000105 — Via Verde Parking Buddy/);
    expect(within(relationsBoundary).getByText(/Referências de saída/)).toBeTruthy();
  });

  it("resolves incoming relationships to related summary labels from the index", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));

    let detailPanel = await getDetailPanel();
    const relations = within(detailPanel).getByLabelText("Relações");
    const outgoingButton = await within(relations).findByRole("button", { name: /EVD-000105/ });
    await user.click(outgoingButton);

    detailPanel = await getDetailPanel();
    await within(detailPanel).findByText(/PRB-0005 — Pressão de estacionamento/);
    expect(within(detailPanel).getByText(/referenciado através de/)).toBeTruthy();
  });

  it("navigates PRB-0005 -> EVD-000105 -> SRC-0092, each step reachable back to Registos via the breadcrumb", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);

    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    await screen.findByText("Estrutura técnica completa");

    let detailPanel = await getDetailPanel();
    await user.click(await within(within(detailPanel).getByLabelText("Relações")).findByRole("button", { name: /EVD-000105/ }));
    detailPanel = await getDetailPanel();
    await within(detailPanel).findByText(/Via Verde/);

    await user.click(await within(within(detailPanel).getByLabelText("Relações")).findByRole("button", { name: /SRC-0092/ }));

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
    expect(screen.getByText("Problemas em investigação (1)")).toBeTruthy();
    expect(screen.getByText(/1 problema em investigação · 1 registo de evidência/)).toBeTruthy();
    expect(await screen.findByText("Pressão de estacionamento com uma descrição canónica completa que não pode ser truncada")).toBeTruthy();
    expect(screen.getByRole("list")).toBeTruthy();
    expect(screen.queryByText("Pressão de estacionamento com uma descrição…")).toBeNull();
    expect(screen.queryByText("Via Verde Parking Buddy")).toBeNull();
    expect(screen.getByText(/Não representa a Câmara Municipal de Évora/)).toBeTruthy();
    expect(screen.getByText("ordenados por identificador, não por relevância")).toBeTruthy();
    expect(screen.queryByText("Como ler o Explorer")).toBeNull();
    expect(screen.queryByText(/Estado de validação:/)).toBeNull();
    expect(screen.queryByText(/Estado da evidência:/)).toBeNull();
    expect(screen.getByRole("button", { name: "Visão geral" }).getAttribute("aria-current")).toBe("page");
  });

  it("UX-D §4: renders Validação and Evidência as two explicitly labeled dimensions, not an unlabeled combination", async () => {
    const statusIndex: RecordSummary[] = [
      {
        id: "PRB-0005",
        type: "PRB-",
        label: "Pressão de estacionamento com uma descrição…",
        file: "research/problems/PRB-0005.yaml",
        summaryFields: { status: "OPEN", validation_status: "unvalidated", evidence_status: "corroborated" },
      },
    ];
    window.history.replaceState(null, "", "/");
    render(<Explorer dataProvider={fakeProvider({ listRecords: () => Promise.resolve(statusIndex) })} />);

    await screen.findByRole("heading", { name: "Visão geral" });
    expect(screen.queryByText("Por validar · Corroborado")).toBeNull();
    expect(screen.queryByText("Por validar · Corroborada")).toBeNull();
    expect(await screen.findByText(/Validação: Por validar/)).toBeTruthy();
    // F01: compact label agrees grammatically with "Evidência" (feminine), not "Corroborado".
    expect(screen.getByText(/Evidência: Corroborada/)).toBeTruthy();
    expect(screen.queryByText(/Evidência: Corroborado\b/)).toBeNull();
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

  it("keeps explicit Records navigation available from the root Overview", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/");
    render(<Explorer dataProvider={fakeProvider()} />);

    await user.click(await screen.findByRole("button", { name: "Registos" }));
    expect(await screen.findByRole("heading", { name: "Registos" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Registos" }).getAttribute("aria-current")).toBe("page");
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

    await user.click(screen.getByRole("button", { name: "Registos" }));
    await user.selectOptions(screen.getByLabelText("Tipo"), "all");
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
    expect((screen.getByLabelText("Tipo") as HTMLSelectElement).value).toBe("PRB-");
  });

  it("browser back restores the previous selection after navigating to a related record", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);

    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    await screen.findByText("Estrutura técnica completa");
    let detailPanel = await getDetailPanel();
    await user.click(await within(within(detailPanel).getByLabelText("Relações")).findByRole("button", { name: /EVD-000105/ }));
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
    expect(within(alert).getByRole("heading")).toBeTruthy();
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
    expect((screen.getByLabelText("Tipo") as HTMLSelectElement).value).toBe("all");
    expect(screen.getByRole("button", { name: /PRB-0005/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /EVD-000105/ })).toBeTruthy();
  });
});

function globalNav(): HTMLElement {
  return screen.getByRole("navigation", { name: "Vistas do Explorador de Investigação" });
}

describe("Explorer — GlobalNav destination semantics (UX-D §1)", () => {
  it("navigating from a selected Problem to global Registos clears selectedId (no hidden-context leak)", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?view=problem&id=PRB-0005");
    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });

    await user.click(within(globalNav()).getByRole("button", { name: "Registos" }));

    expect(await screen.findByRole("heading", { name: "Registos" })).toBeTruthy();
    expect(window.location.search).toContain("view=records");
    expect(window.location.search).not.toContain("id=PRB-0005");
    // Records renders its table, not a still-selected Record Detail.
    expect(screen.getByRole("button", { name: /PRB-0005/ })).toBeTruthy();
  });

  it("UX-F: GlobalNav Grafo is visible, focusable, and aria-disabled — activation cannot navigate away from the current Problem view", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?view=problem&id=PRB-0005");
    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });

    const grafoButton = within(globalNav()).getByRole("button", { name: "Grafo" }) as HTMLButtonElement;
    // Not natively `disabled` — must remain reachable by keyboard (Tab) so
    // a keyboard user can discover the "Em desenvolvimento" explanation at all.
    expect(grafoButton.disabled).toBe(false);
    expect(grafoButton.getAttribute("aria-disabled")).toBe("true");
    expect(grafoButton.getAttribute("title")).toBe("Em desenvolvimento");

    // UX-F accessibility fix: `title` alone isn't reliably exposed to keyboard
    // focus, so the explanation must also be reachable via aria-describedby,
    // pointing at a real, non-empty, on-page element with that text.
    const describedById = grafoButton.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    const grafoNote = document.getElementById(describedById!);
    expect(grafoNote).not.toBeNull();
    expect(grafoNote!.textContent).toBe("Em desenvolvimento");

    grafoButton.focus();
    expect(document.activeElement).toBe(grafoButton);

    await user.click(grafoButton);
    expect(screen.queryByRole("heading", { name: "Grafo", level: 2 })).toBeNull();
    expect(window.location.search).toContain("view=problem");
    expect(window.location.search).toContain("id=PRB-0005");

    await user.keyboard("{Enter}");
    expect(screen.queryByRole("heading", { name: "Grafo", level: 2 })).toBeNull();
    expect(window.location.search).toContain("view=problem");
    expect(window.location.search).toContain("id=PRB-0005");

    await user.keyboard(" ");
    expect(screen.queryByRole("heading", { name: "Grafo", level: 2 })).toBeNull();
    expect(window.location.search).toContain("view=problem");
    expect(window.location.search).toContain("id=PRB-0005");
  });

  it("UX-F: GlobalNav Visão geral / Registos remain fully navigable, unaffected by Grafo's aria-disabled state", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("button", { name: /PRB-0005/ });

    await user.click(within(globalNav()).getByRole("button", { name: "Registos" }));
    expect(await screen.findByRole("heading", { name: "Registos" })).toBeTruthy();

    await user.click(within(globalNav()).getByRole("button", { name: "Visão geral" }));
    await screen.findByRole("heading", { name: "Visão geral" });
    expect(within(globalNav()).getByRole("button", { name: "Visão geral" }).getAttribute("aria-current")).toBe("page");
  });

  it("navigating from a selected Record Detail to global Visão geral clears the hidden selectedId", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    await screen.findByText("Estrutura técnica completa");
    expect(window.location.search).toContain("id=PRB-0005");

    await user.click(within(globalNav()).getByRole("button", { name: "Visão geral" }));

    await screen.findByRole("heading", { name: "Visão geral" });
    expect(window.location.search).not.toContain("id=PRB-0005");
  });

  it("does not erase existing Records search/type-filter state when navigating away and back via GlobalNav", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?view=records&q=PRB&type=PRB-");
    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("button", { name: /PRB-0005/ });

    await user.click(within(globalNav()).getByRole("button", { name: "Visão geral" }));
    await screen.findByRole("heading", { name: "Visão geral" });
    await user.click(within(globalNav()).getByRole("button", { name: "Registos" }));

    expect((await screen.findByLabelText("Pesquisar") as HTMLInputElement).value).toBe("PRB");
    expect((screen.getByLabelText("Tipo") as HTMLSelectElement).value).toBe("PRB-");
  });

  it("ContextTabs continue preserving PRB identity across Detalhe/Problema, unlike GlobalNav", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    const detailPanel = await getDetailPanel();
    const switcher = await within(detailPanel).findByRole("navigation", { name: /PRB-0005/ });

    await user.click(within(switcher).getByRole("button", { name: "Problema" }));
    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });
    expect(window.location.search).toContain("id=PRB-0005");

    const problemSwitcher = await screen.findByRole("navigation", { name: /PRB-0005/ });
    await user.click(within(problemSwitcher).getByRole("button", { name: "Detalhe" }));
    const backDetailPanel = await getDetailPanel();
    const backBreadcrumb = within(backDetailPanel).getByLabelText("Localização");
    await within(backBreadcrumb).findByText("PRB-0005");
    expect(window.location.search).toContain("id=PRB-0005");
  });

  it("UX-F: PRB ContextTabs Grafo is visible, focusable, and aria-disabled — activation cannot navigate to Graph", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    const detailPanel = await getDetailPanel();
    const switcher = await within(detailPanel).findByRole("navigation", { name: /PRB-0005/ });

    const grafoTab = within(switcher).getByRole("button", { name: "Grafo" }) as HTMLButtonElement;
    expect(grafoTab.disabled).toBe(false);
    expect(grafoTab.getAttribute("aria-disabled")).toBe("true");
    expect(grafoTab.getAttribute("title")).toBe("Em desenvolvimento");

    // UX-F accessibility fix: aria-describedby must resolve to a real,
    // non-empty, on-page element carrying the explanation text.
    const describedById = grafoTab.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    const grafoNote = document.getElementById(describedById!);
    expect(grafoNote).not.toBeNull();
    expect(grafoNote!.textContent).toBe("Em desenvolvimento");

    grafoTab.focus();
    expect(document.activeElement).toBe(grafoTab);

    await user.click(grafoTab);
    expect(screen.queryByRole("heading", { name: "Grafo", level: 2 })).toBeNull();
    let stillDetailPanel = await getDetailPanel();
    let breadcrumb = within(stillDetailPanel).getByLabelText("Localização");
    await within(breadcrumb).findByText("PRB-0005");

    grafoTab.focus();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("heading", { name: "Grafo", level: 2 })).toBeNull();
    stillDetailPanel = await getDetailPanel();
    breadcrumb = within(stillDetailPanel).getByLabelText("Localização");
    await within(breadcrumb).findByText("PRB-0005");

    grafoTab.focus();
    await user.keyboard(" ");
    expect(screen.queryByRole("heading", { name: "Grafo", level: 2 })).toBeNull();
    stillDetailPanel = await getDetailPanel();
    breadcrumb = within(stillDetailPanel).getByLabelText("Localização");
    await within(breadcrumb).findByText("PRB-0005");
  });

  it("UX-F: GlobalNav and ContextTabs Grafo unavailable-notes don't collide when both render on the same PRB Detail page", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    const detailPanel = await getDetailPanel();
    const switcher = await within(detailPanel).findByRole("navigation", { name: /PRB-0005/ });

    const globalGrafo = within(globalNav()).getByRole("button", { name: "Grafo" });
    const tabsGrafo = within(switcher).getByRole("button", { name: "Grafo" });

    const globalDescribedById = globalGrafo.getAttribute("aria-describedby")!;
    const tabsDescribedById = tabsGrafo.getAttribute("aria-describedby")!;
    expect(globalDescribedById).toBeTruthy();
    expect(tabsDescribedById).toBeTruthy();
    expect(globalDescribedById).not.toBe(tabsDescribedById);

    expect(document.getElementById(globalDescribedById)!.textContent).toBe("Em desenvolvimento");
    expect(document.getElementById(tabsDescribedById)!.textContent).toBe("Em desenvolvimento");

    // No duplicate ids anywhere on the page (getElementById only ever returns
    // the first match, so this catches a collision that assertion would hide).
    const idCounts = new Map<string, number>();
    document.querySelectorAll("[id]").forEach((el) => {
      idCounts.set(el.id, (idCounts.get(el.id) ?? 0) + 1);
    });
    for (const [id, count] of idCounts) {
      expect(count, `duplicate id: ${id}`).toBe(1);
    }
  });

  it("browser back after a GlobalNav area change restores the prior area and selection deterministically", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    await screen.findByText("Estrutura técnica completa");

    await user.click(within(globalNav()).getByRole("button", { name: "Visão geral" }));
    await screen.findByRole("heading", { name: "Visão geral" });

    window.history.back();
    await waitFor(() => expect(window.location.search).toContain("id=PRB-0005"));
    await screen.findByText("Estrutura técnica completa");
  });
});

describe("Explorer — Problem view (RE-03)", () => {
  it("opens a problem directly via URL, without visiting Records first", async () => {
    window.history.replaceState(null, "", "/?view=problem&id=PRB-0005");
    render(<Explorer dataProvider={fakeProvider()} />);

    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });
    const evidenceSection = screen.getByLabelText("Evidência");
    expect(within(evidenceSection).getByText(/EVD-000105/)).toBeTruthy();
  });

  it("the PRB Record Detail context switcher's 'Problema' tab switches to the Problem view for the same ID", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);

    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    const detailPanel = await getDetailPanel();
    const switcher = await within(detailPanel).findByRole("navigation", { name: /PRB-0005/ });
    await user.click(within(switcher).getByRole("button", { name: "Problema" }));

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

  it("Problem View's Detalhe ContextTab preserves the current PRB id and opens its Record Detail, not the Records list", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?view=problem&id=PRB-0005");
    render(<Explorer dataProvider={fakeProvider()} />);

    const switcher = await screen.findByRole("navigation", { name: /PRB-0005/ });
    await user.click(within(switcher).getByRole("button", { name: "Detalhe" }));

    const detailPanel = await getDetailPanel();
    const breadcrumb = within(detailPanel).getByLabelText("Localização");
    await within(breadcrumb).findByText("PRB-0005");
    expect(window.location.search).toContain("view=records");
    expect(window.location.search).toContain("id=PRB-0005");
  });

  it("a Problem-view URL survives reload (bookmark/share)", async () => {
    window.history.replaceState(null, "", "/?view=problem&id=PRB-0005");
    const { unmount } = render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });
    unmount();

    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });
  });

  it("clicking a linked Evidence in the Problem view opens it through the generic Records detail", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?view=problem&id=PRB-0005");
    render(<Explorer dataProvider={fakeProvider()} />);

    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });
    const evidenceSection = screen.getByLabelText("Evidência");
    await user.click(within(evidenceSection).getByRole("button", { name: /EVD-000105/ }));

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

  it("UX-C: Problem View's help/rail no longer link to a #reading-guide that doesn't exist on this surface", async () => {
    window.history.replaceState(null, "", "/?view=problem&id=PRB-0005");
    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });

    expect(screen.queryByRole("link", { name: /Orientação completa do Explorer/ })).toBeNull();
    expect(document.querySelector('a[href="#reading-guide"]')).toBeNull();
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
    await user.click(await within(within(detailPanel).getByLabelText("Relações")).findByRole("button", { name: /EVD-000105/ }));
    detailPanel = await getDetailPanel();
    await within(detailPanel).findByText(/Via Verde/);

    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(requestedUrls.some((u) => u.includes("edges.json"))).toBe(false);
    expect(requestedUrls.some((u) => u.endsWith(".yaml"))).toBe(false);
    expect(requestedUrls.some((u) => u.includes("research/"))).toBe(false);
  });
});
