import { afterEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { App } from "./App";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";

const provider: DataProvider = {
  getManifest: () => Promise.reject(new Error("not used on trust pages")),
  listRecords: () => Promise.resolve([]),
  getRecord: () => Promise.reject(new Error("not used")),
  getEdges: () => Promise.resolve([]),
};

afterEach(() => window.history.replaceState(null, "", "/"));

it("explains website and GitHub data handling without a data dependency", () => {
  window.history.replaceState(null, "", "/privacy");
  render(<App dataProvider={provider} />);

  expect(screen.getByRole("heading", { name: "Privacidade" })).toBeTruthy();
  expect(screen.getByText("Não é necessária.")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Compromisso" })).toBeTruthy();
  expect(screen.getByText(/não significa ausência de tratamento de dados pessoais/)).toBeTruthy();
  expect(screen.getByText(/O formulário prepara um issue público no GitHub/)).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "Correções" }).every((link) => link.getAttribute("href") === "/corrections")).toBe(true);
});

it("renders a data-backed OUT_OF_SCOPE archive under the Methodology information parent", async () => {
  const summaries: RecordSummary[] = [
    { id: "PRB-0007", type: "PRB-", label: "Necessidades de apoio e de informação de cuidadores informais no concelho de Évora", file: "research/problems/PRB-0007.yaml", summaryFields: { status: "CLOSED" } },
    { id: "PRB-RESOLVED", type: "PRB-", label: "Problema resolvido", file: "research/problems/PRB-RESOLVED.yaml", summaryFields: { status: "CLOSED" } },
  ];
  const details: Record<string, RecordDetail> = {
    "PRB-0007": { id: "PRB-0007", type: "PRB-", file: summaries[0].file, record: { title: "Necessidades de apoio e de informação de cuidadores informais no concelho de Évora", status: "CLOSED", closure: { reason: "OUT_OF_SCOPE" } }, outgoingEdges: [], incomingEdges: [] },
    "PRB-RESOLVED": { id: "PRB-RESOLVED", type: "PRB-", file: summaries[1].file, record: { title: "Problema resolvido", status: "CLOSED", closure: { reason: "RESOLVED" } }, outgoingEdges: [], incomingEdges: [] },
  };
  const archiveProvider: DataProvider = {
    ...provider,
    listRecords: async () => summaries,
    getRecord: async (id) => { const detail = details[id]; if (!detail) throw new Error("not found"); return detail; },
  };
  window.history.replaceState(null, "", "/out-of-scope");
  render(<App dataProvider={archiveProvider} />);

  expect(await screen.findByRole("heading", { level: 1, name: "Registos fora do âmbito" })).toBeTruthy();
  expect(document.title).toBe("Registos fora do âmbito — Explorador de Investigação Open Évora");
  expect(screen.getByText("O Open Évora acompanha problemas da cidade de Évora. Estes registos foram encerrados porque a evidência disponível não é específica da cidade. O encerramento não significa que o problema não exista.")).toBeTruthy();
  const archivedLink = screen.getByRole("link", { name: "Necessidades de apoio e de informação de cuidadores informais no concelho de Évora" });
  expect(archivedLink.getAttribute("href")).toBe("/?view=problem&id=PRB-0007");
  expect(screen.getByText("Fora do âmbito do programa")).toBeTruthy();
  expect(screen.queryByText("Problema resolvido")).toBeNull();
  const globalNav = screen.getByRole("navigation", { name: "Navegação principal", hidden: true });
  expect(within(globalNav).getByRole("link", { name: "Método", hidden: true }).getAttribute("aria-current")).toBe("page");
  const localNav = screen.getByRole("navigation", { name: "Informação sobre o Open Évora" });
  expect(within(localNav).getByRole("link", { name: "Metodologia" }).getAttribute("aria-current")).toBe("page");
  const staticHtml = readFileSync(path.join(__dirname, "..", "..", "out-of-scope", "index.html"), "utf-8");
  expect(/<title>([^<]*)<\/title>/.exec(staticHtml)?.[1]).toBe(document.title);
});

