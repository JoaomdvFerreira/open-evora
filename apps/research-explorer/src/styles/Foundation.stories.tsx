import type { Meta, StoryObj } from "@storybook/react-vite";

/* DS-04B Foundation stories — real semantic HTML demonstrating the
   Foundation layer (tokens.css + foundations.css) in isolation. Synthetic
   content/IDs only (docs/design/foundations.md "Synthetic design content").
   No component APIs (Card, Badge, Section, Chip, PageHeader, Grid) — those
   belong to later DS-04C layout-primitive work, not this Foundation layer. */

function FoundationTypography() {
  return (
    <main style={{ padding: "var(--space-loose)" }}>
      <p className="fnd-label">PRB-XXXX &middot; leitura</p>
      <h1>Barreiras de acessibilidade no passeio ribeirinho</h1>
      <h2>Estado atual</h2>
      <h3>Evidência associada</h3>
      <div className="fnd-prose">
        <p>
          A investigação regista fricções documentadas entre a rede de
          passeios e a mobilidade reduzida. Este parágrafo demonstra a
          medida de leitura sustentada: a voz serifada, o comprimento de
          linha controlado e o ritmo vertical entre parágrafos aparentados.
        </p>
        <p>
          Um segundo parágrafo confirma o espaçamento consistente entre
          blocos de prosa, sem depender de caixas ou regras para comunicar a
          relação entre eles.
        </p>
      </div>
    </main>
  );
}

function FoundationInterfaceText() {
  return (
    <main style={{ padding: "var(--space-loose)" }}>
      <h1 style={{ fontSize: "var(--text-reading-h2-size)" }}>Texto de interface e metadados</h1>
      <p className="fnd-label">Metadados do registo</p>
      <p className="fnd-interface-text">
        Texto de interface para navegação, legendas e metadados — voz sans,
        medida mais curta do que a prosa de leitura, adequada ao seu papel de
        apoio.
      </p>
      <dl>
        <div>
          <dt className="fnd-label">Freguesia</dt>
          <dd className="fnd-interface-text">São Mamede</dd>
        </div>
        <div>
          <dt className="fnd-label">Data de registo</dt>
          <dd className="fnd-interface-text">14 mar. 2025</dd>
        </div>
      </dl>
    </main>
  );
}

function FoundationTechnicalIdentity() {
  return (
    <main style={{ padding: "var(--space-loose)" }}>
      <h1 style={{ fontSize: "var(--text-reading-h2-size)" }}>Identidade técnica</h1>
      <p className="fnd-label">Identificador técnico</p>
      <p className="fnd-technical">PRB-XXXX</p>
      <p className="fnd-technical">EVD-000001</p>
      <p className="fnd-interface-text">
        A voz monoespaçada identifica valores técnicos; nunca substitui
        ênfase geral em prosa ou texto de interface.
      </p>
    </main>
  );
}

function FoundationLinksAndFocus() {
  return (
    <main style={{ padding: "var(--space-loose)" }}>
      <h1 style={{ fontSize: "var(--text-reading-h2-size)" }}>Ligações e foco de teclado</h1>
      <p className="fnd-label">Ligações e foco de teclado</p>
      <p className="fnd-prose">
        Consulte a <a href="#evidencia-associada">evidência associada</a> a
        este problema. As ligações permanecem sublinhadas em repouso e nunca
        dependem apenas da cor para serem identificadas.
      </p>
      <p>
        <a href="#formulario-nativo">Ir para o formulário nativo</a> — utilize
        Tab para confirmar o anel de foco visível.
      </p>
      <form
        id="formulario-nativo"
        style={{ display: "grid", gap: "var(--space-tight)", maxWidth: "24rem" }}
      >
        <label className="fnd-label" htmlFor="ds04b-input">
          Campo de demonstração
        </label>
        <input id="ds04b-input" name="ds04b-input" type="text" />
        <button type="button">Ação nativa</button>
      </form>
    </main>
  );
}

