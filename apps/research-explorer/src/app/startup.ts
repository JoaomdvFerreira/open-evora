import { DataLoadError, type DataProvider, type ReadModelManifest } from "../dataProvider/types";

/**
 * The Explorer's startup sequence, extracted from React so it is testable as
 * a plain async contract (per RE-02A's "prefer testing business/runtime
 * contracts over React implementation details"). App.tsx only owns the
 * loading/ready/error UI state derived from this.
 *
 * Startup order (RE-02A spec): load manifest through the provider (which
 * itself validates required shape + readModelVersion compatibility) — and
 * nothing else. edges.json, record-detail/*, and canonical YAML are never
 * touched during startup.
 */
export type ExplorerStartupState =
  | { status: "ready"; manifest: ReadModelManifest }
  | { status: "error"; error: DataLoadError };

export async function loadExplorerStartupState(provider: DataProvider): Promise<ExplorerStartupState> {
  try {
    const manifest = await provider.getManifest();
    return { status: "ready", manifest };
  } catch (error) {
    if (error instanceof DataLoadError) {
      return { status: "error", error };
    }
    // Do not swallow an unrecognized failure mode as if it were a normal,
    // actionable DataLoadError — surface it distinctly instead.
    return {
      status: "error",
      error: new DataLoadError(
        `Unexpected error while starting the Explorer: ${error instanceof Error ? error.message : String(error)}`,
        "network"
      ),
    };
  }
}
