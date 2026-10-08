/** The one site suffix every Explorer and Information document title shares. */
export const DOCUMENT_TITLE_SUFFIX = "Explorador de Investigação Open Évora";

export function documentTitle(label: string): string {
  return `${label} — ${DOCUMENT_TITLE_SUFFIX}`;
}

/**
 * Records-view title label: a selected EVD/SRC is named by type and canonical
 * ID straight from URL state, so the title never waits on the detail request.
 * Every other Records state keeps the generic "Registos".
 */
export function recordsTitleLabel(selectedId: string | null): string {
  if (selectedId?.startsWith("EVD-")) return `Evidência ${selectedId}`;
  if (selectedId?.startsWith("SRC-")) return `Fonte ${selectedId}`;
  return "Registos";
}
