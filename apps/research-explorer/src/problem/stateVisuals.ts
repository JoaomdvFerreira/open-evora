/**
 * WU053 — accessible visual language (tone + non-colour icon carrier) for
 * the three canonical Problem state dimensions: lifecycle `status`,
 * `validation_status`, `evidence_status` (research/schemas/problem.schema.json,
 * docs/datamodel.md §3 "Current investigation state"). Colour is never the
 * sole carrier of meaning — every value here pairs a tone with a distinct
 * icon shape, and the caller (ProblemLifecycleStatus.tsx, InvestigationStatus.tsx)
 * always renders the existing explicit text label alongside both
 * (component-visual-contract.md "Status always has explicit text: colour
 * and glyph reinforce meaning but never carry it alone").
 *
 * The three dimensions stay visually distinct from one another (component-
 * visual-contract.md "the three dimensions remain visually distinguishable
 * from one another with no merged indicator"): each dimension has its own
 * lookup below and its own CSS class prefix in domain.css
 * (`.prb-status-chip--lifecycle-*` / `--validation-*` / `--evidence-*`), so
 * two different dimensions never resolve to the same rendered tone+icon+class
 * combination even where the underlying semantic colour (e.g. "affirmed")
 * is conceptually similar.
 */

import type { ComponentType, SVGProps } from "react";
import { IconStateAffirmed, IconStateClosed, IconStateOpen, IconStatePartial } from "../presentation/icons";

export type StateTone = "open" | "affirmed" | "partial" | "closed" | "neutral";

export interface StateVisual {
  tone: StateTone;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const LIFECYCLE_VISUALS: Record<string, StateVisual> = {
  OPEN: { tone: "open", icon: IconStateOpen },
  REJECTED: { tone: "closed", icon: IconStateClosed },
  DUPLICATE: { tone: "closed", icon: IconStateClosed },
  NON_DIGITAL: { tone: "closed", icon: IconStateClosed },
  ALREADY_SOLVED: { tone: "affirmed", icon: IconStateAffirmed },
  INSUFFICIENT_EVIDENCE: { tone: "closed", icon: IconStateClosed },
};

const VALIDATION_VISUALS: Record<string, StateVisual> = {
  unvalidated: { tone: "open", icon: IconStateOpen },
  partially_validated: { tone: "partial", icon: IconStatePartial },
  validated: { tone: "affirmed", icon: IconStateAffirmed },
};

const EVIDENCE_VISUALS: Record<string, StateVisual> = {
  discovered: { tone: "open", icon: IconStateOpen },
  corroborated: { tone: "affirmed", icon: IconStateAffirmed },
};

const NEUTRAL_FALLBACK: StateVisual = { tone: "neutral", icon: IconStateOpen };

/** Safe tone+icon lookup for a lifecycle `status` value, including an unrecognised future value. */
export function lifecycleVisual(value: string): StateVisual {
  return LIFECYCLE_VISUALS[value] ?? NEUTRAL_FALLBACK;
}

/** Safe tone+icon lookup for a `validation_status` value, including an unrecognised future value. */
export function validationVisual(value: string): StateVisual {
  return VALIDATION_VISUALS[value] ?? NEUTRAL_FALLBACK;
}

/** Safe tone+icon lookup for an `evidence_status` value, including an unrecognised future value. */
export function evidenceVisual(value: string): StateVisual {
  return EVIDENCE_VISUALS[value] ?? NEUTRAL_FALLBACK;
}
