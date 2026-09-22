/**
 * F06: the skip link's real destination — after ExplorerHeader's global
 * navigation in document order (Explorer.tsx places its own focusable node
 * with this id right after the header), not the top of the shared
 * `<main id="main-content">` landmark that still wraps both. App.tsx's
 * loading/error/trust-page branches each supply their own element with this
 * id too, since ExplorerHeader isn't mounted in those states.
 *
 * Lives in this dependency-neutral module (not App.tsx or Explorer.tsx) so
 * both can import it without creating an App <-> Explorer module cycle.
 */
export const SKIP_TARGET_ID = "explorer-content-start";
