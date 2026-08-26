import { Fragment } from "react";
import { extractSourceLicensing, type SourceLicensing } from "./sourceView";
import { publicEnumLabel } from "../presentation";

interface LicensingRow {
  label: string;
  field: string;
  value: string;
}

/**
 * SUI-03F1: SRC-owned licensing facts only (`extractSourceLicensing`).
 * `licensing.status` (whether licensing is known) and `licensing.reuse`
 * (permitted/restricted/prohibited/unknown) are distinct canonical
 * dimensions — `restricted` is valid only as a `reuse` value, never as a
 * `status` interpretation. `licence` and `attribution` render the canonical
 * authored text verbatim — no acronym expansion, URL derivation, or reuse
 * inference from licence text.
 */
function buildLicensingRows(licensing: SourceLicensing): LicensingRow[] {
  const rows: LicensingRow[] = [];

  if (licensing.status) {
    rows.push({ label: "Estado do licenciamento", field: "licensing.status", value: publicEnumLabel("licensing.status", licensing.status) });
  }

  if (licensing.licence) {
    rows.push({ label: "Licença", field: "licensing.licence", value: licensing.licence });
  }

  if (licensing.reuse) {
    rows.push({ label: "Reutilização", field: "licensing.reuse", value: publicEnumLabel("licensing.reuse", licensing.reuse) });
  }

  if (licensing.attribution) {
    rows.push({ label: "Atribuição", field: "licensing.attribution", value: licensing.attribution });
  }

  return rows;
}

export function SourceLicensingSection({ record }: { record: Record<string, unknown> }) {
  const licensing = extractSourceLicensing(record);
  const rows = buildLicensingRows(licensing);

  return (
    <section aria-label="Licenciamento" className="source-licensing-section">
      <h3 className="detail-panel-label">Licenciamento</h3>
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
