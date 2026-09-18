import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import "../index.css";
import { MaterialChangeTimeline } from "./MaterialChangeTimeline";
import type { MaterialChangeEntry } from "./overviewStats";

const meta = { title: "Material change timeline", component: MaterialChangeTimeline } satisfies Meta<typeof MaterialChangeTimeline>;
export default meta;
type Story = StoryObj<typeof meta>;

const entries: MaterialChangeEntry[] = [
  { problemId: "PRB-0004", problemTitle: "Percursos pedonais entre serviços", date: "2026-04-08", summary: "Foi registada uma alteração material na leitura atual do problema." },
  { problemId: "PRB-0007", problemTitle: "Acesso a informação de estacionamento", date: "2026-03-12", summary: "A evidência reunida passou a ser apresentada com uma limitação adicional." },
];

// Reading-shell width (--layout-reading-main, styles/reading-layout.css):
// isolated desktop stories are read within the product's reading column,
// not stretched across the full Storybook canvas.
function ReadingShell({ children }: { children: ReactNode }) {
  return <div style={{ maxWidth: 720, padding: 24 }}>{children}</div>;
}

export const MultipleEntries: Story = { args: { entries, onExploreProblem: () => {} }, render: (args) => <ReadingShell><MaterialChangeTimeline {...args} /></ReadingShell> };
export const SameDateOrder: Story = { args: { entries: [{ ...entries[0], problemId: "PRB-0001", date: "2026-04-08" }, { ...entries[1], problemId: "PRB-0002", date: "2026-04-08" }], onExploreProblem: () => {} }, render: (args) => <ReadingShell><MaterialChangeTimeline {...args} /></ReadingShell> };
export const LongSummary: Story = { args: { entries: [{ ...entries[0], summary: "Esta é uma descrição deliberadamente longa para confirmar que uma alteração material redigida continua legível sem cortar o conteúdo nem provocar colisões na linha temporal, incluindo em larguras de leitura mais reduzidas." }], onExploreProblem: () => {} }, render: (args) => <ReadingShell><MaterialChangeTimeline {...args} /></ReadingShell> };
export const CompactWidth: Story = {
  args: { entries, onExploreProblem: () => {} },
  globals: { viewport: { value: "reviewCompact" } },
  render: (args) => <MaterialChangeTimeline {...args} />,
};
export const ContentStress: Story = {
  args: { entries: [{ ...entries[0], problemId: "PRB-XXXX", problemTitle: "Um problema com um título muito extenso para verificar a hierarquia entre a leitura humana e o identificador técnico", summary: "Uma descrição longa de alteração material confirma que a linha mantém uma leitura clara quando a explicação exige várias linhas, sem perder a data, o problema a que se refere ou a ação disponível." }], onExploreProblem: () => {} },
  globals: { viewport: { value: "reviewCompact" } },
  render: (args) => <MaterialChangeTimeline {...args} />,
};
export const Empty: Story = { args: { entries: [], onExploreProblem: () => {} }, render: (args) => <ReadingShell><MaterialChangeTimeline {...args} /></ReadingShell> };
