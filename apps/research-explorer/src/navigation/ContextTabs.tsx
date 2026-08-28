export type ContextTabsActive = "detail" | "problem" | "history" | "graph";

interface ContextTabsProps {
  prbId: string;
  active: ContextTabsActive;
  onOpenGeneric: (id: string) => void;
  onViewAsProblem: (id: string) => void;
  onViewHistory: (id: string) => void;
}

/**
 * PRB-scoped orientation switcher. It keeps the same Problem identity while
 * moving between generic detail, the Problem reading, and its authored
 * material history. Non-PRB records never render this control.
 */
export function ContextTabs({ prbId, active, onOpenGeneric, onViewAsProblem, onViewHistory }: ContextTabsProps) {
  return (
    <nav aria-label={`Navegação de ${prbId}`} className="context-tabs">
      <button type="button" aria-current={active === "detail" ? "page" : undefined} onClick={active === "detail" ? undefined : () => onOpenGeneric(prbId)}>
        Detalhe
      </button>
      <button type="button" aria-current={active === "problem" ? "page" : undefined} onClick={active === "problem" ? undefined : () => onViewAsProblem(prbId)}>
        Problema
      </button>
      <button type="button" aria-current={active === "history" ? "page" : undefined} onClick={active === "history" ? undefined : () => onViewHistory(prbId)}>
        Histórico
      </button>
    </nav>
  );
}
