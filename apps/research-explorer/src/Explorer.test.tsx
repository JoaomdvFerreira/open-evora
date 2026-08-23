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
    record: { title: "Pressão de estacionamento com uma descrição canónica completa que não pode ser truncada", domain: ["mobility"] },
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

    await screen.findByText("Inspeção técnica completa — todos os campos canónicos");
    expect(getRecord).toHaveBeenCalledTimes(1);
    expect(getRecord).toHaveBeenCalledWith("PRB-0005");
  });

  it("resolves outgoing relationships to related summary labels from the index", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));

    const detailPanel = (await screen.findByText("Detalhes")).closest("section")!;
    await within(detailPanel).findByText(/EVD-000105 — Via Verde Parking Buddy/);
    expect(within(detailPanel).getByText(/referencia através de/)).toBeTruthy();
  });

  it("resolves incoming relationships to related summary labels from the index", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);
    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));

    let detailPanel = await getDetailPanel();
    const outgoingButton = await within(detailPanel).findByRole("button", { name: /EVD-000105/ });
    await user.click(outgoingButton);

    detailPanel = await getDetailPanel();
    await within(detailPanel).findByText(/PRB-0005 — Pressão de estacionamento/);
    expect(within(detailPanel).getByText(/referenciado através de/)).toBeTruthy();
  });

  it("navigates PRB-0005 -> EVD-000105 -> SRC-0092, each step reachable back to Registos via the breadcrumb", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);

    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    await screen.findByText("Inspeção técnica completa — todos os campos canónicos");

    let detailPanel = await getDetailPanel();
    await user.click(await within(detailPanel).findByRole("button", { name: /EVD-000105/ }));
    detailPanel = await getDetailPanel();
    await within(detailPanel).findByText(/Via Verde/);

    await user.click(await within(detailPanel).findByRole("button", { name: /SRC-0092/ }));

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
    expect(await within(detailPanel).findByText("Inspeção técnica completa — todos os campos canónicos")).toBeTruthy();
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
    await screen.findByText("Inspeção técnica completa — todos os campos canónicos");
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
    await screen.findByText("Inspeção técnica completa — todos os campos canónicos");
    let detailPanel = await getDetailPanel();
    await user.click(await within(detailPanel).findByRole("button", { name: /EVD-000105/ }));
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

  it("opens Graph from a PRB record detail's context switcher with a focused heading and record-specific title", async () => {
    const user = userEvent.setup();
    render(<Explorer dataProvider={fakeProvider()} />);

    await user.click(await screen.findByRole("button", { name: /PRB-0005/ }));
    const detailPanel = await getDetailPanel();
    const switcher = await within(detailPanel).findByRole("navigation", { name: /PRB-0005/ });
    await user.click(within(switcher).getByRole("button", { name: "Grafo" }));

    const heading = await screen.findByRole("heading", { name: "Grafo", level: 2 });
    expect(document.title).toBe("Grafo PRB-0005 — Explorador de Investigação Open Évora");
    expect(document.activeElement).toBe(heading);
  });

  it("does not steal focus during an ordinary Graph filter update", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?view=graph&id=PRB-0005");
    render(<Explorer dataProvider={fakeProvider()} />);

    const typeFilter = await screen.findByLabelText(/PRB-\s*—/);
    await user.click(typeFilter);
    expect(document.activeElement).toBe(typeFilter);
  });

  it("turns a direct stale Graph URL into a recoverable state and keeps history navigation coherent", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?view=graph&id=PRB-STALE");
    render(<Explorer dataProvider={fakeProvider()} />);

    const alert = await screen.findByRole("alert");
    await user.click(within(alert).getByRole("button", { name: /Limpar seleção/ }));
    await screen.findByText(/Procure e selecione um registo/);
    expect(window.location.search).toBe("?view=graph");

    window.history.back();
    await screen.findByRole("alert");
    window.history.forward();
    await screen.findByText(/Procure e selecione um registo/);
  });

  it("Problem View's Registos breadcrumb clears the selected id and returns straight to the Records list, preserving search context", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?q=PRB-0005&view=problem&id=PRB-0005");
    render(<Explorer dataProvider={fakeProvider()} />);

    // V3: Problem View exposes the same "Localização" breadcrumb pattern as
    // Record Detail (Registos › PRB-0005), but — unlike a still-selected
    // Records breadcrumb — Registos here must clear the selection outright:
    // Problem View is never itself the Records table, so preserving the id
    // would silently redirect into Record Detail instead of the list.
    const problemBreadcrumb = await screen.findByLabelText("Localização");
    await user.click(within(problemBreadcrumb).getByRole("button", { name: "Registos" }));

    await screen.findByRole("heading", { name: "Registos" });
    expect(window.location.search).toContain("view=records");
    expect(window.location.search).not.toContain("id=PRB-0005");
    expect(window.location.search).toContain("q=PRB-0005");
    expect((screen.getByLabelText("Pesquisar") as HTMLInputElement).value).toBe("PRB-0005");
    expect(screen.getByRole("button", { name: /PRB-0005/ })).toBeTruthy();
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
    await screen.findByText("Inspeção técnica completa — todos os campos canónicos");
    expect(screen.queryByText("Como ler o Explorer")).toBeNull();
  });

  it("UX-C: the global reading guide is absent on Problem View", async () => {
    window.history.replaceState(null, "", "/?view=problem&id=PRB-0005");
    render(<Explorer dataProvider={fakeProvider()} />);
    await screen.findByRole("heading", { name: /Pressão de estacionamento/ });
    expect(screen.queryByText("Como ler o Explorer")).toBeNull();
  });

  it("UX-C: the global reading guide is retained on Graph", async () => {
    window.history.replaceState(null, "", "/?view=graph");
    render(<Explorer dataProvider={fakeProvider()} />);
    expect(await screen.findByText("Como ler o Explorer")).toBeTruthy();
  });

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
    await screen.findByText("Inspeção técnica completa — todos os campos canónicos");
    let detailPanel = await getDetailPanel();
    await user.click(await within(detailPanel).findByRole("button", { name: /EVD-000105/ }));
    detailPanel = await getDetailPanel();
    await within(detailPanel).findByText(/Via Verde/);

    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(requestedUrls.some((u) => u.includes("edges.json"))).toBe(false);
    expect(requestedUrls.some((u) => u.endsWith(".yaml"))).toBe(false);
    expect(requestedUrls.some((u) => u.includes("research/"))).toBe(false);
  });
});
