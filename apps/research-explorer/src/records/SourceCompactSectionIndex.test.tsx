import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceCompactSectionIndex } from "./SourceCompactSectionIndex";
import { sourceSectionIndex } from "./sourceSectionIndex";

/** Mirrors research/sources/SRC-0093.yaml exactly (matches sourceSectionIndex.test.ts). */
const SRC_0093: Record<string, unknown> = {
  source_id: "SRC-0093",
  publisher: "Scientific Reports (Springer Nature)",
  creators: ["Giacomo Dalla Chiara", "Klaas Fiete Krutein", "Andisheh Ranjbari", "Anne Goodchild"],
  name: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
  resource_type: "document",
  identity: {
    persistent_identifier: { scheme: "doi", value: "10.1038/s41598-022-23987-z" },
  },
  scope: {
    geography: { level: "local_area", area: "Belltown, Seattle, Washington, EUA" },
    domains: ["MOB", "DIG"],
  },
  access: {
    level: "public",
    availability: "available",
    machine_readable: false,
    method: "browser",
    format: "html",
  },
  acquisition: { method: "public_web" },
  canonical_reference: "https://doi.org/10.1038/s41598-022-23987-z",
  licensing: {
    status: "known",
    licence: "CC BY 4.0",
    reuse: "permitted",
    attribution: "Giacomo Dalla Chiara, Klaas Fiete Krutein, Andisheh Ranjbari e Anne Goodchild",
  },
  temporal: { published_at: "2022-11-11", last_checked_at: "2026-08-25" },
  caveats: [
    "O estudo é um experimento controlado realizado numa área de 10 quarteirões em Belltown, Seattle, com 11 condutores, 33 rotas e 495 entregas simuladas.",
  ],
};

/** Minimal valid SRC: only required fields, no caveats. */
const MINIMAL_SRC: Record<string, unknown> = {
  source_id: "SRC-0001",
  name: "Minimal source",
  resource_type: "webpage",
  scope: {
    geography: { level: "non_geographic" },
    domains: ["DIG"],
  },
  access: { level: "unknown", availability: "unknown", machine_readable: "unknown" },
  acquisition: { method: "unknown" },
  licensing: { status: "unknown", reuse: "unknown" },
  temporal: { last_checked_at: "2026-08-25" },
};

