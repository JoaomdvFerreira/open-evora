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

// Reading-shell width (--layout-reading-main, styles/reading-layout.css):
// isolated desktop stories are read within the product's reading column,
// not stretched across the full Storybook canvas.
function ReadingShell({ children }: { children: ReactNode }) {
  return <div style={{ maxWidth: 720, padding: 24 }}>{children}</div>;
}

export const DefaultVariant: Story = {
  name: "default/shared presentation",
  args: { entries, onExploreProblem: () => {}, variant: "default" },
  render: (args) => <ReadingShell><MaterialChangeTimeline {...args} /></ReadingShell>,
};
export const OverviewVariant: Story = {
  name: "Overview variant",
  args: { entries, onExploreProblem: () => {}, variant: "overview" },
  render: (args) => <ReadingShell><MaterialChangeTimeline {...args} /></ReadingShell>,
};
export const MultipleEntries: Story = { args: { entries, onExploreProblem: () => {}, variant: "overview" }, render: (args) => <ReadingShell><MaterialChangeTimeline {...args} /></ReadingShell> };
export const SameDateOrder: Story = { args: { entries: [{ ...entries[0], problemId: "PRB-XXXX-3", date: "2026-04-08" }, { ...entries[1], problemId: "PRB-XXXX-4", date: "2026-04-08" }], onExploreProblem: () => {}, variant: "overview" }, render: (args) => <ReadingShell><MaterialChangeTimeline {...args} /></ReadingShell> };
export const LongSummary: Story = {
  name: "long summary",
  args: { entries: [{ ...entries[0], summary: "Esta é uma descrição deliberadamente longa para confirmar que uma alteração material redigida continua legível sem cortar o conteúdo nem provocar colisões na linha temporal, incluindo em larguras de leitura mais reduzidas." }], onExploreProblem: () => {}, variant: "overview" },
  render: (args) => <ReadingShell><MaterialChangeTimeline {...args} /></ReadingShell>,
};
export const CompactWidth: Story = {
  name: "360 compact",
  args: { entries, onExploreProblem: () => {}, variant: "overview" },
  globals: { viewport: { value: "reviewCompact" } },
  render: (args) => <MaterialChangeTimeline {...args} />,
};
export const ContentStress: Story = {
  args: { entries: [{ ...entries[0], problemId: "PRB-XXXX-5", problemTitle: "Um problema com um título muito extenso para verificar a hierarquia entre a leitura humana e o identificador técnico", summary: "Uma descrição longa de alteração material confirma que a linha mantém uma leitura clara quando a explicação exige várias linhas, sem perder a data, o problema a que se refere ou a ação disponível." }], onExploreProblem: () => {}, variant: "overview" },
  globals: { viewport: { value: "reviewCompact" } },
  render: (args) => <MaterialChangeTimeline {...args} />,
};
export const Empty: Story = {
  name: "empty",
  args: { entries: [], onExploreProblem: () => {} },
  render: (args) => <ReadingShell><MaterialChangeTimeline {...args} /></ReadingShell>,
};
