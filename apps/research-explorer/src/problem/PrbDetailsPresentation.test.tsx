import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrbDetailsPresentation } from "./PrbDetailsPresentation";
import { buildPrbDetailsData } from "./prbDetailsProjection";
import { buildPrbDossierData } from "./prbDossierProjection";
import type { RecordDetail } from "../dataProvider/types";
import type { EvidenceWithSources, ProblemProjection } from "./problemProjection";

function evd(id: string, summary: string, effects: string[] = [], researchRoles: string[] = [], sourcePublishers: string[] = [], evidenceNature = "fact"): EvidenceWithSources {
  const detail: RecordDetail = { id, type: "EVD-", file: "", outgoingEdges: [], incomingEdges: [], record: { observation: { summary }, evidence_nature: evidenceNature } };
  const sources: RecordDetail[] = sourcePublishers.map((publisher, index) => ({
    id: `SRC-${id}-${index}`, type: "SRC-", file: "", outgoingEdges: [], incomingEdges: [], record: { publisher },
  }));
  return { detail, sources, effects, researchRoles };
}

function baseProjection(record: Record<string, unknown>, evidence: EvidenceWithSources[]): ProblemProjection {
  return { problem: { id: "PRB-9999", type: "PRB-", file: "research/problems/PRB-9999.yaml", record, outgoingEdges: [], incomingEdges: [] }, evidence };
}

/** `container.querySelector` returns `Element`; `within()` requires `HTMLElement`. Every selector here targets an element this suite itself renders as HTML. */
function requireElement(container: ParentNode, selector: string): HTMLElement {
  const element = container.querySelector(selector);
  if (!(element instanceof HTMLElement)) throw new Error(`requireElement: no HTMLElement matched "${selector}"`);
  return element;
}

const noop = vi.fn();
const handlers = { onOpenGeneric: noop, onBackToOverview: noop, onViewHistory: noop };

function renderPrb(record: Record<string, unknown>, evidence: EvidenceWithSources[] = []) {
  return render(<PrbDetailsPresentation data={buildPrbDetailsData(baseProjection(record, evidence))} {...handlers} />);
}

