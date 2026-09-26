import type { Meta, StoryObj } from "@storybook/react-vite";
import "../index.css";
import "../styles/logo.css";
import "../styles/information.css";
import { PublicFooter, TrustPage, trustPageForPath } from "./TrustPage";

const meta = { title: "Public/Informação" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

type InformationPath = "/about" | "/methodology" | "/corrections" | "/contact" | "/privacy";

/**
 * Full-page review surface: the production TrustPage (global header, local
 * INFORMAÇÃO navigation, page content, previous/next) inside the same
 * `main.explorer-shell` App.tsx renders, followed by the shared PublicFooter.
 */
function InformationShell({ path }: { path: InformationPath }) {
  const page = trustPageForPath(path);
  if (!page) throw new Error(`Missing Information page for ${path}`);
  return <><main className="explorer-shell"><TrustPage page={page} /></main><PublicFooter /></>;
}

const desktop = { viewport: { value: "reviewDesktop" } };

export const Sobre1440: Story = { name: "Sobre — 1440 desktop", globals: desktop, render: () => <InformationShell path="/about" /> };
export const Metodologia1440: Story = { name: "Metodologia — 1440 desktop", globals: desktop, render: () => <InformationShell path="/methodology" /> };
export const Correcoes1440: Story = { name: "Correções — 1440 desktop", globals: desktop, render: () => <InformationShell path="/corrections" /> };
export const Contacto1440: Story = { name: "Contacto — 1440 desktop", globals: desktop, render: () => <InformationShell path="/contact" /> };
export const Privacidade1440: Story = { name: "Privacidade — 1440 desktop", globals: desktop, render: () => <InformationShell path="/privacy" /> };

/* The shell is shared, so Sobre carries the responsive review; Privacidade at
   360 additionally shows the strip scrolled to its last (current) item. */

export const Sobre1024: Story = { name: "Sobre — 1024 desktop-fit", globals: { viewport: { value: "reviewDesktopFit" } }, render: () => <InformationShell path="/about" /> };
export const Sobre768: Story = { name: "Sobre — 768 boundary", globals: { viewport: { value: "reviewBoundary" } }, render: () => <InformationShell path="/about" /> };
export const Sobre360: Story = { name: "Sobre — 360 compact", globals: { viewport: { value: "reviewCompact" } }, render: () => <InformationShell path="/about" /> };
export const Privacidade360: Story = { name: "Privacidade — 360 compact", globals: { viewport: { value: "reviewCompact" } }, render: () => <InformationShell path="/privacy" /> };
