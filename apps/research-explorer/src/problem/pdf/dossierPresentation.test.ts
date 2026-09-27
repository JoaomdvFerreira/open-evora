import { describe, expect, it } from "vitest";
import { prb0005DataProvider } from "../prb0005Fixture";
import { loadProblemProjection } from "../problemProjection";
import { buildPrbDossierData, PRB_DOSSIER_PROJECTION_VERSION, type PrbDossierData, type PrbDossierSource } from "../prbDossierProjection";
import { buildDossierDocumentModel, DOSSIER_AUDIT_STATEMENT, DOSSIER_LAST_CHECKED_NOTE, type DossierDocumentModel, type DossierField } from "./dossierPresentation";
import presentationSource from "./dossierPresentation.ts?raw";
import documentSource from "./PrbDossierDocument.tsx?raw";
import generateSource from "./generatePrbDossierPdf.ts?raw";
import fontsSource from "./dossierFonts.ts?raw";
import stylesSource from "./dossierStyles.ts?raw";

/* Synthetic fixtures use unmistakably synthetic identifiers (PRB-9999, EVD-9990xx, SRC-99xx). */

const GENERATED_AT = new Date("2026-09-27T10:30:00Z");

function source(id: string, overrides: Partial<PrbDossierSource> = {}): PrbDossierSource {
  return {
    id,
    name: `Fonte sintética ${id}`,
    publisher: "Município Sintético",
    creators: [],
    resourceType: "document",
    identity: null,
    scope: { geography: { level: "municipality", area: "Cidade Sintética" }, temporal: { asOf: null, start: "2024", end: "2025-06", status: null }, domains: ["MOB"] },
    access: { level: "public", availability: "available", machineReadable: false, method: "download", format: "pdf" },
    acquisition: { method: "public_web", obtainedAt: null },
    canonicalReference: `https://example.org/${id.toLowerCase()}/relatorio-sintetico-com-um-endereco-bastante-longo-para-quebrar.pdf`,
    licensing: { status: "unknown", licence: null, reuse: "unknown", attribution: null },
    temporal: { publishedAt: "2025-07", updatedAt: null, lastCheckedAt: "2026-08-10", updateFrequency: null },
    caveats: [],
    usedByEvidenceIds: [],
    ...overrides,
  };
}

