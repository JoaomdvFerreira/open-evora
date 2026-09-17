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

  it("gives distinct PT-PT labels to every canonical code", () => {
    expect(describeTopic("MOB").label).toBe("Mobilidade");
    expect(describeTopic("ACC").label).toBe("Acessibilidade");
    expect(describeTopic("URB").label).toBe("Urbanismo");
    expect(describeTopic("HOU").label).toBe("Habitação");
  });

  it("gives every audited canonical code its own distinguishable tone and icon", () => {
    const audited = ["MOB", "URB", "ACC", "ENV", "PUB", "EMP", "EDU", "ECO", "SOC", "HEA", "HOU", "DIG"];
    const tones = audited.map((code) => describeTopic(code).tone);
    const icons = audited.map((code) => describeTopic(code).icon);
    expect(new Set(tones).size).toBe(audited.length);
    expect(new Set(icons).size).toBe(audited.length);
  });

  it("falls back to a safe neutral topic for an unmapped/future domain code rather than omitting a label", () => {
    const fallback = describeTopic("ZZZ-FUTURE");
    expect(fallback.label).toBe("Outro");
    expect(fallback.tone).toBe("neutral");
    expect(fallback.icon).toBeDefined();
  });
});
