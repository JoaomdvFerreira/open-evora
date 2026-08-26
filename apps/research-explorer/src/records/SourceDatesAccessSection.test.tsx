import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceDatesAccessSection } from "./SourceDatesAccessSection";
import { formatPublicPartialDate } from "../presentation";

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

function withTemporal(temporal: Record<string, unknown>): Record<string, unknown> {
  return { ...MINIMAL_SRC, temporal: { last_checked_at: "2026-08-25", ...temporal } };
}

function withAccess(access: Record<string, unknown>): Record<string, unknown> {
  return { ...MINIMAL_SRC, access: { level: "unknown", availability: "unknown", machine_readable: "unknown", ...access } };
}

describe("SourceDatesAccessSection", () => {
  it("renders every Datas e acesso field for the SRC-0093-shaped complete example", () => {
    render(<SourceDatesAccessSection record={SRC_0093} />);

    expect(screen.getByRole("heading", { name: "Datas e acesso" })).toBeTruthy();
    expect(screen.getByText("Publicação")).toBeTruthy();
    expect(screen.getByText(/11 de novembro de 2022/)).toBeTruthy();
    expect(screen.getByText("Última verificação pela Open Évora")).toBeTruthy();
    expect(screen.getByText(formatPublicPartialDate("2026-08-25"))).toBeTruthy();
    expect(screen.queryByText("25/08/2026")).toBeNull();
    expect(screen.getByText("Público")).toBeTruthy();
    expect(screen.getByText("Disponível")).toBeTruthy();
    expect(screen.getByText("Não")).toBeTruthy();
    expect(screen.getByText("Navegador")).toBeTruthy();
    expect(screen.getByText("HTML")).toBeTruthy();
    expect(screen.getByText("https://doi.org/10.1038/s41598-022-23987-z")).toBeTruthy();
    expect(screen.queryByText("Última atualização da fonte")).toBeNull();
    expect(screen.queryByText("Frequência de atualização")).toBeNull();
  });

  it("preserves year-only precision for published_at", () => {
    const record = withTemporal({ published_at: "2022" });
    render(<SourceDatesAccessSection record={record} />);

    expect(screen.getByText("2022")).toBeTruthy();
  });

  it("preserves year-month precision for published_at", () => {
    const record = withTemporal({ published_at: "2022-11" });
    render(<SourceDatesAccessSection record={record} />);

    expect(screen.getByText("novembro de 2022")).toBeTruthy();
  });

  it("renders a full public date for updated_at", () => {
    const record = withTemporal({ updated_at: "2024-08-25" });
    render(<SourceDatesAccessSection record={record} />);

    expect(screen.getByText("Última atualização da fonte")).toBeTruthy();
    expect(screen.getByText(formatPublicPartialDate("2024-08-25"))).toBeTruthy();
  });

  it("renders the update_frequency enum label", () => {
    const record = withTemporal({ update_frequency: "quarterly" });
    render(<SourceDatesAccessSection record={record} />);

    expect(screen.getByText("Frequência de atualização")).toBeTruthy();
    expect(screen.getByText("Trimestral")).toBeTruthy();
  });

  it("renders Sim for machine_readable true", () => {
    const record = withAccess({ level: "public", availability: "available", machine_readable: true });
    render(<SourceDatesAccessSection record={record} />);

    expect(screen.getByText("Leitura automática")).toBeTruthy();
    expect(screen.getByText("Sim")).toBeTruthy();
  });

  it("renders Não for machine_readable false", () => {
    const record = withAccess({ level: "public", availability: "available", machine_readable: false });
    render(<SourceDatesAccessSection record={record} />);

    expect(screen.getByText("Leitura automática")).toBeTruthy();
    expect(screen.getByText("Não")).toBeTruthy();
  });

  it("renders Desconhecida for machine_readable unknown, not treated as false", () => {
    const record = withAccess({ level: "public", availability: "available", machine_readable: "unknown" });
    render(<SourceDatesAccessSection record={record} />);

    expect(screen.getByText("Leitura automática")).toBeTruthy();
    expect(screen.getByText("Desconhecida")).toBeTruthy();
    expect(screen.queryByText("Não")).toBeNull();
  });

  it("omits access.method and access.format rows when absent", () => {
    render(<SourceDatesAccessSection record={MINIMAL_SRC} />);

    expect(screen.queryByText("Forma de consulta")).toBeNull();
    expect(screen.queryByText("Formato")).toBeNull();
  });

  it("omits the canonical_reference row when absent", () => {
    render(<SourceDatesAccessSection record={MINIMAL_SRC} />);

    expect(screen.queryByText("Referência original")).toBeNull();
  });

  it("does not render scope.temporal coverage content", () => {
    const record = { ...SRC_0093, scope: { ...(SRC_0093.scope as Record<string, unknown>), temporal: { as_of: "2024-08-25" } } };
    render(<SourceDatesAccessSection record={record} />);

    expect(screen.queryByText("Data de referência")).toBeNull();
    expect(screen.queryByText(/25 de agosto de 2024/)).toBeNull();
  });

  it("renders canonical_reference as a clickable link when it is a valid https URL", () => {
    render(<SourceDatesAccessSection record={SRC_0093} />);

    const link = screen.getByRole("link", { name: "https://doi.org/10.1038/s41598-022-23987-z" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("https://doi.org/10.1038/s41598-022-23987-z");
    expect(link.textContent).toBe("https://doi.org/10.1038/s41598-022-23987-z");
  });

  it("renders canonical_reference as a clickable link when it is a valid http URL", () => {
    const record = { ...MINIMAL_SRC, canonical_reference: "http://example.org/source" };
    render(<SourceDatesAccessSection record={record} />);

    const link = screen.getByRole("link", { name: "http://example.org/source" });
    expect(link.getAttribute("href")).toBe("http://example.org/source");
  });

  it("renders canonical_reference as plain text when it is not a valid HTTP(S) URL", () => {
    const record = { ...MINIMAL_SRC, canonical_reference: "não é um URL" };
    render(<SourceDatesAccessSection record={record} />);

    expect(screen.queryByRole("link", { name: "não é um URL" })).toBeNull();
    expect(screen.getByText("não é um URL")).toBeTruthy();
  });

  it("canonical_reference link rendering does not depend on access.level or access.availability", () => {
    const record = {
      ...MINIMAL_SRC,
      access: { level: "restricted", availability: "unavailable", machine_readable: "unknown" },
      canonical_reference: "https://example.org/restricted-but-linkable",
    };
    render(<SourceDatesAccessSection record={record} />);

    const link = screen.getByRole("link", { name: "https://example.org/restricted-but-linkable" });
    expect(link).toBeTruthy();
  });

  it("does not introduce a duplicate 'Referência original' field", () => {
    render(<SourceDatesAccessSection record={SRC_0093} />);

    expect(screen.getAllByText("Referência original")).toHaveLength(1);
  });

  it("renders no licensing/geography/EVD/PRB content", () => {
    render(<SourceDatesAccessSection record={SRC_0093} />);

    expect(screen.queryByText("CC BY 4.0")).toBeNull();
    expect(screen.queryByText("Permitida")).toBeNull();
    expect(screen.queryByText("Belltown, Seattle, Washington, EUA")).toBeNull();
    expect(screen.queryByText("Scientific Reports (Springer Nature)")).toBeNull();
    expect(screen.queryByText(/quarteirões/)).toBeNull();
  });
});
