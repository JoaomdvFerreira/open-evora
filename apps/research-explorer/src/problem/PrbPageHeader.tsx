import type { RefObject } from "react";
import { RecordIdentifier } from "../records/RecordIdentifier";
import { Breadcrumb } from "../presentation/Breadcrumb";
import { ContextTabs, type ContextTabsActive } from "../navigation/ContextTabs";
import { describeTopic } from "../presentation/topicMapping";
import { ShareAction } from "./ShareAction";
import { formatPublicDate } from "../presentation/presentation";
import type { PrbIdentityData } from "./prbDetailsProjection";

/**
 * The shared public PRB page header — the local header band and the
 * editorial identity hero rendered identically by both public PRB views,
 * Detalhes (PrbDetailsPresentation.tsx) and Histórico
 * (ProblemHistoryView.tsx). One implementation and one CSS contract
 * (the `.prb-header*`/`.prb-identity*` rules in styles/prb-details.css), so
 * the two views cannot drift apart.
 */

interface PrbHeaderProps {
  identity: PrbIdentityData;
  /** The PRB-local view this header sits on; it renders as the current page in Detalhes|Histórico. */
  active: ContextTabsActive;
  onBackToOverview: () => void;
  onViewDetails: (id: string) => void;
  onViewHistory: (id: string) => void;
  /**
   * Histórico only: navigates to this PRB's Detalhes audit section. Omitted on
   * Detalhes, where the audit section (`#prb-auditoria`) is on the same page
   * and "Verificar" is a plain in-page anchor to it.
   */
  onVerify?: () => void;
}

/**
 * Local PRB header: breadcrumb (Visão geral › PRB-xxxx) + the shared
 * Detalhes|Histórico PRB navigation (ContextTabs) + Verificar/Partilhar
 * utilities. "Verificar" targets the Detalhes audit section — an in-page
 * anchor on Detalhes, and a navigation to Detalhes#prb-auditoria on
 * Histórico (which has no audit section of its own, so it never renders a
 * dead local anchor). "Partilhar" reuses the existing ShareAction behaviour
 * (Web Share API / copy-link fallback) for the current view's URL. Both
 * utilities carry a decorative aria-hidden glyph (↓/↗); their visible text
 * stays their accessible name. At 360 the breadcrumb takes its own line,
 * Partilhar collapses to its icon (label kept for assistive tech) and
 * Verificar is omitted from this row.
 */
export function PrbHeader({ identity, active, onBackToOverview, onViewDetails, onViewHistory, onVerify }: PrbHeaderProps) {
  const verifyContent = (
    <>
      <span aria-hidden="true" className="prb-header-utility-icon">
        ↓
      </span>
      Verificar
    </>
  );
  return (
    <div className="prb-header-band">
      <div className="shell-frame shell-frame--wide">
        <div className="prb-header">
          <Breadcrumb
            label="Localização"
            ancestors={[
              {
                key: "visao-geral",
                action: (
                  <button type="button" className="prb-breadcrumb-ancestor" onClick={onBackToOverview}>
                    Visão geral
                  </button>
                ),
              },
            ]}
            current={<RecordIdentifier variant="text" density="compact" id={identity.problemId} />}
          />
          <ContextTabs prbId={identity.problemId} active={active} onViewDetails={onViewDetails} onViewHistory={onViewHistory} />
          <div className="prb-header-utilities">
            {onVerify ? (
              <button type="button" className="prb-header-utility prb-header-utility--verify" onClick={onVerify}>
                {verifyContent}
              </button>
            ) : (
              <a href="#prb-auditoria" className="prb-header-utility prb-header-utility--verify">
                {verifyContent}
              </a>
            )}
            <ShareAction title={identity.title} icon="↗" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Editorial hero. The "Atualizado em …" line is canonical `updated_at` —
 * the date the PRB record was last edited. It is record metadata only, not
 * a currentness assessment: nothing here infers that the reading is still
 * current from it. It follows the statement in DOM order: at >=768 the hero
 * grid lifts it into the eyebrow row's right edge; at 360 it stays below the
 * statement as the compact "PRB-xxxx · Atualizado em …" line (the id prefix
 * is shown only there — the local header breadcrumb already carries it at
 * wider widths).
 *
 * Heading outline: the Explorer chrome owns the page-level <h1>, so the PRB
 * title is an <h2> on both views.
 */
export function PrbIdentityHeader({ identity, titleRef }: { identity: PrbIdentityData; titleRef?: RefObject<HTMLHeadingElement> }) {
  return (
    <header className="prb-identity">
      <div className="prb-identity-eyebrow-row">
        <span className="prb-identity-eyebrow">
          <span className="prb-identity-eyebrow-dot" aria-hidden="true" />
          Problema em investigação
        </span>
        {identity.topics.length > 0 && (
          <span className="prb-identity-topics" aria-label="Temas">
            {identity.topics.map((topic, index) => (
              <span key={topic} className="prb-identity-topic-item">
                {index > 0 && (
                  <span aria-hidden="true" className="prb-identity-topic-sep">
                    ·
                  </span>
                )}
                <span className="prb-identity-topic-link">{describeTopic(topic).label}</span>
              </span>
            ))}
          </span>
        )}
      </div>
      <h2 id="prb-identity-title" ref={titleRef} tabIndex={-1} className="prb-identity-title">
        {identity.title}
      </h2>
      {identity.statement && <p className="prb-identity-statement">{identity.statement}</p>}
      {identity.updatedAt && (
        <p className="prb-identity-updated">
          <span className="prb-identity-updated-id">{`${identity.problemId} · `}</span>
          Atualizado em <time dateTime={identity.updatedAt}>{formatPublicDate(identity.updatedAt)}</time>
        </p>
      )}
    </header>
  );
}
