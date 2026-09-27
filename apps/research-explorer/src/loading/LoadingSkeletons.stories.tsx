import type { Meta, StoryObj } from "@storybook/react-vite";
import "../index.css";
import "../styles/feedback.css";
import "../styles/records.css";
import "../styles/prb-details.css";
import "../styles/prb-history.css";
import "../styles/evd-detail.css";
import "../styles/src-detail.css";
import "../styles/skeleton.css";
import {
  EvdDetailSkeleton,
  GenericRecordDetailSkeleton,
  GraphSkeleton,
  OverviewSkeleton,
  PrbDetailsSkeleton,
  PrbHistorySkeleton,
  RecordsSkeleton,
  SrcDetailSkeleton,
} from "./LoadingSkeletons";

const meta = {
  title: "Public/Loading Skeletons",
  parameters: { viewport: { defaultViewport: "reviewDesktop" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = { name: "Overview", render: () => <OverviewSkeleton /> };
export const Records: Story = { name: "Records", render: () => <RecordsSkeleton /> };
export const PrbDetails: Story = { name: "PRB Details", render: () => <PrbDetailsSkeleton /> };
export const PrbHistory: Story = { name: "PRB History", render: () => <PrbHistorySkeleton /> };
export const EvdDetail: Story = { name: "EVD Detail", render: () => <EvdDetailSkeleton /> };
export const SrcDetail: Story = { name: "SRC Detail", render: () => <SrcDetailSkeleton /> };
export const GenericRecordDetail: Story = { name: "Generic Record Detail", render: () => <GenericRecordDetailSkeleton /> };
export const Graph: Story = { name: "Graph", render: () => <GraphSkeleton /> };
