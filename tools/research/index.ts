/**
 * Public API boundary for tools/research/. Consumers outside this subtree
 * should import from here rather than reaching into core/, validation/, or
 * analysis/ directly.
 */
export { analyzeCorpus, computeProblemAnalysis, computeGaps } from "./analysis/analyze.ts";
export type { AnalysisResult, CorpusSummary, ProblemAnalysis } from "./analysis/analyze.ts";
export { loadCorpusIndex, loadCorpusIndexTolerant } from "./core/corpus.ts";
export type { CorpusLoadResult, MalformedRecordFile } from "./core/corpus.ts";
export { loadSchemas } from "./core/schemas.ts";
export { parseRecordYaml } from "./core/yaml.ts";
export {
  evaluateCorpus,
  evaluateCorroboration,
  evaluateEligibility,
  evaluateProblem,
  READY,
  REASON,
  REVIEW_REQUIRED,
} from "./readiness/readiness.ts";
export type {
  CorroborationReadiness,
  CorroborationResult,
  EligibilityReadiness,
  EligibilityResult,
  ReadinessFinding,
  ReadinessReport,
  ReasonCode,
} from "./readiness/readiness.ts";
export { validateCorpusIndex, validateResearchRoot } from "./validation/validate.ts";
export type { ValidationResult } from "./validation/validate.ts";
export { classifyCandidateDelta } from "./candidate-delta.ts";
export type { CandidateDelta, CandidateDeltaAction, CandidateRecord } from "./candidate-delta.ts";
export { buildProspectiveCorpusIndex, validateCandidateSet } from "./prospective-validation.ts";
export type { CandidateSetValidationResult, ProspectiveCorpusOverlay } from "./prospective-validation.ts";
export type {
  CorpusIndex,
  ParsedRecord,
  RecordFields,
  RecordIndex,
  RecordSchema,
  RecordSet,
  SchemaReference,
} from "./core/types.ts";
