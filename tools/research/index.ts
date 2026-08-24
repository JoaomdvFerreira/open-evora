export { analyzeCorpus, computeProblemAnalysis, computeGaps, tally } from "./analyze.ts";
export type { AnalysisResult, CorpusSummary, Distribution, ProblemAnalysis } from "./analyze.ts";
export { loadCorpusIndex } from "./corpus.ts";
export type { MalformedRecordFile } from "./corpus.ts";
export { loadSchemas } from "./schemas.ts";
export { parseRecordYaml } from "./yaml.ts";
export { validateCorpusIndex, validateResearchRoot } from "./validate.ts";
export type { ValidationResult } from "./validate.ts";
export type {
  CorpusIndex,
  ParsedRecord,
  RecordFields,
  RecordIndex,
  RecordSchema,
  RecordSet,
  SchemaReference,
} from "./types.ts";
