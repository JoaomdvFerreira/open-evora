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
import { PrbDetailsPresentation } from "./PrbDetailsPresentation";
import { buildPrbDetailsData } from "./prbDetailsProjection";
import { useProblemProjection } from "./useProblemProjection";
import { useRecordIndex } from "../records/useRecordIndex";
import { prb0005DataProvider } from "./prb0005Fixture";
import { ExplorerHeader } from "../app/ExplorerHeader";
import { PublicFooter } from "../app/TrustPage";
import { ProgressMessage } from "../presentation/ProgressMessage";
import { ErrorNotice } from "../presentation/ErrorNotice";
import type { RecordSummary } from "../dataProvider/types";

const meta = { title: "Public/PRB Details / PRB0005" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

/**
 * A stable, module-level empty lookup — never a fresh `new Map()` per render.
 * `useProblemProjection`'s effect depends on `lookup` by reference; a
 * freshly-constructed Map on every not-yet-ready render would retrigger that
 * effect every render and never let the hook settle.
 */
const EMPTY_LOOKUP = new Map<string, RecordSummary>();

/**
 * Loads the real PRB-0005 projection (problem + all 11 linked EVD + their
 * SRC provenance) through the same data-access path production uses
 * (useRecordIndex + useProblemProjection over a DataProvider) — the only
 * difference from production is the DataProvider implementation itself
 * (prb0005Fixture.ts's in-memory provider, backed by the real generated
 * read-model JSON, instead of StaticDataProvider's fetch()).
 */
function Prb0005Details() {
  const indexState = useRecordIndex(prb0005DataProvider);
  const lookup = indexState.status === "ready" ? indexState.lookup : EMPTY_LOOKUP;
  const projectionState = useProblemProjection(prb0005DataProvider, lookup, indexState.status === "ready" ? "PRB-0005" : null);

  if (indexState.status === "loading" || projectionState.status === "loading" || projectionState.status === "idle") {
    return <ProgressMessage message="A carregar PRB-0005…" />;
  }
  if (indexState.status === "error") {
    return <ErrorNotice titleAs="h2" title="Não foi possível carregar os registos" message={indexState.error.message} />;
  }
  if (projectionState.status === "error") {
    return <ErrorNotice titleAs="h2" title="Não foi possível carregar o Problema" message={projectionState.error.message} />;
  }

  const data = buildPrbDetailsData(projectionState.projection);

  return <PrbDetailsPresentation data={data} onOpenGeneric={noop} onBackToOverview={noop} onViewHistory={noop} />;
}

/**
 * Full-page shell (ExplorerHeader + PrbDetailsPresentation + PublicFooter),
 * matching OverviewPresentation.stories.tsx's FullOverviewShell precedent —
 * a truthful full-page review surface, not the composition's body alone.
 */
function PrbDetailsShell() {
  return (
    <>
      <main className="explorer-shell">
        <ExplorerHeader activeView="problem" onProblemas={noop} onRegistos={noop} />
        <Prb0005Details />
      </main>
      <PublicFooter />
    </>
  );
}

export const Desktop1440: Story = {
  name: "1440 desktop",
  globals: { viewport: { value: "reviewDesktop" } },
  render: () => <PrbDetailsShell />,
};

export const Desktop1024Fit: Story = {
  name: "1024 desktop-fit",
  globals: { viewport: { value: "reviewDesktopFit" } },
  render: () => <PrbDetailsShell />,
};

export const Boundary768: Story = {
  name: "768 boundary",
  globals: { viewport: { value: "reviewBoundary" } },
  render: () => <PrbDetailsShell />,
};

export const Compact360: Story = {
  name: "360 compact",
  globals: { viewport: { value: "reviewCompact" } },
  render: () => <PrbDetailsShell />,
};
