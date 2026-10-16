import { useEffect, useRef, type ReactNode } from "react";
import { ContributionForm } from "./ContributionForm";
import { ExplorerHeader } from "./ExplorerHeader";
import { documentTitle } from "./documentTitle";
import type { DataProvider } from "../dataProvider/types";
import { OutOfScopeArchive } from "./OutOfScopeArchive";

const GITHUB_ISSUES_URL = "https://github.com/JoaomdvFerreira/open-evora/issues";
const GITHUB_REPOSITORY_URL = "https://github.com/JoaomdvFerreira/open-evora";
const CONTACT_EMAIL = "openevora@gmail.com";

type TrustNavigationPath = "/about" | "/methodology" | "/corrections" | "/contact" | "/privacy";
type TrustPagePath = TrustNavigationPath | "/out-of-scope";

interface TrustPageContent {
  heading: string;
  summary: string;
  body: ReactNode;
}

export interface TrustPageEntry extends TrustPageContent {
  path: TrustPagePath;
  informationPath: TrustNavigationPath;
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

/** Document title for an Information page: its navigation label (not the
 * longer H1) plus the shared site suffix. Each page's static
 * `<path>/index.html` carries this exact string as its `<title>`. */
function trustPageTitle(path: TrustPagePath): string {
  return documentTitle(path === "/out-of-scope" ? "Registos fora do âmbito" : TRUST_NAVIGATION.find((item) => item.path === path)!.label);
}

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

const TRUST_PAGES: Record<TrustNavigationPath, TrustPageContent> = {
  "/about": {
    heading: "Sobre o Open Évora",
    summary: "Uma iniciativa cívica independente, operada individualmente.",
    body: <>
      <InfoSection id="about-accountability" title="Responsabilidade">
        <InfoFacts facts={[
          ["Operação", "Iniciativa cívica operada individualmente"],
          ["Independência", "Sem ligação à autarquia"],
          ["Financiamento", "Autofinanciado"],
        ]} />
      </InfoSection>
      <InfoSection id="about-publication" title="Como é publicado">
        <InfoSteps steps={["Corpus de investigação com controlo de versões", "Validação e revisão", "Publicação no Explorador de Investigação"]} />
        <p className="info-closing">A proveniência, as limitações e a incerteza são apresentadas de forma explícita.</p>
        <p>O <a href={GITHUB_REPOSITORY_URL}>repositório público no GitHub</a> permite consultar o código, as fontes, as evidências e o histórico de alterações. Essa transparência não substitui a responsabilidade editorial nem a proteção de dados pessoais.</p>
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
        <p>Os registos passam por verificações estruturais e decisões editoriais humanas antes da integração no conjunto de dados canónico. Estas verificações não demonstram, por si só, que uma afirmação é verdadeira.</p>
        <p>A existência de uma fonte não significa que todas as conclusões possíveis a partir dessa fonte estejam estabelecidas; o Explorador procura tornar explícitos o âmbito e os limites da evidência apresentada.</p>
      </InfoSection>
      <InfoSection id="methodology-ai" title="Apoio de inteligência artificial">
        <p>Assistentes de inteligência artificial apoiam a pesquisa, a análise, a redação e o desenvolvimento técnico do projeto. As decisões editoriais e a publicação de investigação canónica são controladas pelo responsável humano. Este apoio não significa que todas as fontes ou conclusões tenham sido integralmente revistas por uma pessoa ou verificadas de forma independente.</p>
      </InfoSection>
      <InfoSection id="methodology-scope" title="Âmbito geográfico">
        <p>Alguns registos são encerrados quando a evidência disponível não permite estabelecer uma manifestação específica da cidade. Consulte <a href="/out-of-scope">Registos fora do âmbito</a>.</p>
      </InfoSection>
    </>,
  },
  "/corrections": {
    heading: "Correções",
    summary: "Como sinalizar informação que deve ser revista.",
    body: <>
      <p>Se encontrar informação incorreta, desatualizada, uma fonte problemática ou uma interpretação que deva ser revista, pode reportá-la através do <a href={GITHUB_ISSUES_URL}>GitHub Issues do projeto Open Évora</a> quando a questão puder ser discutida publicamente.</p>
      <p>Se a correção puder revelar dados pessoais, informação sensível ou um problema de privacidade, contacte-nos por email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Envie apenas a informação necessária para explicar a questão.</p>
      <p className="info-notice" role="note">Os GitHub Issues são públicos. Não inclua dados pessoais desnecessários nem informação sensível, incluindo em anexos ou ligações partilhadas. Não envie anexos privados.</p>
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
    summary: "Canais para questões, contribuições e correções.",
    body: <>
      <InfoSection id="contact-private" title="Contacto privado por email">
        <p>Escreva para <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> para questões gerais, contribuições de cidadãos, correções factuais ou pedidos relacionados com privacidade e dados pessoais.</p>
        <p>O email é o canal preferencial se a comunicação puder envolver informação pessoal ou sensível. Envie apenas a informação necessária.</p>
      </InfoSection>
      <InfoSection id="contact-public" title="Contacto público pelo GitHub">
        <p>Para questões que podem ser discutidas publicamente, use os <a href={GITHUB_ISSUES_URL}>Issues do repositório do projeto</a>. O GitHub pode exigir autenticação e as contribuições são publicadas através dessa plataforma.</p>
        <p>Para saber como sinalizar informação a rever, consulte <a href="/corrections">Correções</a>.</p>
        <p className="info-notice" role="note"><strong>Atenção:</strong> Os GitHub Issues são públicos. Não publique dados pessoais desnecessários, informação sensível ou anexos privados, incluindo em ligações partilhadas.</p>
        <InfoAction href={GITHUB_ISSUES_URL}>Abrir issue no GitHub</InfoAction>
      </InfoSection>
      <InfoSection id="contact-contribute" title="Contribuir para a investigação">
        <p>Pode sugerir um problema para investigação ou contribuir com informação ou evidência para um problema existente.</p>
        <ul className="info-guidance">
          <li>Seja factual e específico.</li>
          <li>Indique o local e a data, quando aplicável.</li>
          <li>Inclua uma fonte ou ligação, quando disponível.</li>
          <li>Não inclua dados pessoais nem informação sensível.</li>
        </ul>
        <p>A contribuição é enviada através de um <strong>issue público no GitHub</strong>: o formulário prepara o issue e o envio é concluído no GitHub.</p>
        <ContributionForm />
      </InfoSection>
    </>,
  },
  "/privacy": {
    heading: "Privacidade",
    summary: "Que dados podem ser tratados quando consulta o website ou contacta o Open Évora.",
    body: <>
      <InfoFacts facts={[
        ["Projeto", "Iniciativa cívica individual e independente."],
        ["Conta", "Não é necessária."],
        ["Prestadores", "Vercel (alojamento), Google/Gmail (email) e GitHub (repositório e Issues)."],
        ["Medição de audiência", "Vercel Analytics e Speed Insights estão atualmente desativados."],
      ]} />
      <p>A ausência de uma conta ou de um formulário de envio próprio não significa ausência de tratamento de dados pessoais. A consulta do website, o contacto por email e as contribuições no GitHub podem envolver o tratamento de dados pessoais, descrito abaixo.</p>
      <InfoSection id="privacy-controller" title="Responsável pelo tratamento">
        <p>O Open Évora é uma iniciativa cívica individual e independente, sem ligação à autarquia. A identificação formal do responsável pelo tratamento ainda não consta desta página. Os pedidos relativos a dados pessoais podem ser enviados para <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </InfoSection>
      <InfoSection id="privacy-website" title="Consulta do website">
        <p>O website está alojado na Vercel. A consulta pode envolver o tratamento de dados técnicos de acesso, como endereços IP e registos de acesso, pela Vercel, para assegurar o funcionamento e a segurança do serviço, segundo as respetivas políticas.</p>
        <p>O Vercel Analytics e o Speed Insights estão atualmente desativados.</p>
      </InfoSection>
      <InfoSection id="privacy-email" title="Mensagens por email">
        <p>As mensagens enviadas para {CONTACT_EMAIL} são recebidas através do Gmail, um serviço da Google. Podem conter dados pessoais fornecidos pelos remetentes, como o nome, o endereço de email e o conteúdo da mensagem. Estas mensagens são usadas para responder ao pedido e, quando relevante, para apoiar a investigação.</p>
        <p>A correspondência relevante para a investigação é arquivada para assegurar a rastreabilidade da investigação. Os contributos enviados em privado não são publicados automaticamente.</p>
      </InfoSection>
      <InfoSection id="privacy-github" title="Contribuições no GitHub">
        <p>Os GitHub Issues são públicos. O formulário de contribuição apenas prepara o issue: o envio é concluído no GitHub, que pode exigir autenticação e trata os dados segundo as suas próprias políticas. Não inclua dados pessoais desnecessários nem informação sensível.</p>
      </InfoSection>
      <InfoSection id="privacy-legal-basis" title="Finalidades e fundamentos jurídicos">
        <p>As finalidades de cada tratamento são as indicadas acima. O fundamento jurídico aplicável a cada tratamento ainda está em análise e não é indicado nesta página; não foi concluída uma avaliação de interesse legítimo.</p>
      </InfoSection>
      <InfoSection id="privacy-retention" title="Conservação">
        <p>Os dados pessoais são conservados apenas enquanto forem necessários para responder aos pedidos e para a documentação da investigação. O projeto vai adotar uma revisão anual da correspondência arquivada, para eliminar o que deixar de ser necessário.</p>
      </InfoSection>
      <InfoSection id="privacy-rights" title="Os seus direitos">
        <p>Nos termos do Regulamento Geral sobre a Proteção de Dados (RGPD), pode pedir o acesso aos seus dados pessoais, a retificação, o apagamento, a limitação do tratamento ou a portabilidade, e opor-se ao tratamento, quando aplicável.</p>
        <p>Pode também apresentar reclamação à Comissão Nacional de Proteção de Dados (<a href="https://www.cnpd.pt">CNPD</a>).</p>
      </InfoSection>
      <InfoSection id="privacy-contact" title="Contacto para questões de privacidade">
        <p>Para exercer os seus direitos ou colocar questões sobre dados pessoais, contacte <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. O contacto por email envolve o tratamento dos dados que fornecer; o serviço de email utiliza um prestador externo. Envie apenas a informação necessária para analisarmos o pedido.</p>
      </InfoSection>
      <InfoSection id="privacy-commitment" title="Compromisso">
        <p>O Open Évora não deve introduzir formulários de recolha de dados pessoais, analytics, medição de desempenho, cookies não essenciais ou mecanismos semelhantes sem rever e atualizar previamente esta informação.</p>
      </InfoSection>
    </>,
  },
};

export function trustPageForPath(pathname: string): TrustPageEntry | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  if (normalized === "/out-of-scope") {
    return {
      path: "/out-of-scope",
      informationPath: "/methodology",
      heading: "Registos fora do âmbito",
      summary: "O Open Évora acompanha problemas da cidade de Évora. Estes registos foram encerrados porque a evidência disponível não é específica da cidade. O encerramento não significa que o problema não exista.",
      body: null,
    };
  }
  if (!Object.prototype.hasOwnProperty.call(TRUST_PAGES, normalized)) return null;
  const path = normalized as TrustNavigationPath;
  return { path, informationPath: path, ...TRUST_PAGES[path] };
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
export function TrustPage({ page, skipTargetId, dataProvider }: { page: TrustPageEntry; skipTargetId?: string; dataProvider: DataProvider }) {
  useEffect(() => {
    document.title = trustPageTitle(page.path);
  }, [page.path]);
  return <>
      <ExplorerHeader activeView={trustHeaderView(page.informationPath)} />
    <div className="info-page shell-frame shell-frame--wide">
      <InformationNavigation currentPath={page.informationPath} />
      <article id={skipTargetId} tabIndex={skipTargetId ? -1 : undefined} className="info-article">
        <p className="info-back"><a href="/">← Explorar problemas</a></p>
        <h1 className="info-title">{page.heading}</h1>
        <p className="info-summary">{page.summary}</p>
        <div className="info-content">{page.path === "/out-of-scope" ? <OutOfScopeArchive dataProvider={dataProvider} /> : page.body}</div>
        <InformationSequence currentPath={page.informationPath} />
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
