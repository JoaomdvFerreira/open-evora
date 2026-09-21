import { useId, useState } from "react";
import { Logo } from "../presentation/Logo";
import { IconMenu } from "../presentation/icons";

/**
 * Public chrome header (Overview final redesign, Phase 3B; compact disclosure
 * added in the visual-completion pass, task §2). Replaces the earlier
 * three-item internal-navigation labelling (Visão geral / Registos / Grafo)
 * with the approved public-facing surface: Problemas (Overview + Problem
 * context), Método and Sobre (existing TrustPages), Fontes (Records filtered
 * to canonical Sources) and a Contribuir com evidência CTA — see
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
 */
export function ExplorerHeader({ activeView, activeTypeFilter, onProblemas, onFontes }: {
  activeView: string;
  activeTypeFilter: string;
  onProblemas: () => void;
  onFontes: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const isProblemas = activeView === "overview" || activeView === "problem" || activeView === "history";
  const isFontes = activeView === "records" && activeTypeFilter === "SRC-";
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
            <button type="button" className="explorer-navigation-action" aria-current={isProblemas ? "page" : undefined} onClick={onProblemas}>Problemas</button>
            <a className="explorer-navigation-action" href="/methodology">Método</a>
            <button type="button" className="explorer-navigation-action" aria-current={isFontes ? "page" : undefined} onClick={onFontes}>Fontes</button>
            <a className="explorer-navigation-action" href="/about">Sobre</a>
          </nav>
          <a className="explorer-cta" href="/contact">Contribuir com evidência</a>
        </div>
      </div>
    </header>
  );
}
