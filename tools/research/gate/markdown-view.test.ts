import assert from "node:assert/strict";
import test from "node:test";

import { gitFixture, loadIndexFor, syntheticHumanGatePackage } from "./test-fixtures.ts";
import { computeContentHash, shortFingerprint } from "./content-hash.ts";
import { renderHumanGateMarkdown } from "./markdown-view.ts";

test("the rendered Markdown view is generated from the exact same validated object HIGH-2 hashes, and exposes packageId/fingerprint/baseGitSha", () => {
  const fixture = gitFixture();
  try {
    const index = loadIndexFor(fixture.research);
    const pkg = syntheticHumanGatePackage(index, fixture.head());
    const markdown = renderHumanGateMarkdown(pkg);
    const contentHash = computeContentHash(pkg);

    assert.ok(markdown.includes(pkg.packageId));
    assert.ok(markdown.includes(pkg.baseGitSha));
    assert.ok(markdown.includes(shortFingerprint(contentHash)));
    assert.ok(markdown.includes(pkg.investigationQuestion));
  } finally {
    fixture.cleanup();
  }
});

test("the Markdown view visually distinguishes the recommendation from a decision and states AI output never constitutes approval", () => {
  const fixture = gitFixture();
  try {
    const index = loadIndexFor(fixture.research);
    const pkg = syntheticHumanGatePackage(index, fixture.head());
    const markdown = renderHumanGateMarkdown(pkg);
    assert.ok(markdown.includes("Non-authoritative recommendation"));
    assert.ok(/never constitutes? approval/i.test(markdown));
    assert.ok(markdown.includes("Not an Approval Until You Decide"));
  } finally {
    fixture.cleanup();
  }
});

test("rendering is deterministic: identical package objects produce byte-identical Markdown", () => {
  const fixture = gitFixture();
  try {
    const index = loadIndexFor(fixture.research);
    const pkg = syntheticHumanGatePackage(index, fixture.head());
    assert.equal(renderHumanGateMarkdown(pkg), renderHumanGateMarkdown(pkg));
  } finally {
    fixture.cleanup();
  }
});

test("every contractually required section heading is present in the rendered view", () => {
  const fixture = gitFixture();
  try {
    const index = loadIndexFor(fixture.research);
    const pkg = syntheticHumanGatePackage(index, fixture.head());
    const markdown = renderHumanGateMarkdown(pkg);
    const requiredHeadings = [
      "Investigation question",
      "Claim scope / candidate records",
      "Proposed deltas",
      "Provenance",
      "Inference limits",
      "Affected existing PRBs",
      "Contradiction / duplicate-overlap analysis",
      "Prospective validation result",
      "Structured readiness result",
      "Independent AI review",
      "Canonical integration plan",
      "Expected Explorer / public effect",
      "Risks / unresolved uncertainties",
      "Non-authoritative recommendation",
    ];
    for (const heading of requiredHeadings) {
      assert.ok(markdown.includes(heading), `missing required section: ${heading}`);
    }
  } finally {
    fixture.cleanup();
  }
});

test("markdown-view.ts never imports decision.ts or decision-record.ts (rendering cannot itself decide or persist a decision)", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const source = readFileSync(fileURLToPath(new URL("./markdown-view.ts", import.meta.url)), "utf8");
  assert.ok(!source.includes("decision.ts"));
  assert.ok(!source.includes("decision-record.ts"));
});
