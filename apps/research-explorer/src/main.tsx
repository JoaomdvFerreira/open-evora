import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/source-serif-4/latin-ext-400.css";
import "@fontsource/source-serif-4/latin-ext-600.css";
import "@fontsource/source-serif-4/latin-ext-700.css";
import "@fontsource/ibm-plex-mono/latin-ext-400.css";
import "@fontsource/ibm-plex-mono/latin-ext-500.css";
import "@fontsource/public-sans/latin-ext-400.css";
import "@fontsource/public-sans/latin-ext-600.css";
import { App } from "./app/App";
// DS-05J: reading-layout.css is imported before index.css so that
// domain-owned visibility rules in index.css (e.g. `.problem-reading-rail`'s
// `display: none` at the 768-1059px/<=767px bands) win the cascade over
// ReadingLayout's own unconditional `.lyt-reading-rail { display: flex }`
// base rule wherever a single element (Problem View's own rail `<aside>`)
// carries both classes at equal specificity — domain presence decisions
// must never be overridden by generic layout geometry (component-model.md
// §2.2).
import "./styles/reading-layout.css";
import "./index.css";
// DS-05A: the minimum DS-04 production dependency for ProblemView's reading
// status adoption (ProblemLifecycleStatus/ValidationStatus/EvidenceStatus).
// Deliberately not styles/foundations.css (global body/heading/link/control
// rules — would broaden this into a Foundation migration) and not
// styles/layout.css. Loaded after index.css: tokens.css only defines :root
// custom properties under new names, and inline-label.css/domain.css only
// define new DS-04 class names, so none of this can override an existing
// legacy index.css selector or variable.
import "./styles/tokens.css";
import "./styles/inline-label.css";
import "./styles/domain.css";
// DS-05E: the narrow canonical Breadcrumb visual recipe only (not the rest
// of ui.css, which still carries unrelated selectors/collision risk with
// index.css's own `.unavailable-control`/`.unavailable-note`).
import "./styles/breadcrumb.css";
// DS-05F: the narrow canonical ProgressMessage/ErrorNotice visual recipes
// only (not the rest of ui.css, which still carries other unrelated/
// colliding selectors).
import "./styles/feedback.css";
// DS-05I: the narrow canonical EmptyState visual recipe only (not the rest
// of ui.css, which still carries unrelated selectors/collision risk).
import "./styles/empty-state.css";
// DS-05G: the narrow canonical FactList visual recipe only (not the rest of
// ui.css, which still carries unrelated selectors/collision risk).
import "./styles/fact-list.css";
// DS-05H: the narrow canonical RailSectionIndex/CompactSectionIndex visual
// recipes, plus the one surface recipe CompactSectionIndex directly depends
// on (`.ui-surface-inset`) — not the rest of ui.css, which still carries
// unrelated selectors/collision risk.
import "./styles/surface-inset.css";
import "./styles/section-index.css";
// WU054 delta: the owner-approved Logo (presentation/Logo.tsx), now adopted
// into the chrome header, needs its own narrow visual recipe.
import "./styles/logo.css";
import "./styles/topic.css";
// The public PRB Details composition (PrbDetailsPresentation, rendered by
// ProblemView). prb-details.css itself imports prb-view-selector.css and
// owns the PRB header/hero contract shared with Histórico.
import "./styles/prb-details.css";
// The public PRB Histórico composition (ProblemHistoryView) — only its own
// material-history band on top of the shared PRB contract above.
import "./styles/prb-history.css";
// The public Records landing (RecordsTable): intro, filters/search, record
// list and responsive pagination.
import "./styles/records.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error('Root element "#root" not found in index.html.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
