import assert from "node:assert/strict";
import test from "node:test";

import type { ReviewSignal } from "../review/reviewer-input.ts";
import type { IndependentReviewResult, SignalDisposition, SignalDispositionValue } from "../review/types.ts";
import type { LaneBReviewUnit } from "./review-unit.ts";
import {
  isOwnedSummaryComment,
  laneBReviewSummary,
  planSummaryPublication,
  renderAwaitingReverificationSummary,
  renderInvalidSummary,
  renderNotApplicableSummary,
  renderReviewSummary,
  REVIEW_SUMMARY_MARKER,
} from "./summary.ts";
import type { PullRequestComment, PullRequestReviewState, SummaryPublicationInput } from "./summary.ts";

const RATIONALE = "Racional completo do revisor que nunca aparece no resumo.";
const SUPPORTED_ONLY_TEXT = "Texto exclusivo de uma justificação SUPPORTED.";

function signal(n: number, subjectId = "PRB-0002", field = "problem_statement"): ReviewSignal {
  return {
    signalId: `CLEC-SIG-${String(n).padStart(4, "0")}`,
    signal: { code: "VAGUE_QUANTITY", dimension: "supported_quantity", subjectId, field, excerpt: `Excerto integral do sinal ${n}.`, match: "muitos", severity: "advisory" },
  };
}

function disposition(n: number, value: SignalDispositionValue, reason: string): SignalDisposition {
  return { signalId: signal(n).signalId, disposition: value, reason, evidenceReferences: value === "SUPPORTED" ? ["EVD-0001"] : [], relatedFindingIds: [] };
}

function review(dispositions: SignalDisposition[], overrides: Partial<IndependentReviewResult> = {}): IndependentReviewResult {
  return { schemaVersion: "2", outcome: "CONCUR", rationale: RATIONALE, findings: [], signalDispositions: dispositions, ...overrides };
}

/** All four disposition values, out of fixed order, with detail-worthy reasons on two. */
const SIGNALS = [signal(1), signal(2, "EVD-0004", "observation.summary"), signal(3), signal(4), signal(5)];
const MIXED = review([
  disposition(1, "INSUFFICIENT_EVIDENCE", "A Fonte não está disponível para confirmar a proporção."),
  disposition(2, "NOT_APPLICABLE", "Falso positivo: \"muitos\" cita o título oficial."),
  disposition(3, "SUPPORTED", SUPPORTED_ONLY_TEXT),
  disposition(4, "VIOLATION", "Quantidade não suportada."),
  disposition(5, "SUPPORTED", "Suportado pela EVD-0001."),
]);
const render = (r: IndependentReviewResult, signals: readonly ReviewSignal[] = SIGNALS): string => renderReviewSummary({ reviewedRecordCount: 2, signals, review: r });

test("the summary counts all four dispositions in fixed order and states that CONCUR is not approval", () => {
  const markdown = render(MIXED);
  assert.ok(markdown.startsWith(`${REVIEW_SUMMARY_MARKER}\n### Revisão semântica da investigação\n`));
  assert.match(markdown, /\*\*Resultado:\*\* CONCUR\n\*\*Registos revistos:\*\* 2\n/);
  assert.match(markdown, /\*\*Disposições\*\*\n- SUPPORTED: 2\n- VIOLATION: 1\n- NOT_APPLICABLE: 1\n- INSUFFICIENT_EVIDENCE: 1\n/);
  assert.match(markdown, /CONCUR não constitui aprovação/);
});

test("every NOT_APPLICABLE and INSUFFICIENT_EVIDENCE disposition shows its signal metadata and reason", () => {
  const markdown = render(MIXED);
  assert.match(markdown, /\*\*NOT_APPLICABLE\*\*\n- `CLEC-SIG-0002` · `VAGUE_QUANTITY` · `EVD-0004` · `observation\.summary` — Falso positivo: "muitos" cita o título oficial\.\n/);
  assert.match(markdown, /\*\*INSUFFICIENT_EVIDENCE\*\*\n- `CLEC-SIG-0001` · `VAGUE_QUANTITY` · `PRB-0002` · `problem_statement` — A Fonte não está disponível para confirmar a proporção\.\n/);
  assert.match(markdown, /\*\*Bloqueios\*\*\n- Nenhum\.\n/);
});

test("detailed entries follow the reviewer's disposition order", () => {
  const ordered = review([disposition(3, "NOT_APPLICABLE", "terceiro"), disposition(1, "NOT_APPLICABLE", "primeiro")]);
  const markdown = render(ordered);
  assert.ok(markdown.indexOf("CLEC-SIG-0003") < markdown.indexOf("CLEC-SIG-0001"));
});

test("empty detail sections say so explicitly", () => {
  const markdown = render(review([disposition(1, "SUPPORTED", "ok")]));
  assert.match(markdown, /\*\*NOT_APPLICABLE\*\*\n- Nenhuma\.\n\n\*\*INSUFFICIENT_EVIDENCE\*\*\n- Nenhuma\.\n\n\*\*Bloqueios\*\*\n- Nenhum\.\n/);
});

