import type { Meta, StoryObj } from "@storybook/react-vite";
import "./layout.css";

/* DS-04C Layout stories — ordinary semantic HTML demonstrating the
   layout-primitives layer (layout.css) in isolation, on top of the DS-04B
   Foundation layer (tokens.css + foundations.css, loaded globally in
   preview.ts). Synthetic content/IDs only (docs/design/foundations.md
   "Synthetic design content"). CSS-first: no React wrapper components exist
   here to carry classes (component-model.md §2.2, Gate C1 decision 1). */

const READING_PARAGRAPHS = [
  "A investigação regista fricções documentadas entre a rede de passeios ribeirinhos e a mobilidade reduzida. Este parágrafo demonstra a medida de leitura sustentada: a voz serifada, o comprimento de linha controlado e o ritmo vertical entre parágrafos aparentados, de forma a expor a geometria real da coluna principal em vez de uma caixa colorida vazia.",
  "Um segundo parágrafo confirma o espaçamento consistente entre blocos de prosa. O texto técnico sintético que se segue — PRB-XXXX, EVD-000001, SRC-0007 — não deve alargar o contentor nem forçar um deslocamento horizontal, mesmo quando referenciado várias vezes ao longo do parágrafo de leitura sustentada.",
  "Um terceiro parágrafo mantém a prosa suficientemente longa para que a relação de leitura de 720px permaneça visível em ecrãs largos, para que a recomposição de coluna única fique visível na banda intermédia e em compacto, e para que nenhuma das duas situações comprima ou reduza o texto essencial de leitura.",
];

function ReadingProse() {
  return (
    <div className="fnd-prose">
      {READING_PARAGRAPHS.map((paragraph) => (
        <p key={paragraph.slice(0, 12)}>{paragraph}</p>
      ))}
    </div>
  );
}

function SyntheticRail() {
  return (
    <>
      <div className="fnd-surface-raised" style={{ padding: "var(--space-standard)" }}>
        <p className="fnd-label">Identificador técnico</p>
        <p className="fnd-technical">PRB-XXXX</p>
      </div>
      <nav aria-label="Nesta página">
        <p className="fnd-label">Nesta página</p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          <li>
            <a href="#estado-atual">Estado atual</a>
          </li>
          <li>
            <a href="#evidencia-associada">Evidência associada</a>
          </li>
          <li>
            <a href="#questoes-em-aberto">Questões em aberto</a>
          </li>
        </ul>
      </nav>
    </>
  );
}

/* ---- ShellFrame -------------------------------------------------------- */

function ShellFrameDemo() {
  return (
    <main style={{ background: "var(--color-surface-subtle)", padding: "var(--space-loose) 0" }}>
      <h1 style={{ fontSize: "var(--text-reading-h2-size)", padding: "0 var(--space-standard)" }}>
        ShellFrame
      </h1>
      <div className="lyt-shell-frame">
        <div
          className="fnd-surface-raised"
          style={{ padding: "var(--space-standard)" }}
        >
          <p className="fnd-label">lyt-shell-frame (max-width: 980px)</p>
          <p className="fnd-interface-text">
            Este contentor está centrado dentro de uma tela mais larga, sem
            padding de página nem responsabilidade de superfície própria —
            ambos pertencem ao pai full-bleed e ao conteúdo, respetivamente.
          </p>
        </div>
      </div>
    </main>
  );
}

/* ---- ReadingLayout ------------------------------------------------------ */

function ReadingLayoutWithRail() {
  return (
    <div className="lyt-shell-frame" style={{ padding: "var(--space-loose) 0" }}>
      <div className="lyt-reading" data-rail="present">
        <main className="lyt-reading-main">
          <h1 id="estado-atual">Barreiras de acessibilidade no passeio ribeirinho</h1>
          <ReadingProse />
        </main>
        <aside className="lyt-reading-rail" aria-label="Contexto de apoio">
          <SyntheticRail />
        </aside>
      </div>
    </div>
  );
}

function ReadingLayoutNoRail() {
  return (
    <div className="lyt-shell-frame" style={{ padding: "var(--space-loose) 0" }}>
      <div className="lyt-reading" data-rail="none">
        <main className="lyt-reading-main">
          <h1>Registo sem coluna de apoio</h1>
          <p className="fnd-interface-text" style={{ marginBottom: "var(--space-standard)" }}>
            data-rail=&quot;none&quot; — quem chama decide que não existe
            conteúdo de rail; a coluna principal mantém a medida de 720px.
          </p>
          <ReadingProse />
        </main>
      </div>
    </div>
  );
}

/* ---- Stack --------------------------------------------------------------- */

function StackSpacingVariants() {
  const item = (label: string) => (
    <div key={label} className="fnd-surface-subtle" style={{ padding: "var(--space-tight)" }}>
      {label}
    </div>
  );

  return (
    <main style={{ padding: "var(--space-loose)" }}>
      <h1 style={{ fontSize: "var(--text-reading-h2-size)" }}>Stack — variantes de espaçamento</h1>
      <div className="lyt-stack lyt-stack--tight" style={{ marginBottom: "var(--space-loose)" }}>
        <p className="fnd-label">tight (lyt-stack--tight)</p>
        {item("Item A")}
        {item("Item B")}
        {item("Item C")}
      </div>
      <div className="lyt-stack lyt-stack--standard" style={{ marginBottom: "var(--space-loose)" }}>
        <p className="fnd-label">standard (lyt-stack--standard)</p>
        {item("Item A")}
        {item("Item B")}
        {item("Item C")}
      </div>
      <div className="lyt-stack lyt-stack--section">
        <p className="fnd-label">section (lyt-stack--section)</p>
        {item("Item A")}
        {item("Item B")}
      </div>
    </main>
  );
}

