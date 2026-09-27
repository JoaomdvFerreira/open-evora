import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "../presentation/Skeleton";
import {
  AppSkeleton,
  GraphSkeleton,
  OverviewSkeleton,
  PrbDetailsSkeleton,
  PrbHistorySkeleton,
  RecordDetailSkeleton,
  RecordsSkeleton,
} from "./LoadingSkeletons";

describe("layout-preserving loading skeletons", () => {
  it("hides generic placeholder shapes from assistive technology", () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelector(".ui-skeleton")?.getAttribute("aria-hidden")).toBe("true");
  });

  it.each([
    ["app", <AppSkeleton />, "app-skeleton"],
    ["overview", <OverviewSkeleton />, "overview-skeleton"],
    ["records", <RecordsSkeleton />, "records-skeleton"],
    ["PRB details", <PrbDetailsSkeleton />, "prb-details-skeleton"],
    ["PRB history", <PrbHistorySkeleton />, "prb-history-skeleton"],
    ["graph", <GraphSkeleton />, "graph-skeleton"],
  ])("renders the %s composition with one semantic loading status", (_name, composition, testId) => {
    render(composition);
    expect(screen.getByTestId(testId)).toBeTruthy();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it.each([
    ["EVD-000001", "evd-detail-skeleton"],
    ["SRC-0001", "src-detail-skeleton"],
    ["PRB-0001", "generic-detail-skeleton"],
    ["OTHER-1", "generic-detail-skeleton"],
  ])("selects the intended record-detail composition for %s", (id, testId) => {
    render(<RecordDetailSkeleton id={id} />);
    expect(screen.getByTestId(testId)).toBeTruthy();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});
