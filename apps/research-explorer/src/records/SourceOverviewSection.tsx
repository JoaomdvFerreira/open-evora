import { Fragment } from "react";
import { extractSourceOverview, type SourceOverview } from "./sourceView";
import { publicEnumLabel, formatPublicPartialDate } from "../presentation/presentation";
import { SOURCE_SECTION_ANCHOR_IDS } from "./sourceSectionIndex";

interface OverviewRow {
  label: string;
  field: string;
  value: string;
}

/**
 * SUI-03B1: SRC-owned facts only (`extractSourceOverview`) — no EVD/PRB
 * relation content, no access/licensing/coverage, no `canonical_reference`
 * (owned by "Datas e acesso" and the Source header action, per the task).
 * Creators render verbatim, every item, in canonical order — no "et al."
 * abbreviation invented here.
 */
function buildOverviewRows(overview: SourceOverview): OverviewRow[] {
  const rows: OverviewRow[] = [];

  if (overview.publisher) rows.push({ label: "Editor", field: "publisher", value: overview.publisher });

  if (overview.resourceType) {
    rows.push({ label: "Tipo de recurso", field: "resource_type", value: publicEnumLabel("resource_type", overview.resourceType) });
  }

  if (overview.creators && overview.creators.length > 0) {
    rows.push({ label: "Autores / criadores", field: "creators", value: overview.creators.join(", ") });
  }

  if (overview.lastCheckedAt) {
    rows.push({ label: "Última verificação pela Open Évora", field: "temporal.last_checked_at", value: `Verificada pela Open Évora em ${formatPublicPartialDate(overview.lastCheckedAt)}` });
  }

  return rows;
}

export function SourceOverviewSection({ record }: { record: Record<string, unknown> }) {
  const overview = extractSourceOverview(record);
  const rows = buildOverviewRows(overview);

  return (
    <section id={SOURCE_SECTION_ANCHOR_IDS.overview} aria-label="Visão geral" className="record-editorial-section source-overview-section">
      <h3 className="detail-panel-label">Visão geral</h3>
      {rows.length > 0 && (
        <dl className="detail-provenance-grid">
          {rows.map((row) => (
            <Fragment key={row.field}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </Fragment>
          ))}
        </dl>
      )}
    </section>
  );
}
