import type { Meta, StoryObj } from "@storybook/react-vite";
import "../styles/layout.css";
import "../styles/ui.css";
import "../styles/topic.css";
import "../styles/logo.css";
import { TopicBadge } from "./TopicBadge";
import { auditedDomainCodes } from "./topicMapping";
import { Logo, LogoMark } from "./Logo";
import { ExplorerHeader } from "../app/ExplorerHeader";
import "../index.css";

/* WU053 — Visual Foundation & Identity durable review boundary: the
   presentation-only PRB `domain` topic mapping (TopicBadge.tsx/
   topicMapping.ts) and the Open Évora logo/mark (Logo.tsx). These are new
   domain/identity concepts with no prior owning story file (unlike the
   three Problem state dimensions, already covered by
   problem/ProblemStateAtoms.stories.tsx), so a new durable boundary is
   justified here rather than reusing an unrelated existing file
   (AGENTS.md §2 "Repository structure and file creation" — a genuinely
   distinct, durable responsibility). Synthetic PT-PT content only; no real
   research findings. No production call site (Explorer.tsx header,
   Overview.tsx, ProblemView.tsx, TrustPage.tsx) is modified, migrated, or
   adopted in this slice — WU053's constraint scope is the visual foundation
   itself, gated by owner visual-review, not surface adoption. */

const meta = {
  title: "Visual Foundation",
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

/* ---- TopicBadge ---------------------------------------------------------- */

export const TopicMapping: Story = {
  name: "TopicBadge — audited PRB domain codes",
  render: () => (
    <StandaloneDemo heading="Mapa de temas — códigos de domínio PRB auditados">
      <p style={{ maxWidth: "72ch" }}>
        Rótulo público PT-PT, tom e ícone por código canónico <code>domain</code> auditado nos 12 registos PRB atuais
        (<code>research/problems/PRB-*.yaml</code>). Apresentação apenas — o código canónico armazenado nunca é substituído, apenas
        traduzido para leitura.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-tight)" }}>
        {auditedDomainCodes().map((code) => (
          <TopicBadge key={code} code={code} form="technical" />
        ))}
      </div>
    </StandaloneDemo>
  ),
};

export const TopicMappingCompact: Story = {
  name: "TopicBadge — compact form (list/filter usage)",
  render: () => (
    <StandaloneDemo heading="TopicBadge — forma compacta">
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-tight)" }}>
        {auditedDomainCodes().map((code) => (
          <TopicBadge key={code} code={code} />
        ))}
      </div>
    </StandaloneDemo>
  ),
};

export const TopicMappingUnknownFallback: Story = {
  name: "TopicBadge — safe neutral fallback for an unmapped code",
  render: () => (
    <StandaloneDemo heading="TopicBadge — código futuro não mapeado">
      <p>Um código de domínio sintético fora do conjunto auditado recebe o rótulo/tom/ícone neutro de recurso, nunca desaparece.</p>
      <TopicBadge code="ZZZ-SYNTHETIC-FUTURE" form="technical" />
    </StandaloneDemo>
  ),
};

/* ---- Logo ----------------------------------------------------------------- */

export const LogoFull: Story = {
  name: "Logo — full lockup (mark + wordmark)",
  render: () => (
    <StandaloneDemo heading="Logótipo — versão completa">
      <div style={{ background: "var(--color-surface-reading)", padding: "var(--space-standard)", fontSize: "28px" }}>
        <Logo />
      </div>
    </StandaloneDemo>
  ),
};

export const LogoCompact: Story = {
  name: "Logo — compact mark (favicon/footer usage)",
  render: () => (
    <StandaloneDemo heading="Logótipo — marca compacta">
      <div style={{ background: "var(--color-surface-reading)", padding: "var(--space-standard)", fontSize: "40px", display: "flex", gap: "var(--space-standard)" }}>
        <Logo form="compact" />
        <LogoMark />
      </div>
    </StandaloneDemo>
  ),
};

export const ExplorerIdentityHeader: Story = {
  name: "Explorer identity header",
  render: () => <main className="explorer-shell"><ExplorerHeader activeView="overview" onOverview={() => {}} onRecords={() => {}} /></main>,
};

/* ---- Combined demo page (desktop / compact) ------------------------------ */
function CombinedVisualFoundationPage() {
  return (
    <main className="lyt-shell-frame" style={{ padding: "var(--space-loose) var(--space-standard)" }}>
      <h1>WU053 — Fundação visual e identidade</h1>
      <div className="lyt-stack lyt-stack--section">
        <section aria-labelledby="logo-heading">
          <h2 id="logo-heading">Logótipo</h2>
          <div style={{ fontSize: "28px", marginBottom: "var(--space-tight)" }}>
            <Logo />
          </div>
          <div style={{ fontSize: "20px" }}>
            <Logo form="compact" />
          </div>
        </section>

        <section aria-labelledby="topics-heading">
          <h2 id="topics-heading">Temas (mapa de domínios PRB)</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-tight)" }}>
            {auditedDomainCodes().map((code) => (
              <TopicBadge key={code} code={code} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export const CombinedDesktop: Story = {
  name: "Combined — desktop (~1440px)",
  render: () => <CombinedVisualFoundationPage />,
};

export const CombinedCompact: Story = {
  name: "Combined — compact (~360px)",
  render: () => <CombinedVisualFoundationPage />,
};
