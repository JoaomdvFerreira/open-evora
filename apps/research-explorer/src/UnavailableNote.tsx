import { useId } from "react";

/**
 * Shared "why is this control unavailable" affordance for aria-disabled nav
 * buttons (UX-F: GlobalNav Grafo, PRB ContextTabs Grafo). `title` alone isn't
 * reliably exposed to keyboard focus, so this renders the explanation as
 * visible text — shown on pointer hover and keyboard focus via `.unavailable-note`
 * — and wires it to the button with `aria-describedby`. `useId` keeps the id
 * unique when multiple nav surfaces render their own copy on the same page.
 */
export function useUnavailableNote(text: string) {
  const id = useId();
  const describedBy = (
    <span role="note" id={id} className="unavailable-note">
      {text}
    </span>
  );
  return { id, describedBy };
}
