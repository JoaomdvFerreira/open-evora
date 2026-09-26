export type ContextTabsActive = "details" | "history";

interface ContextTabsProps {
  prbId: string;
  active: ContextTabsActive;
  onViewDetails: (id: string) => void;
  onViewHistory: (id: string) => void;
}

/**
 * PRB-local navigation: exactly Detalhes | Histórico for the same Problem
 * identity. Ordinary navigation (`<nav>` + `aria-current="page"`), not an
 * ARIA tablist — each destination is its own view. The current destination
 * renders as non-interactive text; the other is a button calling its view
 * callback with the same PRB id. Generic Record Detail (technical inspection
 * through Registos) and Grafo are not PRB-local destinations. Appearance is
 * the approved `.prb-view-selector` recipe (styles/prb-view-selector.css).
 */
export function ContextTabs({ prbId, active, onViewDetails, onViewHistory }: ContextTabsProps) {
  const destinations = [
    { key: "details", label: "Detalhes", onActivate: () => onViewDetails(prbId) },
    { key: "history", label: "Histórico", onActivate: () => onViewHistory(prbId) },
  ] as const;

  return (
    <nav aria-label="Vistas do problema" className="prb-view-selector">
      {destinations.map(({ key, label, onActivate }) =>
        key === active ? (
          <span key={key} aria-current="page" className="prb-view-selector-item prb-view-selector-item--active">
            {label}
          </span>
        ) : (
          <button key={key} type="button" className="prb-view-selector-item" onClick={onActivate}>
            {label}
          </button>
        )
      )}
    </nav>
  );
}
