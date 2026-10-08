import { formatPublicCount, formatPublicPartialDate, publicCompactEnumLabel, publicEnumLabel, publicFieldCaption, publicTriStateLabel } from "../../presentation/presentation";
import { describeTopic } from "../../presentation/topicMapping";
import { PATH_STAGE_LABELS } from "../prbDetailsProjection";
import type { PrbDossierData, PrbDossierDecisionBasis, PrbDossierEvidence, PrbDossierGeography, PrbDossierSource, PrbDossierTemporalScope } from "../prbDossierProjection";

/**
 * Pure `PrbDossierData -> DossierDocumentModel` presentation step of the PDF
 * dossier: every PT-PT label, date format, section order and piece of
 * production copy the document prints is decided here, so the React-PDF
 * composition (PrbDossierDocument.tsx) only lays the model out.
 *
 * It consumes nothing but `PrbDossierData` (prbDossierProjection.ts) plus
 * explicit generation metadata — no DataProvider, fetch, file, DOM or website CSS.
 * Canonical values are presented, never re-derived: labels come from the
 * shared presentation authorities (presentation.ts, topicMapping.ts,
 * PATH_STAGE_LABELS), authored order is kept everywhere, explicit `false`
 * renders as "Não", absent content omits its row/section rather than
 * printing a placeholder, and no ranking, strength or reliability value is
 * produced.
 */

/** Generation-layer metadata, captured once per generated PDF and never fed back into research ordering or semantics. */
export interface DossierGenerationMetadata {
  generatedAt: Date;
  corpusFingerprint: string;
  sourceCommit: string | null;
}

export type DossierSectionId = "sintese" | "questoes" | "percurso" | "evidencia" | "fontes" | "base" | "historico" | "auditoria";

/** A canonical record ID; `destination` is its in-document anchor when the record is printed in this dossier, otherwise `null`. */
export interface DossierRef {
  id: string;
  destination: string | null;
}

/** One label/value row. Exactly one of `text`, `paragraphs`, `refs` or `href` carries the value. */
export interface DossierField {
  label: string;
  text?: string;
  /** Authored prose that may span paragraphs. */
  paragraphs?: string[];
  refs?: DossierRef[];
  /** External link target; the row prints `linkText` as a concise action, never the URL itself. */
  href?: string;
  linkText?: string;
  mono?: boolean;
}

export interface DossierProse {
  label: string;
  paragraphs: string[];
}

export interface DossierBlock {
  heading: string;
  paragraphs: string[];
  fields: DossierField[];
}

export interface DossierOpenQuestion {
  number: string;
  question: string;
  prose: DossierProse[];
  evidence: DossierRef[];
}

export interface DossierPathStage {
  number: string;
  label: string;
  paragraphs: string[];
  evidence: DossierRef[];
}

export interface DossierEvidenceItem {
  id: string;
  destination: string;
  summary: string[];
  relation: DossierField[];
  facts: DossierField[];
  inferenceLimits: string[];
}

export interface DossierSourceItem {
  id: string;
  destination: string;
  name: string | null;
  facts: DossierField[];
  caveats: string[];
}

export interface DossierHistoryEntry {
  date: string | null;
  paragraphs: string[];
  fields: DossierField[];
}

export interface DossierDocumentModel {
  metadata: { title: string; author: string; subject: string; keywords: string; creator: string; producer: string; language: string; creationDate: Date };
  runningHeader: string;
  runningFooter: string;
  cover: { brand: string; kicker: string; problemId: string; title: string | null; context: string | null; updated: string | null };
  contents: { id: DossierSectionId; number: string; title: string }[];
  summary: {
    title: string | null;
    states: { label: string; value: string }[];
    counts: { label: string; value: string }[];
    facts: DossierField[];
    statement: DossierProse | null;
    causalReading: DossierProse | null;
  };
  openQuestions: { intro: string; items: DossierOpenQuestion[] } | null;
  path: { intro: string; stages: DossierPathStage[] } | null;
  evidence: { intro: string; items: DossierEvidenceItem[] } | null;
  sources: { intro: string; items: DossierSourceItem[] } | null;
  decisionBasis: { intro: string; blocks: DossierBlock[] } | null;
  history: { intro: string; entries: DossierHistoryEntry[] } | null;
  audit: { statement: string; fields: DossierField[]; notes: string[] };
}

