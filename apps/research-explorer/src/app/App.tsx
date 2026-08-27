import { useEffect, useState } from "react";
import type { DataProvider } from "../dataProvider/types";
import { StaticDataProvider } from "../dataProvider/StaticDataProvider";
import { loadExplorerStartupState, type ExplorerStartupState } from "./startup";
import { Explorer } from "./Explorer";
import { formatPublicCount, formatPublicDateTime } from "../presentation/presentation";

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
  const [state, setState] = useState<ExplorerStartupState | { status: "loading" }>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadExplorerStartupState(dataProvider).then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, [dataProvider, attempt]);

  return (
    <>
      <a className="skip-link" href="#main-content" onClick={() => document.getElementById("main-content")?.focus()}>
        Saltar para o conteúdo
      </a>
      <main id="main-content" className="explorer-shell" tabIndex={-1}>
        {state.status === "loading" && (
          <p role="status" aria-live="polite">
            A carregar modelo de leitura gerado…
          </p>
        )}

        {state.status === "error" && (
          <div role="alert">
            <h2>{ERROR_TITLES[state.error.kind] ?? "Não foi possível carregar o Explorer"}</h2>
            <p>{state.error.message}</p>
            <button type="button" onClick={() => setAttempt((value) => value + 1)}>
              Tentar novamente
            </button>
          </div>
        )}

        {state.status === "ready" && (
          <>
            <Explorer dataProvider={dataProvider} schemaPrefixes={state.manifest.schemaPrefixes} />
            <p className="manifest-summary">
              Corpus: {formatPublicCount(state.manifest.totalRecords)} registos · gerado em{" "}
              <time dateTime={state.manifest.generatedAt}>{formatPublicDateTime(state.manifest.generatedAt)}</time>
            </p>
          </>
        )}
      </main>
    </>
  );
}

export default App;
