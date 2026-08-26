import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SourceTechnicalSection } from "./SourceTechnicalSection";

/** SRC-0093-shaped canonical record, covering the fields the task names as representative. */
const SRC_0093: Record<string, unknown> = {
  source_id: "SRC-0093",
  publisher: "Scientific Reports (Springer Nature)",
  creators: ["A. Author"],
  name: "Providing curb availability information to delivery drivers reduces cruising for parking",
  resource_type: "journal-article",
  identity: {
    persistent_identifier: "10.1038/s41598-022-00000-0",
  },
  scope: {
    geography: { level: "national", area: "Portugal" },
    domains: ["mobility"],
  },
  access: {
    level: "public",
    availability: "available",
    machine_readable: "unknown",
  },
  acquisition: {
    method: "manual",
  },
  canonical_reference: "https://doi.org/10.1038/s41598-022-00000-0",
  licensing: {
    status: "known",
    licence: "CC-BY-4.0",
  },
  temporal: {
    published_at: "2022",
    last_checked_at: "2026-08-11",
  },
  caveats: ["Comparator/mechanism evidence, not Évora-specific."],
};

/** Minimal valid canonical SRC record, missing every optional field above. */
const SRC_MINIMAL: Record<string, unknown> = {
  source_id: "SRC-0001",
  name: "Minimal source",
};

async function openDisclosure() {
  const user = userEvent.setup();
  await user.click(screen.getByText("Inspeção completa do registo canónico"));
}

describe("SourceTechnicalSection", () => {
  it("1. section heading 'Informação técnica' renders", () => {
    render(<SourceTechnicalSection record={SRC_0093} />);
    expect(screen.getByRole("heading", { name: "Informação técnica" })).toBeTruthy();
  });

  it("2. disclosure summary 'Inspeção completa do registo canónico' renders", () => {
    render(<SourceTechnicalSection record={SRC_0093} />);
    expect(screen.getByText("Inspeção completa do registo canónico")).toBeTruthy();
  });

  it("3. disclosure is closed by default", () => {
    const { container } = render(<SourceTechnicalSection record={SRC_0093} />);
    const details = container.querySelector("details");
    expect(details?.hasAttribute("open")).toBe(false);
  });

  it("4. opening the disclosure reveals the canonical record tree", async () => {
    const { container } = render(<SourceTechnicalSection record={SRC_0093} />);
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    await openDisclosure();
    expect(details.open).toBe(true);
    expect(screen.getByText("SRC-0093")).toBeTruthy();
  });

  it("5. SRC-0093-shaped record exposes representative fields", async () => {
    render(<SourceTechnicalSection record={SRC_0093} />);
    await openDisclosure();

    expect(screen.getByText("source_id")).toBeTruthy();
    expect(screen.getByText("SRC-0093")).toBeTruthy();
    expect(screen.getByText("resource_type")).toBeTruthy();
    expect(screen.getByText("journal-article")).toBeTruthy();
    expect(screen.getByText("persistent_identifier")).toBeTruthy();
    expect(screen.getByText("10.1038/s41598-022-00000-0")).toBeTruthy();
    expect(screen.getByText("scope")).toBeTruthy();
    expect(screen.getByText("access")).toBeTruthy();
    expect(screen.getByText("acquisition")).toBeTruthy();
    expect(screen.getByText("canonical_reference")).toBeTruthy();
    expect(screen.getByText("licensing")).toBeTruthy();
    expect(screen.getByText("temporal")).toBeTruthy();
    expect(screen.getByText("caveats")).toBeTruthy();
  });

  it("6. optional absent canonical fields are simply absent", async () => {
    render(<SourceTechnicalSection record={SRC_MINIMAL} />);
    await openDisclosure();

    expect(screen.getByText("SRC-0001")).toBeTruthy();
    expect(screen.queryByText("licensing")).toBeNull();
    expect(screen.queryByText("caveats")).toBeNull();
    expect(screen.queryByText("acquisition")).toBeNull();
  });

  it("7. no repository/YAML path is rendered", async () => {
    render(<SourceTechnicalSection record={SRC_0093} />);
    await openDisclosure();

    expect(screen.queryByText(/\.yaml/)).toBeNull();
    expect(screen.queryByText("file")).toBeNull();
  });

  it("8. no relation count is rendered", () => {
    render(<SourceTechnicalSection record={SRC_0093} />);
    expect(screen.queryByText(/registo\(s\) relacionado\(s\)/)).toBeNull();
    expect(screen.queryByText("Relações")).toBeNull();
  });

  it("9. no edge/path syntax is rendered", () => {
    render(<SourceTechnicalSection record={SRC_0093} />);
    expect(screen.queryByLabelText("Registos relacionados")).toBeNull();
    expect(screen.queryByText(/caminho\(s\) de entrada/)).toBeNull();
  });

  it("10. no separate manually-authored identity/acquisition summary is introduced", () => {
    render(<SourceTechnicalSection record={SRC_0093} />);
    expect(screen.queryByRole("heading", { name: "Identidade" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Aquisição" })).toBeNull();
  });
});