export const DOSSIER_BRAND = "Open Évora";
export const DOSSIER_KIND = "Dossiê de investigação";

export const DOSSIER_SECTION_TITLES: Record<DossierSectionId, string> = {
  sintese: "Síntese",
  questoes: "Questões em aberto",
  percurso: "Percurso da investigação",
  evidencia: "Evidência",
  fontes: "Fontes",
  base: "Base da investigação",
  historico: "Histórico",
  auditoria: "Auditoria",
};

export const DOSSIER_AUDIT_STATEMENT = "Este documento representa o estado da investigação registado pelo Open Évora no momento da geração.";
export const DOSSIER_LAST_CHECKED_NOTE =
  "A data de verificação de uma fonte indica quando o Open Évora a consultou. Não constitui, por si só, validação da sua atualidade, fiabilidade ou autoridade.";
/** PDF-owned actor wording ("pelo Open Évora"); the shared website captions are left untouched. */
export const DOSSIER_EXTRACTED_LABEL = "Extraída pelo Open Évora";
export const DOSSIER_LAST_CHECKED_LABEL = "Última verificação pelo Open Évora";
export const DOSSIER_SOURCE_LINK_TEXT = "Abrir fonte original ↗";
export const DOSSIER_ACCESS_NOTE = "O acesso público a uma fonte não implica, por si só, permissão para reutilizar o seu conteúdo.";

/** In-document anchor for a section or a printed record. */
export function dossierDestination(id: string): string {
  return `dossie-${id}`;
}

const SEPARATOR = " · ";

function plural(count: number, one: string, many: string): string {
  return `${formatPublicCount(count)} ${count === 1 ? one : many}`;
}

/**
 * Authored prose keeps its paragraph breaks (blank lines); single hard line
 * wraps inside a paragraph are source formatting and read as spaces — the
 * same whitespace handling the web presentation applies. Words are untouched.
 */
export function dossierParagraphs(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter((paragraph) => paragraph.length > 0);
}

/** Single-line authored values (titles, names, list items): any stray hard wrap reads as a space. */
function singleLine(value: string): string {
  return value.replace(/\s*\n\s*/g, " ").trim();
}

