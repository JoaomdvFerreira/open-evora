import { useEffect, useState } from "react";
import type { DataProvider } from "../dataProvider/types";
import { useRecordIndex } from "../records/useRecordIndex";
import { findMeaningField } from "../records/meaningField";
import { computePublicOverviewData, formatEvidenceCount, formatProblemCount } from "./overviewStats";
import { formatPublicCount, publicCompactEnumLabel, publicEnumLabel } from "../presentation/presentation";
import { ValidationStatus, EvidenceStatus } from "../problem/InvestigationStatus";
import { ProgressMessage } from "../presentation/ProgressMessage";
import { ErrorNotice } from "../presentation/ErrorNotice";

const ERROR_TITLES: Record<string, string> = {
  missing: "Modelo de leitura gerado não encontrado",
  malformed: "Índice de registos mal formado",
  incompatible: "Versão do modelo de leitura incompatível",
  network: "Falha ao carregar a visão geral",
};

/**
 * Lightweight corpus-orientation view built only from the already-loaded
 * index.json (via the same DataProvider.listRecords(), cached — this does
 * not trigger a second network fetch alongside Records). No charting
 * dependency; plain counts/tables only.
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
  const [fullTitles, setFullTitles] = useState<Map<string, string> | null>(null);
  const overview = indexState.status === "ready" ? computePublicOverviewData(indexState.records) : null;
  const problemIds = overview?.problems.map((problem) => problem.id).join("|") ?? "";

  useEffect(() => {
    if (overview === null) {
      setFullTitles(null);
      return;
    }
    let cancelled = false;
    setFullTitles(null);
    Promise.all(
      overview.problems.map(async (problem) => {
        try {
          const detail = await dataProvider.getRecord(problem.id);
          return [problem.id, findMeaningField(detail.record)?.value ?? problem.title] as const;
        } catch {
          return [problem.id, problem.title] as const;
        }
      })
    ).then((titles) => {
      if (!cancelled) setFullTitles(new Map(titles));
    });
    return () => {
      cancelled = true;
    };
  }, [dataProvider, problemIds]);

  if (indexState.status === "loading") {
    return <ProgressMessage message="A carregar visão geral…" />;
  }

  if (indexState.status === "error") {
    return (
      <ErrorNotice
        titleAs="h2"
        title={ERROR_TITLES[indexState.error.kind] ?? "Não foi possível carregar a visão geral"}
        message={indexState.error.message}
      />
    );
  }

  if (overview === null) return null;

  const unvalidatedLabel = publicEnumLabel("validation_status", "unvalidated");
  const corroboratedLabel = publicEnumLabel("evidence_status", "corroborated");
  const compactCorroboratedLabel = publicCompactEnumLabel("evidence_status", "corroborated");

  return (
    <section aria-labelledby="overview-heading" className="public-overview shell-frame">
      <h2 id="overview-heading">Visão geral</h2>
      <p className="overview-introduction">Open Évora é um projeto de investigação cívica independente sobre problemas práticos que afetam Évora e onde podem existir oportunidades de intervenção úteis.</p>
      <p className="overview-supporting-copy">Este Explorador de Investigação dá acesso público às evidências, avaliações e incertezas que sustentam essa investigação.</p>

      <div className="overview-primary-actions">
        <p className="overview-independence">
          <span className="overview-desktop-copy"><strong>Projeto independente.</strong> Não representa a Câmara Municipal de Évora nem qualquer entidade oficial; não é um serviço ou plataforma municipal oficial.</span>
          <span className="overview-mobile-copy">Projeto independente — não oficial</span>
        </p>
        <p><a href="#overview-problemas">Explorar problemas ↓</a></p>
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

      <p className="overview-trust"><strong>Base explícita.</strong> Cada leitura remete para registos identificáveis e para a evidência que a sustenta, refina, contesta ou atualiza. A proveniência é preservada e rastreável, sem implicar que toda a evidência tenha a mesma força.</p>

      <details className="overview-status-explanation">
        <summary>
          <span className="overview-desktop-copy">Os problemas abaixo estão confirmados? O que significam os estados?</span>
          <span className="overview-mobile-copy">O que é isto, e os problemas estão confirmados?</span>
        </summary>
        <p className="overview-desktop-copy">Nenhum problema listado é uma conclusão fechada. <strong>{unvalidatedLabel}</strong> significa que a validação formal ainda está pendente — não que o problema seja falso. <strong>{corroboratedLabel}</strong> descreve o estado atual da evidência reunida; não torna o problema uma conclusão encerrada. A ordem abaixo não é uma classificação.</p>
        <p className="overview-mobile-copy">Este Explorador dá acesso a evidências e incertezas — não é um serviço oficial. <strong>{unvalidatedLabel}</strong> não significa falso; <strong>{compactCorroboratedLabel}</strong> descreve o estado atual da evidência, não uma conclusão fechada.</p>
      </details>

      <section id="overview-problemas" aria-labelledby="overview-problemas-heading">
        <div className="overview-problems-heading">
          <h3 id="overview-problemas-heading">Problemas em investigação ({formatPublicCount(overview.problemCount)})</h3>
          <p>ordenados por identificador, não por relevância</p>
        </div>
        {fullTitles === null ? (
          <ProgressMessage message="A carregar títulos dos problemas…" />
        ) : (
          <ul className="overview-problem-list">
            {overview.problems.map((problem) => (
              <li key={problem.id}>
                <div className="overview-problem-identity">
                  <code>{problem.id}</code>
                  <h4 className="overview-problem-title">{fullTitles.get(problem.id) ?? problem.title}</h4>
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
        )}
      </section>

      <p className="overview-closing-actions">
        <button type="button" onClick={onViewRecords}>Ver todos os registos →</button>
      </p>

      <p className="overview-corpus-context">{formatProblemCount(overview.problemCount)} · {formatEvidenceCount(overview.evidenceCount)} · investigação em atualização contínua</p>
    </section>
  );
}
