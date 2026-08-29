import type { Meta, StoryObj } from "@storybook/react-vite";
import "./layout.css";
import "./ui.css";

/* DS-04D Slice 1 — Generic UI visual recipes stories. Ordinary semantic
   HTML demonstrating the ui.css recipes in isolation, on top of the DS-04B
   Foundation layer (tokens.css + foundations.css, loaded globally in
   preview.ts) and DS-04C layout primitives (layout.css, imported locally
   here as in Layout.stories.tsx). Synthetic PT-PT content only; identifiers
   are deliberately neutral synthetic labels rather than real SRC/EVD/PRB
   status/effect/role values, so these generic recipes do not imply domain
   ownership (docs/design/foundations.md "Synthetic design content"). No
   polymorphic Action/Card/Chip React component exists here — classes are
   applied directly to ordinary native elements (component-model.md §4.3,
   Gate C1 decision 4). */

/* ---- Native action recipes ---------------------------------------------- */

function TextActionDemo() {
  return (
    <div className="lyt-stack lyt-stack--standard">
      <p className="fnd-label">ui-action-text — native &lt;a&gt;</p>
      <a className="ui-action-text" href="#saiba-mais">
        Ver notas de investigação
      </a>
      <p className="fnd-label">ui-action-text — native &lt;button&gt;</p>
      <button className="ui-action-text" type="button">
        Expandir contexto adicional
      </button>
      <p className="fnd-label">ui-action-text — aria-disabled</p>
      <button className="ui-action-text" type="button" aria-disabled="true">
        Ação indisponível neste momento
      </button>
    </div>
  );
}

function OutlinedActionDemo() {
  return (
    <div className="lyt-cluster lyt-cluster--standard lyt-cluster--align-start">
      <a className="ui-action-outlined" href="#registo-relacionado">
        Abrir registo relacionado
      </a>
      <button className="ui-action-outlined" type="button">
        Copiar identificador
      </button>
      <button className="ui-action-outlined" type="button" aria-disabled="true">
        Sem conteúdo associado
      </button>
    </div>
  );
}

/* Ordinary caller-owned navigation, not an invented ARIA Tabs widget:
   .ui-action-tab-group/.ui-action-tab are visual anatomy only. This models
   the current ContextTabs semantic shape (a <nav> of same-page-context
   buttons with the current one marked via aria-current="page") without
   importing PRB/domain behaviour, tab keyboard navigation, aria-selected,
   or tabpanels into Generic UI (component-model.md §5.3). */
function TabActionDemo() {
  return (
    <nav className="ui-action-tab-group" aria-label="Contexto do registo sintético">
      <button className="ui-action-tab" type="button" aria-current="page">
        Detalhe
      </button>
      <button className="ui-action-tab" type="button">
        Discussão
      </button>
      <button className="ui-action-tab" type="button" aria-disabled="true">
        Histórico
      </button>
    </nav>
  );
}

/* ---- Surface recipes ------------------------------------------------------
   Deliberately different caller-owned semantic HTML per recipe, to keep the
   anatomy from implying one fixed landmark or meaning. */

function PlainOutlinedSurfaceDemo() {
  return (
    <article className="ui-surface-outlined">
      <p className="fnd-label">Nota de metodologia (sintético)</p>
      <p className="fnd-interface-text">
        Esta observação sintética descreve uma limitação de âmbito registada
        durante a recolha, sem qualquer valor de estado, efeito ou papel de
        investigação real associado.
      </p>
    </article>
  );
}

function MutedInsetSurfaceDemo() {
  return (
    <div className="ui-surface-inset">
      <p className="fnd-label">Proveniência (sintético)</p>
      <p className="fnd-interface-text">
        Resumo compacto de proveniência sintética, apresentado como recesso
        preenchido em vez de contorno simples, sem escolher significado de
        domínio.
      </p>
    </div>
  );
}

/* The interactive-item surface itself stays a plain <div>: the real
   interactive element is the ui-action-text link inside it, so the anchor's
   canonical underline-at-rest treatment applies to actual link text rather
   than requiring a textDecoration override on a block-wrapping card. */
function InteractiveItemSurfaceDemo() {
  return (
    <div className="ui-surface-interactive">
      <p className="fnd-label">Item interativo (sintético)</p>
      <p className="fnd-interface-text">
        Este contentor é interativo porque contém um elemento nativo focável
        — a hiperligação abaixo — e não porque a receita de superfície, por
        si só, adiciona comportamento.
      </p>
      <a className="ui-action-text" href="#item-sintetico">
        Abrir item sintético
      </a>
    </div>
  );
}

function NonInteractiveOutlinedComparisonDemo() {
  return (
    <div className="ui-surface-outlined">
      <p className="fnd-label">Comparação: sem interatividade</p>
      <p className="fnd-interface-text">
        Este contentor usa a mesma receita plain-outlined mas não é
        interativo — não existe elemento focável nem role adicionado, e por
        isso não recebe destaque de hover/focus.
      </p>
    </div>
  );
}

/* ---- Inline-label recipe --------------------------------------------------
   Deliberately neutral synthetic labels (never real status/effect/type/
   research-role values), to demonstrate anatomy only. */

