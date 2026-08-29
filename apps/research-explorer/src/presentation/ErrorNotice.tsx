import type { ReactNode } from "react";

/**
 * DS-04D Slice 2B — shared Generic UI error/alert feedback boundary
 * (docs/design/component-model.md §4.3 "ErrorNotice"). Renders the
 * caller-owned title and copy inside a `role="alert"` boundary, matching the
 * current repeated error branches (e.g. `apps/research-explorer/src/app/
 * App.tsx`, `RecordDetailPanel.tsx`, `ProblemView.tsx`), with an optional
 * caller-owned action node rendered after the message. This is the only
 * feedback family approved to use the error/red hue
 * (`--color-feedback-error-ink/-line/-surface`); the colour never carries
 * the meaning alone — the heading/copy state the error explicitly in text.
 * It never absorbs loading (`ProgressMessage`) or established-empty
 * (`EmptyState`) presentation. `action` is entirely caller-owned: this
 * component positions it but never constructs it, infers its label, or
 * decides what element/behaviour it uses (component-model.md §4.3 "Error
 * title, copy, and retry action remain caller-owned").
 */
export interface ErrorNoticeProps {
  /** Error heading, exactly as supplied — states the failure in words, not colour alone. */
  title: ReactNode;
  /** Error copy/detail, exactly as supplied. */
  message: ReactNode;
  /** Optional caller-owned action (e.g. a native <button> retry), rendered after the message. */
  action?: ReactNode;
}

export function ErrorNotice({ title, message, action }: ErrorNoticeProps) {
  return (
    <div role="alert" className="ui-error-notice">
      <p className="ui-error-notice-title">{title}</p>
      <p className="ui-error-notice-message">{message}</p>
      {action}
    </div>
  );
}
