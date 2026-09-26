import { useId, useState } from "react";
import { Logo } from "../presentation/Logo";
import { IconMenu } from "../presentation/icons";

/**
 * Public chrome header (Overview final redesign, Phase 3B; compact disclosure
 * added in the visual-completion pass, task §2). Replaces the earlier
 * three-item internal-navigation labelling (Visão geral / Registos / Grafo)
 * with the approved public-facing surface: Problemas (Overview + Problem
 * context), Método and Sobre (existing TrustPages), Registos (the complete,
 * unfiltered Records area) and a Contribuir com evidência CTA — see
 * docs/explorerarchitecture.md §3 for the Overview/Records/Problem-context
 * navigation model this maps onto. Records/Graph capabilities are unchanged
 * underneath; this is a navigation-surface relabelling only. Graph has no
 * top-level item here — it is already a deferred public surface (see
 * urlState.ts's view=graph normalization) and gets no replacement entry.
 *
 * Compact disclosure (<=767px, task §2): the nav+CTA group gets a real
 * `<button>` toggle (native disclosure semantics — `aria-expanded` +
 * `aria-controls` resolving to a stable id, no focus trap, no forced focus
 * movement, matching the same pattern `FiltrosToggle`/`CategoryDrawer`
 * already use in CitizenDiscovery.tsx). The toggle and its `open` state are
 * local presentation state only, never URL-synced. `menuOpen`'s only effect
 * is the native `hidden` attribute on `.explorer-chrome-menu` — the group
 * stays mounted in normal document flow at every width (never removed from
 * the DOM, never a modal/overlay/portal), so the exact same nav/CTA
 * markup/handlers this component always rendered are reused unchanged, no
 * duplicated routing/business logic. At >=768px `.explorer-chrome-menu[hidden]`
 * is overridden back to visible in index.css — desktop ignores `menuOpen`
 * entirely and always shows nav+CTA, exactly as before this pass.
 *
 * Information pages (TrustPage.tsx) render this same header outside the live
 * Explorer: they pass no SPA callbacks, so Problemas/Registos fall back to
 * ordinary navigations to the same destinations (`/`, `/?view=records`), and
 * `activeView` names the Information item they represent — `methodology`
 * marks Método, `about` marks Sobre.
 */
export function ExplorerHeader({ activeView, onProblemas, onRegistos }: {
  activeView: string;
  onProblemas?: () => void;
  onRegistos?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const isProblemas = activeView === "overview" || activeView === "problem" || activeView === "history";
  // Registos is the whole Records area — every type filter and Record
  // Detail alike — never one particular filter.
  const isRegistos = activeView === "records";
  const isMetodo = activeView === "methodology";
  const isSobre = activeView === "about";
  return (
    <header className="explorer-chrome">
      <div className="explorer-chrome-inner shell-frame shell-frame--wide">
        <div className="explorer-chrome-group">
          <h1 className="explorer-identity">
            <Logo form="wordmark" className="explorer-logo explorer-logo--full" />
            <Logo form="compact" className="explorer-logo explorer-logo--compact" />
          </h1>
        </div>
        <button
          type="button"
          className="explorer-menu-toggle"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <IconMenu className="explorer-menu-toggle-icon" />
        </button>
        <div id={menuId} className="explorer-chrome-menu" hidden={!menuOpen}>
          <nav aria-label="Navegação principal" className="explorer-navigation">
            {onProblemas
              ? <button type="button" className="explorer-navigation-action" aria-current={isProblemas ? "page" : undefined} onClick={onProblemas}>Problemas</button>
              : <a className="explorer-navigation-action" href="/">Problemas</a>}
            <a className="explorer-navigation-action" href="/methodology" aria-current={isMetodo ? "page" : undefined}>Método</a>
            {onRegistos
              ? <button type="button" className="explorer-navigation-action" aria-current={isRegistos ? "page" : undefined} onClick={onRegistos}>Registos</button>
              : <a className="explorer-navigation-action" href="/?view=records">Registos</a>}
            <a className="explorer-navigation-action" href="/about" aria-current={isSobre ? "page" : undefined}>Sobre</a>
          </nav>
          <a className="explorer-cta" href="/contact">Contribuir com evidência</a>
        </div>
      </div>
    </header>
  );
}
