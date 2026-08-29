import type { Meta, StoryObj } from "@storybook/react-vite";
import "../styles/layout.css";
import "../styles/ui.css";
import "../styles/domain.css";
import { RecordIdentifier } from "./RecordIdentifier";
import { RecordTypeLabel } from "./RecordTypeLabel";
import { EvidenceEffectTag } from "./EvidenceEffectTag";
import { ResearchRoleTag } from "./ResearchRoleTag";
import { FactList } from "../presentation/FactList";

/* DS-04D Slice 4A — PRB→EVD relationship composition stories. Isolated
   Storybook composition over the DS-04D domain atoms (RecordIdentifier,
   RecordTypeLabel, EvidenceEffectTag, ResearchRoleTag), demonstrating the
   two orientations the approved catalogue names
   (docs/design/reference/components/ds-03b-component-catalogue.dc.html §4
   "Evidence and reference presentations": "Evidence in a Problem" and,
   symmetrically, "Problem-use inside an EVD detail") without collapsing them
   into one mode-driven component (component-visual-contract.md "Effects and
   research roles belong to presentation of a PRB→EVD relationship ...
   [and] may be rendered wherever that relationship is explicitly presented
   — an Evidence use inside a Problem, or a Problem-use inside an EVD
   detail").

   Composition A anatomy is derived from ProblemView.tsx's `EvidenceCard`
   (identifier + type + effect(s) header, serif observation paragraph,
   separate Source provenance line) plus the catalogue's own "Evidence in a
   Problem" specimen (§4, ~line 674) — same header/body/provenance shape.
   Research role is NOT demonstrated in Composition A: current `EvidenceCard`
   renders only `effects`, never `research_roles`, in the Problem-facing
   evidence list (problemProjection.ts's `EvidenceWithSources.researchRoles`
   is read but EvidenceCard does not render it) — inventing that presentation
   here would exceed current evidence, so this slice omits it rather than
   adding it merely because ResearchRoleTag exists.

   Composition B anatomy is derived from EvdDetail.tsx's `EvdInvestigation`
   (`.evd-problem-card` surface, PRB identity heading, `.evd-relation-facts`
   dl with "Efeito"/"Papel" rows using compact tag density because the `<dt>`
   already supplies the caption, caller-owned "Ver Problema →" action).
   Reimplemented here on the DS-04D Storybook-only layer rather than the
   production classes themselves (`ui-surface-outlined` for the card,
   `FactList`/`ui-fact-list` for the fact rows, `ui-action-text` for the
   action) — the production classes above live in index.css on legacy tokens
   the Storybook layer does not load, matching this file's siblings'
   precedent of reimplementing production anatomy on DS-04B/C/D tokens
   instead of importing index.css.

   Both compositions are caller-supplied fixtures only: no canonical record
   inspection, no effect/role derivation, no ranking, no deduplication, no
   invented strength/confidence, and no rendering of Problem `evidence_status`
   on an EVD item (component-visual-contract.md "`evidence_status` belongs
   to a Problem's investigation state, not to an individual EVD").

   Synthetic identifiers only (PRB-XXXX / EVD-XXXXXX / SRC-XXXX style,
   foundations.md "Synthetic design content") — no real Open Évora research
   claims or IDs. No production call site (ProblemView.tsx, EvdDetail.tsx,
   problemProjection.ts, evdRelations.ts) is modified, migrated, or retired
   in this slice; this file introduces no new production React component. */

