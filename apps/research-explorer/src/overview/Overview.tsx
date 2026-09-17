import { useEffect, useMemo, useState } from "react";
import type { DataProvider } from "../dataProvider/types";
import { useRecordIndex } from "../records/useRecordIndex";
import {
  computePublicOverviewData,
  formatEvidenceCount,
  formatProblemCount,
  matchesCitizenSearch,
  matchesTopicFilter,
  relevantTopicCodes,
  toCitizenProblem,
  type CitizenProblem,
} from "./overviewStats";
import { formatPublicCount, publicEnumLabel, publicCompactEnumLabel } from "../presentation/presentation";
import { ValidationStatus, EvidenceStatus } from "../problem/InvestigationStatus";
import { TopicBadge } from "../presentation/TopicBadge";
import { describeTopic } from "../presentation/topicMapping";
import { IconSearch } from "../presentation/icons";
import { ProgressMessage } from "../presentation/ProgressMessage";
import { ErrorNotice } from "../presentation/ErrorNotice";

const ERROR_TITLES: Record<string, string> = {
  missing: "Modelo de leitura gerado não encontrado",
  malformed: "Índice de registos mal formado",
  incompatible: "Versão do modelo de leitura incompatível",
  network: "Falha ao carregar a visão geral",
};

/**
 * Citizen-first Overview (WU054). Loads the same index.json summaries as
 * before, then resolves each PRB's full canonical detail once (the same
 * `getRecord()` reads the previous Overview already performed only to
 * resolve titles) and projects each into a runtime-only `CitizenProblem`
 * (overviewStats.ts's `toCitizenProblem`) — never persisted, never a second
 * parallel data path. Search and topic filters operate purely client-side
 * over that projection; PRB ID order is the deterministic neutral ordering
 * throughout, unaffected by search/filter/ranking.
 */
