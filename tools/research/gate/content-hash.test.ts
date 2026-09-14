import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { gitFixture, loadIndexFor, syntheticHumanGatePackage } from "./test-fixtures.ts";
import { computeContentHash, derivePackageIdentity, shortFingerprint } from "./content-hash.ts";

test("computeContentHash is deterministic across repeated calls on the same package", () => {
  const fixture = gitFixture();
  try {
    const index = loadIndexFor(fixture.research);
    const pkg = syntheticHumanGatePackage(index, fixture.head());
    const a = computeContentHash(pkg);
    const b = computeContentHash(pkg);
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]{64}$/);
  } finally {
    fixture.cleanup();
  }
});

test("computeContentHash changes when any package field changes", () => {
  const fixture = gitFixture();
  try {
    const index = loadIndexFor(fixture.research);
    const pkg = syntheticHumanGatePackage(index, fixture.head());
    const original = computeContentHash(pkg);
    const mutated = { ...pkg, nonAuthoritativeRecommendation: pkg.nonAuthoritativeRecommendation + " mutated" };
    const mutatedHash = computeContentHash(mutated);
    assert.notEqual(original, mutatedHash);
  } finally {
    fixture.cleanup();
  }
});

test("computeContentHash is never computed over the Markdown view (there is no such code path)", () => {
  // Structural guarantee: content-hash.ts imports only fingerprint.ts's
  // canonical JSON serializer and operates on HumanGatePackage objects; it
  // has no dependency on markdown-view.ts. This test documents that
  // invariant by asserting the module never imports it.
  const contents = readFileSync(fileURLToPath(new URL("./content-hash.ts", import.meta.url)), "utf8");
  assert.ok(!contents.includes("markdown-view"));
});

test("derivePackageIdentity exposes packageId/schemaVersion/baseGitSha/contentHash", () => {
  const fixture = gitFixture();
  try {
    const index = loadIndexFor(fixture.research);
    const pkg = syntheticHumanGatePackage(index, fixture.head());
    const identity = derivePackageIdentity(pkg);
    assert.equal(identity.packageId, pkg.packageId);
    assert.equal(identity.schemaVersion, "1");
    assert.equal(identity.baseGitSha, pkg.baseGitSha);
    assert.equal(identity.contentHash, computeContentHash(pkg));
  } finally {
    fixture.cleanup();
  }
});

test("shortFingerprint is a prefix of the full contentHash, for display only", () => {
  const fixture = gitFixture();
  try {
    const index = loadIndexFor(fixture.research);
    const pkg = syntheticHumanGatePackage(index, fixture.head());
    const full = computeContentHash(pkg);
    const short = shortFingerprint(full);
    assert.ok(full.startsWith(short));
    assert.ok(short.length < full.length);
  } finally {
    fixture.cleanup();
  }
});