describe("SourceCompactSectionIndex", () => {
  it("1. renders the 'Nesta fonte' compact control", () => {
    render(<SourceCompactSectionIndex record={MINIMAL_SRC} />);
    expect(screen.getByText("Nesta fonte")).toBeTruthy();
  });

  it("2. is collapsed by default (native <details> with no `open` attribute)", () => {
    render(<SourceCompactSectionIndex record={MINIMAL_SRC} />);
    const details = screen.getByText("Nesta fonte").closest("details");
    expect(details).not.toBeNull();
    expect(details!.hasAttribute("open")).toBe(false);
  });

  it("3. SRC-0093 + related-PRB context renders all 8 canonical labels", () => {
    render(<SourceCompactSectionIndex record={SRC_0093} relationContext={{ hasRelatedProblem: true }} />);
    for (const label of ["Visão geral", "O que encontrámos", "Cobertura", "Datas e acesso", "Licenciamento", "Limitações", "Na investigação", "Informação técnica"]) {
      expect(screen.getByRole("link", { name: label })).toBeTruthy();
    }
  });

  it("4. order exactly matches sourceSectionIndex()", () => {
    render(<SourceCompactSectionIndex record={SRC_0093} relationContext={{ hasRelatedProblem: true }} />);
    const expected = sourceSectionIndex(SRC_0093, { hasRelatedProblem: true }).map((entry) => entry.label);
    const links = screen.getAllByRole("link").map((link) => link.textContent);
    expect(links).toEqual(expected);
  });

  it("5. every href exactly matches sourceSectionIndex() anchorId", () => {
    render(<SourceCompactSectionIndex record={SRC_0093} relationContext={{ hasRelatedProblem: true }} />);
    const expected = sourceSectionIndex(SRC_0093, { hasRelatedProblem: true });
    for (const entry of expected) {
      const link = screen.getByRole("link", { name: entry.label });
      expect(link.getAttribute("href")).toBe(`#${entry.anchorId}`);
    }
  });

  it("6. caveats absent: Limitações absent", () => {
    render(<SourceCompactSectionIndex record={MINIMAL_SRC} />);
    expect(screen.queryByRole("link", { name: "Limitações" })).toBeNull();
  });

  it("7. caveats present: Limitações present", () => {
    render(<SourceCompactSectionIndex record={SRC_0093} relationContext={{ hasRelatedProblem: true }} />);
    expect(screen.getByRole("link", { name: "Limitações" })).toBeTruthy();
  });

  it("8. no relationContext: O que encontrámos present, Na investigação absent", () => {
    render(<SourceCompactSectionIndex record={MINIMAL_SRC} />);
    expect(screen.getByRole("link", { name: "O que encontrámos" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Na investigação" })).toBeNull();
  });

  it("9. relationContext without PRB: Na investigação absent", () => {
    render(<SourceCompactSectionIndex record={SRC_0093} relationContext={{ hasRelatedProblem: false }} />);
    expect(screen.queryByRole("link", { name: "Na investigação" })).toBeNull();
  });

  it("10. relationContext with PRB: Na investigação present", () => {
    render(<SourceCompactSectionIndex record={SRC_0093} relationContext={{ hasRelatedProblem: true }} />);
    expect(screen.getByRole("link", { name: "Na investigação" })).toBeTruthy();
  });

  it("11. Informação técnica is always present", () => {
    render(<SourceCompactSectionIndex record={MINIMAL_SRC} />);
    expect(screen.getByRole("link", { name: "Informação técnica" })).toBeTruthy();
  });

  it("12. no legacy Source actions/path appear", () => {
    render(<SourceCompactSectionIndex record={SRC_0093} relationContext={{ hasRelatedProblem: true }} />);
    for (const forbidden of ["Abrir fonte original", "Ver no Grafo", "Ver como Problema", "research/sources"]) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });

  it("13. no SRC type explanation is duplicated", () => {
    render(<SourceCompactSectionIndex record={SRC_0093} relationContext={{ hasRelatedProblem: true }} />);
    expect(screen.queryByText(/^SRC$/)).toBeNull();
    expect(screen.queryByText(/Fonte/)).toBeNull();
  });

  it("14. output entries exactly equal sourceSectionIndex() for the same inputs (all scenarios)", () => {
    const scenarios: { record: Record<string, unknown>; relationContext?: { hasRelatedProblem: boolean } }[] = [
      { record: MINIMAL_SRC },
      { record: MINIMAL_SRC, relationContext: { hasRelatedProblem: false } },
      { record: SRC_0093, relationContext: { hasRelatedProblem: true } },
      { record: SRC_0093, relationContext: { hasRelatedProblem: false } },
    ];
    for (const { record, relationContext } of scenarios) {
      const { unmount } = render(<SourceCompactSectionIndex record={record} relationContext={relationContext} />);
      const expected = sourceSectionIndex(record, relationContext);
      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(expected.length);
      links.forEach((link, index) => {
        expect(link.textContent).toBe(expected[index].label);
        expect(link.getAttribute("href")).toBe(`#${expected[index].anchorId}`);
      });
      unmount();
    }
  });

  it("15. no data-provider/relation loading occurs inside the component (pure sync render, no status text)", () => {
    render(<SourceCompactSectionIndex record={SRC_0093} relationContext={{ hasRelatedProblem: true }} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText(/a carregar/i)).toBeNull();
  });

  it("16. DS-05H: renders the canonical presentation/CompactSectionIndex (native details/summary, named nested nav)", () => {
    render(<SourceCompactSectionIndex record={SRC_0093} relationContext={{ hasRelatedProblem: true }} />);
    const summary = screen.getByText("Nesta fonte");
    expect(summary.closest("details")).not.toBeNull();
    expect(screen.getByRole("navigation", { name: "Nesta fonte (versão compacta)" })).toBeTruthy();
  });
});
