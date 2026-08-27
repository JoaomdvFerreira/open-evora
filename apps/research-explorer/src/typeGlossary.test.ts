import { describe, expect, it } from "vitest";
import { describeType, formatTypedId, knownTypePrefixes } from "./typeGlossary";

describe("describeType", () => {
  it("describes each of the three current canonical types", () => {
    expect(describeType("SRC-").label).toBe("Fonte");
    expect(describeType("EVD-").label).toBe("Evidência");
    expect(describeType("PRB-").label).toBe("Problema");
  });

  it("uses the approved neutral EVD public description", () => {
    expect(describeType("EVD-").description).toBe("Evidência é um registo com proveniência e limites explícitos.");
  });

  it("degrades gracefully for an unknown future type rather than omitting a label", () => {
    const descriptor = describeType("WID-");
    expect(descriptor.label).toBe("WID");
    expect(descriptor.description).toContain("esquema canónico");
  });
});

describe("formatTypedId", () => {
  it("prefixes an ID with its type label for inline orientation", () => {
    expect(formatTypedId("EVD-", "EVD-000105")).toBe("[Evidência] EVD-000105");
  });

  it("degrades gracefully for an unknown type", () => {
    expect(formatTypedId("WID-", "WID-0001")).toBe("[WID] WID-0001");
  });
});

describe("knownTypePrefixes", () => {
  it("lists exactly the three current canonical prefixes", () => {
    expect(knownTypePrefixes().sort()).toEqual(["EVD-", "PRB-", "SRC-"]);
  });
});
