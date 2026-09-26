import { useEffect, useRef, type ReactNode } from "react";
import { ExplorerHeader } from "./ExplorerHeader";

const GITHUB_ISSUES_URL = "https://github.com/JoaomdvFerreira/open-evora/issues";

type TrustPagePath = "/about" | "/methodology" | "/corrections" | "/contact" | "/privacy";

interface TrustPageContent {
  heading: string;
  summary: string;
  body: ReactNode;
}

export interface TrustPageEntry extends TrustPageContent {
  path: TrustPagePath;
}

/** The Information area's one ordered sequence: it drives the local
 * navigation and the previous/next navigation alike. */
const TRUST_NAVIGATION: Array<{ path: TrustPagePath; label: string }> = [
  { path: "/about", label: "Sobre" },
  { path: "/methodology", label: "Metodologia" },
  { path: "/corrections", label: "Correções" },
  { path: "/contact", label: "Contacto" },
  { path: "/privacy", label: "Privacidade" },
];

/** Global-header item each Information page represents: Metodologia is the
 * destination behind the header's Método; every other page sits under Sobre. */
export function trustHeaderView(path: TrustPagePath): "methodology" | "about" {
  return path === "/methodology" ? "methodology" : "about";
}

/* ---- Information presentation primitives --------------------------------- */

function InfoSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section className="info-section" aria-labelledby={id}><h2 id={id} className="info-section-title">{title}</h2>{children}</section>;
}

function InfoFacts({ facts }: { facts: Array<[label: string, value: ReactNode]> }) {
  return <dl className="info-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function InfoSteps({ steps }: { steps: string[] }) {
  return <ol className="info-steps">{steps.map((step, index) => <li key={step} className="info-step"><span className="info-step-number">{String(index + 1).padStart(2, "0")}</span><span className="info-step-connector" aria-hidden="true" /><span className="info-step-label">{step}</span></li>)}</ol>;
}

function InfoNumberedList({ items }: { items: string[] }) {
  return <ol className="info-numbered">{items.map((item) => <li key={item}>{item}</li>)}</ol>;
}

function InfoAction({ href, children }: { href: string; children: string }) {
  return <p className="info-action"><a className="info-action-link" href={href}>{children}<span aria-hidden="true"> ↗</span></a></p>;
}

