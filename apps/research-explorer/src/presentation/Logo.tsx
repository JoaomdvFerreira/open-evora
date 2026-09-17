/**
 * WU053 — Open Évora logo/mark, implementing the approved prototype
 * direction (.research-workbench/visual-references/m015-citizen-ux.png: a
 * skyline/mark preceding the "Open Évora" wordmark in the site header,
 * About page, and footer). Scalable, vector (inline SVG, no raster asset),
 * and designed for a light/neutral background — the mark's ink colour is a
 * single `currentColor`-independent foundation tone (`--color-ink-primary`)
 * plus the existing accent tone, not a colour requiring a dark backdrop.
 *
 * `LogoMark` is the compact icon-only form (favicon-style / narrow header /
 * footer use); `Logo` is the full lockup (mark + "Open Évora" wordmark) for
 * ordinary header/About usage. Both share one `<svg>` mark definition so the
 * glyph never drifts between the two forms.
 *
 * This component is not wired into any production header/page in this work
 * unit — WU053's constraint scope is the visual foundation itself, gated by
 * owner visual-review, not adoption into Overview/Problem View/Trust
 * surfaces (owned by a later Work Unit in this milestone).
 */

import type { SVGProps } from "react";

type MarkProps = Omit<SVGProps<SVGSVGElement>, "viewBox" | "role">;

/** The bare mark: a stylised skyline (tower + roofline), matching the prototype's header glyph. Scales via `em` sizing. */
export function LogoMark({ title = "Open Évora", ...props }: MarkProps & { title?: string }) {
  return (
    <svg viewBox="0 0 32 32" width="1em" height="1em" role="img" aria-label={title} {...props}>
      <path
        d="M2 24 L7 14 L10 18 L14 9 L18 17 L21 12 L25 24 Z"
        fill="none"
        stroke="var(--color-ink-primary, #201e1a)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <rect x="12.2" y="4.5" width="3.6" height="6.5" rx="0.6" fill="var(--color-accent, #6b3a1f)" />
      <line x1="2" y1="24" x2="29" y2="24" stroke="var(--color-ink-primary, #201e1a)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export interface LogoProps {
  /** `full` — mark + wordmark lockup (header/About usage). `compact` — mark only, wrapped with the same accessible name (narrow header/footer usage). */
  form?: "full" | "compact";
  className?: string;
}

/** Full lockup for ordinary application use; `compact` reuses the same mark for narrow/footer placements without duplicating the SVG definition. */
export function Logo({ form = "full", className }: LogoProps) {
  if (form === "compact") {
    return (
      <span className={["oe-logo", "oe-logo--compact", className].filter(Boolean).join(" ")}>
        <LogoMark className="oe-logo-mark" />
      </span>
    );
  }

  return (
    <span className={["oe-logo", "oe-logo--full", className].filter(Boolean).join(" ")}>
      <LogoMark className="oe-logo-mark" title="" aria-hidden="true" />
      <span className="oe-logo-wordmark">Open Évora</span>
    </span>
  );
}
