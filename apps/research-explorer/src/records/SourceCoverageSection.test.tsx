import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceCoverageSection } from "./SourceCoverageSection";

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

function withScope(scope: Record<string, unknown>): Record<string, unknown> {
  return { ...MINIMAL_SRC, scope: { geography: { level: "non_geographic" }, domains: ["DIG"], ...scope } };
}

describe("SourceCoverageSection", () => {
  it("renders every Cobertura field for the SRC-0093-shaped complete example", () => {
    render(<SourceCoverageSection record={SRC_0093} />);

    expect(screen.getByRole("heading", { name: "Cobertura" })).toBeTruthy();
    expect(screen.getByText("Área local")).toBeTruthy();
    expect(screen.getByText("Belltown, Seattle, Washington, EUA")).toBeTruthy();
    expect(screen.getByText("MOB, DIG")).toBeTruthy();
    expect(screen.queryByText("Data de referência")).toBeNull();
    expect(screen.queryByText("Início")).toBeNull();
    expect(screen.queryByText("Fim")).toBeNull();
  });

  it("renders a full as_of date at full precision", () => {
    const record = withScope({ temporal: { as_of: "2024-08-25" } });
    render(<SourceCoverageSection record={record} />);

    expect(screen.getByText("Data de referência")).toBeTruthy();
    expect(screen.getByText(/25 de agosto de 2024/)).toBeTruthy();
  });

  it("renders an as_of YYYY-MM value without inventing a day", () => {
    const record = withScope({ temporal: { as_of: "2024-08" } });
    render(<SourceCoverageSection record={record} />);

    expect(screen.getByText("agosto de 2024")).toBeTruthy();
  });

  it("renders an as_of YYYY value without inventing a month or day", () => {
    const record = withScope({ temporal: { as_of: "2024" } });
    render(<SourceCoverageSection record={record} />);

    expect(screen.getByText("2024")).toBeTruthy();
  });

  it("renders an interval with full dates", () => {
    const record = withScope({ temporal: { start: "2020-01-01", end: "2024-08-25" } });
    render(<SourceCoverageSection record={record} />);

    expect(screen.getByText("Início")).toBeTruthy();
    expect(screen.getByText(/1 de janeiro de 2020/)).toBeTruthy();
    expect(screen.getByText("Fim")).toBeTruthy();
    expect(screen.getByText(/25 de agosto de 2024/)).toBeTruthy();
  });

  it("preserves partial granularities within an interval without inventing precision", () => {
    const record = withScope({ temporal: { start: "2020", end: "2024-08" } });
    render(<SourceCoverageSection record={record} />);

    expect(screen.getByText("2020")).toBeTruthy();
    expect(screen.getByText("agosto de 2024")).toBeTruthy();
  });

  it("renders no temporal rows when scope.temporal is absent", () => {
    render(<SourceCoverageSection record={MINIMAL_SRC} />);

    expect(screen.queryByText("Data de referência")).toBeNull();
    expect(screen.queryByText("Início")).toBeNull();
    expect(screen.queryByText("Fim")).toBeNull();
  });

  it("renders non_geographic scope without an area row or invented placeholder", () => {
    render(<SourceCoverageSection record={MINIMAL_SRC} />);

    expect(screen.getByText("Sem âmbito geográfico")).toBeTruthy();
    expect(screen.queryByText("Área")).toBeNull();
    expect(screen.queryByText("N/A")).toBeNull();
    expect(screen.queryByText("—")).toBeNull();
    expect(screen.queryByText("Sem informação")).toBeNull();
  });

  it("uses the existing PT-PT vocabulary for an unknown geography level", () => {
    const record = withScope({ geography: { level: "unknown" } });
    render(<SourceCoverageSection record={record} />);

    expect(screen.getByText("Desconhecido")).toBeTruthy();
  });

  it("renders multiple domains as canonical codes, unchanged", () => {
    const record = withScope({ domains: ["MOB", "DIG"] });
    render(<SourceCoverageSection record={record} />);

    expect(screen.getByText("MOB, DIG")).toBeTruthy();
  });

  it("renders no publication/access/licensing/EVD/PRB content", () => {
    render(<SourceCoverageSection record={SRC_0093} />);

    expect(screen.queryByText("CC BY 4.0")).toBeNull();
    expect(screen.queryByText("Permitida")).toBeNull();
    expect(screen.queryByText("Público")).toBeNull();
    expect(screen.queryByText("Scientific Reports (Springer Nature)")).toBeNull();
    expect(screen.queryByText(/Verificada pela Open Évora/)).toBeNull();
    expect(screen.queryByText(/quarteirões/)).toBeNull();
  });
});
