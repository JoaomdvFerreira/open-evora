import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PrbDetailsPresentation } from "./PrbDetailsPresentation";
import { buildPrbDetailsData } from "./prbDetailsProjection";
import type { RecordDetail } from "../dataProvider/types";
import type { EvidenceWithSources, ProblemProjection } from "./problemProjection";

function evd(id: string, summary: string, effects: string[] = [], researchRoles: string[] = [], sourcePublishers: string[] = []): EvidenceWithSources {
  const detail: RecordDetail = { id, type: "EVD-", file: "", outgoingEdges: [], incomingEdges: [], record: { observation: { summary } } };
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
  it("renders the canonical title and statement exactly as authored", () => {
    renderPrb({ title: "Título canónico do problema", problem_statement: "Formulação canónica delimitada." });
    expect(screen.getByRole("heading", { name: "Título canónico do problema" })).toBeTruthy();
    expect(screen.getByText("Formulação canónica delimitada.")).toBeTruthy();
  });

  it("renders state/evidence/validation labels only when their canonical field is present", () => {
    renderPrb({ title: "T", status: "OPEN", evidence_status: "discovered", validation_status: "unvalidated" });
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
    const { container } = renderPrb(record, [evd("EVD-1", "Obs", ["SUPPORTS"])]);
    const scope = requireElement(container, ".prb-scope-metrics");
    expect(within(scope).getByText("questão aberta")).toBeTruthy();
    expect(within(scope).getByText("registo")).toBeTruthy();
    expect(within(scope).getByText("efeito")).toBeTruthy();
  });

  it("shows plural scope labels when counts exceed one", () => {
    const record = {
      title: "T",
      investigation: { open_questions: [{ question: "Q1?" }, { question: "Q2?" }] },
    };
    const { container } = renderPrb(record, [evd("EVD-1", "Obs", ["SUPPORTS", "REFINES"]), evd("EVD-2", "Obs2", ["BOUNDS"])]);
    const scope = requireElement(container, ".prb-scope-metrics");
    expect(within(scope).getByText("questões abertas")).toBeTruthy();
    expect(within(scope).getByText("registos")).toBeTruthy();
    expect(within(scope).getByText("efeitos")).toBeTruthy();
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
      field.querySelector("h3")?.textContent,
      field.querySelector("p")?.textContent ?? field.querySelector(".rec-identifier")?.textContent,
    ]);
    expect(fields).toEqual([
      ["O que sabemos até agora", "Resultado mais recente registado."],
      ["Porque continua em aberto", "Motivo pelo qual continua em aberto."],
      ["O que falta confirmar", "Condição que falta confirmar."],
      ["O que estamos a fazer", "Ação que está em curso."],
      ["Evidência relacionada", "EVD-1"],
    ]);
  });

  it("omits each open-question block whose canonical field is absent, never a fallback", () => {
    const record = {
      title: "T",
      investigation: { open_questions: [{ question: "Questão só com motivo?", why_open: "Motivo." }] },
    };
    const { container } = renderPrb(record, []);
    const labels = Array.from(requireElement(container, ".prb-open-question-grid").querySelectorAll("h3")).map((heading) => heading.textContent);
    expect(labels).toEqual(["Porque continua em aberto"]);
  });

  describe("at >=1024 (two independent stacks)", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    function stubWideViewport() {
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: query === "(min-width: 1024px)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));
    }

    function fieldLabels(scope: Element) {
      return Array.from(scope.querySelectorAll(":scope > .prb-open-question-field > h3")).map((heading) => heading.textContent);
    }

    it("keeps latest_result full-width, then why_open/current_action left and resolution_condition/evidence right", () => {
      stubWideViewport();
      const { container } = renderPrb({
        title: "T",
        investigation: {
          open_questions: [
            {
              question: "Q?",
              latest_result: "Resultado.",
              why_open: "Motivo.",
              resolution_condition: "Condição.",
              current_action: "Ação.",
              evidence: ["EVD-1"],
            },
          ],
        },
      });
      const grid = requireElement(container, ".prb-open-question-grid--stacked");
      expect(fieldLabels(grid)).toEqual(["O que sabemos até agora"]);
      expect(fieldLabels(requireElement(grid, ".prb-open-question-stack--primary"))).toEqual(["Porque continua em aberto", "O que estamos a fazer"]);
      expect(fieldLabels(requireElement(grid, ".prb-open-question-stack--secondary"))).toEqual(["O que falta confirmar", "Evidência relacionada"]);
    });

    it("omits absent fields and empty stacks, never a placeholder", () => {
      stubWideViewport();
      const { container } = renderPrb({ title: "T", investigation: { open_questions: [{ question: "Q?", why_open: "Motivo." }] } });
      const grid = requireElement(container, ".prb-open-question-grid--stacked");
      expect(Array.from(grid.querySelectorAll("h3")).map((heading) => heading.textContent)).toEqual(["Porque continua em aberto"]);
      expect(grid.querySelector(".prb-open-question-stack--secondary")).toBeNull();
    });

    it("keeps a WATCH current_action verbatim", () => {
      stubWideViewport();
      const watch = "WATCH — monitorizar medições pós-abertura.";
      const { container } = renderPrb({ title: "T", investigation: { open_questions: [{ question: "Q?", current_action: watch }] } });
      expect(requireElement(container, ".prb-open-question-stack--primary").querySelector("p")?.textContent).toBe(watch);
      expect(screen.queryByText("WATCH")).toBeNull();
    });
  });

  it("renders a WATCH current_action verbatim as free text — no parsed badge, posture or hidden token", () => {
    const watch = "WATCH — monitorizar medições pós-abertura; a abertura, por si só, não é impacto realizado.";
    const { container } = renderPrb({ title: "T", investigation: { open_questions: [{ question: "Q?", current_action: watch }] } }, []);
    const field = screen.getByText("O que estamos a fazer").closest(".prb-open-question-field");
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
    expect(screen.queryByRole("heading", { level: 2, name: "O que sabemos até agora" })).toBeNull();
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

  it("keeps the dossier download control present but disabled", () => {
    renderPrb({ title: "T" }, []);
    const dossier = screen.getByRole("button", { name: "↓ Descarregar dossiê (PDF)" });
    expect(dossier).toHaveProperty("disabled", true);
    expect(dossier.getAttribute("aria-disabled")).toBe("true");
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

  it("keeps Como verificamos to the approved effect and research-role examples", () => {
    const { container } = renderPrb({ title: "T" }, [evd("EVD-1", "Obs", ["SUPPORTS"], ["PLANNED_RESPONSE"])]);
    const legend = requireElement(container, ".prb-audit-effect-legend");
    expect(Array.from(legend.querySelectorAll(".evd-effect-tag")).map((tag) => tag.textContent?.trim())).toEqual(["Sustenta", "Refina", "Delimita"]);
    const roles = requireElement(container, ".prb-audit-role-legend");
    expect(Array.from(roles.querySelectorAll("dt")).map((dt) => dt.textContent?.trim())).toEqual(["Observação local", "Resposta existente"]);
    expect(within(roles).getByText("Dado, medição ou relato recolhido sobre a situação em Évora.")).toBeTruthy();
    expect(within(roles).getByText("Medida, serviço ou plano que já responde, total ou parcialmente, ao problema.")).toBeTruthy();
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

  it("accents only an outstanding validation step, keeping lifecycle and evidence values neutral", () => {
    const { container } = renderPrb({ title: "T", status: "OPEN", evidence_status: "discovered", validation_status: "unvalidated" });
    const accented = Array.from(container.querySelectorAll(".prb-state-value--accent")).map((node) => node.textContent);
    expect(accented).toEqual(["Por validar"]);
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
    expect(updated.textContent).toMatch(/^PRB-9999 · Atualizado em /);
    expect(updated.querySelector("time")?.getAttribute("dateTime")).toBe("2026-03-05");
  });

  it("presents updated_at only as edit metadata, never as a currentness assessment", () => {
    const { container } = renderPrb({ title: "T", updated_at: "2026-03-05" });
    const updated = requireElement(container, ".prb-identity-updated");
    expect(updated.textContent?.replace(/^PRB-9999 · /, "").replace(/\s+/g, " ").trim()).toMatch(/^Atualizado em \S/);
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
