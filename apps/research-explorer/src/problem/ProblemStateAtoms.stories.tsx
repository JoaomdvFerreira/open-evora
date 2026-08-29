import type { Meta, StoryObj } from "@storybook/react-vite";
import "../styles/layout.css";
import "../styles/ui.css";
import "../styles/domain.css";
import { ProblemLifecycleStatus } from "./ProblemLifecycleStatus";
import { ValidationStatus, EvidenceStatus } from "./InvestigationStatus";

/* DS-04D Slice 3B — Problem-domain state presentation stories
   (ProblemLifecycleStatus, ValidationStatus, EvidenceStatus). Ordinary
   semantic HTML/React demonstrating src/problem/ProblemLifecycleStatus.tsx
   and src/problem/InvestigationStatus.tsx in isolation, on top of the
   DS-04B Foundation layer (tokens.css + foundations.css, loaded globally in
   preview.ts), DS-04C layout primitives (layout.css), the DS-04D Slice 1
   generic inline-label anatomy (ui.css .ui-inline-label), and this slice's
   own domain.css additions. Synthetic PT-PT content and synthetic IDs only,
   per docs/design/foundations.md "Synthetic design content" — no real
   research findings or claims. No production call site (ProblemView.tsx,
   Overview.tsx, RecordDetailPanel.tsx, ProblemHistoryView.tsx) is modified,
   migrated, or retired in this slice. */

const meta = {
  title: "Problem State Atoms",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function StandaloneDemo({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <main style={{ padding: "var(--space-loose)" }}>
      <h1 style={{ fontSize: "var(--text-reading-h2-size)" }}>{heading}</h1>
      {children}
    </main>
  );
}

/* ---- ProblemLifecycleStatus -------------------------------------------- */

const LIFECYCLE_VALUES = ["OPEN", "REJECTED", "DUPLICATE", "NON_DIGITAL", "ALREADY_SOLVED", "INSUFFICIENT_EVIDENCE"];

function LifecycleOverviewRow({ value }: { value: string }) {
  return <ProblemLifecycleStatus value={value} form="overview" />;
}

function LifecycleReadingRow({ value }: { value: string }) {
  return <ProblemLifecycleStatus value={value} form="reading" />;
}

function LifecycleTechnicalRow({ value }: { value: string }) {
  return <ProblemLifecycleStatus value={value} form="technical" />;
}

export const LifecycleOverview: Story = {
  name: "ProblemLifecycleStatus — overview summary",
  render: () => (
    <StandaloneDemo heading="Estado do problema — resumo (visão geral)">
      <p>Par legenda/valor simples, sem anatomia de chip — a forma usada num resumo compacto.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-tight)" }}>
        {LIFECYCLE_VALUES.map((value) => (
          <LifecycleOverviewRow key={value} value={value} />
        ))}
      </div>
    </StandaloneDemo>
  ),
};

export const LifecycleReading: Story = {
  name: "ProblemLifecycleStatus — Problem reading (chip)",
  render: () => (
    <StandaloneDemo heading="Estado do problema — leitura do Problema">
      <p>Chip delimitado com legenda explícita — a forma usada na leitura do Problema.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-tight)" }}>
        {LIFECYCLE_VALUES.map((value) => (
          <LifecycleReadingRow key={value} value={value} />
        ))}
      </div>
    </StandaloneDemo>
  ),
};

export const LifecycleTechnical: Story = {
  name: "ProblemLifecycleStatus — technical/raw value",
  render: () => (
    <StandaloneDemo heading="Estado do problema — valor técnico/bruto">
      <p>Par campo:valor canónico em bruto — nunca substituído pelo glossário público.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-tight)" }}>
        {LIFECYCLE_VALUES.map((value) => (
          <LifecycleTechnicalRow key={value} value={value} />
        ))}
      </div>
    </StandaloneDemo>
  ),
};

export const LifecycleUnknown: Story = {
  name: "ProblemLifecycleStatus — unknown/future value fallback",
  render: () => (
    <StandaloneDemo heading="Estado do problema — valor futuro desconhecido">
      <p>Valor sintético não mapeado — deve mostrar o valor canónico em bruto em vez de desaparecer ou ser reclassificado.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-tight)" }}>
        <ProblemLifecycleStatus value="EMERGING_FUTURE_STATUS" form="overview" />
        <ProblemLifecycleStatus value="EMERGING_FUTURE_STATUS" form="reading" />
        <ProblemLifecycleStatus value="EMERGING_FUTURE_STATUS" form="technical" />
      </div>
    </StandaloneDemo>
  ),
};

/* ---- ValidationStatus ---------------------------------------------------- */

const VALIDATION_VALUES = ["unvalidated", "partially_validated", "validated"];

export const ValidationStatusForms: Story = {
  name: "ValidationStatus — overview / reading / technical",
  render: () => (
    <StandaloneDemo heading="Estado de validação — três formas">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-standard)" }}>
        <div>
          <p>Visão geral (resumo)</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-tight)" }}>
            {VALIDATION_VALUES.map((value) => (
              <ValidationStatus key={value} value={value} form="overview" />
            ))}
          </div>
        </div>
        <div>
          <p>Leitura do Problema (chip)</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-tight)" }}>
            {VALIDATION_VALUES.map((value) => (
              <ValidationStatus key={value} value={value} form="reading" />
            ))}
          </div>
        </div>
        <div>
          <p>Valor técnico/bruto</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-tight)" }}>
            {VALIDATION_VALUES.map((value) => (
              <ValidationStatus key={value} value={value} form="technical" />
            ))}
          </div>
        </div>
      </div>
    </StandaloneDemo>
  ),
};

