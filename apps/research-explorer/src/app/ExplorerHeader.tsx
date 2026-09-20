import { Logo } from "../presentation/Logo";

/**
 * Public chrome header (Overview final redesign, Phase 3B). Replaces the
 * earlier three-item internal-navigation labelling (Visão geral / Registos /
 * Grafo) with the approved public-facing surface: Problemas (Overview +
 * Problem context), Método and Sobre (existing TrustPages), Fontes (Records
 * filtered to canonical Sources) and a Contribuir com evidência CTA — see
 * docs/explorerarchitecture.md §3 for the Overview/Records/Problem-context
 * navigation model this maps onto. Records/Graph capabilities are unchanged
 * underneath; this is a navigation-surface relabelling only. Graph has no
 * top-level item here — it is already a deferred public surface (see
 * urlState.ts's view=graph normalization) and gets no replacement entry.
 */
export function ExplorerHeader({ activeView, activeTypeFilter, onProblemas, onFontes }: {
  activeView: string;
  activeTypeFilter: string;
  onProblemas: () => void;
  onFontes: () => void;
}) {
  const isProblemas = activeView === "overview" || activeView === "problem" || activeView === "history";
  const isFontes = activeView === "records" && activeTypeFilter === "SRC-";
  return (
    <header className="explorer-chrome">
      <div className="explorer-chrome-inner shell-frame">
        <h1 className="explorer-identity">
          <Logo form="full" className="explorer-logo explorer-logo--full" />
          <Logo form="compact" className="explorer-logo explorer-logo--compact" />
        </h1>
        <nav aria-label="Navegação principal" className="explorer-navigation">
          <button type="button" className="explorer-navigation-action" aria-current={isProblemas ? "page" : undefined} onClick={onProblemas}>Problemas</button>
          <a className="explorer-navigation-action" href="/methodology">Método</a>
          <button type="button" className="explorer-navigation-action" aria-current={isFontes ? "page" : undefined} onClick={onFontes}>Fontes</button>
          <a className="explorer-navigation-action" href="/about">Sobre</a>
        </nav>
        <a className="explorer-cta" href="/contact">Contribuir com evidência</a>
      </div>
    </header>
  );
}
