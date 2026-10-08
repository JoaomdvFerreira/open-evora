import { generatePrbDossierPdf } from "./generatePrbDossierPdf";
import { isPrbDossierWorkerResponse, type PrbDossierWorkerRequest } from "./prbDossierWorkerProtocol";

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<PrbDossierWorkerRequest>) => void) | null;
  postMessage(message: unknown): void;
};

workerScope.onmessage = async (event) => {
  const request = event.data;
  if (!request || request.type !== "generate" || typeof request.generatedAt !== "string" || !request.dossier) {
    workerScope.postMessage({ type: "failure", error: { message: "Invalid PDF request" } });
    return;
  }
  try {
    const blob = await generatePrbDossierPdf(request.dossier, new Date(request.generatedAt));
    const response = { type: "success", blob } as const;
    if (isPrbDossierWorkerResponse(response)) workerScope.postMessage(response);
    else workerScope.postMessage({ type: "failure", error: { message: "Invalid PDF output" } });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) || "PDF generation failed" : "PDF generation failed";
    workerScope.postMessage({ type: "failure", error: { message } });
  }
};
