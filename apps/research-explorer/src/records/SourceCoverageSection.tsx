import { extractSourceCoverage, type SourceCoverage } from "./sourceView";
import { publicEnumLabel, formatPublicPartialDate } from "../presentation/presentation";
import { SOURCE_SECTION_ANCHOR_IDS } from "./sourceSectionIndex";
import { FactList } from "../presentation/FactList";

interface CoverageRow {
  label: string;
  field: string;
  value: string;
}

/**
 * SUI-03D1: SRC-owned scope facts only (`extractSourceCoverage`) — describes
 * what the Source canonically covers, never an evidential interpretation.
 * Temporal coverage renders through `formatPublicPartialDate` exclusively —
 * it preserves the canonical field's own precision (YYYY / YYYY-MM /
 * YYYY-MM-DD) and must never be confused with publication/update recency,
 * which belongs to "Datas e acesso" instead.
 */
function buildCoverageRows(coverage: SourceCoverage): CoverageRow[] {
  const rows: CoverageRow[] = [];

  if (coverage.geographyLevel) {
    rows.push({ label: "Âmbito geográfico", field: "scope.geography.level", value: publicEnumLabel("scope.geography.level", coverage.geographyLevel) });
  }

  if (coverage.geographyArea) {
    rows.push({ label: "Área", field: "scope.geography.area", value: coverage.geographyArea });
  }

  if (coverage.temporal) {
    if (coverage.temporal.kind === "as_of") {
      rows.push({ label: "Data de referência", field: "scope.temporal.as_of", value: formatPublicPartialDate(coverage.temporal.asOf) });
    } else {
      rows.push({ label: "Início", field: "scope.temporal.start", value: formatPublicPartialDate(coverage.temporal.start) });
      rows.push({ label: "Fim", field: "scope.temporal.end", value: formatPublicPartialDate(coverage.temporal.end) });
    }
  }

  if (coverage.domains && coverage.domains.length > 0) {
    rows.push({ label: "Temas", field: "scope.domains", value: coverage.domains.join(", ") });
  }

  return rows;
}

export function SourceCoverageSection({ record }: { record: Record<string, unknown> }) {
  const coverage = extractSourceCoverage(record);
  const rows = buildCoverageRows(coverage);

  return (
    <section id={SOURCE_SECTION_ANCHOR_IDS.coverage} aria-label="Cobertura" className="record-editorial-section source-coverage-section">
      <h3 className="detail-panel-label">Cobertura</h3>
      {rows.length > 0 && <FactList rows={rows.map((row) => ({ key: row.field, label: row.label, value: row.value }))} />}
    </section>
  );
}
