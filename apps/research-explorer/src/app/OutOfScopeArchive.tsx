import { useEffect, useState } from "react";
import type { DataProvider } from "../dataProvider/types";
import { publicEnumLabel } from "../presentation/presentation";
import { ErrorNotice } from "../presentation/ErrorNotice";

interface ArchivedProblem {
  id: string;
  title: string;
  closureReason: string;
}

export function OutOfScopeArchive({ dataProvider }: { dataProvider: DataProvider }) {
  const [entries, setEntries] = useState<ArchivedProblem[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setError(null);
    dataProvider.listRecords().then(async (records) => {
      const problems = records.filter((record) => record.type === "PRB-");
      const details = await Promise.all(problems.map((summary) => dataProvider.getRecord(summary.id)));
      const archived = details.flatMap((detail) => {
        const record = detail.record;
        const closure = typeof record.closure === "object" && record.closure !== null
          ? record.closure as Record<string, unknown>
          : {};
        if (record.status !== "CLOSED" || closure.reason !== "OUT_OF_SCOPE") return [];
        return [{ id: detail.id, title: typeof record.title === "string" ? record.title : detail.id, closureReason: "OUT_OF_SCOPE" }];
      }).sort((a, b) => a.id.localeCompare(b.id));
      if (!cancelled) setEntries(archived);
    }).catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError : new Error("Falha ao carregar os registos."));
    });
    return () => { cancelled = true; };
  }, [dataProvider, attempt]);

  if (error) {
    return <ErrorNotice titleAs="h2" title="Não foi possível carregar o arquivo" message={error.message} action={<button type="button" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button>} />;
  }
  if (entries === null) return <p role="status">A carregar registos…</p>;
  if (entries.length === 0) return <p>Não existem registos fora do âmbito neste conjunto de dados.</p>;

  return <dl className="info-facts out-of-scope-archive-list">
    {entries.map((entry) => <div key={entry.id}>
      <dt>{entry.id}</dt>
      <dd>
        <a href={`/?view=problem&id=${encodeURIComponent(entry.id)}`}>{entry.title}</a>
        <p>{publicEnumLabel("closure.reason", entry.closureReason)}</p>
      </dd>
    </div>)}
  </dl>;
}