describe("PrbDetailsPresentation — generic PRB Details composition", () => {
  it("renders the shared Detalhes|Histórico PRB navigation with Detalhes as the current page, not ARIA tabs", () => {
    const onViewHistory = vi.fn();
    render(<PrbDetailsPresentation data={buildPrbDetailsData(baseProjection({ title: "T" }, []))} {...handlers} onViewHistory={onViewHistory} />);
    const nav = screen.getByRole("navigation", { name: "Vistas do problema" });
    expect(nav.tagName).toBe("NAV");
    expect(within(nav).getByText("Detalhes").getAttribute("aria-current")).toBe("page");
    const history = within(nav).getByRole("button", { name: "Histórico" });
    expect(history.getAttribute("aria-current")).toBeNull();
    expect(nav.textContent).toBe("DetalhesHistórico");
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    history.click();
    expect(onViewHistory).toHaveBeenCalledWith("PRB-9999");
  });

  it("presents authored closure details without equating closure with resolution", () => {
    renderPrb({ title: "Encerrado", status: "CLOSED", closure: { reason: "OUT_OF_SCOPE", explanation: "O \u00e2mbito documentado fica fora do programa.", closed_at: "2026-08-28", reopen_condition: "O programa altera o seu \u00e2mbito." } });
    expect(screen.getByText("Problema encerrado")).toBeTruthy();
    expect(screen.queryByText("Problema em investigação")).toBeNull();
    const section = screen.getByRole("region", { name: "Encerramento" });
    expect(within(section).getByText("Fora do \u00e2mbito do programa")).toBeTruthy();
    expect(within(section).getByText("O \u00e2mbito documentado fica fora do programa.")).toBeTruthy();
    expect(within(section).getByText("28/08/2026")).toBeTruthy();
    expect(within(section).getByText("O programa altera o seu \u00e2mbito.")).toBeTruthy();
    expect(within(section).getByText(/n\u00e3o significa, por si s\u00f3, que a condi\u00e7\u00e3o c\u00edvica tenha desaparecido/)).toBeTruthy();
  });

  it("presents preserved questions as unanswered history on CLOSED Problems", () => {
    renderPrb({
      title: "Encerrado com questões históricas",
      status: "CLOSED",
      investigation: { open_questions: [{ question: "Pergunta preservada?", why_open: "Permanece sem resposta documentada.", current_action: "Sem ação ativa no âmbito atual do programa.", evidence: ["EVD-1"] }] },
    });
    expect(screen.getAllByText("Questões que ficaram por responder")).toHaveLength(2);
    expect(screen.queryByText("Questões abertas")).toBeNull();
    expect(screen.queryByText(/questões? em acompanhamento/)).toBeNull();
    expect(screen.queryByText("Porque continua em aberto")).toBeNull();
    expect(screen.queryByText("Ação atual")).toBeNull();
    expect(screen.getByText("Porque ficou por responder")).toBeTruthy();
    expect(screen.getByText("Ação registada")).toBeTruthy();
    expect(screen.getByText("Pergunta preservada?")).toBeTruthy();
    expect(screen.queryByText(/Contribuir para a investigação/)).toBeNull();
  });

  it("renders the canonical title and statement exactly as authored", () => {
    renderPrb({ title: "Título canónico do problema", problem_statement: "Formulação canónica delimitada." });
    expect(screen.getByRole("heading", { name: "Título canónico do problema" })).toBeTruthy();
    expect(screen.getByText("Formulação canónica delimitada.")).toBeTruthy();
  });

  it("renders the PRB title as a programmatically focusable h2 below the Explorer's page-level h1, exposed through titleRef", () => {
    const titleRef = createRef<HTMLHeadingElement>();
    render(<PrbDetailsPresentation data={buildPrbDetailsData(baseProjection({ title: "Título" }, []))} {...handlers} titleRef={titleRef} />);
    const title = screen.getByRole("heading", { level: 2, name: "Título" });
    expect(title.id).toBe("prb-identity-title");
    expect(title.className).toBe("prb-identity-title");
    expect(title.getAttribute("tabindex")).toBe("-1");
    expect(titleRef.current).toBe(title);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.getByRole("article").getAttribute("aria-labelledby")).toBe("prb-identity-title");
  });

  it("keeps a descending heading outline: title h2, top-level sections h3, nested headings below them without skipped levels", () => {
    const record = {
      title: "Título",
      causal_reading: "Leitura.",
      status: "OPEN",
      investigation: {
        open_questions: [{ question: "Q?", why_open: "Motivo.", evidence: ["EVD-1"] }],
        path: { initial_signal: { summary: "Sinal." } },
      },
    };
    const { container } = renderPrb(record, [evd("EVD-1", "Obs", ["SUPPORTS"], [], ["Fonte A"])]);
    const outline = Array.from(container.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((heading) => [Number(heading.tagName[1]), heading.textContent]);
    expect(outline).toEqual([
      [2, "Título"],
      [3, "Estado da investigação"],
      [3, "Base da investigação"],
      [3, "Leitura atual"],
      [3, "O que ainda não sabemos"],
      [4, "Porque continua em aberto"],
      [4, "Ação atual"],
      [4, "Evidência relacionada"],
      [3, "Como chegámos a esta leitura"],
      [4, "Etapas da investigação"],
      [5, "Sinal inicial"],
      [3, "Evidência e verificação"],
      [4, "Verificar esta investigação"],
      [5, "Toda a evidência"],
      [5, "Como verificamos"],
      [6, "Efeito"],
      [6, "Papel na investigação"],
      [5, "Dossiê da investigação"],
    ]);
    for (let i = 1; i < outline.length; i += 1) {
      expect((outline[i][0] as number) - (outline[i - 1][0] as number)).toBeLessThanOrEqual(1);
    }
  });

  it("keeps each top-level section labelled by its own h3 heading", () => {
    renderPrb({ title: "T", causal_reading: "Leitura.", investigation: { open_questions: [{ question: "Q?" }], path: { initial_signal: { summary: "S." } } } });
    for (const name of ["Estado da investigação", "Leitura atual", "O que ainda não sabemos", "Como chegámos a esta leitura", "Evidência e verificação"]) {
      const region = screen.getByRole("region", { name });
      const heading = document.getElementById(region.getAttribute("aria-labelledby")!);
      expect(heading?.tagName).toBe("H3");
    }
  });

  it("renders state/evidence/validation labels only when their canonical field is present", () => {
    renderPrb({ title: "T", status: "OPEN", evidence_status: "discovered", validation_status: "unvalidated" });
    expect(screen.getByText("Problema em investigação")).toBeTruthy();
    expect(screen.getByText("Aberto")).toBeTruthy();
    expect(screen.getByText("Identificada")).toBeTruthy();
    expect(screen.getByText("Por validar")).toBeTruthy();
  });

  it("omits state dimension items entirely when their canonical field is absent, never a placeholder", () => {
    renderPrb({ title: "T", status: "OPEN" });
    expect(screen.queryByText("Evidência", { selector: "dt" })).toBeNull();
    expect(screen.queryByText("Validação", { selector: "dt" })).toBeNull();
  });

  it("shows singular/plural scope labels driven by the actual count", () => {
    const record = { title: "T", investigation: { open_questions: [{ question: "Única questão?" }] } };
    const { container } = renderPrb(record, [evd("EVD-1", "Obs", ["SUPPORTS"], [], ["Fonte A"])]);
    const scope = requireElement(container, ".prb-scope-metrics");
    expect(within(scope).getByText("Questão aberta")).toBeTruthy();
    expect(within(scope).getByText("Evidência")).toBeTruthy();
    expect(within(scope).getByText("Fonte")).toBeTruthy();
  });

  it("shows plural scope labels when counts exceed one", () => {
    const record = {
      title: "T",
      investigation: { open_questions: [{ question: "Q1?" }, { question: "Q2?" }] },
    };
    const { container } = renderPrb(record, [evd("EVD-1", "Obs", ["SUPPORTS", "REFINES"], [], ["Fonte A"]), evd("EVD-2", "Obs2", ["BOUNDS"], [], ["Fonte B"])]);
    const scope = requireElement(container, ".prb-scope-metrics");
    expect(within(scope).getByText("Questões abertas")).toBeTruthy();
    expect(within(scope).getByText("Evidências")).toBeTruthy();
    expect(within(scope).getByText("Fontes")).toBeTruthy();
  });

  it("renders all six state/scope dimensions in canonical order, each label before its canonical value", () => {
    const record = {
      title: "T",
      status: "OPEN",
      evidence_status: "discovered",
      validation_status: "unvalidated",
      investigation: { open_questions: [{ question: "Q1?" }, { question: "Q2?" }] },
    };
    const { container } = renderPrb(record, [evd("EVD-1", "Obs", ["SUPPORTS", "REFINES"], [], ["Fonte A"]), evd("EVD-2", "Obs2", ["BOUNDS"], [], ["Fonte B"])]);
    const band = requireElement(container, ".prb-state-scope-band");
    const cells = Array.from(band.querySelectorAll(".prb-state-item, .prb-scope-metric")).map((cell) =>
      Array.from(cell.children).map((child) => child.textContent),
    );
    expect(cells).toEqual([
      ["Estado", "Aberto"],
      ["EvidênciaForam encontradas evidências relevantes; o problema ainda não foi plenamente validado.", "Identificada"],
      ["Validação", "Por validar"],
      ["Questões abertas", "2"],
      ["Evidências", "2"],
      ["Fontes", "2"],
    ]);
    const headings = Array.from(band.querySelectorAll("h3")).map((heading) => heading.textContent);
    expect(headings).toEqual(["Estado da investigação", "Base da investigação"]);
    // Each group heading precedes its own values in DOM order (the six-column layout is CSS-only).
    expect(band.textContent?.indexOf("Estado da investigação")).toBeLessThan(band.textContent?.indexOf("Aberto") ?? -1);
    expect(band.textContent?.indexOf("Aberto")).toBeLessThan(band.textContent?.indexOf("Base da investigação") ?? -1);
    expect(band.textContent?.indexOf("Base da investigação")).toBeLessThan(band.textContent?.indexOf("Questões abertas") ?? -1);
  });

  it("shows the evidence-status explanation on pointer hover and removes the old inline disclosure", () => {
    renderPrb({ title: "T", evidence_status: "discovered" });
    const button = screen.getByRole("button", { name: "O que significa Evidência identificada?" });
    expect(screen.getByText("Identificada")).toBeTruthy();
    // The control belongs to the Evidence term; the value row carries only the value.
    expect(button.closest("dt")?.firstElementChild?.textContent).toBe("Evidência");
    expect(screen.getByText("Identificada").closest("dd")?.querySelector("button")).toBeNull();
    expect(screen.queryByText("O que significa?", { exact: true })).toBeNull();
    expect(screen.getByRole("tooltip").hasAttribute("data-open")).toBe(false);
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    expect(screen.getByRole("tooltip").textContent).toBe("Foram encontradas evidências relevantes; o problema ainda não foi plenamente validado.");
    expect(screen.getByRole("tooltip").hasAttribute("data-open")).toBe(true);
    fireEvent.pointerLeave(button);
    expect(screen.getByRole("tooltip").hasAttribute("data-open")).toBe(false);
  });

  it("opens the evidence-status explanation on keyboard focus and closes it with Escape", () => {
    renderPrb({ title: "T", evidence_status: "discovered" });
    const button = screen.getByRole("button", { name: "O que significa Evidência identificada?" });
    fireEvent.focus(button);
    expect(screen.getByRole("tooltip").hasAttribute("data-open")).toBe(true);
    fireEvent.keyDown(button, { key: "Escape" });
    expect(screen.getByRole("tooltip").hasAttribute("data-open")).toBe(false);
  });

  it("toggles the evidence-status explanation by touch-style taps and dismisses outside", () => {
    renderPrb({ title: "T", evidence_status: "discovered" });
    const button = screen.getByRole("button", { name: "O que significa Evidência identificada?" });
    fireEvent.pointerEnter(button, { pointerType: "touch" });
    fireEvent.click(button);
    expect(screen.getByRole("tooltip").hasAttribute("data-open")).toBe(true);
    fireEvent.click(button);
    expect(screen.getByRole("tooltip").hasAttribute("data-open")).toBe(false);
    fireEvent.click(button);
    fireEvent.pointerDown(document.body, { pointerType: "touch" });
    expect(screen.getByRole("tooltip").hasAttribute("data-open")).toBe(false);
  });

  it("does not render an explanation control for state values without explanatory copy", () => {
    renderPrb({ title: "T", evidence_status: "corroborated", validation_status: "unvalidated" });
    expect(screen.queryByRole("button", { name: "O que significa Evidência identificada?" })).toBeNull();
  });

  it("renders dynamic question/evidence/effect counts matching what is actually authored", () => {
    const record = {
      title: "T",
      investigation: {
        open_questions: [{ question: "Q1?" }, { question: "Q2?" }, { question: "Q3?" }],
      },
    };
    renderPrb(record, [evd("EVD-1", "Obs", ["SUPPORTS"])]);
    expect(screen.getByText("3", { selector: ".prb-scope-metric-value" })).toBeTruthy();
    expect(screen.getAllByText("Questão 1")[0]).toBeTruthy();
    expect(screen.getByText(/Questão 2/)).toBeTruthy();
    expect(screen.getByText(/Questão 3/)).toBeTruthy();
  });

  it("never renders WATCH or Acompanhar for a question whose canonical current_action does not contain them", () => {
    const record = {
      title: "T",
      investigation: {
        open_questions: [
          {
            question: "A falta de informação é causa material?",
            why_open: "Motivo detalhado.",
            current_action: "Não é proporcional prosseguir desafio de deslocação no âmbito atual.",
          },
        ],
      },
    };
    renderPrb(record, []);
    expect(screen.queryByText("WATCH")).toBeNull();
    expect(screen.queryByText("Acompanhar")).toBeNull();
    expect(screen.getByText("Não é proporcional prosseguir desafio de deslocação no âmbito atual.")).toBeTruthy();
  });

  it("renders each canonical open-question field under its own public label", () => {
    const record = {
      title: "T",
      investigation: {
        open_questions: [
          {
            question: "Questão completa?",
            latest_result: "Resultado mais recente registado.",
            why_open: "Motivo pelo qual continua em aberto.",
            resolution_condition: "Condição que falta confirmar.",
            current_action: "Ação que está em curso.",
            evidence: ["EVD-1"],
          },
        ],
      },
    };
    const { container } = renderPrb(record, []);
    const fields = Array.from(requireElement(container, ".prb-open-question-grid").querySelectorAll(".prb-open-question-field")).map((field) => [
      field.querySelector("h4")?.textContent,
      field.querySelector("p")?.textContent ?? field.querySelector(".rec-identifier")?.textContent,
    ]);
    expect(fields).toEqual([
      ["Resultado até agora", "Resultado mais recente registado."],
      ["Porque continua em aberto", "Motivo pelo qual continua em aberto."],
      ["O que permitiria esclarecer", "Condição que falta confirmar."],
      ["Ação atual", "Ação que está em curso."],
      ["Evidência relacionada", "EVD-1"],
    ]);
  });

  it("links the open-question contribution prompt to an evidence contribution for the current Problem", () => {
    renderPrb({ title: "T", investigation: { open_questions: [{ question: "Questão?" }] } });
    const link = screen.getByRole("link", { name: "Contribuir para a investigação →" });
    const href = new URL(link.getAttribute("href") ?? "", "https://example.test");
    expect(href.pathname).toBe("/contact");
    expect(href.searchParams.get("type")).toBe("evidence");
    expect(href.searchParams.get("prb")).toBe("PRB-9999");
  });

  it("omits unauthored question fields except for the presentation-only action fallback", () => {
    const record = {
      title: "T",
      investigation: { open_questions: [{ question: "Questão só com motivo?", why_open: "Motivo." }] },
    };
    const { container } = renderPrb(record, []);
    const labels = Array.from(requireElement(container, ".prb-open-question-grid").querySelectorAll("h4")).map((heading) => heading.textContent);
    expect(labels).toEqual(["Porque continua em aberto", "Ação atual"]);
    expect(screen.getByText("Sem ação em curso")).toBeTruthy();
  });

  it("keeps evidence identifiers last in DOM order for every viewport", () => {
    const { container } = renderPrb({ title: "T", investigation: { open_questions: [{ question: "Q?", latest_result: "Resultado.", why_open: "Motivo.", resolution_condition: "Condição.", evidence: ["EVD-1"], current_action: "Ação." }] } });
    expect(Array.from(requireElement(container, ".prb-open-question-grid").querySelectorAll("h4")).map((heading) => heading.textContent)).toEqual(["Resultado até agora", "Porque continua em aberto", "O que permitiria esclarecer", "Ação atual", "Evidência relacionada"]);
  });

  it("renders a WATCH current_action verbatim as free text — no parsed badge, posture or hidden token", () => {
    const watch = "WATCH — monitorizar medições pós-abertura; a abertura, por si só, não é impacto realizado.";
    const { container } = renderPrb({ title: "T", investigation: { open_questions: [{ question: "Q?", current_action: watch }] } }, []);
    const field = screen.getByText("Ação atual").closest(".prb-open-question-field");
    expect(field?.querySelector("p")?.textContent).toBe(watch);
    expect(screen.queryByText("WATCH")).toBeNull();
    expect(container.querySelector('[class*="badge"], [class*="posture"], [class*="watch"]')).toBeNull();
  });

  it("renders canonical causal_reading verbatim under Leitura atual", () => {
    const causalReading = "Leitura deliberadamente delimitada — os mecanismos permanecem distintos de possíveis lacunas de informação.";
    renderPrb({ title: "T", causal_reading: causalReading }, [evd("EVD-1", "Observação que não pertence a esta secção.", ["SUPPORTS"])]);
    const section = screen.getByRole("region", { name: "Leitura atual" });
    expect(section.querySelector(".prb-current-reading")?.textContent).toBe(causalReading);
    // No evidence subset is attached to the current reading.
    expect(section.querySelector(".rec-identifier")).toBeNull();
    expect(within(section).queryByText("Observação que não pertence a esta secção.")).toBeNull();
  });

  it("omits Leitura atual entirely when causal_reading is unauthored", () => {
    renderPrb({ title: "T" }, [evd("EVD-1", "Obs", ["SUPPORTS"])]);
    expect(screen.queryByRole("region", { name: "Leitura atual" })).toBeNull();
  });

  it("has no standalone selected-evidence section — evidence observations never render as page-level statements", () => {
    const { container } = renderPrb({ title: "T", causal_reading: "Leitura." }, [evd("EVD-1", "Observação da evidência.", ["SUPPORTS"], ["LOCAL_OBSERVATION"], ["Fonte A"])]);
    expect(screen.queryByRole("heading", { level: 3, name: "Resultado até agora" })).toBeNull();
    expect(container.querySelector("#prb-sabemos, .prb-known-evidence-list, .prb-evidence-meta")).toBeNull();
    expect(screen.queryByText("Observação da evidência.")).toBeNull();
  });

  it("presents investigation-path stages as a neutral sequence, with no completion/current/pending indicator", () => {
    const record = {
      title: "T",
      investigation: { path: { initial_signal: { summary: "Sinal inicial." }, development: { summary: "Desenvolvimento." } } },
    };
    const { container } = renderPrb(record, []);
    const path = requireElement(container, ".prb-path-stage-list");
    expect(within(path).getByText("Sinal inicial.")).toBeTruthy();
    expect(within(path).getByText("Desenvolvimento.")).toBeTruthy();
    expect(path.querySelector('[class*="complete"]')).toBeNull();
    expect(path.querySelector('[class*="current"]')).toBeNull();
    expect(path.querySelector('[class*="pending"]')).toBeNull();
  });

  it("renders path stages in authored stage order with 01/02/03 sequence numbers", () => {
    const record = {
      title: "T",
      investigation: {
        path: { delimitation: { summary: "Delimitação." }, initial_signal: { summary: "Sinal." }, development: { summary: "Desenvolvimento." } },
      },
    };
    const { container } = renderPrb(record, []);
    const stages = Array.from(requireElement(container, ".prb-path-stage-list").querySelectorAll(".prb-path-stage")).map((stage) => [
      stage.querySelector(".prb-path-stage-index")?.textContent,
      stage.querySelector(".prb-path-stage-label")?.textContent,
    ]);
    expect(stages).toEqual([
      ["01", "Sinal inicial"],
      ["02", "Desenvolvimento"],
      ["03", "Delimitação"],
    ]);
  });

  it("keeps the dossier download control present but disabled when no dossier data is supplied", () => {
    renderPrb({ title: "T" }, []);
    const dossier = screen.getByRole("button", { name: "↓ Descarregar dossiê (PDF)" });
    expect(dossier).toHaveProperty("disabled", true);
    expect(dossier.getAttribute("aria-disabled")).toBe("true");
  });

  it("enables the dossier download control when the same PRB's dossier data is supplied", () => {
    const projection = baseProjection({ title: "T" }, []);
    render(<PrbDetailsPresentation data={buildPrbDetailsData(projection)} dossier={buildPrbDossierData(projection)} dossierIdentity={{ sourceCommit: "story-test-commit", corpusFingerprint: "story-test-fingerprint" }} {...handlers} />);
    const dossier = screen.getByRole("button", { name: "↓ Descarregar dossiê (PDF)" });
    expect(dossier).toHaveProperty("disabled", false);
    expect(dossier.getAttribute("aria-disabled")).toBeNull();
  });

  it("renders path stages as sequence number, label and summary only — stage evidence IDs stay on the projection, not in the UI", () => {
    const record = {
      title: "T",
      investigation: {
        path: { initial_signal: { summary: "Sinal inicial.", evidence: ["EVD-777"] } },
        open_questions: [{ question: "Q?", evidence: ["EVD-888"] }],
      },
    };
    const projection = baseProjection(record, []);
    expect(buildPrbDetailsData(projection).pathStages[0].evidenceIds).toEqual(["EVD-777"]);
    const { container } = renderPrb(record, []);
    const path = requireElement(container, ".prb-path-stage-list");
    expect(path.textContent).not.toContain("EVD-777");
    expect(path.querySelector(".rec-identifier")).toBeNull();
    expect(within(path).getByText("01")).toBeTruthy();
    expect(within(path).getByText("Sinal inicial.")).toBeTruthy();
    // Open questions keep their related evidence.
    expect(within(requireElement(container, ".prb-open-question-list")).getByRole("button", { name: "Abrir EVD-888" })).toBeTruthy();
  });

  it("orders known effects Sustenta · Refina · Delimita · Contradiz in the tally, followed by unknown effects in their existing order", () => {
    const evidence = [
      evd("EVD-1", "Obs1", ["FUTURE_B", "CONTRADICTS", "BOUNDS", "FUTURE_A", "REFINES", "SUPPORTS"]),
      evd("EVD-2", "Obs2", ["REFINES"]),
    ];
    const { container } = renderPrb({ title: "T" }, evidence);
    const effectTexts = (scope: HTMLElement) => Array.from(scope.querySelectorAll(".prb-effect .evd-effect-tag")).map((tag) => tag.textContent?.trim());
    const expected = ["Sustenta", "Refina", "Delimita", "Contradiz", "FUTURE_B", "FUTURE_A"];
    const tally = requireElement(container, ".prb-audit-effect-tally");
    expect(effectTexts(tally)).toEqual(expected);
    expect(tally.textContent?.replace(/\s+/g, " ").trim()).toBe("Sustenta 1Refina 2Delimita 1Contradiz 1FUTURE_B 1FUTURE_A 1");
    // Canonical order is untouched.
    expect(evidence[0].effects).toEqual(["FUTURE_B", "CONTRADICTS", "BOUNDS", "FUTURE_A", "REFINES", "SUPPORTS"]);
  });

  it("renders Contradiz with the neutral effect treatment and its explicit label", () => {
    const { container } = renderPrb({ title: "T" }, [evd("EVD-1", "Obs", ["CONTRADICTS"])]);
    const tally = requireElement(container, ".prb-audit-effect-tally");
    expect(within(tally).getByText("Contradiz").closest(".prb-effect")?.className).toContain("prb-effect--neutral");
  });

  it("explains the effects and research roles used by the selected Problem", () => {
    const { container } = renderPrb({ title: "T" }, [evd("EVD-1", "Obs", ["SUPPORTS"], ["PLANNED_RESPONSE"])]);
    const legend = requireElement(container, ".prb-audit-effect-legend");
    expect(Array.from(legend.querySelectorAll(".evd-effect-tag")).map((tag) => tag.textContent?.trim())).toEqual(["Sustenta"]);
    const roles = requireElement(container, ".prb-audit-role-legend");
    expect(Array.from(roles.querySelectorAll("dt")).map((dt) => dt.textContent?.trim())).toEqual(["Resposta planeada"]);
    expect(within(roles).getByText("Medida proposta cuja execução não fica demonstrada.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ler o método →" }).getAttribute("href")).toBe("/methodology");
  });

  it("renders no runtime-summary or fabricated audit narrative beyond already-authored effect/count values", () => {
    const record = { title: "T" };
    const evidence = [evd("EVD-1", "Obs", ["SUPPORTS"]), evd("EVD-2", "Obs2", ["REFINES", "BOUNDS"])];
    renderPrb(record, evidence);
    expect(screen.getByText("Verificar esta investigação")).toBeTruthy();
    expect(screen.getByText("2", { selector: "strong" })).toBeTruthy();
  });

  it("renders hero topics as non-interactive text, never as navigable links", () => {
    const record = { title: "T", domain: ["MOB"] };
    const { container } = renderPrb(record, []);
    const topics = requireElement(container, ".prb-identity-topics");
    expect(within(topics).queryByRole("link")).toBeNull();
    expect(container.querySelector(".prb-identity-topic-link")?.tagName).toBe("SPAN");
  });

  it("presents all investigation state values neutrally", () => {
    const { container } = renderPrb({ title: "T", status: "OPEN", evidence_status: "discovered", validation_status: "unvalidated" });
    const accented = Array.from(container.querySelectorAll(".prb-state-value--accent")).map((node) => node.textContent);
    expect(accented).toEqual([]);
  });

  it("does not accent a validation value once validation is complete", () => {
    const { container } = renderPrb({ title: "T", status: "OPEN", validation_status: "validated" });
    expect(container.querySelector(".prb-state-value--accent")).toBeNull();
  });

  it("places the updated_at record-edit line after the problem statement, carrying the PRB id and the canonical date", () => {
    const { container } = renderPrb({ title: "T", problem_statement: "Formulação.", updated_at: "2026-03-05" });
    const statement = requireElement(container, ".prb-identity-statement");
    const updated = requireElement(container, ".prb-identity-updated");
    expect(statement.compareDocumentPosition(updated) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(updated.textContent).toMatch(/^PRB-9999 · Última edição /);
    expect(updated.querySelector("time")?.getAttribute("dateTime")).toBe("2026-03-05");
  });

  it("presents updated_at only as edit metadata, never as a currentness assessment", () => {
    const { container } = renderPrb({ title: "T", updated_at: "2026-03-05" });
    const updated = requireElement(container, ".prb-identity-updated");
    expect(updated.textContent?.replace(/^PRB-9999 · /, "").replace(/\s+/g, " ").trim()).toMatch(/^Última edição \S/);
    expect(container.textContent).not.toMatch(/Atualidade|ainda atual|continua atual|informação atual/i);
  });

  it("keeps header utility accessible names as their text, with decorative icons hidden from assistive tech", () => {
    const { container } = renderPrb({ title: "T" });
    expect(screen.getByRole("link", { name: "Verificar" }).getAttribute("href")).toBe("#prb-auditoria");
    expect(screen.getByRole("button", { name: "Partilhar" })).toBeTruthy();
    const icons = Array.from(container.querySelectorAll(".prb-header-utility-icon, .problem-share-action-icon"));
    expect(icons.map((icon) => icon.textContent)).toEqual(["↓", "↗"]);
    for (const icon of icons) expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders every effect occurrence with its explicit text label, a decorative marker, and a per-effect tone", () => {
    const evidence = [evd("EVD-1", "Obs", ["SUPPORTS", "REFINES"]), evd("EVD-2", "Obs2", ["BOUNDS", "FUTURE_EFFECT"])];
    const { container } = renderPrb({ title: "T" }, evidence);
    const tally = requireElement(container, ".prb-audit-effect-tally");
    const legend = requireElement(container, ".prb-audit-effect-legend");
    for (const scope of [tally, legend]) {
      const labels = Array.from(scope.querySelectorAll(".prb-effect"));
      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) {
        expect(label.querySelector(".prb-effect-marker")?.getAttribute("aria-hidden")).toBe("true");
        expect(label.querySelector(".evd-effect-tag")?.textContent?.trim()).not.toBe("");
      }
    }
    expect(within(tally).getByText("Sustenta").closest(".prb-effect")?.className).toContain("prb-effect--supports");
    expect(within(tally).getByText("Refina").closest(".prb-effect")?.className).toContain("prb-effect--refines");
    expect(within(tally).getByText("Delimita").closest(".prb-effect")?.className).toContain("prb-effect--bounds");
    // An unrecognised future effect keeps its raw label and a neutral tone rather than borrowing another effect's colour.
    expect(within(tally).getByText("FUTURE_EFFECT").closest(".prb-effect")?.className).toContain("prb-effect--neutral");
  });

  it("keeps compact/mobile content complete — every section renders regardless of viewport-only CSS", () => {
    const record = {
      title: "Título completo",
      problem_statement: "Formulação completa.",
      status: "OPEN",
      causal_reading: "Leitura atual registada.",
      investigation: {
        open_questions: [{ question: "Questão aberta?", current_action: "Ação registada." }],
        path: { initial_signal: { summary: "Sinal inicial registado." } },
      },
    };
    renderPrb(record, [evd("EVD-1", "Obs", ["SUPPORTS"])]);
    expect(screen.getByText("Título completo")).toBeTruthy();
    expect(screen.getByText("Formulação completa.")).toBeTruthy();
    expect(screen.getByText("Leitura atual registada.")).toBeTruthy();
    expect(screen.getByText("Questão aberta?")).toBeTruthy();
    expect(screen.getByText("Ação registada.")).toBeTruthy();
    expect(screen.getByText("Sinal inicial registado.")).toBeTruthy();
    expect(screen.getByText("Verificar esta investigação")).toBeTruthy();
  });
});

