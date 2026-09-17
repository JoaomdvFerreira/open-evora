import type { RefObject } from "react";
import { formatPublicDate } from "../presentation/presentation";
import { TopicBadge } from "../presentation/TopicBadge";
import { ProblemLifecycleStatus } from "./ProblemLifecycleStatus";
import { EvidenceStatus, ValidationStatus } from "./InvestigationStatus";
import { ShareAction } from "./ShareAction";

export interface ProblemIdentityHeaderProps {
  problemId: string; title: string; statement: string | null; geography: string | null; affectedPopulations: string[]; updatedAt: string | null; topics: string[]; status: string | null; evidenceStatus: string | null; validationStatus: string | null; headingRef: RefObject<HTMLHeadingElement>;
}

/** Public identity and authored PRB metadata; all investigation dimensions stay separately labelled. */
export function ProblemIdentityHeader({ problemId, title, statement, geography, affectedPopulations, updatedAt, topics, status, evidenceStatus, validationStatus, headingRef }: ProblemIdentityHeaderProps) {
  return <header className="problem-identity">
    <div className="problem-identity-heading-row"><h2 ref={headingRef} id="problem-heading" tabIndex={-1} className="problem-identity-title">{title}</h2><ShareAction title={title} /></div>
    <div className="problem-identity-id">{problemId}</div>
    {statement && <p className="problem-statement problem-header-statement">{statement}</p>}
    {topics.length > 0 && <div className="problem-topic-list" aria-label="Temas">{topics.map((topic) => <TopicBadge key={topic} code={topic} />)}</div>}
    <div className="status-chip-row problem-header-states">{status && <ProblemLifecycleStatus value={status} form="reading" />}{evidenceStatus && <EvidenceStatus value={evidenceStatus} form="reading" />}{validationStatus && <ValidationStatus value={validationStatus} form="reading" />}</div>
    {(geography || affectedPopulations.length > 0 || updatedAt) && <dl className="problem-header-facts" aria-label="Informação pública do problema">
      {geography && <div className="problem-header-fact"><dt>Geografia</dt><dd>{geography}</dd></div>}
      {affectedPopulations.length > 0 && <div className="problem-header-fact"><dt>Populações afetadas</dt><dd>{affectedPopulations.join(", ")}</dd></div>}
      {updatedAt && <div className="problem-header-fact"><dt>Última atualização do registo</dt><dd><time dateTime={updatedAt}>{formatPublicDate(updatedAt)}</time></dd></div>}
    </dl>}
  </header>;
}