function richDossier(): PrbDossierData {
  return {
    projectionVersion: PRB_DOSSIER_PROJECTION_VERSION,
    problem: {
      id: "PRB-9999",
      createdAt: "2026-08-28",
      updatedAt: "2026-09-25",
      title: "Problema sintético de mobilidade",
      domains: ["MOB", "URB"],
      geography: { level: "city", area: "Cidade Sintética" },
      affectedPopulations: ["residentes", "peões"],
      problemStatement: "Formulação sintética,\ncom quebra de linha.\n\nSegundo parágrafo sintético.",
      causalReading: "Leitura causal sintética.",
      status: "OPEN",
      evidenceStatus: "discovered",
      validationStatus: "unvalidated",
      digitalTractability: "not_assessed",
      solutionLandscapeStatus: "not_assessed",
    },
    investigation: {
      openQuestions: [
        {
          question: "Primeira questão sintética?",
          latestResult: "Resultado sintético.",
          whyOpen: "Motivo sintético.",
          resolutionCondition: "Condição sintética.",
          currentAction: "WATCH — monitorizar dados sintéticos.",
          evidenceIds: ["EVD-999002", "EVD-999001"],
        },
        { question: "Segunda questão sintética?", latestResult: null, whyOpen: null, resolutionCondition: null, currentAction: null, evidenceIds: [] },
      ],
      path: [
        { key: "initial_signal", summary: "Sinal sintético.", evidenceIds: ["EVD-999001"] },
        { key: "delimitation", summary: "Delimitação sintética.", evidenceIds: ["EVD-999002"] },
      ],
    },
    decisionBasis: {
      contractVersion: "1",
      eligibilityBasis: "Base de elegibilidade sintética.",
      corroborationBasis: "Base de corroboração sintética.",
      manifestation: { kind: "observed", summary: "Manifestação sintética.", evidenceIds: ["EVD-999001"] },
      consequence: null,
      currentness: { assessment: "Atualidade sintética.", evidenceIds: [] },
      contradictionSearch: { performed: false, summary: "Pesquisa de contradição sintética.", evidenceIds: [] },
      overlapCheck: { performed: true, summary: "Sobreposição sintética.", relatedProblemIds: ["PRB-9998"] },
      corroborationStatement: "Declaração de corroboração sintética.",
      supportingEvidenceIds: ["EVD-999001"],
      boundaryEvidenceIds: ["EVD-999002"],
      independenceAssessment: "Independência sintética.",
      scope: { geography: "Cidade Sintética,\nzona central.\n\nSegundo parágrafo de âmbito.", population: "peões", temporal: "2025–2026", bounded: false },
      limitations: "Limitações sintéticas.",
    },
    history: [
      { date: "2026-08-31", summary: "Primeira entrada sintética.", evidenceIds: ["EVD-999001"], stateChanges: [{ field: "validation_status", from: "unvalidated", to: "partially_validated" }] },
      { date: "2026-09-16", summary: "Segunda entrada sintética.", evidenceIds: [], stateChanges: [] },
    ],
    evidence: [
      {
        id: "EVD-999002",
        lineageId: null,
        observationSummary: "Mecanismo comparativo sintético.",
        extractedAt: "2026-08-11",
        sourceIds: ["SRC-9902", "SRC-9901"],
        unresolvedSourceIds: [],
        scope: { geography: { level: "international", area: "Outra Cidade" }, populations: ["condutores"], temporal: { asOf: null, start: null, end: null, status: "unknown" } },
        domains: ["DIG"],
        evidenceNature: "claim",
        claimAuthority: "non_authoritative",
        inferenceLimits: ["Sem transferibilidade causal."],
        effects: ["BOUNDS"],
        researchRoles: ["COMPARATIVE_MECHANISM", "COMPARATIVE_RESPONSE"],
      },
      {
        id: "EVD-999001",
        lineageId: "SYN-LINEAGE-1",
        observationSummary: "Observação local sintética.",
        extractedAt: "2026-08-10",
        sourceIds: ["SRC-9901", "SRC-9977"],
        unresolvedSourceIds: ["SRC-9977"],
        scope: { geography: { level: "city", area: "Cidade Sintética" }, populations: ["peões"], temporal: { asOf: "2026-09", start: null, end: null, status: null } },
        domains: ["MOB", "URB"],
        evidenceNature: "measurement",
        claimAuthority: "authoritative",
        inferenceLimits: ["Limite sintético A.", "Limite sintético B."],
        effects: ["SUPPORTS", "REFINES"],
        researchRoles: ["LOCAL_OBSERVATION"],
      },
    ],
    sources: [
      source("SRC-9902", {
        resourceType: "webpage",
        access: { level: "public", availability: "available", machineReadable: "unknown", method: "browser", format: "html" },
        licensing: { status: "known", licence: "CC BY 4.0", reuse: "permitted", attribution: "Autoria sintética" },
        identity: { persistentIdentifier: { scheme: "doi", value: "10.0000/sintetico" }, version: "v2", snapshotReference: "snapshot-sintetico" },
        creators: ["Autora Sintética", "Autor Sintético"],
        caveats: ["Ressalva sintética."],
        usedByEvidenceIds: ["EVD-999002"],
      }),
      source("SRC-9901", { usedByEvidenceIds: ["EVD-999002", "EVD-999001"] }),
    ],
    counts: { evidenceRecordCount: 2, distinctSourceCount: 2, effectCount: 3, openQuestionCount: 2 },
  };
}

function sparseDossier(): PrbDossierData {
  return {
    projectionVersion: PRB_DOSSIER_PROJECTION_VERSION,
    problem: {
      id: "PRB-9999",
      createdAt: null,
      updatedAt: null,
      title: "Problema sintético mínimo",
      domains: [],
      geography: null,
      affectedPopulations: [],
      problemStatement: null,
      causalReading: null,
      status: "OPEN",
      evidenceStatus: null,
      validationStatus: null,
      digitalTractability: null,
      solutionLandscapeStatus: null,
    },
    investigation: { openQuestions: [], path: [] },
    decisionBasis: null,
    history: [],
    evidence: [],
    sources: [],
    counts: { evidenceRecordCount: 0, distinctSourceCount: 0, effectCount: 0, openQuestionCount: 0 },
  };
}

/** Every string the document model will print, flattened. */
function printedText(model: DossierDocumentModel): string {
  const strings: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") strings.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object" && !(value instanceof Date)) Object.values(value).forEach(walk);
  };
  walk(model);
  return strings.join("\n");
}