test("SUPPORTED dispositions are counted, never listed", () => {
  const many = Array.from({ length: 40 }, (_, i) => signal(i + 1));
  const few = render(review(many.slice(0, 1).map((_, i) => disposition(i + 1, "SUPPORTED", `Razão SUPPORTED ${i + 1}.`))), many);
  const lots = render(review(many.map((_, i) => disposition(i + 1, "SUPPORTED", `Razão SUPPORTED ${i + 1}.`))), many);
  assert.match(lots, /- SUPPORTED: 40\n/);
  assert.equal(lots.split("\n").length, few.split("\n").length);
  assert.doesNotMatch(lots, /Razão SUPPORTED|CLEC-SIG-/);
});

test("blocking findings render bounded metadata, reason and correction direction, by findingId", () => {
  const finding = (findingId: string, severity: "BLOCKING" | "ADVISORY") => ({
    findingId,
    recordId: "PRB-0002",
    field: "problem_statement",
    claim: "Afirmação citada integralmente.",
    dimension: "supported_quantity" as const,
    kind: "CLEC_VIOLATION" as const,
    severity,
    reason: `Razão ${findingId}.`,
    evidenceReferences: ["EVD-0001"],
    correctionDirection: `Corrigir ${findingId}.`,
    relatedSignalIds: ["CLEC-SIG-0004"],
  });
  const blocked = review([disposition(4, "VIOLATION", "Quantidade não suportada.")], {
    outcome: "DISAGREEMENT_FOUND",
    findings: [finding("CLEC-FND-0002", "BLOCKING"), finding("CLEC-FND-0003", "ADVISORY"), finding("CLEC-FND-0001", "BLOCKING")],
  });
  const markdown = render(blocked);
  assert.match(markdown, /\*\*Resultado:\*\* DISAGREEMENT_FOUND/);
  assert.match(
    markdown,
    /\*\*Bloqueios\*\*\n- `CLEC-FND-0001` · `PRB-0002` · `problem_statement` · `supported_quantity \/ CLEC_VIOLATION` — Razão CLEC-FND-0001\.\n  - Correção: Corrigir CLEC-FND-0001\.\n- `CLEC-FND-0002` /
  );
  assert.doesNotMatch(markdown, /CLEC-FND-0003|Afirmação citada/);
});

test("the summary never carries the rationale, SUPPORTED reasons, signal excerpts or the review JSON", () => {
  const markdown = render(MIXED);
  for (const leaked of [RATIONALE, SUPPORTED_ONLY_TEXT, "Excerto integral", '"signalDispositions"', JSON.stringify(MIXED)]) {
    assert.equal(markdown.includes(leaked), false, `summary leaks ${leaked}`);
  }
});

