import "@fontsource/ibm-plex-mono/latin-ext-400.css";
import "@fontsource/ibm-plex-mono/latin-ext-500.css";
import "@fontsource/inter/latin-ext-400.css";
import "@fontsource/inter/latin-ext-500.css";
import "@fontsource/inter/latin-ext-600.css";
import "@fontsource/inter/latin-ext-700.css";
import "@fontsource/public-sans/latin-ext-400.css";
import "@fontsource/public-sans/latin-ext-600.css";
import "@fontsource/source-serif-4/latin-ext-400.css";
import "@fontsource/source-serif-4/latin-ext-600.css";
import "@fontsource/source-serif-4/latin-ext-700.css";
import "../src/styles/tokens.css";
import "../src/styles/foundations.css";
import "./preview.css";

/* Review viewports mirror the product's real responsive contract
   (docs/explorerarchitecture.md §5: compact <=767px, desktop >=768px).
   360px is the compact QA viewport, not another breakpoint. These are
   real Storybook canvas widths, not narrow wrapper elements rendered
   inside a desktop-width iframe — only a real viewport width triggers
   the product's `@media (max-width: 767px)` rules. */
export const reviewViewports = {
  reviewDesktop: {
    name: "Review — desktop (1440px)",
    styles: { width: "1440px", height: "900px" },
    type: "desktop",
  },
  reviewDesktopFit: {
    name: "Review — desktop fit (1024px)",
    styles: { width: "1024px", height: "900px" },
    type: "desktop",
  },
  reviewBoundary: {
    name: "Review — boundary (768px)",
    styles: { width: "768px", height: "900px" },
    type: "tablet",
  },
  reviewCompact: {
    name: "Review — compact (360px)",
    styles: { width: "360px", height: "740px" },
    type: "mobile",
  },
} as const;

const preview = {
  parameters: {
    layout: "fullscreen",
    viewport: {
      options: reviewViewports,
    },
  },
};

export default preview;