/* ---- Cluster ------------------------------------------------------------- */

function ClusterWrappingAndAlignment() {
  const chip = (label: string) => (
    <span
      key={label}
      className="fnd-surface-subtle"
      style={{ padding: "var(--p-space-1) var(--space-tight)", display: "inline-block" }}
    >
      {label}
    </span>
  );

  const labels = [
    "corroborado",
    "pendente",
    "EVD-000001",
    "EVD-000002",
    "EVD-000003",
    "EVD-000004",
    "efeito: reforça",
    "papel: fonte primária",
  ];

  return (
    <main style={{ padding: "var(--space-loose)", maxWidth: "28rem" }}>
      <h1 style={{ fontSize: "var(--text-reading-h2-size)" }}>Cluster — wrapping e alinhamento</h1>
      <p className="fnd-label">start (lyt-cluster--align-start)</p>
      <div
        className="lyt-cluster lyt-cluster--standard lyt-cluster--align-start"
        style={{ marginBottom: "var(--space-loose)" }}
      >
        {labels.map(chip)}
      </div>
      <p className="fnd-label">center (lyt-cluster--align-center)</p>
      <div
        className="lyt-cluster lyt-cluster--standard lyt-cluster--align-center"
        style={{ marginBottom: "var(--space-loose)" }}
      >
        {chip("PRB-XXXX")}
        <span style={{ fontSize: "24px" }}>{chip("EVD-000001")}</span>
        {chip("SRC-0007")}
      </div>
      <p className="fnd-label">baseline (lyt-cluster--align-baseline)</p>
      <div className="lyt-cluster lyt-cluster--tight lyt-cluster--align-baseline">
        {chip("PRB-XXXX")}
        <span style={{ fontSize: "22px" }}>{chip("EVD-000001")}</span>
        {chip("SRC-0007")}
      </div>
    </main>
  );
}

/* ---- SectionFlow ---------------------------------------------------------
   Proves the primitive does not own semantics: the story itself supplies
   ordinary <section> elements, headings, and order; lyt-section-flow only
   spaces its already-semantic children. */

function SectionFlowWithRealSections() {
  return (
    <main className="lyt-shell-frame" style={{ padding: "var(--space-loose) 0" }}>
      <h1 style={{ fontSize: "var(--text-reading-h2-size)" }}>SectionFlow — secções reais</h1>
      <div className="lyt-section-flow">
        <section aria-labelledby="s1-heading">
          <h2 id="s1-heading">Estado atual</h2>
          <div className="fnd-prose">
            <p>{READING_PARAGRAPHS[0]}</p>
          </div>
        </section>
        <section aria-labelledby="s2-heading">
          <h2 id="s2-heading">Evidência associada</h2>
          <div className="fnd-prose">
            <p>{READING_PARAGRAPHS[1]}</p>
          </div>
        </section>
        <section aria-labelledby="s3-heading">
          <h2 id="s3-heading">Questões em aberto</h2>
          <div className="fnd-prose">
            <p>{READING_PARAGRAPHS[2]}</p>
          </div>
        </section>
      </div>
    </main>
  );
}

const meta = {
  title: "Layout",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const ShellFrameCentred: Story = {
  render: () => <ShellFrameDemo />,
};

/* No viewport addon is configured in .storybook/main.ts — these three
   stories render the same ReadingLayout markup; the three required product
   viewports (~1440px desktop, the 768-1059px fit-fallback band, ~360px
   compact) are verified by resizing the browser against this one story in
   the "8. Stress / geometry verification" pass rather than by separate
   fixed-viewport story variants. */
export const ReadingLayoutDesktopWithRail: Story = {
  name: "ReadingLayout — desktop with rail (~1440px)",
  render: () => <ReadingLayoutWithRail />,
};

export const ReadingLayoutFitFallback: Story = {
  name: "ReadingLayout — fit fallback (768–1059px band)",
  render: () => <ReadingLayoutWithRail />,
};

export const ReadingLayoutCompact: Story = {
  name: "ReadingLayout — compact (~360px)",
  render: () => <ReadingLayoutWithRail />,
};

export const ReadingLayoutNoRailVariant: Story = {
  name: "ReadingLayout — no-rail",
  render: () => <ReadingLayoutNoRail />,
};

export const StackSpacing: Story = {
  name: "Stack — spacing variants",
  render: () => <StackSpacingVariants />,
};

export const ClusterWrapping: Story = {
  name: "Cluster — wrapping and alignment",
  render: () => <ClusterWrappingAndAlignment />,
};

export const SectionFlowSemanticSections: Story = {
  name: "SectionFlow — real <section> elements",
  render: () => <SectionFlowWithRealSections />,
};