test("reviewer prose is rendered as one inert line: no HTML, no marker spoofing", () => {
  const markdown = render(review([disposition(2, "NOT_APPLICABLE", `Linha\n\n## Cabeçalho ${REVIEW_SUMMARY_MARKER} <b>x</b>`)]));
  assert.equal(markdown.split(REVIEW_SUMMARY_MARKER).length, 2);
  assert.match(markdown, /— Linha ## Cabeçalho &lt;!-- open-evora:research-semantic-review-summary --&gt; &lt;b&gt;x&lt;\/b&gt;\n/);
});

test("rendering is deterministic", () => {
  assert.equal(render(MIXED), render(structuredClone(MIXED), structuredClone(SIGNALS)));
});

test("no canonical change renders only the deterministic not-applicable state", () => {
  const unit: LaneBReviewUnit = { status: "NO_CANONICAL_CHANGE", baseGitSha: "a".repeat(40) };
  const summary = laneBReviewSummary(unit, { ok: true, status: "NOT_APPLICABLE", summary: "irrelevant" });
  assert.deepEqual(summary, { status: "NOT_APPLICABLE", markdown: renderNotApplicableSummary() });
  assert.equal(
    summary.markdown,
    `${REVIEW_SUMMARY_MARKER}\n### Revisão semântica da investigação\n\n**Resultado:** Não aplicável\n\nEste PR não altera registos canónicos PRB/EVD/SRC.\n`
  );
});

test("a failed verification renders only its stable failure code", () => {
  const unit: LaneBReviewUnit = { status: "NO_CANONICAL_CHANGE", baseGitSha: "a".repeat(40) };
  const summary = laneBReviewSummary(unit, { ok: false, failedCheck: "RECEIPT_FINGERPRINT_MISMATCH", errors: ["detalhe extenso", RATIONALE] });
  assert.equal(summary.status, "INVALID");
  assert.equal(
    summary.markdown,
    `${REVIEW_SUMMARY_MARKER}\n### Revisão semântica da investigação\n\n**Resultado:** Verificação falhou\n**Código:** \`RECEIPT_FINGERPRINT_MISMATCH\`\n\nConsulte o check \`Research semantic review (direct PR)\`.\n`
  );
  assert.equal(renderInvalidSummary("not a <code>"), renderInvalidSummary("VERIFICATION_FAILED"));
});

const STATE: PullRequestReviewState = { baseSha: "a".repeat(40), headSha: "b".repeat(40), bodySha256: "c".repeat(64) };
const CONCUR = render(review([disposition(1, "SUPPORTED", "Suportado.")]), [signal(1)]);
const bot = (id: number, body: string): PullRequestComment => ({ id, user: { login: "github-actions[bot]" }, body });
const publish = (overrides: Partial<SummaryPublicationInput>) =>
  planSummaryPublication({ expected: STATE, current: STATE, status: "VERIFIED", rendered: CONCUR, comments: [], ...overrides });

const STALE: [string, PullRequestReviewState][] = [
  ["head", { ...STATE, headSha: "d".repeat(40) }],
  ["base", { ...STATE, baseSha: "e".repeat(40) }],
  ["body", { ...STATE, bodySha256: "f".repeat(64) }],
];

for (const [changed, current] of STALE) {
  test(`a ${changed} change after rendering never creates the stale summary`, () => {
    const plan = publish({ current });
    assert.equal(plan.action, "skip");
    assert.equal(plan.message, "PR changed after summary generation; stale summary not published.");
  });

  test(`a ${changed} change after rendering replaces the owned comment with the awaiting-reverification state`, () => {
    const plan = publish({ current, comments: [bot(7, CONCUR)] });
    assert.deepEqual(plan, {
      action: "update",
      commentId: 7,
      body: renderAwaitingReverificationSummary(),
      message: "PR changed after summary generation; summary replaced with awaiting reverification.",
    });
  });
}

test("the awaiting-reverification state carries no outcome, review detail or hashes", () => {
  const markdown = renderAwaitingReverificationSummary();
  assert.equal(
    markdown,
    `${REVIEW_SUMMARY_MARKER}\n### Revisão semântica da investigação\n\n**Resultado:** A aguardar nova verificação\n\nO PR foi alterado depois de este resumo ter sido calculado.\nA nova execução do CI atualizará este estado.\n`,
  );
  assert.doesNotMatch(markdown, /CONCUR|OBJECT|[0-9a-f]{40}/);
  assert.equal(publish({ current: STALE[0][1], comments: [bot(7, markdown)] }).action, "skip");
});

test("an unchanged state publishes VERIFIED, NOT_APPLICABLE and INVALID summaries exactly as rendered", () => {
  assert.deepEqual(publish({}), { action: "create", body: CONCUR, message: "created VERIFIED summary" });
  assert.deepEqual(publish({ comments: [bot(7, renderAwaitingReverificationSummary())] }), { action: "update", commentId: 7, body: CONCUR, message: "updated VERIFIED summary" });
  assert.deepEqual(publish({ comments: [bot(7, CONCUR)] }), { action: "skip", message: "summary unchanged" });
  const notApplicable = renderNotApplicableSummary();
  assert.equal(publish({ status: "NOT_APPLICABLE", rendered: notApplicable }).action, "skip");
  assert.deepEqual(publish({ status: "NOT_APPLICABLE", rendered: notApplicable, comments: [bot(7, CONCUR)] }), {
    action: "update",
    commentId: 7,
    body: notApplicable,
    message: "updated NOT_APPLICABLE summary",
  });
  const invalid = renderInvalidSummary("REVIEW_STALE");
  assert.deepEqual(publish({ status: "INVALID", rendered: invalid }), { action: "create", body: invalid, message: "created INVALID summary" });
});

test("human comments are never owned, even when they quote the marker", () => {
  const human: PullRequestComment[] = [
    { id: 1, user: { login: "reviewer" }, body: CONCUR },
    bot(2, `Citação:\n${REVIEW_SUMMARY_MARKER}`),
    { id: 3, user: null, body: CONCUR },
  ];
  assert.equal(human.some(isOwnedSummaryComment), false);
  assert.deepEqual(publish({ comments: human }), { action: "create", body: CONCUR, message: "created VERIFIED summary" });
  assert.equal(publish({ current: STALE[2][1], comments: human }).action, "skip");
});

test("duplicate owned comments fail closed whether or not the state is fresh", () => {
  for (const current of [STATE, STALE[0][1]]) {
    assert.deepEqual(publish({ current, comments: [bot(7, CONCUR), bot(9, CONCUR)] }), {
      action: "fail",
      message: "found 2 owned summary comments (7, 9); remove the duplicates manually",
    });
  }
});

test("a rendered summary without the owned marker is never published", () => {
  assert.equal(publish({ rendered: "### sem marcador\n" }).action, "fail");
});
