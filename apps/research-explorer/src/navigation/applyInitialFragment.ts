/**
 * ODM-016A: on a direct deep link that carries a URL fragment (e.g.
 * `#evd-limits`), the browser's native "scroll to fragment on load" runs
 * before the target section exists — record/problem detail content mounts
 * asynchronously after a data fetch — so the native behaviour finds nothing
 * and silently no-ops. This re-applies the fragment exactly once, after the
 * caller's content has actually mounted, without touching routing/URL state
 * and without hijacking ordinary user scrolling on any later navigation
 * (call this only on the transition into the first ready content, not on
 * every content change).
 *
 * F07: returns whether a fragment target was actually found and focused, so
 * a caller with its own default-focus fallback (e.g. ProblemView focusing
 * its heading) can apply that fallback only when this returns `false` —
 * covering "no hash", "malformed hash", and "hash for a missing element"
 * alike, all of which must fail safely into that same fallback rather than
 * throwing or fabricating a target.
 */
export function applyInitialFragment(): boolean {
  const hash = window.location.hash;
  if (!hash || hash.length <= 1) return false;

  let id: string;
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    return false;
  }

  const target = document.getElementById(id);
  if (!target) return false;

  target.scrollIntoView();
  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
  }
  target.focus({ preventScroll: true });
  return true;
}
