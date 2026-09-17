import { describe, expect, it } from "vitest";
import { auditedDomainCodes, describeTopic } from "./topicMapping";

describe("describeTopic", () => {
  it("covers every PRB domain code audited across research/problems/PRB-*.yaml", () => {
    const audited = ["MOB", "URB", "ACC", "ENV", "PUB", "EMP", "EDU", "ECO", "SOC", "HEA", "HOU", "DIG"];
    for (const code of audited) {
      expect(describeTopic(code).label).toBeTruthy();
    }
    expect(auditedDomainCodes().sort()).toEqual([...audited].sort());
  });

  it("gives distinct PT-PT labels to distinct canonical codes even when they share a tone/icon grouping", () => {
    expect(describeTopic("MOB").label).toBe("Mobilidade");
    expect(describeTopic("ACC").label).toBe("Acessibilidade");
    expect(describeTopic("URB").label).toBe("Urbanismo");
    expect(describeTopic("HOU").label).toBe("Habitação");
  });

  it("falls back to a safe neutral topic for an unmapped/future domain code rather than omitting a label", () => {
    const fallback = describeTopic("ZZZ-FUTURE");
    expect(fallback.label).toBe("Outro");
    expect(fallback.tone).toBe("neutral");
    expect(fallback.icon).toBeDefined();
  });
});
