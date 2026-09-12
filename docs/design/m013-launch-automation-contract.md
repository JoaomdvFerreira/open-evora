# M013 — Launch & Research Automation Reconciliation & Contract

Status: **CONSOLIDATED — M013 / WU044 CONTRACT, OD-A THROUGH OD-E OWNER_APPROVED, INDEPENDENT CLAUDE CODE ARCHITECTURE/GOVERNANCE REVIEW COMPLETE (PASS_WITH_NONBLOCKING_FINDINGS), REMEDIATION INCORPORATED (§0a), PENDING OWNER AUTHORIZATION OF WU045.**
This document remains the sole WU044 deliverable. It makes no runtime,
schema, or canonical-research change. **Third correction / consolidation
pass:** the repository owner has reviewed and explicitly
approved OD-A through OD-E (each below is now marked `OWNER_APPROVED` with
its selected option, rationale, binding consequence, and rejected
alternatives); WU045 and WU046 are frozen to implementation-grade boundaries
using those approved decisions; WU047's scope and WU048's verification
matrix are finalized against the corrected launch findings; the Go-Live
Acceptance Contract is consolidated for internal consistency; and the
intended Astra-specific post-WU044 review is replaced, by explicit owner
process override, with an independent Claude Code architecture/governance
review (§18a). No implementation occurred in that pass.

**Fourth pass — independent-review remediation (this revision, WU044/PKT-045
persist; §0a is new):** the independent Claude Code architecture/governance
review required by §18a has now run and returned
`M013_WU044_INDEPENDENT_REVIEW_PASS_WITH_NONBLOCKING_FINDINGS` (0 BLOCKER,
2 HIGH, 4 MEDIUM, 3 LOW, 4 OBSERVATION). The overseer has resolved every
finding (§0a) and this pass incorporates the resulting contract amendments:
an exact WU048 adversarial case for OD-D's canonical-APPROVE/publication-HOLD
hold path (§14 case 18); an exact, binding RCS approval/content-hash
protocol replacing the prior "e.g., compute/store a hash" language (§12);
strengthened OD-B independent-review context-isolation requirements (§9);
a new WU048 adversarial case for malformed structured AI/independent-review
output (§14 case 19); two new WU048 adversarial cases for WU045 pre-Gate
idempotent rerun and WU046 partial post-approval retry/resume (§14 cases
20–21); a new WU048 adversarial case for high-risk/reputationally-sensitive
factual claims (§14 case 22); a corrected exact `ReasonCode` count of 31
(§4, replacing prior approximate wording); an operationally-defined
terminal-outcome mapping for `NOT_READY` / `READY_WITH_ACCEPTED_RISK` /
`READY_FOR_GO_LIVE_GATE` (§15a); explicit OD-D invalid decision-state
combination rules (§9); a deterministic Git-publication guard requirement
at the WU046 boundary, superseding reliance on a pre-commit hook as a
primary control (§12); and a deferred-observation record for `aiqt`
installation-path documentation (§7a). **This pass makes no runtime,
schema, or canonical-research change; it amends the WU044 contract only.
It does not itself authorize WU045 — see §0a and §19.**

**Amendment history (overseer correction passes, same WU044/PKT-045):**

- **First correction pass:** corrected two arithmetic errors in the
  original draft's pipeline classification (§4) and human-touch baseline
  (§5) so that stage/touch counts were internally consistent, withdrew a
  false "no branch protection" finding based on owner-supplied and
  independently re-verified GitHub Rulesets evidence (§8), recorded newly
  VERIFIED_EXTERNAL Vercel/production facts in place of prior
  `UNVERIFIED_EXTERNAL` guesses (§8, §10), strengthened the pre-Gate
  publication-boundary rule (§8), refined but did not resolve OD-D (§9),
  and recomputed the P0–P3 launch-readiness counts (§10) accordingly.
- **Second correction pass (this revision):** resolved a residual
  contradiction in §5's human-touch baseline — two touches labeled
  SEMANTICALLY_REQUIRED were in fact AI-agent-performed work, not human
  touches, and are corrected out of the human-touch tally (criterion D),
  reducing the corrected current pre-Gate human-touch baseline from 6 to
  **2** (both already-named tooling gaps, §7 gaps 1 and 4) while leaving
  the **normal-path target of 0** unchanged; reclassified the absence of a
  custom domain from P3 to P2 (§10, §13, §15) as a public-identity/trust
  concern the owner may explicitly accept for a soft launch, recomputing
  P2 (6→7) and P3 (3→2) accordingly with no other severity changed; and
  aligned the draft Go-Live Acceptance Contract (§15) to state the
  normal-path/exception-path distinction, the corrected human-touch
  metrics, and the Human Gate/owner-PR-merge mandatory-manual boundary
  explicitly.
- **Third pass — owner-decision consolidation (this revision, WU044/PKT-045
  persist-owner-decisions action):** the repository owner reviewed and
  explicitly approved OD-A (Option 1), OD-B (Option 2, with the five-point
  independent-review minimum bar), OD-C (Option 3, JSON source of truth +
  generated Markdown view), OD-D (Option 2, combined-by-default with the
  two decisions separately auditable and the private-hold sequencing for
  the canonical-APPROVE/publication-HOLD exception), and OD-E (Option 1,
  automate through `READY_FOR_OWNER_MERGE`, PR merge stays manual) — each
  is updated in §9 from `OWNER_DECISION_REQUIRED` to `OWNER_APPROVED`. Using
  those approved decisions, WU045 (§11) and WU046 (§12) are frozen to
  implementation-grade boundaries; WU047 (§13) and WU048 (§14) are finalized
  against the corrected launch findings; the Go-Live Acceptance Contract
  (§15) is consolidated for internal consistency with the approved
  decisions; and the intended Astra-specific post-WU044 review is replaced,
  by explicit owner process override recorded in §18a, with an independent
  Claude Code architecture/governance review. This pass performed no
  implementation, no commit, no push, no PR, and no `aiqt checkpoint` —
  WU044 remains `in_progress` pending that independent review and
  subsequent owner authorization of WU045.
- **Fourth pass — independent-review remediation (this revision, WU044/
  PKT-045, contract-only action):** the independent Claude Code
  architecture/governance review required by §18a ran and returned
  `PASS_WITH_NONBLOCKING_FINDINGS` (0 BLOCKER / 2 HIGH / 4 MEDIUM / 3 LOW /
  4 OBSERVATION). This pass records the review disposition (§0a) and
  incorporates every ACCEPT/ACCEPT_WITH_MODIFIED_REMEDY finding as a
  binding contract amendment: HIGH-1 (OD-D hold-path adversarial
  verification, §14 case 18), HIGH-2 (exact RCS approval/content-hash
  binding protocol, §12, resolving the former §18 open question),
  MEDIUM-1 (strengthened OD-B review context-isolation requirements, §9),
  MEDIUM-2 (malformed structured-output adversarial case, §14 case 19),
  MEDIUM-3 (WU045 idempotent-rerun and WU046 partial-retry adversarial
  cases, §14 cases 20–21), MEDIUM-4 (high-risk-claim adversarial case, §14
  case 22), the exact `ReasonCode` count correction (31, §4), the
  terminal-outcome mapping definition (§15a), OD-D's invalid decision-state
  rules (§9), and the WU046 deterministic publication guard (§12,
  resolving the former §18 workbench-defense question). LOW-2 (aiqt
  installation-path documentation) is recorded as a deferred tooling
  observation (§7a), not remediated in this pass. This pass performed no
  implementation, no commit, no push, no PR, and no `aiqt checkpoint` —
  WU044 remains `in_progress` pending owner authorization of WU045.

No OD-A through OD-E item was resolved by the first two amendment passes;
they are resolved (as `OWNER_APPROVED`) only by the third pass. No
implementation occurred in any pass; no canonical/schema/runtime file was
touched; no milestone target was redefined — only evidence, labeling,
severity classification, (in the third pass) the explicit recording of
owner decisions already made, and (in this fourth pass) the incorporation
of independent-review findings into the contract text itself.

Scope: reconciles the actual implemented state of the Open Évora research
pipeline — from research trigger through canonical promotion to CI, Git/PR,
and production/public deployment — against `docs/investigationstrategy.md`,
`docs/datamodel.md`, `docs/explorerarchitecture.md`, and `AGENTS.md`. It
defines the exact proposed implementation boundaries for WU045
(preparation), WU046 (Human Gate & post-approval orchestration), WU047
(production launch hardening), and the exact proposed verification matrix
for WU048 (end-to-end dry run & independent go-live verification). It also
proposes a draft Go-Live Acceptance Contract.

Authority: this document sits under [docs/design/](README.md). It does not
redefine [investigation strategy](../investigationstrategy.md),
[data model](../datamodel.md), [Explorer architecture](../explorerarchitecture.md),
`AGENTS.md`, or the closed [AR-05 discovery/provenance contract](ar-05-discovery-provenance-contract.md)
— those remain the semantic, methodological, and governance canon. This
document owns only the M013/WU044 reconciliation findings and the proposed
WU045–WU048 boundaries. It follows the same reconciliation methodology as
AR-05 (WU041): evidence first, from actual code/config, not from what
documentation says should exist.

---

## 0a. Independent-review disposition (fourth pass — WU044 contract remediation)

**Review verdict:** `PASS_WITH_NONBLOCKING_FINDINGS`.

**Reviewer findings by severity:**

| Severity | Count |
|---|---|
| BLOCKER | 0 |
| HIGH | 2 |
| MEDIUM | 4 |
| LOW | 3 |
| OBSERVATION | 4 |

**Overseer disposition, one row per finding:**

| Finding | Disposition | Where incorporated |
|---|---|---|
| HIGH-1 (OD-D hold-verification coverage) | `ACCEPT` | §14 case 18 (new) |
| HIGH-2 (exact approval/hash binding) | `ACCEPT_WITH_MODIFIED_REMEDY` | §12 (RCS approval-binding protocol); resolves the former §18 approval-transcription question, now `RESOLVED_BY_REVIEW` |
| MEDIUM-1 (review context isolation) | `ACCEPT` | §9 OD-B (strengthened independence requirements) |
| MEDIUM-2 (malformed AI output) | `ACCEPT` | §14 case 19 (new) |
| MEDIUM-3 (retry/idempotency) | `ACCEPT` | §14 cases 20–21 (new) |
| MEDIUM-4 (high-risk claim handling) | `ACCEPT` | §14 case 22 (new) |
| LOW-1 (`ReasonCode` count) | `ACCEPT` | §4 (31, corrected) |
| LOW-2 (aiqt installation documentation) | `DEFER` | §7a (deferred observation record) |
| LOW-3 (workbench defense-in-depth: publication guard) | `ACCEPT` | §12 (WU046 deterministic publication guard); resolves the former §18 workbench-defense question, now `RESOLVED_BY_REVIEW` |
| Workbench defense-in-depth recommendation | `ACCEPT_GOAL / MODIFY_IMPLEMENTATION` | §12 — the reviewer's underlying defense-in-depth goal is accepted; the specific implementation is a deterministic pre-publication guard at the WU046 Git-publication boundary, not a local Git pre-commit hook as primary control |

No HIGH or MEDIUM finding above is treated as closed by this section alone
— each is closed only where the corresponding contract amendment
(referenced in the right-hand column) is actually incorporated in the body
of this document. The four OBSERVATION-level findings are not individually
enumerated here; none required a binding contract amendment and none
altered any owner-approved decision (OD-A through OD-E remain exactly as
recorded in §9).

This section records disposition only. It does not itself constitute
WU045 authorization, WU044 completion, or an `aiqt checkpoint` — see §19.

---

## 1. Purpose / authority / scope

**Purpose:** determine, with evidence from actual repository code, configuration,
and gitignored working-tree artifacts, exactly which parts of the research
pipeline (trigger → discovery → candidate authoring → validation/readiness →
independent review → canonical integration → Human Gate → promotion →
Git/PR/CI → build/deploy) are already deterministic, which are AI-assisted,
which are manual, which are missing, and which require an owner product
decision — then propose exact, implementation-grade boundaries for WU045
through WU048.

**Authority:** subordinate to `docs/investigationstrategy.md` (research
method, Gate 1 semantics), `docs/datamodel.md` (record semantics), `AGENTS.md`
(global safeguards, publication boundary, human-owned decisions), and
`docs/explorerarchitecture.md` (Explorer system boundary). Any apparent
conflict between a finding below and one of those documents is resolved in
that document's favour; this contract records the conflict as
`OWNER_DECISION_REQUIRED` rather than silently overriding it.

**Scope:** exactly the WU044 canonical scope recorded in `.aiqt/state.json`
(reproduced in full at the end of this document's git history via the AIQT
packet, PKT-045). This document performs no implementation.

**Out of scope (binding on WU044):** any implementation of automation,
tooling, or orchestration; any runtime/product code change; any canonical
SRC/EVD/PRB data change; any research schema or semantics change; any new
canonical record type; any deployment action; any social integration;
starting D7; starting Decision Horizon; repair of C008/C009/C010; modifying
`.vscode/`; merging any PR; running `aiqt next` again or starting WU044
implementation work (none of the above occurred during this investigation).

---

## 2. Baseline SHA and investigation method

- **Baseline:** `main` = `f5ffeb6da7400c742934c7e286f80d18f6e1aa29`, confirmed
  identical to `origin/main` at investigation start. Work performed on
  `work/m013-wu044-launch-research-contract`, branched from that exact commit.
- **Method:** direct inspection of repository source (`tools/research/**`,
  `apps/research-explorer/scripts/**`, `.github/workflows/**`, `vercel.json`,
  `package.json`, `.gitignore`), direct inspection of gitignored working-tree
  research-cycle artifacts under `.research-workbench/` (four real historical
  cycles: `WU027`, `WU029-AR01-gate1`, `cimac-geocimac-direct-response`,
  `deis-caregivers-direct-response`), direct reading of `.aiqt/state.json`
  and `.aiqt/runlog.jsonl`, and a read-only GitHub API check of branch
  protection on `main`. No capability is assumed to exist because a design
  document mentions it; every classification below cites the concrete
  file(s) it is drawn from. Where external production configuration cannot
  be verified with available read-only tooling, it is marked
  `UNVERIFIED_EXTERNAL` with the exact evidence the owner would need to
  supply (§8).
- **Corpus baseline confirmed unchanged:** 12 PRB + 143 EVD + 119 SRC = 274
  canonical records, matching AR-05's WU041 baseline exactly. No `research/**`
  file was read for content mutation, only for structural inspection.

---

## 3. Current architecture map

```
RESEARCH_TRIGGER (manual: human runs an AI agent against one of two
                  prompt templates in .research-workbench/prompts/)
   -> DISCOVERY/RETRIEVAL (AI-agent web research; no tooling)
   -> CANDIDATE AUTHORING (AI-agent-authored complete-replacement YAML,
                            staged as loose files under a bespoke
                            .research-workbench/<cycle>/candidates/ folder)
   -> DETERMINISTIC CHAIN (tools/research/integration/, fully implemented
                            as a tested library, invoked by a hand-written,
                            per-cycle, non-reusable script):
        candidate-delta.ts        (CREATE/UPDATE/NO_CHANGE classification)
        -> prospective-validation.ts   (overlay + full corpus validation
                                         + UPDATE-immutability check)
        -> canonical-integration-review.ts  (CanonicalIntegrationReview:
                                              baseGitSha + candidates +
                                              deltas + validation + readiness)
        -> canonical-integration-plan.ts    (CanonicalIntegrationPlan: exact
                                              byte-literal write operations)
   -> HUMAN GATE 1 (manual: prose decision package, e.g. GATE1-PACKAGE.md,
                     read and approved by the repository owner; approval is
                     transcribed by hand into the next script)
   -> canonical-promoter.ts (fully implemented, defensively engineered:
                              exact-HEAD-match, clean-tree, staged dry-run,
                              atomic writes, rollback, byte-exact
                              post-write verification) — invoked by a
                              hand-written, per-cycle, non-reusable script
                              that hardcodes the approved plan as literal
                              assertions
   -> npm run research:validate (independent manual re-confirmation)
   -> git branch/commit/push/PR (manual human action; no tooling)
   -> CI (.github/workflows/validation.yml: validate + build only,
          on pull_request and push:main; no write-back, no deploy,
          no auto-merge)
   -> HUMAN PR MERGE (manual, mandatory, GitHub UI; main is protected by
                       an active Repository Ruleset requiring PR + 1
                       approval + the "validation" status check — §8,
                       corrected; NO_CHANGE)
   -> Vercel build (buildCommand: npm run explorer:build, which re-runs
                     full canonical validation from scratch before
                     producing any output) -> production Explorer
                     (confirmed VERIFIED_EXTERNAL: main merge -> target =
                     production, auto-deploy on merge — §8, corrected)
```

