import { useEffect, useMemo, useRef, useState } from "react";
import type { DataProvider } from "../dataProvider/types";
import { describeType, formatTypedId } from "../presentation/typeGlossary";
import { normalizeForSearch } from "../records/normalize";
import { recordMatchesQuery, recordSearchText } from "../records/recordIndex";
import { useGraphData } from "./useGraphData";
import {
  MIN_DEPTH,
  canExpand,
  clampDepth,
  computeHopMap,
  neighbourhoodView,
  typesWithinHops,
  type GraphDepth,
} from "./neighbourhood";
import { computeFullCorpusLayout, computeNeighbourhoodLayout } from "./layout";
import { buildRenderGraph } from "./renderGraph";
import { GraphCanvas, type GraphCanvasHandle } from "./GraphCanvas";
import { FOCUS_NODE_COLOR, typeVisual } from "./typeVisuals";
import type { ResearchGraph } from "./buildGraphModel";
import { ProgressMessage } from "../presentation/ProgressMessage";
import { ErrorNotice } from "../presentation/ErrorNotice";
import { ContextTabs } from "../navigation/ContextTabs";

const ERROR_TITLES: Record<string, string> = {
  missing: "Modelo de leitura gerado não encontrado",
  malformed: "Modelo de leitura gerado mal formado",
  incompatible: "Versão do modelo de leitura incompatível",
  network: "Falha ao carregar o grafo",
  not_found: "Registo não encontrado",
  invalid_id: "Identificador de registo inválido",
};

const MAX_SEARCH_RESULTS = 12;

interface EdgeRow {
  key: string;
  from: string;
  to: string;
  field: string;
  ordinal: number | null;
}

function edgeRows(graph: ResearchGraph, edgeIds: string[]): EdgeRow[] {
  return edgeIds.map((key) => {
    const attrs = graph.getEdgeAttributes(key);
    return { key, from: graph.source(key), to: graph.target(key), field: attrs.field, ordinal: attrs.ordinal };
  });
}

interface GraphExplorerProps {
  dataProvider: DataProvider;
  /** URL-synced: the currently focused/selected canonical record, or null before any selection. */
  focusId: string | null;
  /** URL-synced: 1 or 2 hops around the focus. Ignored while the full-corpus view is toggled on. */
  depth: GraphDepth;
  onFocusChange: (id: string) => void;
  onClearFocus: () => void;
  onDepthChange: (depth: GraphDepth) => void;
  onOpenGeneric: (id: string) => void;
  onViewAsProblem: (id: string) => void;
  /** Kept for the dormant Graph surface's shared PRB context switcher. */
  onViewHistory?: (id: string) => void;
}

/**
 * RE-04 Graph Explorer: a neighbourhood-first, supplementary visual
 * exploration mode over the same read model the Records/Problem views use —
 * never the sole route to a fact (see docs/explorerarchitecture.md's primary
 * navigation). The canvas (GraphCanvas.tsx) is the only Sigma-specific piece; everything here
 * is plain record/graph domain logic and ordinary HTML, so every capability
 * (inspect, filter, navigate) also works for a keyboard/screen-reader user
 * via the node/edge lists rendered below the canvas.
 */
