/**
 * Public API boundary for tools/research/. Consumers outside this subtree
 * should import from here rather than reaching into core/, validation/, or
 * analysis/ directly.
 */
export { analyzeCorpus, computeProblemAnalysis, computeGaps, tally } from "./analysis/analyze.ts";
export type { AnalysisResult, CorpusSummary, Distribution, ProblemAnalysis } from "./analysis/analyze.ts";
export { loadCorpusIndex, loadCorpusIndexTolerant } from "./core/corpus.ts";
export type { CorpusLoadResult, MalformedRecordFile } from "./core/corpus.ts";
export { loadSchemas } from "./core/schemas.ts";
export { parseRecordYaml } from "./core/yaml.ts";
export { validateCorpusIndex, validateResearchRoot } from "./validation/validate.ts";
export type { ValidationResult } from "./validation/validate.ts";
export type {
  CorpusIndex,
  ParsedRecord,
  RecordFields,
  RecordIndex,
  RecordSchema,
  RecordSet,
  SchemaReference,
} from "./core/types.ts";
