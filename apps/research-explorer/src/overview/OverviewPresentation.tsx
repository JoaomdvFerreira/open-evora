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

      <p className="overview-independence">
        <span className="overview-desktop-copy"><strong>Projeto independente.</strong> Não representa a Câmara Municipal de Évora nem qualquer entidade oficial; não é um serviço ou plataforma municipal oficial.</span>
        <span className="overview-mobile-copy">Projeto independente — não oficial</span>
      </p>

      <div className="overview-hero">
        <h3 className="overview-hero-headline">Investigamos problemas práticos que afetam Évora.</h3>
        <p className="overview-hero-supporting">Reunimos fontes e evidência para mostrar o que sabemos, o que ainda não sabemos e o que mudou.</p>
      </div>

      <section className="overview-concepts" aria-label="O que contém o Explorador">
        <div>
          <h3>Problemas</h3>
          <p>Fricções cívicas identificadas a partir de evidência — com o que já se sabe e o que ainda não se sabe.</p>
        </div>
        <div>
          <h3>Evidência</h3>
          <p>Registos individuais — institucionais, públicos, comunitários e de intervenientes — que sustentam, contestam ou atualizam cada leitura.</p>
        </div>
        <div>
          <h3>Proveniência e incerteza</h3>
          <p>Cada registo mantém a sua origem. O que ainda não sabemos é registado explicitamente, não escondido.</p>
        </div>
      </section>

      <section id="overview-problemas" aria-label="Explorar problemas">
        <CitizenSearchControl value={searchQuery} onChange={onSearchChange} />
        <TopicFilterGroup topicCodes={topicCodes} activeTopic={activeTopic} onChange={onTopicChange} />

        <p className="overview-coverage-caveat">Os problemas apresentados são os atualmente acompanhados pelo Open Évora. Não constituem um inventário completo dos problemas existentes em Évora.</p>

        <p className="overview-ordering-note">Ordenados por identificador — a ordem não representa prioridade ou relevância.</p>

        {citizenProblems === null || visibleProblems === null ? (
          <ProgressMessage message="A carregar problemas…" />
        ) : (
          <>
            <div aria-live="polite" aria-atomic="true">
              {visibleProblems.length === 0 ? (
                <p className="overview-empty-state">Nenhum problema corresponde à pesquisa ou ao filtro selecionado.</p>
              ) : (
                <p className="overview-results-count">{formatPublicCount(visibleProblems.length)} de {formatPublicCount(citizenProblems.length)} problemas</p>
              )}
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

      <p className="overview-closing-actions">
        <button type="button" onClick={onViewRecords}>Ver todos os registos →</button>
      </p>

      <p className="overview-corpus-context">{formatProblemCount(problemCount)} · {formatEvidenceCount(evidenceCount)} · investigação em atualização contínua</p>
    </section>
  );
}
