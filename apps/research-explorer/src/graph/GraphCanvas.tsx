import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type Sigma from "sigma";
import type { RenderEdgeAttributes, RenderGraph, RenderNodeAttributes } from "./renderGraph";
import { ErrorNotice } from "../presentation/ErrorNotice";

export interface GraphCanvasHandle {
  resetCamera: () => void;
}

interface GraphCanvasProps {
  graph: RenderGraph;
  onNodeClick: (id: string) => void;
}

/**
 * The one Sigma-touching component in the app. Everything it needs
 * (position, colour, label, edge direction) already lives on the render
 * graph handed to it (renderGraph.ts) — this component owns only Sigma's own
 * instantiation/settings/event wiring, never record/domain interpretation.
 *
 * Sigma renders to a WebGL canvas, which some environments (headless test
 * runners, browsers/contexts without WebGL) cannot provide — that failure is
 * caught and surfaced as an inline message rather than crashing the Graph
 * view, consistent with Graph being a supplementary, not sole, way to reach
 * a fact (development contract's read-only, degrade-safely spirit).
 *
 * The canvas itself is not made a screen-reader graph (an ARIA tree
 * mirroring 100+ nodes would be both infeasible and unhelpful) — it is
 * labelled as a complementary visual, while the same node/edge information
 * is available as ordinary HTML in GraphExplorer's node list and info panel.
 */
export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvas({ graph, onNodeClick }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma<RenderNodeAttributes, RenderEdgeAttributes> | null>(null);
  const onNodeClickRef = useRef(onNodeClick);
  const graphRef = useRef(graph);
  onNodeClickRef.current = onNodeClick;
  graphRef.current = graph;
  const [renderError, setRenderError] = useState<string | null>(null);

  // Sigma instance is created exactly once (empty dep array is intentional —
  // later graph updates go through the separate setGraph effect below, so
  // camera position/zoom survive a focus/depth/filter change instead of
  // resetting every time). Loaded via dynamic import rather than a static
  // top-level import: sigma's module body touches WebGL globals as soon as
  // it is evaluated, which some environments (e.g. jsdom in the test suite)
  // don't provide at all — a static import would crash on load for every
  // consumer of this file, not just when a Sigma instance is actually
  // constructed. Deferring the import to this effect turns that into an
  // ordinary rejected promise, caught below like any other render failure.
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let sigma: Sigma<RenderNodeAttributes, RenderEdgeAttributes> | null = null;

    import("sigma")
      .then(({ default: SigmaCtor }) => {
        if (cancelled || !containerRef.current) return;
        sigma = new SigmaCtor<RenderNodeAttributes, RenderEdgeAttributes>(graphRef.current, containerRef.current, {
          allowInvalidContainer: true,
          renderLabels: true,
          labelRenderedSizeThreshold: 0,
          defaultEdgeType: "arrow",
        });
        sigmaRef.current = sigma;
        sigma.on("clickNode", ({ node }) => onNodeClickRef.current(node));
        sigma.on("enterNode", () => {
          if (containerRef.current) containerRef.current.style.cursor = "pointer";
        });
        sigma.on("leaveNode", () => {
          if (containerRef.current) containerRef.current.style.cursor = "";
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) setRenderError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      cancelled = true;
      sigma?.kill();
      sigmaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sigmaRef.current) {
      sigmaRef.current.setGraph(graph);
    }
  }, [graph]);

  useImperativeHandle(ref, () => ({
    resetCamera: () => {
      sigmaRef.current?.getCamera().animatedReset();
    },
  }));

  if (renderError) {
    return (
      <ErrorNotice
        title="Não foi possível desenhar a representação visual do grafo neste ambiente."
        message="Os Registos e a vista de Problema continuam disponíveis como alternativas completas."
      />
    );
  }

  return <div ref={containerRef} className="graph-canvas" role="img" aria-label="Representação visual do grafo (complementar — ver lista de nós abaixo)" />;
});
