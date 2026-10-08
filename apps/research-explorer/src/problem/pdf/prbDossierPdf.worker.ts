import { generatePrbDossierPdf } from "./generatePrbDossierPdf";
import { isPrbDossierWorkerRequest, isPrbDossierWorkerResponse, type PrbDossierWorkerRequest } from "./prbDossierWorkerProtocol";

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<PrbDossierWorkerRequest>) => void) | null;
  postMessage(message: unknown): void;
};

workerScope.onmessage = async (event) => {
  const request = event.data;
  if (!isPrbDossierWorkerRequest(request)) {
    workerScope.postMessage({ type: "failure", error: { message: "Invalid PDF request" } });
    return;
  }
  try {
    const blob = await generatePrbDossierPdf(request.dossier, { ...request.generation, generatedAt: new Date(request.generation.generatedAt) });
    const response = { type: "success", blob } as const;
    if (isPrbDossierWorkerResponse(response)) workerScope.postMessage(response);
    else workerScope.postMessage({ type: "failure", error: { message: "Invalid PDF output" } });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) || "PDF generation failed" : "PDF generation failed";
    workerScope.postMessage({ type: "failure", error: { message } });
  }
};
