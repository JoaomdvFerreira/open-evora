import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { EVD_AUDIT_ANCHOR_ID, EvdDetail } from "./EvdDetail";
import type { RecordDetail, RecordSummary } from "../dataProvider/types";
import { DataLoadError } from "../dataProvider/types";
import type { EVDProblemUsesState } from "./useEvdProblemUses";
import type { EVDProblemUse } from "./evdRelations";
import { composeStories } from "@storybook/react-vite";
import * as stories from "./EvdDetail.stories";

const GENERATED = path.resolve(__dirname, "..", "..", "generated", "record-detail");
const hasGeneratedData = fs.existsSync(GENERATED);
const detail = (id: string): RecordDetail => JSON.parse(fs.readFileSync(path.join(GENERATED, `${id}.json`), "utf8"));
type UsesState = EVDProblemUsesState & { retry: () => void };
const ready = (uses: EVDProblemUse[]): UsesState => ({ status: "ready", uses, retry: vi.fn() });
const lookup = new Map<string, RecordSummary>([
  ["SRC-0002", { id: "SRC-0002", type: "SRC-", label: "Plano de Desenvolvimento Social de Évora 2024-2027", file: "", summaryFields: { "access.level": "public" } }],
  ["SRC-0093", { id: "SRC-0093", type: "SRC-", label: "Estudo OpenPark", file: "", summaryFields: {} }],
]);

function renderEvd(item: RecordDetail, overrides: Partial<{ problemUses: UsesState; onSelect: (id: string) => void; onViewAsProblem: (id: string) => void; onBackToRecords: () => void }> = {}) {
  const props = { problemUses: ready([]), onSelect: vi.fn(), onViewAsProblem: vi.fn(), onBackToRecords: vi.fn(), ...overrides };
  const view = render(<EvdDetail detail={item} lookup={lookup} {...props} />);
  return { ...view, ...props };
}

/** The six public metadata facts, as rendered label → value pairs. */
function metadata(container: HTMLElement): Record<string, string> {
  return Object.fromEntries(Array.from(container.querySelectorAll(".evd-meta-cell")).map((cell) => [cell.querySelector("dt")!.textContent, cell.querySelector("dd")!.textContent]));
}

const auditRegion = () => screen.getByRole("region", { name: "Origem e auditoria" });

