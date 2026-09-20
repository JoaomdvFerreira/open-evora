import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import "../index.css";
import "../styles/topic.css";
import { CitizenSearchControl, ProblemRow, TopicFilterGroup } from "./CitizenDiscovery";
import type { CitizenProblem, MaterialChangeEntry } from "./overviewStats";

const meta = { title: "Citizen discovery" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const base: CitizenProblem = {
  id: "PRB-EXEMPLO", title: "Percursos diários no centro de Évora",
  problemStatement: "Algumas deslocações entre serviços exigem percursos difíceis de completar a pé.",
  domainCodes: ["MOB"], affectedPopulations: [], geographyArea: "Évora",
  lifecycleStatus: "OPEN", validationStatus: "unvalidated", evidenceStatus: "corroborated", updatedAt: null,
};

function Card({ problem, latestChange }: { problem: CitizenProblem; latestChange?: MaterialChangeEntry }) {
  return <ul className="overview-problem-list" style={{ padding: 0, margin: 0, listStyle: "none" }}><ProblemRow problem={problem} onExplore={() => {}} latestChange={latestChange} /></ul>;
}

export const ProblemSingleTopic: Story = { render: () => <Card problem={base} /> };
const changedEntry: MaterialChangeEntry = { problemId: base.id, problemTitle: base.title, date: "2026-08-31", summary: "Fonte adicional incorporada.", domainCodes: base.domainCodes };
export const ProblemChanged: Story = { render: () => <Card problem={base} latestChange={changedEntry} /> };
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
