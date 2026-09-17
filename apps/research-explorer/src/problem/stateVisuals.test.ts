import { describe, expect, it } from "vitest";
import { evidenceVisual, lifecycleVisual, validationVisual } from "./stateVisuals";

describe("lifecycleVisual", () => {
  it("covers every canonical status value", () => {
    for (const value of ["OPEN", "REJECTED", "DUPLICATE", "NON_DIGITAL", "ALREADY_SOLVED", "INSUFFICIENT_EVIDENCE"]) {
      expect(lifecycleVisual(value).icon).toBeDefined();
    }
  });

  it("falls back to a neutral tone for an unrecognised future value", () => {
    expect(lifecycleVisual("SOME-FUTURE-STATUS").tone).toBe("neutral");
  });
});

describe("validationVisual / evidenceVisual", () => {
  it("cover every canonical value for each dimension", () => {
    for (const value of ["unvalidated", "partially_validated", "validated"]) {
      expect(validationVisual(value).icon).toBeDefined();
    }
    for (const value of ["discovered", "corroborated"]) {
      expect(evidenceVisual(value).icon).toBeDefined();
    }
  });

  it("resolve independently — the same word never implies a shared lookup", () => {
    expect(validationVisual("validated").tone).toBe("affirmed");
    expect(evidenceVisual("corroborated").tone).toBe("affirmed");
    // Same tone name is permitted (both are semantically "affirmed"), but each
    // dimension resolves through its own lookup table, never the other's.
    expect(validationVisual("discovered").tone).toBe("neutral");
    expect(evidenceVisual("validated").tone).toBe("neutral");
  });

  it("falls back to a neutral tone for an unrecognised future value on each dimension", () => {
    expect(validationVisual("future-value").tone).toBe("neutral");
    expect(evidenceVisual("future-value").tone).toBe("neutral");
  });
});
