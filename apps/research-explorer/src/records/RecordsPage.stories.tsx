import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import "../index.css";
import "../styles/feedback.css";
import "../styles/empty-state.css";
import "../styles/records.css";
import "../styles/logo.css";
import corpusIndex from "../../generated/index.json";
import type { DataProvider, RecordSummary } from "../dataProvider/types";
import { RecordsExplorer } from "./RecordsExplorer";
import { ALL_TYPES } from "./recordIndex";
import { ExplorerHeader } from "../app/ExplorerHeader";
import { PublicFooter } from "../app/TrustPage";

const meta = { title: "Public/Registos" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

/**
 * The complete generated corpus index (RE-01 read model, verbatim) behind
 * the same DataProvider boundary production uses — so filter counts,
 * labels and pagination are the real corpus's. Record Detail is out of
 * scope for this review surface: selecting a row is a no-op.
 */
const corpusProvider: DataProvider = {
  getManifest: async () => {
    throw new Error("RecordsPage story: getManifest is not used");
  },
  listRecords: async () => corpusIndex as RecordSummary[],
  getRecord: async (id: string) => {
    throw new Error(`RecordsPage story: Record Detail is not part of this review surface (${id})`);
  },
  getEdges: async () => [],
};

/**
 * Full-page review surface for the public Records landing: the real
 * ExplorerHeader + RecordsExplorer + PublicFooter shell. Search and type
 * filter are held in local state here in place of the production URL
 * state, so the filters and search stay interactive.
 */
function RecordsShell({ initialTypeFilter }: { initialTypeFilter: string }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState(initialTypeFilter);
  return (
    <>
      <main className="explorer-shell">
        <ExplorerHeader activeView="records" onProblemas={noop} onRegistos={() => { setQuery(""); setTypeFilter(ALL_TYPES); }} />
        <RecordsExplorer
          dataProvider={corpusProvider}
          selectedId={null}
          onSelect={noop}
          query={query}
          onQueryChange={setQuery}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          onViewAsProblem={noop}
          onViewInGraph={noop}
          onBackToRecords={noop}
        />
      </main>
      <PublicFooter />
    </>
  );
}

/* Representative approved-target state: Records filtered to Fontes. */

export const Fontes1440: Story = {
  name: "Fontes — 1440 desktop",
  globals: { viewport: { value: "reviewDesktop" } },
  render: () => <RecordsShell initialTypeFilter="SRC-" />,
};

export const Fontes1024: Story = {
  name: "Fontes — 1024 desktop-fit",
  globals: { viewport: { value: "reviewDesktopFit" } },
  render: () => <RecordsShell initialTypeFilter="SRC-" />,
};

export const Fontes768: Story = {
  name: "Fontes — 768 boundary",
  globals: { viewport: { value: "reviewBoundary" } },
  render: () => <RecordsShell initialTypeFilter="SRC-" />,
};

export const Fontes360: Story = {
  name: "Fontes — 360 compact",
  globals: { viewport: { value: "reviewCompact" } },
  render: () => <RecordsShell initialTypeFilter="SRC-" />,
};

/* Header "Registos" landing state: Todos, no type filter. */

export const Todos1440: Story = {
  name: "Todos — 1440 desktop",
  globals: { viewport: { value: "reviewDesktop" } },
  render: () => <RecordsShell initialTypeFilter={ALL_TYPES} />,
};

export const Todos360: Story = {
  name: "Todos — 360 compact",
  globals: { viewport: { value: "reviewCompact" } },
  render: () => <RecordsShell initialTypeFilter={ALL_TYPES} />,
};
