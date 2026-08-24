/**
 * Types mirroring the generated read model (docs/explorerarchitecture.md).
 * Kept intentionally generic — no SRC-/EVD-/PRB- specific fields — because the read
 * model itself is schema-driven and must represent future record types
 * without a shape change here.
 */

export interface ReadModelManifest {
  readModelVersion: string;
  generatedAt: string;
  generator: string;
  sourceCommit: string | null;
  corpusFingerprint: string;
  totalRecords: number;
  counts: Record<string, number>;
  schemaPrefixes: string[];
}

export interface RecordSummary {
  id: string;
  type: string;
  label: string;
  file: string;
  summaryFields: Record<string, unknown>;
}

export interface RecordEdgeRef {
  field: string;
  ordinal: number | null;
  to?: string;
  from?: string;
}

/**
 * One resolved reference from edges.json (docs/explorerarchitecture.md)
 * — "record `from` references record `to` via schema field `field`", nothing
 * more. Consumed by the Graph view only; never loaded
 * during application startup or by the Records/Problem views.
 */
export interface RecordEdge {
  id: string;
  from: string;
  to: string;
  field: string;
  ordinal: number | null;
  required: boolean;
}

export interface RecordDetail {
  id: string;
  type: string;
  file: string;
  record: Record<string, unknown>;
  outgoingEdges: RecordEdgeRef[];
  incomingEdges: RecordEdgeRef[];
}

/**
 * Browser-facing data-access boundary. UI components depend only on this
 * interface, never on fetch()/JSON paths directly — see StaticDataProvider
 * for the current (static-JSON) implementation. A future implementation
 * (e.g. an API-backed provider, per RE-05's escalation path) can replace
 * StaticDataProvider without any UI component changing its data-access code.
 *
 * Only the methods RE-02A needs (or RE-02B is already known to need) are
 * declared here — no graph-specific methods yet.
 */
export interface DataProvider {
  getManifest(): Promise<ReadModelManifest>;
  listRecords(): Promise<RecordSummary[]>;
  getRecord(id: string): Promise<RecordDetail>;
  /**
   * Loads edges.json — the full corpus reference set. RE-04 only: no other
   * view calls this. Implementations must not fetch it eagerly (see
   * StaticDataProvider), so entering the Graph view is what triggers the
   * request, not application startup.
   */
  getEdges(): Promise<RecordEdge[]>;
}

export type DataLoadErrorKind = "missing" | "malformed" | "incompatible" | "network" | "not_found" | "invalid_id";

export class DataLoadError extends Error {
  readonly kind: DataLoadErrorKind;

  constructor(message: string, kind: DataLoadErrorKind) {
    super(message);
    this.name = "DataLoadError";
    this.kind = kind;
  }
}
