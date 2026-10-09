import { describe, expect, it, vi } from "vitest";

// D01-022: src/test-setup.ts must restore `vi.spyOn` spies after every test,
// so a history spy a test never restores itself cannot leak its call history
// into whichever test runs next.
describe("test setup — spy isolation", () => {
  it("leaves a window.history spy unrestored", () => {
    const pushSpy = vi.spyOn(window.history, "pushState");
    window.history.pushState(null, "", window.location.href);
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it("starts from the original window.history method and a fresh spy", () => {
    expect(vi.isMockFunction(window.history.pushState)).toBe(false);
    expect(vi.spyOn(window.history, "pushState")).not.toHaveBeenCalled();
  });
});
