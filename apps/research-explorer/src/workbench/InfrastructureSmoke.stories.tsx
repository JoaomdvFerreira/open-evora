import type { Meta, StoryObj } from "@storybook/react-vite";

function InfrastructureSmoke() {
  return (
    <main className="workbench-smoke">
      <p className="workbench-smoke__notice">
        Validação de infraestrutura do Storybook. Esta história não é um componente
        aprovado nem uma implementação visual do Research Explorer.
      </p>

      <h1 className="workbench-smoke__title">Workbench do Research Explorer</h1>
      <p>
        React, tipos de letra locais e elementos HTML nativos podem ser verificados
        isoladamente neste ambiente.
      </p>
      <p className="workbench-smoke__reading-sample">
        Exemplo de leitura para confirmar o carregamento da família serifada local.
      </p>
      <p className="workbench-smoke__identifier">PRB-XXXX</p>

      <p>
        <a href="#formulario-nativo">Ir para o formulário nativo</a>
      </p>

      <form className="workbench-smoke__form" id="formulario-nativo">
        <label htmlFor="smoke-input">Campo de demonstração</label>
        <input id="smoke-input" name="smoke-input" type="text" />
        <button type="button">Ação nativa</button>
      </form>
    </main>
  );
}

const meta = {
  title: "Workbench/Validação de infraestrutura",
  component: InfrastructureSmoke,
} satisfies Meta<typeof InfrastructureSmoke>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Smoke: Story = {};