describe.skipIf(!hasGeneratedData)("EVD Detail — canonical regression cases", () => {
  it("EVD-000001 renders the full observation as the H1 with its type eyebrow, topic and extraction date", () => {
    const item = detail("EVD-000001");
    renderEvd(item);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe((item.record.observation as Record<string, unknown>).summary);
    expect(screen.getByText("Registo de evidência")).toBeTruthy();
    expect(within(screen.getByLabelText("Temas")).getByText("Mobilidade")).toBeTruthy();
    const extracted = screen.getByText(/^Extraída em/);
    expect(extracted.textContent).toBe("Extraída em 10 ago 2026");
    expect(extracted.querySelector("time")?.dateTime).toBe("2026-08-10");
    // lineage stays out of the hero; it belongs to the canonical-record row only.
    expect(document.querySelector(".evd-hero")?.textContent).not.toContain("SOC-2024-01-PDS-EVORA");
  });

  it("EVD-000001 maps the six public metadata facts from canonical data and the Problem-use relation", () => {
    const item = detail("EVD-000001"); const problem = detail("PRB-0001");
    const { container } = renderEvd(item, { problemUses: ready([{ detail: problem, effects: ["SUPPORTS"], researchRoles: ["LOCAL_OBSERVATION"], relationshipPath: "evidence[0]" }]) });
    expect(metadata(container)).toEqual({ Natureza: "Alegação", Autoridade: "Com autoridade", Onde: "Município de Évora", Quando: "2024–2027", Tema: "Mobilidade", Problemas: "1" });
  });

  it("EVD-000001 renders population, numbered limits with their count, and the canonical audit rows", () => {
    const item = detail("EVD-000001"); const onSelect = vi.fn();
    renderEvd(item, { onSelect });
    const population = screen.getByRole("region", { name: "A quem se refere" });
    expect(within(population).getByText((item.record.scope as { populations: string[] }).populations[0])).toBeTruthy();

    const limits = screen.getByRole("region", { name: "O que não permite concluir" });
    expect(within(limits).getByText("2 limites explícitos")).toBeTruthy();
    expect(within(limits).getByText("Limite 1")).toBeTruthy();
    expect(within(limits).getByText("Limite 2")).toBeTruthy();
    expect(within(limits).getByText((item.record.inference_limits as string[])[0])).toBeTruthy();

    const audit = auditRegion();
    expect(within(audit).getByRole("heading", { name: "Plano de Desenvolvimento Social de Évora 2024-2027" })).toBeTruthy();
    expect(within(audit).getByText(/Extraída pela Open Évora em/).textContent).toBe("Extraída pela Open Évora em 10/08/2026");
    fireEvent.click(within(audit).getByRole("button", { name: "Abrir fonte SRC-0002" }));
    expect(onSelect).toHaveBeenCalledWith("SRC-0002");

    expect(within(audit).getByText("research/evidence/EVD-000001.yaml")).toBeTruthy();
    expect(within(audit).getByText("SOC-2024-01-PDS-EVORA")).toBeTruthy();
  });

  it("EVD-000001 explains its actual classification pair and links to the method", () => {
    renderEvd(detail("EVD-000001"));
    const audit = auditRegion();
    const explanation = within(audit).getByText("Alegação").closest("p")!;
    expect(explanation.textContent).toBe("Alegação — a fonte afirma, mas não mede. Com autoridade — quem afirma tem competência institucional sobre o tema.");
    expect(within(audit).getByRole("link", { name: "Ler o método →" }).getAttribute("href")).toBe("/methodology");
  });

  it("EVD-000001 downloads its canonical YAML from the republished same-origin copy", () => {
    renderEvd(detail("EVD-000001"));
    const download = within(auditRegion()).getByRole("link", { name: /Descarregar YAML/ });
    expect(download.getAttribute("href")).toBe("/canonical/research/evidence/EVD-000001.yaml");
    expect(download.getAttribute("download")).toBe("EVD-000001.yaml");
  });

  it("EVD-000114 derives a different classification explanation and multiple topics from its own data", () => {
    const { container } = renderEvd(detail("EVD-000114"));
    expect(metadata(container)).toMatchObject({ Natureza: "Facto", Autoridade: "Com autoridade", Temas: "Acessibilidade · Economia" });
    expect(screen.getAllByText("pessoas com deficiência").length).toBeGreaterThan(0);
    const explanation = within(auditRegion()).getByText("Facto").closest("p")!;
    expect(explanation.textContent).toBe("Facto — a fonte regista um dado ou acontecimento. Com autoridade — quem afirma tem competência institucional sobre o tema.");
    expect(explanation.textContent).not.toContain("Alegação");
  });

  it("EVD-000096 renders every canonical Source as its own navigable provenance row and omits absent lineage", () => {
    const onSelect = vi.fn();
    renderEvd(detail("EVD-000096"), { onSelect });
    const rows = within(auditRegion()).getByRole("list", { name: "Fontes" }).querySelectorAll(":scope > li");
    expect(Array.from(rows).map((row) => row.querySelector(".rec-identifier")?.textContent)).toEqual(["SRC-0081", "SRC-0053"]);
    fireEvent.click(screen.getByRole("button", { name: "Abrir fonte SRC-0081" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir fonte SRC-0053" }));
    expect(onSelect.mock.calls).toEqual([["SRC-0081"], ["SRC-0053"]]);
    expect(screen.queryByText(/linhagem/)).toBeNull();
  });

  it("EVD-000106 preserves comparative Seattle scope and routes both Problem actions to the Problem experience", () => {
    const item = detail("EVD-000106"); const problem = detail("PRB-0005"); const onSelect = vi.fn(); const onViewAsProblem = vi.fn();
    renderEvd(item, { onSelect, onViewAsProblem, problemUses: ready([{ detail: problem, effects: ["REFINES"], researchRoles: ["COMPARATIVE_MECHANISM"], relationshipPath: "evidence[7]" }]) });
    expect(screen.getAllByText("Belltown, Seattle, Washington, EUA").length).toBeGreaterThan(0);
    expect(screen.getByText("O estudo não demonstra uma redução proporcional da distância total percorrida ou das emissões e não estabelece um efeito equivalente em Évora.")).toBeTruthy();
    expect(screen.getByText("Refina")).toBeTruthy(); expect(screen.getByText("Mecanismo comparativo")).toBeTruthy();
    expect(screen.getByText(/Extraída pela Open Évora em/).textContent).toBe("Extraída pela Open Évora em 11/08/2026");
    fireEvent.click(screen.getByRole("button", { name: problem.record.title as string }));
    fireEvent.click(screen.getByRole("button", { name: "Ver problema PRB-0005" }));
    expect(onViewAsProblem.mock.calls).toEqual([["PRB-0005"], ["PRB-0005"]]);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("EVD-000147 preserves month precision and the planned-response relationship", () => {
    const { container } = renderEvd(detail("EVD-000147"), { problemUses: ready([{ detail: detail("PRB-0008"), effects: ["BOUNDS", "REFINES"], researchRoles: ["LOCAL_OBSERVATION", "PLANNED_RESPONSE"], relationshipPath: "evidence[5]" }]) });
    expect(metadata(container).Quando).toBe("outubro de 2026");
    expect(screen.getByText("Resposta planeada")).toBeTruthy();
  });

  it("EVD-000012 renders multiple Problem uses independently and counts distinct Problems", () => {
    const { container } = renderEvd(detail("EVD-000012"), {
      problemUses: ready([
        { detail: detail("PRB-0004"), effects: ["REFINES"], researchRoles: ["LOCAL_OBSERVATION"], relationshipPath: "evidence[3]" },
        { detail: detail("PRB-0005"), effects: ["BOUNDS", "REFINES"], researchRoles: ["LOCAL_OBSERVATION", "EXISTING_RESPONSE"], relationshipPath: "evidence[5]" },
      ]),
    });
    const uses = screen.getByRole("region", { name: "Como é usada" });
    expect(uses.querySelectorAll(".evd-use")).toHaveLength(2);
    expect(within(uses).getByText("2 problemas em investigação")).toBeTruthy();
    expect(metadata(container).Problemas).toBe("2");
  });
});

describe("EVD Detail — synthetic contract cases", () => {
  const base: RecordDetail = {
    id: "EVD-TEST",
    type: "EVD-",
    file: "research/evidence/EVD-TEST.yaml",
    outgoingEdges: [{ field: "provenance.sources", ordinal: 0, to: "SRC-0093" }],
    incomingEdges: [{ field: "evidence", ordinal: 3, from: "PRB-0005" }],
    record: {
      observation: { summary: "Observação de teste." },
      provenance: { sources: ["SRC-0093"], extracted_at: "2026-08-11" },
      evidence_nature: "claim",
      claim_authority: "authoritative",
      lineage_id: "EVD-LEGACY-0001",
    },
  };
  const problem = (id: string, status = "OPEN"): RecordDetail => ({ id, type: "PRB-", file: `research/problems/${id}.yaml`, outgoingEdges: [], incomingEdges: [], record: { title: `Problema ${id}`, status } });
  const use = (detail: RecordDetail, relationshipPath = "evidence[0]"): EVDProblemUse => ({ detail, effects: ["SUPPORTS"], researchRoles: ["LOCAL_OBSERVATION"], relationshipPath });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("omits the limits section entirely when there are no inference limits (no zero count)", () => {
    renderEvd({ ...base, record: { ...base.record, inference_limits: [] } });
    expect(screen.queryByRole("region", { name: "O que não permite concluir" })).toBeNull();
    expect(screen.queryByText(/limites? explícitos?/)).toBeNull();
    expect(document.getElementById("evd-limits")).toBeNull();
  });

  it("reports an absent optional metadata value as not recorded rather than inferring one", () => {
    const { container } = renderEvd(base);
    expect(metadata(container)).toEqual({ Natureza: "Alegação", Autoridade: "Com autoridade", Onde: "Não registado", Quando: "Não registado", Tema: "Não registado", Problemas: "0" });
    expect(screen.queryByRole("region", { name: "A quem se refere" })).toBeNull();
  });

  it("keeps loading as ProgressMessage with a pending Problemas value", () => {
    const { container } = renderEvd(base, { problemUses: { status: "loading", retry: vi.fn() } });
    expect(screen.getByRole("status").textContent).toBe("A carregar usos nos Problemas…");
    expect(metadata(container).Problemas).toBe("…");
    expect(screen.queryByText("Esta evidência ainda não está ligada explicitamente a um Problema.")).toBeNull();
  });

  it("keeps error as ErrorNotice with retry, and never shows a count it could not load", () => {
    const retry = vi.fn();
    const { container } = renderEvd(base, { problemUses: { status: "error", error: new DataLoadError("Falha.", "network"), retry } });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(metadata(container).Problemas).toBe("Indisponível");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("renders EmptyState with the exact copy once ready with zero Problem uses", () => {
    renderEvd(base);
    const message = screen.getByText("Esta evidência ainda não está ligada explicitamente a um Problema.");
    expect(message.className).toBe("ui-empty-state-message");
    expect(screen.getByRole("region", { name: "Como é usada" }).querySelector(".evd-section-note")).toBeNull();
  });

  it("preserves authored effect/role order and cardinality as Efeito then Papel", () => {
    renderEvd(base, { problemUses: ready([{ detail: problem("PRB-0005"), effects: ["SUPPORTS", "BOUNDS"], researchRoles: ["CONTEXTUAL", "COMPARATIVE_RESPONSE"], relationshipPath: "evidence[3]" }]) });
    const facts = document.querySelector(".evd-use dl")!;
    expect(Array.from(facts.querySelectorAll("dt")).map((node) => node.textContent)).toEqual(["Efeito", "Papel"]);
    const [effects, roles] = Array.from(facts.querySelectorAll("dd"));
    expect(Array.from(effects.querySelectorAll(".evd-effect-tag")).map((node) => node.textContent)).toEqual(["Sustenta", "Delimita"]);
    expect(Array.from(roles.querySelectorAll(".research-role-tag")).map((node) => node.textContent)).toEqual(["Contexto", "Resposta comparativa"]);
  });

  it("counts a Problem that uses the Evidence twice once, and says 'em investigação' only when every Problem is open", () => {
    const open = problem("PRB-0101"); const closed = problem("PRB-0102", "REJECTED");
    const { container, unmount } = renderEvd(base, { problemUses: ready([use(open, "evidence[0]"), use(open, "evidence[4]")]) });
    expect(metadata(container).Problemas).toBe("1");
    expect(screen.getByText("1 problema em investigação")).toBeTruthy();
    expect(document.querySelectorAll(".evd-use")).toHaveLength(2);
    unmount();

    renderEvd(base, { problemUses: ready([use(open), use(closed)]) });
    expect(screen.getByText("2 problemas")).toBeTruthy();
    expect(screen.queryByText(/em investigação/)).toBeNull();
  });

  it("describes the Sources' number and public access only as the index records them", () => {
    const intro = () => document.querySelector(".evd-audit-intro")!.textContent;
    const { unmount } = renderEvd(base);
    expect(intro()).toBe("Este registo foi extraído da fonte indicada e classificado segundo o método da Open Évora. Pode consultar a fonte e descarregar a versão canónica.");
    unmount();
    const two = renderEvd({ ...base, record: { ...base.record, provenance: { sources: ["SRC-0002", "SRC-0093"] } } });
    expect(intro()).toBe("Este registo foi extraído das fontes indicadas e classificado segundo o método da Open Évora. Pode consultar as fontes e descarregar a versão canónica.");
    two.unmount();
    renderEvd({ ...base, record: { ...base.record, provenance: { sources: ["SRC-0002"] } } });
    expect(intro()).toBe("Este registo foi extraído de uma fonte pública e classificado segundo o método da Open Évora. Pode consultar a fonte e descarregar a versão canónica.");
  });

  it("offers Verificar as a named in-page link to the stable audit anchor", () => {
    renderEvd(base);
    const verify = screen.getByRole("link", { name: "Verificar este registo" });
    expect(verify.getAttribute("href")).toBe(`#${EVD_AUDIT_ANCHOR_ID}`);
    expect(document.getElementById(EVD_AUDIT_ANCHOR_ID)).toBe(auditRegion());
  });

  it("returns to Registos from the breadcrumb", () => {
    const { onBackToRecords } = renderEvd(base);
    fireEvent.click(within(screen.getByRole("navigation", { name: "Localização" })).getByRole("button", { name: "Registos" }));
    expect(onBackToRecords).toHaveBeenCalledTimes(1);
  });

  it("falls back to copying the page URL when the Web Share API is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText } });
    renderEvd(base);
    fireEvent.click(screen.getByRole("button", { name: "Partilhar este registo" }));
    await waitFor(() => expect(screen.getByText("Ligação copiada.")).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(window.location.href);
  });

  it("uses the Web Share API with the observation as title where supported", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share });
    renderEvd(base);
    fireEvent.click(screen.getByRole("button", { name: "Partilhar este registo" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title: "Observação de teste.", url: window.location.href }));
  });

  it("no longer presents the section index, reading rail or technical field dump", () => {
    renderEvd(base);
    expect(screen.queryByRole("navigation", { name: /Nesta evidência/ })).toBeNull();
    expect(screen.queryByText(/Inspeção técnica/)).toBeNull();
    expect(screen.queryByText("De onde vem esta evidência")).toBeNull();
    expect(screen.queryByText("provenance.sources[0] → SRC-0093")).toBeNull();
  });
});

/**
 * Storybook review surfaces: every "Public/EVD Detail" story renders the real
 * page shell (ExplorerHeader with Registos current, production
 * RecordDetailPanel, PublicFooter) over the generated read model — not a
 * mock composition. Not a visual-acceptance test.
 */
describe.skipIf(!hasGeneratedData)("Public/EVD Detail stories", () => {
  const composed = composeStories(stories);

  it.each(Object.entries(composed))("%s renders the production EVD page inside the real Explorer chrome", async (_name, Story) => {
    const { container } = render(<Story />);
    const main = container.querySelector("main.explorer-shell")!;
    expect(main.querySelector("header.explorer-chrome")).not.toBeNull();
    expect(container.querySelector("footer.public-footer")).not.toBeNull();
    expect(await screen.findByRole("region", { name: "Origem e auditoria" })).toBeTruthy();
    expect(within(screen.getByRole("navigation", { name: "Navegação principal", hidden: true })).getByRole("button", { name: "Registos", hidden: true }).getAttribute("aria-current")).toBe("page");
  });

  it("the primary review fixture is canonical EVD-000001 with its real Problem use resolved", async () => {
    render(<composed.EvdDetail1440 />);
    const item = detail("EVD-000001");
    expect(await screen.findByRole("heading", { level: 1, name: (item.record.observation as Record<string, unknown>).summary as string })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Ver problema PRB-0001" })).toBeTruthy();
  });
});
