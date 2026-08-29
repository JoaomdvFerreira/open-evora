import type { Meta, StoryObj } from "@storybook/react-vite";
import "../styles/layout.css";
import "../styles/ui.css";
import { ProgressMessage } from "./ProgressMessage";
import { ErrorNotice } from "./ErrorNotice";
import { EmptyState } from "./EmptyState";
import { useUnavailableNote } from "./UnavailableNote";

/* DS-04D Slice 2B — Generic UI feedback boundary stories (ProgressMessage,
   ErrorNotice, EmptyState) plus isolated UnavailableNote coverage. Ordinary
   semantic HTML/React demonstrating src/presentation/ProgressMessage.tsx,
   ErrorNotice.tsx, EmptyState.tsx, and the existing UnavailableNote.tsx in
   isolation, on top of the DS-04B Foundation layer (tokens.css +
   foundations.css, loaded globally in preview.ts), DS-04C layout primitives
   (layout.css), and the DS-04D Slice 1 action recipe (ui-action-outlined)
   for the ErrorNotice retry button. Synthetic PT-PT content only;
   identifiers are deliberately neutral synthetic labels rather than real
   SRC/EVD/PRB values, so these generic stories do not imply domain
   ownership (docs/design/foundations.md "Synthetic design content"). No
   production call site is migrated in this slice. */

