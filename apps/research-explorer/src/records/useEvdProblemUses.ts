import { useEffect, useState } from "react";
import { DataLoadError, type DataProvider } from "../dataProvider/types";
import { loadEvdProblemUses, type EVDProblemUse } from "./evdRelations";

export type EVDProblemUsesState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; uses: EVDProblemUse[] }
  | { status: "error"; error: DataLoadError };

export function useEvdProblemUses(provider: DataProvider, evidenceId: string | null): EVDProblemUsesState & { retry: () => void } {
  const [state, setState] = useState<EVDProblemUsesState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (evidenceId === null) { setState({ status: "idle" }); return; }
    let cancelled = false;
    setState({ status: "loading" });
    loadEvdProblemUses(provider, evidenceId).then(
      (uses) => { if (!cancelled) setState({ status: "ready", uses }); },
      (error: unknown) => { if (!cancelled) setState({ status: "error", error: error instanceof DataLoadError ? error : new DataLoadError("Não foi possível carregar os usos desta evidência.", "network") }); }
    );
    return () => { cancelled = true; };
  }, [provider, evidenceId, attempt]);
  return { ...state, retry: () => setAttempt((value) => value + 1) };
}
