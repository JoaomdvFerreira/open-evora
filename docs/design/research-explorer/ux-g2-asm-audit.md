# UX-G2 Audit — ASM (Assessment) Canonical Data vs. Record Detail Presentation

**Status:** Audit only. No files changed, no snapshots modified, no PR opened.
**Scope:** All 10 canonical `ASM-*` records (`research/assessments/ASM-0001.yaml` … `ASM-0010.yaml`), their schema (`research/schemas/assessment.schema.json`), model doc (`docs/models/assessment-model.md`), the D3 execution protocol (`docs/discovery/d3-execution-protocol.md`), and the two UI surfaces that render ASM content: `RecordDetailPanel.tsx` (generic Record Detail) and `ProblemView.tsx` (`Avaliação` / `Incertezas e lacunas` sections).

Operational note on naming: no "UX-G" identifier exists anywhere in the repo's docs, code comments, milestone tracking, or git history (searched repo-wide). By contrast, `UX-F` does exist as a git branch/commit-message label (`feat/research-explorer-ux-f-graph-availability-gate`, merged PR #35) even though it is absent from docs/code text — so the tracked sequence through `UX-A`…`UX-F` design-review slices is real, it is only "UX-G2" specifically that has no precedent. This is a tracking/discoverability note, not a substantive concern about the initiative itself — see §10 point 1. This audit treats "UX-G2 — Assessment decision narrative" as a new initiative and does not assume its name was previously canonically assigned.

---

## 1. Executive summary

ASM is a fully-specified, mature canonical model (33 required fields, 29 enum groups, a dynamically-keyed `critical_unknowns` map, and free-text `notes`/`next_action` fields). `next_action` is the operational "what next" field — it states the concrete next step (and, in most records, what not to do meanwhile), not the decision's rationale; `notes` is the closer source for evidence-accounting reasoning, where it exists at all (see §7). The problem is not missing canonical data — it is that **almost none of it reaches the public-facing UI in a labelled, comprehensible form**.

Concretely:

- ASM gets **no meaning-zone sentence** in Record Detail (`meaning-field-candidates.json` has no ASM field), so opening `ASM-0001` directly shows only a badge and an empty "sem campo de significado" placeholder.
- ASM gets **no `QuickRead` component** (only `EVD-` and `SRC-` have one) — every evidence-confidence, civic-importance, understanding, and decision-gate field is invisible outside the raw technical disclosure.
- `statusGloss.ts` (the only place canonical enum values get *explained*, not just translated) has **zero entries for any ASM field**. `triage`, `decision_gates.*`, `evidence_confidence.*`, `civic_importance.*`, `journey_understanding` etc. only ever get a literal PT-PT word (`presentation.ts` `LABELS`), never the "why this matters" prose that exists verbatim in `docs/discovery/d3-execution-protocol.md` §5.1a/§5.1b/§5.2.
- `next_action` (the operational "what next" field) and `notes` (the closer source for evidence-accounting rationale, where present) are **not read by any UI code at all**. Both exist only inside `RecordFieldTree` under "Inspeção técnica completa," which is a collapsed `<details>` dumping the entire YAML tree with schema field names, not prose.
- `ProblemView.tsx` (the closer-to-narrative surface) surfaces only 4 of 33 required ASM fields as chips (`assessment_status`, `triage`, `structure_action`, `digital_leverage`) plus `remaining_gap` and `critical_unknowns` in a separate "Incertezas" block. `evidence_confidence.*`, `civic_importance.*`, `decision_gates.*` (the actual decision-criteria structure) are **entirely absent from both UI surfaces** outside raw technical inspection.

So today: **"What is the decision?"** is answerable (triage chip). **"Why?"** is not — the decision-gates structure that the schema and protocol treat as *the* criteria evaluated is nowhere in the presented UI, and the prose that explains individual PASS/PARTIAL/FAIL calls lives only in `notes`, which the UI never reads.

---

## 2. Canonical ASM information inventory

