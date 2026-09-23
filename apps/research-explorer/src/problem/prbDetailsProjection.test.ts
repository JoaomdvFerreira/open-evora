import { describe, expect, it } from "vitest";
import type { RecordDetail } from "../dataProvider/types";
import type { EvidenceWithSources, ProblemProjection } from "./problemProjection";
import { buildPrbDetailsData, effectTally, investigationPathStages, knownEvidenceStatements, openQuestions } from "./prbDetailsProjection";

function evd(id: string, summary: string, effects: string[] = [], researchRoles: string[] = [], sourcePublishers: string[] = []): EvidenceWithSources {
  const detail: RecordDetail = {
    id,
    type: "EVD-",
    file: "",
    outgoingEdges: [],
    incomingEdges: [],
    record: { observation: { summary } },
  };
  const sources: RecordDetail[] = sourcePublishers.map((publisher, index) => ({
    id: `SRC-${index}`,
    type: "SRC-",
    file: "",
    outgoingEdges: [],
    incomingEdges: [],
    record: { publisher },
  }));
  return { detail, sources, effects, researchRoles };
}

function problem(record: Record<string, unknown>, evidence: EvidenceWithSources[]): ProblemProjection {
  return {
    problem: { id: "PRB-9999", type: "PRB-", file: "research/problems/PRB-9999.yaml", record, outgoingEdges: [], incomingEdges: [] },
    evidence,
  };
}

describe("prbDetailsProjection — canonical mapping for the generic PRB Details composition", () => {
  it("never fabricates the WATCH/Acompanhar label for an open question lacking a canonical current_action", () => {
    const record = {
      title: "Problema de teste",
      investigation: {
        open_questions: [
          { question: "Questão sem ação atual registada?", why_open: "Ainda em aberto." },
        ],
      },
    };
    const [question] = openQuestions(record);
    expect(question.currentAction).toBeNull();
  });

  it("renders current_action exactly as authored, never a parsed posture keyword or reference-only label", () => {
    const record = {
      investigation: {
        open_questions: [
          { question: "Questão com ação registada?", current_action: "WATCH — monitorizar dados adicionais." },
        ],
      },
    };
    const [question] = openQuestions(record);
    expect(question.currentAction).toBe("WATCH — monitorizar dados adicionais.");
  });

  it("supports multiple open questions with independently authored fields", () => {
    const record = {
      investigation: {
        open_questions: [
          { question: "Primeira questão?", why_open: "Motivo 1.", evidence: ["EVD-1"] },
          { question: "Segunda questão?", current_action: "Ação 2.", evidence: ["EVD-2", "EVD-3"] },
        ],
      },
    };
    const questions = openQuestions(record);
    expect(questions).toHaveLength(2);
    expect(questions[0].relatedEvidenceIds).toEqual(["EVD-1"]);
    expect(questions[1].relatedEvidenceIds).toEqual(["EVD-2", "EVD-3"]);
  });

  it("keeps investigation.path stages in fixed canonical order and omits unauthored stages", () => {
    const record = {
      investigation: {
        path: {
          delimitation: { summary: "Delimitação.", evidence: [] },
          initial_signal: { summary: "Sinal inicial.", evidence: [] },
        },
      },
    };
    const stages = investigationPathStages(record);
    expect(stages.map((stage) => stage.key)).toEqual(["initial_signal", "delimitation"]);
  });

  it("assigns no completion/current/pending state to path stages — a stage carries only its key, label, summary and evidence", () => {
    const record = { investigation: { path: { development: { summary: "Em curso." } } } };
    const [stage] = investigationPathStages(record);
    expect(Object.keys(stage).sort()).toEqual(["evidenceIds", "key", "label", "summary"]);
  });

  it("tallies multiple effects across multiple evidence items without ranking", () => {
    const evidence = [evd("EVD-1", "Obs 1", ["SUPPORTS"]), evd("EVD-2", "Obs 2", ["REFINES", "BOUNDS"]), evd("EVD-3", "Obs 3", ["REFINES"])];
    const tally = effectTally(evidence);
    expect(tally).toEqual([
      { value: "SUPPORTS", count: 1 },
      { value: "REFINES", count: 2 },
      { value: "BOUNDS", count: 1 },
    ]);
  });

  it("supports multiple research roles and multiple sources on one evidence relationship", () => {
    const evidence = [evd("EVD-1", "Obs", ["REFINES", "BOUNDS"], ["LOCAL_OBSERVATION", "EXISTING_RESPONSE"], ["Município de Évora", "ODigital"])];
    const [item] = knownEvidenceStatements(problem({}, evidence), ["EVD-1"]);
    expect(item.effects).toEqual(["REFINES", "BOUNDS"]);
    expect(item.researchRoles).toEqual(["LOCAL_OBSERVATION", "EXISTING_RESPONSE"]);
    expect(item.sourcePublishers).toEqual(["Município de Évora", "ODigital"]);
  });

  it("narrows known-evidence statements to a caller-supplied evidence-id subset, in the caller's order", () => {
    const evidence = [evd("EVD-1", "Obs 1"), evd("EVD-2", "Obs 2"), evd("EVD-3", "Obs 3")];
    const projection = problem({}, evidence);
    const items = knownEvidenceStatements(projection, ["EVD-3", "EVD-1"]);
    expect(items.map((item) => item.evidenceId)).toEqual(["EVD-3", "EVD-1"]);
  });

  it("selects no knowledge items when the caller supplies no evidence-id selection — no implicit render-all fallback", () => {
    const evidence = [evd("EVD-1", "Obs 1"), evd("EVD-2", "Obs 2")];
    const items = knownEvidenceStatements(problem({}, evidence));
    expect(items).toEqual([]);
  });

  it("selects no knowledge items when the caller supplies an empty evidence-id selection", () => {
    const evidence = [evd("EVD-1", "Obs 1"), evd("EVD-2", "Obs 2")];
    const items = knownEvidenceStatements(problem({}, evidence), []);
    expect(items).toEqual([]);
  });

  it("derives singular/plural-relevant counts directly from canonical presence, never a fabricated default", () => {
    const record = {
      title: "Problema com uma questão",
      investigation: { open_questions: [{ question: "Questão única?" }] },
    };
    const evidence = [evd("EVD-1", "Obs", ["SUPPORTS"])];
    const data = buildPrbDetailsData(problem(record, evidence));
    expect(data.openQuestionCount).toBe(1);
    expect(data.evidenceRecordCount).toBe(1);
    expect(data.evidenceEffectCount).toBe(1);
  });

  it("omits status/evidenceStatus/validationStatus/geographyScope when the canonical field is absent", () => {
    const data = buildPrbDetailsData(problem({ title: "Problema mínimo" }, []));
    expect(data.status).toBeNull();
    expect(data.evidenceStatus).toBeNull();
    expect(data.validationStatus).toBeNull();
    expect(data.geographyScope).toBeNull();
    expect(data.openQuestionCount).toBe(0);
    expect(data.pathStages).toEqual([]);
  });
});
