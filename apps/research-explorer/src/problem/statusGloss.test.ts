import { describe, expect, it } from "vitest";
import { glossFor } from "./statusGloss";

describe("glossFor", () => {
  it("returns the lifecycle label for OPEN without defining closure as a list of prior terminal outcomes", () => {
    const gloss = glossFor("status", "OPEN");
    expect(gloss?.label).toBe("Aberto");
  });

  it("returns a grounded gloss for validation_status's three D5-contract values", () => {
    expect(glossFor("validation_status", "unvalidated")?.label).toBe("Por validar");
    expect(glossFor("validation_status", "unvalidated")?.explanation).toBeTruthy();
    expect(glossFor("validation_status", "partially_validated")?.explanation).toBeTruthy();
    expect(glossFor("validation_status", "validated")?.explanation).toBeTruthy();
  });

  it("never claims corroborated means independent-source corroboration", () => {
    const gloss = glossFor("evidence_status", "corroborated");
    expect(gloss?.label).toBeTruthy();
    expect(gloss?.explanation ?? "").not.toMatch(/independent/i);
    expect(gloss?.explanation ?? "").not.toMatch(/fontes independentes/i);
    expect(gloss?.explanation ?? "").toMatch(/não está documentado/);
  });

  it("does not manufacture an explanation for digital_tractability beyond a literal translation", () => {
    expect(glossFor("digital_tractability", "low")?.explanation).toBeUndefined();
    expect(glossFor("digital_tractability", "not_assessed")?.explanation).toBeUndefined();
  });

  it("returns null for an unrecognised field or value, never a fabricated gloss", () => {
    expect(glossFor("status", "SOME-FUTURE-VALUE")).toBeNull();
    expect(glossFor("some_future_field", "x")).toBeNull();
  });
});
