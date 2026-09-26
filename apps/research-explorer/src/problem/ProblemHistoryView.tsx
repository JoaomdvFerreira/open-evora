import { useEffect, useRef, useState, type RefObject } from "react";
import type { DataProvider, RecordDetail } from "../dataProvider/types";
import { useRecordIndex } from "../records/useRecordIndex";
import { formatPublicCount, formatPublicDate, formatPublicRelativeDays, publicEnumLabel, publicFieldCaption } from "../presentation/presentation";
import { formatTypedId } from "../presentation/typeGlossary";
import { RecordIdentifier } from "../records/RecordIdentifier";
import { ProgressMessage } from "../presentation/ProgressMessage";
import { ErrorNotice } from "../presentation/ErrorNotice";
import { PrbHeader, PrbIdentityHeader } from "./PrbPageHeader";
import { prbIdentity, type PrbIdentityData } from "./prbDetailsProjection";

const HISTORY_STATE_FIELDS = ["status", "evidence_status", "validation_status", "digital_tractability", "solution_landscape_status"] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export interface PrbHistoryStateChange {
  field: (typeof HISTORY_STATE_FIELDS)[number];
  from: string;
  to: string;
}

/**
 * One canonical PRB `history[]` entry, limited to its authored contract
 * (`date`, `summary`, `evidence`, `state_changes`). No entry type, category
 * or "current/in force" flag exists in canonical data, so none is derived
 * here — not from the summary text, the entry order or the date.
 */
export interface PrbHistoryEntry {
  date: string;
  summary: string;
  evidenceIds: string[];
  stateChanges: PrbHistoryStateChange[];
}

function stateChanges(value: unknown): PrbHistoryStateChange[] {
  const changes = asRecord(value);
  if (!changes) return [];
  return HISTORY_STATE_FIELDS.flatMap((field) => {
    const transition = asRecord(changes[field]);
    return typeof transition?.from === "string" && typeof transition.to === "string" ? [{ field, from: transition.from, to: transition.to }] : [];
  });
}

/** Canonical `history[]`, newest first (authored order is oldest first). Only authored transitions are carried; none is inferred. */
export function prbHistoryEntries(record: Record<string, unknown>): PrbHistoryEntry[] {
  if (!Array.isArray(record.history)) return [];
  return record.history
    .map(asRecord)
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => ({
      date: typeof entry.date === "string" ? entry.date : "",
      summary: typeof entry.summary === "string" ? entry.summary : "",
      evidenceIds: Array.isArray(entry.evidence) ? entry.evidence.filter((id): id is string => typeof id === "string") : [],
      stateChanges: stateChanges(entry.state_changes),
    }))
    .reverse();
}

/**
 * Restrained relative age ("há 10 dias") beneath an entry's exact date —
 * only for a parseable date that is not in the future relative to `now`;
 * otherwise nothing is shown rather than a misleading age.
 */
function elapsedAge(date: string, now: Date): string | null {
  const parsed = new Date(date);
  if (!date || Number.isNaN(parsed.valueOf()) || parsed.valueOf() > now.valueOf()) return null;
  return formatPublicRelativeDays(date, now);
}

