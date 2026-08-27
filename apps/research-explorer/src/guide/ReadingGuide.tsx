import { useEffect, useRef } from "react";
import { describeType, knownTypePrefixes } from "../presentation/typeGlossary";

interface ReadingGuideProps {
  /** manifest.schemaPrefixes — the types actually present in the loaded corpus, so a future schema-conforming type appears here automatically with no code change. Falls back to the known-type list if the manifest isn't loaded yet. */
  schemaPrefixes?: string[];
}

/**
 * "Como ler o Explorer" — a lightweight, reusable orientation panel. Explains
 * record-type prefixes, relationship direction (Entradas/Saídas), and
 * canonical reference-path notation, and states explicitly that a reference
 * never implies support/contradiction/causality unless canonical data
 * encodes that meaning itself (see AGENTS.md's evidence-integrity safeguard).
 *
 * The type list is data-driven (schemaPrefixes, typically manifest.schemaPrefixes)
 * rather than hardcoded to the current five types, so an unknown future type
 * appears automatically — describeType() supplies a graceful generic entry
 * for any prefix it doesn't recognise.
 */
export function ReadingGuide({ schemaPrefixes }: ReadingGuideProps) {
  const prefixes = schemaPrefixes && schemaPrefixes.length > 0 ? schemaPrefixes : knownTypePrefixes();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // A `#reading-guide` link targets this `<details>` element itself, not
  // content inside it — the browser's native fragment-reveal algorithm only
  // auto-opens an ancestor `<details>` when the target is hidden *inside*
  // it, so a plain anchor jump here leaves the disclosure visibly collapsed
  // even though navigation "succeeded". Point-of-use links (e.g. Problem
  // View's "Ver a Orientação completa do Explorer") rely on this actually
  // opening the guide, so it's opened explicitly on mount and on any later
  // hash change to `#reading-guide`.
  useEffect(() => {
    const openIfTargeted = () => {
      if (window.location.hash === "#reading-guide" && detailsRef.current) {
        detailsRef.current.open = true;
      }
    };
    openIfTargeted();
    window.addEventListener("hashchange", openIfTargeted);
    return () => window.removeEventListener("hashchange", openIfTargeted);
  }, []);

  return (
    <details className="reading-guide" id="reading-guide" ref={detailsRef}>
      <summary>Como ler o Explorer</summary>

      <h2>Orientação do Explorer</h2>

      <h3>Tipos de registo</h3>
      <dl>
        {prefixes.map((prefix) => {
          const { label, description } = describeType(prefix);
          return (
            <div key={prefix}>
              <dt>
                <code>{prefix}</code> — {label}
              </dt>
              <dd>{description}</dd>
            </div>
          );
        })}
      </dl>

      <h3>Entradas e Saídas</h3>
      <p>
        <strong>Saídas</strong> são referências que este registo faz a outros registos (ex.: um Problema que lista a sua Evidência).{" "}
        <strong>Entradas</strong> são referências que outros registos fazem a este (ex.: uma Evidência que aponta para a Fonte de onde foi extraída).
      </p>

      <h3>Registos relacionados e caminhos de referência canónica</h3>
      <p>
        O número de <strong>registos relacionados</strong> conta cada registo distinto uma única vez, mesmo quando existe mais do que um{" "}
        <strong>caminho de referência canónica</strong> entre os dois registos — por exemplo, entrada e saída para o mesmo registo, ou mais
        do que um campo. É normal e legítimo que o mesmo registo tenha caminhos nas duas direções; nesse caso aparece uma vez como registo
        relacionado, com todos os seus caminhos exatos listados por baixo.
      </p>
      <p>
        O texto após <em>"através de"</em> (ex.: <code>evidence[0].evidence_id</code>) indica o campo exato do registo canónico de onde a
        referência provém, e a posição na lista quando aplicável (<code>[0]</code>, <code>[1]</code>, …). É o caminho real no ficheiro YAML
        de origem.
      </p>

      <p>
        <strong>Uma referência indica apenas que um registo aponta para outro através desse campo.</strong> Não significa, por si só,
        que um apoia, contradiz ou causa o outro — esse significado só é apresentado quando estiver explicitamente codificado nos dados
        canónicos.
      </p>

      <h3>Grafo</h3>
      <p>
        A vista de Grafo mostra o mesmo conjunto de referências, de forma visual e complementar — nunca a única forma de aceder a um
        facto; os Registos e a vista de Problema continuam completos sem o Grafo. Por predefinição mostra apenas a vizinhança do registo
        focado (1 ou 2 saltos), não o corpus inteiro.
      </p>
      <p>
        As setas nas ligações indicam a direção da referência canónica (de quem referencia para quem é referenciado) — o mesmo sentido
        de "Saídas"/"Entradas" descrito acima. A cor de um nó identifica o seu tipo de registo, mas nunca é o único indicador: cada nó
        mostra sempre o seu identificador completo (com o prefixo do tipo) como rótulo, e a lista de nós e relações abaixo do grafo repete
        a mesma informação em HTML normal, navegável pelo teclado.
      </p>
      <p>
        Tal como no resto do Explorer, uma ligação no grafo <strong>não implica apoio, contradição ou causalidade</strong> — apenas que
        um registo referencia outro através de um campo específico, visível ao inspecionar essa relação.
      </p>
    </details>
  );
}
