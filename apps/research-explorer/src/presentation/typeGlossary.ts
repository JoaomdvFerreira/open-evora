/**
 * Optional, presentation-only glossary of the current three canonical
 * record types (docs/datamodel.md) — a specialised enhancement layered on
 * top of the generic Explorer, never a structural dependency. Every generic
 * mechanism (node discovery, edge discovery, search, detail rendering)
 * already works for any schema-conforming type with no glossary entry;
 * `describeType()` degrades gracefully to a generic entry for an unknown
 * prefix rather than omitting a label or breaking.
 */

export interface TypeDescriptor {
  /** Short Portuguese label shown inline, e.g. "[Evidência]". */
  label: string;
  /** Plural form of `label`, e.g. "Evidências" (Records filters and counts). */
  pluralLabel: string;
  /** One-sentence explanation, paraphrasing docs/datamodel.md's own record semantics. */
  description: string;
}

const KNOWN_TYPES: Record<string, TypeDescriptor> = {
  "SRC-": {
    label: "Fonte",
    pluralLabel: "Fontes",
    description: "Um documento, página ou conjunto de dados de origem — regista acesso público e direitos de reutilização separadamente.",
  },
  "EVD-": {
    label: "Evidência",
    pluralLabel: "Evidências",
    description: "Evidência é um registo com proveniência e limites explícitos.",
  },
  "PRB-": {
    label: "Problema",
    pluralLabel: "Problemas",
    description: "Consolida várias evidências que descrevem a mesma fricção cívica subjacente — sem incluir soluções na descrição do problema.",
  },
};

const GENERIC_FALLBACK_DESCRIPTION = "Tipo de registo definido pelo esquema canónico (research/schemas/*.schema.json).";

export function describeType(prefix: string): TypeDescriptor {
  const fallbackLabel = prefix.endsWith("-") ? prefix.slice(0, -1) : prefix;
  return (
    KNOWN_TYPES[prefix] ?? {
      label: fallbackLabel,
      pluralLabel: fallbackLabel,
      description: GENERIC_FALLBACK_DESCRIPTION,
    }
  );
}

/** Whether `prefix` has a glossary entry (vs. describeType's generic fallback). */
export function isKnownTypePrefix(prefix: string): boolean {
  return Object.prototype.hasOwnProperty.call(KNOWN_TYPES, prefix);
}

/** e.g. "[Evidência] EVD-000105" — inline orientation without requiring the user to memorise prefixes. */
export function formatTypedId(prefix: string, id: string): string {
  return `[${describeType(prefix).label}] ${id}`;
}

/** All known descriptors, for the reading guide's static fallback list (dynamic list prefers manifest.schemaPrefixes). */
export function knownTypePrefixes(): string[] {
  return Object.keys(KNOWN_TYPES);
}
