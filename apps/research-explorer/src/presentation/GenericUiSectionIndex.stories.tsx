import type { Meta, StoryObj } from "@storybook/react-vite";
import "../styles/layout.css";
import "../styles/ui.css";
import type { SectionIndexEntry } from "./SectionIndexEntry";
import { RailSectionIndex } from "./RailSectionIndex";
import { CompactSectionIndex } from "./CompactSectionIndex";

/* DS-04D Slice 2C — Generic UI section-index presentation stories
   (RailSectionIndex, CompactSectionIndex). Ordinary semantic HTML/React
   demonstrating src/presentation/RailSectionIndex.tsx and
   CompactSectionIndex.tsx in isolation, on top of the DS-04B Foundation
   layer (tokens.css + foundations.css, loaded globally in preview.ts) and
   DS-04C layout primitives (layout.css, for the combined ReadingLayout
   example). Synthetic PT-PT content only; entries are deliberately neutral
   synthetic labels/hrefs rather than real SRC/EVD/PRB section names, so
   these generic stories do not imply domain ownership (docs/design/
   foundations.md "Synthetic design content"). No production call site
   (CompactSectionIndex, SourceCompactSectionIndex, problemSectionIndex,
   sourceSectionIndex, evdSectionIndex, Source/Problem/EVD views) is
   modified, migrated, or retired in this slice. */

