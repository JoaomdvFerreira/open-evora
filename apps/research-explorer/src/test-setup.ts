import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  // Restore every `vi.spyOn` spy (e.g. on window.history) after each test,
  // even one that failed before reaching its own cleanup, so no test can
  // observe another test's spied calls regardless of execution order.
  vi.restoreAllMocks();
});
