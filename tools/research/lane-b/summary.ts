/**
 * The Lane B pull-request review summary: a short, deterministic PT-PT
 * Markdown representation of an already verified independent review, for
 * human visibility in the pull request (docs/investigationstrategy.md §12).
 *
 * It is derived representation only: never research state, never an
 * approval, never a second review. Rendering is pure — no network, no
 * reviewer, no file access — over a review that verifyLaneBPullRequest()
 * has already verified and the reviewer input it was verified against.
 *
 * Bounded by design: disposition counts for all four values; every
 * NOT_APPLICABLE and INSUFFICIENT_EVIDENCE disposition with its reason; every
 * blocking finding with its reason and correction direction. SUPPORTED
 * reasons, the review rationale, signal excerpts, claims and the review JSON
 * are never rendered.
 *
 * Ordering: dispositions in the fixed SIGNAL_DISPOSITION_ORDER; detailed
 * disposition entries in the reviewer's `signalDispositions` order; blocking
 * findings by `findingId` (UTF-16 code-unit order).
 */
import type { ReviewSignal } from "../review/reviewer-input.ts";
import type { IndependentReviewResult, SignalDisposition, SignalDispositionValue } from "../review/types.ts";
import type { LaneBVerification } from "./receipt.ts";
import type { LaneBReviewUnit } from "./review-unit.ts";

/** Hidden marker identifying the one pull-request comment CI owns; always the comment's first line. */
export const REVIEW_SUMMARY_MARKER = "<!-- open-evora:research-semantic-review-summary -->";

export const SIGNAL_DISPOSITION_ORDER: readonly SignalDispositionValue[] = ["SUPPORTED", "VIOLATION", "NOT_APPLICABLE", "INSUFFICIENT_EVIDENCE"];

const HEADING = "### Revisão semântica da investigação";
const FOOTER = "_Resumo determinístico gerado pelo CI. CONCUR não constitui aprovação._";
const CHECK_NAME = "Research semantic review (direct PR)";

/** Reviewer prose as one inert Markdown line: whitespace collapsed, HTML neutralised. */
function inline(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const code = (value: string): string => `\`${value.replace(/`/g, "'")}\``;

function dispositionLine(disposition: SignalDisposition, signals: ReadonlyMap<string, ReviewSignal>): string {
  const signal = signals.get(disposition.signalId)?.signal;
  const metadata = signal ? [disposition.signalId, signal.code, signal.subjectId, signal.field] : [disposition.signalId];
  return `- ${metadata.map(code).join(" · ")} — ${inline(disposition.reason)}`;
}

function section(title: string, lines: string[], none: string): string[] {
  return ["", `**${title}**`, ...(lines.length > 0 ? lines : [`- ${none}`])];
}

export interface ReviewSummaryInput {
  /** Number of canonical record files the review unit covers. */
  reviewedRecordCount: number;
  /** The signals of the reviewer input the review was verified against. */
  signals: readonly ReviewSignal[];
  /** A review already accepted by validateIndependentReview() for those signals. */
  review: IndependentReviewResult;
}

/** The verified-review summary. Byte-identical for identical input. */
export function renderReviewSummary({ reviewedRecordCount, signals, review }: ReviewSummaryInput): string {
  const bySignalId = new Map(signals.map((entry) => [entry.signalId, entry]));
  const counts = SIGNAL_DISPOSITION_ORDER.map((value) => `- ${value}: ${review.signalDispositions.filter((entry) => entry.disposition === value).length}`);
  const detailed = (value: SignalDispositionValue): string[] =>
    review.signalDispositions.filter((entry) => entry.disposition === value).map((entry) => dispositionLine(entry, bySignalId));
  const blocking = review.findings
    .filter((finding) => finding.severity === "BLOCKING")
    .sort((a, b) => (a.findingId < b.findingId ? -1 : a.findingId > b.findingId ? 1 : 0))
    .flatMap((finding) => [
      `- ${[finding.findingId, finding.recordId, finding.field, `${finding.dimension} / ${finding.kind}`].map(code).join(" · ")} — ${inline(finding.reason)}`,
      `  - Correção: ${inline(finding.correctionDirection)}`,
    ]);
  return [
    REVIEW_SUMMARY_MARKER,
    HEADING,
    "",
    `**Resultado:** ${review.outcome}`,
    `**Registos revistos:** ${reviewedRecordCount}`,
    ...section("Disposições", counts, ""),
    ...section("NOT_APPLICABLE", detailed("NOT_APPLICABLE"), "Nenhuma."),
    ...section("INSUFFICIENT_EVIDENCE", detailed("INSUFFICIENT_EVIDENCE"), "Nenhuma."),
    ...section("Bloqueios", blocking, "Nenhum."),
    "",
    FOOTER,
    "",
  ].join("\n");
}

/** The state shown when the pull request changes no canonical record. */
export function renderNotApplicableSummary(): string {
  return [REVIEW_SUMMARY_MARKER, HEADING, "", "**Resultado:** Não aplicável", "", "Este PR não altera registos canónicos PRB/EVD/SRC.", ""].join("\n");
}

