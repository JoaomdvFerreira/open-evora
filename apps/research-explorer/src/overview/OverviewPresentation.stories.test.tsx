import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { composeStories } from "@storybook/react-vite";
import * as stories from "./OverviewPresentation.stories";

/**
 * Bounded harness regression: confirms every Full composition story renders
 * the complete public-page shell (real ExplorerHeader above Overview inside
 * `main.explorer-shell`, real PublicFooter outside it) rather than Overview's
 * body alone — see FullOverviewShell in OverviewPresentation.stories.tsx.
 * Not a visual-acceptance test; deliberately does not assert pixel values.
 */
const composed = composeStories(stories);

describe("Overview/Full composition story shell", () => {
  it.each(Object.entries(composed))("%s includes real Header and Footer chrome", (_name, Story) => {
    const { container } = render(<Story />);

    // Real ExplorerHeader, inside main.explorer-shell.
    const main = container.querySelector("main.explorer-shell");
    expect(main).not.toBeNull();
    const header = main?.querySelector("header.explorer-chrome") ?? null;
    expect(header).not.toBeNull();
    // `{ hidden: true }` (visual-completion compact pass, task §2): the nav
    // group now sits inside `.explorer-chrome-menu`, collapsed by default
    // (native `hidden` attribute) and only shown at >=768px via a CSS
    // override jsdom does not evaluate (no layout/media-query engine) — this
    // is a structural DOM check, not a real accessibility-tree visibility
    // assertion, so hidden elements must be included here, same as the
    // `querySelector` reads elsewhere in this test.
    expect(screen.getAllByRole("button", { name: "Problemas", hidden: true })[0].getAttribute("aria-current")).toBe("page");

    // Real PublicFooter, rendered outside main.explorer-shell.
    const footer = container.querySelector("footer.public-footer");
    expect(footer).not.toBeNull();
    expect(main?.contains(footer)).toBe(false);
  });
});
