import type { Meta, StoryObj } from "@storybook/react-vite";
import "../styles/layout.css";
import "../styles/ui.css";
import "../styles/domain.css";
import { RecordIdentifier } from "./RecordIdentifier";
import { RecordTypeLabel } from "./RecordTypeLabel";
import { EvidenceEffectTag } from "./EvidenceEffectTag";

/* DS-04D Slice 3A — Record + evidence domain atom stories (RecordIdentifier,
   RecordTypeLabel, EvidenceEffectTag). Ordinary semantic HTML/React
   demonstrating src/records/RecordIdentifier.tsx, RecordTypeLabel.tsx, and
   EvidenceEffectTag.tsx in isolation, on top of the DS-04B Foundation layer
   (tokens.css + foundations.css, loaded globally in preview.ts), DS-04C
   layout primitives (layout.css), the DS-04D Slice 1 generic inline-label
   anatomy (ui.css .ui-inline-label), and this slice's own domain.css.
   Synthetic PT-PT content and synthetic IDs (SRC-XXXX/EVD-XXXXXX/PRB-XXXX
   style) only, per docs/design/foundations.md "Synthetic design content" —
   no real research findings or claims. No production call site
   (RecordDetailPanel, RecordsTable, NarrowRecordsList, EvdDetail,
   ProblemView) is modified, migrated, or retired in this slice. */

const meta = {
  title: "Record Domain Atoms",
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

/* ---- RecordIdentifier ------------------------------------------------- */

function RecordIdentifierStaticDemo() {
  return <RecordIdentifier id="EVD-000105" />;
}

function RecordIdentifierActionDemo() {
  return <RecordIdentifier variant="action" id="PRB-0006" onActivate={() => {}} />;
}

function RecordIdentifierLongDemo() {
  return (
    <div style={{ maxWidth: "160px" }}>
      <RecordIdentifier id="EVD-000000000000000105-SUFIXO-SINTETICO-LONGO" />
    </div>
  );
}

/* ---- RecordTypeLabel --------------------------------------------------- */

function RecordTypeLabelCompactRow({ prefix }: { prefix: string }) {
  return (
    <p style={{ display: "flex", alignItems: "center", gap: "var(--space-tight)" }}>
      <RecordTypeLabel prefix={prefix} variant="compact" />
      <RecordIdentifier id={`${prefix}XXXX`} />
    </p>
  );
}

function RecordTypeLabelDetailDemo({ prefix }: { prefix: string }) {
  return <RecordTypeLabel prefix={prefix} variant="detail" />;
}

/* ---- EvidenceEffectTag -------------------------------------------------- */

const CANONICAL_EFFECTS = ["SUPPORTS", "REFINES", "BOUNDS", "CONTRADICTS"];

function EvidenceEffectTagStandardRow({ effect }: { effect: string }) {
  return <EvidenceEffectTag effect={effect} />;
}

function EvidenceEffectTagCompactRow({ effect }: { effect: string }) {
  return <EvidenceEffectTag effect={effect} variant="compact" />;
}

function EvidenceEffectTagUnknownDemo() {
  return <EvidenceEffectTag effect="EMERGING_FUTURE_EFFECT" />;
}

/* ---- Individual stories ------------------------------------------------- */

export const RecordIdentifierStatic: Story = {
  name: "RecordIdentifier — static",
  render: () => (
    <StandaloneDemo heading="RecordIdentifier — estático">
      <p>Identificador não interativo, tipografia técnica apenas.</p>
      <RecordIdentifierStaticDemo />
    </StandaloneDemo>
  ),
};

export const RecordIdentifierAction: Story = {
  name: "RecordIdentifier — action",
  render: () => (
    <StandaloneDemo heading="RecordIdentifier — acionável">
      <p>Identificador acionável: a intenção de navegação pertence ao chamador.</p>
      <RecordIdentifierActionDemo />
    </StandaloneDemo>
  ),
};

export const RecordIdentifierLong: Story = {
  name: "RecordIdentifier — long/pathological (containment)",
  render: () => (
    <StandaloneDemo heading="RecordIdentifier — identificador longo">
      <p>Identificador sintético longo dentro de uma coluna estreita (160px) — deve quebrar, nunca transbordar.</p>
      <RecordIdentifierLongDemo />
    </StandaloneDemo>
  ),
};

export const RecordTypeLabelPrefixes: Story = {
  name: "RecordTypeLabel — SRC- / EVD- / PRB- / unknown (compact)",
  render: () => (
    <StandaloneDemo heading="RecordTypeLabel — prefixos (compacto)">
      <RecordTypeLabelCompactRow prefix="SRC-" />
      <RecordTypeLabelCompactRow prefix="EVD-" />
      <RecordTypeLabelCompactRow prefix="PRB-" />
      <RecordTypeLabelCompactRow prefix="WID-" />
      <p>O último exemplo usa um prefixo desconhecido (sintético) para demonstrar o recuo gracioso já existente em describeType().</p>
    </StandaloneDemo>
  ),
};

export const RecordTypeLabelDetailBadge: Story = {
  name: "RecordTypeLabel — detail badge",
  render: () => (
    <StandaloneDemo heading="RecordTypeLabel — badge de detalhe">
      <RecordTypeLabelDetailDemo prefix="EVD-" />
    </StandaloneDemo>
  ),
};

export const EvidenceEffectTagCanonicalStandard: Story = {
  name: "EvidenceEffectTag — SUPPORTS/REFINES/BOUNDS/CONTRADICTS (standard)",
  render: () => (
    <StandaloneDemo heading="EvidenceEffectTag — efeitos canónicos (standard)">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-tight)" }}>
        {CANONICAL_EFFECTS.map((effect) => (
          <EvidenceEffectTagStandardRow key={effect} effect={effect} />
        ))}
      </div>
    </StandaloneDemo>
  ),
};