/** Only the stable failure code is shown, never verification detail or review content. */
export function renderInvalidSummary(failedCheck: string): string {
  const stable = /^[A-Z][A-Z0-9_]*$/.test(failedCheck) ? failedCheck : "VERIFICATION_FAILED";
  return [
    REVIEW_SUMMARY_MARKER,
    HEADING,
    "",
    "**Resultado:** Verificação falhou",
    `**Código:** ${code(stable)}`,
    "",
    `Consulte o check ${code(CHECK_NAME)}.`,
    "",
  ].join("\n");
}

export type ReviewSummaryStatus = "VERIFIED" | "NOT_APPLICABLE" | "INVALID";

export interface ReviewSummary {
  status: ReviewSummaryStatus;
  markdown: string;
}

/** The summary for one verification of `unit`: VERIFIED, NOT_APPLICABLE or INVALID. */
export function laneBReviewSummary(unit: LaneBReviewUnit, verification: LaneBVerification): ReviewSummary {
  if (!verification.ok) return { status: "INVALID", markdown: renderInvalidSummary(verification.failedCheck) };
  if (verification.status === "NOT_APPLICABLE") return { status: "NOT_APPLICABLE", markdown: renderNotApplicableSummary() };
  if (unit.status !== "REVIEW_REQUIRED") return { status: "INVALID", markdown: renderInvalidSummary("VERIFICATION_FAILED") };
  return {
    status: "VERIFIED",
    markdown: renderReviewSummary({ reviewedRecordCount: unit.changedRecords.length, signals: unit.reviewerInput.signals, review: verification.independentReview }),
  };
}

/**
 * The pull-request state a summary was rendered for. The body is bound by
 * `sha256(pr.body ?? "")` (hex) over the exact string GitHub returns, with no
 * other normalisation, both at capture and at publication time.
 */
export interface PullRequestReviewState {
  baseSha: string;
  headSha: string;
  bodySha256: string;
}

/** Shown in place of an owned summary once the pull request changed after it was rendered. */
export function renderAwaitingReverificationSummary(): string {
  return [
    REVIEW_SUMMARY_MARKER,
    HEADING,
    "",
    "**Resultado:** A aguardar nova verificação",
    "",
    "O PR foi alterado depois de este resumo ter sido calculado.",
    "A nova execução do CI atualizará este estado.",
    "",
  ].join("\n");
}

export interface PullRequestComment {
  id: number;
  user?: { login?: string } | null;
  body?: string | null;
}

/** Owned = written by the workflow token and starting with the marker; human comments never match. */
export function isOwnedSummaryComment(comment: PullRequestComment): boolean {
  return comment.user?.login === "github-actions[bot]" && (comment.body ?? "").split(/\r?\n/)[0] === REVIEW_SUMMARY_MARKER;
}

export type SummaryPublication =
  | { action: "fail"; message: string }
  | { action: "skip"; message: string }
  | { action: "create" | "update"; commentId?: number; body: string; message: string };

export interface SummaryPublicationInput {
  /** The state the rendered summary was computed for. */
  expected: PullRequestReviewState;
  /** The state re-read from the GitHub API immediately before publication. */
  current: PullRequestReviewState;
  status: ReviewSummaryStatus;
  rendered: string;
  comments: readonly PullRequestComment[];
}

/**
 * The publication-time guard: a stale summary is worse than none. If the pull
 * request's base, head or body changed after rendering, the rendered summary is
 * never published; an existing owned comment is replaced by the neutral
 * awaiting-reverification state so no earlier outcome stays visible as current.
 */
export function planSummaryPublication({ expected, current, status, rendered, comments }: SummaryPublicationInput): SummaryPublication {
  if (rendered.split("\n")[0] !== REVIEW_SUMMARY_MARKER) return { action: "fail", message: "rendered summary does not start with the owned marker" };
  const owned = comments.filter(isOwnedSummaryComment);
  if (owned.length > 1) {
    return { action: "fail", message: `found ${owned.length} owned summary comments (${owned.map((c) => c.id).join(", ")}); remove the duplicates manually` };
  }
  const [existing] = owned;
  const fresh = expected.baseSha === current.baseSha && expected.headSha === current.headSha && expected.bodySha256 === current.bodySha256;
  const target = fresh ? rendered : renderAwaitingReverificationSummary();
  if (!existing) {
    if (!fresh) return { action: "skip", message: "PR changed after summary generation; stale summary not published." };
    // Not applicable and never published: nothing to correct.
    if (status === "NOT_APPLICABLE") return { action: "skip", message: "not applicable; no comment needed" };
    return { action: "create", body: target, message: `created ${status} summary` };
  }
  if (existing.body === target) return { action: "skip", message: fresh ? "summary unchanged" : "PR changed after summary generation; awaiting reverification already shown." };
  return {
    action: "update",
    commentId: existing.id,
    body: target,
    message: fresh ? `updated ${status} summary` : "PR changed after summary generation; summary replaced with awaiting reverification.",
  };
}
