import type { Meta, StoryObj } from "@storybook/react-vite";
import "../styles/reading-layout.css";
import "../index.css";
import "../styles/inline-label.css";
import "../styles/domain.css";
import "../styles/breadcrumb.css";
import "../styles/feedback.css";
import "../styles/empty-state.css";
import "../styles/fact-list.css";
import "../styles/logo.css";
import "../styles/topic.css";
import "../styles/information.css";
import "../styles/evd-detail.css";
import corpusIndex from "../../generated/index.json";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";
import { RecordDetailPanel } from "./RecordDetailPanel";
import { ExplorerHeader } from "../app/ExplorerHeader";
import { PublicFooter } from "../app/TrustPage";

const meta = { title: "Public/EVD Detail" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

/**
 * The generated read model (RE-01, verbatim) behind the same DataProvider
 * boundary production uses: the complete record index for lookups, and every
 * record-detail JSON loaded on demand — so the EVD, its Sources and the
 * Problems that use it resolve exactly as they do in the deployed Explorer.
 */
const recordDetails = import.meta.glob<RecordDetail>("../../generated/record-detail/*.json", { import: "default" });
const corpusProvider: DataProvider = {
  getManifest: async () => {
    throw new Error("EVD Detail story: getManifest is not used");
  },
  listRecords: async () => corpusIndex as RecordSummary[],
  getRecord: async (id: string) => {
    const load = recordDetails[`../../generated/record-detail/${id}.json`];
    if (!load) throw new Error(`EVD Detail story: unknown record ${id}`);
    return load();
  },
  getEdges: async () => [],
};
const lookup = new Map((corpusIndex as RecordSummary[]).map((summary) => [summary.id, summary]));

/** Full-page review surface: the real ExplorerHeader (Registos current) + production RecordDetailPanel + PublicFooter. */
function EvdDetailShell({ id }: { id: string }) {
  return (
    <>
      <main className="explorer-shell">
        <ExplorerHeader activeView="records" onProblemas={noop} onRegistos={noop} />
        <RecordDetailPanel dataProvider={corpusProvider} lookup={lookup} selectedId={id} onSelect={noop} onBackToRecords={noop} onViewAsProblem={noop} onViewInGraph={noop} />
      </main>
      <PublicFooter />
    </>
  );
}

export const EvdDetail1440: Story = {
  name: "EVD Detail — 1440",
  globals: { viewport: { value: "reviewDesktop" } },
  render: () => <EvdDetailShell id="EVD-000001" />,
};

export const EvdDetail1024: Story = {
  name: "EVD Detail — 1024",
  globals: { viewport: { value: "reviewDesktopFit" } },
  render: () => <EvdDetailShell id="EVD-000001" />,
};

export const EvdDetail768: Story = {
  name: "EVD Detail — 768",
  globals: { viewport: { value: "reviewBoundary" } },
  render: () => <EvdDetailShell id="EVD-000001" />,
};

export const EvdDetail360: Story = {
  name: "EVD Detail — 360",
  globals: { viewport: { value: "reviewCompact" } },
  render: () => <EvdDetailShell id="EVD-000001" />,
};

/* Non-happy-path review: several canonical Sources (EVD-000096) and several Problem uses (EVD-000012). */

export const MultipleSources1440: Story = {
  name: "EVD Detail — multiple sources — 1440",
  globals: { viewport: { value: "reviewDesktop" } },
  render: () => <EvdDetailShell id="EVD-000096" />,
};

export const MultipleUses360: Story = {
  name: "EVD Detail — multiple Problem uses — 360",
  globals: { viewport: { value: "reviewCompact" } },
  render: () => <EvdDetailShell id="EVD-000012" />,
};
