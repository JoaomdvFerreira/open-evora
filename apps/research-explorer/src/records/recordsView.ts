import {
  createTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type SortingState,
  type PaginationState,
  type TableOptionsResolved,
} from "@tanstack/table-core";
import type { RecordSummary } from "../dataProvider/types";
import { recordColumns } from "./columns";
import { filterRecords, type RecordsFilterState } from "./recordIndex";

export interface RecordsViewInput extends RecordsFilterState {
  records: RecordSummary[];
  sorting: SortingState;
  pagination: PaginationState;
}

export interface RecordsViewResult {
  /** The current page's rows, in final sorted order. */
  rows: RecordSummary[];
  pageCount: number;
  /** Count after search/type filtering, before pagination. */
  filteredCount: number;
}

/**
 * Pure, framework-agnostic computation of "what should the Records table
 * show right now" — search/type filtering (recordIndex.ts) followed by
 * TanStack Table's own real sorting + pagination row models (not a
 * hand-rolled reimplementation), built on @tanstack/table-core directly so
 * this is testable without React or a DOM. RecordsTable.tsx uses
 * @tanstack/react-table's useReactTable, which wraps the exact same engine,
 * for the interactive version of this same computation.
 */
export function computeRecordsView(input: RecordsViewInput): RecordsViewResult {
  const filtered = filterRecords(input.records, input);

  const options: TableOptionsResolved<RecordSummary> = {
    data: filtered,
    columns: recordColumns,
    state: { sorting: input.sorting, pagination: input.pagination },
    onStateChange: () => {},
    renderFallbackValue: null,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  };

  const table = createTable(options);
  const rows = table.getRowModel().rows.map((row) => row.original);

  return {
    rows,
    pageCount: table.getPageCount(),
    filteredCount: filtered.length,
  };
}

export type PaginationItem = { kind: "page"; pageIndex: number } | { kind: "gap"; afterPageIndex: number };

/**
 * The page-number sequence for the wide Records pagination: first and last
 * page, the current page with its immediate neighbours (widened to three
 * pages at either end), and a gap marker wherever pages are skipped — e.g.
 * page 1 of 5 -> 1 2 3 … 5. Zero-based indices in, zero-based out.
 */
export function paginationItems(pageIndex: number, pageCount: number): PaginationItem[] {
  if (pageCount <= 0) return [];
  const last = pageCount - 1;
  const current = Math.min(Math.max(pageIndex, 0), last);
  const wanted = new Set([0, last, current - 1, current, current + 1]);
  if (current <= 1) [1, 2].forEach((index) => wanted.add(index));
  if (current >= last - 1) [last - 1, last - 2].forEach((index) => wanted.add(index));
  const pages = [...wanted].filter((index) => index >= 0 && index <= last).sort((a, b) => a - b);

  const items: PaginationItem[] = [];
  pages.forEach((index, position) => {
    const previous = pages[position - 1];
    if (previous !== undefined && index - previous > 1) items.push({ kind: "gap", afterPageIndex: previous });
    items.push({ kind: "page", pageIndex: index });
  });
  return items;
}
