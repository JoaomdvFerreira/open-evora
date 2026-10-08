import { createElement, type ReactElement } from "react";
import { pdf, type DocumentProps } from "@react-pdf/renderer";
import type { PrbDossierData } from "../prbDossierProjection";
import { buildDossierDocumentModel } from "./dossierPresentation";
import { registerDossierFonts } from "./dossierFonts";
import { PrbDossierDocument } from "./PrbDossierDocument";
import type { DossierGenerationMetadata } from "./dossierPresentation";

/**
 * Client-side PDF generation entry point — the only module the PRB page
 * loads on demand (dynamic `import()`), so React-PDF and the dossier layout
 * stay out of the initial Explorer bundle.
 *
 * `PrbDossierData -> document model -> React-PDF -> Blob`. The generation
 * timestamp is captured here, once per call, and only flows into the
 * document's audit metadata; it never touches research ordering or content.
 */

export async function generatePrbDossierPdf(dossier: PrbDossierData, generation: DossierGenerationMetadata): Promise<Blob> {
  await registerDossierFonts();
  const model = buildDossierDocumentModel(dossier, generation);
  // PrbDossierDocument renders a <Document> root; React-PDF types its input as that root element.
  const root = createElement(PrbDossierDocument, { model }) as unknown as ReactElement<DocumentProps>;
  const blob = await pdf(root).toBlob();
  if (blob.size === 0) throw new Error("Empty PDF output");
  return blob;
}
