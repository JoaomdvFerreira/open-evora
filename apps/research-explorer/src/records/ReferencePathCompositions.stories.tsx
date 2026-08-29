import type { Meta, StoryObj } from "@storybook/react-vite";
import "../styles/layout.css";
import "../styles/ui.css";
import "../styles/domain.css";
import { RecordIdentifier } from "./RecordIdentifier";
import { RecordTypeLabel } from "./RecordTypeLabel";

/* DS-04D Slice 4B — reference/path composition stories. Isolated
   Storybook composition over the DS-04D domain atoms (RecordIdentifier,
   RecordTypeLabel), demonstrating the three remaining domain-owned forms
   component-model.md §5.7 names and keeps explicitly separate:

   - `OpenQuestionEvidenceRefs` (ProblemView.tsx): compact EVD references
     attached to authored uncertainty/path content.
   - `PrbCanonicalReferences` (RecordDetailPanel.tsx): exact canonical path
     occurrence to a target ID, deliberately not deduplicated.
   - `RelationshipList` (RecordDetailPanel.tsx): related-record grouping
     that preserves all edge/path occurrences and their direction.

   component-visual-contract.md's approved catalogue specimen (§4 "Evidence
   and reference presentations — four questions, four forms") freezes that
   "only the first form [Evidence in a Problem, DS-04D Slice 4A] takes a
   surface. The other three are rules and whitespace, because their content
   is a reference, not a unit." — so, unlike Slice 4A's
   `.ui-surface-outlined` card, none of these three compositions is wrapped
   in a surface; they use `border-top` rule separators between rows
   (matching the catalogue's own inline `border-top:1px solid #f1eee1`
   treatment) plus Stack/Cluster flow only.

   Composition A anatomy is derived from `OpenQuestionEvidenceRefs`
   (ProblemView.tsx): a caller-owned caption ("Evidência relacionada:")
   followed by one or more compact `RecordIdentifier` actions, attached
   beneath authored prose. Deliberately lighter than Composition A of
   Slice 4A's `EvidenceCard`/`EvidenceUseInProblem` — no observation body,
   no effect, no research role, no Source provenance, no evidence_status:
   this is a reference, not the evidence record's own presentation.

   Composition B anatomy is derived from `PrbCanonicalReferences`
   (RecordDetailPanel.tsx): one row per occurrence, pairing the exact
   canonical field path (`<code>`, monospace, unaltered) with the
   independently actionable target identifier. The same target ID reached
   through two distinct paths renders as two rows — `PrbCanonicalReferences`
   itself is explicitly documented as "deliberately not deduplicated"
   (RecordDetailPanel.tsx `CanonicalReference` docblock) and the catalogue
   specimen (§4, ~line 720) demonstrates exactly this with
   `evidence[0].evidence_id` / `evidence[2].evidence_id` both resolving to
   the same EVD.

   Composition C anatomy is derived from `RelationshipList`
   (RecordDetailPanel.tsx): grouped by related-record identity, each group
   heading pairs `RecordTypeLabel` + `RecordIdentifier` for the target, and
   every distinct incoming/outgoing path beneath it is preserved and
   direction-tagged (arrow + "Entrada"/"Saída" label + relation field),
   mirroring `RelationshipList`'s own `groupPathsByRelatedRecord` — which
   groups by related-record ID only and "never discards a distinct path."

   All three compositions are caller-supplied fixtures only: no ID
   resolution, no inference of unresolved references, no deduplication by
   target, no derived relationship meaning from connectivity, no
   ranking/strength/confidence. Synthetic identifiers only
   (EVD-XXXXXX / PRB-XXXX / SRC-XXXX style, foundations.md "Synthetic
   design content") — no real Open Évora research claims or IDs. No
   production call site (ProblemView.tsx, RecordDetailPanel.tsx) is
   modified, migrated, or retired in this slice; this file introduces no
   new production React component — `ReferenceEvidenceList`,
   `CanonicalPathList`, and `RelatedRecordGroups` below are Storybook-only
   composition functions, not a shared ReferenceRow/RelationshipRow/Card. */

