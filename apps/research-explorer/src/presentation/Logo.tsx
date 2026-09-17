/**
 * WU053 — Open Évora logo, using the owner-approved raster identity
 * (aqueduct + tower + sun mark, "Open Évora" wordmark). The owner rejected
 * both the earlier abstract skyline mark and a faithful SVG vectorisation
 * attempt as not matching the approved visual; this renders the approved
 * PNG directly as a temporary production asset. Faithful SVG vectorisation
 * is deferred visual-polish work, not part of this slice.
 *
 * `LogoMark` is the compact, roughly-square mark-only crop (favicon-style /
 * narrow header / footer use); `Logo` is the full wide lockup (mark +
 * wordmark) for ordinary header/About usage. Both are transparent-background
 * PNGs with explicit intrinsic dimensions so layout doesn't shift while the
 * asset loads.
 *
 * This component is not wired into any production header/page in this work
 * unit — WU053's constraint scope is the visual foundation itself, gated by
 * owner visual-review, not adoption into Overview/Problem View/Trust
 * surfaces (owned by a later Work Unit in this milestone).
 */

import logoFullSrc from "../assets/logo-full.png";
import logoMarkSrc from "../assets/logo-mark.png";

type MarkProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height" | "alt">;

/** The bare mark (aqueduct + tower + sun), cropped square from the approved lockup PNG. */
export function LogoMark({ title = "Open Évora", ...props }: MarkProps & { title?: string }) {
  return <img src={logoMarkSrc} width={64} height={64} alt={title} {...props} />;
}

export interface LogoProps {
  /** `full` — mark + wordmark lockup (header/About usage). `compact` — mark only, wrapped with the same accessible name (narrow header/footer usage). */
  form?: "full" | "compact";
  className?: string;
}

/** Full lockup for ordinary application use; `compact` reuses the cropped mark asset for narrow/footer placements. */
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
      <img src={logoFullSrc} width={2172} height={724} alt="Open Évora" className="oe-logo-full" />
    </span>
  );
}
