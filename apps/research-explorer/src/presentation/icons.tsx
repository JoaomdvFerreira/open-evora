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

/** Mobilidade (MOB) — a road/route glyph. */
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

/** Acessibilidade (ACC) — a wheelchair-access glyph, distinct from the route glyph. */
export function IconAccess(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="10" cy="5" r="1.4" fill="currentColor" stroke="none" />
      <path d="M9 8v3.5l-3 4" />
      <path d="M9 9.5h5" />
      <path d="M9 11.5 12.5 16" />
      <path d="M6 16.5a3 3 0 1 0 0-6" />
    </IconBase>
  );
}

/** Urbanismo (URB) — a multi-unit building glyph. */
export function IconBuilding(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="5" y="3" width="10" height="14" rx="1" />
      <path d="M8 7h1M11 7h1M8 10h1M11 10h1M8 13h1M11 13h1" />
    </IconBase>
  );
}

/** Habitação (HOU) — a single house glyph, distinct in silhouette from the URB building block. */
export function IconHouse(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 10.5 10 5l6 5.5" />
      <path d="M5.5 9.5V16h9V9.5" />
      <path d="M8.5 16v-4h3v4" />
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

/** Emprego (EMP) — a briefcase glyph. */
export function IconBriefcase(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="7" width="14" height="9" rx="1.2" />
      <path d="M7 7V5.5c0-.8.7-1.5 1.5-1.5h3c.8 0 1.5.7 1.5 1.5V7" />
      <path d="M3 11h14" />
    </IconBase>
  );
}

/** Economia (ECO) — a coin glyph, distinct from the EMP briefcase. */
export function IconCoin(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 6.5v7M8 8.2h2.6a1.4 1.4 0 0 1 0 2.8H8.8a1.4 1.4 0 0 0 0 2.8H12" />
    </IconBase>
  );
}

/** Social (SOC) — a people glyph. */
export function IconCare(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10 16.2 4.6 11c-1.5-1.5-1.5-3.8 0-5.2 1.4-1.4 3.6-1.4 5 0l.4.4.4-.4c1.4-1.4 3.6-1.4 5 0 1.5 1.4 1.5 3.7 0 5.2L10 16.2Z" />
    </IconBase>
  );
}

/** Saúde (HEA) — a medical-cross glyph, distinct in silhouette from the SOC heart. */
export function IconHealth(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="3.5" width="13" height="13" rx="2.5" />
      <path d="M10 7v6M7 10h6" />
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
 * WU054 delta — search glyph, added to this bounded set for the citizen
 * search control (Overview). `aria-hidden` like every other icon here: the
 * accessible name always comes from the search control's own visible
 * `<label>`, never from this glyph.
 */
export function IconSearch(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="8.5" cy="8.5" r="5" />
      <path d="M16 16l-3.6-3.6" />
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

/**
 * Overview visual-completion — three presentation-only trust-row glyphs.
 * Each is a generic, neutral concept marker (not a status/effect/topic
 * value) for the Overview trust/value row; like every icon above they are
 * `aria-hidden`, and the row's own heading/copy carries all meaning.
 */

/** Fontes identificadas — a document/record glyph, distinct from IconBook (EDU topic). */
export function IconSource(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 3.5h6l3 3v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z" />
      <path d="M12 3.5v3h3" />
      <path d="M7.5 11h5M7.5 13.5h5M7.5 8.5h2" />
    </IconBase>
  );
}

/** Com transparência — an open-eye glyph. */
export function IconTransparency(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M2.5 10c1.8-3 4.6-4.6 7.5-4.6S15.7 7 17.5 10c-1.8 3-4.6 4.6-7.5 4.6S4.3 13 2.5 10Z" />
      <circle cx="10" cy="10" r="2.2" />
    </IconBase>
  );
}

/** Para uma Évora mais informada — a compass/orientation glyph, distinct from the topic/state glyph set. */
export function IconCompass(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M12.3 7.7 11 11l-3.3 1.3L9 9Z" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

/**
 * Overview metrics row — three presentation-only glyphs distinct from the
 * trust-row set above, so "problems tracked", "evidence records", and
 * "ongoing investigation" each read as a distinct concept marker rather than
 * reusing IconSource/IconCompass out of their trust-row context. Same
 * bounded, `aria-hidden` treatment as every icon in this file — the metric's
 * own visible value/label text carries all meaning.
 */

/** Problemas acompanhados — a single-sheet record glyph, distinct from IconSource's multi-line document. */
export function IconProblemRecord(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 3.5h6l3 3v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z" />
      <path d="M12 3.5v3h3" />
      <circle cx="8.7" cy="11.6" r="0.9" fill="currentColor" stroke="none" />
      <path d="M11 11.6h3" />
    </IconBase>
  );
}

/** Registos de evidência — a stacked-records/database glyph. */
export function IconEvidenceStack(props: IconProps) {
  return (
    <IconBase {...props}>
      <ellipse cx="10" cy="5.2" rx="6" ry="2.2" />
      <path d="M4 5.2v4.4c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2V5.2" />
      <path d="M4 9.6V14c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2V9.6" />
    </IconBase>
  );
}

/** Investigação em atualização contínua — an upward trend glyph. */
export function IconTrendUp(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.5 14 8 9.2l3 3L16.5 6" />
      <path d="M12.5 6h4v4" />
    </IconBase>
  );
}