const meta = {
  title: "Generic UI Section Index",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/* Standalone landmark/heading wrapper, matching the StandaloneDemo pattern
   used across the other DS-04D Generic UI story files, so every isolated
   story keeps one <main> and one <h1> (avoids axe's landmark-one-main/
   page-has-heading-one/region findings on a bare fragment). */
function StandaloneDemo({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <main style={{ padding: "var(--space-loose)" }}>
      <h1 style={{ fontSize: "var(--text-reading-h2-size)" }}>{heading}</h1>
      {children}
    </main>
  );
}

/* ---- Entry fixtures --------------------------------------------------------
   Synthetic entries only. Order is caller-defined and deliberately
   non-alphabetical (Visão geral / Limitações / Cobertura / Licenciamento)
   to prove the component performs no sorting — it must render exactly the
   order supplied. */

const FLAT_ENTRIES: SectionIndexEntry[] = [
  { key: "visao-geral", label: "Visão geral", href: "#demo-visao-geral" },
  { key: "limitacoes", label: "Limitações", href: "#demo-limitacoes" },
  { key: "cobertura", label: "Cobertura", href: "#demo-cobertura" },
  { key: "licenciamento", label: "Licenciamento", href: "#demo-licenciamento" },
];

/* Nested shape mirrors the one production precedent that demonstrates
   nesting — `problemSectionIndex`'s subsections (ProblemView.tsx) — one
   level deep, some top-level entries with no nested entries at all. */
const NESTED_ENTRIES: SectionIndexEntry[] = [
  { key: "estado-atual", label: "Estado atual", href: "#demo-estado-atual" },
  {
    key: "evidencia",
    label: "Evidência reunida",
    href: "#demo-evidencia",
    entries: [
      { key: "evidencia-favoravel", label: "Evidência favorável", href: "#demo-evidencia-favoravel" },
      { key: "evidencia-contraria", label: "Evidência contrária", href: "#demo-evidencia-contraria" },
    ],
  },
  {
    key: "percurso",
    label: "Percurso de investigação",
    href: "#demo-percurso",
    entries: [
      { key: "percurso-desenvolvimento", label: "Desenvolvimento da investigação", href: "#demo-percurso-desenvolvimento" },
      { key: "percurso-delimitacao", label: "Delimitação", href: "#demo-percurso-delimitacao" },
    ],
  },
  { key: "questoes-abertas", label: "Questões em aberto", href: "#demo-questoes-abertas" },
];

const LONG_LABEL_ENTRIES: SectionIndexEntry[] = [
  { key: "visao-geral", label: "Visão geral da fonte sintética utilizada nesta demonstração", href: "#demo-visao-geral" },
  {
    key: "limitacoes",
    label: "Limitações metodológicas identificadas durante a recolha e verificação sintética",
    href: "#demo-limitacoes",
  },
  { key: "cobertura", label: "Cobertura geográfica e temporal sintética", href: "#demo-cobertura" },
];

/* ---- RailSectionIndex ------------------------------------------------- */

export const RailFlat: Story = {
  name: "Rail — flat index",
  render: () => (
    <StandaloneDemo heading="Rail — índice simples">
      <div style={{ maxWidth: "216px" }}>
        <RailSectionIndex label="Nesta página" entries={FLAT_ENTRIES} />
      </div>
    </StandaloneDemo>
  ),
};

export const RailNested: Story = {
  name: "Rail — nested index (Problem evidence)",
  render: () => (
    <StandaloneDemo heading="Rail — índice com subsecções">
      <div style={{ maxWidth: "216px" }}>
        <RailSectionIndex label="Nesta página" entries={NESTED_ENTRIES} />
      </div>
    </StandaloneDemo>
  ),
};

export const RailLongLabels: Story = {
  name: "Rail — long labels (wrap, no overflow)",
  render: () => (
    <StandaloneDemo heading="Rail — rótulos longos">
      <div style={{ maxWidth: "216px" }}>
        <RailSectionIndex label="Nesta fonte" entries={LONG_LABEL_ENTRIES} />
      </div>
    </StandaloneDemo>
  ),
};

/* ---- CompactSectionIndex ----------------------------------------------- */

export const CompactFlat: Story = {
  name: "Compact — flat index",
  render: () => (
    <StandaloneDemo heading="Compact — índice simples">
      <CompactSectionIndex summary="Nesta fonte" navLabel="Nesta fonte (versão compacta)" entries={FLAT_ENTRIES} />
    </StandaloneDemo>
  ),
};

export const CompactNested: Story = {
  name: "Compact — nested equivalent",
  render: () => (
    <StandaloneDemo heading="Compact — índice com subsecções">
      <CompactSectionIndex summary="Nesta página" navLabel="Nesta página (versão compacta)" entries={NESTED_ENTRIES} />
    </StandaloneDemo>
  ),
};

export const CompactLongLabels: Story = {
  name: "Compact — long labels (wrap, no overflow)",
  render: () => (
    <StandaloneDemo heading="Compact — rótulos longos">
      <CompactSectionIndex summary="Nesta fonte" navLabel="Nesta fonte (versão compacta)" entries={LONG_LABEL_ENTRIES} />
    </StandaloneDemo>
  ),
};

/* Renders at the article's own in-flow width (~360px), matching the
   compact product boundary (component-model.md principle 7) rather than a
   fixed rail width — demonstrates the compact index stays ordinary in-flow
   content, with no invented third responsive product mode. */
export const CompactNarrowInFlow: Story = {
  name: "Compact — ~360px in-flow",
  render: () => (
    <StandaloneDemo heading="Compact — 360px">
      <article style={{ maxWidth: "360px" }}>
        <p style={{ fontFamily: "var(--font-reading)", fontSize: "var(--text-reading-body-size)", lineHeight: "var(--text-reading-body-line-height)" }}>
          Conteúdo de leitura sintético que antecede o índice compacto, para demonstrar que este permanece conteúdo
          normal em fluxo, sem sobreposição nem transbordo horizontal a ~360px.
        </p>
        <CompactSectionIndex summary="Nesta fonte" navLabel="Nesta fonte (versão compacta)" entries={FLAT_ENTRIES} />
      </article>
    </StandaloneDemo>
  ),
};

/* ---- Combined ReadingLayout example -------------------------------------
   Demonstrates RailSectionIndex inside a DS-04C ReadingLayout rail slot
   (`.lyt-reading` / `.lyt-reading-rail`), alongside synthetic main reading
   content, matching the approved 720/44/216 relationship. ReadingLayout
   owns the sticky/layout behaviour; RailSectionIndex supplies only the nav
   content placed inside the rail slot. */
function CombinedReadingLayoutDemo() {
  return (
    <div style={{ padding: "var(--space-loose) var(--space-standard)" }}>
      <main className="lyt-shell-frame">
        <h1>DS-04D — Índice de secção em ReadingLayout</h1>
        <div className="lyt-reading" data-rail="present">
          <article className="lyt-reading-main">
            <h2 id="demo-visao-geral" style={{ fontFamily: "var(--font-reading)" }}>
              Visão geral
            </h2>
            <p style={{ fontFamily: "var(--font-reading)", fontSize: "var(--text-reading-body-size)", lineHeight: "var(--text-reading-body-line-height)" }}>
              Parágrafo de leitura sintético para a secção "Visão geral", suficientemente longo para ocupar a coluna
              principal de leitura na relação 720/44/216 aprovada.
            </p>
            <h2 id="demo-limitacoes" style={{ fontFamily: "var(--font-reading)" }}>
              Limitações
            </h2>
            <p style={{ fontFamily: "var(--font-reading)", fontSize: "var(--text-reading-body-size)", lineHeight: "var(--text-reading-body-line-height)" }}>
              Parágrafo de leitura sintético para a secção "Limitações".
            </p>
            <h2 id="demo-cobertura" style={{ fontFamily: "var(--font-reading)" }}>
              Cobertura
            </h2>
            <p style={{ fontFamily: "var(--font-reading)", fontSize: "var(--text-reading-body-size)", lineHeight: "var(--text-reading-body-line-height)" }}>
              Parágrafo de leitura sintético para a secção "Cobertura".
            </p>
            <h2 id="demo-licenciamento" style={{ fontFamily: "var(--font-reading)" }}>
              Licenciamento
            </h2>
            <p style={{ fontFamily: "var(--font-reading)", fontSize: "var(--text-reading-body-size)", lineHeight: "var(--text-reading-body-line-height)" }}>
              Parágrafo de leitura sintético para a secção "Licenciamento".
            </p>
          </article>
          <aside className="lyt-reading-rail">
            <RailSectionIndex label="Nesta página" entries={FLAT_ENTRIES} />
          </aside>
        </div>
      </main>
    </div>
  );
}

export const CombinedReadingLayout: Story = {
  name: "Combined — ReadingLayout with rail (~1440px / ~900px)",
  render: () => <CombinedReadingLayoutDemo />,
};

/* Combined page: keyboard focus / landmark-name sweep at ~1440px and
   ~360px, following the CombinedStructuresPage / CombinedRecipesPage
   pattern in the sibling DS-04D story files. Each RailSectionIndex/
   CompactSectionIndex story below uses a distinct accessible name so this
   combined page carries no duplicate-landmark-name artifact even though
   several indexes are stacked on one page (a real page renders exactly one
   section index per surface). No viewport addon is configured in
   .storybook/main.ts, so both stories render the same markup and are
   verified by resizing the browser. */
function CombinedSectionIndexPage() {
  return (
    <main className="lyt-shell-frame" style={{ padding: "var(--space-loose) var(--space-standard)" }}>
      <h1>DS-04D — Índices de secção genéricos</h1>
      <div className="lyt-stack lyt-stack--section">
        <section aria-labelledby="rail-flat-heading">
          <h2 id="rail-flat-heading">Rail — índice simples</h2>
          <div style={{ maxWidth: "216px" }}>
            <RailSectionIndex label="Nesta página (rail simples)" entries={FLAT_ENTRIES} />
          </div>
        </section>

        <section aria-labelledby="rail-nested-heading">
          <h2 id="rail-nested-heading">Rail — índice com subsecções</h2>
          <div style={{ maxWidth: "216px" }}>
            <RailSectionIndex label="Nesta página (rail com subsecções)" entries={NESTED_ENTRIES} />
          </div>
        </section>

        <section aria-labelledby="compact-flat-heading">
          <h2 id="compact-flat-heading">Compact — índice simples</h2>
          <CompactSectionIndex summary="Nesta fonte" navLabel="Nesta fonte (compacto simples)" entries={FLAT_ENTRIES} />
        </section>

        <section aria-labelledby="compact-nested-heading">
          <h2 id="compact-nested-heading">Compact — índice com subsecções</h2>
          <CompactSectionIndex summary="Nesta página" navLabel="Nesta página (compacto com subsecções)" entries={NESTED_ENTRIES} />
        </section>
      </div>
    </main>
  );
}

export const CombinedDesktop: Story = {
  name: "Combined — desktop (~1440px)",
  render: () => <CombinedSectionIndexPage />,
};

export const CombinedCompact: Story = {
  name: "Combined — compact (~360px)",
  render: () => <CombinedSectionIndexPage />,
};
