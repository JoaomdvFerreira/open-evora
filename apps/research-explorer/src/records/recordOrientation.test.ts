import { describe, expect, it } from "vitest";
import { evidenceQuickRead } from "./recordOrientation";

describe("evidenceQuickRead", () => {
  it("uses only current EVD vNext fields", () => {
    expect(
      evidenceQuickRead({
        evidence_nature: "measurement",
        analysis: { representativeness: "LIMITED" },
      })
    ).toEqual([
      { field: "evidence_nature", label: "Natureza da evidência", value: "Medição" },
    ]);
  });
});