export function GraphExplorer({
  dataProvider,
  focusId,
  depth,
  onFocusChange,
  onClearFocus,
  onDepthChange,
  onOpenGeneric,
  onViewAsProblem,
  onViewHistory,
}: GraphExplorerProps) {
  const state = useGraphData(dataProvider);
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const invalidFocusRef = useRef<HTMLDivElement>(null);
  const focusedEntryRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [excludedTypes, setExcludedTypes] = useState<Set<string>>(new Set());
  const [fullCorpusView, setFullCorpusView] = useState(false);

  const searchMatches = useMemo(() => {
    if (state.status !== "ready") return [];
    const q = normalizeForSearch(searchQuery.trim());
    if (q === "") return [];
    return [...state.lookup.values()].filter((record) => recordMatchesQuery(recordSearchText(record), q));
  }, [state, searchQuery]);
  const searchResults = searchMatches.slice(0, MAX_SEARCH_RESULTS);

  const view = useMemo(() => {
    if (state.status !== "ready") return null;
    const { graph } = state;

    if (fullCorpusView) {
      const presentTypes = [...new Set(graph.nodes().map((id) => graph.getNodeAttribute(id, "recordType")))].sort();
      const allowedTypes = excludedTypes.size === 0 ? null : new Set(presentTypes.filter((t) => !excludedTypes.has(t)));
      const nodeIds = allowedTypes ? graph.nodes().filter((id) => allowedTypes.has(graph.getNodeAttribute(id, "recordType"))) : graph.nodes();
      const visible = new Set(nodeIds);
      const edgeIds = graph.filterEdges((_e, _a, source, target) => visible.has(source) && visible.has(target));
      const positions = computeFullCorpusLayout(graph, nodeIds);
      return { nodeIds, edgeIds, positions, presentTypes, hopOf: new Map<string, number>() };
    }

    if (focusId === null || !graph.hasNode(focusId)) {
      return { nodeIds: [], edgeIds: [], positions: new Map(), presentTypes: [], hopOf: new Map<string, number>() };
    }

    const hopOf = computeHopMap(graph, focusId);
    const presentTypes = typesWithinHops(graph, hopOf);
    const allowedTypes = excludedTypes.size === 0 ? null : new Set(presentTypes.filter((t) => !excludedTypes.has(t)));
    const nv = neighbourhoodView(graph, focusId, hopOf, depth, allowedTypes);
    const positions = computeNeighbourhoodLayout(graph, focusId, nv.nodeIds, hopOf);
    return { nodeIds: nv.nodeIds, edgeIds: nv.edgeIds, positions, presentTypes, hopOf };
  }, [state, focusId, depth, excludedTypes, fullCorpusView]);

  const invalidFocus = state.status === "ready" && !fullCorpusView && focusId !== null && !state.graph.hasNode(focusId);

  useEffect(() => {
    if (focusedEntryRef.current) return;
    const target = state.status === "error" ? errorRef.current : invalidFocus ? invalidFocusRef.current : state.status === "ready" ? headingRef.current : null;
    if (target) {
      target.focus();
      focusedEntryRef.current = true;
    }
  }, [invalidFocus, state.status]);

  if (state.status === "loading") {
    return <ProgressMessage message="A carregar dados do grafo…" />;
  }

  if (state.status === "error") {
    return (
      <ErrorNotice
        ref={errorRef}
        tabIndex={-1}
        titleAs="h2"
        title={ERROR_TITLES[state.error.kind] ?? "Não foi possível carregar o grafo"}
        message={state.error.message}
        action={
          <button type="button" onClick={state.retry}>
            Tentar novamente
          </button>
        }
      />
    );
  }

  const { graph, lookup } = state;
  if (invalidFocus) {
    return (
      <section aria-labelledby="graph-heading" className="graph-explorer">
        <h2 id="graph-heading">Grafo</h2>
        <ErrorNotice
          ref={invalidFocusRef}
          tabIndex={-1}
          titleAs="h3"
          title="Registo focado não encontrado"
          message="O identificador no endereço não corresponde a um registo disponível neste grafo."
          action={
            <button type="button" onClick={onClearFocus}>
              Limpar seleção e escolher outro registo
            </button>
          }
        />
      </section>
    );
  }

  const focusSummary = focusId ? lookup.get(focusId) : undefined;
  const expandable = !fullCorpusView && focusId !== null && canExpand(view!.hopOf, depth);
  const canCollapse = !fullCorpusView && depth > MIN_DEPTH;

  function toggleType(type: string) {
    setExcludedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function resetExploration() {
    setExcludedTypes(new Set());
    onDepthChange(MIN_DEPTH);
    canvasRef.current?.resetCamera();
  }

  function handleNodeClick(id: string) {
    if (fullCorpusView) setFullCorpusView(false);
    onFocusChange(id);
  }

  const renderGraph = buildRenderGraph(graph, view!.nodeIds, view!.edgeIds, view!.positions, fullCorpusView ? null : focusId);
  const rows = edgeRows(graph, view!.edgeIds);

  return (
    <section aria-labelledby="graph-heading" className="graph-explorer">
      <h2 ref={headingRef} id="graph-heading" tabIndex={-1}>
        Grafo
      </h2>
      <p>
        Modo de exploração por vizinhança: mostra o registo focado e as suas relações diretas — não o corpus completo. O grafo é
        complementar aos Registos e à vista de Problema, nunca a única forma de aceder a um facto.
      </p>

      {!fullCorpusView && focusSummary?.type === "PRB-" && (
        <ContextTabs prbId={focusSummary.id} active="graph" onOpenGeneric={onOpenGeneric} onViewAsProblem={onViewAsProblem} onViewHistory={onViewHistory ?? (() => undefined)} />
      )}

      <div className="graph-controls">
        <div>
          <label htmlFor="graph-search">Procurar registo para focar</label>
          <input
            id="graph-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="ID, tipo, rótulo…"
          />
          {searchQuery.trim() !== "" && (
            <p aria-live="polite">
              {searchMatches.length} {searchMatches.length === 1 ? "resultado encontrado" : "resultados encontrados"}
              {searchMatches.length > MAX_SEARCH_RESULTS ? `; a mostrar os primeiros ${searchResults.length}` : ""}.
            </p>
          )}
          {searchResults.length > 0 && (
            <ul aria-label="Resultados da pesquisa">
              {searchResults.map((record) => (
                <li key={record.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onFocusChange(record.id);
                      setSearchQuery("");
                      setFullCorpusView(false);
                    }}
                  >
                    {formatTypedId(record.type, record.id)} — {record.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <button type="button" onClick={() => onDepthChange(clampDepth(depth - 1))} disabled={!canCollapse}>
            Recolher (−1 salto)
          </button>{" "}
          <button type="button" onClick={() => onDepthChange(clampDepth(depth + 1))} disabled={!expandable}>
            Expandir (+1 salto)
          </button>{" "}
          <span aria-live="polite">{fullCorpusView ? "Corpus completo" : `${depth} ${depth === 1 ? "salto" : "saltos"}`}</span>
        </div>

        <div>
          <button type="button" onClick={resetExploration} disabled={fullCorpusView}>
            Repor exploração
          </button>{" "}
          <button type="button" onClick={onClearFocus} disabled={focusId === null}>
            Limpar seleção
          </button>{" "}
          <label>
            <input type="checkbox" checked={fullCorpusView} onChange={(event) => setFullCorpusView(event.target.checked)} />
            {" "}Ver corpus completo ({graph.order} registos) — vista alternativa, não é o modo predefinido
          </label>
        </div>

        {view!.presentTypes.length > 0 && (
          <fieldset>
            <legend>Filtrar tipos visíveis</legend>
            {view!.presentTypes.map((type) => (
              <label key={type}>
                <input type="checkbox" checked={!excludedTypes.has(type)} onChange={() => toggleType(type)} />
                {" "}
                <code>{type}</code> — {describeType(type).label}
              </label>
            ))}
          </fieldset>
        )}
      </div>

      {focusId === null && !fullCorpusView ? (
        <p>Procure e selecione um registo acima para começar a explorar a sua vizinhança no grafo.</p>
      ) : (
        <>
          <p aria-live="polite">
            {view!.nodeIds.length} {view!.nodeIds.length === 1 ? "nó visível" : "nós visíveis"} · {rows.length}{" "}
            {rows.length === 1 ? "relação visível" : "relações visíveis"}.
          </p>

          <GraphCanvas ref={canvasRef} graph={renderGraph} onNodeClick={handleNodeClick} />

          <section aria-label="Legenda de tipos">
            <h3>Legenda</h3>
            <ul className="graph-legend">
              <li>
                <span className="graph-legend-swatch" style={{ backgroundColor: FOCUS_NODE_COLOR }} aria-hidden="true" /> Registo focado
                (contorno maior)
              </li>
              {view!.presentTypes.map((type) => (
                <li key={type}>
                  <span className="graph-legend-swatch" style={{ backgroundColor: typeVisual(type).color }} aria-hidden="true" />{" "}
                  <code>{type}</code> — {describeType(type).label}
                </li>
              ))}
            </ul>
            <p>
              A cor identifica o tipo, mas nunca é o único indicador: cada nó mostra sempre o seu identificador completo (com o prefixo
              do tipo) como rótulo.
            </p>
          </section>

          {focusSummary && (
            <section aria-labelledby="graph-focus-heading" className="graph-focus-panel">
              <h3 id="graph-focus-heading">Registo focado</h3>
              <dl>
                <dt>ID</dt>
                <dd>{formatTypedId(focusSummary.type, focusSummary.id)}</dd>
                <dt>Rótulo</dt>
                <dd>{focusSummary.label}</dd>
              </dl>
              <p>
                <button type="button" onClick={() => onOpenGeneric(focusSummary.id)}>
                  Ver detalhe do registo
                </button>{" "}
                {focusSummary.type === "PRB-" && (
                  <button type="button" onClick={() => onViewAsProblem(focusSummary.id)}>
                    Ver como Problema (contexto completo)
                  </button>
                )}
              </p>
            </section>
          )}

          <section aria-labelledby="graph-nodes-heading">
            <h3 id="graph-nodes-heading">Nós visíveis</h3>
            {view!.nodeIds.length === 0 ? (
              <p>Nenhum nó visível com os filtros atuais.</p>
            ) : (
              <ul>
                {view!.nodeIds.map((id) => {
                  const summary = lookup.get(id);
                  const hop = view!.hopOf.get(id);
                  return (
                    <li key={id}>
                      <button type="button" aria-pressed={id === focusId} onClick={() => handleNodeClick(id)}>
                        {id === focusId ? "● " : ""}
                        {summary ? `${formatTypedId(summary.type, summary.id)} — ${summary.label}` : id}
                      </button>
                      {!fullCorpusView && hop !== undefined && hop > 0 && <span> ({hop} {hop === 1 ? "salto" : "saltos"})</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="graph-edges-heading">
            <h3 id="graph-edges-heading">Relações visíveis</h3>
            <p>
              Uma referência indica apenas que um registo aponta para outro através desse campo — não implica apoio, contradição ou
              causalidade.
            </p>
            {rows.length === 0 ? (
              <p>Nenhuma relação visível com os filtros atuais.</p>
            ) : (
              <div className="graph-edges-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Origem</th>
                      <th scope="col">Destino</th>
                      <th scope="col">Referência canónica</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const from = lookup.get(row.from);
                      const to = lookup.get(row.to);
                      return (
                        <tr key={row.key}>
                          <td>
                            <button type="button" onClick={() => handleNodeClick(row.from)}>
                              {from ? formatTypedId(from.type, from.id) : row.from}
                            </button>
                          </td>
                          <td>
                            <button type="button" onClick={() => handleNodeClick(row.to)}>
                              {to ? formatTypedId(to.type, to.id) : row.to}
                            </button>
                          </td>
                          <td>
                            através de <code>{row.field}</code>
                            {row.ordinal !== null ? `[${row.ordinal}]` : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
