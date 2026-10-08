import { useRef, useState } from "react";
import { useToast } from "../presentation/Toast";
import type { PrbDossierData } from "./prbDossierProjection";
import type { DossierPublicationIdentity } from "./PrbDetailsPresentation";
import type { DossierGenerationMetadata } from "./pdf/dossierPresentation";

export function prbDossierFileName(problemId: string): string {
  return `open-evora-${problemId}-dossie.pdf`;
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next task so the browser has started the download first.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * "Descarregar dossiê (PDF)": generates the PRB dossier client-side from the
 * current PRB's `PrbDossierData` and hands the browser a real PDF Blob. The
 * React-PDF and dossier layout run in a dedicated module
 * Worker created only on click, so it never blocks the Explorer UI or weighs
 * on the initial Explorer execution path.
 *
 * While generating, the button stays focusable but inert (`aria-disabled`,
 * `aria-busy`, busy label) so a second click cannot start a duplicate run;
 * the rest of the page stays usable and nothing navigates. Success is only
 * announced after a Blob exists and its download has been triggered.
 */
export function PrbDossierAction({ dossier, identity }: { dossier: PrbDossierData | null; identity: DossierPublicationIdentity | null }) {
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const available = dossier !== null && identity !== null && identity.corpusFingerprint.length > 0;

  async function download() {
    if (!dossier || !identity || !identity.corpusFingerprint || running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const generation: Omit<DossierGenerationMetadata, "generatedAt"> & { generatedAt: string } = {
        generatedAt: new Date().toISOString(),
        sourceCommit: identity.sourceCommit,
        corpusFingerprint: identity.corpusFingerprint,
      };
      const { generateDossierInWorker } = await import("./pdf/prbDossierWorkerClient");
      const blob = await generateDossierInWorker(dossier, generation);
      saveBlob(blob, prbDossierFileName(dossier.problem.id));
      notify("Dossiê PDF preparado.", "affirmed");
    } catch {
      notify("Não foi possível gerar o dossiê PDF.", "error");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="prb-audit-dossier-cta"
      disabled={!available}
      aria-disabled={!available || busy ? "true" : undefined}
      aria-busy={busy ? "true" : undefined}
      onClick={download}
    >
      {busy ? "A preparar dossiê (PDF)…" : "↓ Descarregar dossiê (PDF)"}
    </button>
  );
}