/* ---- EvidenceStatus ------------------------------------------------------- */

const EVIDENCE_STATUS_VALUES = ["discovered", "corroborated"];

export const EvidenceStatusForms: Story = {
  name: "EvidenceStatus — overview / reading / technical",
  render: () => (
    <StandaloneDemo heading="Estado da evidência — três formas">
      <p>Estado da investigação de um Problema — nunca apresentado numa linha de um registo EVD individual.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-standard)" }}>
        <div>
          <p>Visão geral (resumo)</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-tight)" }}>
            {EVIDENCE_STATUS_VALUES.map((value) => (
              <EvidenceStatus key={value} value={value} form="overview" />
            ))}
          </div>
        </div>
        <div>
          <p>Leitura do Problema (chip)</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-tight)" }}>
            {EVIDENCE_STATUS_VALUES.map((value) => (
              <EvidenceStatus key={value} value={value} form="reading" />
            ))}
          </div>
        </div>
        <div>
          <p>Valor técnico/bruto</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-tight)" }}>
            {EVIDENCE_STATUS_VALUES.map((value) => (
              <EvidenceStatus key={value} value={value} form="technical" />
            ))}
          </div>
        </div>
      </div>
    </StandaloneDemo>
  ),
};

export const InvestigationStatusUnknown: Story = {
  name: "ValidationStatus / EvidenceStatus — unknown/future value fallback",
  render: () => (
    <StandaloneDemo heading="Valor futuro desconhecido — validação e evidência">
      <p>Valores sintéticos não mapeados — devem mostrar o valor canónico em bruto em vez de desaparecer ou ser reclassificados.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-tight)" }}>
        <ValidationStatus value="emerging_future_validation" form="reading" />
        <EvidenceStatus value="emerging_future_evidence" form="reading" />
      </div>
    </StandaloneDemo>
  ),
};

/* ---- Comparison: three dimensions stay distinct, never interchangeable -- */
function ComparisonRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "var(--space-standard)", padding: "var(--space-standard) 0", borderTop: "1px solid var(--color-separator-standard)" }}>
      <ProblemLifecycleStatus value="INSUFFICIENT_EVIDENCE" form="reading" />
      <ValidationStatus value="unvalidated" form="reading" />
      <EvidenceStatus value="corroborated" form="reading" />
    </div>
  );
}

export const ComparisonSeparateDimensions: Story = {
  name: "Comparison — lifecycle status vs. validation status vs. evidence status",
  render: () => (
    <StandaloneDemo heading="Comparação — três dimensões de estado distintas">
      <p style={{ maxWidth: "72ch" }}>
        Estado do problema (Evidência insuficiente), estado de validação (Por validar) e estado da evidência (Evidência corroborada) para o mesmo
        Problema sintético, lado a lado. Cada dimensão mantém a sua própria legenda explícita — nenhuma substitui as outras, e nenhuma pode ser
        confundida com uma classificação de registo ou identificador.
      </p>
      <ComparisonRow />
    </StandaloneDemo>
  ),
};

/* ---- Combined demo page (desktop / compact) ---------------------------- */
function CombinedProblemStateAtomsPage() {
  return (
    <main className="lyt-shell-frame" style={{ padding: "var(--space-loose) var(--space-standard)" }}>
      <h1>DS-04D — Estados de domínio do Problema</h1>
      <div className="lyt-stack lyt-stack--section">
        <section aria-labelledby="lifecycle-heading">
          <h2 id="lifecycle-heading">ProblemLifecycleStatus</h2>
          <div className="lyt-stack lyt-stack--standard">
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-tight)" }}>
              {LIFECYCLE_VALUES.map((value) => (
                <LifecycleOverviewRow key={`ov-${value}`} value={value} />
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-tight)" }}>
              {LIFECYCLE_VALUES.map((value) => (
                <LifecycleReadingRow key={`rd-${value}`} value={value} />
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-tight)" }}>
              {LIFECYCLE_VALUES.map((value) => (
                <LifecycleTechnicalRow key={`tc-${value}`} value={value} />
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="validation-heading">
          <h2 id="validation-heading">ValidationStatus</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-tight)" }}>
            {VALIDATION_VALUES.map((value) => (
              <ValidationStatus key={value} value={value} form="reading" />
            ))}
          </div>
        </section>

        <section aria-labelledby="evidence-heading">
          <h2 id="evidence-heading">EvidenceStatus</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-tight)" }}>
            {EVIDENCE_STATUS_VALUES.map((value) => (
              <EvidenceStatus key={value} value={value} form="reading" />
            ))}
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
  render: () => <CombinedProblemStateAtomsPage />,
};

export const CombinedCompact: Story = {
  name: "Combined — compact (~360px)",
  render: () => <CombinedProblemStateAtomsPage />,
};
