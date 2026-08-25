import { useEffect, useState } from "react";
import { DataLoadError, type DataProvider } from "../dataProvider/types";
import { loadSourceEvidenceRelations, type SourceEvidenceRelations } from "./sourceEvidenceRelations";

export type SourceEvidenceRelationsState =
  | { status: "idle" }
  | { status: "loading"; id: string }
  | { status: "ready"; relations: SourceEvidenceRelations }
  | { status: "error"; id: string; error: DataLoadError };

function asDataLoadError(error: unknown): DataLoadError {
  if (error instanceof DataLoadError) return error;
  return new DataLoadError(`Erro inesperado ao carregar as relações da Fonte: ${error instanceof Error ? error.message : String(error)}`, "network");
}

/**
 * Lazy-loads the SRC → EVD relation set (SUI-03A2's `loadSourceEvidenceRelations`)
 * whenever `sourceId` changes — mirrors `useProblemProjection`'s hook shape.
 * A failure here is isolated to this hook's own state, never the parent
 * record detail load (`useRecordDetail`).
 */
export function useSourceEvidenceRelations(provider: DataProvider, sourceId: string | null): SourceEvidenceRelationsState & { retry: () => void } {
  const [state, setState] = useState<SourceEvidenceRelationsState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (sourceId === null) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading", id: sourceId });
    loadSourceEvidenceRelations(provider, sourceId).then(
      (relations) => {
        if (!cancelled) setState({ status: "ready", relations });
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: "error", id: sourceId, error: asDataLoadError(error) });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [provider, sourceId, attempt]);

  return { ...state, retry: () => setAttempt((value) => value + 1) };
}