const meta = {
  title: "PRB↔EVD Relationship Compositions",
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

/* =========================================================================
   Composition A — Evidence use inside a Problem
   Caller-owned fixture shape: identity, type, one-or-more authored effects
   (authored order preserved), observation prose, optional Source
   provenance. Mirrors EvidenceCard's own `<li className="evidence-card">`
   header/body/provenance ordering; reuses the .ui-surface-outlined recipe
   rather than a new card primitive (component-model.md §5.6 "Surface reuse
   is visual, not structural").
   ========================================================================= */
interface EvidenceUseFixture {
  evdId: string;
  observation: string;
  effects: string[];
  sourceId?: string;
}

function EvidenceUseInProblem({ evdId, observation, effects, sourceId }: EvidenceUseFixture) {
  return (
    <li className="ui-surface-outlined" style={{ listStyle: "none" }}>
      <div className="lyt-cluster lyt-cluster--tight lyt-cluster--align-baseline" style={{ marginBottom: "var(--space-tight)" }}>
        <RecordTypeLabel prefix="EVD-" variant="compact" />
        <RecordIdentifier variant="action" id={evdId} density="compact" onActivate={() => {}} accessibleLabel={`Abrir ${evdId}`} />
        {effects.map((effect, index) => (
          <EvidenceEffectTag key={`${effect}-${index}`} effect={effect} />
        ))}
      </div>
      <p style={{ fontFamily: "var(--font-reading)", fontSize: "var(--text-reading-body-size)", lineHeight: "var(--text-reading-body-line-height)", margin: "0 0 var(--space-tight)" }}>
        {observation}
      </p>
      {sourceId && (
        <p style={{ fontFamily: "var(--font-interface)", fontSize: "var(--text-interface-body-size)", color: "var(--color-ink-secondary)", margin: 0 }}>
          Fonte: <RecordIdentifier variant="action" id={sourceId} density="compact" onActivate={() => {}} accessibleLabel={`Abrir ${sourceId}`} />
        </p>
      )}
    </li>
  );
}

export const ProblemToEvdMinimal: Story = {
  name: "Problem → EVD / minimal",
  render: () => (
    <StandaloneDemo heading="Evidência associada a um Problema — mínimo">
      <p style={{ maxWidth: "72ch" }}>
        Uma evidência sintética com um único efeito autorado e sem fonte associada. O resumo humano ("observação") lidera; o identificador
        técnico permanece disponível mas subordinado.
      </p>
      <ul className="lyt-stack lyt-stack--standard" style={{ padding: 0, maxWidth: "72ch" }}>
        <EvidenceUseInProblem evdId="EVD-000210" observation="Levantamento fotográfico sintético regista um padrão de obstrução recorrente em passeios do centro histórico." effects={["SUPPORTS"]} />
      </ul>
    </StandaloneDemo>
  ),
};

export const ProblemToEvdMultipleEffects: Story = {
  name: "Problem → EVD / multiple authored effects",
  render: () => (
    <StandaloneDemo heading="Evidência associada a um Problema — vários efeitos autorados">
      <p style={{ maxWidth: "72ch" }}>
        A mesma evidência sintética pode ter mais do que um efeito já autorado sobre o enquadramento do Problema; a ordem autorada é
        preservada exatamente como fornecida pelo chamador — nunca reordenada por força ou confiança.
      </p>
      <ul className="lyt-stack lyt-stack--standard" style={{ padding: 0, maxWidth: "72ch" }}>
        <EvidenceUseInProblem
          evdId="EVD-000388"
          observation="Comparação sintética entre dois levantamentos sucessivos sustenta a leitura inicial mas também delimita o âmbito geográfico da conclusão."
          effects={["SUPPORTS", "BOUNDS"]}
          sourceId="SRC-0042"
        />
      </ul>
    </StandaloneDemo>
  ),
};

/* =========================================================================
   Composition B — Problem use inside an EVD
   Caller-owned fixture shape: PRB identity, synthetic title/context,
   effect(s) + research role(s) as already-captioned fact rows preserving
   authored order, caller-owned "Ver Problema →" action. Mirrors
   EvdInvestigation's own `.evd-problem-card`/`.evd-relation-facts` shape.
   ========================================================================= */
interface ProblemUseFixture {
  prbId: string;
  title: string;
  effects: string[];
  researchRoles: string[];
}

function ProblemUseInEvd({ prbId, title, effects, researchRoles }: ProblemUseFixture) {
  return (
    <li className="ui-surface-outlined" style={{ listStyle: "none" }}>
      <div className="lyt-cluster lyt-cluster--tight lyt-cluster--align-baseline" style={{ marginBottom: "var(--space-tight)" }}>
        <RecordIdentifier variant="action" id={prbId} density="compact" onActivate={() => {}} accessibleLabel={`Abrir ${prbId}`} />
        <span style={{ fontFamily: "var(--font-interface)", fontSize: "var(--text-interface-body-size)" }}>{title}</span>
      </div>
      <FactList
        rows={[
          {
            key: "effects",
            label: "Efeito",
            value: (
              <span className="lyt-cluster lyt-cluster--tight">
                {effects.map((effect, index) => (
                  <EvidenceEffectTag key={`${effect}-${index}`} effect={effect} variant="compact" />
                ))}
              </span>
            ),
          },
          {
            key: "roles",
            label: "Papel",
            value: (
              <span className="lyt-cluster lyt-cluster--tight">
                {researchRoles.map((role, index) => (
                  <ResearchRoleTag key={`${role}-${index}`} role={role} variant="compact" />
                ))}
              </span>
            ),
          },
        ]}
      />
      <button type="button" className="ui-action-text" style={{ marginTop: "var(--space-tight)", padding: "var(--p-space-1) 0" }}>
        Ver Problema →
      </button>
    </li>
  );
}

export const EvdToProblemOneEffectOneRole: Story = {
  name: "EVD → Problem / one effect + one research role",
  render: () => (
    <StandaloneDemo heading="Uso desta evidência num Problema — um efeito, um papel">
      <p style={{ maxWidth: "72ch" }}>
        Uma relação PRB→EVD sintética com um efeito e um papel de investigação já autorados — dimensões independentes, ambas expostas como
        factos já legendados ("Efeito"/"Papel"), nunca como uma segunda legenda "Efeito" duplicada.
      </p>
      <ul className="lyt-stack lyt-stack--standard" style={{ padding: 0, maxWidth: "72ch" }}>
        <ProblemUseInEvd prbId="PRB-0021" title="Passeios estreitos no centro histórico" effects={["SUPPORTS"]} researchRoles={["LOCAL_OBSERVATION"]} />
      </ul>
    </StandaloneDemo>
  ),
};

export const EvdToProblemMultipleEffectsRoles: Story = {
  name: "EVD → Problem / multiple effects + multiple roles",
  render: () => (
    <StandaloneDemo heading="Uso desta evidência num Problema — vários efeitos e papéis">
      <p style={{ maxWidth: "72ch" }}>
        A mesma relação PRB→EVD sintética com vários efeitos e vários papéis autorados; ambas as listas preservam a ordem autorada fornecida
        pelo chamador.
      </p>
      <ul className="lyt-stack lyt-stack--standard" style={{ padding: 0, maxWidth: "72ch" }}>
        <ProblemUseInEvd
          prbId="PRB-0044"
          title="Consistência de resposta face a intervenções comparáveis"
          effects={["SUPPORTS", "REFINES"]}
          researchRoles={["CONTEXTUAL", "COMPARATIVE_RESPONSE"]}
        />
      </ul>
    </StandaloneDemo>
  ),
};

/* =========================================================================
   Long-title / long-label stress
   Pathological synthetic content in a constrained measure, both
   orientations, to check wrapping/no-overflow (component-model.md §1
   "reading measure"; task requirement "long content wraps, no horizontal
   overflow"). ========================================================= */
export const LongTitleLongLabelStress: Story = {
  name: "Long-title / long-label stress",
  render: () => (
    <StandaloneDemo heading="Conteúdo longo — quebra sem transbordo horizontal">
      <p style={{ maxWidth: "72ch" }}>Título/observação sintéticos deliberadamente longos, dentro de uma coluna estreita (320px), em ambas as orientações.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-loose)", maxWidth: "320px" }}>
        <ul className="lyt-stack lyt-stack--standard" style={{ padding: 0 }}>
          <EvidenceUseInProblem
            evdId="EVD-000000000000000777-SUFIXO-SINTETICO-LONGO"
            observation="Observação sintética deliberadamente longa para verificar que o texto de leitura quebra dentro da coluna sem forçar deslocamento horizontal da página, mesmo com vários efeitos autorados a acompanhar o cabeçalho."
            effects={["CONTRADICTS", "BOUNDS"]}
            sourceId="SRC-0000000000000099-SUFIXO-SINTETICO-LONGO"
          />
        </ul>
        <ul className="lyt-stack lyt-stack--standard" style={{ padding: 0 }}>
          <ProblemUseInEvd
            prbId="PRB-0000000000000099-SUFIXO-SINTETICO-LONGO"
            title="Título de Problema sintético deliberadamente longo para verificar quebra de texto sem transbordo horizontal dentro do cartão de uso em Problema"
            effects={["REFINES"]}
            researchRoles={["COMPARATIVE_MECHANISM", "PLANNED_RESPONSE"]}
          />
        </ul>
      </div>
    </StandaloneDemo>
  ),
};

