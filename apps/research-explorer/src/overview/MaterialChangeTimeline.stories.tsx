import type { Meta, StoryObj } from "@storybook/react-vite";
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

export const MultipleEntries: Story = { args: { entries, onExploreProblem: () => {} } };
export const SameDateOrder: Story = { args: { entries: [{ ...entries[0], problemId: "PRB-0001", date: "2026-04-08" }, { ...entries[1], problemId: "PRB-0002", date: "2026-04-08" }], onExploreProblem: () => {} } };
export const LongSummary: Story = { args: { entries: [{ ...entries[0], summary: "Esta é uma descrição deliberadamente longa para confirmar que uma alteração material redigida continua legível sem cortar o conteúdo nem provocar colisões na linha temporal, incluindo em larguras de leitura mais reduzidas." }], onExploreProblem: () => {} } };
export const CompactWidth: Story = { args: { entries, onExploreProblem: () => {} }, render: (args) => <div style={{ width: 360, maxWidth: "100%" }}><MaterialChangeTimeline {...args} /></div> };
export const Empty: Story = { args: { entries: [], onExploreProblem: () => {} } };