function FoundationSurfacesAndSeparators() {
  return (
    <main style={{ padding: "var(--space-loose)" }}>
      <h1 style={{ fontSize: "var(--text-reading-h2-size)" }}>Superfícies e separadores</h1>
      <hr className="fnd-separator fnd-separator--heading" />
      <p className="fnd-interface-text">
        Regra de cabeçalho, reservada para separações de topo entre secções.
      </p>
      <div className="fnd-surface-raised" style={{ padding: "var(--space-standard)", marginTop: "var(--space-standard)" }}>
        <p className="fnd-label">Superfície elevada</p>
        <p className="fnd-interface-text">
          Usada quando existe uma fronteira real — uma unidade interativa ou
          com estado, por exemplo — e não por defeito em conteúdo adjacente
          comum.
        </p>
      </div>
      <div className="fnd-surface-subtle" style={{ padding: "var(--space-standard)", marginTop: "var(--space-standard)" }}>
        <p className="fnd-label">Superfície subtil</p>
        <p className="fnd-interface-text">
          Uma variante discreta, adequada a notas metodológicas ou avisos de
          contexto.
        </p>
      </div>
      <hr className="fnd-separator" style={{ marginTop: "var(--space-standard)" }} />
      <p className="fnd-interface-text">Regra normal — entre itens pares de uma lista.</p>
      <hr className="fnd-separator fnd-separator--faint" style={{ marginTop: "var(--space-tight)" }} />
      <p className="fnd-interface-text">Regra ténue — dentro de uma tabela de factos densa.</p>
    </main>
  );
}

function FoundationSpacingRhythm() {
  return (
    <main style={{ padding: "var(--space-loose)" }}>
      <h1 style={{ fontSize: "var(--text-reading-h2-size)" }}>Espaçamento e ritmo</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-tight)" }}>
        <div className="fnd-surface-subtle" style={{ padding: "var(--space-tight)" }}>tight — var(--space-tight)</div>
        <div className="fnd-surface-subtle" style={{ padding: "var(--space-tight)" }}>tight — var(--space-tight)</div>
      </div>
      <div style={{ height: "var(--space-section)" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-standard)" }}>
        <div className="fnd-surface-subtle" style={{ padding: "var(--space-standard)" }}>standard — var(--space-standard)</div>
        <div className="fnd-surface-subtle" style={{ padding: "var(--space-standard)" }}>standard — var(--space-standard)</div>
      </div>
    </main>
  );
}

function FoundationReadingMeasure() {
  return (
    <main style={{ padding: "var(--space-loose)" }}>
      <h1 style={{ fontSize: "var(--text-reading-h2-size)" }}>Medida de leitura</h1>
      <div className="fnd-prose">
        <p>
          Este bloco de prosa está limitado pela medida de leitura da
          Foundation (var(--measure-reading)) em vez de herdar a largura
          arbitrária do contentor, para que o comprimento de linha permaneça
          confortável independentemente da largura do ecrã disponível.
        </p>
      </div>
      <p className="fnd-interface-text" style={{ marginTop: "var(--space-standard)" }}>
        O texto de apoio usa uma medida mais curta (var(--measure-supporting)),
        adequada ao seu papel de metadado em vez de prosa sustentada.
      </p>
    </main>
  );
}

const meta = {
  title: "Foundation",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Typography: Story = {
  render: () => <FoundationTypography />,
};

export const InterfaceTextAndMetadata: Story = {
  render: () => <FoundationInterfaceText />,
};

export const TechnicalIdentity: Story = {
  render: () => <FoundationTechnicalIdentity />,
};

export const LinksAndFocus: Story = {
  render: () => <FoundationLinksAndFocus />,
};

export const SurfacesAndSeparators: Story = {
  render: () => <FoundationSurfacesAndSeparators />,
};

export const SpacingAndRhythm: Story = {
  render: () => <FoundationSpacingRhythm />,
};

export const ReadingMeasure: Story = {
  render: () => <FoundationReadingMeasure />,
};
