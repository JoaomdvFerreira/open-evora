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
import "../styles/src-detail.css";
import corpusIndex from "../../generated/index.json";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";
import { RecordDetailPanel } from "./RecordDetailPanel";
import { ExplorerHeader } from "../app/ExplorerHeader";
import { PublicFooter } from "../app/TrustPage";

const meta = { title: "Public/SRC Detail" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

/**
 * The generated read model (RE-01, verbatim) behind the same DataProvider
 * boundary production uses: the complete record index for lookups, and every
 * record-detail JSON loaded on demand — so the Source, the Evidence citing
 * it and the Problems that use them resolve exactly as they do in the deployed Explorer.
 */
const recordDetails = import.meta.glob<RecordDetail>("../../generated/record-detail/*.json", { import: "default" });
const corpusProvider: DataProvider = {
  getManifest: async () => {
    throw new Error("SRC Detail story: getManifest is not used");
  },
  listRecords: async () => corpusIndex as RecordSummary[],
  getRecord: async (id: string) => {
    const load = recordDetails[`../../generated/record-detail/${id}.json`];
    if (!load) throw new Error(`SRC Detail story: unknown record ${id}`);
    return load();
  },
  getEdges: async () => [],
};
const lookup = new Map((corpusIndex as RecordSummary[]).map((summary) => [summary.id, summary]));

/** Full-page review surface: the real ExplorerHeader (Registos current) + production RecordDetailPanel + PublicFooter. */
function SrcDetailShell({ id }: { id: string }) {
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

export const SrcDetail1440: Story = {
  name: "SRC Detail — 1440",
  globals: { viewport: { value: "reviewDesktop" } },
  render: () => <SrcDetailShell id="SRC-0002" />,
};

export const SrcDetail1024: Story = {
  name: "SRC Detail — 1024",
  globals: { viewport: { value: "reviewDesktopFit" } },
  render: () => <SrcDetailShell id="SRC-0002" />,
};

export const SrcDetail768: Story = {
  name: "SRC Detail — 768",
  globals: { viewport: { value: "reviewBoundary" } },
  render: () => <SrcDetailShell id="SRC-0002" />,
};

export const SrcDetail360: Story = {
  name: "SRC Detail — 360",
  globals: { viewport: { value: "reviewCompact" } },
  render: () => <SrcDetailShell id="SRC-0002" />,
};

/* Non-happy-path review: known licence (SRC-0093), private correspondence without a reference (SRC-0130), no citing Evidence (SRC-0027). */

export const KnownLicence1440: Story = {
  name: "SRC Detail — known licence — 1440",
  globals: { viewport: { value: "reviewDesktop" } },
  render: () => <SrcDetailShell id="SRC-0093" />,
};

export const PrivateCorrespondence360: Story = {
  name: "SRC Detail — private correspondence — 360",
  globals: { viewport: { value: "reviewCompact" } },
  render: () => <SrcDetailShell id="SRC-0130" />,
};

export const NoEvidence768: Story = {
  name: "SRC Detail — no citing Evidence — 768",
  globals: { viewport: { value: "reviewBoundary" } },
  render: () => <SrcDetailShell id="SRC-0027" />,
};
