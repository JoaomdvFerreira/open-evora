import { formatPublicDate } from "../presentation/presentation";
import type { MaterialChangeEntry } from "./overviewStats";

/**
 * `default` preserves ProblemView's pre-existing "Alterações materiais
 * recentes" presentation; `overview` is Overview's horizontal scroll-snap
 * rail. Both variants keep identical ordered-list semantics, callbacks,
 * empty state, and PRB.history-only data contract — see
 * `.material-change-list`/`-item` (default) vs `.material-change-list--overview`
 * (overview, CSS overflow/scroll-snap only, no JS carousel) in index.css.
 */
export function MaterialChangeTimeline({ entries, onExploreProblem, actionLabel = "Abrir problema →", actionAccessibleLabel, variant = "default" }: { entries: MaterialChangeEntry[]; onExploreProblem: (id: string) => void; actionLabel?: string; actionAccessibleLabel?: (entry: MaterialChangeEntry) => string; variant?: "default" | "overview" }) {
  if (entries.length === 0) {
    return <p className="material-change-empty-state">Ainda não existem alterações materiais registadas para apresentar.</p>;
  }

  const listClassName = variant === "overview" ? "material-change-list material-change-list--overview" : "material-change-list";

  return (
    <ol className={listClassName} aria-label="Alterações materiais recentes">
      {entries.map((entry) => (
        <li key={`${entry.problemId}-${entry.date}-${entry.summary}`} className="material-change-item">
          <time dateTime={entry.date} className="material-change-date">{formatPublicDate(entry.date)}</time>
          <div className="material-change-content">
            <p className="material-change-problem">
              {variant === "overview" ? (
                <>
                  <span className="material-change-problem-title">{entry.problemTitle}</span>
                  <span className="technical-id material-change-problem-id">{entry.problemId}</span>
                </>
              ) : (
                <>
                  <span className="technical-id material-change-problem-id">{entry.problemId}</span>
                  {entry.problemTitle}
                </>
              )}
            </p>
            <p className="material-change-summary">{entry.summary}</p>
            <button type="button" className="material-change-action" onClick={() => onExploreProblem(entry.problemId)} aria-label={actionAccessibleLabel?.(entry) ?? `Abrir problema ${entry.problemTitle}`}>
              {actionLabel}
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}