function number(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function date(value: string | null): string | null {
  return value ? formatPublicPartialDate(value) : null;
}

function topics(codes: string[]): string | null {
  return codes.length > 0 ? codes.map((code) => `${describeTopic(code).label} (${code})`).join(SEPARATOR) : null;
}

function geography(value: PrbDossierGeography | null, levelField: "geography.level" | "scope.geography.level"): string | null {
  if (!value) return null;
  const parts = [value.level && publicEnumLabel(levelField, value.level), value.area].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(SEPARATOR) : null;
}

/** Authored temporal precision only — "2026-09" stays a month, a start/end pair stays a range. */
function temporal(value: PrbDossierTemporalScope | null): string | null {
  if (!value) return null;
  if (value.asOf) return formatPublicPartialDate(value.asOf);
  if (value.start && value.end) return value.start === value.end ? formatPublicPartialDate(value.start) : `${formatPublicPartialDate(value.start)} – ${formatPublicPartialDate(value.end)}`;
  if (value.start) return `Desde ${formatPublicPartialDate(value.start)}`;
  if (value.end) return `Até ${formatPublicPartialDate(value.end)}`;
  return value.status ? publicEnumLabel("scope.temporal.status", value.status) : null;
}

function labels(field: string, values: string[]): string | null {
  return values.length > 0 ? values.map((value) => publicEnumLabel(field, value)).join(SEPARATOR) : null;
}

function joined(values: string[]): string | null {
  return values.length > 0 ? values.join(SEPARATOR) : null;
}

function textField(label: string, text: string | null | undefined, mono = false): DossierField[] {
  return text ? [{ label, text: singleLine(text), ...(mono ? { mono } : {}) }] : [];
}

function proseField(label: string, text: string | null): DossierField[] {
  const paragraphs = dossierParagraphs(text);
  return paragraphs.length > 0 ? [{ label, paragraphs }] : [];
}

function refsField(label: string, refs: DossierRef[]): DossierField[] {
  return refs.length > 0 ? [{ label, refs }] : [];
}

/** Explicit authored booleans render truthfully — `false` is "Não", only an absent value is omitted. */
function booleanField(label: string, value: boolean | null): DossierField[] {
  return value === null ? [] : [{ label, text: publicTriStateLabel(value) }];
}

/** Presents a PT-PT generation timestamp, with its time zone so the instant is unambiguous outside Portugal. */
export function formatDossierGeneratedAt(value: Date): string {
  return new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(value);
}

function evidenceItem(item: PrbDossierEvidence, sourceRef: (id: string) => DossierRef): DossierEvidenceItem {
  return {
    id: item.id,
    destination: dossierDestination(item.id),
    summary: dossierParagraphs(item.observationSummary),
    relation: [
      ...textField(item.effects.length === 1 ? "Efeito" : "Efeitos", labels("effects", item.effects)),
      ...textField(item.researchRoles.length === 1 ? "Papel" : "Papéis", labels("research_roles", item.researchRoles)),
    ],
    facts: [
      ...textField("Temas", topics(item.domains)),
      ...textField("Âmbito geográfico", geography(item.scope.geography, "scope.geography.level")),
      ...textField("Populações", joined(item.scope.populations)),
      ...textField("Cobertura temporal", temporal(item.scope.temporal)),
      ...textField(DOSSIER_EXTRACTED_LABEL, date(item.extractedAt)),
      ...textField("Natureza da evidência", item.evidenceNature && publicEnumLabel("evidence_nature", item.evidenceNature)),
      ...textField("Autoridade da alegação", item.claimAuthority && publicEnumLabel("claim_authority", item.claimAuthority)),
      ...refsField(item.sourceIds.length === 1 ? "Fonte" : "Fontes", item.sourceIds.map(sourceRef)),
      ...refsField("Fontes sem registo disponível", item.unresolvedSourceIds.map((id) => ({ id, destination: null }))),
      ...textField("Linhagem", item.lineageId, true),
    ],
    inferenceLimits: item.inferenceLimits.map(singleLine),
  };
}

function persistentIdentifier(source: PrbDossierSource): string | null {
  const identifier = source.identity?.persistentIdentifier;
  if (!identifier?.value) return null;
  return identifier.scheme ? `${identifier.scheme}: ${identifier.value}` : identifier.value;
}

function sourceItem(source: PrbDossierSource, evidenceRef: (id: string) => DossierRef): DossierSourceItem {
  const { access, acquisition, licensing, temporal: dates } = source;
  const reference = source.canonicalReference;
  return {
    id: source.id,
    destination: dossierDestination(source.id),
    name: source.name && singleLine(source.name),
    facts: [
      ...textField("Editor", source.publisher),
      ...textField(source.creators.length === 1 ? "Autor" : "Autores", joined(source.creators)),
      ...textField(publicFieldCaption("resource_type"), source.resourceType && publicEnumLabel("resource_type", source.resourceType)),
      ...textField("Identificador persistente", persistentIdentifier(source), true),
      ...textField("Versão", source.identity?.version),
      ...textField("Referência de arquivo", source.identity?.snapshotReference, true),
      ...textField(publicFieldCaption("scope.geography.level"), geography(source.scope.geography, "scope.geography.level")),
      ...textField(publicFieldCaption("scope.temporal"), temporal(source.scope.temporal)),
      ...textField(publicFieldCaption("scope.domains"), topics(source.scope.domains)),
      ...textField(publicFieldCaption("access.level"), access.level && publicEnumLabel("access.level", access.level)),
      ...textField(publicFieldCaption("access.availability"), access.availability && publicEnumLabel("access.availability", access.availability)),
      ...textField(publicFieldCaption("access.method"), access.method && publicEnumLabel("access.method", access.method)),
      ...textField(publicFieldCaption("access.format"), access.format && publicEnumLabel("access.format", access.format)),
      ...textField(publicFieldCaption("access.machine_readable"), access.machineReadable === null ? null : publicTriStateLabel(access.machineReadable)),
      ...textField(publicFieldCaption("acquisition.method"), acquisition.method && publicEnumLabel("acquisition.method", acquisition.method)),
      ...textField(publicFieldCaption("acquisition.obtained_at"), date(acquisition.obtainedAt)),
      ...textField(publicFieldCaption("licensing.status"), licensing.status && publicEnumLabel("licensing.status", licensing.status)),
      ...textField(publicFieldCaption("licensing.licence"), licensing.licence),
      ...textField(publicFieldCaption("licensing.reuse"), licensing.reuse && publicEnumLabel("licensing.reuse", licensing.reuse)),
      ...textField(publicFieldCaption("licensing.attribution"), licensing.attribution),
      ...textField(publicFieldCaption("published_at"), date(dates.publishedAt)),
      ...textField(publicFieldCaption("updated_at"), date(dates.updatedAt)),
      ...textField(publicFieldCaption("update_frequency"), dates.updateFrequency && publicEnumLabel("update_frequency", dates.updateFrequency)),
      ...textField(DOSSIER_LAST_CHECKED_LABEL, date(dates.lastCheckedAt)),
      ...(reference ? [/^https?:\/\//i.test(reference) ? { label: publicFieldCaption("canonical_reference"), href: reference, linkText: DOSSIER_SOURCE_LINK_TEXT } : { label: publicFieldCaption("canonical_reference"), text: reference }] : []),
      ...refsField("Utilizada em", source.usedByEvidenceIds.map(evidenceRef)),
    ],
    caveats: source.caveats.map(singleLine),
  };
}

function decisionBasisBlocks(basis: PrbDossierDecisionBasis, evidenceRef: (id: string) => DossierRef): DossierBlock[] {
  const evidence = (ids: string[]) => refsField("Evidência", ids.map(evidenceRef));
  const blocks: DossierBlock[] = [
    { heading: "Base de elegibilidade", paragraphs: dossierParagraphs(basis.eligibilityBasis), fields: [] },
    { heading: "Base de corroboração", paragraphs: dossierParagraphs(basis.corroborationBasis), fields: [] },
    ...(basis.manifestation
      ? [{ heading: "Manifestação", paragraphs: dossierParagraphs(basis.manifestation.summary), fields: [...textField("Tipo", basis.manifestation.kind), ...evidence(basis.manifestation.evidenceIds)] }]
      : []),
    ...(basis.consequence ? [{ heading: "Consequência", paragraphs: dossierParagraphs(basis.consequence.summary), fields: evidence(basis.consequence.evidenceIds) }] : []),
    ...(basis.currentness ? [{ heading: "Atualidade", paragraphs: dossierParagraphs(basis.currentness.assessment), fields: evidence(basis.currentness.evidenceIds) }] : []),
    ...(basis.contradictionSearch
      ? [{
          heading: "Procura de evidência contrária",
          paragraphs: dossierParagraphs(basis.contradictionSearch.summary),
          fields: [...booleanField("Realizada", basis.contradictionSearch.performed), ...evidence(basis.contradictionSearch.evidenceIds)],
        }]
      : []),
    ...(basis.overlapCheck
      ? [{
          heading: "Verificação de sobreposição",
          paragraphs: dossierParagraphs(basis.overlapCheck.summary),
          fields: [
            ...booleanField("Realizada", basis.overlapCheck.performed),
            ...refsField("Problemas relacionados", basis.overlapCheck.relatedProblemIds.map((id) => ({ id, destination: null }))),
          ],
        }]
      : []),
    { heading: "Declaração de corroboração", paragraphs: dossierParagraphs(basis.corroborationStatement), fields: [] },
    {
      heading: "Evidência de suporte e de delimitação",
      paragraphs: [],
      fields: [...refsField("Evidência de suporte", basis.supportingEvidenceIds.map(evidenceRef)), ...refsField("Evidência de delimitação", basis.boundaryEvidenceIds.map(evidenceRef))],
    },
    { heading: "Avaliação de independência", paragraphs: dossierParagraphs(basis.independenceAssessment), fields: [] },
    ...(basis.scope
      ? [{
          heading: "Âmbito",
          paragraphs: [],
          fields: [
            ...proseField("Geográfico", basis.scope.geography),
            ...proseField("População", basis.scope.population),
            ...proseField("Temporal", basis.scope.temporal),
            ...booleanField("Delimitado", basis.scope.bounded),
          ],
        }]
      : []),
    { heading: "Limitações", paragraphs: dossierParagraphs(basis.limitations), fields: [] },
    { heading: "Versão do contrato", paragraphs: [], fields: textField("Versão", basis.contractVersion) },
  ];
  return blocks.filter((block) => block.paragraphs.length > 0 || block.fields.length > 0);
}

export function buildDossierDocumentModel(dossier: PrbDossierData, generation: DossierGenerationMetadata): DossierDocumentModel {
  const { problem, investigation, counts } = dossier;
  const printedEvidence = new Set(dossier.evidence.map((item) => item.id));
  const printedSources = new Set(dossier.sources.map((item) => item.id));
  const evidenceRef = (id: string): DossierRef => ({ id, destination: printedEvidence.has(id) ? dossierDestination(id) : null });
  const sourceRef = (id: string): DossierRef => ({ id, destination: printedSources.has(id) ? dossierDestination(id) : null });
  const topicLabels = problem.domains.map((code) => describeTopic(code).label);

  const openQuestions = investigation.openQuestions.length > 0
    ? {
        intro: "Questões registadas como em aberto, reproduzidas tal como estão formuladas no problema.",
        items: investigation.openQuestions.map((item, index): DossierOpenQuestion => ({
          number: number(index),
          question: singleLine(item.question),
          prose: [
            { label: "O que sabemos até agora", paragraphs: dossierParagraphs(item.latestResult) },
            { label: "Porque continua em aberto", paragraphs: dossierParagraphs(item.whyOpen) },
            { label: "O que falta confirmar", paragraphs: dossierParagraphs(item.resolutionCondition) },
            { label: "O que estamos a fazer", paragraphs: dossierParagraphs(item.currentAction) },
          ].filter((entry) => entry.paragraphs.length > 0),
          evidence: item.evidenceIds.map(evidenceRef),
        })),
      }
    : null;

  const path = investigation.path.length > 0
    ? {
        intro: "Sequência narrativa dos registos que deram forma à formulação atual do problema.",
        stages: investigation.path.map((stage, index): DossierPathStage => ({
          number: number(index),
          label: PATH_STAGE_LABELS[stage.key],
          paragraphs: dossierParagraphs(stage.summary),
          evidence: stage.evidenceIds.map(evidenceRef),
        })),
      }
    : null;

  const evidence = dossier.evidence.length > 0
    ? {
        intro: `${plural(counts.evidenceRecordCount, "registo de evidência ligado", "registos de evidência ligados")} ao problema, pela ordem registada no problema e sem hierarquização.`,
        items: dossier.evidence.map((item) => evidenceItem(item, sourceRef)),
      }
    : null;

  const sources = dossier.sources.length > 0
    ? {
        intro: `${plural(counts.distinctSourceCount, "fonte distinta, listada", "fontes distintas, cada uma listada")} uma vez pelo seu identificador canónico. Acesso, disponibilidade, reutilização e data de verificação são apresentados como dimensões separadas.`,
        items: dossier.sources.map((source) => sourceItem(source, evidenceRef)),
      }
    : null;

  const decisionBasis = dossier.decisionBasis
    ? { intro: "Fundamentação registada no problema, reproduzida tal como está redigida.", blocks: decisionBasisBlocks(dossier.decisionBasis, evidenceRef) }
    : null;

  const history = dossier.history.length > 0
    ? {
        intro: "Alterações materiais registadas no problema, pela ordem em que foram registadas.",
        entries: dossier.history.map((entry): DossierHistoryEntry => ({
          date: date(entry.date),
          paragraphs: dossierParagraphs(entry.summary),
          fields: [
            ...entry.stateChanges.map(({ field, from, to }) => ({ label: publicFieldCaption(field), text: `De «${publicEnumLabel(field, from)}» para «${publicEnumLabel(field, to)}»` })),
            ...refsField("Evidência", entry.evidenceIds.map(evidenceRef)),
          ],
        })),
      }
    : null;

  const present: Record<DossierSectionId, boolean> = {
    sintese: true,
    questoes: openQuestions !== null,
    percurso: path !== null,
    evidencia: evidence !== null,
    fontes: sources !== null,
    base: decisionBasis !== null,
    historico: history !== null,
    auditoria: true,
  };
  const contents = (Object.keys(DOSSIER_SECTION_TITLES) as DossierSectionId[])
    .filter((id) => present[id])
    .map((id, index) => ({ id, number: number(index), title: DOSSIER_SECTION_TITLES[id] }));

  const title = problem.title && singleLine(problem.title);
  return {
    metadata: {
      title: title ? `${problem.id} · ${title}` : problem.id,
      author: DOSSIER_BRAND,
      subject: `${DOSSIER_KIND} do Open Évora sobre ${problem.id}`,
      keywords: [DOSSIER_BRAND, problem.id, DOSSIER_KIND, ...topicLabels].join(", "),
      creator: DOSSIER_BRAND,
      producer: DOSSIER_BRAND,
      language: "pt-PT",
      creationDate: generation.generatedAt,
    },
    runningHeader: `${DOSSIER_BRAND}${SEPARATOR}${problem.id}`,
    runningFooter: DOSSIER_KIND,
    cover: {
      brand: DOSSIER_BRAND,
      kicker: DOSSIER_KIND,
      problemId: problem.id,
      title,
      context: joined([problem.geography?.area, ...topicLabels].filter((part): part is string => Boolean(part))),
      updated: problem.updatedAt ? `Registo atualizado em ${formatPublicPartialDate(problem.updatedAt)}` : null,
    },
    contents,
    summary: {
      title,
      states: [
        ...(problem.status ? [{ label: "Estado", value: publicEnumLabel("status", problem.status) }] : []),
        ...(problem.evidenceStatus ? [{ label: "Evidência", value: publicCompactEnumLabel("evidence_status", problem.evidenceStatus) }] : []),
        ...(problem.validationStatus ? [{ label: "Validação", value: publicCompactEnumLabel("validation_status", problem.validationStatus) }] : []),
      ],
      counts: [
        { label: "Registos de evidência", value: formatPublicCount(counts.evidenceRecordCount) },
        { label: "Efeitos PRB–EVD", value: formatPublicCount(counts.effectCount) },
        { label: "Questões em aberto", value: formatPublicCount(counts.openQuestionCount) },
      ],
      facts: [
        ...textField("Âmbito geográfico", geography(problem.geography, "geography.level")),
        ...textField("Populações afetadas", joined(problem.affectedPopulations)),
        ...textField("Temas", topics(problem.domains)),
        ...textField(publicFieldCaption("digital_tractability"), problem.digitalTractability && publicEnumLabel("digital_tractability", problem.digitalTractability)),
        ...textField(publicFieldCaption("solution_landscape_status"), problem.solutionLandscapeStatus && publicEnumLabel("solution_landscape_status", problem.solutionLandscapeStatus)),
      ],
      statement: problem.problemStatement ? { label: "Formulação do problema", paragraphs: dossierParagraphs(problem.problemStatement) } : null,
      causalReading: problem.causalReading ? { label: "Leitura atual", paragraphs: dossierParagraphs(problem.causalReading) } : null,
    },
    openQuestions,
    path,
    evidence,
    sources,
    decisionBasis,
    history,
    audit: {
      statement: DOSSIER_AUDIT_STATEMENT,
      fields: [
        { label: "Problema", text: problem.id, mono: true },
        ...textField("Registo criado em", date(problem.createdAt)),
        ...textField("Registo atualizado em", date(problem.updatedAt)),
        { label: "Versão da projeção do dossiê", text: String(dossier.projectionVersion) },
        { label: "Documento gerado em", text: formatDossierGeneratedAt(generation.generatedAt) },
        ...(generation.sourceCommit ? [{ label: "Commit de origem", text: generation.sourceCommit, mono: true }] : []),
        { label: "Impressão digital do corpus", text: generation.corpusFingerprint, mono: true },
        { label: "Registos de evidência", text: formatPublicCount(counts.evidenceRecordCount) },
        { label: "Fontes distintas", text: formatPublicCount(counts.distinctSourceCount) },
        { label: "Efeitos PRB–EVD", text: formatPublicCount(counts.effectCount) },
        { label: "Questões em aberto", text: formatPublicCount(counts.openQuestionCount) },
      ],
      notes: [DOSSIER_LAST_CHECKED_NOTE, DOSSIER_ACCESS_NOTE],
    },
  };
}
