import { useEffect, useState } from "react";
import { DataLoadError, type DataProvider, type RecordSummary } from "../dataProvider/types";
import { loadProblemProjection, type ProblemProjection } from "./problemProjection";

export type ProblemProjectionState =
  | { status: "idle" }
  | { status: "loading"; id: string }
  | { status: "ready"; projection: ProblemProjection }
  | { status: "error"; id: string; error: DataLoadError };

function asDataLoadError(error: unknown): DataLoadError {
  if (error instanceof DataLoadError) return error;
  return new DataLoadError(
    `Erro inesperado ao carregar o Problema: ${error instanceof Error ? error.message : String(error)}`,
    "network"
  );
}

/**
 * Lazy-loads the full Problem projection (problem + evidence + sources)
 * whenever `problemId` changes. A failure here is isolated to this hook's
 * own state — it never affects the already-loaded Records index or any
 * other selection.
 */
export function useProblemProjection(provider: DataProvider, lookup: Map<string, RecordSummary>, problemId: string | null): ProblemProjectionState & { retry: () => void } {
  const [state, setState] = useState<ProblemProjectionState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (problemId === null) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading", id: problemId });
    loadProblemProjection(provider, lookup, problemId).then(
      (projection) => {
        if (!cancelled) setState({ status: "ready", projection });
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: "error", id: problemId, error: asDataLoadError(error) });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [provider, lookup, problemId, attempt]);

  return { ...state, retry: () => setAttempt((value) => value + 1) };
}
