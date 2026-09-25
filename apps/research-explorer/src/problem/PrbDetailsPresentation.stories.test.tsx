import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { composeStories } from "@storybook/react-vite";
import * as stories from "./PrbDetailsPresentation.stories";
import storiesSource from "./PrbDetailsPresentation.stories.tsx?raw";
import prb0005 from "../../generated/record-detail/PRB-0005.json";

/**
 * Bounded harness regression: confirms every "Public/PRB Details / PRB0005"
 * story renders the complete public-page shell (real ExplorerHeader above
 * the composition inside `main.explorer-shell`, real PublicFooter outside
 * it) and the real canonical PRB-0005 content resolved through the same
 * DataProvider-backed data path production uses — not a hand-authored
 * fixture prop set. Not a visual-acceptance test.
 */
const composed = composeStories(stories);

describe("Public/PRB Details / PRB0005 story shell", () => {
  it.each(Object.entries(composed))("%s includes real Header/Footer chrome and resolves real PRB-0005 content", async (_name, Story) => {
    const { container } = render(<Story />);

    const main = container.querySelector("main.explorer-shell");
    expect(main).not.toBeNull();
    expect(main?.querySelector("header.explorer-chrome")).not.toBeNull();

    const footer = container.querySelector("footer.public-footer");
    expect(footer).not.toBeNull();
    expect(main?.contains(footer)).toBe(false);

    expect(await screen.findByText(/tráfego automóvel e a pressão de estacionamento/)).toBeTruthy();
    expect(screen.getByText("PRB-0005")).toBeTruthy();
  });

  it("renders the canonical PRB-0005 causal reading and open-question fields verbatim, with no manually selected evidence subset", async () => {
    const record = prb0005.record as { causal_reading?: string; investigation: { open_questions: Record<string, unknown>[] } };
    render(<composed.Desktop1440 />);
    const reading = await screen.findByRole("region", { name: "Leitura atual" });
    expect(reading.querySelector(".prb-current-reading")?.textContent).toBe(record.causal_reading);

    const renderedTexts = Array.from(document.querySelectorAll(".prb-open-question-field p")).map((node) => node.textContent);
    for (const question of record.investigation.open_questions) {
      for (const key of ["latest_result", "why_open", "resolution_condition", "current_action"]) {
        if (typeof question[key] === "string") expect(renderedTexts).toContain(question[key]);
      }
    }

    // The story passes the whole projection; it hard-codes no EVD identifiers.
    expect(storiesSource).not.toMatch(/EVD-\d/);
  });
});
