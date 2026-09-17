import { formatPublicDate } from "../presentation/presentation";
import type { MaterialChangeEntry } from "./overviewStats";

export function MaterialChangeTimeline({ entries, onExploreProblem }: { entries: MaterialChangeEntry[]; onExploreProblem: (id: string) => void }) {
  if (entries.length === 0) {
    return <p className="material-change-empty-state">Ainda não existem alterações materiais registadas para apresentar.</p>;
  }

  return (
    <ol className="material-change-list" aria-label="Alterações materiais recentes">
      {entries.map((entry) => (
        <li key={`${entry.problemId}-${entry.date}-${entry.summary}`} className="material-change-item">
          <time dateTime={entry.date} className="material-change-date">{formatPublicDate(entry.date)}</time>
          <div className="material-change-content">
            <p className="material-change-problem"><span className="technical-id">{entry.problemId}</span> · {entry.problemTitle}</p>
            <p className="material-change-summary">{entry.summary}</p>
            <button type="button" onClick={() => onExploreProblem(entry.problemId)} aria-label={`Abrir problema ${entry.problemTitle}`}>
              Abrir problema →
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}
