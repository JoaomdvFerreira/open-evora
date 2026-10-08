import type { ReactNode } from "react";
import type { DataLoadError } from "../dataProvider/types";

export const VERSION_MISMATCH_MESSAGE = "Os dados publicados foram atualizados. Recarregue a página antes de continuar.";

export function dataLoadRecovery(error: DataLoadError, retry: () => void): { message: string; action: ReactNode } {
  if (error.kind === "version_mismatch") {
    return {
      message: VERSION_MISMATCH_MESSAGE,
      action: <button className="ui-action-outlined" type="button" onClick={() => window.location.reload()}>Recarregar página</button>,
    };
  }
  return {
    message: error.message,
    action: <button className="ui-action-outlined" type="button" onClick={retry}>Tentar novamente</button>,
  };
}
