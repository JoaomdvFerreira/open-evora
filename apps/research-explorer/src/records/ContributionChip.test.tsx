import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CANONICAL_CONTRIBUTION_ORDER, ContributionChip } from "./ContributionChip";
import { publicEnumLabel } from "../presentation";

const CANONICAL_VALUES = [
  "CONFIRMS",
  "REFINES",
  "CONTRADICTS",
  "CURRENT-STATE-UPDATE",
  "EXISTING-SOLUTION",
  "PLANNED-SOLUTION",
  "NEW-CANDIDATE",
];

describe("ContributionChip", () => {
  it("exposes the current canonical enum in schema order", () => {
    expect(CANONICAL_CONTRIBUTION_ORDER).toEqual(CANONICAL_VALUES);
  });

  it.each(CANONICAL_VALUES)("renders the public PT-PT label for %s", (value) => {
    render(<ContributionChip value={value} />);
    expect(screen.getByText(publicEnumLabel("contribution", value))).toBeTruthy();
  });

  it("renders an unrecognised future value's text without crashing and without a glyph", () => {
    render(<ContributionChip value="COVERAGE-GAP" />);
    expect(screen.getByText("COVERAGE-GAP")).toBeTruthy();
  });

  it("gives every canonical value, including CONTRADICTS, identical structural class treatment", () => {
    const { container: contradictsContainer } = render(<ContributionChip value="CONTRADICTS" />);
    const { container: confirmsContainer } = render(<ContributionChip value="CONFIRMS" />);
    const contradictsChip = contradictsContainer.querySelector(".contribution-chip")!;
    const confirmsChip = confirmsContainer.querySelector(".contribution-chip")!;
    expect(contradictsChip.className).toBe(confirmsChip.className);
  });

  it.each([
    ["CONFIRMS", "Reforça uma leitura já sustentada."],
    ["REFINES", "Acrescenta detalhe ou restringe a leitura atual."],
    ["CURRENT-STATE-UPDATE", "Traz informação mais recente sobre a situação."],
    ["EXISTING-SOLUTION", "Documenta uma resposta ou intervenção já existente."],
    ["PLANNED-SOLUTION", "Documenta uma resposta prevista, não necessariamente executada."],
    ["CONTRADICTS", "Apresenta evidência em tensão com a leitura atual."],
  ])("PI-02F3: exposes an accessible explanation for %s, reachable via aria-describedby", (value, explanation) => {
    render(<ContributionChip value={value} />);
    const chip = screen.getByText(publicEnumLabel("contribution", value)).closest(".contribution-chip")!;
    const describedById = chip.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    const note = document.getElementById(describedById!)!;
    expect(note.textContent).toBe(explanation);
  });

  it("PI-02F3: the explanation note becomes visible via keyboard focus, not only pointer hover", async () => {
    const user = userEvent.setup();
    render(<ContributionChip value="CONFIRMS" />);
    const chip = screen.getByText("Confirma").closest(".contribution-chip") as HTMLElement;
    expect(chip.tabIndex).toBe(0);
    await user.tab();
    expect(document.activeElement).toBe(chip);
  });

  it("PI-02F3: introduces no ranking or severity styling — every explained value keeps identical chip classes", () => {
    const { container: confirmsContainer } = render(<ContributionChip value="CONFIRMS" />);
    const { container: contradictsContainer } = render(<ContributionChip value="CONTRADICTS" />);
    expect(confirmsContainer.querySelector(".contribution-chip")!.className).toBe(
      contradictsContainer.querySelector(".contribution-chip")!.className
    );
  });
});