function InlineLabelDemo() {
  return (
    <div className="lyt-cluster lyt-cluster--tight lyt-cluster--align-baseline">
      <span className="ui-inline-label">rótulo sintético</span>
      <span className="ui-inline-label">rótulo B</span>
      <span className="ui-inline-label">
        rótulo sintético com conteúdo suficientemente longo para demonstrar
        quebra de linha dentro da própria etiqueta
      </span>
    </div>
  );
}

/* ---- Combined page: keyboard focus / hover / compact-wrapping sweep ------ */

function CombinedRecipesPage() {
  return (
    <main className="lyt-shell-frame" style={{ padding: "var(--space-loose) var(--space-standard)" }}>
      <h1>DS-04D — Receitas visuais de UI genérica</h1>
      <div className="lyt-stack lyt-stack--section">
        <section aria-labelledby="text-action-heading">
          <h2 id="text-action-heading">Ação de texto</h2>
          <TextActionDemo />
        </section>

        <section aria-labelledby="outlined-action-heading">
          <h2 id="outlined-action-heading">Ação com contorno</h2>
          <OutlinedActionDemo />
        </section>

        <section aria-labelledby="tab-action-heading">
          <h2 id="tab-action-heading">Ação em separador</h2>
          <TabActionDemo />
        </section>

        <section aria-labelledby="surfaces-heading">
          <h2 id="surfaces-heading">Superfícies</h2>
          <div className="lyt-stack lyt-stack--standard">
            <PlainOutlinedSurfaceDemo />
            <MutedInsetSurfaceDemo />
            <InteractiveItemSurfaceDemo />
            <NonInteractiveOutlinedComparisonDemo />
          </div>
        </section>

        <section aria-labelledby="inline-label-heading">
          <h2 id="inline-label-heading">Etiqueta em linha</h2>
          <InlineLabelDemo />
        </section>

        <section aria-labelledby="unboxed-heading">
          <h2 id="unboxed-heading">Conteúdo adjacente sem caixa</h2>
          <p className="fnd-interface-text">
            Este parágrafo comum permanece sem caixa, para confirmar que as
            receitas de superfície acima não cardificam automaticamente o
            conteúdo vizinho.
          </p>
        </section>
      </div>
    </main>
  );
}

/* Standalone stories need their own landmark/heading, matching the <main>
   wrapper Layout.stories.tsx uses for its own isolated fragment stories
   (e.g. StackSpacingVariants, ClusterWrappingAndAlignment). CombinedRecipesPage
   supplies its own single <main>/<h1> instead, so the demo components stay
   bare fragments reusable by both. */
function StandaloneDemo({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <main style={{ padding: "var(--space-loose)" }}>
      <h1 style={{ fontSize: "var(--text-reading-h2-size)" }}>{heading}</h1>
      {children}
    </main>
  );
}

const meta = {
  title: "Generic UI Recipes",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const TextAction: Story = {
  name: "Native action — text",
  render: () => (
    <StandaloneDemo heading="Ação de texto">
      <TextActionDemo />
    </StandaloneDemo>
  ),
};

export const OutlinedAction: Story = {
  name: "Native action — outlined",
  render: () => (
    <StandaloneDemo heading="Ação com contorno">
      <OutlinedActionDemo />
    </StandaloneDemo>
  ),
};

export const TabAction: Story = {
  name: "Native action — tab (grouped)",
  render: () => (
    <StandaloneDemo heading="Ação em separador">
      <TabActionDemo />
    </StandaloneDemo>
  ),
};

export const SurfacePlainOutlined: Story = {
  name: "Surface — plain outlined",
  render: () => (
    <StandaloneDemo heading="Superfície — contorno simples">
      <PlainOutlinedSurfaceDemo />
    </StandaloneDemo>
  ),
};

export const SurfaceMutedInset: Story = {
  name: "Surface — muted inset",
  render: () => (
    <StandaloneDemo heading="Superfície — recesso preenchido">
      <MutedInsetSurfaceDemo />
    </StandaloneDemo>
  ),
};

export const SurfaceInteractiveItem: Story = {
  name: "Surface — interactive item (on a real <a>)",
  render: () => (
    <StandaloneDemo heading="Superfície — item interativo">
      <InteractiveItemSurfaceDemo />
    </StandaloneDemo>
  ),
};

export const InlineLabel: Story = {
  name: "Inline-label anatomy",
  render: () => (
    <StandaloneDemo heading="Etiqueta em linha">
      <InlineLabelDemo />
    </StandaloneDemo>
  ),
};

/* No viewport addon is configured in .storybook/main.ts (see
   Layout.stories.tsx precedent) — this one combined story is verified by
   resizing the browser to ~1440px and ~360px rather than by separate
   fixed-viewport story variants. */
export const CombinedDesktop: Story = {
  name: "Combined — desktop (~1440px)",
  render: () => <CombinedRecipesPage />,
};

export const CombinedCompact: Story = {
  name: "Combined — compact (~360px)",
  render: () => <CombinedRecipesPage />,
};