const TRUST_PAGES: Record<TrustPagePath, TrustPageContent> = {
  "/about": {
    heading: "Sobre o Open Évora",
    summary: "Um projeto independente.",
    body: <>
      <InfoSection id="about-accountability" title="Responsabilidade">
        <InfoFacts facts={[
          ["Responsável", "Projeto Open Évora"],
          ["Independência", "Projeto independente, sem ligação à autarquia"],
          ["Financiamento", "Autofinanciado"],
        ]} />
      </InfoSection>
      <InfoSection id="about-publication" title="Como é publicado">
        <InfoSteps steps={["Corpus de investigação com controlo de versões", "Validação e revisão", "Publicação no Explorador de Investigação"]} />
        <p className="info-closing">A proveniência, as limitações e a incerteza são apresentadas de forma explícita.</p>
      </InfoSection>
    </>,
  },
  "/methodology": {
    heading: "Metodologia",
    summary: "Como o Explorador de Investigação apresenta investigação e evidência.",
    body: <>
      <p>O Explorador de Investigação organiza investigação a partir de fontes identificadas e evidência rastreável. Sempre que relevante, distingue:</p>
      <InfoFacts facts={[
        ["Factos observados", "O que está registado diretamente numa fonte."],
        ["Evidência local", "Observação no terreno, documentada e datada."],
        ["Fontes externas", "Documentos, dados e publicações de terceiros."],
        ["Inferências", "Conclusões retiradas da evidência, assinaladas como tal."],
        ["Limitações", "O que a informação disponível não permite afirmar."],
      ]} />
      <InfoSection id="methodology-validation" title="Validação">
        <p>Os registos são sujeitos a validação antes de serem integrados no conjunto de dados canónico e publicados.</p>
        <p>A existência de uma fonte não significa que todas as conclusões possíveis a partir dessa fonte estejam estabelecidas; o Explorador procura tornar explícitos o âmbito e os limites da evidência apresentada.</p>
      </InfoSection>
    </>,
  },
  "/corrections": {
    heading: "Correções",
    summary: "Como sinalizar informação que deve ser revista.",
    body: <>
      <p>Se encontrar informação incorreta, desatualizada, uma fonte problemática ou uma interpretação que deva ser revista, pode reportá-la através do <a href={GITHUB_ISSUES_URL}>GitHub Issues do projeto Open Évora</a>.</p>
      <InfoSection id="corrections-include" title="O que incluir">
        <InfoNumberedList items={[
          "A página ou registo em causa — de preferência com o ID (ex. PRB-0005).",
          "O ponto que considera incorreto.",
          "Uma fonte ou explicação que permita verificar a correção.",
        ]} />
      </InfoSection>
      <InfoAction href={GITHUB_ISSUES_URL}>Reportar correção no GitHub</InfoAction>
    </>,
  },
  "/contact": {
    heading: "Contacto",
    summary: "Canais públicos para questões e sugestões.",
    body: <>
      <InfoFacts facts={[
        ["Questões e sugestões", <a href={GITHUB_ISSUES_URL}>Issues do repositório do projeto</a>],
        ["Correções factuais", <>Ver o processo em <a href="/corrections">Correções</a></>],
      ]} />
      <p className="info-notice" role="note"><strong>Atenção:</strong> Evite publicar dados pessoais ou informação sensível num issue público.</p>
      <InfoAction href={GITHUB_ISSUES_URL}>Abrir issue no GitHub</InfoAction>
    </>,
  },
  "/privacy": {
    heading: "Privacidade",
    summary: "O que é necessário para consultar o Explorador de Investigação.",
    body: <>
      <InfoFacts facts={[
        ["Conta", "Não é necessária."],
        ["Dados pessoais", "Não são pedidos diretamente pelo Open Évora."],
        ["Alojamento", "Infraestrutura de terceiros."],
        ["Dados técnicos", "Endereços IP e registos de acesso, processados pelo alojamento para funcionamento e segurança, segundo as respetivas políticas."],
      ]} />
      <InfoSection id="privacy-commitment" title="Compromisso">
        <p>O Open Évora não deve introduzir formulários de recolha de dados pessoais, analytics adicionais, cookies não essenciais ou mecanismos semelhantes sem rever e atualizar previamente esta informação.</p>
      </InfoSection>
    </>,
  },
};

export function trustPageForPath(pathname: string): TrustPageEntry | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  if (!Object.prototype.hasOwnProperty.call(TRUST_PAGES, normalized)) return null;
  const path = normalized as TrustPagePath;
  return { path, ...TRUST_PAGES[path] };
}

/**
 * Local INFORMAÇÃO navigation: one list for every width. It is a vertical
 * sidebar at >=1024px and a horizontally scrollable strip below that
 * (information.css); on mount the current item is scrolled into the strip's
 * visible range so a later item (Privacidade) is not left off-screen at 360.
 */
function InformationNavigation({ currentPath }: { currentPath: TrustPagePath }) {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const current = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !current || list.scrollWidth <= list.clientWidth) return;
    const overflow = current.offsetLeft + current.offsetWidth - list.clientWidth;
    if (overflow > 0) list.scrollLeft = overflow;
  }, [currentPath]);
  return <nav className="info-navigation" aria-label="Informação sobre o Open Évora"><p className="info-navigation-title">Informação</p><ul ref={listRef}>{TRUST_NAVIGATION.map(({ path, label }) => <li key={path}><a href={path} aria-current={currentPath === path ? "page" : undefined}>{label}</a></li>)}</ul></nav>;
}

/** Previous/next through the same ordered sequence; the first page has no
 * previous and the last no next. */
