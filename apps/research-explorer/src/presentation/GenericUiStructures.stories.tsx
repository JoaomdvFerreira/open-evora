import type { Meta, StoryObj } from "@storybook/react-vite";
import "../styles/layout.css";
import "../styles/ui.css";
import { Breadcrumb } from "./Breadcrumb";
import { FactList } from "./FactList";

/* DS-04D Slice 2A — Generic UI structural component stories (Breadcrumb,
   FactList). Ordinary semantic HTML/React demonstrating
   src/presentation/Breadcrumb.tsx and src/presentation/FactList.tsx in
   isolation, on top of the DS-04B Foundation layer (tokens.css +
   foundations.css, loaded globally in preview.ts), DS-04C layout
   primitives (layout.css, imported locally as in Layout.stories.tsx and
   GenericUiRecipes.stories.tsx), and the DS-04D Slice 1 action recipe
   (ui-action-text) for link/action fact values. Synthetic PT-PT content
   only; identifiers are deliberately neutral synthetic labels rather than
   real SRC/EVD/PRB values, so these generic stories do not imply domain
   ownership (docs/design/foundations.md "Synthetic design content"). */

const meta = {
  title: "Generic UI Structures",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/* Standalone landmark/heading wrapper, matching the StandaloneDemo pattern
   in GenericUiRecipes.stories.tsx so every isolated story keeps one <main>
   and one <h1> (avoids axe's landmark-one-main/page-has-heading-one/region
   findings on a bare fragment). */
function StandaloneDemo({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <main style={{ padding: "var(--space-loose)" }}>
      <h1 style={{ fontSize: "var(--text-reading-h2-size)" }}>{heading}</h1>
      {children}
    </main>
  );
}

/* ---- Breadcrumb ----------------------------------------------------------
   Caller owns every ancestor's actual element, every label, and the
   current item's content; the component supplies only the landmark,
   ordering, hidden separator, and non-interactive current-item wrapper. */

/* `label` is parameterised (default "Localização", the realistic single-
   breadcrumb-per-page value) only so the combined demo page below can give
   each of its four stacked breadcrumbs a distinct accessible name — axe's
   landmark-unique rule correctly flags four same-page <nav aria-label>
   landmarks sharing one name, which is a combined-demo artifact (a real
   page renders exactly one Breadcrumb), not a defect in the component or
   in any individual story. */
function BreadcrumbLinkParent({ label = "Localização" }: { label?: string }) {
  return (
    <Breadcrumb
      label={label}
      ancestors={[
        {
          key: "registos",
          action: (
            <a className="ui-action-text" href="#registos">
              Registos
            </a>
          ),
        },
      ]}
      current="PRB-XXXX"
    />
  );
}

function BreadcrumbButtonParent({ label = "Localização" }: { label?: string }) {
  return (
    <Breadcrumb
      label={label}
      ancestors={[
        {
          key: "visao-geral",
          action: (
            <button className="ui-action-text" type="button" onClick={() => {}}>
              Visão geral
            </button>
          ),
        },
      ]}
      current="PRB-XXXX"
    />
  );
}

function BreadcrumbMultipleParents({ label = "Localização" }: { label?: string }) {
  return (
    <Breadcrumb
      label={label}
      ancestors={[
        {
          key: "registos",
          action: (
            <a className="ui-action-text" href="#registos">
              Registos
            </a>
          ),
        },
        {
          key: "prb",
          action: (
            <a className="ui-action-text" href="#prb-xxxx">
              PRB-XXXX
            </a>
          ),
        },
      ]}
      current="Histórico"
    />
  );
}

function BreadcrumbLongCompactLabels({ label = "Localização" }: { label?: string }) {
  return (
    <Breadcrumb
      label={label}
      ancestors={[
        {
          key: "registos",
          action: (
            <a className="ui-action-text" href="#registos">
              Registos identificados na recolha sintética
            </a>
          ),
        },
        {
          key: "prb",
          action: (
            <a className="ui-action-text" href="#prb-xxxx">
              PRB-XXXX — barreira de acessibilidade sintética
            </a>
          ),
        },
      ]}
      current="Histórico de alterações sintético com legenda longa"
    />
  );
}

/* ---- FactList --------------------------------------------------------------
   Rows are explicit, caller-ordered {key,label,value} triples — no field
   extraction, translation, sorting, or absence inference. */

function FactListOrdinary() {
  return (
    <FactList
      rows={[
        { key: "estado", label: "Estado", value: "Em investigação (sintético)" },
        { key: "âmbito", label: "Âmbito", value: "Concelho sintético" },
        { key: "responsável", label: "Responsável", value: "Equipa de investigação sintética" },
      ]}
    />
  );
}

function FactListTechnicalAndLink() {
  return (
    <FactList
      rows={[
        { key: "id", label: "ID", value: <span className="fnd-technical">PRB-XXXX</span> },
        {
          key: "ficheiro",
          label: "Ficheiro",
          value: <span className="fnd-technical">prb-xxxx.synthetic.json</span>,
        },
        {
          key: "referencia",
          label: "Referência",
          value: (
            <a className="ui-action-text" href="#evd-000001">
              Ver EVD-000001
            </a>
          ),
        },
      ]}
    />
  );
}

function FactListLongMultilineValue() {
  return (
    <FactList
      rows={[
        {
          key: "nota",
          label: "Nota de investigação",
          value:
            "Um valor sintético deliberadamente longo, com várias frases, para verificar que a coluna de valor mantém uma leitura confortável e recompõe em largura reduzida sem cortar ou sobrepor o rótulo — sem inferir estado de ausência ou desconhecido a partir do comprimento do texto.",
        },
        { key: "estado", label: "Estado", value: "Em investigação (sintético)" },
      ]}
    />
  );
}

/* Same three rows as FactListOrdinary, re-rendered to make "row order is
   preserved exactly" independently checkable against the accessibility
   tree/DOM order for this story rather than only asserted in prose. */
function FactListOrderPreserved() {
  return (
    <FactList
      rows={[
        { key: "terceiro", label: "Terceiro rótulo sintético", value: "C" },
        { key: "primeiro", label: "Primeiro rótulo sintético", value: "A" },
        { key: "segundo", label: "Segundo rótulo sintético", value: "B" },
      ]}
    />
  );
}

export const BreadcrumbLinkParentStory: Story = {
  name: "Breadcrumb — link parent + current text",
  render: () => (
    <StandaloneDemo heading="Breadcrumb — parent ligação">
      <BreadcrumbLinkParent />
    </StandaloneDemo>
  ),
};

export const BreadcrumbButtonParentStory: Story = {
  name: "Breadcrumb — button parent + current text",
  render: () => (
    <StandaloneDemo heading="Breadcrumb — parent botão">
      <BreadcrumbButtonParent />
    </StandaloneDemo>
  ),
};

export const BreadcrumbMultipleParentsStory: Story = {
  name: "Breadcrumb — multiple parents",
  render: () => (
    <StandaloneDemo heading="Breadcrumb — múltiplos parents">
      <BreadcrumbMultipleParents />
    </StandaloneDemo>
  ),
};

export const BreadcrumbLongCompactLabelsStory: Story = {
  name: "Breadcrumb — long labels (~360px)",
  render: () => (
    <StandaloneDemo heading="Breadcrumb — rótulos longos">
      <BreadcrumbLongCompactLabels />
    </StandaloneDemo>
  ),
};

export const FactListOrdinaryStory: Story = {
  name: "FactList — ordinary text values",
  render: () => (
    <StandaloneDemo heading="FactList — valores de texto">
      <FactListOrdinary />
    </StandaloneDemo>
  ),
};

export const FactListTechnicalAndLinkStory: Story = {
  name: "FactList — technical value + link value",
  render: () => (
    <StandaloneDemo heading="FactList — valor técnico e ligação">
      <FactListTechnicalAndLink />
    </StandaloneDemo>
  ),
};

export const FactListLongMultilineValueStory: Story = {
  name: "FactList — long multiline value",
  render: () => (
    <StandaloneDemo heading="FactList — valor longo">
      <FactListLongMultilineValue />
    </StandaloneDemo>
  ),
};

export const FactListOrderPreservedStory: Story = {
  name: "FactList — row order preserved",
  render: () => (
    <StandaloneDemo heading="FactList — ordem das linhas">
      <FactListOrderPreserved />
    </StandaloneDemo>
  ),
};

/* Combined page: keyboard focus / compact-wrapping sweep at ~1440px and
   ~360px, following the CombinedRecipesPage pattern in
   GenericUiRecipes.stories.tsx. No viewport addon is configured in
   .storybook/main.ts, so both stories render the same markup and are
   verified by resizing the browser. */
function CombinedStructuresPage() {
  return (
    <main className="lyt-shell-frame" style={{ padding: "var(--space-loose) var(--space-standard)" }}>
      <h1>DS-04D — Estruturas de UI genérica</h1>
      <div className="lyt-stack lyt-stack--section">
        <section aria-labelledby="breadcrumb-link-heading">
          <h2 id="breadcrumb-link-heading">Breadcrumb — parent ligação</h2>
          <BreadcrumbLinkParent label="Localização (parent ligação)" />
        </section>

        <section aria-labelledby="breadcrumb-button-heading">
          <h2 id="breadcrumb-button-heading">Breadcrumb — parent botão</h2>
          <BreadcrumbButtonParent label="Localização (parent botão)" />
        </section>

        <section aria-labelledby="breadcrumb-multi-heading">
          <h2 id="breadcrumb-multi-heading">Breadcrumb — múltiplos parents</h2>
          <BreadcrumbMultipleParents label="Localização (múltiplos parents)" />
        </section>

        <section aria-labelledby="breadcrumb-long-heading">
          <h2 id="breadcrumb-long-heading">Breadcrumb — rótulos longos</h2>
          <BreadcrumbLongCompactLabels label="Localização (rótulos longos)" />
        </section>

        <section aria-labelledby="factlist-ordinary-heading">
          <h2 id="factlist-ordinary-heading">FactList — valores de texto</h2>
          <FactListOrdinary />
        </section>

        <section aria-labelledby="factlist-technical-heading">
          <h2 id="factlist-technical-heading">FactList — valor técnico e ligação</h2>
          <FactListTechnicalAndLink />
        </section>

        <section aria-labelledby="factlist-long-heading">
          <h2 id="factlist-long-heading">FactList — valor longo</h2>
          <FactListLongMultilineValue />
        </section>

        <section aria-labelledby="factlist-order-heading">
          <h2 id="factlist-order-heading">FactList — ordem das linhas</h2>
          <FactListOrderPreserved />
        </section>
      </div>
    </main>
  );
}

export const CombinedDesktop: Story = {
  name: "Combined — desktop (~1440px)",
  render: () => <CombinedStructuresPage />,
};

export const CombinedCompact: Story = {
  name: "Combined — compact (~360px)",
  render: () => <CombinedStructuresPage />,
};
