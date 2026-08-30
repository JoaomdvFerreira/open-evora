import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/latin-ext-400.css";
import "@fontsource/inter/latin-ext-500.css";
import "@fontsource/inter/latin-ext-600.css";
import "@fontsource/inter/latin-ext-700.css";
import "@fontsource/source-serif-4/latin-ext-400.css";
import "@fontsource/source-serif-4/latin-ext-600.css";
import "@fontsource/source-serif-4/latin-ext-700.css";
import "@fontsource/ibm-plex-mono/latin-ext-400.css";
import "@fontsource/ibm-plex-mono/latin-ext-500.css";
import "@fontsource/public-sans/latin-ext-400.css";
import "@fontsource/public-sans/latin-ext-600.css";
import { App } from "./app/App";
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

const container = document.getElementById("root");
if (!container) {
  throw new Error('Root element "#root" not found in index.html.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
