import type { ReactNode } from "react";

/**
 * DS-04D Slice 2B — shared Generic UI established-empty-result presentation
 * (docs/design/component-model.md §4.3 "EmptyState"). Renders caller-owned
 * copy as ordinary content: no `role="alert"`, no automatic live region,
 * and no inference from missing, `UNKNOWN`, unavailable, or not-authored
 * canonical values (component-model.md §2.3, AGENTS.md "Evidence
 * integrity"). The caller alone has already established that a result or
 * collection is genuinely empty before rendering this; this component
 * performs no such judgement itself. The optional action is caller-owned
 * and rendered only when supplied — this phase adds no synthetic action
 * without a demonstrated current call site.
 */
export interface EmptyStateProps {
  /** The established-empty copy, exactly as supplied. */
  message: ReactNode;
  /** Optional caller-owned action (e.g. a native <a>/<button> using a ui-action-* recipe). */
  action?: ReactNode;
}

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="ui-empty-state">
      <p className="ui-empty-state-message">{message}</p>
      {action}
    </div>
  );
}
