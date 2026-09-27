import type { CSSProperties } from "react";

export interface SkeletonProps {
  className?: string;
  width?: CSSProperties["width"];
}

/** Decorative placeholder only. Loading meaning remains owned by ProgressMessage. */
export function Skeleton({ className, width }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={className ? `ui-skeleton ${className}` : "ui-skeleton"}
      style={width ? { width } : undefined}
    />
  );
}
