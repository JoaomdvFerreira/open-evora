import type { PrbDossierData } from "../prbDossierProjection";

export interface PrbDossierWorkerRequest {
  type: "generate";
  dossier: PrbDossierData;
  generatedAt: string;
}

export type PrbDossierWorkerResponse =
  | { type: "success"; blob: Blob }
  | { type: "failure"; error: { message: string } };

export function isPrbDossierWorkerResponse(value: unknown): value is PrbDossierWorkerResponse {
  if (value === null || typeof value !== "object") return false;
  const response = value as Record<string, unknown>;
  if (response.type === "success") {
    return response.blob instanceof Blob && response.blob.size > 0 && response.blob.type === "application/pdf";
  }
  if (response.type === "failure" && response.error !== null && typeof response.error === "object") {
    const error = response.error as Record<string, unknown>;
    return typeof error.message === "string" && error.message.length > 0 && error.message.length <= 200;
  }
  return false;
}
