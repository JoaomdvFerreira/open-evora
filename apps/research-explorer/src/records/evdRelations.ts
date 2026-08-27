import type { DataProvider, RecordDetail } from "../dataProvider/types";

const PRB_EVIDENCE_FIELD = "evidence";

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];
}

export interface EVDProblemUse {
  detail: RecordDetail;
  effects: string[];
  researchRoles: string[];
  relationshipPath: string;
}

/** Projects only the matching, top-level PRB `evidence[]` relationship for an EVD. */
export async function loadEvdProblemUses(provider: DataProvider, evidenceId: string): Promise<EVDProblemUse[]> {
  const evidence = await provider.getRecord(evidenceId);
  const problemIds = [...new Set(evidence.incomingEdges.filter((edge) => edge.field === PRB_EVIDENCE_FIELD).map((edge) => edge.from).filter((id): id is string => typeof id === "string"))];
  const problems = await Promise.all(problemIds.map((id) => provider.getRecord(id)));

  return problems.flatMap((detail) => {
    const entries = Array.isArray(detail.record.evidence) ? detail.record.evidence : [];
    return entries.flatMap((entry, index) => {
      const relationship = objectValue(entry);
      if (relationship?.evidence_id !== evidenceId) return [];
      return [{
        detail,
        effects: strings(relationship.effects),
        researchRoles: strings(relationship.research_roles),
        relationshipPath: `evidence[${index}]`,
      }];
    });
  });
}
