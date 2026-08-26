import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceLicensingSection } from "./SourceLicensingSection";

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

function withLicensing(licensing: Record<string, unknown>): Record<string, unknown> {
  return { ...MINIMAL_SRC, licensing: { status: "unknown", reuse: "unknown", ...licensing } };
}

describe("SourceLicensingSection", () => {
  it("renders every Licenciamento field for the SRC-0093-shaped complete example", () => {
    render(<SourceLicensingSection record={SRC_0093} />);

    expect(screen.getByRole("heading", { name: "Licenciamento" })).toBeTruthy();
    expect(screen.getByText("Estado do licenciamento")).toBeTruthy();
    expect(screen.getByText("Conhecido")).toBeTruthy();
    expect(screen.getByText("Licença")).toBeTruthy();
    expect(screen.getByText("CC BY 4.0")).toBeTruthy();
    expect(screen.getByText("Reutilização")).toBeTruthy();
    expect(screen.getByText("Permitida")).toBeTruthy();
    expect(screen.getByText("Atribuição")).toBeTruthy();
    expect(screen.getByText("Giacomo Dalla Chiara, Klaas Fiete Krutein, Andisheh Ranjbari e Anne Goodchild")).toBeTruthy();
  });

  it("renders Desconhecido for licensing.status unknown", () => {
    render(<SourceLicensingSection record={MINIMAL_SRC} />);

    expect(screen.getByText("Estado do licenciamento")).toBeTruthy();
    expect(screen.getByText("Desconhecido")).toBeTruthy();
  });

  it("renders Desconhecida for licensing.reuse unknown, not interpreted as prohibited", () => {
    render(<SourceLicensingSection record={MINIMAL_SRC} />);

    expect(screen.getByText("Reutilização")).toBeTruthy();
    expect(screen.getByText("Desconhecida")).toBeTruthy();
    expect(screen.queryByText("Proibida")).toBeNull();
  });

  it("renders Restrita for licensing.reuse restricted", () => {
    const record = withLicensing({ reuse: "restricted" });
    render(<SourceLicensingSection record={record} />);

    expect(screen.getByText("Reutilização")).toBeTruthy();
    expect(screen.getByText("Restrita")).toBeTruthy();
  });

  it("renders Proibida for licensing.reuse prohibited", () => {
    const record = withLicensing({ reuse: "prohibited" });
    render(<SourceLicensingSection record={record} />);

    expect(screen.getByText("Reutilização")).toBeTruthy();
    expect(screen.getByText("Proibida")).toBeTruthy();
  });

  it("omits the Licença row when licence is absent", () => {
    render(<SourceLicensingSection record={MINIMAL_SRC} />);

    expect(screen.queryByText("Licença")).toBeNull();
  });

  it("omits the Atribuição row when attribution is absent", () => {
    render(<SourceLicensingSection record={MINIMAL_SRC} />);

    expect(screen.queryByText("Atribuição")).toBeNull();
  });

  it("renders the canonical licence string unchanged, without transformation", () => {
    const record = withLicensing({ status: "known", licence: "CC BY-NC-SA 4.0" });
    render(<SourceLicensingSection record={record} />);

    expect(screen.getByText("CC BY-NC-SA 4.0")).toBeTruthy();
  });

  it("renders the canonical attribution string unchanged, without transformation", () => {
    const record = withLicensing({ status: "known", attribution: "Câmara Municipal de Évora, dados abertos" });
    render(<SourceLicensingSection record={record} />);

    expect(screen.getByText("Câmara Municipal de Évora, dados abertos")).toBeTruthy();
  });

  it("keeps licensing.status and licensing.reuse distinct: restricted reuse never renders as a status interpretation", () => {
    const record = withLicensing({ status: "known", reuse: "restricted" });
    render(<SourceLicensingSection record={record} />);

    expect(screen.getByText("Estado do licenciamento")).toBeTruthy();
    expect(screen.getByText("Conhecido")).toBeTruthy();
    expect(screen.getByText("Reutilização")).toBeTruthy();
    expect(screen.getByText("Restrita")).toBeTruthy();
    expect(screen.queryByText("Restrito")).toBeNull();
  });

  it("renders no access/date/geography/caveat/EVD/PRB content", () => {
    render(<SourceLicensingSection record={SRC_0093} />);

    expect(screen.queryByText("Belltown, Seattle, Washington, EUA")).toBeNull();
    expect(screen.queryByText("Público")).toBeNull();
    expect(screen.queryByText("Disponível")).toBeNull();
    expect(screen.queryByText("Navegador")).toBeNull();
    expect(screen.queryByText("HTML")).toBeNull();
    expect(screen.queryByText("Scientific Reports (Springer Nature)")).toBeNull();
    expect(screen.queryByText(/11 de novembro de 2022/)).toBeNull();
    expect(screen.queryByText(/quarteirões/)).toBeNull();
    expect(screen.queryByText("https://doi.org/10.1038/s41598-022-23987-z")).toBeNull();
  });
});
