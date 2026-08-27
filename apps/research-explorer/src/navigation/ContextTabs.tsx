import { useUnavailableNote } from "../presentation/UnavailableNote";

export type ContextTabsActive = "detail" | "problem" | "graph";

interface ContextTabsProps {
  prbId: string;
  active: ContextTabsActive;
  onOpenGeneric: (id: string) => void;
  onViewAsProblem: (id: string) => void;
  onViewInGraph: (id: string) => void;
}

/**
 * PRB-scoped orientation switcher (design-system.md §3): Detalhe/Problema/Grafo
 * remain available while viewing the same PRB identity across its three
 * representations — Record Detail, Problem View, and Graph focused on that
 * PRB. Non-PRB records never render this (they keep Record Detail's own
 * "Mais ações" links instead). Shared by all three surfaces so the pattern
 * and its markup/styling (`.context-tabs`) stay single-sourced rather than
 * reimplemented per surface.
 */
export function ContextTabs({ prbId, active, onOpenGeneric, onViewAsProblem }: ContextTabsProps) {
  const { id: grafoNoteId, describedBy: grafoNote } = useUnavailableNote("Em desenvolvimento");
  return (
    <nav aria-label={`Navegação de ${prbId}`} className="context-tabs">
      <button type="button" aria-current={active === "detail" ? "page" : undefined} onClick={active === "detail" ? undefined : () => onOpenGeneric(prbId)}>
        Detalhe
      </button>
      <button type="button" aria-current={active === "problem" ? "page" : undefined} onClick={active === "problem" ? undefined : () => onViewAsProblem(prbId)}>
        Problema
      </button>
      {/* UX-F: Grafo is temporarily unavailable — see Explorer.tsx GlobalNav for the same treatment.
          Kept focusable (no native `disabled`) so keyboard users can reach it; the explanation is
          exposed visibly (hover/focus, via .unavailable-note) and associated through aria-describedby
          rather than relying solely on `title`, which isn't reliably surfaced on keyboard focus.
          No onClick, so activation is a no-op. */}
      <span className="unavailable-control">
        <button type="button" aria-disabled="true" title="Em desenvolvimento" aria-describedby={grafoNoteId}>
          Grafo
        </button>
        {grafoNote}
      </span>
    </nav>
  );
}