export function Overview({
  dataProvider,
  onExploreProblem,
  onViewRecords,
}: {
  dataProvider: DataProvider;
  onExploreProblem: (id: string) => void;
  onViewRecords: () => void;
}) {
  const indexState = useRecordIndex(dataProvider);
  const [citizenProblems, setCitizenProblems] = useState<CitizenProblem[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const overview = indexState.status === "ready" ? computePublicOverviewData(indexState.records) : null;
  const problemIds = overview?.problems.map((problem) => problem.id).join("|") ?? "";

  useEffect(() => {
    if (indexState.status !== "ready") {
      setCitizenProblems(null);
      return;
    }
    let cancelled = false;
    setCitizenProblems(null);
    const summaries = indexState.records.filter((record) => record.type === "PRB-");
    Promise.all(
      summaries.map(async (summary) => {
        try {
          const detail = await dataProvider.getRecord(summary.id);
          return toCitizenProblem(summary, detail);
        } catch {
          return toCitizenProblem(summary, { id: summary.id, type: summary.type, file: summary.file, record: {}, outgoingEdges: [], incomingEdges: [] });
        }
      })
    ).then((problems) => {
      if (!cancelled) setCitizenProblems(problems.sort((a, b) => a.id.localeCompare(b.id)));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- problemIds is a stable content-based key for the summaries above
  }, [dataProvider, indexState.status, problemIds]);

  const topicCodes = useMemo(() => (citizenProblems ? relevantTopicCodes(citizenProblems) : []), [citizenProblems]);

  const visibleProblems = useMemo(() => {
    if (!citizenProblems) return null;
    return citizenProblems.filter((problem) => matchesTopicFilter(problem, activeTopic) && matchesCitizenSearch(problem, searchQuery));
  }, [citizenProblems, activeTopic, searchQuery]);

  if (indexState.status === "loading") {
    return <div className="shell-frame"><ProgressMessage message="A carregar visão geral…" /></div>;
  }

  if (indexState.status === "error") {
    return (
      <div className="shell-frame">
        <ErrorNotice
          titleAs="h2"
          title={ERROR_TITLES[indexState.error.kind] ?? "Não foi possível carregar a visão geral"}
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

  if (overview === null) return null;

  const unvalidatedLabel = publicEnumLabel("validation_status", "unvalidated");
  const corroboratedLabel = publicEnumLabel("evidence_status", "corroborated");
  const compactCorroboratedLabel = publicCompactEnumLabel("evidence_status", "corroborated");

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

      <details className="overview-status-explanation">
        <summary>
          <span className="overview-desktop-copy">Os problemas abaixo estão confirmados? O que significam os estados?</span>
          <span className="overview-mobile-copy">O que é isto, e os problemas estão confirmados?</span>
        </summary>
        <p className="overview-desktop-copy">Nenhum problema listado é uma conclusão fechada. <strong>{unvalidatedLabel}</strong> significa que a validação formal ainda está pendente — não que o problema seja falso. <strong>{corroboratedLabel}</strong> descreve o estado atual da evidência reunida; não torna o problema uma conclusão encerrada.</p>
        <p className="overview-mobile-copy">Este Explorador dá acesso a evidências e incertezas — não é um serviço oficial. <strong>{unvalidatedLabel}</strong> não significa falso; <strong>{compactCorroboratedLabel}</strong> descreve o estado atual da evidência, não uma conclusão fechada.</p>
      </details>

      <section id="overview-problemas" aria-labelledby="overview-problemas-heading">
        <div className="overview-problems-heading">
          <h3 id="overview-problemas-heading">Problemas em investigação ({formatPublicCount(overview.problemCount)})</h3>
        </div>

        <p className="overview-coverage-caveat">Os problemas apresentados são os atualmente acompanhados pelo Open Évora. Não constituem um inventário completo dos problemas existentes em Évora.</p>

        <p className="overview-ordering-note">Ordenados por identificador — a ordem não representa prioridade ou relevância.</p>

        <div className="overview-search">
          <label htmlFor="overview-search-input" className="overview-search-label">Pesquisar problemas</label>
          <span className="overview-search-input-wrap">
            <IconSearch className="overview-search-icon" />
            <input
              id="overview-search-input"
              type="search"
              className="overview-search-input"
              placeholder="Pesquisar problemas em Évora…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </span>
        </div>

        {topicCodes.length > 0 && (
          <div className="overview-topic-filters" role="group" aria-label="Filtrar por tema">
            <button
              type="button"
              className="overview-topic-filter"
              aria-pressed={activeTopic === null}
              onClick={() => setActiveTopic(null)}
            >
              Todos
            </button>
            {topicCodes.map((code) => (
              <button
                key={code}
                type="button"
                className="overview-topic-filter"
                aria-pressed={activeTopic === code}
                onClick={() => setActiveTopic((current) => (current === code ? null : code))}
              >
                {describeTopic(code).label}
              </button>
            ))}
          </div>
        )}

        {citizenProblems === null || visibleProblems === null ? (
          <ProgressMessage message="A carregar problemas…" />
        ) : visibleProblems.length === 0 ? (
          <p className="overview-empty-state">Nenhum problema corresponde à pesquisa ou ao filtro selecionado.</p>
        ) : (
          <>
            <p className="overview-results-count">{formatPublicCount(visibleProblems.length)} de {formatPublicCount(citizenProblems.length)} problemas</p>
            <ul className="overview-problem-list">
              {visibleProblems.map((problem) => (
                <li key={problem.id}>
                  <div className="overview-problem-identity">
                    {problem.domainCodes.length > 0 && (
                      <div className="overview-problem-topics">
                        {problem.domainCodes.map((code) => (
                          <TopicBadge key={code} code={code} />
                        ))}
                      </div>
                    )}
                    <h4 className="overview-problem-title">{problem.title}</h4>
                    {problem.problemStatement !== null && (
                      <p className="overview-problem-statement">{problem.problemStatement}</p>
                    )}
                    <code className="overview-problem-technical-id">{problem.id}</code>
                  </div>
                  <div className="overview-problem-action">
                    {(problem.validationStatus !== null || problem.evidenceStatus !== null) && (
                      <p className="overview-statuses">
                        {problem.validationStatus !== null && (
                          <span className="overview-status-dimension">
                            <ValidationStatus value={problem.validationStatus} form="overview" />
                          </span>
                        )}
                        {problem.evidenceStatus !== null && (
                          <span className="overview-status-dimension">
                            {problem.validationStatus !== null && <span aria-hidden="true"> · </span>}
                            <EvidenceStatus value={problem.evidenceStatus} form="overview" />
                          </span>
                        )}
                      </p>
                    )}
                    <button type="button" onClick={() => onExploreProblem(problem.id)}>Explorar →</button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <p className="overview-trust"><strong>Base explícita.</strong> Cada leitura remete para registos identificáveis e para a evidência que a sustenta, refina, contesta ou atualiza. A proveniência é preservada e rastreável, sem implicar que toda a evidência tenha a mesma força.</p>

      <p className="overview-closing-actions">
        <button type="button" onClick={onViewRecords}>Ver todos os registos →</button>
      </p>

      <p className="overview-corpus-context">{formatProblemCount(overview.problemCount)} · {formatEvidenceCount(overview.evidenceCount)} · investigação em atualização contínua</p>
    </section>
  );
}
