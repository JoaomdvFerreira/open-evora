import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { composeStories } from "@storybook/react-vite";
import * as stories from "./PrbDetailsPresentation.stories";

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
});