it("explains independent operation and the public repository in the About page", () => {
  window.history.replaceState(null, "", "/about");
  render(<App dataProvider={provider} />);

  expect(screen.getByRole("heading", { name: "Sobre o Open Évora" })).toBeTruthy();
  expect(screen.getByRole("navigation", { name: "Navegação principal", hidden: true })).toBeTruthy();
  expect(screen.getByText("Iniciativa cívica operada individualmente")).toBeTruthy();
  expect(screen.getByText("Sem ligação à autarquia")).toBeTruthy();
  expect(screen.getByText("Autofinanciado")).toBeTruthy();
  expect(screen.getByRole("link", { name: "repositório público no GitHub" }).getAttribute("href")).toBe("https://github.com/JoaomdvFerreira/open-evora");
  expect(screen.getByText(/responsabilidade editorial nem a proteção de dados pessoais/)).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "Sobre" }).some((link) => link.getAttribute("aria-current") === "page")).toBe(true);
  expect(screen.getAllByRole("link", { name: "Metodologia" }).every((link) => link.getAttribute("href") === "/methodology")).toBe(true);
});

it("renders the approved corrections action to the canonical public Issues page", () => {
  window.history.replaceState(null, "", "/corrections");
  render(<App dataProvider={provider} />);

  expect(screen.getByRole("heading", { name: "Correções" })).toBeTruthy();
  expect(screen.getByRole("link", { name: /GitHub Issues do projeto Open Évora/ }).getAttribute("href")).toBe("https://github.com/JoaomdvFerreira/open-evora/issues");
  expect(screen.getByRole("link", { name: "Reportar correção no GitHub" }).getAttribute("href")).toBe("https://github.com/JoaomdvFerreira/open-evora/issues");
  expect(screen.getByRole("note").textContent).toContain("Os GitHub Issues são públicos.");
  const include = screen.getByRole("region", { name: "O que incluir" });
  expect(within(include).getAllByRole("listitem")).toHaveLength(3);
});

const INFORMATION_SEQUENCE = [
  { path: "/about", label: "Sobre", heading: "Sobre o Open Évora", global: "Sobre" },
  { path: "/methodology", label: "Metodologia", heading: "Metodologia", global: "Método" },
  { path: "/corrections", label: "Correções", heading: "Correções", global: "Sobre" },
  { path: "/contact", label: "Contacto", heading: "Contacto", global: "Sobre" },
  { path: "/privacy", label: "Privacidade", heading: "Privacidade", global: "Sobre" },
];

function renderInformationPage(path: string) {
  window.history.replaceState(null, "", path);
  return render(<App dataProvider={provider} />);
}

describe("Information area — shared shell navigation contract", () => {
  it.each(INFORMATION_SEQUENCE)("$path marks exactly one global header item current: $global", ({ path, global }) => {
    renderInformationPage(path);
    const header = screen.getByRole("navigation", { name: "Navegação principal", hidden: true });
    const current = within(header).getAllByRole("link", { hidden: true }).filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual([global]);
  });

  it("header Problemas/Registos navigate to their Explorer destinations outside the live Explorer", () => {
    renderInformationPage("/about");
    const header = screen.getByRole("navigation", { name: "Navegação principal", hidden: true });
    expect(within(header).getByRole("link", { name: "Problemas", hidden: true }).getAttribute("href")).toBe("/");
    expect(within(header).getByRole("link", { name: "Registos", hidden: true }).getAttribute("href")).toBe("/?view=records");
    expect(within(header).getByRole("link", { name: "Método", hidden: true }).getAttribute("href")).toBe("/methodology");
    expect(within(header).getByRole("link", { name: "Sobre", hidden: true }).getAttribute("href")).toBe("/about");
  });

  it.each(INFORMATION_SEQUENCE)("$path marks only its own local INFORMAÇÃO item current, in the approved order", ({ path, label }) => {
    renderInformationPage(path);
    const local = screen.getByRole("navigation", { name: "Informação sobre o Open Évora" });
    const links = within(local).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual(INFORMATION_SEQUENCE.map((entry) => [entry.label, entry.path]));
    expect(links.filter((link) => link.getAttribute("aria-current") === "page").map((link) => link.textContent)).toEqual([label]);
  });

  it.each(INFORMATION_SEQUENCE.map((entry, index) => ({ ...entry, previous: INFORMATION_SEQUENCE[index - 1], next: INFORMATION_SEQUENCE[index + 1] })))(
    "$path links previous/next through the Information sequence",
    ({ path, heading, previous, next }) => {
      renderInformationPage(path);
      expect(screen.getByRole("heading", { level: 1, name: heading })).toBeTruthy();
      expect(screen.getByRole("link", { name: "← Explorar problemas" }).getAttribute("href")).toBe("/");
      const sequence = screen.getByRole("navigation", { name: "Páginas de informação" });
      const links = within(sequence).getAllByRole("link");
      const expected = [
        ...(previous ? [{ href: previous.path, rel: "prev", name: `Anterior${previous.label}` }] : []),
        ...(next ? [{ href: next.path, rel: "next", name: `Seguinte${next.label}` }] : []),
      ];
      expect(links.map((link) => ({ href: link.getAttribute("href"), rel: link.getAttribute("rel"), name: link.textContent?.replace(/[←→\s]/g, "") }))).toEqual(
        expected.map((entry) => ({ ...entry, name: entry.name.replace(/\s/g, "") })),
      );
    },
  );
});

