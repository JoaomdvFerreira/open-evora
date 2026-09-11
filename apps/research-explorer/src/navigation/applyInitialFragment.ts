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
 */
export function applyInitialFragment(): void {
  const hash = window.location.hash;
  if (!hash || hash.length <= 1) return;

  let id: string;
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    return;
  }

  const target = document.getElementById(id);
  if (!target) return;

  target.scrollIntoView();
  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
  }
  target.focus({ preventScroll: true });
}
