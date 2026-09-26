import { useEffect, useRef, type MutableRefObject } from "react";
import { applyInitialFragment } from "../navigation/applyInitialFragment";
import type { DataProvider, RecordSummary } from "../dataProvider/types";
import { useRecordIndex } from "../records/useRecordIndex";
import { useProblemProjection } from "./useProblemProjection";
import { buildPrbDetailsData } from "./prbDetailsProjection";
import { PrbDetailsPresentation } from "./PrbDetailsPresentation";
import { formatTypedId } from "../presentation/typeGlossary";
import { ProgressMessage } from "../presentation/ProgressMessage";
import { ErrorNotice } from "../presentation/ErrorNotice";

const ERROR_TITLES: Record<string, string> = {
  missing: "Modelo de leitura gerado não encontrado",
  malformed: "Registo mal formado",
  incompatible: "Versão do modelo de leitura incompatível",
  network: "Falha ao carregar o Problema",
  not_found: "Problema não encontrado",
  invalid_id: "Identificador de Problema inválido",
};

interface ProblemContentProps {
  dataProvider: DataProvider;
  lookup: Map<string, RecordSummary>;
  problemId: string;
  onOpenGeneric: (id: string) => void;
  onBackToOverview: () => void;
  onViewHistory: (id: string) => void;
  initialFragmentConsideredRef: MutableRefObject<boolean>;
}

/**
 * F16: keyed by `problemId` at its call site in `ProblemView` — a genuine
 * per-PRB identity boundary. Changing PRB unmounts this instance and mounts a
 * fresh one, so a still-in-flight or late-resolving projection for the
 * previous PRB can never be committed, focused, or recorded as "focused"
 * under the newly requested PRB's identity: there is no shared component
 * instance left for it to write into. `useProblemProjection`'s own `idle`
 * state on the fresh instance's first render (before its effect schedules
 * `loading`) is what the newly selected PRB shows while resolving — never the
 * previous PRB's stale `ready` projection.
 */
function ProblemContent({ dataProvider, lookup, problemId, onOpenGeneric, onBackToOverview, onViewHistory, initialFragmentConsideredRef }: ProblemContentProps) {
  const state = useProblemProjection(dataProvider, lookup, problemId);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const focusedEntryRef = useRef<string | null>(null);

  useEffect(() => {
    if (focusedEntryRef.current === problemId) return;
    if (state.status === "ready") {
      // F07: on this ProblemView mount's first-ever ready transition only,
      // give a direct deep link's requested section the chance to win over
      // the generic heading focus — reusing the same shared
      // applyInitialFragment() RecordDetailPanel already uses, never a
      // second fragment-lookup implementation. A missing/absent/malformed
      // hash (including one for an element that doesn't exist on this PRB)
      // fails safely and falls through to the existing heading-focus
      // fallback below. `initialFragmentConsideredRef` is owned by
      // `ProblemView`, not this (per-PRB, remounted) component, so a later
      // in-app PRB->PRB navigation — which mounts a brand-new
      // `ProblemContent` instance (F16) — still never re-reads
      // `window.location.hash` and hijacks its own heading focus with a
      // fragment that belonged to the mount's original load.
      const isInitialReadyTransition = !initialFragmentConsideredRef.current;
      initialFragmentConsideredRef.current = true;
      const appliedInitialFragment = isInitialReadyTransition && applyInitialFragment();
      if (!appliedInitialFragment) {
        headingRef.current?.focus();
      }
      focusedEntryRef.current = problemId;
    } else if (state.status === "error") {
      errorRef.current?.focus();
      focusedEntryRef.current = problemId;
    }
  }, [problemId, state.status]);

  if (state.status === "idle") return null;

  if (state.status === "loading") {
    return <div className="shell-frame"><ProgressMessage message={`A carregar Problema ${state.id}…`} /></div>;
  }

  if (state.status === "error") {
    return (
      <div className="shell-frame">
        <ErrorNotice
          ref={errorRef}
          tabIndex={-1}
          titleAs="h2"
          title={ERROR_TITLES[state.error.kind] ?? "Não foi possível carregar o Problema"}
          message={state.error.message}
          action={
            <button type="button" onClick={state.retry}>
              Tentar novamente
            </button>
          }
        />
      </div>
    );
  }

  // The PRB Details composition's fields are derived only by the governed
  // projection (prbDetailsProjection.ts) — never re-derived here.
  return (
    <PrbDetailsPresentation
      data={buildPrbDetailsData(state.projection)}
      onOpenGeneric={onOpenGeneric}
      onBackToOverview={onBackToOverview}
      onViewHistory={onViewHistory}
      titleRef={headingRef}
    />
  );
}

