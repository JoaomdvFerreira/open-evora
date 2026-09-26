import { createColumnHelper } from "@tanstack/table-core";
import type { RecordSummary } from "../dataProvider/types";

/**
 * Framework-agnostic column definitions (built on @tanstack/table-core, the
 * same underlying engine @tanstack/react-table wraps) — importable both by
 * the React table component and by plain-Node tests of the records view
 * logic, with no JSX/React dependency here.
 *
 * Deliberately generic: only the universal sortable fields the public
 * Records list presents (canonical ID and human-readable label). No
 * SRC-/EVD-/PRB- specific columns — a future schema-conforming record type
 * renders through these same columns with no change here. Record type is
 * already carried by the active filter and the ID prefix; the provenance
 * file path stays in Record Detail.
 */
const columnHelper = createColumnHelper<RecordSummary>();

export const recordColumns = [
  columnHelper.accessor("id", { id: "id", header: "ID" }),
  columnHelper.accessor("label", { id: "label", header: "Título" }),
];
