import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RailSectionIndex } from "./RailSectionIndex";
import { CompactSectionIndex } from "./CompactSectionIndex";
import type { SectionIndexEntry } from "./SectionIndexEntry";

const FLAT_ENTRIES: SectionIndexEntry[] = [
  { key: "a", label: "Alfa", href: "#alfa" },
  { key: "z", label: "Zulu", href: "#zulu" },
  { key: "m", label: "Mike", href: "#mike" },
];

const NESTED_ENTRIES: SectionIndexEntry[] = [
  { key: "top", label: "Topo", href: "#topo" },
  {
    key: "parent",
    label: "Pai",
    href: "#pai",
    entries: [
      { key: "child-1", label: "Filho 1", href: "#filho-1" },
      { key: "child-2", label: "Filho 2", href: "#filho-2" },
    ],
  },
];

describe("RailSectionIndex", () => {
  it("renders exactly one named nav landmark", () => {
    render(<RailSectionIndex label="Nesta página" entries={FLAT_ENTRIES} />);
    expect(screen.getAllByRole("navigation", { name: "Nesta página" })).toHaveLength(1);
  });

  it("renders flat entries in exactly the caller-supplied order with exact hrefs", () => {
    render(<RailSectionIndex label="Nesta página" entries={FLAT_ENTRIES} />);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Alfa", "Zulu", "Mike"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["#alfa", "#zulu", "#mike"]);
  });

  it("renders nested entries preserving parent/subsection order", () => {
    render(<RailSectionIndex label="Nesta página" entries={NESTED_ENTRIES} />);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Topo", "Pai", "Filho 1", "Filho 2"]);
  });
});

describe("CompactSectionIndex", () => {
  it("renders a native details/summary", () => {
    render(<CompactSectionIndex summary="Nesta fonte" navLabel="Nesta fonte (versão compacta)" entries={FLAT_ENTRIES} />);
    const summary = screen.getByText("Nesta fonte");
    expect(summary.closest("details")).not.toBeNull();
    expect(summary.tagName).toBe("SUMMARY");
  });

  it("compact nested nav keeps the same entries/hrefs as the rail", () => {
    render(<CompactSectionIndex summary="Nesta página" navLabel="Nesta página (versão compacta)" entries={NESTED_ENTRIES} />);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Topo", "Pai", "Filho 1", "Filho 2"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["#topo", "#pai", "#filho-1", "#filho-2"]);
  });
});