/**
 * D01-019: each Information page has its own document title — its short
 * navigation label, not the longer H1 — set at runtime by TrustPage and
 * carried verbatim by its static Vite HTML entry, so the pre-hydration tab
 * title and the runtime title never disagree. Information pages are ordinary
 * HTML documents, so a browser Back onto one is a fresh document load.
 */
describe("Information area — document titles (D01-019)", () => {
  const ROOT_TITLE = "Open Évora — Explorador de Investigação";
  const INFORMATION_TITLES = [
    { path: "/about", title: "Sobre — Explorador de Investigação Open Évora" },
    { path: "/methodology", title: "Metodologia — Explorador de Investigação Open Évora" },
    { path: "/corrections", title: "Correções — Explorador de Investigação Open Évora" },
    { path: "/contact", title: "Contacto — Explorador de Investigação Open Évora" },
    { path: "/privacy", title: "Privacidade — Explorador de Investigação Open Évora" },
  ];

  function staticTitle(entryPath: string): string | undefined {
    const html = readFileSync(path.join(__dirname, "..", "..", entryPath, "index.html"), "utf-8");
    return /<title>([^<]*)<\/title>/.exec(html)?.[1];
  }

  it.each(INFORMATION_TITLES)("$path sets its own runtime title on direct load", ({ path: pagePath, title }) => {
    document.title = ROOT_TITLE;
    renderInformationPage(pagePath);
    expect(document.title).toBe(title);
    expect(document.title).not.toBe(ROOT_TITLE);
  });

  it.each(INFORMATION_TITLES)("$path static HTML entry carries the same pre-hydration <title>", ({ path: pagePath, title }) => {
    expect(staticTitle(pagePath)).toBe(title);
  });

  it("gives all five Information pages distinct titles and leaves the root entry's generic title unchanged", () => {
    expect(new Set(INFORMATION_TITLES.map(({ title }) => title)).size).toBe(5);
    expect(staticTitle("")).toBe(ROOT_TITLE);
  });

  it("a later page load (e.g. browser Back onto a previous page) never keeps the prior page's title", () => {
    for (const { path: pagePath, title } of [INFORMATION_TITLES[0], INFORMATION_TITLES[4], INFORMATION_TITLES[0]]) {
      const { unmount } = renderInformationPage(pagePath);
      expect(document.title).toBe(title);
      unmount();
    }
  });
});

it("renders the About publication sequence as three ordered steps", () => {
  renderInformationPage("/about");
  const section = screen.getByRole("region", { name: "Como é publicado" });
  expect(within(section).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
    "01Corpus de investigação com controlo de versões",
    "02Validação e revisão",
    "03Publicação no Explorador de Investigação",
  ]);
});

it("discloses AI assistance and human editorial control without claiming exhaustive verification", () => {
  renderInformationPage("/methodology");
  const section = screen.getByRole("region", { name: "Apoio de inteligência artificial" });
  expect(section.textContent).toContain("a pesquisa, a análise, a redação e o desenvolvimento técnico");
  expect(section.textContent).toContain("decisões editoriais e a publicação de investigação canónica são controladas pelo responsável humano");
  expect(section.textContent).toContain("não significa que todas as fontes ou conclusões tenham sido integralmente revistas");
});

it("renders the Contact channels, privacy notice and GitHub action with their existing destinations", () => {
  renderInformationPage("/contact");
  expect(screen.getByRole("link", { name: "Issues do repositório do projeto" }).getAttribute("href")).toBe("https://github.com/JoaomdvFerreira/open-evora/issues");
  const factual = screen.getByText("Correções factuais").nextElementSibling as HTMLElement;
  expect(within(factual).getByRole("link", { name: "Correções" }).getAttribute("href")).toBe("/corrections");
  expect(screen.getByRole("note").textContent).toBe("Atenção: Os GitHub Issues são públicos. Não publique dados pessoais ou informação sensível, incluindo em anexos ou ligações.");
  expect(screen.getByRole("link", { name: "Abrir issue no GitHub" }).getAttribute("href")).toBe("https://github.com/JoaomdvFerreira/open-evora/issues");
});