/* =========================================================================
   Comparison of both orientations on one page
   Same synthetic PRB↔EVD pair, both directions, side by side — the two
   compositions must feel related (shared atoms/tokens) without becoming
   identical templates, since their content hierarchy differs (observation-
   led vs. fact-row-led).
   ========================================================================= */
export const ComparisonBothOrientations: Story = {
  name: "Comparison — both orientations, one PRB↔EVD pair",
  render: () => (
    <StandaloneDemo heading="Comparação — as duas orientações da mesma relação PRB→EVD">
      <p style={{ maxWidth: "76ch" }}>
        A mesma relação PRB→EVD sintética, composta de duas formas: como uso de evidência dentro de um Problema (observação em prosa,
        efeito(s) em cabeçalho, proveniência separada) e como uso de Problema dentro do detalhe da evidência (identidade do Problema,
        efeito e papel como factos já legendados, ação para abrir o Problema). Ambas partilham os mesmos átomos e tokens visuais, mas não
        são o mesmo modelo de linha — a hierarquia de conteúdo diverge deliberadamente.
      </p>
      <div className="lyt-stack lyt-stack--section" style={{ maxWidth: "72ch" }}>
        <section aria-labelledby="comparison-a-heading">
          <h2 id="comparison-a-heading">Uso da evidência dentro do Problema</h2>
          <ul className="lyt-stack lyt-stack--standard" style={{ padding: 0 }}>
            <EvidenceUseInProblem
              evdId="EVD-000512"
              observation="Registo sintético de inquérito local sustenta a leitura do Problema sobre acessibilidade pedonal no centro histórico."
              effects={["SUPPORTS"]}
              sourceId="SRC-0017"
            />
          </ul>
        </section>
        <section aria-labelledby="comparison-b-heading">
          <h2 id="comparison-b-heading">Uso do Problema dentro da evidência</h2>
          <ul className="lyt-stack lyt-stack--standard" style={{ padding: 0 }}>
            <ProblemUseInEvd prbId="PRB-0006" title="Acessibilidade pedonal no centro histórico" effects={["SUPPORTS"]} researchRoles={["LOCAL_OBSERVATION"]} />
          </ul>
        </section>
      </div>
    </StandaloneDemo>
  ),
};

