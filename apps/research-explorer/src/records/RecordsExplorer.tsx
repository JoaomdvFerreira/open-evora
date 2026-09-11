import { useEffect, useReducer, useRef } from "react";
import type { DataProvider } from "../dataProvider/types";
import { useRecordIndex } from "./useRecordIndex";
import { RecordsTable } from "./RecordsTable";
import { RecordDetailPanel } from "./RecordDetailPanel";
import { ProgressMessage } from "../presentation/ProgressMessage";
import { ErrorNotice } from "../presentation/ErrorNotice";
import { initialRecordsControllerState, recordsControllerReducer } from "./recordsController";

const ERROR_TITLES: Record<string, string> = {
  missing: "Modelo de leitura gerado não encontrado",
  malformed: "Índice de registos mal formado",
  incompatible: "Versão do modelo de leitura incompatível",
  network: "Falha ao carregar os registos",
};

interface RecordsExplorerProps {
  dataProvider: DataProvider;
  selectedId: string | null;
  onSelect: (id: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  typeFilter: string;
  onTypeFilterChange: (typeFilter: string) => void;
  /** RE-03: switches to the specialised Problem view for a PRB-* record, keeping the same ID. */
  onViewAsProblem: (id: string) => void;
  /** RE-04: switches to the Graph view, focused on the same record. */
  onViewInGraph: (id: string) => void;
  onViewHistory: (id: string) => void;
  /** V2: breadcrumb "Registos" link — clears the selection, returning to the table. */
  onBackToRecords: () => void;
}

/**
 * The RE-02B/RE-02C primary workflow: Registos (search/select, URL-synced)
 * -> lazy-loaded generic detail -> relationships -> navigation to a related
 * record — all through the DataProvider boundary. V2 (Research Explorer
 * Record Detail): selecting a record is a full-page reading composition
 * (approved Prototype A), not a persistent table+panel split — the table
 * and the detail are mutually exclusive for a given `selectedId`, and the
 * breadcrumb's "Registos" link is the way back, matching Prototype A's
 * "Registos › EVD-000127" breadcrumb. Selection/query/type-filter are
 * controlled by the caller (useExplorerUrlState) so they are bookmarkable.
 */
export function RecordsExplorer({
  dataProvider,
  selectedId,
  onSelect,
  query,
  onQueryChange,
  typeFilter,
  onTypeFilterChange,
  onViewAsProblem,
  onViewInGraph,
  onViewHistory,
  onBackToRecords,
}: RecordsExplorerProps) {
  const indexState = useRecordIndex(dataProvider);
  // ODM-015: owned here, not inside RecordsTable, so sort/page survive the
  // Records -> Detail -> Records cycle — RecordsTable/RecordDetailPanel are
  // mutually exclusive below (see the V2 comment above), so a reducer local
  // to RecordsTable would remount and reset on every return to Records.
  const [recordsControllerState, dispatchRecordsController] = useReducer(recordsControllerReducer, initialRecordsControllerState);

  // ODM-015: query/type-filter changes alter set membership, so the current
  // page position is no longer meaningful — reset it. Owned here (not inside
  // RecordsTable, which remounts across the Records <-> Detail cycle) so a
  // return to Records is never mistaken for a query/type-filter change; the
  // skip-first-run guard means mounting this component for the first time
  // does not itself dispatch a reset.
  const skipNextReset = useRef(true);
  useEffect(() => {
    if (skipNextReset.current) {
      skipNextReset.current = false;
      return;
    }
    dispatchRecordsController({ type: "RESET_PAGE" });
  }, [query, typeFilter]);

  if (indexState.status === "loading") {
    return <ProgressMessage message="A carregar registos…" />;
  }

  if (indexState.status === "error") {
    return (
      <ErrorNotice
        titleAs="h2"
        title={ERROR_TITLES[indexState.error.kind] ?? "Não foi possível carregar os registos"}
        message={indexState.error.message}
        action={
          <button type="button" onClick={indexState.retry}>
            Tentar novamente
          </button>
        }
      />
    );
  }

  if (selectedId !== null) {
    return (
      <RecordDetailPanel
        dataProvider={dataProvider}
        lookup={indexState.lookup}
        selectedId={selectedId}
        onSelect={onSelect}
        onBackToRecords={onBackToRecords}
        onViewAsProblem={onViewAsProblem}
        onViewHistory={onViewHistory}
        onViewInGraph={onViewInGraph}
      />
    );
  }

  return (
    <div className="records-explorer shell-frame">
      <RecordsTable
        records={indexState.records}
        selectedId={selectedId}
        onSelect={onSelect}
        query={query}
        onQueryChange={onQueryChange}
        typeFilter={typeFilter}
        onTypeFilterChange={onTypeFilterChange}
        controllerState={recordsControllerState}
        dispatchController={dispatchRecordsController}
      />
    </div>
  );
}
