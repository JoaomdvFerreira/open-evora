import { useEffect, useRef, useState } from "react";
import type { DataProvider, RecordDetail } from "../dataProvider/types";
import { useRecordIndex } from "../records/useRecordIndex";
import { formatPublicDate, publicEnumLabel, publicFieldCaption } from "../presentation/presentation";
import { formatTypedId } from "../presentation/typeGlossary";
import { ContextTabs } from "../navigation/ContextTabs";
import { Breadcrumb } from "../presentation/Breadcrumb";
import { RecordIdentifier } from "../records/RecordIdentifier";

const HISTORY_STATE_FIELDS = ["status", "evidence_status", "validation_status", "digital_tractability", "solution_landscape_status"] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function HistoryEvidenceLinks({ evidence, onOpenGeneric }: { evidence: unknown; onOpenGeneric: (id: string) => void }) {
  if (!Array.isArray(evidence) || evidence.length === 0) return null;
  const ids = evidence.filter((id): id is string => typeof id === "string");
  if (ids.length === 0) return null;
  return (
    <p>
      <strong>Evidência:</strong>{" "}
      {ids.map((id, index) => (
        <span key={id}>
          {index > 0 && ", "}
          <RecordIdentifier variant="action" id={id} density="compact" onActivate={() => onOpenGeneric(id)} accessibleLabel={`Abrir ${id}`} />
        </span>
      ))}
    </p>
  );
}

function StateChanges({ stateChanges }: { stateChanges: unknown }) {
  const changes = asRecord(stateChanges);
  if (!changes) return null;
  const transitions = HISTORY_STATE_FIELDS.flatMap((field) => {
    const transition = asRecord(changes[field]);
    return typeof transition?.from === "string" && typeof transition.to === "string" ? [{ field, from: transition.from, to: transition.to }] : [];
  });
  if (transitions.length === 0) return null;
  return (
    <dl className="problem-current-state-list" aria-label="Alterações de estado">
      {transitions.map(({ field, from, to }) => (
        <div key={field} className="problem-current-state-item">
          <dt>{publicFieldCaption(field)}</dt>
          <dd>{publicEnumLabel(field, from)} → {publicEnumLabel(field, to)}</dd>
        </div>
      ))}
    </dl>
  );
}

function HistoryEntries({ record, onOpenGeneric }: { record: Record<string, unknown>; onOpenGeneric: (id: string) => void }) {
  const entries = Array.isArray(record.history)
    ? record.history.map(asRecord).filter((entry): entry is Record<string, unknown> => entry !== null).reverse()
    : [];

  if (entries.length === 0) {
    return <p>Não existe histórico material registado para este problema.</p>;
  }

  return (
    <ol className="open-question-list" aria-label="Histórico material">
      {entries.map((entry, index) => {
        const date = typeof entry.date === "string" ? entry.date : "";
        const summary = typeof entry.summary === "string" ? entry.summary : "";
        return (
          <li key={`${date}-${index}`} className="open-question-item">
            <p className="open-question-question"><time dateTime={date}>{formatPublicDate(date)}</time></p>
            <p>{summary}</p>
            <StateChanges stateChanges={entry.state_changes} />
            <HistoryEvidenceLinks evidence={entry.evidence} onOpenGeneric={onOpenGeneric} />
          </li>
        );
      })}
    </ol>
  );
}

interface ProblemHistoryViewProps {
  dataProvider: DataProvider;
  problemId: string | null;
  onOpenGeneric: (id: string) => void;
  onBackToRecords: () => void;
  onBackToOverview: () => void;
  onViewAsProblem: (id: string) => void;
}

function ProblemHistoryContent({ dataProvider, problemId, onOpenGeneric, onBackToOverview, onViewAsProblem }: Omit<ProblemHistoryViewProps, "problemId" | "onBackToRecords"> & { problemId: string }) {
  const [detail, setDetail] = useState<RecordDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(null);
    dataProvider.getRecord(problemId).then(
      (next) => { if (!cancelled) setDetail(next); },
      (nextError) => { if (!cancelled) setError(nextError); }
    );
    return () => { cancelled = true; };
  }, [dataProvider, problemId]);

  useEffect(() => {
    if (detail) headingRef.current?.focus();
  }, [detail]);

  if (error) {
    return <div role="alert"><h2>Não foi possível carregar o histórico</h2><p>{error instanceof Error ? error.message : String(error)}</p></div>;
  }
  if (!detail) return <p role="status" aria-live="polite">A carregar histórico de {problemId}…</p>;

  const record = detail.record as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title : detail.id;
  return (
    <article aria-labelledby="problem-history-heading" className="problem-view shell-frame">
      <Breadcrumb
        label="Localização"
        ancestors={[
          {
            key: "visao-geral",
            action: (
              <button type="button" onClick={onBackToOverview}>
                Visão geral
              </button>
            ),
          },
        ]}
        current={<RecordIdentifier variant="text" density="compact" id={detail.id} />}
      />
      <ContextTabs prbId={detail.id} active="history" onOpenGeneric={onOpenGeneric} onViewAsProblem={onViewAsProblem} onViewHistory={() => undefined} />
      <section className="problem-section">
        <div className="problem-identity-id">{detail.id}</div>
        <h2 ref={headingRef} id="problem-history-heading" tabIndex={-1} className="problem-identity-title">{title}</h2>
        <h3 className="detail-panel-label">Histórico material</h3>
        <HistoryEntries record={record} onOpenGeneric={onOpenGeneric} />
      </section>
    </article>
  );
}

/** Read-only PRB material-history projection over the existing DataProvider. */
export function ProblemHistoryView({ dataProvider, problemId, onOpenGeneric, onBackToRecords, onBackToOverview, onViewAsProblem }: ProblemHistoryViewProps) {
  const indexState = useRecordIndex(dataProvider);
  if (indexState.status === "loading") return <p role="status" aria-live="polite">A carregar…</p>;
  if (indexState.status === "error") return <div role="alert"><h2>Não foi possível carregar os registos</h2><p>{indexState.error.message}</p><button type="button" onClick={indexState.retry}>Tentar novamente</button></div>;
  if (problemId === null) return <div><p>Nenhum Problema selecionado.</p><button type="button" onClick={onBackToRecords}>Procurar um Problema em Registos</button></div>;

  const summary = indexState.lookup.get(problemId);
  if (summary && summary.type !== "PRB-") {
    return <div role="alert"><h2>Este registo não é um Problema</h2><p>{formatTypedId(summary.type, problemId)} não pode ser aberto como histórico.</p><button type="button" onClick={() => onOpenGeneric(problemId)}>Ver detalhe genérico</button></div>;
  }
  return <ProblemHistoryContent dataProvider={dataProvider} problemId={problemId} onOpenGeneric={onOpenGeneric} onBackToOverview={onBackToOverview} onViewAsProblem={onViewAsProblem} />;
}
