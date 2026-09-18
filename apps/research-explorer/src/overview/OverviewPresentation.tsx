import { formatEvidenceCount, formatProblemCount, type CitizenProblem, type MaterialChangeEntry } from "./overviewStats";
import { formatPublicCount } from "../presentation/presentation";
import { ProgressMessage } from "../presentation/ProgressMessage";
import { ErrorNotice } from "../presentation/ErrorNotice";
import { CitizenProblemCard, CitizenSearchControl, TopicFilterGroup } from "./CitizenDiscovery";
import { MaterialChangeTimeline } from "./MaterialChangeTimeline";

export interface MaterialChangesPresentationState {
  entries: MaterialChangeEntry[];
  complete: boolean;
}

/**
 * Durable presentation-only Overview composition. Receives already-projected
 * data/state and callbacks; it must never reach into DataProvider, corpus,
 * routing, or canonical research state itself (see AGENTS.md canonical-state
 * integrity and docs/design/component-model.md §2.5 page-composition
 * boundary). `Overview.tsx` continues to own data loading, projection, and
 * URL/routing concerns; this component owns rendered structure only.
 */
export function OverviewPresentation({
  problemCount,
  evidenceCount,
  citizenProblems,
  visibleProblems,
  searchQuery,
  onSearchChange,
  topicCodes,
  activeTopic,
  onTopicChange,
  materialChanges,
  materialChangePresentationLimit,
  onExploreProblem,
  onViewRecords,
}: {
  problemCount: number;
  evidenceCount: number;
  citizenProblems: CitizenProblem[] | null;
  visibleProblems: CitizenProblem[] | null;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  topicCodes: string[];
  activeTopic: string | null;
  onTopicChange: (code: string | null) => void;
  materialChanges: MaterialChangesPresentationState | null;
  materialChangePresentationLimit: number;
  onExploreProblem: (id: string) => void;
  onViewRecords: () => void;
}) {
  return (
    <section aria-labelledby="overview-heading" className="public-overview shell-frame">
      <h2 id="overview-heading">Visão geral</h2>

      <div className="overview-hero">
        <p className="overview-hero-eyebrow">Projeto independente — não oficial</p>
        <h3 className="overview-hero-headline">Investigamos problemas práticos que afetam Évora.</h3>
        <p className="overview-hero-supporting">Reunimos fontes e evidência para mostrar o que sabemos, o que ainda não sabemos e o que mudou.</p>
      </div>

      <ul className="overview-metrics" aria-label="Números da investigação">
        <li className="overview-metric">{formatProblemCount(problemCount)}</li>
        <li className="overview-metric">{formatEvidenceCount(evidenceCount)}</li>
        <li className="overview-metric overview-metric--ongoing">Investigação em atualização contínua</li>
      </ul>

      <section className="overview-trust" aria-label="Como trabalhamos">
        <div className="overview-trust-tile">
          <h3>Fontes identificadas</h3>
          <p>Cada leitura remete para registos identificáveis e mantém a proveniência.</p>
        </div>
        <div className="overview-trust-tile">
          <h3>Com transparência</h3>
          <p>Mostramos o que sabemos, o que ainda não sabemos e o que mudou.</p>
        </div>
        <div className="overview-trust-tile">
          <h3>Para uma Évora mais informada</h3>
          <p>Organizamos a investigação para tornar problemas e mudanças mais fáceis de acompanhar.</p>
        </div>
      </section>

      <section className="overview-material-change-section" aria-labelledby="material-change-heading">
        <h3 id="material-change-heading">O que mudou recentemente</h3>
        {materialChanges === null ? (
          <ProgressMessage message="A carregar alterações materiais…" />
        ) : (
          <>
            {!materialChanges.complete && (
              <ErrorNotice
                title="Não foi possível carregar todo o histórico material"
                message="Não foi possível carregar o detalhe de alguns problemas. As alterações apresentadas podem estar incompletas."
              />
            )}
            {(materialChanges.complete || materialChanges.entries.length > 0) && (
              <MaterialChangeTimeline entries={materialChanges.entries.slice(0, materialChangePresentationLimit)} onExploreProblem={onExploreProblem} variant="overview" />
            )}
          </>
        )}
      </section>

      <section id="overview-problemas" aria-label="Explorar problemas">
        <CitizenSearchControl value={searchQuery} onChange={onSearchChange} />
        <TopicFilterGroup topicCodes={topicCodes} activeTopic={activeTopic} onChange={onTopicChange} />

        {citizenProblems === null || visibleProblems === null ? (
          <ProgressMessage message="A carregar problemas…" />
        ) : (
          <>
            <div className="overview-results-toolbar">
              <div aria-live="polite" aria-atomic="true">
                {visibleProblems.length === 0 ? (
                  <p className="overview-empty-state">Nenhum problema corresponde à pesquisa ou ao filtro selecionado.</p>
                ) : (
                  <p className="overview-results-count">{formatPublicCount(visibleProblems.length)} de {formatPublicCount(citizenProblems.length)} problemas</p>
                )}
              </div>
              <button type="button" className="overview-records-action" onClick={onViewRecords}>Ver todos os registos →</button>
            </div>
            {visibleProblems.length > 0 && (
              <ul className="overview-problem-list">
                {visibleProblems.map((problem) => (
                  <CitizenProblemCard key={problem.id} problem={problem} onExplore={onExploreProblem} />
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </section>
  );
}
