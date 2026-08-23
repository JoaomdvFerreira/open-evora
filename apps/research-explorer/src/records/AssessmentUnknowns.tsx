/**
 * Shared "O que ainda não sabemos" rendering, reused by both ProblemView's
 * per-Problem "Incertezas e lacunas" section and Record Detail's own ASM
 * presentation (UX-G2) — one component so the two surfaces cannot drift
 * apart on the same canonical `critical_unknowns`/`remaining_gap` shape.
 * critical_unknowns is dynamically-keyed (U1, U2, ...) and optional — a
 * record with none renders nothing here, never a fixed-width placeholder.
 */
import { publicEnumLabel, publicFieldCaption } from "../presentation";
import { solutionGapPair, understandingDimensions, type GlossedField } from "./asmPresentation";

function fieldValue(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringValues(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function GlossedRow({ item }: { item: GlossedField }) {
  return (
    <p>
      <strong>{item.caption}:</strong> {item.label}
      {item.explanation ? ` — ${item.explanation}` : ""}
    </p>
  );
}

/**
 * `existing_solution_understanding` and `remaining_gap`, always rendered
 * together (ux-g2-asm-audit.md §5 point 5, §9 point 3): they answer distinct
 * questions ("do we understand what already exists" vs "does it close the
 * gap") that an earlier schema draft's naming conflated — the model doc's
 * rename note exists specifically to prevent that conflation from recurring
 * here.
 */
function SolutionAndGap({ record }: { record: Record<string, unknown> }) {
  const { existingSolutionUnderstanding, remainingGap } = solutionGapPair(record);
  if (!existingSolutionUnderstanding && !remainingGap) return null;
  return (
    <div className="asm-solution-gap-pair">
      {existingSolutionUnderstanding && <GlossedRow item={existingSolutionUnderstanding} />}
      {remainingGap && <GlossedRow item={remainingGap} />}
    </div>
  );
}

function UnderstandingRows({ record }: { record: Record<string, unknown> }) {
  const items = understandingDimensions(record);
  if (items.length === 0) return null;
  return (
    <div className="asm-understanding-rows">
      {items.map((item) => (
        <GlossedRow key={item.field} item={item} />
      ))}
    </div>
  );
}

/** critical_unknowns: preserves the existing, already-good rendering pattern (question/impact/phase/next-evidence) — unchanged from the pre-UX-G2 ProblemView version. */
export function CriticalUnknowns({ record }: { record: Record<string, unknown> }) {
  const unknowns = recordValue(record.critical_unknowns);
  if (!unknowns || Object.keys(unknowns).length === 0) return null;
  return (
    <section aria-label="Incertezas">
      <h5>Incertezas</h5>
      {Object.entries(unknowns).map(([id, value]) => {
        const unknown = recordValue(value);
        if (!unknown) return null;
        const question = fieldValue(unknown, "question");
        const impact = fieldValue(unknown, "decision_impact");
        const phase = fieldValue(unknown, "target_phase");
        const nextEvidence = stringValues(unknown.best_next_evidence);
        return (
          <section key={id} aria-label={`Incerteza ${id}`}>
            <h6>Incerteza {id}</h6>
            {question && <p><strong>Questão em aberto:</strong> {question}</p>}
            {impact && <p><strong>{publicFieldCaption("decision_impact")}:</strong> {publicEnumLabel("decision_impact", impact)}</p>}
            {phase && <p><strong>{publicFieldCaption("target_phase")}:</strong> {phase}</p>}
            {nextEvidence.length > 0 && (
              <>
                <strong>Próxima evidência:</strong>
                <ul>
                  {nextEvidence.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </>
            )}
          </section>
        );
      })}
    </section>
  );
}

/** Full "O que ainda não sabemos" composition: paired solution/gap, understanding dimensions, then critical_unknowns — used by Record Detail's own ASM presentation (UX-G2). ProblemView keeps its own narrower per-Problem composition (solution/gap pair + critical_unknowns only, no understanding dimensions, to avoid duplicating Record Detail's fuller ASM presentation). */
export function AssessmentUnknownsFull({ record }: { record: Record<string, unknown> }) {
  return (
    <>
      <SolutionAndGap record={record} />
      <UnderstandingRows record={record} />
      <CriticalUnknowns record={record} />
    </>
  );
}

/** ProblemView's narrower composition: solution/gap pair (now paired, per audit) + critical_unknowns. */
export function AssessmentUnknownsSummary({ record }: { record: Record<string, unknown> }) {
  return (
    <>
      <SolutionAndGap record={record} />
      <CriticalUnknowns record={record} />
    </>
  );
}
