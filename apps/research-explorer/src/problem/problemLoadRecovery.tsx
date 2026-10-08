import type { ReactNode } from "react";
import type { DataLoadError, DataLoadErrorKind } from "../dataProvider/types";
import { dataLoadRecovery } from "../presentation/dataLoadRecovery";

const DETAIL_TITLES: Record<DataLoadErrorKind, string> = {
  missing: "Modelo de leitura gerado não encontrado",
  malformed: "Registo mal formado",
  incompatible: "Versão do modelo de leitura incompatível",
  network: "Falha ao carregar o Problema",
  not_found: "Problema não encontrado",
  invalid_id: "Identificador de Problema inválido",
  version_mismatch: "Versão do modelo de leitura incompatível",
};

/** Shared typed recovery for both public PRB views and their record-index load. */
export function problemLoadRecovery(
  error: DataLoadError,
  source: "detail" | "index",
  retry: () => void,
  onBackToRecords: () => void,
  onBackToOverview: () => void,
): { title: string; message: string; action: ReactNode } {
  const title = source === "index" ? "Não foi possível carregar os registos" : DETAIL_TITLES[error.kind];
  if (error.kind === "network" || error.kind === "version_mismatch") {
    return { title, ...dataLoadRecovery(error, retry) };
  }
  const selectionFailure = source === "detail" && (error.kind === "not_found" || error.kind === "invalid_id");
  return {
    title,
    message: error.message,
    action: selectionFailure
      ? <button className="ui-action-outlined" type="button" onClick={onBackToRecords}>Voltar aos registos</button>
      : <button className="ui-action-outlined" type="button" onClick={onBackToOverview}>Voltar à visão geral</button>,
  };
}
