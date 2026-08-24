import { createColumnHelper } from "@tanstack/table-core";
import type { RecordSummary } from "../dataProvider/types";

/**
 * Framework-agnostic column definitions (built on @tanstack/table-core, the
 * same underlying engine @tanstack/react-table wraps) — importable both by
 * the React table component and by plain-Node tests of the records view
 * logic, with no JSX/React dependency here.
 *
 * Deliberately generic: only universal fields (ID, Type, Label, provenance
 * file path). No SRC-/EVD-/PRB- specific columns — a future
 * schema-conforming record type renders through these same four columns
 * with no change here.
 */
const columnHelper = createColumnHelper<RecordSummary>();

export const recordColumns = [
  columnHelper.accessor("id", { id: "id", header: "ID" }),
  columnHelper.accessor("type", { id: "type", header: "Tipo" }),
  columnHelper.accessor("label", { id: "label", header: "Rótulo" }),
  columnHelper.accessor("file", { id: "file", header: "Ficheiro" }),
];
