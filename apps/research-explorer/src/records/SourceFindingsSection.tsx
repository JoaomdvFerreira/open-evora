import { Fragment } from "react";
import type { RecordDetail } from "../dataProvider/types";
import type { SourceEvidenceRelations } from "./sourceEvidenceRelations";
import { publicEnumLabel, publicFieldCaption, formatPublicDate } from "../presentation";

/**
 * SUI-03C1: isolated presentation component for the Source View "O que
 * encontrámos" section. Consumes the already-resolved
 * `SourceEvidenceRelations` (SUI-03A2) — no data fetching, no SRC → EVD
 * relation classification of its own. `primaryEvidence` / `additionalEvidence`
 * are trusted as already deduplicated/precedence-resolved by that module.
 */

function getString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function getObject(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = record[key];
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getStringArray(record: Record<string, unknown>, key: string): string[] | null {
  const value = record[key];
  if (!Array.isArray(value)) return null;
  const items = value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  return items.length > 0 ? items : null;
}

interface EvidenceFindingFact {
  label: string;
  field: string;
  value: string;
}

/**
 * Only the explicit canonical fields the task names — evidence_nature,
 * geography.area, population, source.retrieved_at. Every other EVD field
 * (notes, research_role, contribution, friction_types, representativeness,
 * verification, temporal_relevance, strength, personal_data, lineage_id,
 * related PRBs, raw technical content) is deliberately excluded from this
 * slice; absent optional fields are omitted, never given an invented
 * fallback.
 */
function evidenceFindingFacts(record: Record<string, unknown>): EvidenceFindingFact[] {
  const facts: EvidenceFindingFact[] = [];

  const nature = getString(record, "evidence_nature");
  if (nature) facts.push({ label: publicFieldCaption("evidence_nature"), field: "evidence_nature", value: publicEnumLabel("evidence_nature", nature) });

  const geography = getObject(record, "geography");
  const area = geography ? getString(geography, "area") : null;
  if (area) facts.push({ label: "Âmbito", field: "geography.area", value: area });

  const population = getStringArray(record, "population");
  if (population) facts.push({ label: "População", field: "population", value: population.join(", ") });

  const source = getObject(record, "source");
  const retrievedAt = source ? getString(source, "retrieved_at") : null;
  if (retrievedAt) {
    facts.push({ label: "Fonte consultada", field: "source.retrieved_at", value: `Consultada pela Open Évora em ${formatPublicDate(retrievedAt)}` });
  }

  return facts;
}

/**
 * Navigation is deliberately deferred: no Record Detail URL/route is
 * hardcoded here, and this isolated slice has no `onSelect`-style callback
 * wired in yet (that wiring is SRC-03C2's job when this component is mounted
 * inside RecordDetailPanel). The EVD ID renders as text only.
 */
function EvidenceFindingItem({ evidence }: { evidence: RecordDetail }) {
  const observation = getObject(evidence.record, "observation");
  const summary = observation ? getString(observation, "summary") : null;
  const facts = evidenceFindingFacts(evidence.record);

  return (
    <li className="source-finding-item">
      <span className="source-finding-id detail-technical-field">{evidence.id}</span>
      {summary && <p className="source-finding-summary">{summary}</p>}
      {facts.length > 0 && (
        <dl className="detail-provenance-grid">
          {facts.map((fact) => (
            <Fragment key={fact.field}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </Fragment>
          ))}
        </dl>
      )}
    </li>
  );
}

function EvidenceFindingGroup({ heading, evidence }: { heading: string; evidence: RecordDetail[] }) {
  if (evidence.length === 0) return null;
  return (
    <div className="source-finding-group">
      <h4>{heading}</h4>
      <ul className="source-finding-list">
        {evidence.map((item) => (
          <EvidenceFindingItem key={item.id} evidence={item} />
        ))}
      </ul>
    </div>
  );
}

export function SourceFindingsSection({ relations }: { relations: SourceEvidenceRelations }) {
  const isEmpty = relations.primaryEvidence.length === 0 && relations.additionalEvidence.length === 0;

  return (
    <section aria-label="O que encontrámos" className="source-findings-section">
      <h3 className="detail-panel-label">O que encontrámos</h3>
      {isEmpty ? (
        <p className="field-empty">Ainda não existem observações da investigação ligadas explicitamente a esta fonte.</p>
      ) : (
        <>
          <EvidenceFindingGroup heading="Evidência retirada desta fonte" evidence={relations.primaryEvidence} />
          <EvidenceFindingGroup heading="Evidência que também usa esta fonte" evidence={relations.additionalEvidence} />
        </>
      )}
    </section>
  );
}