const meta = {
  title: "Generic UI Feedback",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/* Standalone landmark/heading wrapper, matching the StandaloneDemo pattern
   in GenericUiRecipes.stories.tsx / GenericUiStructures.stories.tsx so every
   isolated story keeps one <main> and one <h1> (avoids axe's
   landmark-one-main/page-has-heading-one/region findings on a bare
   fragment). */
function StandaloneDemo({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <main style={{ padding: "var(--space-loose)" }}>
      <h1 style={{ fontSize: "var(--text-reading-h2-size)" }}>{heading}</h1>
      {children}
    </main>
  );
}

/* ---- ProgressMessage -------------------------------------------------- */

function ProgressMessageDemo() {
  return <ProgressMessage message="A carregar registos sintéticos…" />;
}

/* ---- ErrorNotice -------------------------------------------------------- */

function ErrorNoticeNoRetryDemo() {
  return (
    <ErrorNotice
      title="Não foi possível carregar os registos sintéticos"
      message="Ocorreu um erro sintético ao obter os dados. Esta mensagem não oferece nova tentativa."
    />
  );
}

function ErrorNoticeWithRetryDemo() {
  return (
    <ErrorNotice
      title="Não foi possível carregar o registo sintético"
      message="Ocorreu um erro sintético de rede ao obter PRB-XXXX. Pode tentar novamente."
      action={
        <button type="button" className="ui-action-outlined" onClick={() => {}}>
          Tentar novamente
        </button>
      }
    />
  );
}

function ErrorNoticeLongCopyDemo() {
  return (
    <ErrorNotice
      title="Não foi possível carregar o histórico sintético do registo"
      message="Ocorreu um erro sintético prolongado ao contactar a fonte de dados: a ligação foi interrompida antes de todos os registos sintéticos terem sido recebidos, pelo que o histórico apresentado poderia ficar incompleto ou inconsistente até uma nova tentativa bem-sucedida."
      action={
        <button type="button" className="ui-action-outlined" onClick={() => {}}>
          Tentar novamente
        </button>
      }
    />
  );
}

/* ---- EmptyState ----------------------------------------------------------
   Ordinary content for an explicitly established empty result — the caller
   (this story) is asserting synthetic evidence that the collection is
   genuinely empty, not inferring it from a missing/unknown field. */

function EmptyStateOrdinaryDemo() {
  return <EmptyState message="Nenhum registo sintético corresponde aos filtros aplicados." />;
}

function EmptyStateWithActionDemo() {
  return (
    <EmptyState
      message="Nenhuma referência sintética foi encontrada para este registo."
      action={
        <a className="ui-action-text" href="#registos-sinteticos">
          Ver todos os registos sintéticos
        </a>
      }
    />
  );
}

/* ---- UnavailableNote -------------------------------------------------------
   Isolated coverage of the existing `useUnavailableNote` hook: an
   aria-disabled control kept focusable (no native `disabled`) with its
   explanation exposed as visible text on pointer hover and keyboard focus,
   wired via aria-describedby. Behaviour/markup unchanged from
   UnavailableNote.tsx — this story only renders it standalone. */
function UnavailableNoteDemo() {
  const { id, describedBy } = useUnavailableNote("Em desenvolvimento (sintético)");
  return (
    <span className="unavailable-control">
      <button type="button" className="ui-action-outlined" aria-disabled="true" title="Em desenvolvimento (sintético)" aria-describedby={id}>
        Funcionalidade sintética
      </button>
      {describedBy}
    </span>
  );
}

export const ProgressMessageStory: Story = {
  name: "ProgressMessage — progress",
  render: () => (
    <StandaloneDemo heading="ProgressMessage — em curso">
      <ProgressMessageDemo />
    </StandaloneDemo>
  ),
};

export const ErrorNoticeNoRetryStory: Story = {
  name: "ErrorNotice — error without retry",
  render: () => (
    <StandaloneDemo heading="ErrorNotice — sem nova tentativa">
      <ErrorNoticeNoRetryDemo />
    </StandaloneDemo>
  ),
};

export const ErrorNoticeWithRetryStory: Story = {
  name: "ErrorNotice — error with native retry button",
  render: () => (
    <StandaloneDemo heading="ErrorNotice — com nova tentativa">
      <ErrorNoticeWithRetryDemo />
    </StandaloneDemo>
  ),
};

export const ErrorNoticeLongCopyStory: Story = {
  name: "ErrorNotice — long copy (~360px wrap check)",
  render: () => (
    <StandaloneDemo heading="ErrorNotice — texto longo">
      <ErrorNoticeLongCopyDemo />
    </StandaloneDemo>
  ),
};

export const EmptyStateOrdinaryStory: Story = {
  name: "EmptyState — established-empty content",
  render: () => (
    <StandaloneDemo heading="EmptyState — resultado vazio">
      <EmptyStateOrdinaryDemo />
    </StandaloneDemo>
  ),
};

export const EmptyStateWithActionStory: Story = {
  name: "EmptyState — established-empty content with action",
  render: () => (
    <StandaloneDemo heading="EmptyState — resultado vazio com ação">
      <EmptyStateWithActionDemo />
    </StandaloneDemo>
  ),
};

export const UnavailableNoteStory: Story = {
  name: "UnavailableNote — aria-disabled control with visible explanation",
  render: () => (
    <StandaloneDemo heading="UnavailableNote — controlo indisponível">
      <p>Foque o controlo com Tab ou passe o cursor para ver a explicação sintética.</p>
      <UnavailableNoteDemo />
    </StandaloneDemo>
  ),
};

/* Combined comparison: all three feedback boundaries plus UnavailableNote
   together, so their visual/semantic distinctness (approved visual
   contract: "ProgressMessage, ErrorNotice, and EmptyState remain visually
   and semantically distinct treatments") is checkable on one page rather
   than only across separate stories. Rendered at both ~1440px and ~360px by
   resizing the browser (no viewport addon is configured in
   .storybook/main.ts), matching the CombinedRecipesPage /
   CombinedStructuresPage pattern. */
function CombinedFeedbackPage() {
  return (
    <main className="lyt-shell-frame" style={{ padding: "var(--space-loose) var(--space-standard)" }}>
      <h1>DS-04D — Limites de feedback genérico</h1>
      <div className="lyt-stack lyt-stack--section">
        <section aria-labelledby="progress-heading">
          <h2 id="progress-heading">ProgressMessage — em curso</h2>
          <ProgressMessageDemo />
        </section>

        <section aria-labelledby="error-no-retry-heading">
          <h2 id="error-no-retry-heading">ErrorNotice — sem nova tentativa</h2>
          <ErrorNoticeNoRetryDemo />
        </section>

        <section aria-labelledby="error-retry-heading">
          <h2 id="error-retry-heading">ErrorNotice — com nova tentativa</h2>
          <ErrorNoticeWithRetryDemo />
        </section>

        <section aria-labelledby="empty-ordinary-heading">
          <h2 id="empty-ordinary-heading">EmptyState — resultado vazio</h2>
          <EmptyStateOrdinaryDemo />
        </section>

        <section aria-labelledby="empty-action-heading">
          <h2 id="empty-action-heading">EmptyState — resultado vazio com ação</h2>
          <EmptyStateWithActionDemo />
        </section>

        <section aria-labelledby="unavailable-heading">
          <h2 id="unavailable-heading">UnavailableNote — controlo indisponível</h2>
          <p>Foque o controlo com Tab ou passe o cursor para ver a explicação sintética.</p>
          <UnavailableNoteDemo />
        </section>
      </div>
    </main>
  );
}

export const CombinedDesktop: Story = {
  name: "Combined — desktop (~1440px)",
  render: () => <CombinedFeedbackPage />,
};

export const CombinedCompact: Story = {
  name: "Combined — compact (~360px)",
  render: () => <CombinedFeedbackPage />,
};
