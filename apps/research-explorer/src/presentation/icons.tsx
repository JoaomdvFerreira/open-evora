/**
 * WU053 — small, coherent icon set covering the topic mapping
 * (topicMapping.ts) and the canonical state visual language
 * (problem/stateVisuals.ts). Deliberately bounded: one glyph per concept
 * actually used by those two callers, not a general icon library
 * (component-model.md §1.9 "a small demonstrated system is preferable to a
 * catalogue"). Every icon is `aria-hidden` — the accessible name always
 * comes from the caller's own text label, never from the icon alone
 * (foundations.md "Colour and contrast intent": no non-text signal may
 * carry meaning alone either).
 *
 * Stroke-based, single-weight, on a 20x20 viewBox so every icon shares one
 * optical size/weight regardless of call-site font-size scaling via `em`
 * sizing on the wrapping `<svg>`.
 */

import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "viewBox" | "aria-hidden" | "focusable">;

function IconBase({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Mobilidade / Acessibilidade (MOB, ACC) — a road/route glyph. */
export function IconRoute(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 16c0-4 3-4 3-8s-1-4-1-5" />
      <path d="M16 16c0-4-3-4-3-8s1-4 1-5" />
      <circle cx="4" cy="17" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="17" r="1.1" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

/** Urbanismo / Habitação (URB, HOU) — a building glyph. */
export function IconBuilding(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="5" y="3" width="10" height="14" rx="1" />
      <path d="M8 7h1M11 7h1M8 10h1M11 10h1M8 13h1M11 13h1" />
    </IconBase>
  );
}

/** Ambiente (ENV) — a leaf glyph. */
export function IconLeaf(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 15c-1-6 3-11 10-11 1 7-4 11-10 11Z" />
      <path d="M5 15c2-3 5-5.5 8-7" />
    </IconBase>
  );
}

/** Espaço público (PUB) — a bench/plaza glyph. */
export function IconPublicSpace(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 15h14" />
      <path d="M4 15v-3M16 15v-3M4 12h12" />
      <path d="M6 12V8M14 12V8" />
    </IconBase>
  );
}

/** Educação (EDU) — a book glyph. */
export function IconBook(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10 5.5C8.5 4.4 6.6 4 4 4v11c2.6 0 4.5.4 6 1.5" />
      <path d="M10 5.5C11.5 4.4 13.4 4 16 4v11c-2.6 0-4.5.4-6 1.5" />
      <path d="M10 5.5v11" />
    </IconBase>
  );
}

/** Emprego / Economia (EMP, ECO) — a briefcase glyph. */
export function IconBriefcase(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="7" width="14" height="9" rx="1.2" />
      <path d="M7 7V5.5c0-.8.7-1.5 1.5-1.5h3c.8 0 1.5.7 1.5 1.5V7" />
      <path d="M3 11h14" />
    </IconBase>
  );
}

/** Social / Saúde (SOC, HEA) — a heart/people glyph. */
export function IconCare(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10 16.2 4.6 11c-1.5-1.5-1.5-3.8 0-5.2 1.4-1.4 3.6-1.4 5 0l.4.4.4-.4c1.4-1.4 3.6-1.4 5 0 1.5 1.4 1.5 3.7 0 5.2L10 16.2Z" />
    </IconBase>
  );
}

/** Digital (DIG) — a signal/connectivity glyph. */
export function IconSignal(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 15v-2M9 15V9M13 15V6M17 15V3" />
    </IconBase>
  );
}

/** Safe neutral fallback for an unmapped/future domain code — never invents topic meaning. */
export function IconTopicGeneric(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="10" cy="10" r="6.5" />
    </IconBase>
  );
}

/**
 * Non-colour carrier for the OPEN lifecycle value and other in-progress
 * states — an outlined circle, distinct in shape from the filled dot
 * (`IconStateFilled`) and the check/cross glyphs below.
 */
export function IconStateOpen(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="10" cy="10" r="6.5" />
    </IconBase>
  );
}

/** Non-colour carrier for an affirmed/validated/corroborated state — a check glyph. */
export function IconStateAffirmed(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 10.5 8 14l8-8" />
    </IconBase>
  );
}

/** Non-colour carrier for a partial/in-progress state — a half-filled circle glyph. */
export function IconStatePartial(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 3.5a6.5 6.5 0 0 1 0 13Z" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

/** Non-colour carrier for a terminal/closed-negative state (rejected, duplicate, insufficient evidence, etc.) — a cross glyph. */
export function IconStateClosed(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 6l8 8M14 6l-8 8" />
    </IconBase>
  );
}