/* =========================================================================
   Combined demo page (desktop / compact)
   ========================================================================= */
function CombinedRelationshipPage() {
  return (
    <main className="lyt-shell-frame" style={{ padding: "var(--space-loose) var(--space-standard)" }}>
      <h1>DS-04D — Composições de relação PRB↔EVD</h1>
      <div className="lyt-stack lyt-stack--section">
        <section aria-labelledby="combined-a-heading">
          <h2 id="combined-a-heading">Evidência dentro de um Problema</h2>
          <ul className="lyt-stack lyt-stack--standard" style={{ padding: 0, maxWidth: "72ch" }}>
            <EvidenceUseInProblem evdId="EVD-000210" observation="Levantamento fotográfico sintético regista um padrão de obstrução recorrente em passeios do centro histórico." effects={["SUPPORTS"]} />
            <EvidenceUseInProblem
              evdId="EVD-000388"
              observation="Comparação sintética entre dois levantamentos sucessivos sustenta a leitura inicial mas também delimita o âmbito geográfico da conclusão."
              effects={["SUPPORTS", "BOUNDS"]}
              sourceId="SRC-0042"
            />
          </ul>
        </section>

        <section aria-labelledby="combined-b-heading">
          <h2 id="combined-b-heading">Problema dentro de uma evidência</h2>
          <ul className="lyt-stack lyt-stack--standard" style={{ padding: 0, maxWidth: "72ch" }}>
            <ProblemUseInEvd prbId="PRB-0021" title="Passeios estreitos no centro histórico" effects={["SUPPORTS"]} researchRoles={["LOCAL_OBSERVATION"]} />
            <ProblemUseInEvd
              prbId="PRB-0044"
              title="Consistência de resposta face a intervenções comparáveis"
              effects={["SUPPORTS", "REFINES"]}
              researchRoles={["CONTEXTUAL", "COMPARATIVE_RESPONSE"]}
            />
          </ul>
        </section>
      </div>
    </main>
  );
}

export const CombinedDesktop: Story = {
  name: "Combined — desktop (~1440px)",
  render: () => <CombinedRelationshipPage />,
};

export const CombinedCompact: Story = {
  name: "Combined — compact (~360px)",
  render: () => <CombinedRelationshipPage />,
};
