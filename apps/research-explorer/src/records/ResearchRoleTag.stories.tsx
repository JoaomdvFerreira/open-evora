import type { Meta, StoryObj } from "@storybook/react-vite";
import "../styles/layout.css";
import "../styles/ui.css";
import "../styles/domain.css";
import { ResearchRoleTag } from "./ResearchRoleTag";
import { EvidenceEffectTag } from "./EvidenceEffectTag";
import { RecordIdentifier } from "./RecordIdentifier";
import { RecordTypeLabel } from "./RecordTypeLabel";
import { FactList } from "../presentation/FactList";

/* DS-04D Slice 3C — ResearchRoleTag stories. Ordinary semantic HTML/React
   demonstrating src/records/ResearchRoleTag.tsx in isolation, on top of the
   DS-04B Foundation layer (tokens.css + foundations.css, loaded globally in
   preview.ts), DS-04C layout primitives (layout.css), the DS-04D Slice 1
   generic inline-label anatomy (ui.css .ui-inline-label), and this slice's
   own domain.css additions. Synthetic PT-PT relationship context only, per
   docs/design/foundations.md "Synthetic design content" — no real research
   findings or claims. No production call site (EvdDetail.tsx, ProblemView.tsx,
   evdRelations.ts, problemProjection.ts) is modified, migrated, or retired in
   this slice.

   Isolated anatomy only: no production-only `evd-*` classes (those live in
   index.css on legacy tokens the Storybook layer does not load). Already-
   captioned and relationship fixtures reuse the same DS-04D isolated
   primitives as PrbEvdRelationship.stories.tsx — FactList (`ui-fact-list`,
   preserving `<dt>Papel</dt>` semantics), `ui-surface-outlined` for the
   relationship card surface, and `lyt-stack`/`lyt-cluster` for layout —
   rather than reimplementing or importing production `.evd-*` CSS. */