**AIQT (`.aiqt/`) is architecturally separate** from this pipeline: it is a
project-management/agent-orchestration bookkeeping layer with no code path
that reads or writes `research/`, and its own `project.json` explicitly
disclaims "automatic research-state transition from deterministic
validation." Its only observed *operational* interaction is friction, not
integration: an AIQT bookkeeping commit advanced `HEAD` mid-cycle during
WU029/AR01, which broke the promoter's exact-HEAD-match precondition and
forced a full review revision even though canonical `research/` content had
not changed (documented in `GATE1-PACKAGE.md`'s "R4 base-refresh note"). This
is a real orchestration seam WU045/WU046 should account for (§6).

---

## 4. Full pipeline-stage inventory / classification

**Correction note (overseer pass):** the prior revision of this table
assigned some stages more than one classification (e.g. "MISSING (as
tooling) / MANUAL_REQUIRED", or listing stages 9–12 individually under
MISSING while also counting them as one group under MANUAL_REQUIRED),
which made the published summary counts sum to 33 against a 30-stage
inventory. This revision assigns **exactly one primary classification per
stage**; every secondary characteristic previously expressed as a second
classification now appears only in the **Secondary characteristics** column
as a note, never as an additional tally. The canonical required-stage set
itself (the 30 stages named in WU044's own scope text) is unchanged — only
the counting method is corrected.

Legend: **AUTOMATED** / **PARTIALLY_AUTOMATED** / **MANUAL_REQUIRED** /
**MISSING** / **OWNER_DECISION_REQUIRED** (primary, exactly one per stage).

| # | Stage | Primary classification | Secondary characteristics (notes only, not counted) | Mechanism | Concrete files/commands | Gap | Launch-blocking? | Recommended destination |
|---|---|---|---|---|---|---|---|---|
| 1 | Research trigger | **MANUAL_REQUIRED** | — | Human runs an AI agent against `daily-discovery.md` or `problem-refresh.md` | `.research-workbench/prompts/*.md`; no npm script, no CI trigger | No mechanical trigger exists | No (owner-triggered start is acceptable at launch scale — OD-A) | WU045 (orchestrate around existing manual trigger; do not build a scheduler) |
| 2 | Question definition | **MANUAL_REQUIRED** | — | Prompt template framing + AI agent judgement | same prompts | None beyond #1 | No | WU045 (structure as explicit input, not new capability) |
| 3 | Source discovery | **MISSING** | as tooling only; AI agent's own general capability substitutes for it today | AI agent's own general web-browsing/search capability; no code in repo | none found under `tools/research/**` | No automated discovery/search/fetch tooling | No (proportionate at current scale; AGENTS.md does not require automation) | DEFER (do not build a crawler) |
| 4 | Source retrieval | **MISSING** | as tooling only, same substitution as #3 | Same as #3 | none | Same as #3 | No | DEFER |
| 5 | Source snapshot/provenance capture | **PARTIALLY_AUTOMATED** | capture act itself remains manual/AI-authored; only shape is checked | Fields are schema-declared and structurally validated | `research/schemas/evidence.schema.json` (`provenance.sources` is both `stringListFields` and `nonEmptyListFields`; `provenance.extracted_at` is `calendarDateFields`); `tools/research/validation/validate.ts` | None launch-blocking; ODM-007/008 gaps noted in `GATE1-PACKAGE.md` §8 are confirmed **already resolved** in the current schema (§7) | No | NO_CHANGE |
| 6 | Existing-source lookup (avoid duplicate SRC) | **MISSING** | as a fuzzy/same-underlying-source check specifically; exact-ID dedupe exists separately (#7) | Prompts instruct the AI agent to "inspect the existing corpus before creating records"; no deterministic fuzzy-duplicate check | prompts only; `candidate-delta.ts` only detects *exact-ID* duplicates | Real gap: no mechanism catches two different SRC IDs for the same underlying source | No (proportionate; `investigationstrategy.md` §4 already requires this as human/AI judgement) | WU045 (structured retrieval-context step: surface existing SRC list deterministically; do not attempt automatic fuzzy-dedupe) |
| 7 | Deduplication (candidate vs. canonical, by ID) | **AUTOMATED** | — | `classifyCandidateDelta()` | `tools/research/integration/candidate-delta.ts` + `.test.ts`; pure structural deep-equality | None | No | NO_CHANGE — reuse as-is |
| 8 | Source change detection / currentness | **MANUAL_REQUIRED** | — | `investigationstrategy.md` §5 "Currentness" is a substantive judgement; no deterministic staleness detector exists | none | Intentional per `docs/investigationstrategy.md` — a human/AI judgement, not mechanical | No | NO_CHANGE (do not mechanize a semantic judgement) |
| 9 | Research extraction (Evidence authoring) | **MANUAL_REQUIRED** | no generator tooling exists (would also be MISSING-as-tooling if scored separately) | AI-agent hand-authors complete YAML per prompt instructions | `.research-workbench/prompts/*.md`; historical candidates under `.research-workbench/*/candidates/` | No structured "extraction contract" (OD-B) constrains the AI agent's raw output shape | No (current practice works) but **OD-B is required** for WU045 to be execution-deterministic | WU045 (OD-B resolves the AI-output contract) |
| 10 | Candidate SRC generation | **MANUAL_REQUIRED** | same note as #9 | Same as #9 | Same as #9 | Same as #9 | No | WU045 |
| 11 | Candidate EVD generation | **MANUAL_REQUIRED** | same note as #9 | Same as #9 | Same as #9 | Same as #9 | No | WU045 |
| 12 | Candidate PRB creation/update | **MANUAL_REQUIRED** | same note as #9 | Same as #9 | Same as #9 | Same as #9 | No | WU045 |
| 13 | Cross-record linking | **MANUAL_REQUIRED** | resolution of an authored link is validated deterministically once authored (`validateReferences()`) | `provenance.sources[]`/`evidence[]` reference resolution is validated deterministically; *which* relationship to author is AI/human judgement | `validateReferences()` in `validate.ts` | None | No | NO_CHANGE for validation; WU045 orchestrates the authoring step |
| 14 | Inference-limit preservation | **PARTIALLY_AUTOMATED** | structural presence/shape only; substantive adequacy of the limit's content is AI/human judgement | `inference_limits[]` is schema-required and `stringListFields`-checked | `evidence.schema.json`, `validate.ts` | None | No | NO_CHANGE |
| 15 | Contradiction search | **PARTIALLY_AUTOMATED** | structural presence only; substantive adequacy remains human/AI judgement by design | `evaluateEligibility()`/`evaluateCorroboration()` require an explicit `contradiction_search.performed` boolean + summary | `tools/research/readiness/readiness.ts` | None (intentional design boundary) | No | NO_CHANGE |
| 16 | Duplicate/Problem-overlap analysis | **PARTIALLY_AUTOMATED** | structural presence only; substantive overlap judgement is human/AI | `overlap_check` field is structurally required by `evaluateEligibility()` | `readiness.ts` | None (intentional) | No | NO_CHANGE |
| 17 | Prospective validation (candidate-set overlay) | **AUTOMATED** | — | `validateCandidateSet()` overlays candidates onto an in-memory corpus clone and runs full `validateCorpusIndex()`, plus PRB `created_at` UPDATE-immutability enforcement | `tools/research/integration/prospective-validation.ts`, `update-immutability.test.ts` | None | No | NO_CHANGE — reuse as-is |
| 18 | Readiness evaluation (Eligibility/Corroboration) | **AUTOMATED** | structural only; never decides substantive truth | `evaluateEligibility()`, `evaluateCorroboration()`, 31 stable `ReasonCode`s (31 at the WU044 baseline; independently re-verified this pass, §0a LOW-1) | `tools/research/readiness/readiness.ts`, `cli.ts` (`npm run research:readiness`) | None | No | NO_CHANGE — reuse as-is |
| 19 | Independent AI review | **MISSING** | — | No second-pass/adversarial review script or distinct reviewer-agent invocation exists anywhere in `tools/research/**` | none | Real gap: no structural guarantee a second, independent pass occurred before Gate 1 | **Yes — load-bearing for OD-B and for WU048's "independent review coverage = 100%" acceptance criterion** | WU045 (OD-B must define this as a distinct, structured step) |
| 20 | Canonical delta generation | **AUTOMATED** | reuses #7 at the review-package level | Same as #7, at the review-package level | `candidate-delta.ts` (consumed by `canonical-integration-review.ts`) | None | No | NO_CHANGE |
| 21 | Canonical integration review preparation | **AUTOMATED** | — | `prepareCanonicalIntegrationReview()` produces the exact `CanonicalIntegrationReview` object | `tools/research/integration/canonical-integration-review.ts` | None (readiness is structural only, by design) | No | NO_CHANGE — reuse as-is |
| 22 | Canonical integration plan preparation | **AUTOMATED** | — | `prepareCanonicalIntegrationPlan()` produces exact byte-literal write operations, path-escape-guarded | `tools/research/integration/canonical-integration-plan.ts` | None | No | NO_CHANGE — reuse as-is |
| 23 | Publication-readiness review (pre-Gate assembly) | **MISSING** | as a single reusable artifact; ad hoc prose substitutes today | No generic, reusable "Research Change Set" assembly step exists | `.research-workbench/*/GATE1-PACKAGE.md` (bespoke per cycle) | Real gap: no reusable template/tool assembles review + deltas + validation + readiness + independent-review + risks into one package | **Resolved — OD-C (Option 3) is `OWNER_APPROVED` (§9), authorizing this as a non-canonical operational artifact** | WU046 (per OD-C, Option 3) |
| 24 | Human decision (Gate 1) | **MANUAL_REQUIRED** | approval-transcription mechanics are a separate, named tooling gap (§7 gap 5) | Owner reads the prose package and decides; approval is then hand-transcribed as literal constants into the next promoter script | `.research-workbench/WU029-AR01-gate1/GATE1-PACKAGE.md` + `promote-approved-r4.ts`'s hardcoded `APPROVED_BASE`/`APPROVED_UPDATES` | Real gap: no structured, independently-verifiable proof-of-approval artifact | No individually, but relevant to OD-D and to WU048's "automatic canonical approvals = 0" verification | WU046 (structure the decision options and its binding to an exact plan/base-SHA; the decision itself remains human) |
| 25 | Deterministic canonical promotion | **AUTOMATED** | operational invocation is currently a hand-written per-cycle script (no generic CLI); the library itself is fully deterministic and reusable as-is | `applyCanonicalIntegrationPlan()`: exact-HEAD-match, clean-tree check, staged dry-run validation, atomic writes with rollback, byte-exact post-write verification | `tools/research/integration/canonical-promoter.ts`, `.test.ts` | Real gap: no `tools/research/integration/cli.ts` — operational reuse requires hand-authoring a new script each time | No (the library itself is safe; the operational gap is orchestration, not safety) | WU046 (orchestrate around the existing library; do not rewrite `canonical-promoter.ts`) |
| 26 | Post-promotion validation | **AUTOMATED** | redundantly re-run at three independent points (promoter, manual CLI, Explorer build/CI) | Re-validated inside the promoter itself, re-run manually via `npm run research:validate` by convention, and re-run again at Explorer build time and in CI | `canonical-promoter.ts` (internal), `tools/research/validation/cli.ts`, `apps/research-explorer/scripts/build-data.js`, `.github/workflows/validation.yml` | None | No | NO_CHANGE |
| 27 | Branch/commit/push/PR preparation | **MANUAL_REQUIRED** | — | Standard human Git/GitHub actions; no tooling automates this today | none found | Real gap: WU046 scope explicitly includes automating this *after* approval | No individually; relevant to OD-E | WU046 (exactly per OD-E, up to `READY_FOR_OWNER_MERGE`; PR merge itself stays manual) |
| 28 | CI | **AUTOMATED** | — | `.github/workflows/validation.yml`: validate + build only, on `pull_request` and `push: [main]`; no deploy step, no write-back, no auto-merge, no elevated permissions | `.github/workflows/validation.yml` | None found | No | NO_CHANGE |
| 29 | Explorer build (read-model generation) | **AUTOMATED** | — | `build-data.js`: validate → build read model → atomic publish, with a post-write integrity re-check | `apps/research-explorer/scripts/build-data.js`, `read-model.js`, `atomic-write.js` | None | No | NO_CHANGE |
| 30 | Production deployment path | **PARTIALLY_AUTOMATED** | the build step is deterministic; the deploy-trigger/domain/protection topology is now VERIFIED_EXTERNAL per §8 (corrected this pass) — remaining unknowns are narrower than previously stated | `vercel.json` declares `buildCommand: npm run explorer:build`; Git→Vercel trigger mapping is now owner-confirmed (§8) | `vercel.json` | See §8/§10 (corrected): most of the prior UNVERIFIED_EXTERNAL surface is now resolved; only Deployment Protection policy and any non-exposed environment-specific access control remain unverified | No (per corrected §10) | WU047 (confirm remaining narrow unknowns; no broad audit gap remains) |

**Corrected classification summary — 30 stages, exactly one primary
classification per stage, no double-counting:**

| Classification | Stage numbers | Count |
|---|---|---|
| AUTOMATED | 7, 17, 18, 20, 21, 22, 25, 26, 28, 29 | **10** |
| PARTIALLY_AUTOMATED | 5, 14, 15, 16, 30 | **5** |
| MANUAL_REQUIRED | 1, 2, 8, 9, 10, 11, 12, 13, 24, 27 | **10** |
| MISSING | 3, 4, 6, 19, 23 | **5** |
| OWNER_DECISION_REQUIRED | (none at stage level) | **0** |
| **Total** | | **30** |

**Proof: 10 + 5 + 10 + 5 + 0 = 30**, matching the exact 30-stage inventory
named in WU044's own canonical scope text. No stage appears in more than one
row of this table; every previously-listed secondary characteristic now
lives only in the "Secondary characteristics" column of the stage table
above, never in a second count. The canonical required-stage set itself
(30 named stages) is unchanged from the prior revision — only the counting
method was corrected.

---

## 5. Current human-touch baseline

**Correction note (overseer pass, second correction):** the prior revision
reported "Human Touches Before Research Approval = 6," including two
touches (former #1 "AI agent performs discovery/retrieval" and former #3
"AI agent hand-authors complete candidate YAML files") tagged
SEMANTICALLY_REQUIRED. On inspection against the overseer's five-way test
(A initial trigger / B normal-path handoff / C exception-path-only / D AI
judgement, not a human touch / E genuine every-cycle human intervention),
**both former touches are performed by the AI agent, not by a human** — the
touch descriptions themselves say "AI agent performs..." and "AI agent
hand-authors..." This is criterion **D**: AI semantic judgement is not a
*human* touch, and a metric titled "Human Touches" must not include
AI-performed work merely because that work is semantically important. Both
are corrected out of the human-touch tally below (they remain listed, for
completeness, as AI-performed pipeline work, not as human touches). This
also resolves the apparent tension the overseer identified: the milestone
target ("normal-path human handoffs = 0") was never actually contradicted
by real human intervention — it was contradicted by a **labeling error**
that classified AI work as "semantically required *human* touches." No
milestone target is redefined by this correction; only the labeling of
who performs each existing touch is corrected.

This revision gives **every current touch exactly one primary category**
per actor (human vs. AI) and per type (SEMANTICALLY_REQUIRED /
MECHANICAL_AND_AUTOMATABLE / GOVERNANCE_REQUIRED / CURRENT_TOOLING_GAP /
AI_JUDGEMENT_NOT_A_HUMAN_TOUCH); a touch with more than one real property
records the rest as a note, never as a second tally entry. It applies the
overseer's five-way test explicitly to each touch, and the four structural
distinctions:

- **(A) Initial research trigger** — an operator supplying the initial
  question/URL/request is the *entry condition* for the pipeline, not a
  handoff inside it, and is therefore excluded from the numbered sequence
  below.
- **(B) Normal path** — the target remains zero **human** handoffs from an
  accepted trigger to `READY_FOR_HUMAN_REVIEW`.
- **(C) Exception path** — a cycle that genuinely cannot proceed
  (ambiguity, insufficient evidence, sensitive material, unresolved
  contradiction) may stop as `NEEDS_HUMAN_CLARIFICATION`/`HOLD` without
  violating the normal-path zero-handoff target; this is a distinct,
  non-normal path and its touches are not added to the normal-path count.
- **(D) Human Gate** — the final research-approval decision itself is not
  counted as a pre-Gate handoff (per the WU044 packet's own instruction);
  it is counted separately in the post-approval sequence below.

### RESEARCH_TRIGGER → APPROVAL_READY_PACKAGE (normal path; trigger excluded per (A))

1. **AI agent performs discovery/retrieval** (external web research, no
   tooling), following whichever prompt/target the trigger specified. —
   **Five-way test: (D) AI semantic judgement, not a human touch.** The
   actor is the AI agent, not a human; this is real, necessary pipeline
   work, but it is not a *human* handoff and must not be tallied as one.
   Corrected classification: **AI_JUDGEMENT_NOT_A_HUMAN_TOUCH** (excluded
   from the human-touch count; not eliminable, and not a gap — it is
   exactly the automatable/AI-performed work WU045 orchestrates around).
2. **AI agent manually inspects the existing corpus** for duplicates before
   authoring. — **Five-way test: (D)** for the surfacing action itself
   (performed by the AI agent), **plus a residual human-relevant gap**: no
   deterministic existing-source surfacing tool exists (stage 6, §4), so a
   human is not currently *required* here either — the AI agent does this
   unaided. Corrected classification: **CURRENT_TOOLING_GAP**, but recorded
   as a **tooling gap affecting AI-performed work**, not a human touch —
   *no human intervenes at this step today*. Retained in the tooling-gap
   tally (§7) because closing it is still a WU045 target, but it does not
   contribute to the *human*-touch baseline.
3. **AI agent hand-authors complete candidate YAML files** into a
   self-chosen `.research-workbench/<cycle-name>/candidates/` directory. —
   **Five-way test: (D) AI semantic judgement, not a human touch.** Same
   basis as touch 1 — the actor is the AI agent. Corrected classification:
   **AI_JUDGEMENT_NOT_A_HUMAN_TOUCH** (excluded from the human-touch
   count).
4. **Human/agent hand-writes a one-off `prepare-gate-1.ts` script** for this
   specific cycle, importing `tools/research/index.ts` and hardcoding the
   candidate file list, then runs it to produce
   `CanonicalIntegrationReview.json`/`CanonicalIntegrationPlan.json`. —
   **Five-way test: (E).** Unlike touches 1–3, this step's actual historical
   practice (§4 stage 25, §7 gap 1) has required a **human** to hand-write
   the per-cycle script — this is not AI-performed work today, and no
   tooling exists to let the AI agent (or anyone) invoke a reusable
   pipeline instead. Corrected classification: **CURRENT_TOOLING_GAP,
   confirmed as a genuine human intervention on the current normal path**
   — this is exactly the kind of item criterion (E) asks to be surfaced
   explicitly as a contract gap against the zero-handoff target, and it is
   already named as such (§7 gap 1; WU045's exact target for elimination).
5. **Human/agent hand-authors a review-package markdown document**
   (`GATE1-PACKAGE.md`) synthesizing the review/plan/validation/readiness
   output plus prose analysis, open decision points, and a recommendation.
   — **Five-way test: (E).** Same basis as touch 4 — current practice shows
   a human hand-authoring this document (§4 stage 23, §7 gap 4); no
   generation tooling exists yet. Corrected classification:
   **CURRENT_TOOLING_GAP, confirmed as a genuine human intervention on the
   current normal path** — the exact target of OD-C/WU046 (§9, §12).
6. **No distinct independent review pass occurs** — the same
   authoring/analysis process produces its own verification narrative. —
   **Five-way test: (E) by omission** — today a human is not separately
   involved here either (no review pass, human or AI, occurs at all), but
   the *absence* itself is the surfaced gap: whichever actor performs
   independent review once OD-B is resolved, this step currently has zero
   coverage of any kind. Corrected classification: **CURRENT_TOOLING_GAP**
   (see stage 19, §4; this is the most significant capability gap in the
   pre-approval path, though it is a *capability* gap, not currently a
   *human*-touch gap, since no review — human or AI — occurs today).

**CURRENT BASELINE — total current human touches before Gate = 2**, with
exactly one primary category per touch:

| Category | Touch numbers | Count |
|---|---|---|
| AI_JUDGEMENT_NOT_A_HUMAN_TOUCH (excluded from human-touch tally) | 1, 3 | **0** (excluded, listed for completeness) |
| SEMANTICALLY_REQUIRED (human) | (none) | **0** |
| MECHANICAL_AND_AUTOMATABLE (human) | (none as a standalone touch today) | **0** |
| GOVERNANCE_REQUIRED (human, pre-Gate) | (none pre-Gate) | **0** |
| CURRENT_TOOLING_GAP — genuine human intervention today | 4, 5 | **2** |
| CURRENT_TOOLING_GAP — capability gap, no human involved today | 2, 6 | **0** (tooling gap tracked in §7; not a human touch) |
| **Total human touches** | | **2** |

**Proof: 0 + 0 + 0 + 2 + 0 = 2.** The corrected current baseline is **2
genuine human touches before Gate 1** (touches 4 and 5: hand-writing the
per-cycle orchestration script, and hand-authoring the review-package
document) — both are already-named CURRENT_TOOLING_GAP items (§7 gaps 1
and 4) and both are WU045/WU046's explicit elimination targets. Touches 1
and 3 are AI-performed work, correctly excluded from a *human*-touch count
under criterion (D) — they remain real, necessary, non-eliminable pipeline
work, but counting them as "semantically required human touches" was the
labeling error this correction fixes. Touches 2 and 6 are capability gaps
with **no human involved today at all** (touch 2: the AI agent searches
unaided; touch 6: no review of any kind occurs) — they are tracked as
tooling/capability gaps in §7 but contribute zero to the human-touch count
because no human currently performs them either.

**TARGET NORMAL PATH AFTER M013: human touches after an accepted trigger
and before the Human Gate = 0.** This target is unchanged by this
correction (per the instruction not to redefine the milestone target).
What changes is the evidence behind it: the corrected current baseline is
**2**, not 6 or 8 — both attributable to the same two already-identified
tooling gaps (§7 gaps 1 and 4) that WU045/WU046 are already scoped to
close. Closing those two gaps mechanically (a reusable orchestration CLI
in place of touch 4's hand-written script; generated review-package
assembly per OD-C in place of touch 5's hand-authored document) reduces
the normal-path human-touch count from 2 to the target of 0, with no
further human intervention gap remaining once WU045/WU046 land. Touches 1,
2, 3, and 6 remain exactly as AI-performed/AI-capability-gap work — none of
them were ever human touches, and closing touch 2/6's capability gaps
(existing-source surfacing; independent review) improves what the AI agent
can do, not what a human must do, and therefore does not change the
human-touch count in either direction.

### Exception-path human-touch treatment (per (C) — not part of the normal-path count)

A cycle may stop as `NEEDS_HUMAN_CLARIFICATION`/`HOLD` at any of touches 1,
3, 5, or 6 above if the AI-assisted work encounters genuine ambiguity,
insufficient evidence, sensitive material, or an unresolved contradiction.
**This is the one place a human touch may legitimately occur on a subset of
cycles today, and it is explicitly not counted against the normal-path
zero-handoff target** — it is a distinct, smaller-volume, non-normal path.
Per criterion (C), exception-path human intervention is tracked separately
from, and must never be summed into, the CURRENT BASELINE or TARGET NORMAL
PATH metrics above. This is an explicitly sanctioned outcome, not a
pipeline failure, and WU048's adversarial matrix must exercise it directly
(§14, cases 4/5/9/10/11) to confirm it triggers correctly and does not
silently degrade into either (a) a normal-path human handoff in disguise or
(b) a silent, unflagged failure.

### HUMAN_APPROVAL → READY_FOR_OWNER_MERGE (per (D), Gate 1 decision itself excluded from the pre-Gate count above and listed first here instead)

1. **Owner reads the review package and decides** APPROVE / REJECT /
   HOLD-MORE_RESEARCH. — **GOVERNANCE_REQUIRED** (this is Gate 1 itself,
   per `docs/investigationstrategy.md` §3; permanently human, per (D) not
   counted as a pre-Gate handoff).
2. **Approval is hand-transcribed as literal constants into a new
   promoter script** (e.g. `promote-approved-r4.ts`'s `APPROVED_BASE`/
   `APPROVED_UPDATES`), then that script and an independent
   `npm run research:validate` re-confirmation are run. —
   **CURRENT_TOOLING_GAP** (this is the weakest link in the whole pipeline:
   the only technical record that approval occurred is whatever a
   human/agent chose to type into a script; see §9 OD-D/OD-E, §12).
3. **Manually create a branch, commit, push, and open a PR.** —
   **MECHANICAL_AND_AUTOMATABLE**.
4. **CI runs automatically** (`validation.yml`). — already zero-touch;
   **MECHANICAL_AND_AUTOMATABLE**, listed for completeness, not as an
   additional manual action.
5. **Owner manually merges the PR on GitHub.** —
   **GOVERNANCE_REQUIRED**, explicitly must remain manual (WU044 packet
   acceptance criteria: "automatic owner merges = 0"; never optimized
   away).

**Post-approval touches = 5**, with exactly one primary category each:

| Category | Touch numbers | Count |
|---|---|---|
| GOVERNANCE_REQUIRED | 1, 5 | **2** |
| CURRENT_TOOLING_GAP | 2 | **1** |
| MECHANICAL_AND_AUTOMATABLE | 3, 4 | **2** |
| **Total** | | **5** |

**Proof: 2 + 1 + 2 = 5.**

### Target path for M013 — summary across both halves

**Pre-Gate (RESEARCH_TRIGGER → APPROVAL_READY_PACKAGE):** current baseline
= 2 human touches (touches 4 and 5 above); target after WU045/WU046 = 0
(per (B), restated from the corrected section above — not redefined here).
Touches 1 and 3 are AI-performed work (excluded from the human-touch count
under criterion D) and are unaffected by this target; touches 2 and 6 are
AI-capability gaps (also not human touches today) whose closure improves
what the AI agent can do without changing the human-touch count.

**Post-approval (HUMAN_APPROVAL → READY_FOR_OWNER_MERGE):** current
baseline = 5 touches, of which post-approval touch 1 (Gate 1 decision) and
touch 5 (PR merge) are GOVERNANCE_REQUIRED and permanently human — these
two are the *only* human touches this contract ever proposes to keep, on
either side of the Gate. Post-approval touch 2 (approval-transcription,
CURRENT_TOOLING_GAP) and touches 3–4 (branch/commit/push/PR,
MECHANICAL_AND_AUTOMATABLE) are WU046's elimination targets (§12, OD-E):
after WU046, they collapse into one deterministic, auditable execution
triggered directly by the recorded Gate 1 decision, leaving no additional
human touch between "owner approves" and "PR is ready for the owner's own
merge."

**Combined, M013's target state has exactly two human touches on the
entire RESEARCH_TRIGGER → READY_FOR_OWNER_MERGE path: the Gate 1 decision
and the final PR merge — both already GOVERNANCE_REQUIRED and explicitly
never optimized away.** Every other touch identified in this section is
either AI-performed work, an AI-capability gap, or a tooling gap already
scoped for elimination by WU045/WU046.

---

## 6. Existing deterministic capabilities to reuse (do not rebuild)

- `tools/research/integration/candidate-delta.ts` — CREATE/UPDATE/NO_CHANGE
  classification by exact-ID structural comparison. **Reuse as-is.**
- `tools/research/integration/prospective-validation.ts` — candidate-set
  overlay + full corpus validation + PRB `created_at` UPDATE-immutability.
  **Reuse as-is.**
- `tools/research/integration/canonical-integration-review.ts` — the
  `CanonicalIntegrationReview` object is already exactly the deterministic
  core of what OD-C's proposed Research Change Set would wrap. **Reuse as
  the review core; do not reimplement delta/validation/readiness logic
  inside a new "RCS" concept.**
- `tools/research/integration/canonical-integration-plan.ts` — exact,
  byte-literal, path-escape-guarded write-plan preparation. **Reuse as-is.**
- `tools/research/integration/canonical-promoter.ts` — exact-HEAD-match,
  clean-tree precondition, staged dry-run validation, atomic writes with
  rollback, byte-exact post-write verification. **Reuse as-is; this module
  already satisfies nearly all of WU048's promotion-failure/rollback
  adversarial requirements (§9) at the library level.** Do not modify its
  safety invariants.
- `tools/research/readiness/readiness.ts` — Eligibility/Corroboration
  structural evaluation with 31 stable `ReasonCode`s (31 at the WU044
  baseline). **Reuse as-is.** Do not change `readiness.ts` to satisfy this
  count correction — the correction is to this document's wording only
  (§0a LOW-1).
- `tools/research/validation/validate.ts` (+ `cli.ts`) — full structural
  validator, already CI-wired via `research:check`. **Reuse as-is.**
- `apps/research-explorer/scripts/build-data.js` — validate → build →
  atomic publish with post-write integrity re-check. **Reuse as-is.**
- `.github/workflows/validation.yml` — validate + build CI, already
  correctly scoped (no write-back, no deploy, no auto-merge). **Extend
  cautiously if WU046 needs a new CI check; do not weaken its existing
  boundary.**

**Duplicate capabilities that should NOT be rebuilt:** any new "delta",
"dedupe-by-ID", "validation overlay", or "promotion" logic — every one of
these already exists, is tested, and is more defensively engineered
(especially `canonical-promoter.ts`) than a new WU045/WU046 implementation
would likely achieve from scratch. WU045/WU046's job is orchestration and a
thin, structured AI-output/review-package contract around these existing
primitives, not new core logic.

---

## 7. Missing orchestration / automation gaps

1. **No reusable CLI wraps the deterministic chain end-to-end.** Every real
   cycle (`WU029-AR01-gate1`, `cimac-geocimac-direct-response`,
   `deis-caregivers-direct-response`) hand-writes its own
   `prepare-gate-1.ts`/`promote-approved-*.ts`, hardcoding candidate
   filenames, IDs, and (for the promoter) the approved plan itself. This is
   pure repeated boilerplate around already-correct library calls — the
   exact target for WU045/WU046's orchestration layer.
2. **No structured AI-output contract (OD-B).** The two prompt templates
   instruct the AI agent in prose ("author complete YAML records... do not
   invent fields") but define no machine-checkable output envelope (e.g., a
   required manifest listing candidate files, investigation question,
   claimed record IDs, and a self-declared confidence/uncertainty summary)
   that deterministic tooling could validate *before* running the
   integration chain. Today, the first deterministic checkpoint is
   `candidate-delta.ts`/`prospective-validation.ts`, which only sees
   already-well-formed YAML — there is no earlier structural gate on the
   AI agent's raw output shape.
3. **No independent review step (stage 19, §4).** This is the single
   largest capability gap relative to the WU044 packet's stated OD-B scope
   ("AI-assisted... independent review produce structured outputs that
   deterministic tooling validates") and relative to WU048's acceptance
   criterion "independent review coverage = 100%." Today, coverage is 0%.
4. **No generic Research Change Set assembly.** `GATE1-PACKAGE.md` is
   hand-authored prose per cycle. OD-C's proposed non-canonical operational
   artifact would formalize this: a generated document/data structure that
   deterministically incorporates the existing `CanonicalIntegrationReview`
   (candidates, deltas, validation, readiness) plus AI-authored rationale,
   the new independent-review result (gap 3), contradiction/overlap
   findings, risks, and the exact `baseGitSha` — without inventing a new
   canonical record type (the WU044 packet explicitly forbids this, and OD-C
   as scoped does not require one: this is a *non-canonical, local/staged*
   artifact, structurally similar to `CanonicalIntegrationReview` but with
   review-narrative fields layered on top).
5. **No structured Gate 1 decision capture (OD-D contributor).** Approval is
   recorded only as (a) freeform prose edits to a gitignored markdown file
   and (b) hand-transcribed literal constants in a promoter script. There is
   no machine-checkable artifact binding "owner approved exactly this
   `baseGitSha` + this exact operation set + at this timestamp" independent
   of a human correctly copying that information into a new script by hand.
   WU046 should close this gap by having the orchestrator itself capture the
   decision input (e.g., an approval command/flag bound to the exact
   reviewed plan hash) rather than requiring a bespoke script per cycle.
6. **No branch/commit/push/PR automation (OD-E).** Entirely manual today.
   WU046's scope explicitly covers automating this *after* approval, up to
   `READY_FOR_OWNER_MERGE`, using the same building blocks CI already uses
   (`npm ci`, `research:check`, `explorer:build`) as its own pre-push
   self-check before opening a PR.
7. **AIQT/research HEAD-coupling friction (§3).** The promoter's
   exact-HEAD-match precondition is correct and must not be weakened, but
   WU045/WU046 orchestration should be designed with awareness that
   unrelated AIQT bookkeeping commits to `main` will force a base-SHA
   refresh of any in-flight review package. This is not a defect in the
   promoter; it is a process-sequencing consideration for whoever runs a
   research cycle concurrently with other repository work.

**Failure/retry/idempotency requirements for WU045/WU046:**
`canonical-promoter.ts` already provides atomicity and rollback at the
canonical-write level. The new orchestration layer's responsibility is one
level up: if the AI-assisted discovery/authoring/independent-review steps
fail or are interrupted partway, the normal-path pipeline must fail closed
into "no candidate reaches Gate 1" rather than silently completing an
incomplete package — this is a design requirement for WU045, not something
the existing tooling already guarantees, since a partial/malformed candidate
folder is possible today and would simply fail deterministic validation
downstream (which is a safe failure, but not necessarily a clearly-reported
one to whoever is running the cycle).

---

## 7a. Deferred tooling/documentation observation (independent review LOW-2)

**Disposition:** `DEFERRED_TOOLING_REPRODUCIBILITY_OBSERVATION` (§0a).

**Finding:** `aiqt` is currently supplied as a separately/global-installed
pnpm CLI, and its installation path is not repository-documented.

This is **not** a WU044 contract blocker. It does not gate WU045
authorization, does not affect any OD-A through OD-E decision, and is not
remediated by this pass. `AGENTS.md` and `README.md` are not modified by
this observation, and M013's scope is not expanded to repair it. It is
preserved here only so a future tooling/documentation pass (outside M013)
has a recorded pointer to the gap.

---

## 8. Pre-Gate publication-leak analysis / Gate 1 & public-publication current-state analysis

**Correction note (overseer pass):** the prior revision of this contract
stated that `main` had no branch protection, based on a `GET
/repos/.../branches/main/protection` (the legacy branch-protection API)
returning `404`. That check was a false negative: this repository protects
`main` via the newer **Repository Rulesets** API, not the legacy
branch-protection API, and a 404 on the legacy endpoint says nothing about
ruleset-based protection. An overseer-supplied, independently re-verified
check against `GET /repos/JoaomdvFerreira/open-evora/rulesets` and `GET
.../rulesets/21106712` (performed directly in this session, not merely
asserted) confirms an **active** ruleset named "Protect main," targeting
`refs/heads/main`, enforcing: deletion protection; non-fast-forward
protection; a pull-request requirement with `required_approving_review_count:
1`, stale-review dismissal on push, and required review-thread resolution;
and a required status check named `validation` (matching
`.github/workflows/validation.yml`'s job name exactly). The ruleset's
`bypass_actors` list restricts the repository-owner role to
`bypass_mode: "pull_requests_only"` — i.e., even the owner cannot push
directly to `main` outside a pull request; the owner's only bypass is that
their own PR review may count toward the required-approval count (a normal
consequence of solo-maintainer repositories, not an absence of protection).
**The prior "no branch protection" finding is withdrawn.** Repository
visibility is independently confirmed **PUBLIC**
(`gh repo view` → `"visibility":"PUBLIC"`). Do not treat a solo owner's
historical inability to self-approve as evidence of absent protection —
the ruleset is active regardless of how many distinct human reviewers
currently exist.

**Pre-Gate leakage — repository-verifiable findings (confirmed safe today):**

- `.research-workbench/` is gitignored (`.gitignore` line
  `/.research-workbench/`), and this is enforced by an actual passing
  regression test (`tools/research/workbench-boundary.test.ts`, which runs
  `git check-ignore -v` and asserts the exact matching `.gitignore` line).
  This is a real, executing safeguard, not merely a convention.
- No script that writes to canonical `research/` (only
  `applyCanonicalIntegrationPlan()` and its internal `writeFileSync` calls)
  is invoked automatically by `package.json`, `.github/workflows/*`, or any
  Git hook (`.git/hooks/` contains only unmodified `.sample` files; no
  Husky or equivalent is configured).
- CI (`validation.yml`) never writes to `research/`, never commits, never
  pushes, and carries no elevated `permissions:` block.
- The promoter refuses to run under conditions an automatic/accidental
  invocation would plausibly satisfy: it requires the working tree to be
  clean, `HEAD` to exactly equal the plan's `baseGitSha`, and a pre-existing
  valid canonical corpus — and even then it only writes the exact
  byte-literal YAML already present in a plan that itself required a prior
  `READY_FOR_INTEGRATION_GATE` review.
- **Conclusion (repository-verifiable):** no automatic code path exists
  today from `.research-workbench/` candidate content into canonical
  `research/`, into a Git commit/push, into CI, or into the public Explorer.
  Every observed canonical write in this repository's history required a
  human to author and manually execute a specific promoter script against
  an already-reviewed plan.

**Strengthened pre-Gate publication boundary (corrected, per overseer
verification, §4/§9 below):** the repository being **PUBLIC** plus Vercel's
confirmed automatic Preview-deployment behavior on every PR/non-main branch
(§9) together make the publication boundary **stronger, not weaker, than
the prior draft expressed** — but only if the boundary is stated correctly.
The binding rule for M013 governance purposes is:

> **PRE-GATE candidate research must not be:**
> - **committed** to any tracked repository path;
> - **pushed** to GitHub, on any branch;
> - **included in a pull request**, open or draft;
> - **exposed through a Vercel Preview deployment** (which is triggered
>   automatically by any PR or non-`main` branch push, per §9's confirmed
>   Git-integration behavior);
> - **exposed through the production Research Explorer.**
>
> `.research-workbench/` remains local, non-canonical, and gitignored
> (enforced by `workbench-boundary.test.ts`, §8 above) — it is not itself a
> repository publication act. **A public GitHub branch or pull request that
> contains candidate research counts as publication for M013 governance
> purposes, regardless of review status, draft status, or intended
> audience** — because this repository is public, any branch pushed to
> GitHub is publicly readable, and any such branch or an associated PR will
> trigger an automatic, publicly-reachable Vercel Preview deployment (§9).
> There is no private/internal branch state in this repository's current
> configuration. WU045/WU046 must treat "push to GitHub" itself, not merely
> "merge to `main`," as the operative publication-boundary event for
> pre-Gate material.

This is a direct strengthening of AGENTS.md's publication-boundary rule
("commits, branches, pull requests, generated artifacts, and deployments"
are all named there as potential publication acts) — this section confirms
with owner-supplied evidence exactly which of those acts are automatically
and immediately public in this repository's actual configuration, not just
notionally possible.

**Residual pre-Gate risk (procedural, not technical):**

- A human could still `git add -f` a workbench file or hand-copy candidate
  content into a tracked file — this is a *possible* human action, not an
  automatic one, and is out of scope for tooling to prevent entirely
  (AGENTS.md's publication-boundary safeguards are procedural/policy
  controls at this point, not code). WU047/WU048 should confirm no existing
  script or shortcut makes this action easier or less visible than a plain
  `git add -f` would already be (i.e., confirm WU045/WU046 introduce no new
  convenience path that weakens this residual human-discipline requirement).
- The approval-transcription weak link (§4 stage 24, §7 gap 5) means a
  *procedural* mismatch between what the owner actually approved in prose
  and what a promoter script's hardcoded constants encode is possible today
  with no independent technical cross-check. This is the primary target of
  OD-D/OD-E and of WU048's "automatic canonical approvals = 0" and
  "independent review disagreement surfaced to human" adversarial cases.

**Gate 1 / public-publication current-state finding (corrected):**

Per `docs/investigationstrategy.md` §3, Gate 1 (canonical integration) is
explicitly **not** the same decision as Explorer publication ("Gate 1 does
not publish material in the Research Explorer; Explorer publication is a
separate future Gate 2"). The Vercel Git-integration facts below (now
VERIFIED_EXTERNAL, not guessed) confirm precisely how these two conceptually
distinct gates map onto actual deployments today:

- **`main` merge → Production deployment.** Confirmed: the current
  Production deployment's Git ref is `main` at SHA
  `f5ffeb6da7400c742934c7e286f80d18f6e1aa29` (the exact M013 baseline),
  target `production`, state `READY`.
- **Any PR / non-`main` branch push → Preview deployment**, automatically,
  with no separate manual trigger.
- Given the ruleset (§8 above) requiring every change to `main` to go
  through an approved, status-check-passing PR, and given every PR
  automatically produces a Preview deployment, **the actual current
  topology mechanically collapses Gate 1 (PR-merge/canonical-integration
  approval) and what `investigationstrategy.md` calls the separate future
  "Gate 2" (Explorer/public-publication approval) into one event**: merging
  the PR is simultaneously the only Gate-1-adjacent human action that
  exists today *and* the trigger for the Production deployment that serves
  the public Explorer. **There is no evidence of a separate, distinct
  Gate 2 publication-approval mechanism** — this finding is confirmed, not
  weakened, by the corrected Vercel facts; what has changed is that the
  mapping is now independently verified rather than assumed. This remains
  the exact mismatch the WU044 packet's §6 asked this contract to name
  explicitly, and it is the direct subject of OD-D (§9).

**VERIFIED_EXTERNAL facts (owner-supplied, independently confirmed this
pass — supersedes the prior draft's `UNVERIFIED_EXTERNAL` treatment of
these same items):**

- **Vercel project:** `open-evora`.
- **Git integration behavior**, confirmed from actual deployment history:
  `main` merge → target = `production`; any PR / non-`main` branch →
  Preview deployment.
- **Current production deployment for the M013 baseline:** Git ref `main`,
  SHA `f5ffeb6da7400c742934c7e286f80d18f6e1aa29`, target `production`,
  state `READY`.
- **Project domains:** `open-evora.vercel.app`,
  `open-evora-joaomdvferreiras-projects.vercel.app`,
  `open-evora-git-main-joaomdvferreiras-projects.vercel.app`. **No custom
  domain is currently configured.**
- **GitHub repository visibility:** **PUBLIC** (independently confirmed
  this pass via `gh repo view` → `"visibility":"PUBLIC"`, corroborating the
  owner-supplied fact).
- **Recent runtime-error query:** no runtime errors found in the selected
  7-day range.
- **GitHub branch protection on `main`:** **ACTIVE**, via the Repository
  Rulesets API — see §8's correction note above for the full rule set. The
  prior finding of "no branch protection" is withdrawn.

**Remaining UNVERIFIED_EXTERNAL items (narrower than the prior draft;
owner or overseer must still supply direct evidence for each):**

1. **Deployment Protection policy/settings** — whether Vercel additionally
   requires a manual approval/promotion step beyond the confirmed
   auto-deploy-on-push-to-`main` behavior (e.g., a protected-environment
   gate on top of the Git-integration trigger already confirmed above).
   Evidence needed: the project's Deployment Protection configuration
   screen.
2. **Any environment-specific access-control setting not exposed by the
   project/deployment metadata already reviewed** — e.g., whether Preview
   deployments carry any authentication requirement beyond being served at
   an unlisted-but-guessable URL. Evidence needed: the project's
   Preview-deployment access-control setting, if any exists beyond what
   standard Vercel Preview behavior already implies.

Items 1–4 from the prior draft's `UNVERIFIED_EXTERNAL` list (Git-trigger
mapping, production domain binding, manual-approval requirement, and
Preview visibility as a general question) are now resolved as
VERIFIED_EXTERNAL above; only the two narrower items immediately above
remain genuinely unverified, and this contract does not guess their
answer.

---

## 9. OD-A through OD-E decision register

Every item below is **OWNER_DECISION_REQUIRED**. No repository content
found during this investigation constitutes an existing binding owner
decision that fully resolves any of these five questions (unlike AR-05's
OD-1–OD-4, which WU041 found already owner-resolved in a prior contract
revision — no equivalent prior resolution exists for OD-A–OD-E).

### OD-A: Automation topology — **OWNER_APPROVED: Option 1 (local/operator-triggered orchestration; no scheduler/cloud/continuous infrastructure for M013 launch)**

**Owner decision record:** APPROVED, Option 1. **Date/context:** M013/WU044,
PKT-045, this consolidation pass. **Rationale (owner-stated):** local/
operator-triggered orchestration first; no scheduler, cloud execution, or
continuous infrastructure is required for the M013 launch. **Binding
consequence for WU045–WU048:** WU045's orchestration entry point (§11) is
frozen as a locally-invoked CLI/script with zero scheduling, cron, or
unattended-execution infrastructure; WU048's verification matrix (§14) need
not exercise scheduled/unattended-trigger failure modes, since none exist.
**Rejected alternatives:** Option 2 (scheduled/cron-triggered unattended
discovery) — rejected as introducing unattended AI-agent execution,
credential/rate-limit handling, and a materially larger security/review
surface disproportionate to a launch-scoped milestone. Option 3 (continuous/
cloud-triggered execution) — rejected as out of proportion for M013,
requiring infrastructure the repository does not have and is not
justified in building for launch.

- **Exact question:** Should WU045/WU046 orchestration be a
  locally/operator-triggered script (human runs one command to execute the
  normal-path pipeline for one cycle) or should it include any
  scheduled/cloud/continuous execution (e.g., a daily cron-triggered
  discovery run)?
- **Factual current-state evidence:** No scheduler, cron, GitHub Actions
  `schedule:` trigger, or cloud-orchestration config exists anywhere in the
  repository today (only `pull_request`/`push` triggers exist, and only for
  the validate+build workflow). The two prompt templates are named
  `daily-discovery.md` and `problem-refresh.md`, suggesting an intended
  cadence, but nothing currently automates that cadence.
- **Viable options:**
  1. Local/operator-triggered only — a human runs one command (e.g.
     `npm run research:cycle -- --prompt=daily-discovery`) when they choose
     to start a cycle. No scheduling infrastructure.
  2. Scheduled (e.g., a daily GitHub Actions cron job) that runs the
     AI-assisted discovery/authoring steps unattended and leaves a package
     waiting for human Gate 1 review.
  3. Continuous/cloud-triggered (e.g., triggered by external event feeds) —
     materially larger scope, requiring infrastructure this repository does
     not currently have.
- **Trade-offs:** Option 1 matches the WU044 packet's own explicit framing
  ("default candidate is local/operator-triggered orchestration first;
  scheduled/cloud/continuous execution must not be assumed necessary for
  launch") and requires zero new infrastructure or credential management;
  Option 2 could reduce the "someone has to remember to start a cycle"
  friction but introduces unattended AI-agent web-research execution,
  cost/credential/rate-limit considerations, and a materially larger
  security/review surface for a launch-scoped milestone; Option 3 is
  explicitly out of proportion for M013.
- **Recommendation:** Option 1. The WU044 packet's own scope text already
  states this as the default; nothing discovered during this reconciliation
  contradicts it or demonstrates scheduled execution is necessary for
  launch readiness.
- **Consequence for WU045–WU048:** Option 1 keeps WU045's file/infrastructure
  footprint to a local CLI/script; Option 2/3 would require WU045 to also
  define credential handling, execution environment, and unattended-failure
  alerting — materially expanding WU045's scope beyond what WU044 bounds.
- **Consequence of deferring:** The pipeline remains exactly as
  operator-triggered as it is today (via manual prompt invocation); this is
  not a regression, since no scheduled execution exists now either.
- **Required before implementation?** Yes — WU045's exact CLI/script
  boundary depends on this answer.

### OD-B: AI execution contract — **OWNER_APPROVED: Option 2 (structured manifest + distinct, structurally-required independent-review output; five-point independence minimum bar binding)**

**Owner decision record:** APPROVED, Option 2. **Date/context:** M013/
WU044, PKT-045, this consolidation pass. **Rationale (owner-stated):**
structured AI outputs plus mandatory independent review, specifically: a
separate review invocation/role; an immutable candidate/RCS input the
review cannot silently revise; a structured review output; deterministic
schema validation of that output; the generator's own recommendation never
counts as review approval; the same vendor/model is allowed since
independence here is operational/contextual (a separate invocation
consuming a fixed, already-produced artifact), not a requirement for a
different vendor or model. **Binding consequence for WU045–WU048:** WU045
(§11) must implement two distinct AI-invocation points per cycle — primary
authoring and independent review — satisfying all five minimum-bar points
already specified in this section (separate invocation/role; consumes the
immutable candidate/RCS artifact; structured outcome field, e.g. `CONCUR` /
`DISAGREEMENT_FOUND` / `INSUFFICIENT_EVIDENCE`, plus rationale;
deterministic schema validation of that result; generator self-assessment
never satisfies the review requirement). WU048 (§14, case 11) must exercise
"independent review disagreement surfaced to human" against this real
structured artifact. **Rejected alternatives:** Option 1 (minimal manifest
only, no independent-review contract) — rejected because it would leave
WU048's "independent review coverage = 100%" acceptance criterion
unattainable (no review capability would exist to measure). Option 3 (full
structured extraction contract for every intermediate step, including
discovery search queries/sources considered) — rejected as materially
larger scope than a launch-readiness milestone requires and as risking
mechanizing judgements `AGENTS.md`/`investigationstrategy.md` deliberately
keep human/AI-substantive rather than structurally checkable.

- **Exact question:** What is the exact structured-output contract by which
  AI-assisted discovery, extraction, candidate generation, contradiction
  search, and independent review produce output that deterministic tooling
  (WU045) can validate — before that output is treated as a candidate ready
  for the existing `candidate-delta`/`prospective-validation` chain?
- **Factual current-state evidence:** Today this contract is entirely
  informal prose in `.research-workbench/prompts/*.md` ("author complete
  YAML records in the current canonical shape... do not invent fields").
  There is no manifest schema, no machine-checkable declaration of which
  files an AI agent produced for a given cycle, no self-declared
  confidence/uncertainty summary, and — critically — no distinct
  independent-review output contract at all (stage 19, §4/§7 gap 3).
- **Viable options:**
  1. A minimal structured manifest only (e.g., a JSON/YAML file per cycle
     listing: investigation question, candidate file paths, claimed record
     IDs, and a free-text rationale) — deterministic tooling validates only
     that the manifest is well-formed and that every listed candidate file
     parses and passes the existing `candidate-delta`/`prospective-validation`
     chain. No new independent-review contract.
  2. Manifest (as in Option 1) plus a distinct, structured independent-review
     output (e.g., a second manifest field or file produced by a second,
     separately-invoked AI pass) that records: what was checked, whether any
     disagreement/contradiction was found relative to the primary
     authoring pass, and a recommendation — deterministically required to be
     present (non-empty) before the package can reach
     `READY_FOR_INTEGRATION_GATE`-adjacent status, without deterministic
     tooling ever evaluating the *content* of that review as true/false.
  3. Full structured extraction contract for every intermediate step (e.g.,
     a machine-checkable schema for the discovery step's search queries and
     sources considered, not just final candidates) — materially larger
     scope than a launch-readiness milestone requires.
- **Trade-offs:** Option 1 is the minimum viable structured contract and
  directly closes gap 2 (§7) with low implementation risk; Option 2
  additionally closes gap 3 (§7) — the single largest capability gap found
  in this reconciliation — and is necessary to satisfy the WU044 packet's
  own acceptance criterion "independent review coverage = 100%" (§—, Go-Live
  Acceptance Contract); Option 3 risks scope creep into mechanizing
  judgements AGENTS.md and `investigationstrategy.md` deliberately keep
  human/AI-substantive (e.g., §4's proportionate-source-selection
  reasoning) rather than structurally checkable.
- **Recommendation:** Option 2. Option 1 alone would leave WU048's stated
  100% independent-review-coverage acceptance criterion unattainable, since
  no independent review capability would exist to measure coverage of.
  Option 2's structural requirement (a review output must exist and be
  non-empty) is achievable without mechanizing substantive research
  judgement, consistent with every other AUTOMATED/PARTIALLY_AUTOMATED
  classification in §4 (structural presence-checking, never truth-checking).
- **Strengthened minimum bar for "independent review" (overseer
  correction):** whichever option the owner approves, "independent review"
  must mean at minimum all of the following, not merely a second block of
  prose in the same output:
  1. **A separate review invocation/role** — the review step is a distinct
     invocation, logically and procedurally separate from the primary
     authoring pass, not a second paragraph the same invocation appends to
     its own output.
  2. **The review consumes the immutable candidate/Research Change Set
     artifact** — it reads the already-produced, fixed candidate output
     (per OD-C) as its input; it does not have the ability to silently
     revise what it is reviewing.
  3. **A structured review result** — not free prose alone: at minimum a
     machine-checkable outcome field (e.g., `CONCUR` /
     `DISAGREEMENT_FOUND` / `INSUFFICIENT_EVIDENCE`) plus a rationale
     field.
  4. **Deterministic schema validation of that result** — the same class of
     structural check `tools/research/validation/validate.ts` already
     applies to canonical records must apply to the review-result shape
     (required fields present, enum values valid) before the package can
     be considered to have review coverage at all.
  5. **The generator's own recommendation is never treated as review
     approval** — WU046's decision interface (§12) must not accept the
     primary authoring pass's self-assessment as satisfying this
     requirement; the structured review result from the separate
     invocation is the only thing that counts.
  6. **True review context isolation (added by independent-review finding
     MEDIUM-1, §0a; strengthens, does not replace, points 1–5):** the
     independent review invocation must use a separate invocation, in a
     fresh context/session, with:
     - no generator conversational history;
     - no generator scratch reasoning;
     - no generator chain-of-thought/rationale injected as reviewer
       context;
     - no hidden continuity or session state carried over from candidate
       generation.

     The reviewer invocation **may** receive only:
     - the immutable, validated Research Change Set (per OD-C);
     - immutable source snapshots/references required to inspect the
       RCS's own cited evidence;
     - canonical repository context/schema necessary to validate the
       candidate (e.g. `research/schemas/*.json`, existing canonical
       records the candidate references);
     - deterministic validation/readiness outputs already included in or
       referenced by the RCS (e.g. `prospective-validation.ts`/
       `readiness.ts` results).

     The reviewer must derive its own assessment from that bounded input
     set alone. Same provider/model remains permitted (per point 5's
     existing "not required" language); a different provider/model is
     still not required. The independent-review output must remain
     separately structured and schema-validated exactly as points 3–4
     already require — this point governs what the reviewer may see, not
     the shape of what it returns.
  This does **not** require a different AI vendor or model from the
  primary authoring pass unless a separate owner decision specifically
  justifies that (e.g., on cost/quality/diversity-of-failure-mode grounds)
  — same-vendor, same-model but procedurally separate, context-isolated,
  and structurally validated satisfies this minimum bar. This strengthening
  refines OD-B's Option 2 (and, if chosen, Option 3); it does not change
  which option is recommended.
- **Consequence for WU045–WU048:** Option 2 requires WU045 to define and
  implement two AI-invocation points per cycle (primary authoring +
  independent review, per the five-point minimum bar above) rather than
  one, and requires WU048 to include a specific adversarial case exercising
  "independent review disagreement surfaced to human" (already named in
  WU048's canonical scope, §14) against a real structured artifact rather
  than an informal one.
- **Consequence of deferring:** If OD-B is deferred/unresolved, WU045 cannot
  be implementation-deterministic — its scope explicitly requires
  "structured outputs that deterministic tooling validates," which cannot
  be built without this decision.
- **Required before implementation?** Yes — this blocks WU045's core
  boundary.

### OD-C: Research Change Set review artifact — **OWNER_APPROVED: Option 3 (structured JSON source of truth + generated Markdown human-review view; non-canonical, no new record type)**

**Owner decision record:** APPROVED, Option 3. **Date/context:** M013/
WU044, PKT-045, this consolidation pass. **Rationale (owner-stated):** the
Research Change Set is non-canonical operational state — JSON is the
source of truth, a generated Markdown view is the human-review
presentation, both are schema-validated, the JSON is stable/hashable and
bound to the exact base SHA, and no canonical `RCS-*` record type is
introduced. **Binding consequence for WU045–WU048:** WU046 (§12) must
assemble the RCS as a JSON object layering narrative/independent-review/
risk fields on top of the existing `CanonicalIntegrationReview` core
(reused as-is, per §6), plus one small, additive, deterministic
Markdown-rendering function deriving the human-reading view from that JSON
— never the reverse. The JSON must be stable/hashable (supporting OD-D/
OD-E's approval-binding mechanism, §12) and bound to the exact `baseGitSha`
already captured by `canonical-integration-review.ts`. WU048 (§14) verifies
the rendered Markdown package against its JSON source of truth, not against
unstructured prose. No canonical schema or `research/schemas/*` file is
touched by this decision. **Rejected alternatives:** Option 1 (continue
bespoke hand-authored prose per cycle) — rejected as leaving review quality
dependent on how carefully each cycle's prose happens to be written, with
no structural completeness check. Option 2 (structured JSON only, no
generated Markdown view) — rejected as producing a less usable human-review
experience for the mandatory Human Gate (§12) without the added cost of
Option 3's rendering step being materially higher.

- **Exact question:** Should Open Évora adopt a non-canonical, operational
  Research Change Set artifact — grouping candidate SRC/EVD/PRB, rationale,
  provenance, deltas, validation, readiness, contradiction findings,
  independent-review result, risks, and the exact canonical base SHA — as a
  structured (not purely prose) artifact generated by WU046, without
  authorizing any new canonical `RCS-*` record type?
- **Factual current-state evidence:** `tools/research/integration/canonical-integration-review.ts`
  already implements the deterministic core of this concept
  (`CanonicalIntegrationReview`: `baseGitSha`, `candidates`, `deltas`,
  `validation`, `readiness`) as tested, reusable library code (§6). What is
  missing is (a) the narrative/rationale/risk layer on top, and (b) a
  standard, reusable *assembly* of that layer with the deterministic core
  into one artifact — today this assembly is redone as bespoke prose
  (`GATE1-PACKAGE.md`) per cycle (§4 stage 23, §7 gap 4). No canonical
  schema or `research/schemas/*` file defines or references an `RCS-*`
  concept, and none should be added — canonical schema/record-type
  introduction is explicitly out of WU044's scope and would need its own
  separate authorization regardless of this decision.
- **Viable options:**
  1. No new artifact — continue producing a bespoke prose review document
     per cycle, as today.
  2. A structured, non-canonical, locally-staged review-package artifact
     (e.g., a JSON/YAML file under a non-canonical, gitignored path such as
     an extension of `.research-workbench/`) that layers narrative fields
     (rationale, contradiction findings, independent-review result, risks)
     on top of the existing `CanonicalIntegrationReview` object, generated
     deterministically by WU046's orchestration wherever possible and
     populated by the AI-assisted steps (per OD-B) where not.
  3. A structured artifact as in Option 2, but rendered additionally as a
     human-readable markdown view (generated, not hand-authored) for the
     actual Gate 1 reading experience — the machine-checkable JSON/YAML
     remains the source of truth; the markdown is a derived presentation.
- **Trade-offs:** Option 1 requires no new work but leaves gap 4 (§7) open
  and keeps every cycle's review quality dependent on how carefully that
  cycle's prose was hand-written; Option 2 makes the review package
  itself deterministically checkable (e.g., WU046 can assert "this package
  is complete" structurally) but produces a less pleasant human-reading
  artifact unless paired with Option 3; Option 3 gives both a
  machine-checkable source of truth and a good human reading experience, at
  the cost of WU046 needing a small rendering step (analogous to how
  `apps/research-explorer` already renders structured data into a reading
  experience — no new architectural pattern, just a smaller instance of one
  already proven in this codebase).
- **Recommendation:** Option 3. It most directly satisfies the WU044
  acceptance criterion of a coherent, inspectable review package (WU046's
  canonical scope: "presenting one coherent, inspectable human review
  package") while reusing the existing `CanonicalIntegrationReview` core
  exactly as it is today (§6) and while explicitly not introducing any new
  canonical record type, consistent with the WU044 packet's explicit
  boundary.
- **Preferred serialization (added recommendation, still non-binding):**
  the structured source-of-truth half of Option 3 should be **JSON**, not
  YAML, for the following reasons: deterministic parsing (no YAML anchor/
  alias, implicit-typing, or multi-document ambiguity to reason about);
  straightforward JSON Schema validation using the same general validation
  approach `tools/research/validation/validate.ts` already applies to
  canonical records; stable, unambiguous hashing (needed for OD-D/OD-E's
  approval-binding mechanism, §12) — JSON's canonical serialization is
  simpler to hash reproducibly than YAML's; and the most direct,
  lowest-friction integration with the existing TypeScript/Node tooling in
  `tools/research/**`, which already parses/serializes JSON natively
  throughout (`CanonicalIntegrationReview`/`CanonicalIntegrationPlan` are
  themselves plain JSON-serializable objects today). The generated
  human-readable Markdown view remains a *derived* presentation of that
  JSON, exactly as `GATE1-PACKAGE.md` today is prose derived from (but not
  identical to) the underlying `CanonicalIntegrationReview.json`/
  `CanonicalIntegrationPlan.json` — this recommendation only asks that the
  derivation become deterministic/generated rather than hand-authored.
  This remains a recommendation for the owner to accept or reject alongside
  OD-C itself, not a decision made here.
- **Consequence for WU045–WU048:** Option 3 requires WU046 to include one
  small, additive markdown-rendering function; WU048 would then verify the
  rendered package against its own source-of-truth JSON rather than
  against unstructured prose.
- **Consequence of deferring:** WU046 would need to fall back to Option 1's
  status quo, and the WU044 packet's own acceptance criteria (a "coherent,
  inspectable" package) would be harder to verify structurally in WU048.
- **Required before implementation?** Yes — WU046's exact review-package
  boundary depends on this answer.

### OD-D: Combined vs. separate canonical-integration/publication approval — **OWNER_APPROVED: Option 2 (combined-by-default human interaction; `canonicalAcceptance` and `publicExplorerPublication` remain two separately auditable decisions)**

**Owner decision record:** APPROVED, Option 2. **Date/context:** M013/
WU044, PKT-045, this consolidation pass. **Rationale (owner-stated):**
normal path may expose one owner action, but the two semantic decisions —
`canonicalAcceptance` (APPROVE / REJECT / HOLD) and
`publicExplorerPublication` (APPROVE / REJECT / HOLD) — remain distinct and
independently recorded, never collapsed into a single undifferentiated
approval. **Binding exceptional-sequence rule (owner-approved, hard
requirement for WU046):** if `canonicalAcceptance = APPROVED` and
`publicExplorerPublication = HOLD`, then WU046 must:
  - preserve the approved Research Change Set (per OD-C) privately and
    non-canonically — it does not leave its existing gitignored, local
    location;
  - **not** promote it to canonical `research/**`;
  - **not** commit it;
  - **not** push it;
  - **not** open a pull request for it;
  - **not** trigger a Vercel Preview deployment for it;
  - wait for an explicit, separate `publicExplorerPublication` approval
    signal from the owner;
  - only after that explicit publication approval, execute the promoter →
    Git → PR sequence (§12) through `READY_FOR_OWNER_MERGE` (per OD-E).
This sequencing uses only the existing gitignored-workbench mechanism
(§8) — no new private-infrastructure component is introduced. **Binding
consequence for WU045–WU048:** WU046's decision interface (§12) must model
`canonicalAcceptance` and `publicExplorerPublication` as two independently
recorded fields even when the normal path exposes one combined convenience
action (`APPROVE_CANONICAL_AND_PUBLIC`); WU048 (§14) must include an
adversarial case verifying the canonical-APPROVE/publication-HOLD sequence
above actually blocks all push/PR/Preview exposure (extending case 7's
leakage-prevention pattern to this specific path). **Rejected
alternatives:** Option 1 (keep the two decisions mechanically identical,
document the current combined-event model as-is) — rejected because it
would leave `investigationstrategy.md`'s explicit Gate 1/Gate 2 semantic
distinction permanently unenforced in practice, with no path to holding
publication after canonical acceptance. Option 3 (fully separate gates,
mandatory second human action on every normal-path cycle) — rejected as a
permanent increase to the post-approval human-touch count (§5) that is not
justified for a launch-scoped milestone when Option 2 already provides the
same safety property (a genuine hold path) without a mandatory second
action on the common case.

**Prior-pass factual basis (retained for record):** the correction below
updated OD-D's factual basis (the Vercel facts are now VERIFIED_EXTERNAL,
§8) and added the architecturally-required consequence for WU046 above,
which is now confirmed as the binding exceptional-sequence rule rather than
a conditional note.

- **Exact question:** Should the normal path expose **one** human
  interaction that records both (a) canonical-integration (Gate 1) approval
  and (b) public Explorer-publication approval, while preserving the
  technical ability to separate them when the owner explicitly wants to
  (e.g., approve canonical integration now but hold public publication for
  a later date) — without silently collapsing `investigationstrategy.md`
  §3's explicit semantic distinction between Gate 1 and the "separate future
  Gate 2" it names?
- **Factual current-state evidence (corrected):** §8 now confirms, as
  VERIFIED_EXTERNAL fact rather than an assumption, that `main` merge →
  Production deployment and any PR/non-`main` branch → Preview deployment,
  automatically, with no separate manual trigger for either. Combined with
  the confirmed-active branch-protection ruleset (§8) requiring every
  change to `main` to pass through an approved PR, this means: a PR merge
  to `main` is both the only Gate-1-adjacent human action that exists today
  **and** the confirmed, automatic trigger for the Production deployment
  that serves the public Explorer. No distinct Gate 2 mechanism exists in
  code, config, or documented process. `docs/investigationstrategy.md`
  explicitly treats these as semantically distinct even though the current
  tooling does not.
- **Viable options:**
  1. Keep them mechanically identical, as today: PR merge is the single
     approval act, and merge to `main` is public publication. Document
     this explicitly as the accepted launch-scale model rather than
     leaving it an unexamined side effect.
  2. Introduce one combined normal-path human interaction (per WU046's own
     canonical scope framing) that explicitly asks the owner to confirm
     both dimensions in the same action (e.g., "Approve canonical
     integration AND public publication" as the default, single button/
     command) while separately supporting an explicit "approve integration
     only, hold publication" path for the exceptional case.
  3. Fully separate the two gates operationally: canonical integration
     merges to `main` but public deployment requires a second, distinct
     manual action — the closest technical match to
     `investigationstrategy.md`'s stated semantic distinction, at the cost
     of a second mandatory human action on every normal-path cycle.
- **Architectural consequence for WU046 if Option 2's "hold publication"
  exception is ever approved (recorded here for WU046's benefit; this does
  not resolve OD-D or authorize building anything now):** because the
  repository is confirmed PUBLIC (§8) and any branch/PR is confirmed to
  trigger an automatic, publicly-reachable Preview deployment (§8/§9), **the
  current public-repository topology cannot safely persist an
  integration-approved-but-publication-held candidate to a GitHub branch or
  PR without exposing it publicly via Preview** — pushing such a branch is
  itself a publication act under the strengthened boundary in §8. If the
  owner later approves an OD-D option that requires this exception (i.e.,
  `canonicalAcceptance = APPROVED` while `publicExplorerPublication =
  HOLD`), the only safe sequencing WU046 could implement is:
  1. preserve the approved Research Change Set (per OD-C) privately and
     non-canonically — i.e., continue holding it exactly where it already
     sits today (a gitignored, non-public location), not in any newly
     pushed branch;
  2. do **not** promote, push, or open a PR yet;
  3. wait for a second, explicit publication-approval signal from the
     owner;
  4. only then execute the promoter → Git → PR sequence (§12).
  This sequencing requires no new private infrastructure beyond what
  already exists (the gitignored workbench boundary, §8) — it is a
  behavioral/ordering constraint on WU046's orchestration logic, not a new
  system. It is recorded here as the architectural consequence WU046 must
  design for **if and only if** the owner later approves an OD-D option
  needing a "hold publication" path; WU044 does not build this, and OD-D
  itself remains open.
- **Trade-offs:** Option 1 requires no new engineering but leaves the
  semantic distinction `investigationstrategy.md` names as unenforced in
  practice — a real (if currently accepted) mismatch this contract is
  required to surface, not resolve; Option 2 matches WU046's own canonical
  framing most closely and (per the architectural consequence above) is now
  known to be implementable using only the existing gitignored-workbench
  mechanism, with no dependency on any further Vercel configuration beyond
  what §8 already confirms; Option 3 is the cleanest match to the
  documented Gate 1/Gate 2 distinction but adds a mandatory second human
  action to every cycle, which is a real, permanent increase in the
  "post-approval" human-touch count (§5) that the owner may or may not want
  to accept.
- **Recommendation:** Option 2, now on firmer footing than the prior draft
  — the "hold publication" exception's safe implementation path (above) no
  longer depends on any unresolved Vercel configuration question; it only
  requires WU046 to sequence promotion/push/PR *after* a second explicit
  approval signal when that exception is invoked, which is achievable with
  tooling already available (§6). If the owner prefers to avoid even this
  bounded complexity, Option 1 (explicitly documented as the accepted
  model) remains an acceptable fallback over Option 3's permanent added
  friction, given this is a launch-scoped milestone rather than a general
  governance redesign.
- **Consequence for WU045–WU048:** Option 2/3 requires WU046 to model two
  distinct decision outcomes instead of one, and — if Option 2's exception
  path is approved — to implement the private-hold sequencing above; WU048
  must then include an adversarial case verifying that "approve
  integration, hold publication" actually prevents any push/PR/Preview
  exposure (this is a natural extension of WU048's existing case 7 in §14,
  "privacy-sensitive/non-public material blocked," applied to a
  publication-held-but-integration-approved package rather than a
  privacy-sensitive one). Option 1 simplifies WU046 to one decision but
  requires WU047 to document (not silently leave implicit) that Gate 1 and
  Gate 2 are currently the same mechanical event.
- **Consequence of deferring:** The current mechanical collapse (§8)
  continues exactly as it is today; this is not a new regression introduced
  by M013, but M013 would then be knowingly launching without resolving a
  documented semantic gap between `investigationstrategy.md` §3 and actual
  practice — the owner should decide this consciously rather than by
  default.
- **Required before implementation?** Yes — WU046's decision-recording
  interface depends on this answer. (The prior draft's dependency on
  WU047's Vercel-configuration audit is now resolved per §8's corrected
  VERIFIED_EXTERNAL facts and no longer blocks this decision.)

**Invalid decision-state combinations (added by independent-review finding
MEDIUM-4/§0a's related HIGH-1 remediation; makes OD-D's existing
combined-by-default model's state semantics explicit — does not reopen or
change which option was approved):**

| `canonicalAcceptance` | `publicExplorerPublication` | Validity | Consequence |
|---|---|---|---|
| APPROVE | APPROVE | Valid | Promotion/publication path allowed (the normal-path `APPROVE_CANONICAL_AND_PUBLIC` convenience action, §12) |
| APPROVE | HOLD | Valid | Private hold: no promotion, no Git publication, per OD-D's binding exceptional-sequence rule above |
| APPROVE | REJECT | Valid | No public publication; retain/dispose the private package per this contract (WU046 implements disposition, §12) |
| HOLD | (any) | Valid only with no `publicExplorerPublication = APPROVE` recorded | No public APPROVE may be recorded while canonical is HOLD |
| REJECT | (any) | Valid only with no `publicExplorerPublication = APPROVE` recorded | No public APPROVE may be recorded while canonical is REJECT |
| HOLD | APPROVE | **INVALID** | Public-publication approval is not actionable until `canonicalAcceptance = APPROVED` |
| REJECT | APPROVE | **INVALID** | Same as above |

The interface/orchestrator (WU046, §12) must reject invalid combinations
outright rather than silently normalize, coerce, or reinterpret them. This
does not change OD-D's combined-by-default owner-approved model (§9 above
remains binding); it only makes explicit which state combinations that
model may ever record.

### OD-E: Bounded automated post-approval path — **OWNER_APPROVED: Option 1 (automate deterministic mechanics through `READY_FOR_OWNER_MERGE`; PR merge remains manual and owner-only)**

**Owner decision record:** APPROVED, Option 1. **Date/context:** M013/
WU044, PKT-045, this consolidation pass. **Rationale (owner-stated):**
after explicit approval, automate deterministic mechanics through
`READY_FOR_OWNER_MERGE` — including, where contractually approved, exact
package/base-SHA verification, canonical promotion, validation, Explorer/
read-model build, branch, commit, push, PR, and CI observation — and stop
there; PR merge remains manual and owner-only, with no exception. **Binding
consequence for WU045–WU048:** WU046 (§12) is frozen to automate exactly
promotion → validation → branch → commit → push → PR → CI-observation,
terminating at `READY_FOR_OWNER_MERGE`, with no code path, flag, or
configuration that merges, auto-merges, or approves-and-merges the PR;
WU048 (§14, case 2) must confirm the full chain reaches
`READY_FOR_OWNER_MERGE` and that no path reaches actual merge
automatically. **Rejected alternatives:** Option 2 (narrower — automate
only through canonical promotion + validation, leave branch/commit/push/PR
manual) — rejected as leaving already-classified
MECHANICAL_AND_AUTOMATABLE toil (§5) in place with no governance reason to
retain it. Option 3 (broader — auto-merge once CI passes) — rejected
outright as foreclosed by this milestone's own acceptance criteria
("automatic owner merges = 0") and by `AGENTS.md`'s Git-and-handoff
section; not a live option under any circumstance.

- **Exact question:** Should WU046 implement the bounded automated path
  from an approved research package through canonical promotion,
  validation, branch creation, commit, push, PR creation, and CI
  observation, up to `READY_FOR_OWNER_MERGE` — with owner PR merge remaining
  permanently manual and outside automation — exactly as WU046's own
  canonical scope already states?
- **Factual current-state evidence:** Every building block this path needs
  already exists and is reusable (§6): `canonical-promoter.ts` (promotion),
  `research:validate`/`research:check` (validation), and standard Git/GitHub
  CLI operations (branch/commit/push/PR — currently manual, §4 stage 27).
  `validation.yml` already runs automatically on the resulting PR with no
  changes needed. No PR-merge automation exists anywhere in the repository,
  and none is proposed by this option.
- **Viable options:**
  1. Approved as WU046's canonical scope already states — automate up to PR
     creation/CI-observation, never merge.
  2. Narrower: automate only up through canonical promotion + validation,
     leaving branch/commit/push/PR creation manual.
  3. Broader: also attempt to auto-merge once CI passes — **this option is
     explicitly foreclosed by the WU044 packet's own acceptance criteria**
     ("automatic owner merges = 0") and by AGENTS.md's "Git and handoff"
     section; it is listed only to be explicitly rejected, not as a live
     option.
- **Trade-offs:** Option 1 delivers the full mechanical-touch reduction
  identified in §5's post-approval baseline (collapsing steps 2–6 into one
  deterministic execution) while preserving the two permanently-human
  touches (Gate 1 decision, PR merge); Option 2 is a smaller, lower-risk
  first increment but leaves branch/commit/push/PR as manual mechanical
  toil that §5 already classifies as MECHANICAL_AND_AUTOMATABLE, not
  GOVERNANCE_REQUIRED — i.e., Option 2 would leave eliminable friction in
  place without a governance reason to do so; Option 3 is not viable under
  this milestone's own binding acceptance criteria.
- **Recommendation:** Option 1, exactly as WU046's canonical scope already
  specifies. Nothing found during this reconciliation suggests a reason to
  narrow it to Option 2 — every building block Option 1 needs already
  exists and is already proven safe (`canonical-promoter.ts`'s defensive
  engineering, §6).
- **Consequence for WU045–WU048:** Confirms WU046's file/behavior boundary
  as specified in §12 below; WU048 must verify the full chain through
  `READY_FOR_OWNER_MERGE` and confirm no path reaches actual merge
  automatically.
- **Consequence of deferring:** Falls back to Option 2's narrower scope by
  default, leaving branch/commit/push/PR as manual steps with no governance
  reason for that manual requirement — a strictly worse outcome than
  approving Option 1 for a launch-scoped milestone whose own stated target
  is "normal pre-Gate mechanical handoffs = 0" (the post-Gate equivalent
  target is implied by the same principle).
- **Required before implementation?** Yes — defines WU046's exact upper
  boundary (§13).

---

## 10. Go-live gap analysis

**Correction note (overseer pass, first correction):** this section was
fully recomputed against the corrected §8 facts. The false "no branch
protection" finding was removed; the Git→Vercel production/Preview
mapping, repository visibility, and absence of a custom domain were
recorded as VERIFIED_EXTERNAL rather than unknown; and only the two
genuinely narrow remaining unknowns (§8) were carried as
UNVERIFIED_EXTERNAL. Findings are not forced into P1 merely because they
were previously unknown — each item below is classified on its own
corrected evidence.

**Correction note (overseer pass, second correction):** the absence of a
custom domain is reclassified from **P3 to P2**. Reason: it does not
technically prevent launch (the confirmed `*.vercel.app` addresses are
fully functional, HTTPS-served, and reachable), but it materially affects
public identity, trust, stable long-term linking, and social-sharing
presentation for a public civic-research project — properties that matter
more than a purely cosmetic P3 item (favicon, overflow) but that the owner
may still consciously accept and defer for a soft launch rather than treat
as launch-blocking. This is a severity reclassification only; the
underlying fact (no custom domain configured) is unchanged, and no other
item's severity is altered except as the mathematical consequence of this
one change (the P2 and P3 counts below).

| Area | Item | Classification | Severity | Evidence |
|---|---|---|---|---|
| Production | GitHub branch protection on `main` | **NO_CHANGE** | — | **Corrected.** An active Repository Ruleset ("Protect main") enforces deletion protection, non-fast-forward protection, a required PR with 1 approving review, stale-review dismissal, required review-thread resolution, and a required `validation` status check; bypass is restricted to `pull_requests_only` even for the owner role (§8). No remediation needed. |
| Production | Git→Vercel production/Preview mapping | **NO_CHANGE** | — | **Corrected — now VERIFIED_EXTERNAL (§8):** `main` merge → Production; any PR/non-`main` branch → Preview, automatically. This is exactly the mapping WU046's orchestration (§12) and OD-D (§9) can safely design against; no further confirmation is needed for this specific question. |
| Production | Deployment Protection policy / manual-promotion requirement | **OWNER_DECISION_REQUIRED** (narrow evidence gap) | **P2** | Still `UNVERIFIED_EXTERNAL` (§8, item 1) — whether Vercel additionally requires manual promotion beyond the confirmed auto-deploy-on-merge behavior. Downgraded from the prior draft's P1 because the core question this item existed to answer (does merging to `main` reliably and automatically reach production) is now already confirmed YES (§8) — this remaining item only asks whether an *additional* protection layer exists on top of that, not whether any protection exists at all. |
| Production | Preview-deployment access control beyond default visibility | **OWNER_DECISION_REQUIRED** (narrow evidence gap) | **P2** | Still `UNVERIFIED_EXTERNAL` (§8, item 2). Relevant chiefly to WU045/WU046's pre-Gate publication boundary (§8) — if Preview deployments carry no additional access control, the strengthened publication-boundary rule in §8 (never push pre-Gate material to any branch) is the operative safeguard regardless of this item's answer, which is why this is P2 rather than P1: the mitigating control (never push unapproved material) does not depend on this item's resolution. |
| Production | Rollback / reproducible build | **NO_CHANGE** | — | `vercel.json`'s `buildCommand`/`installCommand`/`outputDirectory` are simple, deterministic, and re-run full canonical validation on every build (`explorer:build` → `build-data.js` → `validateResearchTree()`); a bad canonical state fails the build rather than deploying invalid data. |
| Production | Secrets exposure | **NO_CHANGE** | — | No `.env` files, credentials, or secret-shaped values found tracked in the repository; `.gitignore` excludes `.env`/`.env.*`. |
| Production | Recent runtime errors | **NO_CHANGE** | — | VERIFIED_EXTERNAL (§8): no runtime errors found in the selected 7-day range. |
| Public web | Favicon 404 | **DEFER** (re-evaluated as launch-readiness only, per WU044 instruction not to reopen AR-05) | **P3** | Confirmed still present per AR-05's own findings (§7, AR-05 contract) — cosmetic, non-blocking, does not affect data integrity or safety. |
| Public web | 9px `.explorer-navigation` overflow at 360px | **DEFER** (re-evaluated as launch-readiness only) | **P3** | Same AR-05 finding; a pre-existing, bounded, cosmetic responsive delta, not reopened here. |
| Public web | Custom domain | **OWNER_DECISION_REQUIRED** (product decision, not a defect; may be explicitly accepted/deferred for soft launch) | **P2** (reclassified from P3, second correction) | **Corrected — now VERIFIED_EXTERNAL (§8):** no custom domain is configured; the project currently serves only from `*.vercel.app` addresses. Not a technical launch blocker — the confirmed domains are fully functional and HTTPS-served (see the HTTPS/canonical-URL row below) — but material to public identity, trust, stable linking, and social sharing for a public civic-research project, which is why it is scored P2 rather than P3. The owner may explicitly accept this as a soft-launch risk without it becoming a P0/P1 blocker. |
| Public web | HTTPS / canonical URL | **NO_CHANGE** | — | Vercel's `*.vercel.app` domains serve HTTPS by default; no repository-level or Vercel-level gap identified for this specific sub-item once the domain question above is resolved by the owner. |
| Public web | OpenGraph/social preview metadata | **UNVERIFIED — not inspected in depth this cycle** | **P2** (provisional) | Not exhaustively audited under WU044's read-only reconciliation scope; recommend WU047 perform the full audit named in its own canonical scope. |
| Public web | robots.txt / sitemap | **UNVERIFIED — not inspected in depth this cycle** | **P2** (provisional) | Same — recommend WU047's own audit rather than a partial finding here. |
| Quality | CI validate+build coverage | **NO_CHANGE** | — | `validation.yml` already runs `research:check` + `explorer:build` on every PR and push to `main`, and is now also a required status check under the active ruleset (§8) — stronger than the prior draft's characterization of CI as advisory-only. |
| Quality | Accessibility / responsive / browser compatibility | **DEFER to WU047's own audit** | **P2** (provisional) | AR-05 already exercised representative accessibility/responsive checks for the discovery/provenance surfaces specifically (§5–§7, AR-05 contract); a full site-wide audit is WU047's explicit named scope, not duplicated here. |
| Trust | About/methodology/correction-route/contact/independence/privacy pages | **UNVERIFIED — not inspected in depth this cycle** | **P2** (provisional, downgraded from the prior draft's "P1/P2") | Not exhaustively enumerated under WU044's scope; flagged as WU047's explicit named responsibility. Scored P2 rather than P1 here specifically because this contract has not confirmed absence (only non-inspection) — per this section's own instruction not to force findings into a higher severity merely because they are currently unverified; WU047 must confirm presence/absence directly and may re-classify to P1 if genuinely absent. |

**Corrected P0/P1/P2/P3 counts (second correction: custom domain moved
P3→P2):**

| Severity | Count | Items |
|---|---|---|
| **P0** | **0** | none |
| **P1** | **0** | none confirmed this pass — the original draft's two P1 findings (branch protection; Vercel/domain configuration) are both resolved: branch protection is confirmed active (NO_CHANGE), and the Git→Vercel mapping/domain facts are confirmed rather than unknown |
| **P2** | **7** (provisional; +1 from the prior correction pass's 6, due solely to the custom-domain reclassification) | Deployment Protection policy (narrow evidence gap); Preview access-control beyond default (narrow evidence gap); OpenGraph/social metadata (unaudited); robots.txt/sitemap (unaudited); accessibility/responsive/browser compatibility site-wide (deferred to WU047); trust-surface presence (unaudited, provisionally scored down from P1); **absence of a custom domain (reclassified from P3 this pass — a real public-identity/trust/linking/sharing concern, explicitly owner-deferrable for a soft launch, not a technical blocker)** |
| **P3** | **2** (−1 from the prior correction pass's 3, due solely to the custom-domain reclassification) | favicon 404 (AR-05, deferred); 9px overflow (AR-05, deferred) |

**Proof this reclassification is purely a severity move, not a new
finding:** the total number of distinct findings is unchanged (still the
same set of items as the prior correction pass); only the custom-domain
item's severity label moved from P3 to P2, which mechanically moves the P2
count from 6 to 7 and the P3 count from 3 to 2. No other item's severity
was changed as part of this pass.

**This remains a genuine improvement over the original draft's provisional
P0=0/P1=2+/P2=up to 4/P3=2 counts, driven by corrected evidence, not by
loosened standards:** the two P1 findings were both artifacts of incomplete
verification (checking the wrong branch-protection API; not yet having
owner-supplied Vercel facts), not of an actual production gap. With that
evidence corrected, **zero P0 and zero P1 launch blockers are identified by
this reconciliation.** The remaining P2/P3 items are narrow, already-
mitigated evidence gaps (Deployment Protection specifics, Preview access
control beyond the default), a genuine but explicitly owner-deferrable
public-identity concern (custom domain, now P2), or genuinely unaudited
areas properly deferred to WU047's own named scope (metadata,
robots.txt/sitemap, accessibility, trust pages) — none of which this
reconciliation manufactures into a higher severity than the evidence
supports, and none of which are P0/P1 launch blockers.

**Repository-verifiable vs. externally-verified vs. UNVERIFIED_EXTERNAL,
summarized (corrected):**
- Repository-verifiable facts used above: active branch-protection ruleset
  contents (via GitHub Rulesets API), repository visibility (via `gh repo
  view`), `.gitignore`/workbench-boundary enforcement, CI workflow contents
  (including its role as a required status check), `vercel.json` contents,
  absence of tracked secrets, AR-05's already-documented favicon/overflow
  findings.
- VERIFIED_EXTERNAL facts (owner-supplied, §8): Vercel project identity;
  Git-integration production/Preview mapping; current production
  deployment's exact Git ref/SHA/state; project domains and absence of a
  custom domain; 7-day runtime-error query result.
- Remaining UNVERIFIED_EXTERNAL (§8): Deployment Protection policy
  specifics; Preview-deployment access control beyond default visibility.
  Both are P2, not P1, because each has an independent, already-confirmed
  mitigating control (the active branch-protection ruleset for the former;
  the strengthened never-push-pre-Gate-material publication boundary for
  the latter) that does not depend on either item's resolution.

---

## 11. Exact proposed WU045 boundary

**Title (unchanged from canonical definition):** Automated Research
Preparation.

**Frozen status:** this boundary is now implementation-grade, using
OD-A/OD-B/OD-C exactly as `OWNER_APPROVED` in §9. **WU044 does not implement
this boundary; it freezes it for WU045.**

**Objective:** implement only the owner-approved boundary below — moving
from an explicit research trigger to an approval-ready, non-canonical
Research Change Set (per OD-C, Option 3, JSON source of truth + generated
Markdown view) ready for WU046's Human Gate, with zero human semantic
interventions on the normal path before that gate.

**Exact orchestration boundary:**
- One new local/operator-triggered entry point (per OD-A) — e.g. a
  `tools/research/orchestrate/cli.ts` (exact path TBD by the implementer,
  but must live under `tools/research/` alongside its siblings, not inside
  `.research-workbench/` — the orchestrator is reusable tooling, not
  per-cycle scratch material) — that a human runs once per cycle, supplying
  at minimum: which prompt/mode to use (daily-discovery vs. problem-refresh)
  and, for problem-refresh, the target `PRB-*` ID.
- The orchestrator's job is to **sequence and structurally validate**, not
  to perform discovery/authoring itself: it hands off to the AI-assisted
  steps (discovery, extraction, candidate authoring, independent review —
  all remain AI/human judgement, per §4) and then mechanically drives the
  already-existing deterministic chain (`candidate-delta.ts` →
  `prospective-validation.ts` → `canonical-integration-review.ts` →
  `canonical-integration-plan.ts`) against whatever candidate files the
  AI-assisted steps produced.

**Exact reuse of existing primitives:** every module listed in §6 must be
imported and called, not reimplemented. WU045 must not introduce a second
delta-classification, validation-overlay, or readiness-evaluation
implementation.

**Structured AI output contracts (per OD-B, Option 2, `OWNER_APPROVED`):**
WU045 must define and validate, at minimum: (a) a per-cycle manifest
(investigation question, candidate file paths, claimed record IDs,
free-text rationale) and (b) a distinct, structurally-required (non-empty),
separately-produced independent-review output satisfying OD-B's five-point
minimum bar (§9) — a separate invocation/role; consuming the immutable
candidate/RCS artifact without ability to revise it; a structured outcome
field (`CONCUR` / `DISAGREEMENT_FOUND` / `INSUFFICIENT_EVIDENCE`) plus
rationale; deterministic schema validation of that result; and the primary
authoring pass's own self-assessment never satisfying this requirement —
before the candidate set is considered ready to enter the deterministic
chain above.

**Deterministic validation boundary:** WU045 owns invoking
`prospective-validation.ts`/`readiness.ts` and surfacing their structured
results; WU045 must not add new validation logic that duplicates or
diverges from `tools/research/validation/validate.ts`'s existing rules.

**Local/non-public candidate storage:** all candidate material and
intermediate orchestration state must remain under a gitignored path (either
continuing to use `.research-workbench/` or an equivalent gitignored
location) — WU045 must not weaken or bypass the existing
`workbench-boundary.test.ts` guarantee, and the new directory convention
OD-C's Research Change Set artifact (§9) introduces must also be added to
`.gitignore` and covered by an equivalent boundary test.
Per §8's strengthened publication boundary, WU045 must never commit, push,
or include this material in a branch/PR — the gitignored local boundary is
the entire safeguard, and it must hold before any Git operation, not only
before a merge to `main`.

**Zero normal-path human pre-Gate handoffs:** per §5's target, after WU045
the only remaining human/AI-judgement touches on the normal path are the
initial trigger decision, the discovery/authoring work itself, and reading
the assembled package before deciding (which is WU046's Gate 1, not a
WU045 pre-Gate handoff) — every purely mechanical step in between (existing
candidate-delta invocation, review/plan preparation, manifest/independent-review
presence checks) must require no manual re-invocation.

**Failure/idempotency behaviour:** WU045 must fail closed — if any
structural check (manifest shape, independent-review presence, prospective
validation, readiness) fails, the orchestrator must stop and report exactly
which check failed, producing no partial "looks ready" package. Re-running
the orchestrator against the same candidate directory must be idempotent
(same input → same `CanonicalIntegrationReview`/`CanonicalIntegrationPlan`
output, consistent with `canonical-integration-plan.ts`'s existing
determinism).

**No canonical/public writes:** WU045 must not call
`applyCanonicalIntegrationPlan()` or write anything under `research/`. Its
output is exactly a `READY_FOR_HUMAN_REVIEW` package (or an explicit
failure), never a canonical mutation. This is WU046's exclusive
responsibility (§12).

**Explicit files/areas WU045 may touch:** new files under `tools/research/`
(a new orchestration module/CLI and its tests, following the existing
`tools/research/*/cli.ts` pattern) and, per OD-C (Option 3, `OWNER_APPROVED`),
a new gitignored non-canonical artifact location plus its `.gitignore` entry
and boundary test. **WU045 must not modify:** any file under `research/**`, any
`research/schemas/*.json`, any existing file under
`tools/research/{core,integration,readiness,validation}/` (reuse only, per
§6), any `apps/research-explorer/**` file, `.github/workflows/**`,
`vercel.json`, `.aiqt/**`.

### DEP-041 dependency

Per `.aiqt/state.json`, WU045 depends on `DEP-041` (WU044's own completion
and owner approval of this contract). OD-A/OD-B/OD-C are now `OWNER_APPROVED`
(§9), so this contract's decision dependency for WU045 is satisfied; per
the M013_WU044_INDEPENDENT_CONTRACT_REVIEW gate (§18a), WU045 additionally
may not start until the independent Claude Code architecture/governance
review has run, its findings are resolved, and the owner has explicitly
authorized WU045.

---

## 12. Exact proposed WU046 boundary

**Title (unchanged):** Human Gate & Post-Approval Orchestration.

**Frozen status:** this boundary is now implementation-grade, using
OD-D/OD-E exactly as `OWNER_APPROVED` in §9. **WU044 does not implement
this boundary; it freezes it for WU046.**

**Research Change Set / review-package semantics:** implement OD-C's
approved option (§9, Option 3) — assembling WU045's `CanonicalIntegrationReview`
output plus the narrative/independent-review/risk layer into one coherent,
inspectable artifact: a structured JSON source of truth plus a generated,
rendered human-readable Markdown view (never hand-authored). Must expose every element WU046's own
canonical scope names: investigation question, candidate records,
CREATE/UPDATE/NO_CHANGE deltas, exact provenance, claim scope, inference
limits, affected existing PRBs, contradiction analysis, duplicate/overlap
analysis, prospective validation result, readiness result, independent AI
review, exact canonical Git base SHA, exact integration plan, expected
Explorer/public effect, risks/unresolved uncertainties, and a clearly
non-authoritative recommendation (must be visually/structurally
distinguished from the human decision itself — never presented as if it
were the decision).

**Immutable/base-SHA binding:** the review package must bind to the exact
`baseGitSha` `canonical-integration-review.ts` already captures; WU046 must
re-verify (not merely trust) that this SHA still equals current `HEAD`
immediately before any promotion attempt — reusing exactly the check
`canonical-promoter.ts`'s `assertCanonicalRepositoryState` already performs
(§6), not a second, parallel implementation of the same check.

**APPROVE / REJECT / HOLD-MORE_RESEARCH behaviour:** the human decision
interface must support at least these three outcomes. REJECT and
HOLD-MORE_RESEARCH must both terminate the normal path without any
canonical write, leaving the candidate material in place for revision or
disposal. APPROVE is governed by the exact binding protocol below.

**RCS identity and approval/content-hash binding (added by independent-
review finding HIGH-2, §0a; replaces the prior non-binding "e.g. compute/
store a hash" language; resolves the former §18 approval-transcription
question as `RESOLVED_BY_REVIEW`):**

RCS identity must include, at minimum:
- `packageId`;
- `schemaVersion`;
- `baseGitSha`;
- `contentHash`.

`contentHash` is defined as: **SHA-256 over the deterministic canonical
serialization of the validated RCS JSON** (the JSON source of truth per
OD-C, §9 — never the generated Markdown; the rendered Markdown is a
presentation view derived from the JSON and is never the hashed source of
truth). Canonical serialization must be:
- UTF-8;
- deterministic object-key ordering;
- array order preserved as authored;
- no insignificant whitespace;
such that the same logical validated RCS always yields the same bytes and
therefore the same hash.

The approval flow must be exactly:
1. validate the RCS JSON;
2. canonicalize the JSON deterministically;
3. compute the full `contentHash`;
4. generate the Markdown human-review view from that same validated,
   in-memory RCS object (never from a re-read or re-derived copy);
5. present the generated human-review view to the owner;
6. display `packageId` plus a human-visible short hash/fingerprint
   alongside the rendered view;
7. on decision submission, re-read the JSON source of truth from disk;
8. revalidate it;
9. recompute the full `contentHash`;
10. compare the recomputed hash against the hash of the package that was
    shown for review;
11. if the comparison mismatches: **abort**, **invalidate the review
    session**, and require a regenerated review package and a new human
    decision — do not proceed under any circumstance;
12. if the comparison matches: persist a decision record bound to
    `packageId`, the full `contentHash`, `baseGitSha`, the acting actor,
    a timestamp, `canonicalAcceptance`, and `publicExplorerPublication`.

The owner does not need to manually compare cryptographic hashes — the
system enforces the binding (steps 7–11 above). The short hash displayed
in step 6 is for package identity/auditability only; it is never the
mechanism that enforces the binding. No APPROVE decision may bind to a
different RCS version than the one actually rendered for the owner in step
5. This protocol directly replaces today's `promote-approved-*.ts`
hardcoded-constants pattern (§4 stage 24, §7 gap 5) and closes gap 5 (§7)
exactly, not merely approximately.

**Gate 1 / public-publication audit semantics (per OD-D, Option 2,
`OWNER_APPROVED`):** WU046 must implement the combined-by-default,
separately-auditable interaction: the normal path exposes one convenience
action (`APPROVE_CANONICAL_AND_PUBLIC`) that records both
`canonicalAcceptance = APPROVED` and `publicExplorerPublication = APPROVED`
as two independently-recorded fields, never one undifferentiated flag; and
the decision interface must also support recording
`canonicalAcceptance = APPROVED` with `publicExplorerPublication = HOLD`
(or `REJECT`) as an explicit, distinct outcome, triggering the binding
private-hold sequencing specified in OD-D (§9): preserve the approved RCS
privately/non-canonically; do not promote; do not commit; do not push; do
not open a PR; do not trigger a Vercel Preview; wait for an explicit,
separate publication-approval signal; only then execute promoter → Git →
PR through `READY_FOR_OWNER_MERGE`.

**Deterministic post-approval promotion:** upon APPROVE, invoke
`applyCanonicalIntegrationPlan()` exactly as it exists today (§6) — no
modification to its safety invariants (exact-HEAD-match, clean-tree,
staged dry-run, atomic writes, rollback, byte-exact verification).

**Branch/commit/push/PR/CI boundary (per OD-E, §9):** after successful
promotion and its internal post-write validation, WU046 must: create a
bounded branch, commit the canonical changes, push, open a PR, and
observe CI (`validation.yml`) — using standard Git/GitHub CLI operations,
reusing the exact same `research:check`/`explorer:build` commands CI itself
runs as a pre-push self-check (fail closed before even opening a PR if
these fail locally). Must return exactly `READY_FOR_OWNER_MERGE` as its
terminal state.

**Deterministic publication guard (added by independent-review finding
LOW-3/workbench defense-in-depth recommendation, §0a: `ACCEPT_GOAL /
MODIFY_IMPLEMENTATION`):** the reviewer's defense-in-depth goal is
accepted; a local Git pre-commit hook is explicitly **not** adopted as the
primary control, since a hook is bypassable (`--no-verify`), local-only,
and not guaranteed to run in every execution environment. Instead, WU046
must implement a deterministic publication guard **at the Git-publication
boundary itself**, immediately before commit/push/PR, that:
- inspects tracked/staged paths;
- asserts `.research-workbench/**` (and any equivalent gitignored
  candidate/RCS location introduced by WU045/WU046) is absent from what is
  staged/tracked;
- asserts no noncanonical candidate, RCS, or review artifact is staged;
- asserts no path outside the exact approved publication set (the exact
  byte-literal write operations already captured in the approved
  `CanonicalIntegrationPlan`, per §6) is included;
- fails closed on any unexpected staged/tracked content, aborting the
  publication sequence before any commit/push/PR occurs.

This guard is **additional to**, not a replacement for: `.gitignore`; the
existing `workbench-boundary.test.ts` regression test; and the zero-push
pre-Gate architecture already described in §8. WU048's leakage-adversarial
tests (§14, cases 7 and 16) must exercise this guard directly. A local
Git pre-commit hook may still be adopted as optional additional
defense-in-depth, but the contract does not require one and governance
correctness must not depend on one. This resolves the former §18
workbench-defense question as `RESOLVED_BY_REVIEW`.

**NEVER merge PR automatically:** WU046 must contain no code path,
flag, or configuration that merges, auto-merges, or approves-and-merges the
PR it creates. This is a hard, non-negotiable boundary per the WU044
packet's own acceptance criteria and AGENTS.md.

**Explicit files/areas WU046 may touch:** new files under
`tools/research/` (a Gate 1/orchestration module and its tests, reusing
`canonical-promoter.ts`/`canonical-integration-plan.ts` per §6) and, per
OD-C (Option 3, `OWNER_APPROVED`), a small markdown-rendering module. **WU046
must not modify:** `canonical-promoter.ts`'s or
`canonical-integration-plan.ts`'s existing safety logic (extend via
composition, not by editing their internals), `research/**`,
`research/schemas/*.json`, `apps/research-explorer/**` (except where
WU046's own build-and-validate pre-push self-check invokes
`npm run explorer:build` as an external command, not a source change),
`.github/workflows/validation.yml` (unless a specific, minimal, explicitly
owner-approved CI addition is separately authorized — not assumed here),
`.aiqt/**`.

### DEP-043 dependency

Per `.aiqt/state.json`, WU046 depends on `DEP-043`. (WU044 does not modify
dependency wiring; this is recorded for completeness only.)

---

## 13. Exact proposed WU047 boundary

**Title (unchanged):** Production Launch Hardening.

**Exact P0/P1 launch blockers (per §10's corrected findings):** **zero**
confirmed P0 or P1 items exist as of this reconciliation (§10). The prior
draft's two proposed P1 remediation items are withdrawn:
- GitHub branch protection on `main` is **already active** (§8, §10,
  NO_CHANGE) — WU047 has no remediation task here; at most WU047 may
  *review* whether the existing ruleset's specific parameters (1 required
  approval, the `validation` status check) remain adequate as the project
  scales, but this is confirmation, not a P1 fix.
- The Vercel Git→Vercel production/Preview mapping and domain facts are
  now VERIFIED_EXTERNAL (§8, §10, NO_CHANGE/owner-decision-as-product-choice
  respectively) — no P1 remediation task exists here either.

**Exact P2 items WU047 must resolve or explicitly accept (per §10,
corrected — 7 items following the custom-domain reclassification):**
1. Obtain and record the Deployment Protection policy specifics
   (`UNVERIFIED_EXTERNAL`, §8 item 1) — confirm whether any additional
   manual-promotion gate exists beyond the already-confirmed
   auto-deploy-on-merge behavior, and document the finding either way.
2. Obtain and record Preview-deployment access-control specifics
   (`UNVERIFIED_EXTERNAL`, §8 item 2) — confirm whether Preview URLs carry
   any access control beyond default visibility, and document the finding;
   note that WU045/WU046's never-push-pre-Gate-material rule (§8) already
   mitigates this regardless of the answer.
3. Perform the full public-web audit (OpenGraph/social metadata,
   robots.txt/sitemap) named in WU047's own canonical scope — not
   exhaustively performed by this read-only reconciliation.
4. Perform the full trust-surface audit (About/methodology/correction-route/
   contact/independence/privacy) named in WU047's own canonical scope —
   classify findings using the same P0–P3 rubric defined in the WU044
   packet; do not assume absence, confirm it directly (§10).
5. Perform the full accessibility/responsive/browser-compatibility audit
   named in WU047's own canonical scope, building on (not duplicating)
   AR-05's already-completed discovery/provenance-surface checks.
6. **Present the custom-domain question to the owner as an explicit P2
   decision (§10, reclassified from P3 this pass):** either configure a
   custom domain before public launch, or obtain an explicit owner
   acceptance to launch on the confirmed `*.vercel.app` addresses for a
   soft launch, with the decision and its rationale recorded. WU047 must
   not silently default to either outcome — this is a product/branding
   decision for the owner, not a technical remediation WU047 performs
   unilaterally.

**Production/public hardening only:** WU047 must not perform a broader
redesign, must not reopen AR-05 (its CR-1/CR-2/CR-3 and OD-1–OD-4 remain
exactly as closed, §1/§16, AR-05 contract), must not repair C008/C009/C010,
and must not touch any M010 DS-04B owner-frozen foundation value.

**Explicit files/areas WU047 may touch:** any public-facing static asset
requiring a genuinely minimal, targeted fix (e.g. adding a missing favicon
file, if the owner decides AR-05's already-known finding should finally be
fixed under WU047 rather than remaining deferred — this requires an
explicit owner decision at WU047 start, not an assumption by this
contract); any missing trust-page content the WU047 audit confirms is
absent; GitHub repository ruleset settings only if the owner separately
decides the existing "Protect main" ruleset's parameters need adjustment
(not a default WU047 task, since NO_CHANGE is the current finding).
**WU047 must not touch:** `apps/research-explorer/src/problem/**`,
`apps/research-explorer/src/records/**` beyond what a confirmed P0/P1
finding specifically requires, any `research/**` file, any DS-04B-frozen
foundation token.

### DEP-042 dependency

Per `.aiqt/state.json`, WU047 depends on `DEP-042`.

---

## 14. Exact proposed WU048 verification matrix summary

**Title (unchanged):** End-to-End Dry Run & Independent Go-Live
Verification.

WU048 remains verification-only — no remediation inside WU048; any defect
found must be reported back, not fixed in place (matching AR-05's own
WU043 precedent).

| # | Case | Expected safe outcome | Verifies |
|---|---|---|---|
| 1 | Normal end-to-end path, trigger → `READY_FOR_HUMAN_REVIEW` | Zero manual mechanical intervention required between trigger and package-ready | WU045's "zero normal-path human pre-Gate handoffs" acceptance criterion |
| 2 | Approved post-Gate path via a controlled dry-run/fixture | Reaches exactly `READY_FOR_OWNER_MERGE`; PR never merged | WU046's OD-E boundary (§12) |
| 3 | Duplicate source submitted again | `NO_CHANGE`; no unnecessary candidate proceeds | `candidate-delta.ts` (§6), already proven correct |
| 4 | Weak/thin source | `HOLD`/review required, not silent promotion | `readiness.ts` Eligibility/Corroboration structural checks (§4 stage 18) |
| 5 | Contradictory evidence present | Surfaced in the review package, never suppressed | OD-C's review-package contradiction-analysis field (§12) |
| 6 | Structurally invalid candidate | Blocked before reaching Gate 1 | `prospective-validation.ts` (§6) |
| 7 | Privacy-sensitive/non-public material present in a candidate | Blocked before any commit/push; never reaches `research/` or a public surface | AGENTS.md publication boundary + workbench-boundary test (§8) |
| 8 | Stale `baseGitSha` (HEAD has moved since review was prepared) | Blocked at promotion time | `canonical-promoter.ts`'s exact-HEAD-match precondition (§6), already proven correct; also the exact AIQT-HEAD-coupling friction case named in §3/§7 gap 7 |
| 9 | Source becomes unavailable/disappears mid-cycle | Surfaced, not silently ignored | WU045's AI-assisted currentness judgement (§4 stage 8) + OD-B's structured output contract |
| 10 | Weakly-supported candidate Problem | Not silently promoted; requires explicit human judgement | `readiness.ts` (§6) + Gate 1 (§12) |
| 11 | Independent review disagrees with primary authoring | Surfaced to the human, not auto-resolved | OD-B's `OWNER_APPROVED` Option 2 independent-review contract (§9, §11) — this case is now live (not N/A) and must be verified once WU045 implements the five-point-minimum-bar independent-review step; WU048 exercises a `DISAGREEMENT_FOUND` outcome and confirms it reaches the human decision interface (§12) without being auto-resolved |
| 12 | Deterministic validation failure at any stage | Blocked; no partial/silent pass-through | `validate.ts`/`prospective-validation.ts` (§6) |
| 13 | Promotion failure mid-write | Rollback restores prior canonical state exactly | `canonical-promoter.ts`'s rollback mechanism (§6), already proven correct at the library level — WU048 verifies it under WU046's actual orchestration, not just in isolation |
| 14 | Build failure after promotion | Blocked; does not reach CI green / does not reach `READY_FOR_OWNER_MERGE` | `explorer:build`'s fail-closed behaviour (§6) |
| 15 | PR/CI failure | Does not reach `READY_FOR_OWNER_MERGE` | `validation.yml` (§6) |
| 16 | Candidate-to-canonical/preview/production leakage attempt (adversarial) | No code path succeeds; only a deliberate human bypass (e.g. `git add -f`) could leak material, and that remains a human action outside tooling's power to prevent | §8's full pre-Gate leakage analysis + the WU046 deterministic publication guard (§12) |
| 17 | Production/public hardening verification | Matches WU047's actual delivered state (post-remediation), verified against the real built production artifact, not just staging/preview | WU047's boundary (§13) |
| 18 | `canonicalAcceptance = APPROVED` + `publicExplorerPublication = HOLD` (adversarial; added per independent-review finding HIGH-1, §0a) | Verify **all** of: the approved RCS remains private/noncanonical; the canonical promoter is **not** invoked; no canonical research file is written; no tracked candidate file appears; no Git commit containing candidate research occurs; no push occurs; no PR occurs; no Vercel Preview is created from candidate research; the package can later resume only after an explicit, separate `publicExplorerPublication` APPROVE; the resumed path remains bound to the same approved RCS/`contentHash`/`baseGitSha` unless staleness (§7 gap 7) forces a new review | OD-D's binding private-hold sequencing (§9) and its invalid decision-state rules (§9); this is a dedicated matrix row, not a cross-reference to case 7's generic leakage case |
| 19 | Malformed/incomplete structured AI output at the OD-B boundary (adversarial; added per independent-review finding MEDIUM-2, §0a) | **Fail closed before the candidate reaches canonical delta/promotion**, for at least one of: a malformed generation manifest; a missing required manifest field; an invalid candidate-envelope structure; a malformed independent-review result; a missing independent-review result; an invalid independent-review enum/schema value | OD-B's structured manifest and independent-review output contract (§9, §11); distinct from, and not satisfied by, case 6's existing canonical-record schema rejection |
| 20 | WU045 pre-Gate idempotent rerun (adversarial; added per independent-review finding MEDIUM-3, §0a) | Given an identical accepted trigger, identical source snapshots, identical canonical base, and identical validated structured outputs: re-running preparation does not create semantically duplicate RCS packages; produces deterministic identity/hash where inputs are identical (or explicitly documents any intentionally non-hashed timestamp/run metadata); does not create duplicate candidate records; does not alter canonical research; remains non-public | WU045's fail-closed/idempotency requirement (§7, §11) |
| 21 | WU046 partial post-approval failure and retry (adversarial; added per independent-review finding MEDIUM-3, §0a) | Exercise a failure after one or more Git orchestration steps (e.g. local branch created but push fails; push succeeded but PR creation fails; PR exists but CI observation fails). Retry must: detect existing state; resume safely or fail with an explicit operator-visible state; never create duplicate PRs; never create ambiguous duplicate branches; never re-promote a different RCS silently; preserve the approved `contentHash`/`baseGitSha` binding; never auto-merge | OD-E's bounded automated path (§9, §12); this is orchestration-level idempotency, not `canonical-promoter.ts`'s own rollback (case 13), which is verified separately |
| 22 | Allegation / reputationally sensitive / otherwise high-risk factual claim (adversarial; added per independent-review finding MEDIUM-4, §0a) | Verify: claim-scoped source authority; provenance/currentness requirements; inference limits; heightened contradiction/corroboration treatment as defined by existing research governance (`docs/investigationstrategy.md`); fail-closed behaviour when support is inadequate; an explicit HOLD/human-escalation path; no publication leakage | Existing research-governance claim-authority rules (`docs/investigationstrategy.md`) applied at the WU045/WU046 boundary; distinct from, and not satisfied by, case 4's generic weak-evidence case |

**Matrix count (rebuilt this pass per independent-review remediation,
§0a):** 2 normal-path cases (1–2) + 20 adversarial/failure cases (3–22) =
**22 total cases**, numbered 1–22 exactly once. No existing case (1–17)
duplicates the semantic purpose of any new case (18–22); each retains its
original semantic purpose unchanged.

**Terminal outcome mapping (added per independent-review remediation,
§0a; operationally defines the three outcomes already named in the WU044
packet's own specification — §15a restates this for the Go-Live Acceptance
Contract):**

- **`NOT_READY`:** one or more mandatory Go-Live Acceptance Contract
  criteria fail, including any of: an unresolved P0; an unresolved P1; the
  normal-path dry run fails; deterministic validation coverage < 100%;
  independent review coverage < 100%; pre-Gate leakage > 0; an automatic
  approval/publication/merge safety violation; a mandatory promotion/build/
  CI/rollback integrity test fails.
- **`READY_WITH_ACCEPTED_RISK`:** all mandatory criteria pass; no P0/P1
  remains; one or more P2 risks remain; every remaining P2 has an explicit
  owner acceptance/defer disposition.
- **`READY_FOR_GO_LIVE_GATE`:** all mandatory criteria pass; no P0/P1
  remains; no unaccepted P2 remains; only P3/observations or fully
  resolved findings remain.

**Neither `READY_WITH_ACCEPTED_RISK` nor `READY_FOR_GO_LIVE_GATE` means
GO.** Only the owner decides GO/HOLD; WU048 does not make that decision
itself — restated, not weakened, from the line below.

**Allowed WU048 outcomes:** `NOT_READY`, `READY_WITH_ACCEPTED_RISK`,
`READY_FOR_GO_LIVE_GATE` — exactly one, per the WU044 packet's own
specification. Only the owner decides GO/HOLD; WU048 does not make that
decision itself.

### DEP-044 / DEP-045 dependencies

Per `.aiqt/state.json`, WU048 depends on `DEP-044` and `DEP-045`.

---

## 15. Draft Go-Live Acceptance Contract

Reproducing and annotating the exact minimum criteria named in WU044's own
canonical acceptance criteria (`.aiqt/state.json`), with this contract's
current-state annotation against each, corrected against §8/§10's verified
facts and §5's corrected human-touch baseline.

**Normal-path definition (binding, restated from §5, not redefined here):**

```
accepted RESEARCH_TRIGGER
  -> automated research preparation (AI-performed discovery/authoring,
     orchestrated deterministic validation/readiness/review-package
     assembly — §4, §5, §11)
  -> READY_FOR_HUMAN_REVIEW
```

with **normal-path human handoffs before the Human Gate = 0** (§5's
corrected target — current baseline is 2, both already-scoped WU045/WU046
elimination targets, §5). **Exception paths** (genuine ambiguity,
insufficient evidence, sensitive material, unresolved contradiction) may
stop safely as `NEEDS_HUMAN_CLARIFICATION`/`HOLD` without this counting as
a normal-path automation failure or a violation of the zero-handoff target
(§5) — WU048 must verify this distinction holds in practice, not merely on
paper (§14). **The Human Gate itself remains mandatory** (§9 OD-D's
recommendation retains it as an explicit, non-bypassable human decision)
and **owner PR merge remains mandatory and manual** (§12's hard boundary,
reinforced by the active branch-protection ruleset's `pull_requests_only`
bypass restriction, §8) — neither is, or may be, optimized away by any
WU045/WU046 implementation.

| Criterion | Target | Current state (per this corrected reconciliation) |
|---|---|---|
| P0 | = 0 | **0 confirmed (§10)** |
| P1 | = 0 unless individually owner-accepted | **0 confirmed (§10)** — the original draft's 2 P1 findings (branch protection; Vercel/domain configuration) are both resolved by corrected evidence, not remediation: branch protection is confirmed already active, and the Vercel Git-trigger/domain facts are confirmed rather than unknown. Remaining items are P2/P3 (§10). |
| Normal-path human handoffs before Human Gate | = 0 | **Current baseline = 2** (§5, corrected this pass): hand-writing the per-cycle orchestration script, and hand-authoring the review-package document — both already-named CURRENT_TOOLING_GAP items (§7 gaps 1 and 4) and WU045/WU046's explicit elimination targets. Not yet 0; requires WU045/WU046. |
| Exception-path human intervention | permitted, tracked separately, does not count against the normal-path target | Confirmed treated separately in §5 and §14 (WU048 cases 4/5/9/10/11); an exception-path stop is a sanctioned safe outcome, never scored as a normal-path failure. |
| Human Gate | mandatory, non-bypassable | Confirmed retained as a mandatory human decision in every OD-D option under consideration (§9) — no option removes it. |
| Owner PR merge | mandatory, manual, never automated | Confirmed as a hard boundary in §12 and independently reinforced by the active branch-protection ruleset's owner-role bypass restriction to `pull_requests_only` (§8) — no path in this contract optimizes it away. |
| Dry run | PASS | Not yet run — requires WU045/WU046 to exist first (WU048 scope) |
| Pre-Gate leakage | = 0 | 0 confirmed by this reconciliation today (§8, strengthened with the public-repository/Preview-deployment publication-boundary rule) — WU048 must re-confirm this holds after WU045/WU046 are implemented |
| Deterministic validation coverage | 100% | Already 100% for structural validation of canonical records today (§4, §6); WU045's new AI-output manifest also needs 100% structural validation coverage once implemented |
| Independent review coverage | 100% | **0% today (§4 stage 19, §7 gap 3) — the single largest gap between current state and this acceptance criterion; directly depends on OD-B's resolution (§9), with a strengthened five-point minimum bar for what "independent" must mean (§9)** |
| Automatic canonical approvals | = 0 | 0 confirmed today (§8) — no code path auto-approves; must remain 0 after WU046 (§12's explicit non-goal) |
| Automatic owner merges | = 0 | 0 confirmed today — no merge automation exists; must remain 0 after WU046 (§12's hard boundary), further reinforced by the active branch-protection ruleset's `pull_requests_only` bypass restriction (§8) |
| Automatic public publication without approval | = 0 | 0 today under the current manual-PR-merge model. The current topology mechanically collapses Gate 1 and Gate 2 (§8) for the `APPROVE_CANONICAL_AND_PUBLIC` convenience path; per OD-D (`OWNER_APPROVED` Option 2, §9), the two decisions remain independently recorded, and the binding private-hold sequencing (canonical APPROVE + publication HOLD → no push/PR/Preview until explicit publication approval) is now a required WU046 behaviour, not a contingent option |
| Production build/deployment | PASS | `explorer:build` passes deterministically when canonical data is valid (§4 stage 29); the Git→Vercel production-deployment path is VERIFIED_EXTERNAL and confirmed `READY` at the M013 baseline SHA (§8, §10) — only the narrow Deployment Protection specifics remain unverified (§8) |
| Rollback/recovery | PASS | `canonical-promoter.ts`'s rollback is proven correct at the library level (§6); Vercel-level rollback remains a reasonable platform assumption, not independently exercised this pass |
| Accessibility/public-quality | PASS | AR-05 already verified this for discovery/provenance surfaces specifically (§10); full site-wide verification is WU047's scope |
| Public trust requirements | PASS | Not yet audited in depth this cycle (§10) — WU047's scope |
| Custom domain | may be an explicitly owner-accepted P2 risk for a soft launch; not automatically P0/P1 | **P2, reclassified this pass (§10)** — no custom domain is configured (VERIFIED_EXTERNAL, §8); this is a public-identity/trust/linking/sharing concern the owner may consciously accept and defer, not a technical blocker. WU047 must present this as an explicit decision (§13), not default silently to either outcome. |
| WU048 matrix execution (added per independent-review remediation, §0a) | 22/22 cases executed | Not yet run — requires WU045/WU046/WU047 to exist first (WU048 scope, §14) |
| Approval/RCS hash binding (added, §0a) | PASS | Requires the exact protocol in §12 (HIGH-2 remedy) to be implemented and verified by WU048 case 2 |
| Independent-review context isolation (added, §0a) | PASS | Requires OD-B's strengthened point 6 (§9, MEDIUM-1 remedy) to be implemented and verified by WU048 case 11 |
| Malformed structured-output rejection (added, §0a) | PASS | Requires WU048 case 19 (MEDIUM-2 remedy) |
| WU045 idempotency | PASS | Requires WU048 case 20 (MEDIUM-3 remedy) |
| WU046 partial-retry safety | PASS | Requires WU048 case 21 (MEDIUM-3 remedy) |
| Canonical APPROVE / public HOLD leakage test | PASS | Requires WU048 case 18 (HIGH-1 remedy) |
| High-risk-claim safe handling | PASS | Requires WU048 case 22 (MEDIUM-4 remedy) |
| Deterministic publication guard | PASS | Requires the WU046 guard in §12 (LOW-3 remedy) to be implemented and verified by WU048 cases 7/16/18 |

**This Go-Live Acceptance Contract is a draft only.** It cannot be marked
satisfied until WU045, WU046, and WU047 are implemented and WU048
independently verifies every row above against the real, built production
artifact. No previously approved criterion above is weakened by this
pass's additions; the new rows are additive requirements only.

---

## 15a. Terminal outcome mapping (Go-Live gate)

Restated from §14 for the Go-Live Acceptance Contract's benefit (added
per independent-review remediation, §0a). WU048 returns exactly one of:

- **`NOT_READY`** — one or more mandatory criteria above fail, including
  any of: an unresolved P0; an unresolved P1; the normal-path dry run
  fails; deterministic validation coverage < 100%; independent review
  coverage < 100%; pre-Gate leakage > 0; an automatic
  approval/publication/merge safety violation; a mandatory
  promotion/build/CI/rollback integrity test fails.
- **`READY_WITH_ACCEPTED_RISK`** — all mandatory criteria pass; no P0/P1
  remains; one or more P2 risks remain; every remaining P2 has an explicit
  owner acceptance/defer disposition.
- **`READY_FOR_GO_LIVE_GATE`** — all mandatory criteria pass; no P0/P1
  remains; no unaccepted P2 remains; only P3/observations or fully
  resolved findings remain.

**Neither `READY_WITH_ACCEPTED_RISK` nor `READY_FOR_GO_LIVE_GATE` means
GO.** Only the owner decides GO/HOLD.

---

## 16. Deferred / non-goals

- Scheduled/cloud/continuous research execution (OD-A, if resolved as
  Option 1) — deferred, not needed for launch.
- Any general relationship-browsing surface, Records relationship-level
  filtering, or cross-reference anchor-semantics work — these remain
  AR-05's own DF-1/DF-2/DF-3 deferrals (§16, AR-05 contract) and are not
  reopened, revisited, or affected by anything in this contract.
- Graph reachability/redesign — same, unaffected.
- D7 / Decision Horizon — explicitly out of scope for the entire M013
  milestone per every one of WU044–WU048's canonical `outOfScope` lists.
- C008/C009/C010 repair — historical AIQT graph debt, explicitly out of
  scope for WU044 and named as out of scope for WU047 as well.
- Any new canonical record type (including any canonical `RCS-*` type) —
  explicitly foreclosed regardless of how OD-C is resolved (§9).
- Any change to M010 DS-04B owner-frozen foundation values — binding
  throughout M013 per WU047's own canonical scope.
- Broad site redesign beyond WU047's named production/public/quality/trust
  audit areas.
- Any social-channel integration — explicitly named as a manual owner
  operation outside the M013 critical path per M013's own canonical
  objective text.

---

## 17. Known historical C008/C009/C010 boundary

Confirmed unchanged from AR-05's own finding (§12, AR-05 contract):
`GRAPH-VALIDATE-BROKEN-CHECKPOINT-PACKET-REFERENCE` for checkpoints C008,
C009, and C010 (each references a `packetId` absent from
`state.lastAgentPacket`/runlog history) remains the same pre-existing AIQT
graph debt. This reconciliation performed `aiqt review` and `aiqt graph
validate` (§18 below) and confirms no new critical/high finding was
introduced. This debt remains explicitly out of WU044's, and every M013
successor's, authorized scope to repair, suppress, or mutate.

---

## 18. Astra review questions / attack surface

**Tool-substitution note (this pass):** this section's questions were
originally framed for a review tool named "Astra." The repository owner has
explicitly decided Astra is not available for this milestone and has
superseded that tool-specific requirement with an equivalent independent
Claude Code review gate (§18a) — a fresh Claude Code session, not the
implementation/consolidation context, performing the same read-only
architecture/governance review this section's questions describe. This is a
tooling substitution only: it does not remove or weaken the
independent-review gate before WU045, and this document does not claim
Astra was used. The questions below remain the substantive review agenda;
only the named tool changes. Every occurrence of "Astra" below is retained
verbatim as a record of the original framing — see §18a for the binding,
current gate definition.

This section names specific questions for an independent architecture/
governance review (originally scoped for Astra; now the independent Claude
Code review per §18a) before WU045 may start, per WU044's own acceptance
criteria requiring this review before any successor begins.

1. **Approval-transcription integrity (§7 gap 5, §9 OD-D/OD-E) —
   `RESOLVED_BY_REVIEW` (§0a HIGH-2):** does binding an APPROVE decision to
   a content hash (as WU046 proposes, §12) provide a strong enough
   guarantee against a mismatch between what the owner actually
   read/approved and what gets promoted, or does this need a stronger
   mechanism (e.g., displaying the hash to the owner explicitly as part of
   the decision prompt, or requiring the owner to type/paste it back)?
   **Resolution:** the independent review's exact approval-binding
   protocol (§12) answers this — the system enforces the binding by
   re-validating and re-hashing the JSON source of truth at decision time
   and comparing it against the hash of the package rendered for review,
   aborting and invalidating the review session on any mismatch; the owner
   is shown a short hash/fingerprint for identity/auditability only and is
   never required to manually compare cryptographic hashes.
2. **Independent review's actual independence (OD-B):** if WU045 implements
   OD-B Option 2/3 using the same underlying AI system/model for both the
   primary authoring pass and the "independent" review pass, is that
   genuinely independent in any meaningful sense, or does it risk being a
   procedural checkbox that doesn't catch what a truly independent
   reviewer would? This contract does not resolve this — it is squarely an
   Astra-level architecture/governance question.
3. **OD-D's mechanical Gate 1/Gate 2 collapse (§8, §9):** is Option 1
   (explicitly document the current combined-event model) an acceptable
   risk for a civic-research public-trust project, or does the nature of
   the content (civic problem findings potentially affecting real
   institutions/populations) require Option 2/3's stronger separation
   regardless of the added friction?
4. **Branch-protection adequacy (corrected; §8, §10, NO_CHANGE):** the
   active "Protect main" ruleset already requires a PR, 1 approving review,
   and the `validation` status check. Is this specific configuration
   (1 reviewer, no required signed commits, `pull_requests_only` bypass for
   the owner role) adequate for a public civic-research project at launch
   scale, or should Astra recommend strengthening any parameter (e.g.,
   required signed commits, a higher required-approval count once
   additional maintainers exist)? This is a review-of-adequacy question,
   not a gap-remediation task — no deficiency is asserted here, only a
   request for an independent second opinion on the existing configuration.
5. **Orchestration credential/execution-environment surface (OD-A):** even
   under Option 1 (local/operator-triggered only), what credentials
   (web-search/browsing API keys, if any are introduced) would WU045's
   orchestrator need, and what is the exposure if those credentials leak
   via a committed config file, log output, or error message? This
   contract's own read-only investigation found no such credentials in use
   today (discovery is via the AI agent's own general capability, not a
   repo-held API key) — Astra should confirm this remains true of whatever
   WU045 actually implements.
6. **Workbench-boundary test durability (§8) — `RESOLVED_BY_REVIEW` (§0a
   LOW-3):** `workbench-boundary.test.ts` is the single technical control
   preventing accidental workbench commits. Should WU045/WU046 add a
   second, independent control (e.g., a pre-commit hook, currently absent
   per this investigation) rather than relying on one regression test
   alone? **Resolution:** yes, in the form of the deterministic
   publication guard specified in §12 — a check enforced at the WU046
   Git-publication boundary itself (immediately before commit/push/PR),
   not a local Git pre-commit hook. A pre-commit hook remains permissible
   as optional additional defense-in-depth but is not required and must
   not be relied upon for governance correctness, since it is bypassable
   and not guaranteed to run in every execution environment.

---

## 18a. M013_WU044_INDEPENDENT_CONTRACT_REVIEW (Claude Code review gate)

**Process override (owner-approved, this pass):** the repository owner has
explicitly decided Astra is not available for this milestone and has
replaced the Astra-specific post-WU044 review named in §18 with an
**independent Claude Code architecture/governance review**, on the same
binding terms. This is a tooling substitution only — it does not remove or
weaken the independent-review gate before WU045, and this document does not
claim Astra was used anywhere. §18's review questions remain the
substantive agenda for the review; this section defines the binding gate
itself.

**Binding sequence — after contract consolidation and before WU045
authorization:**

1. A **fresh Claude Code session** performs a **read-only** independent
   review of this final, consolidated WU044 contract. "Fresh" means a
   session that is not the implementation/consolidation context that
   produced this document — it must not share this session's context or
   assumptions.
2. The reviewing session does **not** implement or remediate anything
   during the review — findings only, no code, no document edits, no state
   changes.
3. It returns findings **categorized by severity**.
4. The owner/overseer resolves the findings (accepts, rejects with
   rationale, or schedules remediation) — resolution is a human decision,
   not something the reviewing session or this contract performs
   automatically.
5. Only after findings are resolved may the owner explicitly authorize
   WU045. No automatic authorization occurs; this contract's consolidation
   of OD-A through OD-E does not, by itself, authorize WU045 — the review
   gate is a separate, additional precondition.

**Review focus (binding scope for the reviewing session):**
- governance bypass;
- publication leakage;
- the canonical/public boundary (Gate 1 / Gate 2 collapse, §8, OD-D);
- Research Change Set immutability (OD-C);
- base-SHA races (§7 gap 7, §12);
- AI-review pseudo-independence (OD-B, §18 question 2);
- hidden normal-path human handoffs (§5);
- idempotency/retry failures (§7, §11);
- unsafe failure recovery (§7, §14);
- unnecessary infrastructure (OD-A);
- scope creep (§16);
- missing adversarial verification (§14);
- owner-merge boundary violations (OD-E, §12).

**Explicitly not run in this action:** per the WU044 packet's own
instruction, this consolidation pass does **not** run the independent
Claude Code review itself — it only records the gate's binding definition
and confirms the tool substitution. The review is a distinct, subsequent
action in a separate, fresh session.

**AIQT lifecycle-state note:** `.aiqt/state.json`'s planning text for this
gate was originally authored naming "Astra." This consolidation pass
checked `aiqt update --help` for a native mechanism to record this process
override without mutating lifecycle state incorrectly; `aiqt update` only
accepts `--objective`, `--target-user`, `--agent`, and
`--repository-path`/`--implementation-root` — none of which is a
fit for recording a one-off tool-substitution rationale, and no other
native AIQT mechanism for this purpose was found. Per the packet's own
instruction, lifecycle state was therefore **preserved as-is and not
hand-edited**; the override is recorded here in the contract instead, and
any stale "Astra" wording remaining in `.aiqt/state.json`'s planning text is
a **known planning-text/contract mismatch**, not a defect requiring
remediation in this pass — it should be reconciled the next time AIQT
lifecycle state for this gate is legitimately regenerated (e.g., at a future
`aiqt checkpoint`/`aiqt next` transition), not by manual mutation here.

---

## 19. Open owner decisions

**Updated for this pass:** **OD-A, OD-B, OD-C, OD-D, and OD-E are all
`OWNER_APPROVED`** (§9) — the repository owner has reviewed and explicitly
selected: OD-A Option 1; OD-B Option 2 (with the five-point independent-
review minimum bar); OD-C Option 3 (JSON source of truth + generated
Markdown view); OD-D Option 2 (combined-by-default, two separately
auditable decisions, binding private-hold sequencing); OD-E Option 1
(automate through `READY_FOR_OWNER_MERGE`, manual owner merge). WU045 and
WU046 (§11, §12) are now frozen to implementation-grade boundaries using
these approved decisions.

**The independent review gate (§18a) has now run:** a fresh Claude Code
session performed the read-only architecture/governance review and
returned `PASS_WITH_NONBLOCKING_FINDINGS` (§0a). Every HIGH/MEDIUM/LOW-3
finding has been resolved by the contract amendments incorporated in this
pass (§0a's disposition table); LOW-2 is recorded as a deferred
observation (§7a). **This does not itself authorize WU045.** Per §18a step
5, only the owner's explicit authorization — a separate action from this
document's own remediation — authorizes WU045 to begin. This pass performs
no such authorization; it only incorporates the review's findings into the
contract text and returns to the overseer for that authorization decision.

**WU047's dependency on external evidence remains narrower than the
original draft stated:** only the two remaining `UNVERIFIED_EXTERNAL` items
(Deployment Protection policy specifics; Preview-deployment access control
beyond default — §8, §10) still require owner-supplied evidence before
WU047's P2 items can be fully closed; WU047 is not blocked on any P1-level
external evidence, since the previously-unresolved Git→Vercel mapping,
domain, and branch-protection questions are confirmed (§8, §10).

---

## 20. Validation performed for this WU044 contract

- `npm run research:validate` — result recorded in the WU044 return summary
  (§ overseer return); not embedded here to avoid this document claiming a
  result that must be independently re-confirmed at hand-off time.
- `git diff --check` — result recorded in the return summary.
- `aiqt status`, `aiqt review`, `aiqt graph validate` — results recorded in
  the return summary; expected to show only the pre-existing C008/C009/C010
  findings (§17) and no new critical/high finding.
- Corpus record count independently re-confirmed during this investigation:
  12 PRB + 143 EVD + 119 SRC = 274, matching the expected baseline exactly.
- No `research/**` file, schema file, or `apps/research-explorer` source
  file was modified during WU044. Only this document was created, plus the
  WU044 AIQT state transition itself (`aiqt next`, recorded as PKT-045).

**This consolidation pass (owner-decision persistence, same WU044/PKT-045):**
`npm run research:validate`, `git diff --check`, and `aiqt status` were run;
`aiqt review` and `aiqt graph validate` were run read-only. Results are
recorded in this pass's return summary, not embedded here. No `research/**`,
schema, runtime, or `apps/research-explorer` source file was modified; only
this document was edited. `.aiqt/state.json` was not hand-edited (§18a).
`aiqt checkpoint` was not run; WU044 remains `in_progress`.

**Fourth pass (independent-review remediation, same WU044/PKT-045):**
`npm run research:validate`, `git diff --check`, and `aiqt status` were
run; `aiqt review` and `aiqt graph validate` were run read-only. Results
are recorded in this pass's return summary, not embedded here. No
`research/**`, schema, runtime, or `apps/research-explorer` source file
was modified; only this document was edited (plus `.vscode/`, which this
pass did not create and does not modify). `.aiqt/state.json` and
`.aiqt/runlog.jsonl` were not hand-edited by this pass. `aiqt checkpoint`
was not run; WU044 remains `in_progress`; no `aiqt next` was run; no
successor work unit was started; C008/C009/C010 remain unchanged
pre-existing findings (§17).
