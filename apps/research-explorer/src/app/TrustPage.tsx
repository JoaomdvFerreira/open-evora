import type { ReactNode } from "react";
import { Logo } from "../presentation/Logo";

const GITHUB_ISSUES_URL = "https://github.com/JoaomdvFerreira/open-evora/issues";

type TrustPagePath = "/about" | "/methodology" | "/corrections" | "/contact" | "/privacy";

interface TrustPageContent {
  heading: string;
  summary: string;
  body: ReactNode;
}

const TRUST_NAVIGATION: Array<{ path: TrustPagePath; label: string }> = [
  { path: "/about", label: "Sobre" },
  { path: "/methodology", label: "Metodologia" },
  { path: "/corrections", label: "Correções" },
  { path: "/contact", label: "Contacto" },
  { path: "/privacy", label: "Privacidade" },
];

const TRUST_PAGES: Record<TrustPagePath, TrustPageContent> = {
  "/about": {
    heading: "Sobre o Open Évora",
    summary: "Um projeto independente.",
    body: <><section aria-labelledby="about-accountability"><h2 id="about-accountability">Responsabilidade</h2><dl className="trust-facts"><div><dt>Responsável</dt><dd>Projeto Open Évora</dd></div><div><dt>Independência</dt><dd>Projeto independente</dd></div><div><dt>Financiamento</dt><dd>Autofinanciado</dd></div></dl></section><section aria-labelledby="about-publication"><h2 id="about-publication">Como é publicado</h2><p>O conteúdo é proveniente do corpus de investigação com controlo de versões, passa pelo processo existente de validação e revisão e é publicado através do Explorador de Investigação. A proveniência, as limitações e a incerteza são apresentadas de forma explícita.</p></section></>,
  },
  "/methodology": {
    heading: "Metodologia",
    summary: "Como o Explorador de Investigação apresenta investigação e evidência.",
    body: <><p>O Explorador de Investigação organiza investigação a partir de fontes identificadas e evidência rastreável. Sempre que relevante, distingue factos observados, evidência local, fontes externas, inferências e limitações da informação disponível.</p><p>Os registos são sujeitos a validação antes de serem integrados no conjunto de dados canónico e publicados. A existência de uma fonte não significa que todas as conclusões possíveis a partir dessa fonte estejam estabelecidas; o Explorador procura tornar explícitos o âmbito e os limites da evidência apresentada.</p></>,
  },
  "/corrections": {
    heading: "Correções",
    summary: "Como sinalizar informação que deve ser revista.",
    body: <><p>Se encontrar informação incorreta, desatualizada, uma fonte problemática ou uma interpretação que deva ser revista, pode reportá-la através do <a href={GITHUB_ISSUES_URL}>GitHub Issues do projeto Open Évora</a>.</p><p>Indique, sempre que possível, a página ou registo em causa, o ponto que considera incorreto e uma fonte ou explicação que permita verificar a correção.</p></>,
  },
  "/contact": {
    heading: "Contacto",
    summary: "Canais públicos para questões e sugestões.",
    body: <><p>Para questões, sugestões ou problemas relacionados com o Open Évora, utilize o <a href={GITHUB_ISSUES_URL}>canal público de Issues do repositório do projeto</a>.</p><p>Para reportar uma correção factual, utilize preferencialmente o processo descrito na página <a href="/corrections">Correções</a>. Evite publicar dados pessoais ou informação sensível num issue público.</p></>,
  },
  "/privacy": {
    heading: "Privacidade",
    summary: "O que é necessário para consultar o Explorador de Investigação.",
    body: <><p>O Explorador de Investigação pode ser consultado sem criar uma conta ou fornecer diretamente dados pessoais ao Open Évora.</p><p>O serviço é alojado através de infraestrutura de terceiros, que pode processar dados técnicos necessários ao funcionamento e segurança do serviço, como endereços IP e registos de acesso, de acordo com as respetivas políticas.</p><p>O Open Évora não deve introduzir formulários de recolha de dados pessoais, analytics adicionais, cookies não essenciais ou mecanismos semelhantes sem rever e atualizar previamente esta informação.</p></>,
  },
};

export function trustPageForPath(pathname: string): TrustPageContent | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  return Object.prototype.hasOwnProperty.call(TRUST_PAGES, normalized) ? TRUST_PAGES[normalized as TrustPagePath] : null;
}

/**
 * F06: `skipTargetId`, when supplied, lands on the `<article>` — after this
 * page's own `trust-navigation` in document order — so App.tsx's skip link
 * bypasses trust-page navigation exactly as it bypasses ExplorerHeader on the
 * live Explorer, never a second competing main landmark.
 */
export function TrustPage({ page, skipTargetId }: { page: TrustPageContent; skipTargetId?: string }) {
  const currentPath = TRUST_NAVIGATION.find(({ path }) => TRUST_PAGES[path] === page)?.path;
  return <div className="trust-experience shell-frame"><header className="trust-header"><a href="/" className="trust-brand" aria-label="Open Évora — Explorador de Investigação"><Logo form="full" /><span>Explorador de Investigação</span></a></header><div className="trust-layout"><nav className="trust-navigation" aria-label="Informação sobre o Open Évora"><p>Informação</p><ul>{TRUST_NAVIGATION.map(({ path, label }) => <li key={path}><a href={path} aria-current={currentPath === path ? "page" : undefined}>{label}</a></li>)}</ul></nav><article id={skipTargetId} tabIndex={skipTargetId ? -1 : undefined} className="trust-page"><p className="trust-back"><a href="/">← Explorar problemas</a></p><h1>{page.heading}</h1><p className="trust-summary">{page.summary}</p><div className="trust-content">{page.body}</div></article></div></div>;
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
 * destination: `Fontes` opens the same Records+SRC- filtered set as the
 * header's Fontes action, as an ordinary path/query navigation (this is a
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
              <li><a href="/?view=records&type=SRC-">Fontes</a></li>
              <li><a href="/contact">Contactar</a></li>
              <li><a href="/privacy">Privacidade</a></li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
