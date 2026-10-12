/**
 * Public API boundary for shared research validation and review primitives.
 */
export { ADVISORY, CLEC_DIMENSION, detectLanguageSignals, SIGNAL_CODE, SIGNAL_DIMENSION, subjectIdsForFiles } from "./language/signals.ts";
export type { ClecDimension, DetectOptions, LanguageSignal, SignalCode } from "./language/signals.ts";
export { loadCorpusIndex, loadCorpusIndexTolerant } from "./core/corpus.ts";
export type { CorpusLoadResult, MalformedRecordFile } from "./core/corpus.ts";
export { loadSchemas } from "./core/schemas.ts";
export { parseRecordYaml, stringifyRecordYaml } from "./core/yaml.ts";
export { validateCorpusIndex, validateResearchRoot } from "./validation/validate.ts";
export type { ValidationResult } from "./validation/validate.ts";
export { classifyCandidateDelta } from "./integration/candidate-delta.ts";
export type { CandidateDelta, CandidateDeltaAction, CandidateRecord } from "./integration/candidate-delta.ts";
export { buildProspectiveCorpusIndex, validateCandidateSet } from "./integration/prospective-validation.ts";
export type { CandidateSetValidationResult, ProspectiveCorpusOverlay } from "./integration/prospective-validation.ts";
export { prepareCanonicalIntegrationReview } from "./integration/canonical-integration-review.ts";
export type { CanonicalIntegrationReadiness, CanonicalIntegrationReview } from "./integration/canonical-integration-review.ts";
export type {
  CorpusIndex,
  ParsedRecord,
  RecordFields,
  RecordIndex,
  RecordSchema,
  RecordSet,
  SchemaReference,
} from "./core/types.ts";
