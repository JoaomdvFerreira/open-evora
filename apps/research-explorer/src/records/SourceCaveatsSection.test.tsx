import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceCaveatsSection } from "./SourceCaveatsSection";

/** Mirrors research/sources/SRC-0093.yaml exactly (matches sourceView.test.ts's fixture). */
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
  caveats: ["O estudo é um experimento controlado realizado numa área de 10 quarteirões em Belltown, Seattle, com 11 condutores, 33 rotas e 495 entregas simuladas."],
};

/** Minimal valid SRC: only required fields per research/schemas/source.schema.json. */
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

describe("SourceCaveatsSection", () => {
  it("renders the section heading and caveat verbatim for one caveat", () => {
    render(<SourceCaveatsSection record={{ ...MINIMAL_SRC, caveats: ["Amostra reduzida."] }} />);

    expect(screen.getByRole("heading", { name: "Limitações" })).toBeTruthy();
    expect(screen.getByText("Amostra reduzida.")).toBeTruthy();
  });

  it("renders all caveats in canonical order for multiple caveats", () => {
    const record = { ...MINIMAL_SRC, caveats: ["Primeira limitação.", "Segunda limitação.", "Terceira limitação."] };
    render(<SourceCaveatsSection record={record} />);

    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Primeira limitação.", "Segunda limitação.", "Terceira limitação."]);
  });

  it("renders nothing for an empty caveats array", () => {
    const { container } = render(<SourceCaveatsSection record={{ ...MINIMAL_SRC, caveats: [] }} />);

    expect(container.innerHTML).toBe("");
    expect(screen.queryByRole("heading", { name: "Limitações" })).toBeNull();
  });

  it("renders nothing when caveats is absent", () => {
    const { container } = render(<SourceCaveatsSection record={MINIMAL_SRC} />);

    expect(container.innerHTML).toBe("");
    expect(screen.queryByRole("heading", { name: "Limitações" })).toBeNull();
  });

  it("does not render any empty-state placeholder text for absent caveats", () => {
    render(<SourceCaveatsSection record={MINIMAL_SRC} />);

    expect(screen.queryByText(/Sem limitações/i)).toBeNull();
    expect(screen.queryByText(/Nenhuma limitação conhecida/i)).toBeNull();
    expect(screen.queryByText(/Não foram identificadas limitações/i)).toBeNull();
  });

  it("renders the exact SRC-0093 canonical caveat unchanged", () => {
    render(<SourceCaveatsSection record={SRC_0093} />);

    expect(
      screen.getByText(
        "O estudo é um experimento controlado realizado numa área de 10 quarteirões em Belltown, Seattle, com 11 condutores, 33 rotas e 495 entregas simuladas."
      )
    ).toBeTruthy();
  });

  it("does not invent severity, warning, or validity judgement text", () => {
    render(<SourceCaveatsSection record={SRC_0093} />);

    expect(screen.queryByText(/severidade/i)).toBeNull();
    expect(screen.queryByText(/aviso/i)).toBeNull();
    expect(screen.queryByText(/inválid/i)).toBeNull();
    expect(screen.queryByText(/alerta/i)).toBeNull();
  });

  it("does not render EVD-like fields/notes present in a focused fixture", () => {
    const record = {
      ...MINIMAL_SRC,
      caveats: ["Limitação canónica."],
      notes: "Nota de evidência que não deve aparecer aqui.",
      representativeness: "low",
      verification: "unverified",
      temporal_relevance: "current",
      research_role: "primary",
    };
    render(<SourceCaveatsSection record={record} />);

    expect(screen.queryByText("Nota de evidência que não deve aparecer aqui.")).toBeNull();
    expect(screen.queryByText(/representativeness/i)).toBeNull();
    expect(screen.queryByText(/verification/i)).toBeNull();
    expect(screen.queryByText(/temporal_relevance/i)).toBeNull();
    expect(screen.queryByText(/research_role/i)).toBeNull();
  });

  it("renders no publisher/access/licensing/geography content from other SRC fields", () => {
    render(<SourceCaveatsSection record={SRC_0093} />);

    expect(screen.queryByText("Scientific Reports (Springer Nature)")).toBeNull();
    expect(screen.queryByText("Público")).toBeNull();
    expect(screen.queryByText("CC BY 4.0")).toBeNull();
    expect(screen.queryByText("Belltown, Seattle, Washington, EUA")).toBeNull();
    expect(screen.queryByText("https://doi.org/10.1038/s41598-022-23987-z")).toBeNull();
  });
});
