import type { PrbDossierData } from "../prbDossierProjection";
import { isPrbDossierWorkerResponse, type PrbDossierWorkerGenerationMetadata, type PrbDossierWorkerRequest, type PrbDossierWorkerResponse } from "./prbDossierWorkerProtocol";

type WorkerPort = Pick<Worker, "postMessage" | "terminate" | "addEventListener" | "removeEventListener">;
type WorkerFactory = () => WorkerPort;

const createWorker: WorkerFactory = () => new Worker(new URL("./prbDossierPdf.worker.ts", import.meta.url), { type: "module" });

export function generateDossierInWorker(
  dossier: PrbDossierData,
  generation: PrbDossierWorkerGenerationMetadata,
  workerFactory: WorkerFactory = createWorker,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = workerFactory();
    const cleanup = () => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      worker.removeEventListener("messageerror", onMessageError);
      worker.terminate();
    };
    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onMessage = (event: MessageEvent<unknown>) => {
      if (!isPrbDossierWorkerResponse(event.data)) {
        fail(new Error("Invalid PDF worker response"));
        return;
      }
      const response: PrbDossierWorkerResponse = event.data;
      cleanup();
      if (response.type === "success") resolve(response.blob);
      else reject(new Error(response.error.message));
    };
    const onError = () => fail(new Error("PDF worker failed"));
    const onMessageError = () => fail(new Error("PDF worker response could not be read"));

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.addEventListener("messageerror", onMessageError);
    const request: PrbDossierWorkerRequest = { type: "generate", dossier, generation };
    try {
      worker.postMessage(request);
    } catch {
      fail(new Error("PDF worker request could not be sent"));
    }
  });
}