function HistoryEntryItem({ entry, now, onOpenGeneric }: { entry: PrbHistoryEntry; now: Date; onOpenGeneric: (id: string) => void }) {
  const age = elapsedAge(entry.date, now);
  return (
    <li className="prb-history-entry">
      <div className="prb-history-entry-date">
        <time className="prb-history-entry-exact" dateTime={entry.date}>
          {formatPublicDate(entry.date)}
        </time>
        {age && <span className="prb-history-entry-age">{age}</span>}
      </div>
      <div className="prb-history-entry-body">
        <p className="prb-history-entry-summary">{entry.summary}</p>
        {entry.stateChanges.length > 0 && (
          <dl className="prb-history-entry-meta" aria-label="Alterações de estado">
            {entry.stateChanges.map(({ field, from, to }) => (
              <div key={field} className="prb-history-entry-meta-item">
                <dt>{publicFieldCaption(field)}</dt>
                <dd>
                  {publicEnumLabel(field, from)} → {publicEnumLabel(field, to)}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {entry.evidenceIds.length > 0 && (
          <dl className="prb-history-entry-meta">
            <div className="prb-history-entry-meta-item">
              <dt>Evidência</dt>
              <dd>
                <ul className="prb-history-entry-evidence">
                  {entry.evidenceIds.map((id) => (
                    <li key={id}>
                      <RecordIdentifier variant="action" id={id} density="compact" onActivate={() => onOpenGeneric(id)} accessibleLabel={`Abrir ${id}`} />
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        )}
      </div>
    </li>
  );
}

export interface PrbHistoryPresentationProps {
  identity: PrbIdentityData;
  entries: PrbHistoryEntry[];
  onOpenGeneric: (id: string) => void;
  onBackToOverview: () => void;
  onViewDetails: (id: string) => void;
  /** Navigates to this PRB's Detalhes audit section (`#prb-auditoria`), which Histórico itself does not contain. */
  onVerifyInDetails: (id: string) => void;
  titleRef?: RefObject<HTMLHeadingElement>;
  /** Reference instant for the relative entry ages; defaults to the current time. */
  now?: Date;
}

/**
 * Public PRB Histórico composition: the shared PRB local header + identity
 * hero (PrbPageHeader.tsx, identical to Detalhes), then one "Histórico
 * material" editorial section on the same left-intro + broad-content
 * section frame Detalhes uses (`.prb-section-*`, so the intro column moves
 * into normal flow at the same breakpoints) and, per canonical `history[]`
 * entry (newest first), a date column + content column row.
 * Read-only and backed only by canonical `history[]`: not a reconstructed
 * snapshot, audit log or timeline state machine, and never backfilled from
 * `updated_at`, git or evidence dates. Layout lives in styles/prb-history.css.
 *
 * Heading outline: the PRB title is the <h2> beneath the Explorer chrome
 * <h1>; the section heading is an <h3>.
 */
export function PrbHistoryPresentation({ identity, entries, onOpenGeneric, onBackToOverview, onViewDetails, onVerifyInDetails, titleRef, now = new Date() }: PrbHistoryPresentationProps) {
  const count = entries.length;
  return (
    <article aria-labelledby="prb-identity-title" className="prb-history-view">
      <PrbHeader
        identity={identity}
        active="history"
        onBackToOverview={onBackToOverview}
        onViewDetails={onViewDetails}
        onViewHistory={() => undefined}
        onVerify={() => onVerifyInDetails(identity.problemId)}
      />

      <div className="shell-frame shell-frame--wide">
        <PrbIdentityHeader identity={identity} titleRef={titleRef} />
      </div>

      <section id="prb-historico" aria-labelledby="prb-historico-heading" className="prb-section prb-history-section">
        <div className="shell-frame shell-frame--wide prb-section-frame">
          <div className="prb-section-intro">
            <h3 id="prb-historico-heading" className="detail-panel-label">
              Histórico material
            </h3>
            {count > 0 && (
              <p className="prb-section-intro-note">
                {formatPublicCount(count)} {count === 1 ? "alteração" : "alterações"} à formulação, ao âmbito ou à leitura da evidência. Correções de forma não
                entram aqui.
              </p>
            )}
          </div>
          <div className="prb-section-content">
            {count === 0 ? (
              <p className="prb-history-empty">Não existe histórico material registado para este problema.</p>
            ) : (
              <ol className="prb-history-list" aria-label="Histórico material">
                {entries.map((entry, index) => (
                  <HistoryEntryItem key={`${entry.date}-${index}`} entry={entry} now={now} onOpenGeneric={onOpenGeneric} />
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>
    </article>
  );
}

interface ProblemHistoryViewProps {
  dataProvider: DataProvider;
  problemId: string | null;
  onOpenGeneric: (id: string) => void;
  onBackToRecords: () => void;
  onBackToOverview: () => void;
  onViewAsProblem: (id: string) => void;
  onVerifyInDetails: (id: string) => void;
}

function ProblemHistoryContent({ dataProvider, problemId, onOpenGeneric, onBackToOverview, onViewAsProblem, onVerifyInDetails }: Omit<ProblemHistoryViewProps, "problemId" | "onBackToRecords"> & { problemId: string }) {
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
    return <div className="shell-frame"><ErrorNotice titleAs="h2" title="Não foi possível carregar o histórico" message={error instanceof Error ? error.message : String(error)} /></div>;
  }
  if (!detail) return <div className="shell-frame"><ProgressMessage message={`A carregar histórico de ${problemId}…`} /></div>;

  const record = detail.record as Record<string, unknown>;
  return (
    <PrbHistoryPresentation
      identity={prbIdentity(detail.id, record)}
      entries={prbHistoryEntries(record)}
      onOpenGeneric={onOpenGeneric}
      onBackToOverview={onBackToOverview}
      onViewDetails={onViewAsProblem}
      onVerifyInDetails={onVerifyInDetails}
      titleRef={headingRef}
    />
  );
}

/** Read-only PRB material-history projection over the existing DataProvider. */
export function ProblemHistoryView({ dataProvider, problemId, onOpenGeneric, onBackToRecords, onBackToOverview, onViewAsProblem, onVerifyInDetails }: ProblemHistoryViewProps) {
  const indexState = useRecordIndex(dataProvider);
  if (indexState.status === "loading") return <div className="shell-frame"><ProgressMessage message="A carregar…" /></div>;
  if (indexState.status === "error") return <div className="shell-frame"><ErrorNotice titleAs="h2" title="Não foi possível carregar os registos" message={indexState.error.message} action={<button type="button" onClick={indexState.retry}>Tentar novamente</button>} /></div>;
  if (problemId === null) return <div><p>Nenhum Problema selecionado.</p><button type="button" onClick={onBackToRecords}>Procurar um Problema em Registos</button></div>;

  const summary = indexState.lookup.get(problemId);
  if (summary && summary.type !== "PRB-") {
    return <ErrorNotice titleAs="h2" title="Este registo não é um Problema" message={`${formatTypedId(summary.type, problemId)} não pode ser aberto como histórico.`} action={<button type="button" onClick={() => onOpenGeneric(problemId)}>Ver detalhe genérico</button>} />;
  }
  return <ProblemHistoryContent dataProvider={dataProvider} problemId={problemId} onOpenGeneric={onOpenGeneric} onBackToOverview={onBackToOverview} onViewAsProblem={onViewAsProblem} onVerifyInDetails={onVerifyInDetails} />;
}