function InformationSequence({ currentPath }: { currentPath: TrustPagePath }) {
  const index = TRUST_NAVIGATION.findIndex(({ path }) => path === currentPath);
  const previous = TRUST_NAVIGATION[index - 1];
  const next = TRUST_NAVIGATION[index + 1];
  return <nav className="info-sequence" aria-label="Páginas de informação">
    {previous && <a className="info-sequence-link info-sequence-link--previous" href={previous.path} rel="prev"><span className="info-sequence-direction"><span aria-hidden="true">← </span>Anterior</span><span className="info-sequence-label">{previous.label}</span></a>}
    {next && <a className="info-sequence-link info-sequence-link--next" href={next.path} rel="next"><span className="info-sequence-direction">Seguinte<span aria-hidden="true"> →</span></span><span className="info-sequence-label">{next.label}</span></a>}
  </nav>;
}

/**
 * The shared Information shell (Sobre, Metodologia, Correções, Contacto,
 * Privacidade): the global ExplorerHeader, the local INFORMAÇÃO navigation,
 * the page header, the page's own content and the previous/next sequence.
 * The shared PublicFooter follows it in App.tsx.
 *
 * F06: `skipTargetId`, when supplied, lands on the `<article>` — after the
 * global header and this page's own `info-navigation` in document order — so
 * App.tsx's skip link bypasses both navigations, never a second competing
 * main landmark.
 */
export function TrustPage({ page, skipTargetId }: { page: TrustPageEntry; skipTargetId?: string }) {
  return <>
    <ExplorerHeader activeView={trustHeaderView(page.path)} />
    <div className="info-page shell-frame shell-frame--wide">
      <InformationNavigation currentPath={page.path} />
      <article id={skipTargetId} tabIndex={skipTargetId ? -1 : undefined} className="info-article">
        <p className="info-back"><a href="/">← Explorar problemas</a></p>
        <h1 className="info-title">{page.heading}</h1>
        <p className="info-summary">{page.summary}</p>
        <div className="info-content">{page.body}</div>
        <InformationSequence currentPath={page.path} />
      </article>
    </div>
  </>;
}

/**
 * Editorial footer (Overview final redesign, Phase 3B §6; converged to a
 * two-region horizontal distribution in the visual-completion pass, task
 * §13): identity/supporting copy on the left, PROJETO and DADOS grouped into
 * one `.public-footer-groups` unit pushed to the right — rather than three
 * areas independently distributed across the width — so the two navigation
 * columns read as a single right-hand group with their own internal ~56px
 * gap. Global — rendered beneath the Explorer and every TrustPage (App.tsx)
 * — so it does not depend on `.public-overview` being present; the
 * Overview-specific zero-gap treatment lives entirely in index.css and stays
 * additive to this structure. Every link below is a real existing
 * destination: `Registos` opens the same complete Records area as the
 * header's Registos action, as an ordinary path/query navigation (this is a
 * cross-page footer, not the live Explorer's own SPA state).
 */
export function PublicFooter() {
  return (
    <footer className="public-footer" aria-label="Informação sobre o Open Évora">
      <div className="public-footer-inner shell-frame shell-frame--wide">
        <div className="public-footer-identity">
          <p className="public-footer-brand">Open Évora</p>
          <p className="public-footer-summary">Projecto independente de investigação cívica. Sem ligação à autarquia. Todo o conteúdo remete para fontes verificáveis.</p>
        </div>
        <div className="public-footer-groups">
          <nav className="public-footer-group" aria-label="Projeto">
            <p>Projeto</p>
            <ul>
              <li><a href="/methodology">Método</a></li>
              <li><a href="/about">Sobre</a></li>
              <li><a href="/corrections">Correções</a></li>
            </ul>
          </nav>
          <nav className="public-footer-group" aria-label="Dados">
            <p>Dados</p>
            <ul>
              <li><a href="/?view=records">Registos</a></li>
              <li><a href="/contact">Contactar</a></li>
              <li><a href="/privacy">Privacidade</a></li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
