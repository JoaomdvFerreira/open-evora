import type { PaginationState, SortingState } from "@tanstack/table-core";

export const DEFAULT_PAGE_SIZE = 25;

/**
 * Table-local "source" state — sorting and pagination only. `query` and
 * `typeFilter` moved to URL-synced state owned by useExplorerUrlState
 * (RE-02C) since they must be bookmarkable/shareable; this reducer only
 * owns what stays local to the Records table itself. Filtered/sorted/
 * paginated *data* is always derived (recordIndex.filterRecords + TanStack's
 * own row models), never stored redundantly alongside this.
 */
export interface RecordsControllerState {
  sorting: SortingState;
  pagination: PaginationState;
}

export type RecordsControllerAction =
  | { type: "SET_SORTING"; sorting: SortingState }
  | { type: "SET_PAGE_INDEX"; pageIndex: number }
  | { type: "RESET_PAGE" };

/** Records open sorted by canonical ID, ascending. */
export const initialRecordsControllerState: RecordsControllerState = {
  sorting: [{ id: "id", desc: false }],
  pagination: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
};

/**
 * A query or type-filter change (owned by the caller, outside this reducer)
 * alters set membership, so the current page position is no longer
 * meaningful — the caller dispatches RESET_PAGE when that happens. Sorting
 * only reorders the existing result set, so it never triggers a page reset.
 */
export function recordsControllerReducer(
  state: RecordsControllerState,
  action: RecordsControllerAction
): RecordsControllerState {
  switch (action.type) {
    case "SET_SORTING":
      return { ...state, sorting: action.sorting };
    case "SET_PAGE_INDEX":
      return { ...state, pagination: { ...state.pagination, pageIndex: action.pageIndex } };
    case "RESET_PAGE":
      return { ...state, pagination: { ...state.pagination, pageIndex: 0 } };
    default:
      return state;
  }
}