const meta = {
  title: "Record Domain Atoms/ResearchRoleTag",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/* Standalone landmark/heading wrapper, matching the StandaloneDemo pattern
   used across the other DS-04D story files, so every isolated story keeps
   one <main> and one <h1> (avoids axe's landmark-one-main/
   page-has-heading-one/region findings on a bare fragment). */
function StandaloneDemo({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <main style={{ padding: "var(--space-loose)" }}>
      <h1 style={{ fontSize: "var(--text-reading-h2-size)" }}>{heading}</h1>
      {children}
    </main>
  );
}

/* Every currently mapped public research-role value
   (presentation.ts LABELS.research_roles), in the order authored there. */
const CANONICAL_ROLES = [
  "LOCAL_OBSERVATION",
  "CONTEXTUAL",
  "COMPARATIVE_MECHANISM",
  "COMPARATIVE_RESPONSE",
  "EXISTING_RESPONSE",
  "PLANNED_RESPONSE",
];

function ResearchRoleTagRow({ role }: { role: string }) {
  return <ResearchRoleTag role={role} />;
}

/* ---- Individual role stories -------------------------------------------- */

export const CanonicalRoles: Story = {
  name: "ResearchRoleTag — every mapped public role (standard)",
  render: () => (
    <StandaloneDemo heading="ResearchRoleTag — papéis de investigação canónicos">
      <p>Um papel de investigação já autorado por relação PRB→EVD, um por linha, cada um com a legenda explícita "Papel:".</p>
      <div className="lyt-stack lyt-stack--tight">
        {CANONICAL_ROLES.map((role) => (
          <ResearchRoleTagRow key={role} role={role} />
        ))}
      </div>
    </StandaloneDemo>
  ),
};

export const AlreadyCaptionedFact: Story = {
  name: "ResearchRoleTag — already-captioned fact (compact)",
  render: () => (
    <StandaloneDemo heading="ResearchRoleTag — contexto já legendado">
      <p>
        Contexto onde o chamador já apresenta a legenda visível "Papel" (aqui, um <code>&lt;dt&gt;</code> via FactList) — a variante{" "}
        <code>compact</code> evita duplicar essa legenda por cada papel, preservando o contexto acessível via <code>aria-label</code>.
      </p>
      <FactList
        rows={[
          {
            key: "roles",
            label: "Papel",
            value: (
              <span className="lyt-cluster lyt-cluster--tight">
                <ResearchRoleTag role="LOCAL_OBSERVATION" variant="compact" />
                <ResearchRoleTag role="CONTEXTUAL" variant="compact" />
              </span>
            ),
          },
        ]}
      />
    </StandaloneDemo>
  ),
};

export const UnknownRole: Story = {
  name: "ResearchRoleTag — unknown/future value fallback",
  render: () => (
    <StandaloneDemo heading="ResearchRoleTag — valor futuro desconhecido">
      <p>Valor sintético não mapeado — deve mostrar o valor canónico em bruto em vez de desaparecer ou ser reclassificado, em ambas as variantes.</p>
      <div className="lyt-stack lyt-stack--tight">
        <ResearchRoleTag role="EMERGING_FUTURE_ROLE" />
        <FactList
          rows={[
            {
              key: "roles",
              label: "Papel",
              value: <ResearchRoleTag role="EMERGING_FUTURE_ROLE" variant="compact" />,
            },
          ]}
        />
      </div>
    </StandaloneDemo>
  ),
};

/* ---- Caller-owned multiplicity: several authored roles for one relationship.
   The component itself accepts exactly one `role`; the caller (here, the
   story) owns iteration, authored order, and the surrounding relationship
   context — matching evdRelations.ts's `researchRoles: string[]` and
   EvdDetail.tsx's own per-item mapping, never internal `research_roles[]`
   iteration inside the component. Reuses the isolated `ui-surface-outlined`
   relationship-card anatomy from PrbEvdRelationship.stories.tsx rather than
   the production `.evd-problem-card`/`.evd-problem-heading` classes. */
function MultiRoleRelationshipDemo() {
  const roles = ["LOCAL_OBSERVATION", "CONTEXTUAL", "COMPARATIVE_RESPONSE"];
  return (
    <div className="ui-surface-outlined">
      <div className="lyt-cluster lyt-cluster--tight lyt-cluster--align-baseline" style={{ marginBottom: "var(--space-tight)" }}>
        <RecordTypeLabel prefix="PRB-" variant="compact" />
        <RecordIdentifier id="PRB-0006" density="compact" />
        <span style={{ fontFamily: "var(--font-interface)", fontSize: "var(--text-interface-body-size)" }}>
          Passeios estreitos no centro histórico
        </span>
      </div>
      <FactList
        rows={[
          {
            key: "roles",
            label: "Papel",
            value: (
              <span className="lyt-cluster lyt-cluster--tight">
                {roles.map((role, index) => (
                  <ResearchRoleTag key={`${role}-${index}`} role={role} variant="compact" />
                ))}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}

export const MultipleRolesAuthoredOrder: Story = {
  name: "ResearchRoleTag — multiple caller-rendered roles (authored order, compact)",
  render: () => (
    <StandaloneDemo heading="ResearchRoleTag — vários papéis, uma relação PRB→EVD">
      <p>
        Uma evidência sintética usada num Problema sintético com três papéis já autorados — o chamador decide quantos papéis existem, a sua
        ordem, e se a relação envolvente é apresentada. O componente recebe um papel de cada vez; a variante <code>compact</code> é usada
        porque o <code>&lt;dt&gt;Papel&lt;/dt&gt;</code> envolvente já fornece a legenda visível.
      </p>
      <MultiRoleRelationshipDemo />
    </StandaloneDemo>
  ),
};

/* ---- Comparison: effect vs. research role ------------------------------- */
function EffectRoleComparisonCard() {
  return (
    <div className="ui-surface-outlined">
      <div className="lyt-cluster lyt-cluster--tight lyt-cluster--align-baseline" style={{ marginBottom: "var(--space-tight)" }}>
        <RecordTypeLabel prefix="PRB-" variant="compact" />
        <RecordIdentifier id="PRB-0006" density="compact" />
        <span style={{ fontFamily: "var(--font-interface)", fontSize: "var(--text-interface-body-size)" }}>
          Passeios estreitos no centro histórico
        </span>
      </div>
      <FactList
        rows={[
          {
            key: "effect",
            label: "Efeito",
            value: <EvidenceEffectTag effect="SUPPORTS" variant="compact" />,
          },
          {
            key: "role",
            label: "Papel",
            value: <ResearchRoleTag role="LOCAL_OBSERVATION" variant="compact" />,
          },
        ]}
      />
    </div>
  );
}

export const ComparisonEffectVsResearchRole: Story = {
  name: "Comparison — EvidenceEffectTag (effect) vs. ResearchRoleTag (research role)",
  render: () => (
    <StandaloneDemo heading="Comparação — Efeito vs. Papel de investigação">
      <p style={{ maxWidth: "72ch" }}>
        Mesma evidência sintética, mesma relação PRB→EVD sintética, duas dimensões distintas apresentadas lado a lado como linhas FactList
        separadas — cada uma já legendada ("Efeito"/"Papel"), sem duplicar legendas. O <strong>efeito</strong> ("Sustenta") responde ao que
        esta evidência faz ao enquadramento do Problema. O <strong>papel</strong> de investigação ("Observação local") responde a
        porquê/como esta evidência é usada na investigação. Nenhum dos dois é uma propriedade intrínseca da evidência — ambos pertencem
        apenas a esta relação PRB→EVD explícita.
      </p>
      <EffectRoleComparisonCard />
    </StandaloneDemo>
  ),
};

/* ---- Combined demo page (desktop / compact) ---------------------------- */
function CombinedResearchRoleTagPage() {
  return (
    <main className="lyt-shell-frame" style={{ padding: "var(--space-loose) var(--space-standard)" }}>
      <h1>DS-04D — ResearchRoleTag</h1>
      <div className="lyt-stack lyt-stack--section">
        <section aria-labelledby="roles-heading">
          <h2 id="roles-heading">Papéis de investigação canónicos (standard)</h2>
          <div className="lyt-stack lyt-stack--standard">
            {CANONICAL_ROLES.map((role) => (
              <ResearchRoleTagRow key={role} role={role} />
            ))}
            <ResearchRoleTag role="EMERGING_FUTURE_ROLE" />
          </div>
        </section>

        <section aria-labelledby="captioned-fact-heading">
          <h2 id="captioned-fact-heading">Contexto já legendado (compact)</h2>
          <FactList
            rows={[
              {
                key: "roles",
                label: "Papel",
                value: (
                  <span className="lyt-cluster lyt-cluster--tight">
                    <ResearchRoleTag role="LOCAL_OBSERVATION" variant="compact" />
                    <ResearchRoleTag role="CONTEXTUAL" variant="compact" />
                  </span>
                ),
              },
            ]}
          />
        </section>

        <section aria-labelledby="multi-heading">
          <h2 id="multi-heading">Vários papéis, uma relação</h2>
          <MultiRoleRelationshipDemo />
        </section>

        <section aria-labelledby="comparison-heading">
          <h2 id="comparison-heading">Comparação — Efeito vs. Papel</h2>
          <EffectRoleComparisonCard />
        </section>
      </div>
    </main>
  );
}

export const CombinedDesktop: Story = {
  name: "Combined — desktop (~1440px)",
  render: () => <CombinedResearchRoleTagPage />,
};

export const CombinedCompact: Story = {
  name: "Combined — compact (~360px)",
  render: () => <CombinedResearchRoleTagPage />,
};
