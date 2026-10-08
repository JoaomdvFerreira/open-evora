import assert from "node:assert/strict";
import test from "node:test";

import { gitFixture, loadIndexFor, semanticHumanGatePackage, syntheticHumanGatePackage } from "./test-fixtures.ts";
import { computeContentHash, shortFingerprint } from "./content-hash.ts";
import { renderHumanGateMarkdown } from "./markdown-view.ts";

/** The Markdown block under the heading starting with `title`, up to the next heading. */
function section(markdown: string, title: string): string {
  const start = markdown.indexOf(`#### ${title}`);
  assert.notEqual(start, -1, `missing block ${title}`);
  const rest = markdown.slice(start);
  const end = rest.slice(1).search(/\n#{2,4} /);
  return end === -1 ? rest : rest.slice(0, end + 1);
}

test("a CONCUR review with no findings renders an explicit zero-findings state and no approval blocker", () => {
  const markdown = renderHumanGateMarkdown(semanticHumanGatePackage("CONCUR"));
  assert.ok(markdown.includes("## Independent semantic review (CLEC)"));
  assert.ok(markdown.includes("Outcome: `CONCUR`"));
  assert.ok(markdown.includes("Findings: 0"));
  assert.ok(markdown.includes("Reviewed signals: 3"));
  assert.ok(markdown.includes("Signal dispositions: SUPPORTED 2 · VIOLATION 0 · NOT_APPLICABLE 1 · INSUFFICIENT_EVIDENCE 0"));
  assert.ok(markdown.includes("_No findings: the independent review recorded 0 findings._"));
  assert.equal(markdown.includes("Canonical APPROVE is unavailable"), false);
});

test("a CLEC violation finding renders its verbatim claim, dimension, severity, evidence, correction direction and linked signal", () => {
  const pkg = semanticHumanGatePackage("DISAGREEMENT_FOUND");
  const markdown = renderHumanGateMarkdown(pkg);
  const finding = section(markdown, "CLEC-FND-0001");
  assert.ok(finding.includes("CLEC-FND-0001 — CLEC_VIOLATION (BLOCKING)"));
  assert.ok(finding.includes("- Record: `PRB-NEW`"));
  assert.ok(finding.includes("- Field: `problem_statement`"));
  assert.ok(finding.includes("- CLEC dimension: `supported_quantity`"));
  assert.ok(finding.includes("- Severity: `BLOCKING`"));
  assert.ok(finding.includes(`  > ${pkg.independentReview.findings[0].claim}`));
  assert.ok(finding.includes(`- Reason: ${pkg.independentReview.findings[0].reason}`));
  assert.ok(finding.includes("- Evidence references: `EVD-A`, `SRC-A`"));
  assert.ok(finding.includes(`- Correction direction: ${pkg.independentReview.findings[0].correctionDirection}`));
  assert.ok(finding.includes("- Related signals: `CLEC-SIG-0001`"));
  assert.ok(markdown.includes("**Canonical APPROVE is unavailable for this package:** the independent semantic review outcome is `DISAGREEMENT_FOUND`"));
});

test("an INSUFFICIENT_EVIDENCE finding stays visible as an evidence gap", () => {
  const markdown = renderHumanGateMarkdown(semanticHumanGatePackage("INSUFFICIENT_EVIDENCE"));
  const finding = section(markdown, "CLEC-FND-0001");
  assert.ok(finding.includes("CLEC-FND-0001 — INSUFFICIENT_EVIDENCE (BLOCKING)"));
  assert.ok(finding.includes("_Evidence gap: the supplied evidence context cannot decide whether this wording is supported._"));
  assert.ok(section(markdown, "CLEC-SIG-0001").includes("- Disposition: `INSUFFICIENT_EVIDENCE`"));
  assert.ok(markdown.includes("the independent semantic review outcome is `INSUFFICIENT_EVIDENCE`"));
});

test("every stored signal is rendered with its original context paired with its one disposition, in reviewer-package order", () => {
  const pkg = semanticHumanGatePackage("DISAGREEMENT_FOUND");
  const markdown = renderHumanGateMarkdown(pkg);
  const positions = pkg.reviewSignals.map(({ signalId }) => markdown.indexOf(`#### ${signalId}`));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  for (const { signalId, signal } of pkg.reviewSignals) {
    const disposition = pkg.independentReview.signalDispositions.find((d) => d.signalId === signalId)!;
    const block = section(markdown, signalId);
    assert.ok(block.startsWith(`#### ${signalId} — ${signal.code} → ${disposition.disposition}`));
    assert.ok(block.includes(`- Signal code: \`${signal.code}\``));
    assert.ok(block.includes(`- CLEC dimension: \`${signal.dimension}\``));
    assert.ok(block.includes(`- Subject record: \`${signal.subjectId}\``));
    assert.ok(block.includes(`- Field: \`${signal.field}\``));
    assert.ok(block.includes(`- Matched text: \`${signal.match}\``));
    assert.ok(block.includes(`  > ${signal.excerpt}`));
    assert.ok(block.includes(`- Disposition: \`${disposition.disposition}\``));
    assert.ok(block.includes(`- Disposition reason: ${disposition.reason}`));
    const refs = disposition.evidenceReferences.length > 0 ? disposition.evidenceReferences.map((r) => `\`${r}\``).join(", ") : "_none_";
    assert.ok(block.includes(`- Disposition evidence references: ${refs}`));
  }
  assert.ok(section(markdown, "CLEC-SIG-0001").includes("- Related findings: `CLEC-FND-0001`"));
});

test("SUPPORTED and NOT_APPLICABLE signals without findings remain visible", () => {
  const markdown = renderHumanGateMarkdown(semanticHumanGatePackage("CONCUR"));
  const supported = section(markdown, "CLEC-SIG-0001");
  assert.ok(supported.includes("CLEC-SIG-0001 — VAGUE_QUANTITY → SUPPORTED"));
  assert.ok(supported.includes("- Related findings: _none_"));
  const inapplicable = section(markdown, "CLEC-SIG-0003");
  assert.ok(inapplicable.includes("CLEC-SIG-0003 — VAGUE_FREQUENCY → NOT_APPLICABLE"));
  assert.ok(inapplicable.includes("- Subject record: `EVD-B`"));
});

test("the review evidence context is listed by ID and family without implying Source body content", () => {
  const markdown = renderHumanGateMarkdown(semanticHumanGatePackage("CONCUR"));
  for (const line of ["- `EVD-A` (EVD-)", "- `SRC-A` (SRC-)", "- `SRC-C` (SRC-)"]) assert.ok(markdown.includes(line), line);
  assert.ok(markdown.includes("Canonical SRC- records carry provenance and metadata, not the Source body"));
  assert.ok(markdown.includes("package JSON is the source of truth"));
});

test("semantic-review rendering is deterministic over the hash-bound package object and its JSON round trip", () => {
  const pkg = semanticHumanGatePackage("DISAGREEMENT_FOUND");
  const markdown = renderHumanGateMarkdown(pkg);
  const roundTripped = JSON.parse(JSON.stringify(pkg));
  assert.equal(computeContentHash(roundTripped), computeContentHash(pkg));
  assert.equal(renderHumanGateMarkdown(roundTripped), markdown);
  assert.ok(markdown.includes(shortFingerprint(computeContentHash(pkg))));
});

test("the rendered Markdown view is generated from the exact same validated object the content hash is computed over, and exposes packageId/fingerprint/baseGitSha", () => {
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
      "Independent semantic review (CLEC)",
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