interface ProblemViewProps {
  dataProvider: DataProvider;
  problemId: string | null;
  onOpenGeneric: (id: string) => void;
  onBackToRecords: () => void;
  /** UX-D §2: the Problem breadcrumb's own first action — Problem View reads as "Visão geral › PRB-*", not a child of Records. */
  onBackToOverview: () => void;
  onViewHistory: (id: string) => void;
}

/**
 * The public `view=problem` container: "what do we currently know about this
 * problem, why do we believe it, and what remains uncertain?" It owns only
 * orchestration — record-index and projection loading/error/retry, the
 * no-selection and non-PRB guards, the per-PRB identity boundary, and
 * initial-fragment/heading focus — and renders the resolved projection
 * through the PRB Details composition (PrbDetailsPresentation.tsx). Any
 * record reached from here (evidence, source) still opens through the same
 * generic detail renderer via onOpenGeneric.
 */
export function ProblemView({ dataProvider, problemId, onOpenGeneric, onBackToRecords, onBackToOverview, onViewHistory }: ProblemViewProps) {
  const indexState = useRecordIndex(dataProvider);
  // F07/F16: owned here, not inside `ProblemContent`, because that component
  // is now keyed by `problemId` (F16) and remounts fresh on every PRB
  // change — this flag must survive across those remounts for the same
  // `ProblemView` mount so a later in-app PRB->PRB navigation still never
  // re-reads `window.location.hash` and reapplies a fragment that belonged
  // only to this mount's original load.
  const initialFragmentConsideredRef = useRef(false);

  if (indexState.status === "loading") {
    return <div className="shell-frame"><ProgressMessage message="A carregar…" /></div>;
  }

  if (indexState.status === "error") {
    return (
      <div className="shell-frame">
        <ErrorNotice
          titleAs="h2"
          title="Não foi possível carregar os registos"
          message={indexState.error.message}
          action={
            <button type="button" onClick={indexState.retry}>
              Tentar novamente
            </button>
          }
        />
      </div>
    );
  }

  if (problemId === null) {
    return (
      <div>
        <p>Nenhum Problema selecionado.</p>
        <button type="button" onClick={onBackToRecords}>
          Procurar um Problema em Registos
        </button>
      </div>
    );
  }

  const summary = indexState.lookup.get(problemId);
  if (summary && summary.type !== "PRB-") {
    return (
      <ErrorNotice
        titleAs="h2"
        title="Este registo não é um Problema"
        message={`${formatTypedId(summary.type, problemId)} não pode ser aberto como vista de Problema.`}
        action={
          <button type="button" onClick={() => onOpenGeneric(problemId)}>
            Ver detalhe genérico
          </button>
        }
      />
    );
  }

  return (
    <ProblemContent
      // F16: identity boundary — remounts ProblemContent (and therefore
      // useProblemProjection's state and every focus ref inside it) fresh on
      // every PRB change, so a still-in-flight or late-resolving projection
      // for the previously selected PRB can never be committed, focused, or
      // marked "focused" under the newly requested PRB's identity.
      key={problemId}
      dataProvider={dataProvider}
      lookup={indexState.lookup}
      problemId={problemId}
      onOpenGeneric={onOpenGeneric}
      onBackToOverview={onBackToOverview}
      onViewHistory={onViewHistory}
      initialFragmentConsideredRef={initialFragmentConsideredRef}
    />
  );
}