it("renders the Contact contribution section with its public-GitHub guidance and the production form", () => {
  renderInformationPage("/contact");
  const section = screen.getByRole("region", { name: "Contribuir para a investigação" });
  expect(section.textContent).toContain("issue público no GitHub");
  expect(section.textContent).toContain("Não inclua dados pessoais nem informação sensível.");
  expect(within(section).getByRole("group", { name: /Tipo de contribuição/ })).toBeTruthy();
  expect(within(section).getByRole("button", { name: "Preparar issue no GitHub" })).toBeTruthy();
});

describe("PublicFooter — editorial identity/PROJETO/DADOS structure (Overview final redesign, Phase 3B §6)", () => {
  it("renders the identity heading and supporting copy", () => {
    window.history.replaceState(null, "", "/about");
    render(<App dataProvider={provider} />);

    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByText("Open Évora")).toBeTruthy();
    expect(within(footer).getByText(/Projecto independente de investigação cívica\. Sem ligação à/)).toBeTruthy();
  });

  it("renders the PROJETO and DADOS groups with truthful existing destinations", () => {
    window.history.replaceState(null, "", "/about");
    render(<App dataProvider={provider} />);

    const footer = screen.getByRole("contentinfo");
    const projeto = within(footer).getByRole("navigation", { name: "Projeto" });
    expect(within(projeto).getByRole("link", { name: "Método" }).getAttribute("href")).toBe("/methodology");
    expect(within(projeto).getByRole("link", { name: "Sobre" }).getAttribute("href")).toBe("/about");
    expect(within(projeto).getByRole("link", { name: "Correções" }).getAttribute("href")).toBe("/corrections");

    const dados = within(footer).getByRole("navigation", { name: "Dados" });
    expect(within(dados).getByRole("link", { name: "Registos" }).getAttribute("href")).toBe("/?view=records");
    expect(within(dados).queryByRole("link", { name: "Fontes" })).toBeNull();
    expect(within(dados).getByRole("link", { name: "Contactar" }).getAttribute("href")).toBe("/contact");
    expect(within(dados).getByRole("link", { name: "Privacidade" }).getAttribute("href")).toBe("/privacy");
  });

  it("never reintroduces 'Fontes primárias' terminology or an unsupported CSV download link", () => {
    window.history.replaceState(null, "", "/about");
    render(<App dataProvider={provider} />);

    const footer = screen.getByRole("contentinfo");
    expect(within(footer).queryByText(/Fontes primárias/)).toBeNull();
    expect(within(footer).queryByRole("link", { name: /Descarregar CSV/ })).toBeNull();
  });

  /** Final alignment pass, task §8: the compact 360px summary line was
   * breaking unnaturally early ("Sem ligação à" / "autarquia...") because
   * the markup forced the split with an explicit `<br />` at every width,
   * not because the container was too narrow to hold more. The fix removes
   * the hardcoded split so wrapping is driven purely by CSS
   * (`.public-footer-identity`'s max-width, base + <=767px rules) — this
   * regression guards the markup side of that fix: the exact copy stays a
   * single contiguous text node with no manual break, so the DOM never
   * reintroduces an author-picked split point regardless of viewport. */
  it("renders the summary copy as one continuous text node, with no manual line break forcing a split point at every width", () => {
    window.history.replaceState(null, "", "/about");
    render(<App dataProvider={provider} />);

    const footer = screen.getByRole("contentinfo");
    const summary = within(footer).getByText(
      "Projecto independente de investigação cívica. Sem ligação à autarquia. Todo o conteúdo remete para fontes verificáveis.",
    );
    expect(summary.tagName).toBe("P");
    expect(summary.querySelector("br")).toBeNull();
    expect(summary.childNodes.length).toBe(1);
    expect(summary.childNodes[0]?.nodeType).toBe(Node.TEXT_NODE);
  });

  it("renders correctly beneath every TrustPage, not only the Explorer", () => {
    for (const path of ["/about", "/methodology", "/corrections", "/contact", "/privacy"]) {
      window.history.replaceState(null, "", path);
      const { unmount } = render(<App dataProvider={provider} />);
      expect(screen.getByRole("contentinfo")).toBeTruthy();
      unmount();
    }
  });
});
