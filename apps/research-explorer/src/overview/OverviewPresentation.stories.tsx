import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import "../index.css";
import "../styles/topic.css";
import { OverviewPresentation } from "./OverviewPresentation";
import {
  matchesCitizenSearch,
  matchesTopicFilter,
  relevantTopicCodes,
  type CitizenProblem,
  type MaterialChangeEntry,
} from "./overviewStats";
import { publicCompactEnumLabel, publicEnumLabel } from "../presentation/presentation";

const meta = { title: "Overview/Full composition" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const MATERIAL_CHANGE_PRESENTATION_LIMIT = 5;

/**
 * Realistic multi-problem fixture. Every problem id is a synthetic PRB-XXXX
 * per docs/design/foundations.md; content covers the state combinations
 * Overview.tsx itself renders differently (all three dimensions present,
 * only some present, multiple topics, long content) so full-page composition
 * exercises real rhythm rather than a single repeated card.
 */
const problems: CitizenProblem[] = [
  {
    id: "PRB-0001", title: "Percursos pedonais entre bairros e serviços",
    problemStatement: "Pessoas que se deslocam a pé entre bairros residenciais e serviços essenciais descrevem passeios interrompidos e desvios frequentes.",
    domainCodes: ["MOB"], affectedPopulations: ["Pessoas idosas", "Pessoas com mobilidade reduzida"], geographyArea: "Évora",
    lifecycleStatus: "OPEN", validationStatus: "unvalidated", evidenceStatus: "corroborated", updatedAt: "2026-04-08",
  },
  {
    id: "PRB-0002", title: "Acesso a informação de estacionamento",
    problemStatement: "A informação pública sobre disponibilidade de estacionamento está dispersa por múltiplas fontes desatualizadas.",
    domainCodes: ["MOB", "PUB"], affectedPopulations: [], geographyArea: "Centro histórico",
    lifecycleStatus: "OPEN", validationStatus: null, evidenceStatus: "corroborated", updatedAt: "2026-03-12",
  },
  {
    id: "PRB-0003", title: "Continuidade dos horários de recolha de resíduos",
    problemStatement: null,
    domainCodes: ["ENV"], affectedPopulations: [], geographyArea: null,
    lifecycleStatus: "OPEN", validationStatus: "unvalidated", evidenceStatus: null, updatedAt: null,
  },
  {
    id: "PRB-0004", title: "Disponibilidade de consultas de cuidados primários",
    problemStatement: "Utentes reportam tempos de espera prolongados para marcação de consultas em centros de saúde locais.",
    domainCodes: ["HEA"], affectedPopulations: ["Famílias com crianças pequenas"], geographyArea: "Évora",
    lifecycleStatus: "UNDER_REVIEW", validationStatus: "unvalidated", evidenceStatus: "corroborated", updatedAt: "2026-02-20",
  },
  {
    id: "PRB-0005", title: "Dificuldades persistentes nas deslocações quotidianas entre bairros, equipamentos e serviços públicos no centro histórico e periferia de Évora",
    problemStatement: "Pessoas que atravessam a cidade para aceder a serviços essenciais descrevem interrupções e desvios frequentes, com impacto desproporcional em quem depende de transporte público ou percursos pedonais para tarefas do quotidiano, incluindo deslocações a serviços de saúde, educação e comércio local.",
    domainCodes: ["MOB", "PUB", "HEA"], affectedPopulations: ["Pessoas idosas", "Pessoas com mobilidade reduzida", "Famílias com crianças pequenas"], geographyArea: "Évora e freguesias limítrofes",
    lifecycleStatus: "OPEN", validationStatus: "unvalidated", evidenceStatus: "corroborated", updatedAt: "2026-04-01",
  },
  {
    id: "PRB-0006", title: "Sinalização de obras em espaço público",
    problemStatement: "Obras em curso no espaço público carecem de sinalização consistente para peões e condutores.",
    domainCodes: ["future-domain"], affectedPopulations: [], geographyArea: "Évora",
    lifecycleStatus: null, validationStatus: null, evidenceStatus: null, updatedAt: null,
  },
];

const materialChangeEntries: MaterialChangeEntry[] = [
  { problemId: "PRB-0001", problemTitle: "Percursos pedonais entre bairros e serviços", date: "2026-04-08", summary: "Foi registada uma alteração material na leitura atual do problema." },
  { problemId: "PRB-0005", problemTitle: "Dificuldades persistentes nas deslocações quotidianas", date: "2026-04-01", summary: "A evidência reunida passou a ser apresentada com uma limitação adicional." },
  { problemId: "PRB-0002", problemTitle: "Acesso a informação de estacionamento", date: "2026-03-12", summary: "O estado de validação foi atualizado após revisão da evidência disponível." },
  { problemId: "PRB-0004", problemTitle: "Disponibilidade de consultas de cuidados primários", date: "2026-02-20", summary: "Nova evidência institucional foi associada a este problema." },
];

const unvalidatedLabel = publicEnumLabel("validation_status", "unvalidated");
const corroboratedLabel = publicEnumLabel("evidence_status", "corroborated");
const compactCorroboratedLabel = publicCompactEnumLabel("evidence_status", "corroborated");

const sharedLabels = { unvalidatedLabel, corroboratedLabel, compactCorroboratedLabel };

function useOverviewState(initial: { search?: string; topic?: string | null; source?: CitizenProblem[] } = {}) {
  const source = initial.source ?? problems;
  const [searchQuery, setSearchQuery] = useState(initial.search ?? "");
  const [activeTopic, setActiveTopic] = useState<string | null>(initial.topic ?? null);
  const topicCodes = useMemo(() => relevantTopicCodes(source), [source]);
  const visibleProblems = useMemo(
    () => source.filter((problem) => matchesTopicFilter(problem, activeTopic) && matchesCitizenSearch(problem, searchQuery)),
    [source, activeTopic, searchQuery]
  );
  return { searchQuery, setSearchQuery, activeTopic, setActiveTopic, topicCodes, visibleProblems, source };
}

function FullOverview({
  source = problems,
  search,
  topic,
  citizenProblemsOverride,
  visibleProblemsOverride,
  materialChanges = { entries: materialChangeEntries, complete: true },
}: {
  source?: CitizenProblem[];
  search?: string;
  topic?: string | null;
  citizenProblemsOverride?: CitizenProblem[] | null;
  visibleProblemsOverride?: CitizenProblem[] | null;
  materialChanges?: { entries: MaterialChangeEntry[]; complete: boolean } | null;
}) {
  const state = useOverviewState({ search, topic, source });
  const citizenProblems = citizenProblemsOverride !== undefined ? citizenProblemsOverride : state.source;
  const visibleProblems = visibleProblemsOverride !== undefined ? visibleProblemsOverride : state.visibleProblems;
  return (
    <OverviewPresentation
      problemCount={state.source.length}
      evidenceCount={41}
      citizenProblems={citizenProblems}
      visibleProblems={visibleProblems}
      searchQuery={state.searchQuery}
      onSearchChange={state.setSearchQuery}
      topicCodes={state.topicCodes}
      activeTopic={state.activeTopic}
      onTopicChange={state.setActiveTopic}
      materialChanges={materialChanges}
      materialChangePresentationLimit={MATERIAL_CHANGE_PRESENTATION_LIMIT}
      onExploreProblem={() => {}}
      onViewRecords={() => {}}
      {...sharedLabels}
    />
  );
}

export const Desktop1440: Story = {
  name: "1440 desktop",
  globals: { viewport: { value: "reviewDesktop" } },
  render: () => <FullOverview />,
};

export const Desktop1024Fit: Story = {
  name: "1024 desktop-fit",
  globals: { viewport: { value: "reviewDesktopFit" } },
  render: () => <FullOverview />,
};

export const Boundary768: Story = {
  name: "768 boundary",
  globals: { viewport: { value: "reviewBoundary" } },
  render: () => <FullOverview />,
};

export const Compact360: Story = {
  name: "360 compact",
  globals: { viewport: { value: "reviewCompact" } },
  render: () => <FullOverview />,
};

export const ActiveSearch: Story = {
  name: "active search",
  globals: { viewport: { value: "reviewDesktop" } },
  render: () => <FullOverview search="Évora" />,
};

export const ActiveTopicFilter: Story = {
  name: "active topic filter",
  globals: { viewport: { value: "reviewDesktop" } },
  render: () => <FullOverview topic="MOB" />,
};

export const NoResults: Story = {
  name: "no results",
  globals: { viewport: { value: "reviewDesktop" } },
  render: () => <FullOverview search="xyz-sem-correspondencia" />,
};

export const ProblemsLoading: Story = {
  name: "problems loading",
  globals: { viewport: { value: "reviewDesktop" } },
  render: () => <FullOverview citizenProblemsOverride={null} visibleProblemsOverride={null} materialChanges={null} />,
};

export const PartialMaterialHistoryFailure: Story = {
  name: "partial material-history failure",
  globals: { viewport: { value: "reviewDesktop" } },
  render: () => <FullOverview materialChanges={{ entries: materialChangeEntries.slice(0, 2), complete: false }} />,
};

export const EmptyMaterialHistory: Story = {
  name: "empty material history",
  globals: { viewport: { value: "reviewDesktop" } },
  render: () => <FullOverview materialChanges={{ entries: [], complete: true }} />,
};

const stressProblems: CitizenProblem[] = [
  ...problems,
  {
    id: "PRB-0007", title: "Fiabilidade dos horários de transporte público interurbano",
    problemStatement: "Utentes de transporte público interurbano descrevem atrasos frequentes e falta de informação em tempo real, com impacto acrescido para quem depende exclusivamente deste serviço para aceder a emprego, educação e cuidados de saúde fora do centro urbano.",
    domainCodes: ["MOB", "PUB", "HEA", "future-domain"], affectedPopulations: ["Pessoas idosas", "Pessoas com mobilidade reduzida", "Famílias com crianças pequenas", "Trabalhadores deslocados"], geographyArea: "Évora e concelhos limítrofes",
    lifecycleStatus: "OPEN", validationStatus: "unvalidated", evidenceStatus: "corroborated", updatedAt: "2026-04-10",
  },
  {
    id: "PRB-0008", title: "Acessibilidade de edifícios públicos municipais",
    problemStatement: "Vários edifícios de atendimento público carecem de rampas, elevadores ou sinalética acessível.",
    domainCodes: ["PUB"], affectedPopulations: ["Pessoas com mobilidade reduzida"], geographyArea: "Évora",
    lifecycleStatus: "UNDER_REVIEW", validationStatus: null, evidenceStatus: "corroborated", updatedAt: "2026-01-15",
  },
];

const stressMaterialChanges: MaterialChangeEntry[] = [
  ...materialChangeEntries,
  { problemId: "PRB-0007", problemTitle: "Fiabilidade dos horários de transporte público interurbano", date: "2026-04-10", summary: "Uma descrição longa de alteração material confirma que a linha mantém uma leitura clara quando a explicação exige várias linhas, sem perder a data, o problema a que se refere ou a ação disponível." },
  { problemId: "PRB-0008", problemTitle: "Acessibilidade de edifícios públicos municipais", date: "2026-01-15", summary: "Foi associada evidência adicional relativa às condições de acessibilidade reportadas." },
];

export const RealisticMaximumContentStress: Story = {
  name: "realistic maximum-content stress",
  globals: { viewport: { value: "reviewCompact" } },
  render: () => <FullOverview source={stressProblems} materialChanges={{ entries: stressMaterialChanges, complete: true }} />,
};