const meta = {
  title: "Reference/Path Compositions",
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
   Composition A — Compact EVD reference attached to authored content
   Caller-owned fixture shape: surrounding authored context/caption (a
   sentence of authored uncertainty/path prose), resolved EVD IDs in
   authored order, action behaviour. Mirrors OpenQuestionEvidenceRefs's own
   `.open-question-evidence-refs` shape (label + `<ul>` of compact
   TypedLinkButton-equivalent actions) — never EvidenceCard: no observation
   body, no effect, no research role, no Source provenance, no
   evidence_status. Unresolved IDs are never inferred or fabricated here —
   the fixture only ever lists already-resolved references, matching
   `OpenQuestionEvidenceRefs`'s own "omitted entirely when no referenced ID
   resolves" contract.
   ========================================================================= */
interface EvidenceRefFixture {
  context: string;
  caption: string;
  evdIds: string[];
}

function ReferenceEvidenceList({ context, caption, evdIds }: EvidenceRefFixture) {
  return (
    <div>
      <p style={{ fontFamily: "var(--font-reading)", fontSize: "var(--text-reading-body-size)", lineHeight: "var(--text-reading-body-line-height)", margin: "0 0 var(--space-tight)" }}>
        {context}
      </p>
      <div className="lyt-cluster lyt-cluster--tight lyt-cluster--align-baseline">
        <span style={{ fontFamily: "var(--font-interface)", fontSize: "var(--text-interface-body-size)", color: "var(--color-ink-secondary)" }}>{caption}</span>
        <ul className="lyt-cluster lyt-cluster--tight" style={{ padding: 0, margin: 0, listStyle: "none" }}>
          {evdIds.map((id, index) => (
            <li key={`${id}-${index}`}>
              <RecordIdentifier variant="action" id={id} density="compact" onActivate={() => {}} accessibleLabel={`Abrir ${id}`} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export const CompactEvdRefsSingle: Story = {
  name: "Compact EVD refs / single",
  render: () => (
    <StandaloneDemo heading="Referência de evidência compacta — uma única referência">
      <p style={{ maxWidth: "72ch" }}>
        Uma questão em aberto sintética com uma única evidência relacionada já resolvida. A referência acompanha a prosa autorada mas
        permanece leve — sem corpo de observação, efeito, papel de investigação, proveniência de Fonte ou estado de evidência.
      </p>
      <div style={{ maxWidth: "72ch" }}>
        <ReferenceEvidenceList
          context="Permanece por determinar se as obras de repavimentação alteraram a acessibilidade nos pontos assinalados."
          caption="Evidência relacionada:"
          evdIds={["EVD-000210"]}
        />
      </div>
    </StandaloneDemo>
  ),
};

export const CompactEvdRefsMultiple: Story = {
  name: "Compact EVD refs / multiple",
  render: () => (
    <StandaloneDemo heading="Referência de evidência compacta — múltiplas referências">
      <p style={{ maxWidth: "72ch" }}>
        A mesma questão em aberto sintética pode referir mais do que uma evidência já resolvida, na ordem exata fornecida pelo chamador —
        nunca reordenada.
      </p>
      <div style={{ maxWidth: "72ch" }}>
        <ReferenceEvidenceList
          context="A procura de evidência contraditória identificou dois registos adicionais que ainda não foram integrados na leitura atual."
          caption="Evidência relacionada:"
          evdIds={["EVD-000042", "EVD-000388", "EVD-000512"]}
        />
      </div>
    </StandaloneDemo>
  ),
};

export const CompactEvdRefsLongStress: Story = {
  name: "Compact EVD refs / long identifier stress",
  render: () => (
    <StandaloneDemo heading="Referência de evidência compacta — identificador longo, coluna estreita">
      <p style={{ maxWidth: "72ch" }}>Um identificador sintético deliberadamente longo, dentro de uma coluna estreita (320px), para verificar quebra sem transbordo horizontal.</p>
      <div style={{ maxWidth: "320px" }}>
        <ReferenceEvidenceList
          context="O sinal inicial desta investigação baseou-se num único registo fotográfico cuja resolução exata da localização permanece por confirmar face a alterações recentes de numeração de porta."
          caption="Evidência relacionada:"
          evdIds={["EVD-000000000000000777-SUFIXO-SINTETICO-LONGO"]}
        />
      </div>
    </StandaloneDemo>
  ),
};

/* =========================================================================
   Composition B — Exact canonical-path occurrence
   Caller-owned fixture shape: each occurrence independently supplies exact
   canonical path text, target record ID, target type/prefix (used only
   where public orientation legitimately requires it — omitted from the
   minimal/duplicate/multiple-target stories below since PrbCanonicalReferences
   itself never renders a type label, and included only in the
   long/stress story to demonstrate the caller-supplied option exists),
   action. Mirrors PrbCanonicalReferences's own `.prb-reference-item` row
   (path <code> + target action) — critical invariant: same target through
   two distinct paths renders as two rows, never deduplicated. Path text is
   rendered exactly as supplied, in technical typography, never translated,
   prettified, shortened, or inferred.
   ========================================================================= */
interface CanonicalPathOccurrence {
  path: string;
  targetId: string;
  targetPrefix?: string;
}

function CanonicalPathList({ occurrences }: { occurrences: CanonicalPathOccurrence[] }) {
  return (
    <ul className="lyt-stack" style={{ padding: 0, margin: 0, listStyle: "none", gap: 0 }}>
      {occurrences.map((occurrence, index) => (
        <li
          key={`${occurrence.path}-${index}`}
          className="lyt-cluster lyt-cluster--standard lyt-cluster--align-baseline"
          style={{ borderTop: "var(--p-border-width-hairline) solid var(--color-separator-faint)", padding: "var(--space-tight) 0" }}
        >
          <code style={{ fontFamily: "var(--font-technical)", fontSize: "var(--text-technical-size)", color: "var(--color-ink-secondary)", overflowWrap: "anywhere" }}>{occurrence.path}</code>
          {occurrence.targetPrefix && <RecordTypeLabel prefix={occurrence.targetPrefix} variant="compact" />}
          <RecordIdentifier variant="action" id={occurrence.targetId} density="compact" onActivate={() => {}} accessibleLabel={`Abrir ${occurrence.targetId} referenciado em ${occurrence.path}`} />
        </li>
      ))}
    </ul>
  );
}

export const CanonicalPathSingle: Story = {
  name: "Canonical paths / single occurrence",
  render: () => (
    <StandaloneDemo heading="Ocorrência de caminho canónico — uma única ocorrência">
      <p style={{ maxWidth: "72ch" }}>Um único caminho canónico sintético apontando para um registo alvo, com o texto do caminho preservado exatamente como fornecido.</p>
      <div style={{ maxWidth: "72ch" }}>
        <CanonicalPathList occurrences={[{ path: "evidence[0].evidence_id", targetId: "EVD-000210" }]} />
      </div>
    </StandaloneDemo>
  ),
};

export const CanonicalPathDuplicateTarget: Story = {
  name: "Canonical paths / duplicate target, distinct paths",
  render: () => (
    <StandaloneDemo heading="Ocorrência de caminho canónico — mesmo alvo, caminhos distintos">
      <p style={{ maxWidth: "72ch" }}>
        O mesmo registo alvo sintético é referenciado através de dois caminhos canónicos distintos — invariante crítico: as duas ocorrências
        permanecem visivelmente distintas, nunca deduplicadas por identidade do alvo.
      </p>
      <div style={{ maxWidth: "72ch" }}>
        <CanonicalPathList
          occurrences={[
            { path: "evidence[0].evidence_id", targetId: "EVD-000210" },
            { path: "decision_basis.supporting_evidence[1]", targetId: "EVD-000210" },
          ]}
        />
      </div>
    </StandaloneDemo>
  ),
};

export const CanonicalPathMultipleTargets: Story = {
  name: "Canonical paths / multiple targets",
  render: () => (
    <StandaloneDemo heading="Ocorrência de caminho canónico — vários alvos">
      <p style={{ maxWidth: "72ch" }}>Vários caminhos canónicos sintéticos, cada um apontando para um registo alvo diferente, na ordem fornecida pelo chamador.</p>
      <div style={{ maxWidth: "72ch" }}>
        <CanonicalPathList
          occurrences={[
            { path: "evidence[0].evidence_id", targetId: "EVD-000210" },
            { path: "evidence[2].evidence_id", targetId: "EVD-000388" },
            { path: "investigation.path.initial_signal.evidence[0]", targetId: "EVD-000042" },
          ]}
        />
      </div>
    </StandaloneDemo>
  ),
};

export const CanonicalPathLongStress: Story = {
  name: "Canonical paths / pathological long path + ID",
  render: () => (
    <StandaloneDemo heading="Ocorrência de caminho canónico — caminho e identificador longos, coluna estreita">
      <p style={{ maxWidth: "72ch" }}>Um caminho canónico e um identificador sintéticos deliberadamente longos, dentro de uma coluna estreita (320px), com o rótulo de tipo de alvo incluído.</p>
      <div style={{ maxWidth: "320px" }}>
        <CanonicalPathList
          occurrences={[
            {
              path: "investigation.open_questions[3].resolution_condition.supporting_evidence[12].evidence_id",
              targetId: "EVD-000000000000000777-SUFIXO-SINTETICO-LONGO",
              targetPrefix: "EVD-",
            },
          ]}
        />
      </div>
    </StandaloneDemo>
  ),
};

/* =========================================================================
   Composition C — Related-record grouping
   Caller-owned fixture shape: already-resolved relationship entries with
   direction, path/edge occurrence, target identity, public type/label.
   Mirrors RelationshipList's own grouped-by-related-record shape (heading
   pairing RecordTypeLabel + RecordIdentifier for the target, `<ul>` of
   every direction-tagged path beneath it) — never deduplicates by target
   ID, never infers relationship meaning from connectivity, never converts
   path names into effects/research roles, never implies ranking/strength/
   confidence.
   ========================================================================= */
interface RelatedPathOccurrence {
  direction: "incoming" | "outgoing";
  field: string;
  ordinal: number | null;
}

interface RelatedRecordGroup {
  targetPrefix: string;
  targetId: string;
  targetLabel: string;
  paths: RelatedPathOccurrence[];
}

function RelatedRecordGroups({ groups }: { groups: RelatedRecordGroup[] }) {
  return (
    <ul className="lyt-stack lyt-stack--standard" style={{ padding: 0, margin: 0, listStyle: "none" }}>
      {groups.map((group, groupIndex) => (
        <li key={`${group.targetId}-${groupIndex}`}>
          <div className="lyt-cluster lyt-cluster--standard lyt-cluster--align-baseline">
            <RecordTypeLabel prefix={group.targetPrefix} variant="compact" />
            <RecordIdentifier variant="action" id={group.targetId} density="compact" onActivate={() => {}} accessibleLabel={`Abrir ${group.targetId}`} />
            <span style={{ fontFamily: "var(--font-interface)", fontSize: "var(--text-interface-body-size)" }}>{group.targetLabel}</span>
          </div>
          <ul className="lyt-stack" style={{ padding: 0, margin: "var(--space-tight) 0 0", listStyle: "none", gap: 0 }}>
            {group.paths.map((path, pathIndex) => {
              const arrow = path.direction === "outgoing" ? "→" : "←";
              const label = path.direction === "outgoing" ? "Saída" : "Entrada";
              const relation = path.direction === "outgoing" ? "referencia através de" : "referenciado através de";
              const ordinalSuffix = path.ordinal !== null ? `[${path.ordinal}]` : "";
              return (
                <li
                  key={`${path.direction}-${path.field}-${path.ordinal}-${pathIndex}`}
                  style={{
                    borderTop: "var(--p-border-width-hairline) solid var(--color-separator-faint)",
                    padding: "var(--space-tight) 0",
                    fontFamily: "var(--font-interface)",
                    fontSize: "var(--text-interface-body-size)",
                    color: "var(--color-ink-secondary)",
                  }}
                >
                  <span aria-hidden="true" style={{ fontFamily: "var(--font-technical)" }}>
                    {arrow}
                  </span>{" "}
                  {label} — {relation} <code style={{ fontFamily: "var(--font-technical)", fontSize: "var(--text-technical-size)", overflowWrap: "anywhere" }}>{path.field}</code>
                  {ordinalSuffix}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export const RelatedRecordsIncomingOutgoing: Story = {
  name: "Related records / incoming + outgoing",
  render: () => (
    <StandaloneDemo heading="Registos relacionados — entrada e saída">
      <p style={{ maxWidth: "72ch" }}>
        Dois registos relacionados sintéticos, um alcançado através de um caminho de saída e outro através de um caminho de entrada — a
        distinção de direção permanece explícita em texto, nunca apenas por cor ou posição.
      </p>
      <div style={{ maxWidth: "72ch" }}>
        <RelatedRecordGroups
          groups={[
            {
              targetPrefix: "EVD-",
              targetId: "EVD-000210",
              targetLabel: "Levantamento fotográfico de largura de passeios",
              paths: [{ direction: "outgoing", field: "evidence", ordinal: 0 }],
            },
            {
              targetPrefix: "PRB-",
              targetId: "PRB-0021",
              targetLabel: "Passeios estreitos no centro histórico",
              paths: [{ direction: "incoming", field: "evidence", ordinal: null }],
            },
          ]}
        />
      </div>
    </StandaloneDemo>
  ),
};

export const RelatedRecordsRepeatedTarget: Story = {
  name: "Related records / repeated target, multiple paths",
  render: () => (
    <StandaloneDemo heading="Registos relacionados — mesmo alvo alcançado por vários caminhos">
      <p style={{ maxWidth: "72ch" }}>
        O mesmo registo relacionado sintético é alcançado através de mais do que um caminho — agrupado uma única vez por identidade do
        registo relacionado, mas com todos os caminhos distintos preservados por baixo, nunca colapsados num só.
      </p>
      <div style={{ maxWidth: "72ch" }}>
        <RelatedRecordGroups
          groups={[
            {
              targetPrefix: "EVD-",
              targetId: "EVD-000388",
              targetLabel: "Comparação entre levantamentos sucessivos",
              paths: [
                { direction: "outgoing", field: "decision_basis.supporting_evidence", ordinal: 1 },
                { direction: "outgoing", field: "decision_basis.boundary_evidence", ordinal: 0 },
                { direction: "incoming", field: "evidence", ordinal: null },
              ],
            },
          ]}
        />
      </div>
    </StandaloneDemo>
  ),
};

export const RelatedRecordsMixedStress: Story = {
  name: "Related records / mixed grouping, long path + identifier stress",
  render: () => (
    <StandaloneDemo heading="Registos relacionados — agrupamento misto, caminho e identificador longos">
      <p style={{ maxWidth: "72ch" }}>
        Vários registos relacionados sintéticos, alguns com um único caminho, outros com vários, um deles com um caminho e identificador
        deliberadamente longos — dentro de uma coluna estreita (320px) para verificar quebra sem transbordo horizontal.
      </p>
      <div style={{ maxWidth: "320px" }}>
        <RelatedRecordGroups
          groups={[
            {
              targetPrefix: "EVD-",
              targetId: "EVD-000042",
              targetLabel: "Registo de inquérito local",
              paths: [{ direction: "outgoing", field: "evidence", ordinal: 0 }],
            },
            {
              targetPrefix: "SRC-",
              targetId: "SRC-0000000000000099-SUFIXO-SINTETICO-LONGO",
              targetLabel: "Registo de manutenção sintético com título deliberadamente longo para verificar quebra de texto",
              paths: [
                { direction: "outgoing", field: "investigation.open_questions[3].resolution_condition.supporting_evidence[12].evidence_id", ordinal: null },
                { direction: "incoming", field: "evidence", ordinal: 2 },
              ],
            },
          ]}
        />
      </div>
    </StandaloneDemo>
  ),
};

/* =========================================================================
   Comparison of all three forms on one page
   Same visual atoms (RecordIdentifier/RecordTypeLabel), same rule-and-
   whitespace treatment, but three recognisably different reading
   questions: "which evidence backs this uncertainty", "exactly which
   canonical field points where", and "which records relate to this one,
   through which paths, in which direction".
   ========================================================================= */
export const ComparisonAllThreeForms: Story = {
  name: "Comparison — all three forms",
  render: () => (
    <StandaloneDemo heading="Comparação — as três formas de referência/caminho">
      <p style={{ maxWidth: "76ch" }}>
        As três composições partilham os mesmos átomos (RecordIdentifier, RecordTypeLabel) e o mesmo tratamento de regra/espaço em branco —
        nenhuma delas usa uma superfície, ao contrário da composição "Evidência num Problema" (Slice 4A) — mas respondem a perguntas de
        leitura distintas e permanecem funções de composição separadas, nunca um único componente genérico.
      </p>
      <div className="lyt-stack lyt-stack--section" style={{ maxWidth: "72ch" }}>
        <section aria-labelledby="comparison-a-heading">
          <h2 id="comparison-a-heading">Referência de evidência compacta</h2>
          <ReferenceEvidenceList
            context="Permanece por determinar se as obras de repavimentação alteraram a acessibilidade nos pontos assinalados."
            caption="Evidência relacionada:"
            evdIds={["EVD-000210", "EVD-000388"]}
          />
        </section>
        <section aria-labelledby="comparison-b-heading">
          <h2 id="comparison-b-heading">Ocorrência de caminho canónico</h2>
          <CanonicalPathList
            occurrences={[
              { path: "evidence[0].evidence_id", targetId: "EVD-000210" },
              { path: "decision_basis.supporting_evidence[1]", targetId: "EVD-000210" },
            ]}
          />
        </section>
        <section aria-labelledby="comparison-c-heading">
          <h2 id="comparison-c-heading">Agrupamento de registos relacionados</h2>
          <RelatedRecordGroups
            groups={[
              {
                targetPrefix: "EVD-",
                targetId: "EVD-000210",
                targetLabel: "Levantamento fotográfico de largura de passeios",
                paths: [{ direction: "outgoing", field: "evidence", ordinal: 0 }],
              },
            ]}
          />
        </section>
      </div>
    </StandaloneDemo>
  ),
};

/* =========================================================================
   Combined demo page (desktop / compact)
   ========================================================================= */
function CombinedReferencePathPage() {
  return (
    <main className="lyt-shell-frame" style={{ padding: "var(--space-loose) var(--space-standard)" }}>
      <h1>DS-04D — Composições de referência/caminho</h1>
      <div className="lyt-stack lyt-stack--section">
        <section aria-labelledby="combined-a-heading">
          <h2 id="combined-a-heading">Referências de evidência compactas</h2>
          <div className="lyt-stack lyt-stack--standard" style={{ maxWidth: "72ch" }}>
            <ReferenceEvidenceList
              context="Permanece por determinar se as obras de repavimentação alteraram a acessibilidade nos pontos assinalados."
              caption="Evidência relacionada:"
              evdIds={["EVD-000210"]}
            />
            <ReferenceEvidenceList
              context="A procura de evidência contraditória identificou dois registos adicionais que ainda não foram integrados na leitura atual."
              caption="Evidência relacionada:"
              evdIds={["EVD-000042", "EVD-000388", "EVD-000512"]}
            />
          </div>
        </section>

        <section aria-labelledby="combined-b-heading">
          <h2 id="combined-b-heading">Ocorrências de caminho canónico</h2>
          <div style={{ maxWidth: "72ch" }}>
            <CanonicalPathList
              occurrences={[
                { path: "evidence[0].evidence_id", targetId: "EVD-000210" },
                { path: "decision_basis.supporting_evidence[1]", targetId: "EVD-000210" },
                { path: "evidence[2].evidence_id", targetId: "EVD-000388" },
              ]}
            />
          </div>
        </section>

        <section aria-labelledby="combined-c-heading">
          <h2 id="combined-c-heading">Agrupamento de registos relacionados</h2>
          <div style={{ maxWidth: "72ch" }}>
            <RelatedRecordGroups
              groups={[
                {
                  targetPrefix: "EVD-",
                  targetId: "EVD-000210",
                  targetLabel: "Levantamento fotográfico de largura de passeios",
                  paths: [{ direction: "outgoing", field: "evidence", ordinal: 0 }],
                },
                {
                  targetPrefix: "PRB-",
                  targetId: "PRB-0021",
                  targetLabel: "Passeios estreitos no centro histórico",
                  paths: [{ direction: "incoming", field: "evidence", ordinal: null }],
                },
              ]}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

export const CombinedDesktop: Story = {
  name: "Combined — desktop (~1440px)",
  render: () => <CombinedReferencePathPage />,
};

export const CombinedCompact: Story = {
  name: "Combined — compact (~360px)",
  render: () => <CombinedReferencePathPage />,
};