function field(fields: DossierField[], label: string): DossierField | undefined {
  return fields.find((entry) => entry.label === label);
}

const rich = () => buildDossierDocumentModel(richDossier(), { generatedAt: GENERATED_AT });

describe("PDF dossier document model", () => {
  it("presents PRB identity on the cover and in the PDF metadata", () => {
    const model = rich();
    expect(model.cover).toMatchObject({ brand: "Open Évora", kicker: "Dossiê de investigação", problemId: "PRB-9999", title: "Problema sintético de mobilidade" });
    expect(model.cover.context).toBe("Cidade Sintética · Mobilidade · Urbanismo");
    expect(model.cover.updated).toBe("Registo atualizado em 25 de setembro de 2026");
    expect(model.metadata).toMatchObject({ title: "PRB-9999 · Problema sintético de mobilidade", author: "Open Évora", language: "pt-PT", creationDate: GENERATED_AT });
    expect(model.metadata.subject).toContain("PRB-9999");
    expect(model.runningHeader).toBe("Open Évora · PRB-9999");
  });

  it("lists every available section in the canonical order", () => {
    expect(rich().contents.map((entry) => `${entry.number} ${entry.title}`)).toEqual([
      "01 Síntese",
      "02 Questões em aberto",
      "03 Percurso da investigação",
      "04 Evidência",
      "05 Fontes",
      "06 Base da investigação",
      "07 Histórico",
      "08 Auditoria",
    ]);
  });

  it("presents the summary with PT-PT public labels, counts and authored prose paragraphs", () => {
    const { summary } = rich();
    expect(summary.states).toEqual([
      { label: "Estado", value: "Aberto" },
      { label: "Evidência", value: "Identificada" },
      { label: "Validação", value: "Por validar" },
    ]);
    expect(summary.counts.map((count) => count.value)).toEqual(["2", "3", "2"]);
    expect(summary.facts.map((entry) => [entry.label, entry.text])).toEqual([
      ["Âmbito geográfico", "Cidade · Cidade Sintética"],
      ["Populações afetadas", "residentes · peões"],
      ["Temas", "Mobilidade (MOB) · Urbanismo (URB)"],
      ["Tratabilidade digital", "Não avaliada"],
      ["Soluções existentes", "Não avaliadas"],
    ]);
    expect(summary.statement?.paragraphs).toEqual(["Formulação sintética, com quebra de linha.", "Segundo parágrafo sintético."]);
    expect(summary.causalReading?.paragraphs).toEqual(["Leitura causal sintética."]);
  });

  it("keeps every open-question field distinct, in authored order, with free-text actions unparsed", () => {
    const { openQuestions } = rich();
    expect(openQuestions?.items.map((item) => item.question)).toEqual(["Primeira questão sintética?", "Segunda questão sintética?"]);
    const [first, second] = openQuestions!.items;
    expect(first.prose).toEqual([
      { label: "O que sabemos até agora", paragraphs: ["Resultado sintético."] },
      { label: "Porque continua em aberto", paragraphs: ["Motivo sintético."] },
      { label: "O que falta confirmar", paragraphs: ["Condição sintética."] },
      { label: "O que estamos a fazer", paragraphs: ["WATCH — monitorizar dados sintéticos."] },
    ]);
    expect(first.evidence.map((ref) => ref.id)).toEqual(["EVD-999002", "EVD-999001"]);
    expect(second.prose).toEqual([]);
    expect(second.evidence).toEqual([]);
  });

  it("presents the investigation path as authored narrative stages", () => {
    expect(rich().path?.stages.map((stage) => [stage.number, stage.label, stage.paragraphs[0], stage.evidence.map((ref) => ref.id)])).toEqual([
      ["01", "Sinal inicial", "Sinal sintético.", ["EVD-999001"]],
      ["02", "Delimitação", "Delimitação sintética.", ["EVD-999002"]],
    ]);
  });

  it("presents every evidence record in dossier order with its public labels, relationship and provenance", () => {
    const { evidence } = rich();
    expect(evidence?.items.map((item) => item.id)).toEqual(["EVD-999002", "EVD-999001"]);
    const local = evidence!.items[1];
    expect(local.summary).toEqual(["Observação local sintética."]);
    expect(local.relation.map((entry) => [entry.label, entry.text])).toEqual([
      ["Efeitos", "Sustenta · Refina"],
      ["Papel", "Observação local"],
    ]);
    expect(Object.fromEntries(local.facts.map((entry) => [entry.label, entry.text ?? entry.refs?.map((ref) => `${ref.id}${ref.destination ? "#" : ""}`).join(" ")]))).toEqual({
      Temas: "Mobilidade (MOB) · Urbanismo (URB)",
      "Âmbito geográfico": "Cidade · Cidade Sintética",
      Populações: "peões",
      "Cobertura temporal": "setembro de 2026",
      "Extraída pelo Open Évora": "10 de agosto de 2026",
      "Natureza da evidência": "Medição",
      "Autoridade da alegação": "Com autoridade",
      Fontes: "SRC-9901# SRC-9977",
      "Fontes sem registo disponível": "SRC-9977",
      Linhagem: "SYN-LINEAGE-1",
    });
    expect(local.inferenceLimits).toEqual(["Limite sintético A.", "Limite sintético B."]);
    expect(field(evidence!.items[0].facts, "Cobertura temporal")?.text).toBe("Desconhecida");
    expect(field(evidence!.items[0].facts, "Autoridade da alegação")?.text).toBe("Sem autoridade sobre a alegação");
  });

  it("presents every distinct source once, in dossier order, with access, reuse and Open Évora checking kept as separate dimensions", () => {
    const { sources } = rich();
    expect(sources?.items.map((item) => item.id)).toEqual(["SRC-9902", "SRC-9901"]);
    const [licensed, unknownReuse] = sources!.items;
    const labels = (item: typeof licensed) => Object.fromEntries(item.facts.map((entry) => [entry.label, entry.text ?? entry.href ?? entry.refs?.map((ref) => ref.id).join(" ")]));
    expect(labels(licensed)).toMatchObject({
      Autores: "Autora Sintética · Autor Sintético",
      "Tipo de recurso": "Página web",
      "Identificador persistente": "doi: 10.0000/sintetico",
      Versão: "v2",
      "Referência de arquivo": "snapshot-sintetico",
      "Nível de acesso": "Público",
      Disponibilidade: "Disponível",
      "Leitura automática": "Desconhecida",
      "Estado do licenciamento": "Conhecido",
      Licença: "CC BY 4.0",
      Reutilização: "Permitida",
      Atribuição: "Autoria sintética",
      "Utilizada em": "EVD-999002",
    });
    expect(labels(unknownReuse)).toMatchObject({
      "Nível de acesso": "Público",
      Disponibilidade: "Disponível",
      Reutilização: "Desconhecida",
      "Leitura automática": "Não",
      "Cobertura temporal": "2024 – junho de 2025",
      Publicação: "julho de 2025",
      "Última verificação pelo Open Évora": "10 de agosto de 2026",
      "Forma de obtenção": "Web pública",
      "Utilizada em": "EVD-999002 EVD-999001",
    });
    expect(licensed.caveats).toEqual(["Ressalva sintética."]);
    const lastChecked = unknownReuse.facts.find((entry) => entry.text === "10 de agosto de 2026");
    expect(lastChecked?.label).toBe("Última verificação pelo Open Évora");
    expect(lastChecked?.label).not.toMatch(/valida|atualidade|autoridade/i);
  });

  it("presents a canonical URL as a concise external action that links to the exact reference, without printing the URL", () => {
    const dossier = richDossier();
    const { sources } = buildDossierDocumentModel(dossier, { generatedAt: GENERATED_AT });
    for (const item of sources!.items) {
      const canonical = dossier.sources.find((entry) => entry.id === item.id)!.canonicalReference;
      expect(field(item.facts, "Referência original")).toEqual({ label: "Referência original", href: canonical, linkText: "Abrir fonte original ↗" });
    }
    const visible = JSON.stringify(buildDossierDocumentModel(dossier, { generatedAt: GENERATED_AT }), (key, value: unknown) => (key === "href" ? undefined : value));
    expect(visible).not.toMatch(/https?:\/\//);
  });

  it("never fabricates a link for a source without a valid canonical URL", () => {
    const dossier = richDossier();
    dossier.sources[0] = { ...dossier.sources[0], canonicalReference: "Arquivo municipal, caixa 12" };
    dossier.sources[1] = { ...dossier.sources[1], canonicalReference: null };
    const [nonUrl, absent] = buildDossierDocumentModel(dossier, { generatedAt: GENERATED_AT }).sources!.items;
    expect(field(nonUrl.facts, "Referência original")).toEqual({ label: "Referência original", text: "Arquivo municipal, caixa 12" });
    expect(field(absent.facts, "Referência original")).toBeUndefined();
    expect([...nonUrl.facts, ...absent.facts].some((entry) => entry.href || entry.linkText)).toBe(false);
  });

  it("links evidence and source references to their in-document entries only when those records are printed", () => {
    const model = rich();
    const refs = model.openQuestions!.items[0].evidence;
    expect(refs.every((ref) => ref.destination === `dossie-${ref.id}`)).toBe(true);
    expect(model.evidence!.items.map((item) => item.destination)).toEqual(["dossie-EVD-999002", "dossie-EVD-999001"]);
    const overlap = model.decisionBasis!.blocks.find((block) => block.heading === "Verificação de sobreposição")!;
    expect(field(overlap.fields, "Problemas relacionados")?.refs).toEqual([{ id: "PRB-9998", destination: null }]);
  });

  it("renders the decision basis faithfully, including explicit false values, and never fabricates absent parts", () => {
    const { decisionBasis } = rich();
    const block = (heading: string) => decisionBasis!.blocks.find((entry) => entry.heading === heading);
    expect(field(block("Procura de evidência contrária")!.fields, "Realizada")?.text).toBe("Não");
    expect(field(block("Verificação de sobreposição")!.fields, "Realizada")?.text).toBe("Sim");
    expect(field(block("Âmbito")!.fields, "Delimitado")?.text).toBe("Não");
    expect(field(block("Âmbito")!.fields, "Geográfico")?.paragraphs).toEqual(["Cidade Sintética, zona central.", "Segundo parágrafo de âmbito."]);
    expect(block("Consequência")).toBeUndefined();
    expect(block("Base de elegibilidade")?.paragraphs).toEqual(["Base de elegibilidade sintética."]);
    expect(field(block("Versão do contrato")!.fields, "Versão")?.text).toBe("1");
  });

  it("presents history in dossier order with authored state changes and evidence", () => {
    const { history } = rich();
    expect(history?.entries.map((entry) => entry.date)).toEqual(["31 de agosto de 2026", "16 de setembro de 2026"]);
    expect(history!.entries[0].fields.map((entry) => [entry.label, entry.text ?? entry.refs?.map((ref) => ref.id).join(" ")])).toEqual([
      ["Estado de validação", "De «Por validar» para «Parcialmente validado»"],
      ["Evidência", "EVD-999001"],
    ]);
    expect(history!.entries[1].fields).toEqual([]);
  });

  it("closes with audit metadata and the durable reading notes", () => {
    const { audit } = rich();
    expect(audit.statement).toBe(DOSSIER_AUDIT_STATEMENT);
    expect(audit.notes).toContain(DOSSIER_LAST_CHECKED_NOTE);
    expect(Object.fromEntries(audit.fields.map((entry) => [entry.label, entry.text]))).toMatchObject({
      Problema: "PRB-9999",
      "Registo atualizado em": "25 de setembro de 2026",
      "Versão da projeção do dossiê": String(PRB_DOSSIER_PROJECTION_VERSION),
      "Registos de evidência": "2",
      "Fontes distintas": "2",
      "Efeitos PRB–EVD": "3",
      "Questões em aberto": "2",
    });
    expect(field(audit.fields, "Documento gerado em")?.text).toContain("2026");
  });

  it("omits unavailable sections and fields cleanly for a sparse dossier, with no placeholder research content", () => {
    const model = buildDossierDocumentModel(sparseDossier(), { generatedAt: GENERATED_AT });
    expect(model.contents.map((entry) => entry.title)).toEqual(["Síntese", "Auditoria"]);
    expect([model.openQuestions, model.path, model.evidence, model.sources, model.decisionBasis, model.history]).toEqual([null, null, null, null, null, null]);
    expect(model.summary.states).toEqual([{ label: "Estado", value: "Aberto" }]);
    expect(model.summary.facts).toEqual([]);
    expect(model.summary.statement).toBeNull();
    expect(model.cover.context).toBeNull();
    expect(model.cover.updated).toBeNull();
    expect(printedText(model)).not.toMatch(/sem informação|não disponível|n\/d|undefined|null/i);
  });

  it("is a pure function of the dossier and generation time — the timestamp never reorders or alters research content", () => {
    const later = buildDossierDocumentModel(richDossier(), { generatedAt: new Date("2027-01-01T00:00:00Z") });
    const strip = (model: DossierDocumentModel) => ({ ...model, metadata: { ...model.metadata, creationDate: null }, audit: { ...model.audit, fields: model.audit.fields.filter((entry) => entry.label !== "Documento gerado em") } });
    expect(strip(later)).toEqual(strip(rich()));
    const dossier = richDossier();
    const before = structuredClone(dossier);
    buildDossierDocumentModel(dossier, { generatedAt: GENERATED_AT });
    expect(dossier).toEqual(before);
  });

  it("generates no ranking, score, strength or confidence value", () => {
    const text = printedText(rich());
    expect(text).not.toMatch(/ranking|score|pontua|confian|força da evid|importância|fiabilidade da evid/i);
    expect(JSON.stringify(rich())).not.toMatch(/"(rank|score|confidence|strength|weight|importance)"/i);
  });
});

describe("PDF dossier production copy", () => {
  const FORBIDDEN = [/protótipo/i, /Exemplo gerado/i, /renderer final/i, /validar composição/i, /O objetivo deste exemplo/i, /\bB0[23]\b/, /pré-B03/i];
  it("names Open Évora as the actor with «pelo», never «pela»", () => {
    const text = printedText(rich());
    expect(text).toContain("Extraída pelo Open Évora");
    expect(text).toContain("Última verificação pelo Open Évora");
    expect(text).toContain(DOSSIER_AUDIT_STATEMENT);
    expect(text).toContain(DOSSIER_LAST_CHECKED_NOTE);
    expect(text).not.toMatch(/pela Open Évora/);
    expect(code(presentationSource)).not.toMatch(/pela Open Évora/);
  });

  it("never prints prototype or development commentary from the document templates", () => {
    for (const source of [presentationSource, documentSource]) {
      for (const pattern of FORBIDDEN) expect(code(source)).not.toMatch(pattern);
    }
    const text = printedText(rich());
    for (const pattern of [...FORBIDDEN, /PrbDossierData/, /renderer/i, /projeção editorial/i]) expect(text).not.toMatch(pattern);
  });

  it("leaves canonical research content untouched even when it contains a guarded word", () => {
    const dossier = richDossier();
    dossier.problem.causalReading = "O protótipo municipal de 2025 foi descontinuado.";
    expect(buildDossierDocumentModel(dossier, { generatedAt: GENERATED_AT }).summary.causalReading?.paragraphs).toEqual(["O protótipo municipal de 2025 foi descontinuado."]);
  });
});

describe("PDF dossier data boundary", () => {
  it("builds the document only from PrbDossierData — no data provider, network, file or page DOM access in the renderer", () => {
    for (const source of [presentationSource, documentSource, stylesSource, generateSource]) {
      expect(code(source)).not.toMatch(/dataProvider|DataProvider|getRecord|listRecords|fetch\(|XMLHttpRequest|node:fs|yaml|document\.|querySelector|window\./);
      expect(source).not.toMatch(/\.css["']/);
    }
    expect(code(generateSource)).toMatch(/buildDossierDocumentModel\(dossier/);
    expect(presentationSource).not.toMatch(/buildPrbDossierData|problemProjection/);
    // The font module loads only its own bundled font files.
    expect(code(fontsSource).match(/fetch\(([^)]*)\)/g)).toEqual(["fetch(file)"]);
  });

  it("renders the complete real PRB-0005 dossier projection", async () => {
    const lookup = new Map((await prb0005DataProvider.listRecords()).map((summary) => [summary.id, summary]));
    const dossier = buildPrbDossierData(await loadProblemProjection(prb0005DataProvider, lookup, "PRB-0005"));
    const model = buildDossierDocumentModel(dossier, { generatedAt: GENERATED_AT });
    expect(model.evidence?.items).toHaveLength(dossier.counts.evidenceRecordCount);
    expect(model.sources?.items).toHaveLength(dossier.counts.distinctSourceCount);
    expect(model.evidence?.items.map((item) => item.id)).toEqual(dossier.evidence.map((item) => item.id));
    expect(model.sources?.items.map((item) => item.id)).toEqual(dossier.sources.map((item) => item.id));
    expect(model.openQuestions?.items).toHaveLength(dossier.counts.openQuestionCount);
    expect(model.decisionBasis).toBeNull();
    expect(model.history?.entries).toHaveLength(dossier.history.length);
  });
});

/** Source text with comments removed — only what can reach the printed document or run. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
