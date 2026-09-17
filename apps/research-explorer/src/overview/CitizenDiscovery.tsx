import type { CitizenProblem } from "./overviewStats";
import { TopicBadge } from "../presentation/TopicBadge";
import { describeTopic } from "../presentation/topicMapping";
import { IconSearch } from "../presentation/icons";
import { ValidationStatus, EvidenceStatus } from "../problem/InvestigationStatus";

export function CitizenSearchControl({ value, onChange, id = "overview-search-input" }: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <div className="overview-search">
      <label htmlFor={id} className="overview-search-label">Pesquisar problemas</label>
      <span className="overview-search-input-wrap">
        <IconSearch className="overview-search-icon" />
        <input id={id} type="search" className="overview-search-input" placeholder="Pesquisar problemas em Évora…" value={value} onChange={(event) => onChange(event.target.value)} />
      </span>
    </div>
  );
}

export function TopicFilterGroup({ topicCodes, activeTopic, onChange }: {
  topicCodes: string[];
  activeTopic: string | null;
  onChange: (code: string | null) => void;
}) {
  if (topicCodes.length === 0) return null;
  return (
    <div className="overview-topic-filters" role="group" aria-label="Filtrar por tema">
      <button type="button" className="overview-topic-filter" aria-pressed={activeTopic === null} onClick={() => onChange(null)}>Todos</button>
      {topicCodes.map((code) => (
        <button key={code} type="button" className="overview-topic-filter" aria-pressed={activeTopic === code} onClick={() => onChange(activeTopic === code ? null : code)}>{describeTopic(code).label}</button>
      ))}
    </div>
  );
}

export function CitizenProblemCard({ problem, onExplore }: { problem: CitizenProblem; onExplore: (id: string) => void }) {
  return (
    <li className="citizen-problem-card">
      <div className="overview-problem-identity">
        {problem.domainCodes.length > 0 && (
          <div className="overview-problem-topics">
            {problem.domainCodes.map((code) => <TopicBadge key={code} code={code} />)}
          </div>
        )}
        <h4 className="overview-problem-title">{problem.title}</h4>
        {problem.problemStatement !== null && <p className="overview-problem-statement">{problem.problemStatement}</p>}
        <code className="overview-problem-technical-id">{problem.id}</code>
      </div>
      <div className="overview-problem-action">
        {(problem.validationStatus !== null || problem.evidenceStatus !== null) && (
          <p className="overview-statuses">
            {problem.validationStatus !== null && <span className="overview-status-dimension"><ValidationStatus value={problem.validationStatus} form="overview" /></span>}
            {problem.evidenceStatus !== null && <span className="overview-status-dimension">{problem.validationStatus !== null && <span aria-hidden="true"> · </span>}<EvidenceStatus value={problem.evidenceStatus} form="overview" /></span>}
          </p>
        )}
        <button type="button" onClick={() => onExplore(problem.id)}>Explorar →</button>
      </div>
    </li>
  );
}
