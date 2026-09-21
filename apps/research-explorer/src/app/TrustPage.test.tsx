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
  expect(screen.getByText(/sem criar uma conta/)).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "Correções" }).every((link) => link.getAttribute("href") === "/corrections")).toBe(true);
});

it("renders the owner-confirmed About accountability facts in the shared trust structure", () => {
  window.history.replaceState(null, "", "/about");
  render(<App dataProvider={provider} />);

  expect(screen.getByRole("heading", { name: "Sobre o Open Évora" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Open Évora — Explorador de Investigação" })).toBeTruthy();
  expect(screen.getByText("Projeto Open Évora")).toBeTruthy();
  expect(screen.getByText("Projeto independente")).toBeTruthy();
  expect(screen.getByText("Autofinanciado")).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "Sobre" }).some((link) => link.getAttribute("aria-current") === "page")).toBe(true);
  expect(screen.getAllByRole("link", { name: "Metodologia" }).every((link) => link.getAttribute("href") === "/methodology")).toBe(true);
});

it("renders the approved corrections action to the canonical public Issues page", () => {
  window.history.replaceState(null, "", "/corrections");
  render(<App dataProvider={provider} />);

  expect(screen.getByRole("heading", { name: "Correções" })).toBeTruthy();
  expect(screen.getByRole("link", { name: /GitHub Issues do projeto Open Évora/ }).getAttribute("href")).toBe("https://github.com/JoaomdvFerreira/open-evora/issues");
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
    expect(within(dados).getByRole("link", { name: "Fontes" }).getAttribute("href")).toBe("/?view=records&type=SRC-");
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
