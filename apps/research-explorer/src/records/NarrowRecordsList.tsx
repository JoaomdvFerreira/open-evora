import type { RecordSummary } from "../dataProvider/types";
import { RecordTypeLabel } from "./RecordTypeLabel";
import { RecordIdentifier } from "./RecordIdentifier";

interface NarrowRecordsListProps {
  /** Already filtered, sorted, and paginated — the same rows the desktop table would render for this page, never a second data pipeline. */
  records: RecordSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * REDUX-005's narrow adaptation: a single-column record list instead of the
 * desktop 4-column table reflowed. Generic over any schema-conforming record
 * type — reads only `id`/`type`/`label`, already present on every
 * `RecordSummary` regardless of type, so an unrecognised future type renders
 * exactly like any other, no per-type branch. File path is deliberately
 * omitted here (it stays reachable in Detail, unchanged); the human-readable
 * label is the primary scanning line, the canonical ID a secondary line —
 * except where the read model's own label already equals the ID (a record
 * with no better human-readable field), in which case the ID line is not
 * repeated a second time.
 */
export function NarrowRecordsList({ records, selectedId, onSelect }: NarrowRecordsListProps) {
  return (
    <ul className="narrow-records-list" aria-label="Registos">
      {records.map((record) => {
        const isSelected = record.id === selectedId;
        const hasDistinctLabel = record.label !== record.id;
        return (
          <li key={record.id}>
            <button type="button" className="narrow-record-row" aria-pressed={isSelected} onClick={() => onSelect(record.id)}>
              <span className="narrow-record-type">
                <RecordTypeLabel prefix={record.type} variant="compact" />
              </span>
              <span className="narrow-record-text">
                <span className="narrow-record-label">
                  {isSelected ? "● " : ""}
                  {record.label}
                </span>
                {hasDistinctLabel && (
                  <span className="narrow-record-id">
                    <RecordIdentifier variant="text" id={record.id} density="compact" />
                  </span>
                )}
              </span>
              <span className="narrow-record-chevron" aria-hidden="true">
                ›
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
