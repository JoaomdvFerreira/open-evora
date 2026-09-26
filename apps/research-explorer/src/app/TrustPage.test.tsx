import { afterEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { App } from "./App";
import type { DataProvider } from "../dataProvider/types";

const provider: DataProvider = {
  getManifest: () => Promise.reject(new Error("not used on trust pages")),
  listRecords: () => Promise.resolve([]),
  getRecord: () => Promise.reject(new Error("not used")),
  getEdges: () => Promise.resolve([]),
};

afterEach(() => window.history.replaceState(null, "", "/"));

it("renders the approved privacy surface without a data dependency", () => {
  window.history.replaceState(null, "", "/privacy");
  render(<App dataProvider={provider} />);

  expect(screen.getByRole("heading", { name: "Privacidade" })).toBeTruthy();
  expect(screen.getByText("Não é necessária.")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Compromisso" })).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "Correções" }).every((link) => link.getAttribute("href") === "/corrections")).toBe(true);
});

it("renders the owner-confirmed About accountability facts in the shared trust structure", () => {
  window.history.replaceState(null, "", "/about");
  render(<App dataProvider={provider} />);

  expect(screen.getByRole("heading", { name: "Sobre o Open Évora" })).toBeTruthy();
  expect(screen.getByRole("navigation", { name: "Navegação principal", hidden: true })).toBeTruthy();
  expect(screen.getByText("Projeto Open Évora")).toBeTruthy();
  expect(screen.getByText("Projeto independente, sem ligação à autarquia")).toBeTruthy();
  expect(screen.getByText("Autofinanciado")).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "Sobre" }).some((link) => link.getAttribute("aria-current") === "page")).toBe(true);
  expect(screen.getAllByRole("link", { name: "Metodologia" }).every((link) => link.getAttribute("href") === "/methodology")).toBe(true);
});

it("renders the approved corrections action to the canonical public Issues page", () => {
  window.history.replaceState(null, "", "/corrections");
  render(<App dataProvider={provider} />);

  expect(screen.getByRole("heading", { name: "Correções" })).toBeTruthy();
  expect(screen.getByRole("link", { name: /GitHub Issues do projeto Open Évora/ }).getAttribute("href")).toBe("https://github.com/JoaomdvFerreira/open-evora/issues");
  expect(screen.getByRole("link", { name: "Reportar correção no GitHub" }).getAttribute("href")).toBe("https://github.com/JoaomdvFerreira/open-evora/issues");
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

it("renders the About publication sequence as three ordered steps", () => {
  renderInformationPage("/about");
  const section = screen.getByRole("region", { name: "Como é publicado" });
  expect(within(section).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
    "01Corpus de investigação com controlo de versões",
    "02Validação e revisão",
    "03Publicação no Explorador de Investigação",
  ]);
});

it("renders the Contact channels, privacy notice and GitHub action with their existing destinations", () => {
  renderInformationPage("/contact");
  expect(screen.getByRole("link", { name: "Issues do repositório do projeto" }).getAttribute("href")).toBe("https://github.com/JoaomdvFerreira/open-evora/issues");
  const factual = screen.getByText("Correções factuais").nextElementSibling as HTMLElement;
  expect(within(factual).getByRole("link", { name: "Correções" }).getAttribute("href")).toBe("/corrections");
  expect(screen.getByRole("note").textContent).toBe("Atenção: Evite publicar dados pessoais ou informação sensível num issue público.");
  expect(screen.getByRole("link", { name: "Abrir issue no GitHub" }).getAttribute("href")).toBe("https://github.com/JoaomdvFerreira/open-evora/issues");
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
