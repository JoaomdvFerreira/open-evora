import { useEffect, useMemo, useRef } from "react";
import { getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import type { RecordSummary } from "../dataProvider/types";
import { recordColumns } from "./columns";
import { ALL_TYPES, availableRecordTypes, filterRecords } from "./recordIndex";
import type { RecordsControllerAction, RecordsControllerState } from "./recordsController";
import { paginationItems } from "./recordsView";
import { describeType, isKnownTypePrefix } from "../presentation/typeGlossary";
import { useNarrowViewport } from "./useNarrowViewport";
import { formatPublicCount } from "../presentation/presentation";
import { EmptyState } from "../presentation/EmptyState";
import { IconSearch } from "../presentation/icons";

interface RecordsTableProps {
  records: RecordSummary[];
  onSelect: (id: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  typeFilter: string;
  onTypeFilterChange: (typeFilter: string) => void;
  /**
   * ODM-015: sort/page state, owned by the caller (RecordsExplorer) rather
   * than locally here, so it survives this component unmounting when the
   * caller swaps to RecordDetailPanel and back.
   */
  controllerState: RecordsControllerState;
  dispatchController: (action: RecordsControllerAction) => void;
}

/**
 * The public filters promote the three canonical types first, in this
 * order; any other type present in the loaded index still gets its own
 * filter after them (alphabetically), so the list stays generic.
 */
const PROMOTED_TYPES = ["PRB-", "SRC-", "EVD-"];

function orderedTypes(types: string[]): string[] {
  const promoted = PROMOTED_TYPES.filter((type) => types.includes(type));
  return [...promoted, ...types.filter((type) => !PROMOTED_TYPES.includes(type))];
}

/** Lower-case result noun for the active filter, e.g. "fontes" / "1 fonte"; "registos" for Todos or an unglossed type. */
function resultNoun(typeFilter: string, count: number): string {
  if (typeFilter === ALL_TYPES || !isKnownTypePrefix(typeFilter)) return count === 1 ? "registo" : "registos";
  const { label, pluralLabel } = describeType(typeFilter);
  return (count === 1 ? label : pluralLabel).toLocaleLowerCase("pt-PT");
}

function searchPlaceholder(typeFilter: string, isNarrow: boolean): string {
  if (isNarrow) return "ID ou título";
  if (typeFilter === ALL_TYPES || !isKnownTypePrefix(typeFilter)) return "Pesquisar por ID ou título";
  return `Pesquisar ${describeType(typeFilter).pluralLabel.toLocaleLowerCase("pt-PT")} por ID ou título`;
}

/**
 * Presentation-only typographic split of a record label at its first em
 * dash: the part before reads as the primary title, the rest as muted
 * secondary text. The canonical label is rendered in full and unchanged —
 * nothing is persisted, re-labelled, or given new meaning.
 */
function RecordTitle({ label }: { label: string }) {
  const dash = label.indexOf(" — ");
  if (dash === -1) return <span className="records-row-title-primary">{label}</span>;
  return (
    <>
      <span className="records-row-title-primary">{label.slice(0, dash)}</span>
      <span className="records-row-title-secondary">{label.slice(dash)}</span>
    </>
  );
}

function SortDirection({ desc }: { desc: boolean }) {
  return (
    <>
      <span className="records-sort-arrow" aria-hidden="true">{desc ? "↓" : "↑"}</span>
      <span className="records-visually-hidden">, ordem {desc ? "decrescente" : "crescente"}</span>
    </>
  );
}

/**
 * The public Records landing: page intro, per-type filter strip with
 * derived counts, contextual search, the ID/Título record list and
 * responsive pagination. `query`/`typeFilter` are controlled by the caller
 * (URL-synced, RE-02C); sorting/pagination (recordsController) are owned by
 * the caller (RecordsExplorer, ODM-015) so they survive this component
 * unmounting when the caller swaps to Record Detail and back.
 * Filtered/sorted/paginated data and filter counts are always derived from
 * the loaded index, never stored redundantly.
 *
 * One DOM serves every width: the column header row, the compact result
 * toolbar and the three pagination summaries are switched by records.css at
 * the 1024/768 boundaries; only the search placeholder needs the JS
 * compact signal.
 */
export function RecordsTable({
  records,
  onSelect,
  query,
  onQueryChange,
  typeFilter,
  onTypeFilterChange,
  controllerState: state,
  dispatchController: dispatch,
}: RecordsTableProps) {
  const isNarrow = useNarrowViewport();
  const filterStripRef = useRef<HTMLDivElement>(null);

  const types = useMemo(() => orderedTypes(availableRecordTypes(records)), [records]);
  // A type filter value that no longer exists in the loaded data (e.g. a
  // stale/invalid URL) degrades safely to "all", rather than filtering to an
  // empty set.
  const effectiveTypeFilter = typeFilter === ALL_TYPES || types.includes(typeFilter) ? typeFilter : ALL_TYPES;

  // Counts follow the active search, so each filter says how many results
  // selecting it would show.
  const queryMatches = useMemo(() => filterRecords(records, { query, typeFilter: ALL_TYPES }), [records, query]);
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of queryMatches) counts.set(record.type, (counts.get(record.type) ?? 0) + 1);
    return counts;
  }, [queryMatches]);
  const filtered = useMemo(
    () => (effectiveTypeFilter === ALL_TYPES ? queryMatches : queryMatches.filter((record) => record.type === effectiveTypeFilter)),
    [queryMatches, effectiveTypeFilter]
  );

  const table = useReactTable({
    data: filtered,
    columns: recordColumns,
    state: { sorting: state.sorting, pagination: state.pagination },
    enableSortingRemoval: false,
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(state.sorting) : updater;
      dispatch({ type: "SET_SORTING", sorting: next });
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater(state.pagination) : updater;
      dispatch({ type: "SET_PAGE_INDEX", pageIndex: next.pageIndex });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Keep the selected filter visible inside the horizontally scrolling
  // compact strip. Only the strip scrolls — never the page.
  useEffect(() => {
    const strip = filterStripRef.current;
    const active = strip?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!strip || !active) return;
    const start = active.offsetLeft;
    const end = start + active.offsetWidth;
    if (start < strip.scrollLeft || end > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = Math.max(0, start - (strip.clientWidth - active.offsetWidth) / 2);
    }
  }, [effectiveTypeFilter]);

  const count = filtered.length;
  const noun = resultNoun(effectiveTypeFilter, count);
  const countText = `${formatPublicCount(count)} ${noun}`;
  const { pageIndex, pageSize } = state.pagination;
  const pageCount = Math.max(table.getPageCount(), 1);
  const rangeStart = count === 0 ? 0 : pageIndex * pageSize + 1;
  const rangeEnd = Math.min((pageIndex + 1) * pageSize, count);
  const activeSort = state.sorting[0] ?? { id: "id", desc: false };
  const activeSortLabel = activeSort.id === "label" ? "Título" : "ID";

  const filterOptions = [
    { value: ALL_TYPES, label: "Todos", count: queryMatches.length },
    ...types.map((type) => ({ value: type, label: describeType(type).pluralLabel, count: typeCounts.get(type) ?? 0 })),
  ];

  return (
    <section aria-labelledby="records-heading" className="records-page">
      <div className="records-page-frame shell-frame shell-frame--wide">
        <header className="records-intro">
          <p className="records-eyebrow">Corpus de investigação</p>
          <h2 id="records-heading" className="records-title">Registos</h2>
          <p className="records-lede">
            Problemas, fontes e evidências que compõem a investigação. Cada registo tem um identificador estável para citação.
          </p>
        </header>

        <div className="records-filter-bar">
          <div ref={filterStripRef} className="records-type-filters" role="group" aria-label="Tipo de registo">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className="records-type-filter"
                aria-pressed={option.value === effectiveTypeFilter}
                onClick={() => onTypeFilterChange(option.value)}
              >
                {option.label}{" "}
                <span className="records-type-filter-count">{formatPublicCount(option.count)}</span>
              </button>
            ))}
          </div>

          <div className="records-search" role="search">
            <label htmlFor="records-search" className="records-visually-hidden">Pesquisar</label>
            <span className="records-search-field">
              <IconSearch className="records-search-icon" />
              <input
                id="records-search"
                className="records-search-input"
                type="search"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder={searchPlaceholder(effectiveTypeFilter, isNarrow)}
              />
            </span>
          </div>
        </div>

        <p className="records-visually-hidden" aria-live="polite">{countText}</p>

        {count === 0 ? (
          <div className="records-empty">
            <EmptyState message="Nenhum resultado." />
          </div>
        ) : (
          <>
            <div className="records-compact-toolbar">
              <p className="records-compact-count">{countText}</p>
              <button
                type="button"
                className="records-compact-sort"
                onClick={() => dispatch({ type: "SET_SORTING", sorting: [{ id: activeSort.id, desc: !activeSort.desc }] })}
              >
                Ordenar: {activeSortLabel} <SortDirection desc={activeSort.desc} />
              </button>
            </div>

            <div className="records-list-head">
              {table.getHeaderGroups()[0].headers.map((header) => {
                const sortState = header.column.getIsSorted();
                return (
                  <button
                    key={header.id}
                    type="button"
                    className={`records-sort records-sort--${header.id}`}
                    aria-pressed={sortState !== false}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {String(header.column.columnDef.header)}
                    {sortState !== false && <SortDirection desc={sortState === "desc"} />}
                  </button>
                );
              })}
            </div>

            <ul className="records-list" aria-label="Registos">
              {table.getRowModel().rows.map(({ original: record }) => (
                <li key={record.id}>
                  <button type="button" className="records-row" onClick={() => onSelect(record.id)}>
                    <span className="records-row-id">{record.id}</span>
                    <span className="records-row-title">{record.label !== record.id && <RecordTitle label={record.label} />}</span>
                    <span className="records-row-arrow" aria-hidden="true">→</span>
                  </button>
                </li>
              ))}
            </ul>

            <nav className="records-pagination" aria-label="Paginação dos registos" data-first-page={pageIndex === 0 ? "" : undefined}>
              <p className="records-pagination-range">
                {formatPublicCount(rangeStart)}–{formatPublicCount(rangeEnd)} de {countText}
              </p>
              {pageCount > 1 && (
                <button type="button" className="records-pagination-step records-pagination-step--previous" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                  <span aria-hidden="true">← </span>Anterior
                </button>
              )}
              <p className="records-pagination-status">
                <span className="records-pagination-status-full">
                  Página {pageIndex + 1} de {pageCount} · {countText}
                </span>
                <span className="records-pagination-status-short">
                  {pageIndex + 1} / {pageCount}
                </span>
              </p>
              {pageCount > 1 && (
                <ol className="records-pagination-pages">
                  {paginationItems(pageIndex, pageCount).map((item) =>
                    item.kind === "gap" ? (
                      <li key={`gap-${item.afterPageIndex}`} className="records-pagination-gap" aria-hidden="true">…</li>
                    ) : (
                      <li key={item.pageIndex}>
                        <button
                          type="button"
                          className="records-pagination-page"
                          aria-label={`Página ${item.pageIndex + 1}`}
                          aria-current={item.pageIndex === pageIndex ? "page" : undefined}
                          onClick={() => table.setPageIndex(item.pageIndex)}
                        >
                          {item.pageIndex + 1}
                        </button>
                      </li>
                    )
                  )}
                </ol>
              )}
              {pageCount > 1 && (
                <button type="button" className="records-pagination-step records-pagination-step--next" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                  Seguinte<span aria-hidden="true"> →</span>
                </button>
              )}
            </nav>
          </>
        )}
      </div>
    </section>
  );
}