describe("PrbDetailsPresentation — audit evidence drawer", () => {
  // jsdom has no showModal(); stand in for the native modal API so the drawer's modal path is exercised and observable.
  const showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  beforeEach(() => {
    showModal.mockClear();
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: showModal });
  });
  afterEach(() => {
    Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  });

  const evidence = () => [
    evd("EVD-2", "Segunda observação.", ["SUPPORTS", "REFINES"], ["LOCAL_OBSERVATION"], ["Editor A"]),
    evd("EVD-1", "Primeira observação.", ["BOUNDS"], ["EXISTING_RESPONSE", "LOCAL_OBSERVATION"]),
  ];

  function renderWithEvidence(onOpenGeneric = vi.fn()) {
    render(<PrbDetailsPresentation data={buildPrbDetailsData(baseProjection({ title: "T" }, evidence()))} {...handlers} onOpenGeneric={onOpenGeneric} />);
    return { trigger: screen.getByRole("button", { name: "Ver as 2 evidências" }), onOpenGeneric };
  }

  it("opens one modal drawer from Ver as N evidências, named by its visible title and carrying the truthful count", async () => {
    const { trigger } = renderWithEvidence();
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Evidências usadas neste problema" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(within(dialog).getByRole("heading", { level: 2, name: "Evidências usadas neste problema" })).toBeTruthy();
    expect(within(dialog).getByText("2 evidências")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Fechar" })).toBeTruthy();
  });

  it("renders every evidence record in projection order with its ID, summary, effects, research roles and source references as text", async () => {
    const { trigger } = renderWithEvidence();
    await userEvent.click(trigger);
    const dialog = screen.getByRole("dialog");

    const rows = within(dialog).getAllByRole("listitem").filter((item) => item.classList.contains("prb-evidence-item"));
    expect(rows.map((row) => within(row).getByRole("heading", { level: 3 }).textContent)).toEqual(["EVD-2", "EVD-1"]);

    const [first, second] = rows;
    expect(within(first).getByText("Segunda observação.")).toBeTruthy();
    expect(within(first).getByText("Efeitos").nextElementSibling?.textContent).toBe("SustentaRefina");
    expect(within(first).getByLabelText("Papel: Observação local")).toBeTruthy();
    expect(within(first).getByText("Fonte").nextElementSibling?.textContent).toBe("SRC-EVD-2-0");
    expect(within(second).getByText("Efeito").nextElementSibling?.textContent).toBe("Delimita");
    expect(within(second).getByText("Papéis")).toBeTruthy();
    expect(within(second).queryByText(/^Fontes?$/)).toBeNull();
    // No invented ranking, confidence or strength.
    expect(dialog.textContent).not.toMatch(/confiança|importância|força|relevância/i);
  });

  it("links a public available Source by its readable name and keeps unsafe references as text", async () => {
    const publicEvidence = evd("EVD-public", "Observação.", [], [], ["Editor"]);
    publicEvidence.sources[0].record = {
      name: "Relatório público",
      access: { level: "public", availability: "available" },
      canonical_reference: "https://example.org/report.pdf",
      temporal: { published_at: "2026-06" },
    };
    const unsafeEvidence = evd("EVD-unsafe", "Outra observação.", [], [], ["Editor"]);
    unsafeEvidence.sources[0].record = {
      name: "Referência insegura",
      access: { level: "public", availability: "available" },
      canonical_reference: "javascript:alert(1)",
    };
    render(<PrbDetailsPresentation data={buildPrbDetailsData(baseProjection({ title: "T" }, [publicEvidence, unsafeEvidence]))} {...handlers} />);
    await userEvent.click(screen.getByRole("button", { name: "Ver as 2 evidências" }));
    const dialog = screen.getByRole("dialog");
    const link = within(dialog).getByRole("link", { name: "Relatório público" });
    expect(link.getAttribute("href")).toBe("https://example.org/report.pdf");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(within(dialog).getByText("Referência insegura").closest("a")).toBeNull();
    expect(within(dialog).getByText("Publicado: junho de 2026")).toBeTruthy();
  });

  it("labels evidence observation time separately from source publication time", async () => {
    const observation = evd("EVD-observed", "Observação.", [], [], ["Editor"]);
    observation.detail.record = { evidence_nature: "fact", observation: { summary: "Observação." }, scope: { temporal: { as_of: "2026-08-10" } }, provenance: { extracted_at: "2026-09-01" } };
    observation.sources[0].record = { temporal: { published_at: "2026-07" } };
    renderPrb({ title: "T" }, [observation]);
    await userEvent.click(screen.getByRole("button", { name: "Ver as 1 evidências" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Observado em: 10 de agosto de 2026")).toBeTruthy();
    expect(within(dialog).getByText("Publicado: julho de 2026")).toBeTruthy();
    expect(dialog.textContent).not.toContain("setembro de 2026");
  });

  it("labels point-in-time recommendations as temporal references", async () => {
    const recommendation = evd("EVD-recommendation", "Intervenções propostas.", [], [], ["Editor"], "recommendation");
    recommendation.detail.record = { evidence_nature: "recommendation", observation: { summary: "Intervenções propostas." }, scope: { temporal: { as_of: "2025-09" } } };
    recommendation.sources[0].record = { temporal: { published_at: "2026-06" } };
    renderPrb({ title: "T" }, [recommendation]);
    await userEvent.click(screen.getByRole("button", { name: "Ver as 1 evidências" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Referência temporal: setembro de 2025")).toBeTruthy();
    expect(within(dialog).getByText("Publicado: junho de 2026")).toBeTruthy();
    expect(within(dialog).queryByText("Observado em: setembro de 2025")).toBeNull();
  });

  it("labels authored evidence intervals and omits unknown temporal dates", async () => {
    const annual = evd("EVD-annual", "Atividade anual.", [], [], ["Editor"]);
    annual.detail.record = { observation: { summary: "Atividade anual." }, scope: { temporal: { start: "2025-01", end: "2025-12" } } };
    annual.sources[0].record = { temporal: { published_at: "2026-06" } };
    const interval = evd("EVD-interval", "Intervalo.", [], [], []);
    interval.detail.record = { observation: { summary: "Intervalo." }, scope: { temporal: { start: "2024-09", end: "2025-03" } } };
    const unknown = evd("EVD-unknown", "Data desconhecida.", [], [], []);
    unknown.detail.record = { observation: { summary: "Data desconhecida." }, scope: { temporal: { status: "unknown" } } };
    renderPrb({ title: "T" }, [annual, interval, unknown]);
    await userEvent.click(screen.getByRole("button", { name: "Ver as 3 evidências" }));
    const rows = within(screen.getByRole("dialog")).getAllByRole("listitem").filter((item) => item.classList.contains("prb-evidence-item"));
    expect(within(rows[0]).getByText("Período: 2025")).toBeTruthy();
    expect(within(rows[0]).getByText("Publicado: junho de 2026")).toBeTruthy();
    expect(within(rows[1]).getByText("Período: setembro de 2024 a março de 2025")).toBeTruthy();
    expect(rows[2].querySelector(".prb-evidence-item-temporal")).toBeNull();
  });

  it("dismisses with the close button and returns focus to the opener", async () => {
    const { trigger } = renderWithEvidence();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("dismisses with Escape (and the native cancel event) and returns focus to the opener", async () => {
    const { trigger } = renderWithEvidence();
    await userEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await userEvent.click(trigger);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("opens the canonical EVD Record Detail through onOpenGeneric, closing the drawer without returning focus to the opener", async () => {
    const { trigger, onOpenGeneric } = renderWithEvidence();
    await userEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    // Only a row summary lives in the drawer — never the full EVD Detail.
    expect(dialog.querySelector(".evd-detail-view")).toBeNull();
    expect(within(dialog).queryByText("Origem e auditoria")).toBeNull();

    await userEvent.click(within(dialog).getByRole("button", { name: "Abrir evidência EVD-1" }));
    expect(onOpenGeneric).toHaveBeenCalledTimes(1);
    expect(onOpenGeneric).toHaveBeenCalledWith("EVD-1");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).not.toBe(trigger);
  });

  it("never opens an empty drawer when the Problem links no evidence", async () => {
    renderPrb({ title: "T" }, []);
    const trigger = screen.getByRole("button", { name: "Ver as 0 evidências" });
    expect(trigger).toHaveProperty("disabled", true);
    expect(trigger.getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(trigger);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(showModal).not.toHaveBeenCalled();
  });
});