Grouped by the question categories in the brief. "Shown" = appears in `ProblemView` "Avaliação"/"Incertezas" or in generic Record Detail's meaning/quick-read/role-chip zones. "Technical only" = present in canonical YAML but reachable only via "Inspeção técnica completa."

| Field / group | Canonical meaning | Shown in main view? | Presentation readiness | Contributes to |
|---|---|---|---|---|
| `assessment_id`, `problem` (PRB link) | Clear (schema `references`, required, 1:1 active-PRB) | `problem` shown only as a graph edge in "Relações"; not surfaced as "this assessment is about PRB-000X" prose in ASM's own Record Detail | Direct — a one-line "Problema avaliado: PRB-000X — <title>" is trivial and already has the data (`findRelatedProblemId`) | Summary/status |
| `as_of` | Clear (assessment date) | Technical only | Direct | Summary/status ("Como chegámos") |
| `phase` | Clear (`D3`/`D4` — discovery phase at time of assessment) | Technical only | Requires label mapping (phase codes are undocumented outside protocol docs) | Summary/status |
| `assessment_status` | Clear (DRAFT/CURRENT/SUPERSEDED/ARCHIVED) | **Shown** (ProblemView chip, `presentation.ts` label) | Already public-ready | Summary/status — currentness of the assessment itself |
| `evidence_confidence.overall` | Clear | Technical only | Direct — reuses generic `confidence` label already in `presentation.ts` | O que sabemos |
| `evidence_confidence.independence` | Clear, but genuinely technical (lineage-thread accounting) | Technical only | Requires label mapping; risk of misleading a lay reader without the "lineage" concept explained | O que sabemos (confidence dimension) |
| `evidence_confidence.coherence` | Clear | Technical only | Direct | O que sabemos |
| `evidence_confidence.adequacy` | Clear | Technical only | Direct | O que sabemos |
| `evidence_confidence.relevance` | Clear | Technical only | Direct | O que sabemos |
| `evidence_confidence.currentness` | Clear | Technical only | Direct | O que sabemos |
| `evidence_confidence.contradiction_status` | Clear but **counter-intuitive valence** (§5.1a: LOW = little contradiction, HIGH = substantial contradiction — not a confidence score) | Technical only | **Requires human label mapping** — a literal label risks readers reading it backwards (as if HIGH = high confidence there's no contradiction) | O que sabemos / Como chegámos |
| `evidence_confidence.stakeholder_validation` | Clear (PENDING/PARTIAL/CHALLENGED/VALIDATED/NOT_APPLICABLE) | Technical only | Direct | O que sabemos / O que ainda não sabemos |
| `civic_importance.reach/frequency/severity/persistence/equity` | Clear (5 independent dimensions, deliberately never aggregated into a score — protocol §3) | Technical only | Direct, but **must not be aggregated/averaged** in any UX-G2 design — this is an explicit protocol constraint | O que sabemos — civic weight, distinct from digital leverage |
| `journey_understanding` | Clear (SUFFICIENT/PARTIAL/INSUFFICIENT/UNKNOWN/NOT_ASSESSED) | Technical only | Direct (shares `understanding` label group) | O que sabemos / O que ainda não sabemos |
| `causal_understanding` | Clear | Technical only | Direct | same |
| `existing_solution_understanding` | Clear, but has a **documented, easy-to-conflate distinction** from `remaining_gap` (model doc explicitly warns this field was renamed from `existing_solution_coverage` because "coverage" conflated "do we understand what exists" with "does it close the gap") | Technical only | Requires explanatory label — a bare enum invites re-conflating the two questions the rename was meant to prevent | O que sabemos |
| `remaining_gap` | Clear, deliberately distinct from the above | **Shown** (ProblemView "Incertezas" section, via `AssessmentUnknowns`) | Already shown, but shown *without* `existing_solution_understanding` alongside it, which risks presenting the gap without its necessary counterpart | O que ainda não sabemos |
| `digital_leverage` | Clear; deliberately reuses `PRB.digital_tractability`'s enum, not a new scale | **Shown** (ProblemView chip) | Already public-ready | Summary/status |
| `structure_action` | Clear (KEEP/SPLIT_CANDIDATE/MERGE_CANDIDATE) — explicitly *not itself* a canonical action, only a proposal | **Shown** (ProblemView chip) | Already public-ready, but its "this is a proposal, not an executed action" nuance (model doc "## Rule") is not conveyed anywhere in UI | Summary/status |
| `decision_gates.problem_real` | Clear (PASS/PARTIAL/FAIL/UNKNOWN/NOT_ASSESSED, §5.1b) | **Not shown anywhere in UI** (technical disclosure only) | Direct once PARTIAL-vs-UNKNOWN distinction is explained (protocol §5.1b prose exists verbatim, ready to reuse) | Como chegámos à decisão — this is literally "what decision criteria were evaluated" |
| `decision_gates.civic_importance` | Clear | Not shown | Direct | Como chegámos |
| `decision_gates.journey_understood` | Clear | Not shown | Direct | Como chegámos |
| `decision_gates.root_cause_understood` | Clear | Not shown | Direct | Como chegámos |
| `decision_gates.remaining_gap_supported` | Clear | Not shown | Direct | Como chegámos |
| `decision_gates.digital_causality` | Clear — this is the gate that decides STOP/WATCH vs DEEPEN/PROCEED most directly (see PRB-0009 case) | Not shown | Direct | Como chegámos |
| `decision_gates.operability` | Clear (currently `NOT_ASSESSED` in every one of the 10 records — no ASM has reached this gate yet) | Not shown | Direct | Como chegámos |
| `decision_gates.testability` | Clear (mostly `NOT_ASSESSED`, a few `PARTIAL`) | Not shown | Direct | Como chegámos |
| `critical_unknowns.*` (question, decision_impact, target_phase, best_next_evidence) | Clear; dynamically-keyed, optional | **Shown** (ProblemView "Incertezas" section) | Already public-ready and arguably the best-presented ASM content today | O que ainda não sabemos |
| `triage` | Clear, with an explicit and important anti-misreading rule (§5.2: STOP/WATCH is project posture, never a judgement of civic worth — canonical example PRB-0009: civic_importance PASS + triage WATCH) | **Shown** (ProblemView chip) | Shown, but **the anti-misreading caveat itself is not conveyed** — a bare "Acompanhar" chip next to nothing explaining why gives no defense against exactly the misreading the protocol calls out by name | Summary/status — but currently the single biggest comprehension risk in the whole model |
| `next_action` | Clear; free text; the operational "what next" field — states the concrete next step (and often what NOT to do meanwhile) that follows *from* the decision already made elsewhere in the record. It is not itself the decision rationale. | **Not read by any UI code** | Requires no mapping — it is already human prose in the canonical record, in English (see §7) | Summary — the operational follow-through, once translation/scope questions in §8 are resolved |
| `notes` | Clear; free text, contains evidence-accounting rationale, lineage reasoning, and explicit statements of what changed and why between assessment revisions, where present | **Not read by any UI code** — visible only inside raw `RecordFieldTree` | Cannot be shown verbatim as-is (see §7 — length, internal jargon, English) but is the closer canonical source, where present, for "why this decision follows from evidence" | Como chegámos — the closer (though not guaranteed, per-record) answer to audit question 6 |

---

## 3. Cross-ASM variation / edge cases

All 10 read directly; here is what materially differs and why it matters for UX-G2:

- **`phase` varies**: ASM-0001–0004, 0006–0008, 0010 are `D3`; ASM-0005 and ASM-0009 are `D4` (both have gone through a documented D4 existing-solution/comparator-research pass — see their `next_action`/`notes`). A UX-G2 design that assumes every ASM is a single, static D3 artifact will misrepresent ASM-0005/0009, which are demonstrably iterative, multi-revision records.
- **`triage` covers 3 of 4 values in the live corpus**: `DEEPEN` (ASM-0001–0005, 0007, 0008), `WATCH` (ASM-0006, 0009, 0010), none currently `STOP` or `PROCEED`. UX-G2 should not design only around the `DEEPEN` case (the majority today) — `WATCH`'s "important problem, deliberately not being pursued" framing (ASM-0009, ASM-0010) is the single most misreading-prone state and the one the protocol devotes the most explicit prose to defending (§5.2, and again inside ASM-0009's own `notes`).
- **`critical_unknowns` cardinality varies 0–3**: ASM-0006 and ASM-0010 have exactly one `U1`; ASM-0007 and ASM-0009 have three (`U1`–`U3`). This is expected per the schema's design (optional, dynamically-keyed) but any fixed-width UI treatment (e.g., "always show 3 unknowns") would misrepresent records with fewer.
- **`decision_gates` values are not uniformly filled**: `operability`/`testability` are `NOT_ASSESSED` in most records but `PARTIAL` in ASM-0003/0004/0005/0006/0008 — meaning some ASMs have begun evaluating downstream gates (operability, testability) that are logically later in the pipeline than `civic_importance`/`journey_understood`. `civic_importance` gate is `UNKNOWN` only in ASM-0004 (the whole record is UNKNOWN-heavy — see below), `PASS` only in ASM-0006/0009, `PARTIAL` everywhere else.
- **ASM-0004 is a genuine "thin evidence" outlier**: all five `civic_importance.*` dimensions are `UNKNOWN`, `decision_gates.civic_importance` is `UNKNOWN` (the only record where this happens), and the `notes` field explicitly states this is deliberate ("this thinness is itself the finding this ASM must record honestly rather than paper over"). A UX-G2 design must handle "we do not know" as a first-class, non-alarming state — ASM-0004 is the test case for that.
- **ASM-0009 and ASM-0010 are the canonical STOP/WATCH-is-not-civic-unimportance paradigm cases**, explicitly cross-referenced from the protocol itself (§5.2 names PRB-0009/ASM-0009). Any UX-G2 example/prototype should be built and tested against these two, not against ASM-0001 alone — ASM-0001 is actually one of the *less* structurally interesting records (still mid-DEEPEN, no D4 pass, no WATCH/STOP framing challenge).
- **`existing_solution_understanding` = SUFFICIENT does not correlate with `remaining_gap` = SUFFICIENT anywhere in the corpus** — every single ASM with `existing_solution_understanding: SUFFICIENT` (0002, 0005, 0006, 0007, 0008, 0009) still carries `remaining_gap: PARTIAL`. This is not a coincidence; it is exactly the distinction the model doc's rename note (§5.1 in the protocol) exists to prevent readers from collapsing. UX-G2 must present these two fields adjacently, never one without the other, or it will recreate the exact conflation the schema was already revised once to avoid.
- **`stakeholder_validation` is `PARTIAL` only in ASM-0003** (APCE's institutional response); it is `PENDING` in all 9 others. No ASM currently reaches `VALIDATED` or `CHALLENGED`. A UX-G2 mock should not assume `VALIDATED` is a common/expected state in the current corpus.
- **`notes` length and structure vary hugely** — ASM-0006's `notes` is a few sentences; ASM-0005 and ASM-0009's are multi-paragraph audit trails spanning several work units (WU017 → WU018/WU-D3-05 → WU-D4-01/02), each explicitly noting what did *not* change and why. This means "notes" is not one field with one shape — it is closer to a changelog. Any UX-G2 treatment of `notes` needs to either (a) show only the *latest* revision's reasoning, or (b) explicitly decide to show the full changelog, but treating it as a single flat paragraph will produce an unreadable wall of text for ASM-0005/0009 specifically.

---

## 4. Current UI coverage vs hidden canonical information

**Generic Record Detail (`RecordDetailPanel.tsx`), when an ASM is opened directly:**

- Meaning zone: empty ("sem campo de significado canónico identificado") — `meaning-field-candidates.json` has no ASM field.
- Role-field chips: whatever `summaryFields` the read-model build script attaches (not independently re-derived here, but per `ProblemView.tsx`'s own `ASSESSMENT_SUMMARY_FIELDS` constant, this is `assessment_status`, `triage`, `structure_action`, `digital_leverage` — 4 of 33 required fields).
- No `QuickRead` component exists for ASM (unlike EVD/SRC).
- Everything else — all `evidence_confidence.*`, `civic_importance.*`, `decision_gates.*`, `journey/causal/existing_solution_understanding`, `remaining_gap`, `critical_unknowns`, `next_action`, `notes`, `as_of`, `phase` — is available **only** by expanding "Inspeção técnica completa," which renders the raw YAML tree with schema field names (`RecordFieldTree`), explicitly captioned "não uma reformulação pública" (not a public reformulation).

**ProblemView.tsx, "Avaliação" section** (the closer-to-narrative surface, scoped per-PRB):

- Shows: `assessment_status`, `triage`, `structure_action`, `digital_leverage` as a `<dl>` of chips, plus a link to the ASM's own generic Record Detail.
- Does **not** show `evidence_confidence.*`, `civic_importance.*`, or `decision_gates.*` at all.

**ProblemView.tsx, "Incertezas e lacunas" section:**

- Shows: `remaining_gap` and the full `critical_unknowns` map (question, decision_impact, target_phase, best_next_evidence) — this is the best-presented ASM content in the product today.
- Does not show `existing_solution_understanding` alongside `remaining_gap`, despite the model doc explicitly treating them as a paired distinction.

**Never read by any UI code, in either surface:** `next_action`, `notes`, `as_of`, `phase`, all 8 `decision_gates.*`, all 8 `evidence_confidence.*`, all 5 `civic_importance.*`, `journey_understanding`, `causal_understanding`.

This means: of 33 schema-required ASM fields, **6 are surfaced outside technical inspection** (`assessment_status`, `triage`, `structure_action`, `digital_leverage`, `remaining_gap`, plus `critical_unknowns` as a group). The other 27, including the entire `decision_gates` block — which is the closest canonical structure to "decision criteria evaluated" the schema has — are technical-inspection-only.

---

## 5. Main comprehension gaps

1. **No visible decision-criteria structure.** The brief's question 5 ("what decision criteria were evaluated") maps directly onto `decision_gates.*` — 8 named, individually-labelled criteria with a defined PASS/PARTIAL/FAIL/UNKNOWN/NOT_ASSESSED vocabulary. This is the single most decision-relevant structure in the schema and it is completely invisible outside raw YAML.
2. **No visible reasoning connecting evidence to decision.** Question 6 ("why does the decision follow from those criteria") is answerable today, where answerable at all, only by reading `notes` verbatim in English prose (see §7 on its inconsistent presence/shape across records) — and nothing in the UI surfaces that text. `next_action` is the operational follow-through, not this rationale, and should not be read as a substitute for it.
3. **`contradiction_status` valence is a live misreading trap.** Its labels (`HIGH`/`MEDIUM`/`LOW`) read naturally as a confidence scale, but canonically mean the opposite emphasis (LOW = coherent/good, HIGH = contradiction present) per protocol §5.1a. `presentation.ts`'s literal translation (`Elevado`/`Médio`/`Baixo`) does nothing to prevent this — it is not currently shown anywhere outside technical inspection, but it will need this correction the moment it is surfaced.
4. **`triage=WATCH`/`STOP` is the highest-risk state for civic misreading**, and the protocol devotes explicit canonical prose to defending against exactly that misreading (§5.2, doubly reinforced inside ASM-0009's own notes, which flags it as "an unresolved framework-semantic issue"). No UI surface today carries any of that caveat next to the `triage` chip.
5. **`existing_solution_understanding` vs `remaining_gap` split is shown asymmetrically** — only the latter is in ProblemView, inviting exactly the conflation the schema's rename (§5.1 of the protocol) was designed to prevent.
6. **All ASM free text is in English**, while `CLAUDE.md`'s language rule requires user/public-facing Open Évora content in PT-PT with only technical enums localized at presentation. `next_action` and `notes` are canonical narrative prose, not enum values — they cannot be presentation-localized the way `triage`/`decision_gates` can. This is a hard blocker for any design that wants to show `next_action`/`notes` (or a close paraphrase) directly to a PT-PT public audience without inventing translation, which the project's fabrication/invention guardrail forbids doing informally. UX-G2 v1 resolves this by keeping both fields out of scope (§9a) rather than attempting an ad hoc translation.
7. **`notes` is a changelog, not a single narrative**, for the more mature ASMs (0003, 0005, 0009 especially) — multi-revision, multi-work-unit audit trails. Any future presentation of `notes` cannot naively surface it as one block of prose without a strategy for either summarizing or scoping to the latest revision, since doing so verbatim would be both unreadably long and (per point 6) in English. UX-G2 v1 sidesteps this by excluding `notes` from scope entirely (§9a).

---

## 6. Reusable information for UX-G2

Already public-ready, requiring no new canonical work:

- `assessment_status`, `triage`, `structure_action`, `digital_leverage`, `remaining_gap` — labels already exist in `presentation.ts`.
- `critical_unknowns` rendering pattern in `ProblemView.tsx`'s `AssessmentUnknowns` — already a good "O que ainda não sabemos" component; can be reused/extended rather than rebuilt.
- All `decision_gates.*` values reuse the single `decision_gate` label group already defined in `presentation.ts` (`PASS`/`PARTIAL`/`FAIL`/`UNKNOWN`/`NOT_ASSESSED` → `Cumpre`/`Cumpre parcialmente`/`Não cumpre`/`Desconhecido`/`Não avaliado`) — the literal PT-PT words already exist, only explanatory glosses (per point 3 in §5) and per-gate captions are missing.
- All `evidence_confidence.*`/`civic_importance.*` values reuse the existing `confidence` label group.
- The PASS/PARTIAL/FAIL/UNKNOWN/NOT_ASSESSED and STOP/WATCH/DEEPEN/PROCEED semantic definitions in `docs/discovery/d3-execution-protocol.md` §5.1b and §5.2 are canonical, already-written, ready-to-paraphrase-or-cite prose — this is the natural source for `statusGloss.ts`-style explanatory glosses for `triage` and `decision_gates.*`, the same pattern already used for `PRB.status`/`validation_status`.
- The `problem` reference (`findRelatedProblemId` machinery already exists in `RecordDetailPanel.tsx`) can drive a one-line "Avaliação do Problema PRB-000X" orientation sentence for ASM's own meaning zone — no new data plumbing required, only a meaning-field candidate addition or an ASM-specific quick-read component analogous to `evidenceQuickRead`/`sourceQuickRead`.

---

## 7. Information that must stay technical

- Raw lineage accounting (`analysis.lineage_id` cross-references described at length in `notes`, e.g. "5 effective evidentiary threads across 9 linked records") — this is legitimate methodological audit detail, valuable for traceability, but not narrative-shaped and not something a public reader needs to follow the decision. Keep in "Inspeção técnica completa."
- Work-unit/milestone cross-references (`WU017`, `WU-D3-03`, `D5-OP-003`, etc.) embedded throughout `notes` — internal project-tracking vocabulary, out of scope for public narrative per the project's English-internal/PT-public split.
- `phase` (`D3`/`D4`) as a raw code — internal discovery-methodology staging, not something a public decision narrative needs to expose as its own field (it can inform *when* an ASM was last substantively revised without naming the phase machinery).
- The full verbatim `notes` changelog for multi-revision ASMs (0003, 0005, 0009) — valuable for audit, not fit for direct public display without summarization work that risks inventing framing not canonically present (guardrail 8).

---

## 8. Missing canonical information that UX alone cannot solve

- **No canonical, structured "decision rationale" field distinct from free-text `notes`.** The schema has no `decision_basis`/`rationale` field mapped 1:1 to each `decision_gates.*` entry — the *reasoning* for why `journey_understood = PARTIAL` (say) lives embedded in prose inside `notes`, not addressably per-gate. A UX-G2 design that wants "next to each decision gate, show why" cannot do so today without either (a) new canonical schema work (e.g., a `decision_gates.*.basis` or `.rationale` companion field) or (b) fragile prose-parsing of `notes`, which risks misattributing rationale across gates and would itself be an act of inventing structure not canonically present — guardrail 8 forbids this.
- **No canonical PT-PT translation of `next_action`/`notes`.** These are English narrative fields. Public presentation requires either genuine translation (a real localization effort, not a mechanical one, given the technical density) or accepting that the "why" narrative stays English/technical-only for now — this is a project decision, not something the UI layer can resolve unilaterally.
- **No documented `phase` value glossary** (what does `D3` vs `D4` mean to a reader, beyond internal discovery-methodology staging) — exists in `d3-execution-protocol.md` but not distilled into a reusable one-line gloss the way `triage`/gate values are.
- **`contradiction_status`'s valence correction is documented but not yet propagated into any presentation-layer artifact** (`presentation.ts`, `statusGloss.ts`) — this is a small but must-fix documentation-to-code gap before this field can be safely surfaced anywhere.

---

## 9. Recommended UX-G2 v1 information architecture, grounded only in existing data

This is offered as an audit-grounded architecture sketch, not an implementation plan — no changes have been made. **UX-G2 v1 is frozen to current-state presentation only**: it presents the latest values of an ASM's own fields, plus the paired `existing_solution_understanding`/`remaining_gap` and evidence-gates structure. It does not attempt a decision narrative, a rationale synthesis, or a changelog view — see the scope boundary below.

1. **ASM meaning zone** (currently empty): a one-line orientation sentence built from already-available data — "Avaliação do Problema [PRB-000X — título]" — plus `assessment_status` and `as_of`, mirroring the pattern `EvidenceQuickRead`/`SourceQuickRead` already establish for other types.
2. **"O que sabemos" block**: `evidence_confidence.*` and `civic_importance.*` as two labelled dimension groups, each dimension as a chip using the existing `confidence` label set — with `contradiction_status` given its own corrected micro-copy (fix its valence framing before shipping it anywhere, per §5 point 3 and §8), and with `civic_importance.*` dimensions presented individually, never aggregated or averaged into a single score (protocol §3).
3. **"O que ainda não sabemos" block**: extend the existing `ProblemView` "Incertezas" section (already good) to include `existing_solution_understanding` alongside `remaining_gap` — always presented together, never one without the other, since they answer distinct questions the schema was explicitly revised once to keep apart (§5 point 5) — plus `journey_understanding`/`causal_understanding` as the "how well do we understand the mechanism" companions to `critical_unknowns`.
4. **"Como chegámos à decisão" block** (currently fully absent from public presentation): render `decision_gates.*` as a named, captioned list — reusing the existing `decision_gate` labels — each with a plain-language gloss sourced from `d3-execution-protocol.md` §5.1b (PASS/PARTIAL/FAIL/UNKNOWN/NOT_ASSESSED definitions are already written and ready to adapt, the same way `statusGloss.ts` already adapts PRB's protocol prose). Do not attempt per-gate rationale extraction from `notes` — no canonical field maps rationale to an individual gate, and synthesizing one would be inventing structure the model does not provide (guardrail 8, §8 below). State plainly that gate-level reasoning is in the technical record for now.
5. **`triage` presentation**: keep the existing chip, but pair it with a fixed, canonically-grounded caveat sentence (adapted from protocol §5.2's own definitions) specifically for `STOP`/`WATCH`, since that is the corpus's actual, current, and highest-misreading-risk state (§3, §5 point 4) — not a hypothetical edge case. The caveat must state plainly that `triage`/`WATCH`/`STOP` describe Open Évora's project posture, never a judgement of the underlying problem's civic importance (protocol §5.2) — the `civic_importance.*` dimensions in point 2 are the record's own, separate answer to civic worth and must not be read as reconciled or overridden by `triage`.
6. **Summary/status row**: `assessment_status`, `structure_action`, `digital_leverage` stay as-is (already correctly minimal, already public-ready).
7. `next_action` and `notes` stay in "Inspeção técnica completa" for v1 — this is a scope boundary (§9a), not a translation-blocked deferral: `notes` is out of scope until §8's rationale/changelog questions are resolved, and `next_action`, even though it is operational rather than narrative, is deferred with it because a real PT-PT translation has not been done for either.

### 9a. UX-G2 v1 scope boundary

**In scope for v1:**
- ASM → PRB orientation (meaning-zone sentence)
- assessment/decision summary (`assessment_status`, `structure_action`, `digital_leverage`, `triage`)
- the `triage` STOP/WATCH project-posture-not-civic-importance caveat
- `decision_gates.*` (all 8, current values only, no per-gate rationale)
- `evidence_confidence.*` dimensions (current values only)
- `civic_importance.*` dimensions (current values only, presented individually, never aggregated)
- `journey_understanding`/`causal_understanding` (understanding fields)
- `critical_unknowns`
- `existing_solution_understanding` + `remaining_gap`, presented together
- safe PT-PT labels/glosses for all of the above, reusing existing label groups and protocol-sourced gloss text

**Out of scope for v1:**
- public display of `notes`
- public display of `next_action`
- invented or synthesized per-gate rationale (no canonical field supports it — §8)
- schema changes
- corpus/research-record changes
- translation of canonical narrative prose (`notes`/`next_action` stay English/technical-only until a real translation effort is separately commissioned)
- revision/changelog presentation of `notes` for multi-revision ASMs (0003, 0005, 0009) — v1 shows current state only

---

## 10. Open questions / operational notes

None of the following block using this audit as the canonical design input for UX-G2 v1; they are tracking/process notes to resolve alongside or before implementation.

1. **Naming/tracking (operational, not a design blocker)**: "UX-G2" does not correspond to any existing tracked work-unit identifier in this repo (prior UX work is tracked as `UX-A`…`UX-E` design-review slices and `D<phase>-WU<n>` work units). This affects where the eventual PR/milestone doc lives, not the content of what gets built. Confirm the intended tracking scheme (a new `D<phase>-WU<n>` milestone doc, or a new UX slice letter continuing `UX-A`…`UX-E`) before or alongside opening the implementation PR.
2. **Translation policy for `next_action`/`notes`**: both are out of scope for v1 (§9a). A future slice would need to decide whether to (a) leave them technical-only indefinitely, (b) commission real PT-PT translation as canonical or presentation-layer content, or (c) build a UI-layer summarization — which would itself need review against the no-invented-semantics guardrail.
3. **Per-gate rationale**: out of scope for v1 (§9a). A future slice adding it would need a new canonical schema field (e.g., `decision_gates.*.basis`) — presentation-layer synthesis from `notes` is not an acceptable substitute (§8).
4. **`contradiction_status` correction**: a small, low-risk fix (documentation → `statusGloss.ts`/`presentation.ts` micro-copy) that should land before or alongside UX-G2 v1 work that surfaces this field, given the live misreading risk (§5 point 3) — this is a v1-relevant prerequisite, not a deferred item.
5. **Scope of `notes` for multi-revision ASMs**: explicitly out of scope for v1 (§9a). A future slice would need to decide whether the audience needs visibility into the changelog nature of `notes` (ASM-0003/0005/0009 specifically) or whether "current state only" remains the permanent design, given how much of those three records' informational value lives in the *sequence* of revisions.
