/**
 * WU053 — presentation-only topic label/tone/icon mapping for the canonical
 * PRB `domain` codes actually present in the corpus (`research/problems/
 * PRB-*.yaml`, free-form list per `research/schemas/problem.schema.json` —
 * no enum is enforced on `domain`). Audited 2026-09-17 across all 12
 * canonical PRB records: MOB, URB, ACC, ENV, PUB, EMP, EDU, ECO, SOC, HEA,
 * HOU, DIG.
 *
 * This mapping introduces no canonical taxonomy field and changes no PRB
 * record. It is a pure presentation lookup: a stored `domain` code always
 * remains the canonical value: `describeTopic()` only supplies how to
 * *render* that code, mirroring `presentation/typeGlossary.ts`'s
 * `describeType()` graceful-fallback contract (docs/datamodel.md §3 "Exact
 * field names and enum values are schema-owned"; AGENTS.md canonical-state
 * integrity — no parallel semantic state).
 *
 * Every audited canonical code gets its own tone + icon (owner gate,
 * 2026-09-17 review): no two codes share a public visual identity. Related
 * domains (e.g. MOB/ACC, URB/HOU, EDU/EMP/ECO, SOC/HEA) use adjacent hues on
 * a restrained, evenly spaced wheel rather than a saturated rainbow — see
 * the WU053 primitives block in tokens.css — while remaining distinguishable
 * from each other, and icons reuse the same bounded stroke geometry
 * (component-model.md §1.9) rather than pulling in a general icon library.
 */

import type { ComponentType, SVGProps } from "react";
import {
  IconAccess,
  IconBook,
  IconBriefcase,
  IconBuilding,
  IconCare,
  IconCoin,
  IconHealth,
  IconHouse,
  IconLeaf,
  IconPublicSpace,
  IconRoute,
  IconSignal,
  IconTopicGeneric,
} from "./icons";

export type TopicTone =
  | "mobility"
  | "access"
  | "urban"
  | "housing"
  | "environment"
  | "public-space"
  | "education"
  | "employment"
  | "economy"
  | "care"
  | "health"
  | "digital"
  | "neutral";

export interface TopicDescriptor {
  /** PT-PT public label for the canonical domain code. Never shown in place of the code in technical inspection. */
  label: string;
  /** Presentation tone key — resolved to a CSS custom property by topic.css, never an inline colour literal. */
  tone: TopicTone;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const TOPIC_MAPPING: Record<string, TopicDescriptor> = {
  MOB: { label: "Mobilidade", tone: "mobility", icon: IconRoute },
  ACC: { label: "Acessibilidade", tone: "access", icon: IconAccess },
  URB: { label: "Urbanismo", tone: "urban", icon: IconBuilding },
  HOU: { label: "Habitação", tone: "housing", icon: IconHouse },
  SOC: { label: "Social", tone: "care", icon: IconCare },
  HEA: { label: "Saúde", tone: "health", icon: IconHealth },
  EDU: { label: "Educação", tone: "education", icon: IconBook },
  EMP: { label: "Emprego", tone: "employment", icon: IconBriefcase },
  ECO: { label: "Economia", tone: "economy", icon: IconCoin },
  ENV: { label: "Ambiente", tone: "environment", icon: IconLeaf },
  PUB: { label: "Espaço público", tone: "public-space", icon: IconPublicSpace },
  DIG: { label: "Digital", tone: "digital", icon: IconSignal },
};

const FALLBACK_TOPIC: TopicDescriptor = { label: "Outro", tone: "neutral", icon: IconTopicGeneric };

/** Safe presentation for any stored `domain` code, including one not yet in the audited mapping above — never omits a label or throws. */
export function describeTopic(domainCode: string): TopicDescriptor {
  return TOPIC_MAPPING[domainCode] ?? FALLBACK_TOPIC;
}

/** The audited canonical domain codes this mapping currently covers, for tests/Storybook — not a canonical enum, purely a record of what was audited. */
export function auditedDomainCodes(): string[] {
  return Object.keys(TOPIC_MAPPING);
}
