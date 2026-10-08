import type { PrbDossierData } from "../prbDossierProjection";
import type { DossierGenerationMetadata } from "./dossierPresentation";

export type PrbDossierWorkerGenerationMetadata = Omit<DossierGenerationMetadata, "generatedAt"> & { generatedAt: string };

export interface PrbDossierWorkerRequest {
  type: "generate";
  dossier: PrbDossierData;
  generation: PrbDossierWorkerGenerationMetadata;
}

export function isPrbDossierWorkerRequest(value: unknown): value is PrbDossierWorkerRequest {
  if (value === null || typeof value !== "object") return false;
  const request = value as Record<string, unknown>;
  if (request.type !== "generate" || request.dossier === null || typeof request.dossier !== "object") return false;
  if (request.generation === null || typeof request.generation !== "object") return false;
  const generation = request.generation as Record<string, unknown>;
  return typeof generation.generatedAt === "string" && typeof generation.corpusFingerprint === "string" && generation.corpusFingerprint.length > 0 &&
    (generation.sourceCommit === null || typeof generation.sourceCommit === "string");
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
