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
 * Several canonical codes intentionally share one public label/tone/icon
 * grouping (e.g. MOB+ACC, URB+HOU, EMP+ECO) — this keeps the icon set small
 * and coherent (component-model.md §1.9) without merging or renaming the
 * underlying canonical codes, which remain independently stored on each PRB.
 */

import type { ComponentType, SVGProps } from "react";
import { IconBook, IconBriefcase, IconBuilding, IconCare, IconLeaf, IconPublicSpace, IconRoute, IconSignal, IconTopicGeneric } from "./icons";

export type TopicTone = "mobility" | "urban" | "environment" | "public-space" | "education" | "economy" | "care" | "digital" | "neutral";

export interface TopicDescriptor {
  /** PT-PT public label for the canonical domain code. Never shown in place of the code in technical inspection. */
  label: string;
  /** Presentation tone key — resolved to a CSS custom property by topic.css, never an inline colour literal. */
  tone: TopicTone;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const TOPIC_MAPPING: Record<string, TopicDescriptor> = {
  MOB: { label: "Mobilidade", tone: "mobility", icon: IconRoute },
  ACC: { label: "Acessibilidade", tone: "mobility", icon: IconRoute },
  URB: { label: "Urbanismo", tone: "urban", icon: IconBuilding },
  HOU: { label: "Habitação", tone: "urban", icon: IconBuilding },
  ENV: { label: "Ambiente", tone: "environment", icon: IconLeaf },
  PUB: { label: "Espaço público", tone: "public-space", icon: IconPublicSpace },
  EDU: { label: "Educação", tone: "education", icon: IconBook },
  EMP: { label: "Emprego", tone: "economy", icon: IconBriefcase },
  ECO: { label: "Economia", tone: "economy", icon: IconBriefcase },
  SOC: { label: "Social", tone: "care", icon: IconCare },
  HEA: { label: "Saúde", tone: "care", icon: IconCare },
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
