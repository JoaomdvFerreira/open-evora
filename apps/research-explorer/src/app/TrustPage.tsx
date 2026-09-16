import type { ReactNode } from "react";

const GITHUB_ISSUES_URL = "https://github.com/JoaomdvFerreira/open-evora/issues";

type TrustPagePath = "/about" | "/methodology" | "/corrections" | "/contact" | "/privacy";

interface TrustPageContent {
  heading: string;
  body: ReactNode;
}

const TRUST_PAGES: Record<TrustPagePath, TrustPageContent> = {
  "/about": {
    heading: "Sobre o Open Évora",
    body: <><p>Open Évora é um projeto cívico independente dedicado a organizar e tornar acessível investigação e evidência sobre temas relevantes para Évora.</p><p>O projeto não representa a Câmara Municipal de Évora nem qualquer outra entidade pública, empresa ou organização mencionada no conteúdo. O objetivo do Research Explorer é permitir consultar problemas, fontes, evidência e os limites da investigação de forma transparente.</p></>,
  },
  "/methodology": {
    heading: "Metodologia",
    body: <><p>O Research Explorer organiza investigação a partir de fontes identificadas e evidência rastreável. Sempre que relevante, distingue factos observados, evidência local, fontes externas, inferências e limitações da informação disponível.</p><p>Os registos são sujeitos a validação antes de serem integrados no conjunto de dados canónico e publicados. A existência de uma fonte não significa que todas as conclusões possíveis a partir dessa fonte estejam estabelecidas; o Explorer procura tornar explícitos o âmbito e os limites da evidência apresentada.</p></>,
  },
  "/corrections": {
    heading: "Correções",
    body: <><p>Se encontrar informação incorreta, desatualizada, uma fonte problemática ou uma interpretação que deva ser revista, pode reportá-la através do <a href={GITHUB_ISSUES_URL}>GitHub Issues do projeto Open Évora</a>.</p><p>Indique, sempre que possível, a página ou registo em causa, o ponto que considera incorreto e uma fonte ou explicação que permita verificar a correção.</p></>,
  },
  "/contact": {
    heading: "Contacto",
    body: <><p>Para questões, sugestões ou problemas relacionados com o Open Évora, utilize o <a href={GITHUB_ISSUES_URL}>canal público de Issues do repositório do projeto</a>.</p><p>Para reportar uma correção factual, utilize preferencialmente o processo descrito na página <a href="/corrections">Correções</a>. Evite publicar dados pessoais ou informação sensível num issue público.</p></>,
  },
  "/privacy": {
    heading: "Privacidade",
    body: <><p>O Research Explorer pode ser consultado sem criar uma conta ou fornecer diretamente dados pessoais ao Open Évora.</p><p>O serviço é alojado através de infraestrutura de terceiros, que pode processar dados técnicos necessários ao funcionamento e segurança do serviço, como endereços IP e registos de acesso, de acordo com as respetivas políticas.</p><p>O Open Évora não deve introduzir formulários de recolha de dados pessoais, analytics adicionais, cookies não essenciais ou mecanismos semelhantes sem rever e atualizar previamente esta informação.</p></>,
  },
};

export function trustPageForPath(pathname: string): TrustPageContent | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  return Object.prototype.hasOwnProperty.call(TRUST_PAGES, normalized) ? TRUST_PAGES[normalized as TrustPagePath] : null;
}

export function TrustPage({ page }: { page: TrustPageContent }) {
  return <article className="trust-page"><p><a href="/">Research Explorer</a></p><h1>{page.heading}</h1>{page.body}</article>;
}

export function PublicFooter() {
  return <footer className="public-footer" aria-label="Informação sobre o Open Évora"><div className="public-footer-inner shell-frame"><a href="/about">Sobre</a><a href="/methodology">Metodologia</a><a href="/corrections">Correções</a><a href="/contact">Contacto</a><a href="/privacy">Privacidade</a></div></footer>;
}
