import { forwardRef, type ReactNode } from "react";

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
 *
 * DS-05F remediation (F1/F2): `titleAs` lets a caller preserve the exact
 * pre-migration heading level of its own error boundary (many were `h2`/`h3`
 * before adopting this shared component) without turning ErrorNotice into a
 * general polymorphic component — it is one bounded, explicitly named
 * choice, defaulting to the original plain-paragraph anatomy. The component
 * also forwards a ref to its `role="alert"` root (with an optional
 * `tabIndex`) so a caller that previously focused its own alert element
 * directly (ref + tabIndex={-1}) can keep doing so instead of wrapping
 * ErrorNotice in an extra neutral focusable `<div>`.
 */
export interface ErrorNoticeProps {
  /** Error heading, exactly as supplied — states the failure in words, not colour alone. */
  title: ReactNode;
  /** Error copy/detail, exactly as supplied. */
  message: ReactNode;
  /** Optional caller-owned action (e.g. a native <button> retry), rendered after the message. */
  action?: ReactNode;
  /** Heading level to preserve from the caller's pre-migration markup. Defaults to a plain paragraph. */
  titleAs?: "p" | "h2" | "h3";
  /** Forwarded to the `role="alert"` root so a caller can keep it as its own focus-entry target. */
  tabIndex?: number;
}

export const ErrorNotice = forwardRef<HTMLDivElement, ErrorNoticeProps>(function ErrorNotice(
  { title, message, action, titleAs: TitleTag = "p", tabIndex },
  ref
) {
  return (
    <div ref={ref} role="alert" tabIndex={tabIndex} className="ui-error-notice">
      <TitleTag className="ui-error-notice-title">{title}</TitleTag>
      <p className="ui-error-notice-message">{message}</p>
      {action}
    </div>
  );
});
