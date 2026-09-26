import type { Meta, StoryObj } from "@storybook/react-vite";
import "../index.css";
import "../styles/reading-layout.css";
import "../styles/inline-label.css";
import "../styles/domain.css";
import "../styles/breadcrumb.css";
import "../styles/feedback.css";
import "../styles/empty-state.css";
import "../styles/fact-list.css";
import "../styles/surface-inset.css";
import "../styles/section-index.css";
import "../styles/topic.css";
import "../styles/prb-details.css";
import "../styles/prb-history.css";
import { ProblemHistoryView } from "./ProblemHistoryView";
import { prb0005DataProvider } from "./prb0005Fixture";
import { ExplorerHeader } from "../app/ExplorerHeader";
import { PublicFooter } from "../app/TrustPage";

const meta = { title: "Public/PRB Histórico / PRB0005" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

/**
 * Full-page review surface for the public PRB Histórico view: the real
 * ExplorerHeader + ProblemHistoryView + PublicFooter shell, with canonical
 * PRB-0005 (including its authored `history[]`) loaded through the same
 * DataProvider path production uses — only the provider itself is the
 * in-memory prb0005Fixture.ts one. Relative entry ages follow the real
 * clock. For owner visual inspection only; not visual acceptance.
 */
function PrbHistoryShell() {
  return (
    <>
      <main className="explorer-shell">
        <ExplorerHeader activeView="history" onProblemas={noop} onRegistos={noop} />
        <ProblemHistoryView
          dataProvider={prb0005DataProvider}
          problemId="PRB-0005"
          onOpenGeneric={noop}
          onBackToRecords={noop}
          onBackToOverview={noop}
          onViewAsProblem={noop}
          onVerifyInDetails={noop}
        />
      </main>
      <PublicFooter />
    </>
  );
}

export const Desktop1440: Story = {
  name: "1440 desktop",
  globals: { viewport: { value: "reviewDesktop" } },
  render: () => <PrbHistoryShell />,
};

export const Desktop1024Fit: Story = {
  name: "1024 desktop-fit",
  globals: { viewport: { value: "reviewDesktopFit" } },
  render: () => <PrbHistoryShell />,
};

export const Boundary768: Story = {
  name: "768 boundary",
  globals: { viewport: { value: "reviewBoundary" } },
  render: () => <PrbHistoryShell />,
};

export const Compact360: Story = {
  name: "360 compact",
  globals: { viewport: { value: "reviewCompact" } },
  render: () => <PrbHistoryShell />,
};
