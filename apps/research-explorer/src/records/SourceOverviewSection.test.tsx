import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceOverviewSection } from "./SourceOverviewSection";

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

describe("SourceOverviewSection", () => {
  it("renders every Visão geral field for the SRC-0093-shaped complete example", () => {
    render(<SourceOverviewSection record={SRC_0093} />);

    expect(screen.getByRole("heading", { name: "Visão geral" })).toBeTruthy();
    expect(screen.getByText("Scientific Reports (Springer Nature)")).toBeTruthy();
    expect(screen.getByText("Documento")).toBeTruthy();
    expect(screen.getByText("Giacomo Dalla Chiara, Klaas Fiete Krutein, Andisheh Ranjbari, Anne Goodchild")).toBeTruthy();
    expect(screen.getByText(/Verificada pela Open Évora em/)).toBeTruthy();
    expect(screen.getByText(/25 de ago(\.|osto) de 2026|25\/08\/2026/)).toBeTruthy();
  });

  it("still renders the section for a minimal SRC, omitting absent optional rows without inventing placeholders", () => {
    render(<SourceOverviewSection record={MINIMAL_SRC} />);

    expect(screen.getByRole("heading", { name: "Visão geral" })).toBeTruthy();
    expect(screen.queryByText("Editor")).toBeNull();
    expect(screen.queryByText("Autores / criadores")).toBeNull();
    expect(screen.queryByText("N/A")).toBeNull();
    expect(screen.queryByText("—")).toBeNull();
    expect(screen.queryByText("Sem informação")).toBeNull();
    expect(screen.getByText("Página web")).toBeTruthy();
    expect(screen.getByText(/Verificada pela Open Évora em/)).toBeTruthy();
  });

  it("uses the existing presentation vocabulary's fallback for an unknown resource_type", () => {
    const record = { ...MINIMAL_SRC, resource_type: "some_future_type" };
    render(<SourceOverviewSection record={record} />);

    expect(screen.getByText("some_future_type")).toBeTruthy();
  });

  it("does not render canonical_reference", () => {
    render(<SourceOverviewSection record={SRC_0093} />);

    expect(screen.queryByText("https://doi.org/10.1038/s41598-022-23987-z")).toBeNull();
  });

  it("renders no access/licensing/coverage/EVD/PRB content", () => {
    render(<SourceOverviewSection record={SRC_0093} />);

    expect(screen.queryByText("CC BY 4.0")).toBeNull();
    expect(screen.queryByText(/Belltown/)).toBeNull();
    expect(screen.queryByText(/quarteirões/)).toBeNull();
    expect(screen.queryByText("Permitida")).toBeNull();
    expect(screen.queryByText("Público")).toBeNull();
  });
});
