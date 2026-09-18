import { evidenceCountLabel, problemCountLabel, type CitizenProblem, type MaterialChangeEntry } from "./overviewStats";
import { formatPublicCount } from "../presentation/presentation";
import { ProgressMessage } from "../presentation/ProgressMessage";
import { ErrorNotice } from "../presentation/ErrorNotice";
import { CitizenProblemCard, CitizenSearchControl, TopicFilterGroup } from "./CitizenDiscovery";
import { MaterialChangeTimeline } from "./MaterialChangeTimeline";
import {
  IconCompass,
  IconEvidenceStack,
  IconProblemRecord,
  IconSource,
  IconTransparency,
  IconTrendUp,
} from "../presentation/icons";
import { useNarrowViewport } from "../records/useNarrowViewport";
import heroEvora700 from "../assets/overview/hero-evora-700.jpg";
import heroEvora700Avif from "../assets/overview/hero-evora-700.avif";
import heroEvora700Webp from "../assets/overview/hero-evora-700.webp";
import heroEvora1000Avif from "../assets/overview/hero-evora-1000.avif";
import heroEvora1000Webp from "../assets/overview/hero-evora-1000.webp";

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
  // The Hero photograph is compact-omitted (delta §2/§7): below the 767px
  // product boundary it is not rendered at all, so no client ever fetches
  // the desktop derivative purely because it exists in the DOM/CSS. This
  // reuses the one existing narrow-viewport hook (records/useNarrowViewport)
  // rather than duplicating its resize-listener logic for a second need.
  const isNarrowViewport = useNarrowViewport();

  return (
    <section aria-labelledby="overview-heading" className="public-overview shell-frame">
      <h2 id="overview-heading">Visão geral</h2>

      <div className="overview-top-surface">
        <div className="overview-hero">
          <div className="overview-hero-content">
            <p className="overview-hero-eyebrow">Projeto independente — não oficial</p>
            <h3 className="overview-hero-headline">Investigamos problemas práticos que afetam Évora.</h3>
            <p className="overview-hero-supporting">Reunimos fontes e evidência para mostrar o que sabemos, o que ainda não sabemos e o que mudou.</p>

            <ul className="overview-metrics" aria-label="Números da investigação">
              <li className="overview-metric">
                <span className="overview-metric-icon-backplate" aria-hidden="true"><IconProblemRecord className="overview-metric-icon" /></span>
                <span className="overview-metric-text">
                  <span className="overview-metric-value">{problemCount}</span>
                  <span className="overview-metric-label">{problemCountLabel(problemCount)}</span>
                </span>
              </li>
              <li className="overview-metric">
                <span className="overview-metric-icon-backplate" aria-hidden="true"><IconEvidenceStack className="overview-metric-icon" /></span>
                <span className="overview-metric-text">
                  <span className="overview-metric-value">{evidenceCount}</span>
                  <span className="overview-metric-label">{evidenceCountLabel(evidenceCount)}</span>
                </span>
              </li>
              <li className="overview-metric overview-metric--ongoing">
                <span className="overview-metric-icon-backplate" aria-hidden="true"><IconTrendUp className="overview-metric-icon" /></span>
                <span className="overview-metric-text">Investigação em atualização contínua</span>
              </li>
            </ul>
          </div>

          {!isNarrowViewport && (
            <div className="overview-hero-media-composition">
              <figure className="overview-hero-media">
                <picture>
                  <source type="image/avif" srcSet={`${heroEvora700Avif} 700w, ${heroEvora1000Avif} 1000w`} sizes="min(42vw, 30rem)" />
                  <source type="image/webp" srcSet={`${heroEvora700Webp} 700w, ${heroEvora1000Webp} 1000w`} sizes="min(42vw, 30rem)" />
                  <img src={heroEvora700} width={700} height={291} alt="" loading="eager" fetchPriority="high" />
                </picture>
              </figure>
              <p className="overview-hero-attribution">
                Fotografia: <a href="https://commons.wikimedia.org/wiki/user:Christian_G%C3%A4nshirt" target="_blank" rel="noopener noreferrer">Christian Gänshirt</a> ·{" "}
                <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a> · adaptada para apresentação
              </p>
            </div>
          )}
        </div>

        <section className="overview-trust" aria-label="Como trabalhamos">
          <div className="overview-trust-tile">
            <span className="overview-trust-icon-backplate" aria-hidden="true"><IconSource className="overview-trust-icon" /></span>
            <div className="overview-trust-tile-text">
              <h3>Fontes identificadas</h3>
              <p>Cada leitura remete para registos identificáveis e mantém a proveniência.</p>
            </div>
          </div>
          <div className="overview-trust-tile">
            <span className="overview-trust-icon-backplate" aria-hidden="true"><IconTransparency className="overview-trust-icon" /></span>
            <div className="overview-trust-tile-text">
              <h3>Com transparência</h3>
              <p>Mostramos o que sabemos, o que ainda não sabemos e o que mudou.</p>
            </div>
          </div>
          <div className="overview-trust-tile">
            <span className="overview-trust-icon-backplate" aria-hidden="true"><IconCompass className="overview-trust-icon" /></span>
            <div className="overview-trust-tile-text">
              <h3>Para uma Évora mais informada</h3>
              <p>Organizamos a investigação para tornar problemas e mudanças mais fáceis de acompanhar.</p>
            </div>
          </div>
        </section>
      </div>

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