export const EvidenceEffectTagCanonicalCompact: Story = {
  name: "EvidenceEffectTag — SUPPORTS/REFINES/BOUNDS/CONTRADICTS (compact)",
  render: () => (
    <StandaloneDemo heading="EvidenceEffectTag — efeitos canónicos (compacto)">
      <p>Forma compacta: usada quando o contexto (ex.: um resumo de ocorrências) já legenda a coluna.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-tight)" }}>
        {CANONICAL_EFFECTS.map((effect) => (
          <EvidenceEffectTagCompactRow key={effect} effect={effect} />
        ))}
      </div>
    </StandaloneDemo>
  ),
};

export const EvidenceEffectTagUnknown: Story = {
  name: "EvidenceEffectTag — unknown/future value fallback",
  render: () => (
    <StandaloneDemo heading="EvidenceEffectTag — valor futuro desconhecido">
      <p>Valor sintético não mapeado — deve mostrar o valor canónico em bruto em vez de desaparecer ou ser reclassificado.</p>
      <EvidenceEffectTagUnknownDemo />
    </StandaloneDemo>
  ),
};

/* ---- Comparison: identifier + type + effect are separate dimensions ----
   The three atoms rendered together for one synthetic EVD, inside one
   synthetic PRB→EVD relationship row, so their visual/semantic distinctness
   is checkable on one page: the identifier names the record, the type
   states its canonical kind, and the effect states this relationship's
   already-authored role — none is a variant of another, and none may be
   swapped in for another (component-visual-contract.md "Identifier, record
   type, ... PRB→EVD effect, and research role remain separate semantic/
   domain dimensions"). */
function ComparisonRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "var(--space-standard)", padding: "var(--space-standard) 0", borderTop: "1px solid var(--color-separator-standard)" }}>
      <RecordTypeLabel prefix="EVD-" variant="compact" />
      <RecordIdentifier variant="action" id="EVD-000105" onActivate={() => {}} />
      <EvidenceEffectTag effect="SUPPORTS" />
    </div>
  );
}

export const ComparisonSeparateDimensions: Story = {
  name: "Comparison — identifier vs. record type vs. effect",
  render: () => (
    <StandaloneDemo heading="Comparação — três dimensões distintas">
      <p style={{ maxWidth: "72ch" }}>
        Identificador (EVD-000105), tipo de registo (EVD-) e efeito PRB→EVD (Sustenta) para o mesmo registo sintético, lado a lado. Cada um usa a sua própria
        legenda e forma visual — não é uma família de badges intermutável.
      </p>
      <ComparisonRow />
    </StandaloneDemo>
  ),
};

/* ---- Combined demo page (desktop / compact) ---------------------------- */
function CombinedRecordDomainAtomsPage() {
  return (
    <main className="lyt-shell-frame" style={{ padding: "var(--space-loose) var(--space-standard)" }}>
      <h1>DS-04D — Átomos de domínio de registo/evidência</h1>
      <div className="lyt-stack lyt-stack--section">
        <section aria-labelledby="identifier-heading">
          <h2 id="identifier-heading">RecordIdentifier</h2>
          <div className="lyt-stack lyt-stack--standard">
            <RecordIdentifierStaticDemo />
            <RecordIdentifierActionDemo />
            <RecordIdentifierLongDemo />
          </div>
        </section>

        <section aria-labelledby="type-heading">
          <h2 id="type-heading">RecordTypeLabel</h2>
          <div className="lyt-stack lyt-stack--standard">
            <RecordTypeLabelCompactRow prefix="SRC-" />
            <RecordTypeLabelCompactRow prefix="EVD-" />
            <RecordTypeLabelCompactRow prefix="PRB-" />
            <RecordTypeLabelCompactRow prefix="WID-" />
            <RecordTypeLabelDetailDemo prefix="EVD-" />
          </div>
        </section>

        <section aria-labelledby="effect-heading">
          <h2 id="effect-heading">EvidenceEffectTag</h2>
          <div className="lyt-stack lyt-stack--standard">
            {CANONICAL_EFFECTS.map((effect) => (
              <EvidenceEffectTagStandardRow key={effect} effect={effect} />
            ))}
            <EvidenceEffectTagUnknownDemo />
          </div>
        </section>

        <section aria-labelledby="comparison-heading">
          <h2 id="comparison-heading">Comparação — três dimensões</h2>
          <ComparisonRow />
        </section>
      </div>
    </main>
  );
}

export const CombinedDesktop: Story = {
  name: "Combined — desktop (~1440px)",
  render: () => <CombinedRecordDomainAtomsPage />,
};

export const CombinedCompact: Story = {
  name: "Combined — compact (~360px)",
  render: () => <CombinedRecordDomainAtomsPage />,
};
