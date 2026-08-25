import { Fragment } from "react";
import { extractSourceDatesAccess, type SourceDatesAccess } from "./sourceView";
import { publicEnumLabel, publicTriStateLabel, formatPublicPartialDate, formatPublicDate } from "../presentation";

interface DatesAccessRow {
  label: string;
  field: string;
  value: string;
}

/**
 * SUI-03E1: SRC-owned dates/access facts only (`extractSourceDatesAccess`) —
 * publication/update dates, Open Évora's own last_checked_at, and access
 * status. `temporal.update_frequency` describes cadence only, never
 * freshness. `temporal.last_checked_at` is rendered as a plain public date
 * with no "current/recent/validated" framing — it only records when Open
 * Évora checked the Source. `scope.temporal` (coverage) is out of scope
 * here; it belongs to "Cobertura". `canonical_reference` renders as plain
 * text — the actionable "Abrir fonte original" CTA and its eligibility rule
 * belong to the Source header action, not duplicated here.
 */
function buildDatesAccessRows(datesAccess: SourceDatesAccess): DatesAccessRow[] {
  const rows: DatesAccessRow[] = [];

  if (datesAccess.publishedAt) {
    rows.push({ label: "Publicação", field: "published_at", value: formatPublicPartialDate(datesAccess.publishedAt) });
  }

  if (datesAccess.updatedAt) {
    rows.push({ label: "Última atualização da fonte", field: "updated_at", value: formatPublicPartialDate(datesAccess.updatedAt) });
  }

  if (datesAccess.lastCheckedAt) {
    rows.push({ label: "Última verificação pela Open Évora", field: "last_checked_at", value: formatPublicDate(datesAccess.lastCheckedAt) });
  }

  if (datesAccess.updateFrequency) {
    rows.push({ label: "Frequência de atualização", field: "update_frequency", value: publicEnumLabel("temporal.update_frequency", datesAccess.updateFrequency) });
  }

  if (datesAccess.accessLevel) {
    rows.push({ label: "Nível de acesso", field: "access.level", value: publicEnumLabel("access.level", datesAccess.accessLevel) });
  }

  if (datesAccess.accessAvailability) {
    rows.push({ label: "Disponibilidade", field: "access.availability", value: publicEnumLabel("access.availability", datesAccess.accessAvailability) });
  }

  if (datesAccess.accessMachineReadable !== null) {
    rows.push({ label: "Leitura automática", field: "access.machine_readable", value: publicTriStateLabel(datesAccess.accessMachineReadable) });
  }

  if (datesAccess.accessMethod) {
    rows.push({ label: "Forma de consulta", field: "access.method", value: publicEnumLabel("access.method", datesAccess.accessMethod) });
  }

  if (datesAccess.accessFormat) {
    rows.push({ label: "Formato", field: "access.format", value: publicEnumLabel("access.format", datesAccess.accessFormat) });
  }

  if (datesAccess.canonicalReference) {
    rows.push({ label: "Referência original", field: "canonical_reference", value: datesAccess.canonicalReference });
  }

  return rows;
}

export function SourceDatesAccessSection({ record }: { record: Record<string, unknown> }) {
  const datesAccess = extractSourceDatesAccess(record);
  const rows = buildDatesAccessRows(datesAccess);

  return (
    <section aria-label="Datas e acesso" className="source-dates-access-section">
      <h3 className="detail-panel-label">Datas e acesso</h3>
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
