import { useEffect, useState } from "react";
import type { DataProvider } from "../dataProvider/types";
import { StaticDataProvider } from "../dataProvider/StaticDataProvider";
import { loadExplorerStartupState, type ExplorerStartupState } from "./startup";
import { Explorer } from "./Explorer";
import { ProgressMessage } from "../presentation/ProgressMessage";
import { ErrorNotice } from "../presentation/ErrorNotice";
import { PublicFooter, TrustPage, trustPageForPath } from "./TrustPage";

/**
 * F06: the skip link's real destination — after ExplorerHeader's global
 * navigation in document order (Explorer.tsx places its own focusable node
 * with this id right after the header), not the top of the shared
 * `<main id="main-content">` landmark that still wraps both. The
 * loading/error/trust-page branches below each supply their own element
 * with this id too, since ExplorerHeader isn't mounted in those states.
 */
export const SKIP_TARGET_ID = "explorer-content-start";

const defaultProvider: DataProvider = new StaticDataProvider();

const ERROR_TITLES: Record<string, string> = {
  missing: "Modelo de leitura gerado não encontrado",
  malformed: "Modelo de leitura gerado mal formado",
  incompatible: "Versão do modelo de leitura incompatível",
  network: "Não foi possível carregar o modelo de leitura gerado",
  not_found: "Registo não encontrado",
  invalid_id: "Identificador de registo inválido",
};

interface AppProps {
  dataProvider?: DataProvider;
}

export function App({ dataProvider = defaultProvider }: AppProps) {
  const trustPage = trustPageForPath(window.location.pathname);
  const [state, setState] = useState<ExplorerStartupState | { status: "loading" }>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (trustPage) return;
    let cancelled = false;
    setState({ status: "loading" });
    loadExplorerStartupState(dataProvider).then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, [dataProvider, attempt, trustPage]);

  return (
    <>
      <a className="skip-link" href={`#${SKIP_TARGET_ID}`} onClick={() => document.getElementById(SKIP_TARGET_ID)?.focus()}>
        Saltar para o conteúdo
      </a>
      <main id="main-content" className="explorer-shell">
        {trustPage ? <TrustPage page={trustPage} skipTargetId={SKIP_TARGET_ID} /> : <>
        {state.status === "loading" && (
          <div id={SKIP_TARGET_ID} tabIndex={-1} className="shell-frame">
            <ProgressMessage message="A carregar modelo de leitura gerado…" />
          </div>
        )}

        {state.status === "error" && (
          <div className="shell-frame">
            <ErrorNotice
              id={SKIP_TARGET_ID}
              tabIndex={-1}
              titleAs="h2"
              title={ERROR_TITLES[state.error.kind] ?? "Não foi possível carregar o Explorer"}
              message={state.error.message}
              action={
                <button type="button" onClick={() => setAttempt((value) => value + 1)}>
                  Tentar novamente
                </button>
              }
            />
          </div>
        )}

        {state.status === "ready" && (
          <Explorer
            dataProvider={dataProvider}
            schemaPrefixes={state.manifest.schemaPrefixes}
            totalRecords={state.manifest.totalRecords}
            generatedAt={state.manifest.generatedAt}
          />
        )}</>}
      </main>
      <PublicFooter />
    </>
  );
}

export default App;
