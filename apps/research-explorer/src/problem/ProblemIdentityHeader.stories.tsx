import { useRef } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import "../index.css";
import { ProblemIdentityHeader, type ProblemIdentityHeaderProps } from "./ProblemIdentityHeader";

const meta = { title: "Problem/Identity header" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const base: Omit<ProblemIdentityHeaderProps, "headingRef"> = {
  problemId: "PRB-0001", title: "Acesso seguro e compreensível aos serviços quotidianos", statement: "Formulação sintética para rever a hierarquia pública do cabeçalho.", geography: "Évora (Cidade)", affectedPopulations: ["Residentes", "Visitantes"], updatedAt: "2026-09-01", topics: ["MOB", "ACC"], status: "OPEN", evidenceStatus: "corroborated", validationStatus: "partially_validated",
};

// Reading-shell width (--layout-reading-main, styles/reading-layout.css):
// isolated desktop stories are read within the product's reading column,
// not stretched across the full Storybook canvas.
function HeaderStory(props: Omit<ProblemIdentityHeaderProps, "headingRef">) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  return <div style={{ maxWidth: 720, padding: 24 }}><ProblemIdentityHeader {...props} headingRef={headingRef} /></div>;
}

export const Representative: Story = { render: () => <HeaderStory {...base} /> };
export const LongTitleAndTopics: Story = { render: () => <HeaderStory {...base} title="Uma formulação deliberadamente longa para confirmar que a identidade principal do problema continua legível em várias linhas sem ocultar temas, estados ou metadados" topics={["MOB", "ACC", "DIG"]} /> };
export const MetadataUnavailable: Story = { render: () => <HeaderStory {...base} geography={null} affectedPopulations={[]} updatedAt={null} /> };
export const CompactWidth: Story = {
  globals: { viewport: { value: "reviewCompact" } },
  render: () => <HeaderStory {...base} />,
};
