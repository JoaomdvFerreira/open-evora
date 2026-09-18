import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import "../index.css";
import { MaterialChangeTimeline } from "./MaterialChangeTimeline";
import type { MaterialChangeEntry } from "./overviewStats";

const meta = { title: "Material change timeline", component: MaterialChangeTimeline } satisfies Meta<typeof MaterialChangeTimeline>;
export default meta;
type Story = StoryObj<typeof meta>;

const entries: MaterialChangeEntry[] = [
  { problemId: "PRB-XXXX-1", problemTitle: "Percursos pedonais entre serviços", date: "2026-04-08", summary: "Foi registada uma alteração material na leitura atual do problema." },
  { problemId: "PRB-XXXX-2", problemTitle: "Acesso a informação de estacionamento", date: "2026-03-12", summary: "A evidência reunida passou a ser apresentada com uma limitação adicional." },
];

const manyEntries: MaterialChangeEntry[] = [
  ...entries,
  { problemId: "PRB-XXXX-3", problemTitle: "Continuidade dos horários de recolha de resíduos", date: "2026-02-20", summary: "Nova evidência institucional foi associada a este problema." },
  { problemId: "PRB-XXXX-4", problemTitle: "Disponibilidade de consultas de cuidados primários", date: "2026-01-15", summary: "O estado de validação foi atualizado após revisão da evidência disponível." },
  { problemId: "PRB-XXXX-5", problemTitle: "Sinalização de obras em espaço público", date: "2025-12-02", summary: "Foi associada evidência adicional relativa às condições de acessibilidade reportadas." },
  { problemId: "PRB-XXXX-6", problemTitle: "Fiabilidade dos horários de transporte público interurbano", date: "2025-11-18", summary: "Uma nova fonte institucional foi identificada e associada à leitura atual." },
];

// Reading-shell width (--layout-reading-main, styles/reading-layout.css):
// isolated desktop stories are read within the product's reading column,
// not stretched across the full Storybook canvas. The Overview rail variant
// instead uses the full Overview section width, since it is not confined to
// the reading column in production.
function ReadingShell({ children }: { children: ReactNode }) {
  return <div style={{ maxWidth: 720, padding: 24 }}>{children}</div>;
}

function OverviewSectionShell({ children }: { children: ReactNode }) {
  return <div className="overview-material-change-section" style={{ maxWidth: 980, padding: 24 }}>{children}</div>;
}

export const DefaultVariant: Story = {
  name: "default/shared ProblemView presentation",
  args: { entries, onExploreProblem: () => {}, variant: "default" },
  render: (args) => <ReadingShell><MaterialChangeTimeline {...args} /></ReadingShell>,
};
export const OverviewRailDesktop: Story = {
  name: "Overview horizontal rail desktop",
  args: { entries: manyEntries, onExploreProblem: () => {}, variant: "overview" },
  globals: { viewport: { value: "reviewDesktop" } },
  render: (args) => <OverviewSectionShell><MaterialChangeTimeline {...args} /></OverviewSectionShell>,
};
export const OverviewRailCompact: Story = {
  name: "Overview horizontal rail 360",
  args: { entries, onExploreProblem: () => {}, variant: "overview" },
  globals: { viewport: { value: "reviewCompact" } },
  render: (args) => <MaterialChangeTimeline {...args} />,
};
export const LongTitle: Story = {
  name: "long title",
  args: { entries: [{ ...entries[0], problemTitle: "Um problema com um título muito extenso para verificar a hierarquia entre a leitura humana e o identificador técnico" }], onExploreProblem: () => {}, variant: "overview" },
  render: (args) => <OverviewSectionShell><MaterialChangeTimeline {...args} /></OverviewSectionShell>,
};
export const LongSummary: Story = {
  name: "long summary",
  args: { entries: [{ ...entries[0], summary: "Esta é uma descrição deliberadamente longa para confirmar que uma alteração material redigida continua legível quando a explicação exige várias linhas, incluindo o comportamento do clamp visual sobre o resumo, sem perder a data, o problema a que se refere ou a ação disponível." }], onExploreProblem: () => {}, variant: "overview" },
  render: (args) => <OverviewSectionShell><MaterialChangeTimeline {...args} /></OverviewSectionShell>,
};
export const OverflowManyEntries: Story = {
  name: "5+ entries / overflow",
  args: { entries: manyEntries, onExploreProblem: () => {}, variant: "overview" },
  globals: { viewport: { value: "reviewDesktop" } },
  render: (args) => <OverviewSectionShell><MaterialChangeTimeline {...args} /></OverviewSectionShell>,
};
export const SameDateOrder: Story = { args: { entries: [{ ...entries[0], problemId: "PRB-XXXX-3", date: "2026-04-08" }, { ...entries[1], problemId: "PRB-XXXX-4", date: "2026-04-08" }], onExploreProblem: () => {}, variant: "overview" }, render: (args) => <OverviewSectionShell><MaterialChangeTimeline {...args} /></OverviewSectionShell> };
export const Empty: Story = {
  name: "empty",
  args: { entries: [], onExploreProblem: () => {} },
  render: (args) => <ReadingShell><MaterialChangeTimeline {...args} /></ReadingShell>,
};
