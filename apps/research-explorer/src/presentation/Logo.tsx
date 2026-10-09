/**
 * WU053 — Open Évora logo, using the owner-approved raster identity
 * (aqueduct + tower + sun mark, "Open Évora" wordmark). The owner rejected
 * both the earlier abstract skyline mark and a faithful SVG vectorisation
 * attempt as not matching the approved visual; this renders the approved
 * PNG directly as a temporary production asset. Faithful SVG vectorisation
 * is deferred visual-polish work, not part of this slice.
 *
 * `LogoMark` is the compact, roughly-square mark-only crop (favicon-style
 * use); `Logo` is the full wide lockup (mark + wordmark). Both are
 * transparent-background PNGs with explicit intrinsic dimensions so layout
 * doesn't shift while the asset loads.
 *
 * Production renders only the textual `wordmark` form (ExplorerHeader). The
 * raster `full`/`compact` forms and `LogoMark` are currently visual-foundation
 * (Storybook) review surfaces only — the Header no longer mounts the compact
 * mark, since a CSS-hidden `<img>` is still fetched (D01-025).
 */

import logoFullSrc from "../assets/logo-full.png";
import logoMarkSrc from "../assets/logo-mark.png";

type MarkProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height" | "alt">;

/** The bare mark (aqueduct + tower + sun), cropped square from the approved lockup PNG. */
export function LogoMark({ title = "Open Évora", ...props }: MarkProps & { title?: string }) {
  return <img src={logoMarkSrc} width={64} height={64} alt={title} {...props} />;
}

export interface LogoProps {
  /** `full` — mark + wordmark raster lockup. `compact` — mark only, wrapped with the same accessible name. `wordmark` — a textual "Open Évora" lockup (Overview visual-completion, task §3): the Header identity, converged toward TARGET's textual presence using the existing reading/serif typography rather than the compact raster mark, which reads with substantially less visual weight at header scale. */
  form?: "full" | "compact" | "wordmark";
  className?: string;
}

/** Full raster lockup by default; `compact` reuses the cropped mark asset; `wordmark` is the text-based Header identity at every width. */
export function Logo({ form = "full", className }: LogoProps) {
  if (form === "compact") {
    return (
      <span className={["oe-logo", "oe-logo--compact", className].filter(Boolean).join(" ")}>
        <LogoMark className="oe-logo-mark" />
      </span>
    );
  }

  if (form === "wordmark") {
    return (
      <span className={["oe-logo", "oe-logo--wordmark", className].filter(Boolean).join(" ")}>
        Open Évora
      </span>
    );
  }

  return (
    <span className={["oe-logo", "oe-logo--full", className].filter(Boolean).join(" ")}>
      <img src={logoFullSrc} width={2172} height={724} alt="Open Évora" className="oe-logo-full" />
    </span>
  );
}
