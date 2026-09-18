import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import "../index.css";
import "../styles/topic.css";
import { CitizenProblemCard, CitizenSearchControl, TopicFilterGroup } from "./CitizenDiscovery";
import type { CitizenProblem } from "./overviewStats";

const meta = { title: "Citizen discovery" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const base: CitizenProblem = {
  id: "PRB-EXEMPLO", title: "Percursos diários no centro de Évora",
  problemStatement: "Algumas deslocações entre serviços exigem percursos difíceis de completar a pé.",
  domainCodes: ["MOB"], affectedPopulations: [], geographyArea: "Évora",
  lifecycleStatus: "OPEN", validationStatus: "unvalidated", evidenceStatus: "corroborated", updatedAt: null,
};

function Card({ problem }: { problem: CitizenProblem }) {
  return <ul className="overview-problem-list" style={{ padding: 0, margin: 0, listStyle: "none" }}><CitizenProblemCard problem={problem} onExplore={() => {}} /></ul>;
}

export const ProblemSingleTopic: Story = { render: () => <Card problem={base} /> };
export const ProblemMultipleTopics: Story = { render: () => <Card problem={{ ...base, domainCodes: ["MOB", "PUB"] }} /> };
const longContentProblem: CitizenProblem = { ...base, title: "Dificuldades persistentes nas deslocações quotidianas entre bairros, equipamentos e serviços no centro de Évora", problemStatement: "Pessoas que atravessam a cidade para aceder a serviços essenciais descrevem interrupções e desvios frequentes, com impacto desproporcional em quem depende de transporte público ou percursos pedonais para tarefas do quotidiano. A extensão e as causas destas dificuldades continuam por apurar; esta descrição serve apenas para testar a apresentação de conteúdo longo, incluindo o comportamento do excerto visual sobre o problem_statement canónico integral." };
export const ProblemLongContent: Story = { render: () => <Card problem={longContentProblem} /> };
export const ProblemLongContentCompact: Story = {
  globals: { viewport: { value: "reviewCompact" } },
  render: () => <Card problem={longContentProblem} />,
};
export const ProblemEvidenceOnly: Story = { render: () => <Card problem={{ ...base, validationStatus: null }} /> };
export const ProblemValidationOnly: Story = { render: () => <Card problem={{ ...base, evidenceStatus: null }} /> };
export const ProblemUnknownDomain: Story = { render: () => <Card problem={{ ...base, domainCodes: ["future-domain"], validationStatus: null, evidenceStatus: null }} /> };
export const ProblemCompact: Story = {
  globals: { viewport: { value: "reviewCompact" } },
  render: () => <Card problem={{ ...base, domainCodes: ["MOB", "PUB"] }} />,
};

function Search({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <CitizenSearchControl value={value} onChange={setValue} />;
}
export const SearchDefault: Story = { render: () => <Search /> };
export const SearchActive: Story = { render: () => <Search initial="Évora" /> };

function Filters({ initial = null }: { initial?: string | null }) {
  const [active, setActive] = useState<string | null>(initial);
  return <TopicFilterGroup topicCodes={["MOB", "PUB", "future-domain", "HEA"]} activeTopic={active} onChange={setActive} />;
}
export const FiltersDefault: Story = { render: () => <Filters /> };
export const FiltersSelected: Story = { render: () => <Filters initial="MOB" /> };
export const ControlsCompact: Story = { render: () => <div style={{ width: 360, maxWidth: "100%" }}><Search /><Filters initial="MOB" /></div> };

function OverviewPresentationDirection({ problem = base }: { problem?: CitizenProblem }) {
  return (
    <main className="public-overview" style={{ width: "min(100%, 980px)", maxWidth: "100%", margin: "0 auto", paddingInline: "2rem" }}>
      <section aria-label="Direção de apresentação da visão geral">
        <div className="overview-hero">
          <p className="overview-independence">
            <span className="overview-desktop-copy"><strong>Projeto independente.</strong> Não representa a Câmara Municipal de Évora nem qualquer entidade oficial; não é um serviço ou plataforma municipal oficial.</span>
            <span className="overview-mobile-copy">Projeto independente — não oficial</span>
          </p>
          <h1 className="overview-hero-headline">Investigamos problemas práticos que afetam Évora.</h1>
          <p className="overview-hero-supporting">Reunimos fontes e evidência para mostrar o que sabemos, o que ainda não sabemos e o que mudou.</p>
        </div>

        <section className="overview-concepts" aria-label="O que contém o Explorador">
          <div><h2>Problemas</h2><p>Fricções cívicas identificadas a partir de evidência — com o que já se sabe e o que ainda não se sabe.</p></div>
          <div><h2>Evidência</h2><p>Registos individuais — institucionais, públicos, comunitários e de intervenientes — que sustentam, contestam ou atualizam cada leitura.</p></div>
          <div><h2>Proveniência e incerteza</h2><p>Cada registo mantém a sua origem. O que ainda não sabemos é registado explicitamente, não escondido.</p></div>
        </section>

        <section aria-label="Explorar problemas">
          <Search />
          <Filters initial="MOB" />
          <p className="overview-coverage-caveat">Os problemas apresentados são os atualmente acompanhados pelo Open Évora. Não constituem um inventário completo dos problemas existentes em Évora.</p>
          <p className="overview-ordering-note">Ordenados por identificador — a ordem não representa prioridade ou relevância.</p>
          <Card problem={problem} />
        </section>

        <p className="overview-closing-actions"><button type="button">Ver todos os registos →</button></p>
      </section>
    </main>
  );
}

export const OverviewPresentationDesktop: Story = {
  name: "Overview presentation direction — desktop",
  globals: { viewport: { value: "reviewDesktop" } },
  render: () => <OverviewPresentationDirection />,
};
export const OverviewPresentationCompact: Story = {
  name: "Overview presentation direction — compact",
  globals: { viewport: { value: "reviewCompact" } },
  render: () => <OverviewPresentationDirection />,
};
export const OverviewPresentationContentStress: Story = {
  name: "Overview presentation direction — content stress",
  globals: { viewport: { value: "reviewCompact" } },
  render: () => <OverviewPresentationDirection problem={{ ...base, id: "PRB-XXXX", domainCodes: ["MOB", "PUB", "future-domain"], title: "Dificuldades persistentes nas deslocações quotidianas entre bairros, equipamentos e serviços no centro de Évora", problemStatement: "Pessoas que atravessam a cidade para aceder a serviços essenciais descrevem interrupções e desvios frequentes. A extensão e as causas destas dificuldades continuam por apurar; esta descrição serve apenas para testar a apresentação de conteúdo longo." }} />,
};
