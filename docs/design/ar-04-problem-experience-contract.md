# AR-04 — Problem Experience Reconciliation & Contract

Status: **M011 / AR-04 OWNER APPROVED / CLOSED (2026-09-11; see §22).** WU038 contract
review, WU039 implementation, and WU040 independent rendered verification are all
complete. OD-1 and OD-2 are both resolved (§8); zero OWNER_DECISION_REQUIRED items
remain. Checkpoints C039, C040, and C041 all recorded validation and acceptance as
passed, with zero AR-04 FAIL findings. The repository owner has explicitly closed
M011. See §22 for the closure record.

Scope: reconciles the existing public Problem experience (`ProblemView.tsx`,
`ProblemHistoryView.tsx`, `problemProjection.ts`, `ContextTabs.tsx`, and their
supporting Problem-domain components) against canonical PRB semantics
(`docs/datamodel.md`), current production behaviour, current design-system authority
(`docs/design/foundations.md`, `docs/design/component-model.md`,
`docs/design/component-visual-contract.md`,
`docs/design/ds-04b-foundation-consolidation-contract.md`), and representative real
Problem records. It defines the exact bounded implementation contract for WU039 and
the exact rendered-verification matrix for WU040.

Authority: this document sits under [docs/design/](README.md) per its authority
hierarchy. It does not redefine [foundations](foundations.md),
[component model](component-model.md), [component visual contract](component-visual-contract.md),
[Explorer architecture](../explorerarchitecture.md), or
[research-data semantics](../datamodel.md) — those remain the design-intent and
semantic canon. This document owns only the AR-04 reconciliation findings and the
WU039/WU040 bounded contract.

---

## 1. Status and authority

- **M011 — AR-04 Knowledge-First Problem Experience.** WU038 is analysis/design-contract
  work only; it makes no runtime, schema, or canonical-research change.
- This contract is subordinate to `docs/explorerarchitecture.md`,
  `docs/design/foundations.md`, `docs/design/component-model.md`,
  `docs/design/component-visual-contract.md`, and
  `docs/design/ds-04b-foundation-consolidation-contract.md`. Any apparent conflict
  between a finding below and one of those documents is resolved in that document's
  favour; this contract records the conflict as OWNER_DECISION_REQUIRED rather than
  silently overriding it.
- DS-04B foundation values are owner-frozen for the M010 migration scope
  (`ds-04b-foundation-consolidation-contract.md` §H.1). This contract proposes no
  change to any frozen value. See §17.

## 2. AR-04 objective and boundary

Objective: determine, with rendered evidence against real canonical PRBs, whether the
existing Problem experience (`Problema` + `Histórico` contexts, per
`explorerarchitecture.md` §3) already satisfies the "knowledge-first" reading
objective — legible current state, distinguishable supporting/boundary evidence,
comprehensible uncertainty, proportionate technical inspection — and to bound exactly
what, if anything, must change.

In scope: `ProblemView.tsx`, `ProblemHistoryView.tsx`, `problemProjection.ts`,
`ContextTabs.tsx` (as consumed by the Problem contexts), `InvestigationStatus.tsx`,
`ProblemLifecycleStatus.tsx`, `statusGloss.ts`, `effectSummary.ts`, and the
Problem-domain CSS selectors these files render through (`.problem-*`,
`.status-chip-row`, `.evidence-*`, `.open-question-*`, `.effect-summary*`,
`.detail-rail-type-note`, `.lyt-reading*` as consumed by Problem).

Out of scope (per WU038 packet and AGENTS.md §2 scope control): Records, Overview,
Graph, Source or Evidence-detail redesign; DS-04B owner-frozen value changes; AR-05
provenance/discovery work; D7; repair of C008/C009/C010; any runtime implementation.

## 3. Representative PRBs inspected and why

Twelve canonical `PRB-*` records exist (`research/problems/PRB-0001.yaml` through
`PRB-0012.yaml`, all `status: OPEN`). Four were inspected in the rendered production
preview build to exercise materially different canonical states:

| PRB | Why selected |
| --- | --- |
| **PRB-0006** | Information-rich: 630-line record, full `decision_basis` (manifestation, consequence, currentness, scope, `contradiction_search.performed: true`, `supporting_evidence`/`boundary_evidence` both populated), 11 evidence relationships spanning all four effects (`SUPPORTS`/`REFINES`/`BOUNDS`/`CONTRADICTS`), one authored history entry with a real `validation_status` transition, all three `investigation.path` stages authored. Exercises nearly every conditional branch in `ProblemView.tsx` simultaneously. |
| **PRB-0012** | Comparatively sparse: 110-line record, **no `decision_basis` at all** (so "Estado atual" is correctly absent per `hasCurrentStateContent`), no authored history, only 3 evidence relationships, no `supporting_evidence`/`boundary_evidence` (all evidence falls into "Outra evidência relacionada"). Exercises the omission-not-fabrication path end-to-end and the section-index's conditional presence at its most reduced state. |
| **PRB-0007** | Richest authored material history (3 entries, 2026-08-31 through 2026-09-09), but **none of the three entries authors `state_changes` or `evidence`** on the history item. Exercises `ProblemHistoryView.tsx`'s `StateChanges`/`HistoryEvidenceLinks` omission path — confirms these are not silently fabricated when absent. |
| **PRB-0006** (history) | Its one history entry *does* author `state_changes.validation_status` (`unvalidated` → `partially_validated`), confirmed rendered correctly ("Estado de validação: Por validar → Parcialmente validado"), which PRB-0007 alone could not exercise. |

This selection covers: full decision-basis vs. entirely absent decision-basis; dense
multi-effect evidence vs. minimal evidence; authored-but-fieldless history vs.
authored history with a real state transition; and all three `investigation.path`
stages present vs. open-questions-only.

## 4. Current-state findings — method

Findings were established by: (a) reading `ProblemView.tsx`, `ProblemHistoryView.tsx`,
`problemProjection.ts`, `ContextTabs.tsx`, `InvestigationStatus.tsx`,
`ProblemLifecycleStatus.tsx`, `statusGloss.ts` in full; (b) reading
`ProblemView.test.tsx` (176 lines, 13 cases) and `ProblemHistoryView.test.tsx` (69
lines) for existing behavioural guarantees; (c) building the production bundle
(`npm run build`) and serving it via `npm run preview` on port 4173 (never the Vite
dev server); (d) rendered inspection via Playwright at desktop (1440×900), the
768–1059px geometry-fallback band (900×800), and the compact QA viewport (360×740),
for both `?view=problem&id=PRB-0006`/`PRB-0012` and `?view=history&id=PRB-0006`/`PRB-0007`;
(e) DOM/accessibility queries (heading list, landmark list, focus-on-load,
`scrollWidth`/`clientWidth` overflow check, `<details>`-open state of the duplicate
section-index instances).

## 5. NO_CHANGE decisions

Each finding below is a concern actively evaluated against rendered evidence and
found already correct; no WU039 action is authorized for it.

1. **Conditional section/subsection presence is canonically faithful.** PRB-0012 (no
   `decision_basis`) correctly omits the entire "Estado atual" section
   (`hasCurrentStateContent` returns false) and the "Nesta página" index correctly
   omits it too — confirmed by rendered inspection, not just code reading. No field
   meaning is invented; missing stays missing (AGENTS.md "Evidence integrity").
2. **History omission is canonically faithful.** PRB-0007's three history entries
   author no `state_changes`/`evidence`; `StateChanges`/`HistoryEvidenceLinks` both
   correctly render nothing for them (confirmed rendered, not merely by code
   inspection). PRB-0006's one history entry, which does author
   `state_changes.validation_status`, renders the transition correctly
   ("Por validar → Parcialmente validado"). Neither over- nor under-renders relative
   to the authored record.
3. **Evidence partition (supporting/boundary/other) is deterministic and
   non-overlapping.** Confirmed rendered on PRB-0006 (4 supporting / 7 boundary / 0
   other, matching `decision_basis.supporting_evidence`/`boundary_evidence` exactly)
   and by the existing `groups each linked EVD once` test. No item repeats across
   groups.
4. **Effect chips and the aggregate effect-occurrence summary are legible and
   explicitly captioned as non-ranking.** Rendered evidence cards show effect chips
   ("Efeito: → Sustenta", "Efeito: → Refina") directly on each card, and the
   `EffectOccurrenceSummary` explicitly states "os papéis indicados não representam
   força, confiança ou classificação" — satisfying `datamodel.md` §2's requirement
   that effects/roles never imply strength.
5. **Status dimensions remain visually and semantically separate.** `status`,
   `evidence_status`, `validation_status` render as three distinct captioned chips in
   "Estado atual" (`ProblemLifecycleStatus`/`EvidenceStatus`/`ValidationStatus`), each
   with its own caption, matching `component-visual-contract.md`'s "remain separate
   semantic/domain dimensions" invariant. No merged/collapsed chip observed.
6. **Responsive recomposition matches the approved contract exactly.** Rendered at
   1440px: 720/44/216 reading composition with sticky rail. Rendered at 900px
   (768–1059px band): single column, same font sizes as desktop (no compact
   typography activated), matching `foundations.md` "Responsive reading" and
   `component-model.md` principle 7. Rendered at 360px: single column, section index
   available in-flow as a closed, discoverable `<details>` disclosure, independent of
   the "O que é um Problema…" help disclosure (confirmed by existing DS-05H tests and
   re-confirmed rendered).
7. **No Problem-attributable horizontal overflow.** At 360px, `document.documentElement`
   shows a 9px `scrollWidth`/`clientWidth` delta, but DOM inspection traces it to
   `.explorer-navigation` at the app-chrome level (`Explorer.tsx`), reproducible with
   no Problem content on the page. This is the same pre-existing, already-classified
   observation named in `ds-04b-foundation-consolidation-contract.md` §H.1 and the
   WU038 packet's non-scope list; it is not a new Problem-specific finding and is not
   reclassified here. See §7 and §18.
8. **Duplicate rail/compact section-index landmarks are not an accessibility defect.**
   Both `nav[aria-label="Nesta página"]` (rail) and
   `nav[aria-label="Nesta página (versão compacta)"]` (compact) exist in the DOM
   simultaneously at every viewport, but the compact one sits inside a closed native
   `<details>` at desktop width (`insideClosedDetails: true`, `offsetParent: null`),
   which correctly removes it from the accessibility tree via native semantics. This
   matches `component-model.md` §4.3's "Native `<details>/<summary>` remains the
   generic disclosure primitive" contract exactly.
9. **Focus entry on load is correct.** `problem-heading` (the `<h2>`) receives focus
   on successful load (confirmed: `document.activeElement === heading`,
   `tabIndex: -1`), matching `ProblemContent`'s `headingRef.current?.focus()` effect
   and the existing focus-entry test coverage.
10. **Heading hierarchy inside the article is unbroken.** `<h2>` (problem title) →
    `<h3>` (section) → `<h4>` (subsection) with no level skipped, confirmed by the
    full rendered heading list on PRB-0006 (20 headings, strictly non-decreasing
    nesting).
11. **Landmark structure is correct and named.** `<article aria-labelledby="problem-heading">`,
    `<nav aria-label="Localização">` (breadcrumb), `<nav aria-label="Navegação de
    PRB-0006">` (ContextTabs), four `<section aria-label="…">` matching the four
    top-level content sections, `<aside>` (rail) — all present and correctly labelled
    in the rendered DOM, matching `component-model.md` §2.4's landmark-ownership
    principle.

## 6. CHANGE_REQUIRED contract

### CR-1: "Independência da evidência" interrupts the Evidência section's primary reading path — RESOLVED, OD-2 = APPROVED

- **Current evidence:** On PRB-0006 (rendered, desktop), the "Registos de evidência
  associados (11)" `<h3>` is immediately followed by an `<h4>Independência da
  evidência</h4>` and its full authored `decision_basis.independence_assessment`
  prose (~230 words in this fixture) — a dense, analytical, methodology-facing
  paragraph — *before* any evidence card or the "Evidência que suporta" group. It
  renders at `ProblemView.tsx:1013-1020`, immediately inside the `problem-evidencia`
  section, ahead of `EffectOccurrenceSummary` and every `EvidenceGroup`.
- **User/comprehension impact:** The section's stated question (`explorerarchitecture.md`
  §3, `Problema`: "supporting and contradictory Evidence") is answered by the evidence
  cards, not by the independence assessment. A reader arriving at "Evidência" via the
  section index lands on methodology prose about *how independently corroborated* the
  evidence is, before seeing what the evidence actually says. This is exactly the kind
  of case `explorerarchitecture.md` §6 flags: "technical/provenance inspection
  available without dominating the primary reading experience" — here it is not
  technical/hidden, it is placed first in the primary flow.
- **Owner decision (OD-2 = APPROVED, 2026-09-11):** CR-1's exact Evidência-section DOM
  order is fixed as:
  1. `EffectOccurrenceSummary`, when present;
  2. grouped evidence content — "Evidência que suporta", "Evidência que limita a
     conclusão", "Outra evidência relacionada" — OR the existing `EmptyState` when no
     evidence exists;
  3. `independence_assessment`, when authored.

  `independence_assessment` is therefore the final conditional content block inside
  the Evidência section.
- **Exact intended outcome:** Move `independence_assessment`'s rendering to the exact
  position above. The heading text, content, and conditional presence
  (`independenceAssessment &&`) are unchanged — this is a reorder within the existing
  `problem-evidencia` section, not new content or a new component. Do not alter its
  copy, its canonical source field, evidence grouping, `EffectOccurrenceSummary`
  semantics, or empty-state semantics. CR-1 remains DOM-order only.
- **Canonical semantic constraint:** `independence_assessment` remains
  `decision_basis`-owned authored prose (`datamodel.md` §3 "Decision basis" /
  "independence reasoning"); this change touches only its position in
  `ProblemContent`'s JSX, never its text, field source, or presence condition.
- **Smallest implementation boundary:** `apps/research-explorer/src/problem/ProblemView.tsx`,
  the `problem-evidencia` `<section>` block only (currently lines ~1013–1036). No
  other file. No new component, no CSS change (the `.problem-current-state-item`
  wrapper is reused as-is).
- **Verification method:** `ProblemView.test.tsx` must include an order-sensitive
  assertion proving the approved order (e.g. comparing DOM position of the
  independence-assessment text node against `EffectOccurrenceSummary` and the
  evidence groups) on PRB-0006 (the only fixture among the four inspected with
  `independence_assessment` authored) — the existing test `"presents authored current
  state, scope, questions, path and contradiction search"` in `ProblemView.test.tsx`
  asserts presence, not order, and does not by itself satisfy this. WU040 must verify
  the order in the built artifact with representative real records. See §16.

### CR-2: Open-question internal detail labels must not visually read as "Estado atual" fact blocks — RESOLVED, OD-1 = APPROVED

- **Current evidence:** `OpenQuestionItem` (`ProblemView.tsx:796-835`) renders each
  optional field (`why_open`, `current_action`, `latest_result`,
  `resolution_condition`) as its own `<div className="problem-current-state-item">`
  with an `<h4>` — identical DOM shape to "Estado atual"'s manifestation/consequence/
  currentness items. Rendered on PRB-0006's single open question, this produces four
  consecutive `<h4>` mini-headings inside one `<li>`, visually and structurally
  indistinguishable from the four `<h4>` items in "Estado atual" above it, even though
  one is the Problem's authored current understanding and the other is one
  investigator's working notes on one open question.
- **User/comprehension impact:** A reader scanning by heading level cannot
  distinguish "this is the Problem's current state" from "this is process detail
  about one still-open question" — both present as a flat run of same-level `<h4>`
  items with no differentiating visual or structural cue beyond surrounding prose.
  This is a real but low-severity information-hierarchy concern: `explorerarchitecture.md`
  §3 requires "uncertainty and unresolved gaps" to be foreground content, which it is,
  but the *shared* heading anatomy with "Estado atual" risks flattening the
  distinction between settled and unsettled content that the section title itself
  ("O que ainda não sabemos") already establishes in prose.
- **Owner decision (OD-1 = APPROVED, 2026-09-11):** CR-2 is authorized. Open-question
  internal metadata labels must not visually read as another "Estado atual" fact
  block. Semantic structure remains unchanged: the primary open question remains the
  question; internal labels remain semantic `<h4>` headings; no copy or canonical
  field meaning changes.
- **Exact intended outcome / implementation contract:**
  - In `ProblemView.tsx`: add `className="open-question-detail-label"` to the `<h4>`
    labels belonging to open-question internal detail blocks (the four labels
    rendered inside `OpenQuestionItem`'s `.problem-current-state-item` blocks: "Porque
    continua em aberto", "O que estamos a fazer", "O que aprendemos mais
    recentemente", "O que permitiria esclarecer"). Do not change their text. Do not
    change their heading level. Do not alter the primary `.open-question-question`
    treatment.
  - In `apps/research-explorer/src/index.css`, add exactly one narrowly scoped
    override, with no other declarations for this selector:
    ```css
    .problem-current-state-item h4.open-question-detail-label {
      text-transform: none;
      letter-spacing: normal;
    }
    ```
  - Margin, colour, font family, font size, and font weight remain inherited from
    the current canonical nested-label treatment — not restated, not overridden.
  - No DS-04B token/value change is authorized by this override.
- **Canonical semantic constraint:** No field meaning, order, or presence changes.
  Only the visual/structural weight of these four labels (via one scoped CSS override
  removing inherited uppercase/letter-spacing) is affected.
- **Smallest implementation boundary:** `ProblemView.tsx`'s `OpenQuestionItem`
  function (className addition only) and one new selector in `index.css`. No new
  component, no shared-primitive change.
- **Verification method:** WU040 must visually confirm, on PRB-0006 (its single open
  question authors all four optional fields): "Estado atual" labels retain their
  existing uppercase treatment; open-question internal labels render sentence-case;
  hierarchy remains clear at all required viewports; heading semantics (tag, level,
  text) remain unchanged. See §16.

## 7. OUT_OF_SCOPE items

The following were observed but are explicitly not AR-04 work, per the WU038 packet
and AGENTS.md §2 scope control:

- **`.explorer-navigation`/body `system-ui` literal font-family behaviour** — reproduced
  during this WU038 inspection (9px `scrollWidth` delta at 360px, traced to app-chrome,
  not Problem content) but already named as an accepted, not-legitimized WU037
  observation in `ds-04b-foundation-consolidation-contract.md` §H.1. Not
  independently proven to require Problem-experience-specific work; remains
  out of scope per the WU038 packet's explicit instruction.
- **`favicon.ico` 404** — reproduced (one console error on every navigation) but is
  the same pre-existing, already-classified observation named in §H.1 and the WU038
  packet. Out of scope.
- **WU040:vague-scope planning advisory** — pre-existing AIQT graph/review finding
  (`workunit:WU040:vague-scope`), not a Problem-experience defect; this contract's §16
  supplies WU040's exact verification matrix, which is the intended remedy, but WU038
  does not suppress or resolve the advisory finding itself.
- **`.problem-identity` header surface treatment** (the bordered box around
  title/statement/facts) — visually a boxed surface, which `foundations.md` "Surfaces
  and separators" reserves for "a real boundary, such as an interactive or stateful
  unit." The Problem identity zone plausibly qualifies as such a boundary (it is the
  record's primary identity block, analogous to Record Detail's own meaning zone
  treatment), and no rendered evidence in this WU038 inspection shows it reading as
  unintended cardification. Not raised as CHANGE_REQUIRED because no concrete
  comprehension harm was observed; noted here only so it is not silently reintroduced
  as an undocumented assumption.
- **"Origem: registos de fonte de proveniência relacionados abaixo." wording** — a
  minor copy redundancy (states "listed below" immediately above the list it
  describes) observed on every evidence card. This is copy-level, not structural or
  semantic, and does not meet the CHANGE_REQUIRED bar of "user/comprehension impact"
  established in §6 — the source list immediately follows and is unambiguous.
  Recorded here as a non-blocking observation only, per AGENTS.md §2 ("Record useful
  out-of-scope findings concisely and leave them for later work").
- **Records, Overview, Graph, Source/Evidence-detail redesign** — explicitly excluded
  by the WU038 packet; no finding in this contract touches those surfaces.
- **C008/C009/C010 broken checkpoint-packet references** — see §20; pre-existing
  historical AIQT graph debt, unrelated to the Problem experience, not repaired here.

## 8. Owner decisions (resolved — zero OWNER_DECISION_REQUIRED items remain)

Both items below were OWNER_DECISION_REQUIRED as of the original WU038 reconciliation
and were resolved by the WU038 owner contract review (2026-09-11; PASS). See §21 for
the full owner decision record. No OWNER_DECISION_REQUIRED item remains in this
contract.

### OD-1: Open-question sub-item heading treatment (CR-2) — APPROVED

Whether `OpenQuestionItem`'s four optional `<h4>` sub-items (`why_open`,
`current_action`, `latest_result`, `resolution_condition`) should receive a
visually/structurally distinguishing treatment from "Estado atual"'s same-shaped
`<h4>` items was OWNER_DECISION_REQUIRED because neither reading was decidable from
canonical or rendered evidence alone. **The owner approved CR-2**: open-question
internal metadata labels must not visually read as another "Estado atual" fact block.
The exact resolved implementation contract is recorded in CR-2 (§6) and is binding on
WU039 exactly as written there — no further interpretation is required or permitted.

### OD-2: Depth of independence-assessment reordering (CR-1) — APPROVED

CR-1's exact reorder target was left open between "immediately before" and
"immediately after" `EffectOccurrenceSummary`. **The owner approved the exact order**:
`EffectOccurrenceSummary` (if present) → grouped evidence content or `EmptyState` →
`independence_assessment` (if authored) — i.e. `independence_assessment` becomes the
final conditional content block in the Evidência section. The exact resolved order is
recorded in CR-1 (§6) and is binding on WU039 exactly as written there.

## 9. Information hierarchy contract

For WU039 (bounded to CR-1 and CR-2, both approved per §8):

- The "Evidência" section's primary reading order becomes: heading with count →
  `EffectOccurrenceSummary` (if evidence exists) → "Evidência que suporta" →
  "Evidência que limita a conclusão" → "Outra evidência relacionada" →
  `independence_assessment` (if authored). No other section's internal order changes.
- Open-question internal detail labels (`why_open`, `current_action`, `latest_result`,
  `resolution_condition`) receive the `open-question-detail-label` treatment (CR-2, §6)
  so they no longer visually read as "Estado atual" fact blocks, while remaining
  semantic `<h4>` headings with unchanged text and level.
- No other section's information hierarchy is touched. "Estado atual" and "Como
  chegámos a este problema" keep their current internal order and visual treatment
  exactly.
- Current/state legibility, supporting-vs-boundary distinguishability, and
  uncertainty/open-question comprehensibility were all found NO_CHANGE (§5) and this
  contract does not reopen them beyond CR-2's narrowly scoped label treatment.

## 10. Canonical-content/semantic invariants (binding on WU039)

- No field meaning, gloss, or enum label may change. `statusGloss.ts`,
  `publicEnumLabel`, `publicCompactEnumLabel` are untouched by WU039.
- No confidence, causality, or currentness may be invented. Every value WU039 renders
  must already be rendered today, in the same textual form — WU039 changes only
  *where* `independence_assessment` appears and *how* the open-question sub-item
  headings are styled, never *what* any of them say.
  `decision_basis.independence_assessment`'s text, its conditional presence
  (`independenceAssessment &&` at `ProblemView.tsx:1015`), and its field source are
  unchanged. The open-question sub-item labels' text, field source, and heading level
  are unchanged — only a `className` and one scoped CSS override are added.
- Missing information remains missing: `hasCurrentStateContent`,
  `groupEvidenceByDecisionBasis`, `openQuestions`, `contradictionSearch`,
  `investigationPathStages` and every other extractor in `ProblemView.tsx` are
  unchanged by this contract. WU039 must not add, remove, or alter any conditional
  presence rule.
- Supporting vs. boundary evidence partitioning (`groupEvidenceByDecisionBasis`)
  remains exactly as implemented — deterministic, dedup-by-ID, authored-list-membership
  only. WU039 does not touch `problemProjection.ts` or the grouping function.
- `problemSectionIndex`/`PROBLEM_SECTION_ENTRIES` (`ProblemView.tsx:340-395`) must
  continue to mirror rendered section/subsection presence exactly. CR-1's reorder is
  *within* the already-indexed "Evidência" section (the section index links to
  `#problem-evidencia-suporta`/`-limita`/`-outra`, none of which move); no anchor ID,
  label, or index entry changes.

## 11. Responsive contract (binding on WU039)

- CR-1's reorder is a DOM-order change only, inside the existing
  `.lyt-reading-main`/`problem-evidencia` structure. It has no responsive-specific
  behaviour and must render identically (content order, not layout) at desktop,
  768–1059px, and compact — because `ReadingLayout`'s recomposition (single column at
  <1060px) does not reorder content within a column, only the column arrangement
  itself (`reading-layout.css`).
- CR-2's `open-question-detail-label` override (§6) touches only `text-transform` and
  `letter-spacing`; it must not shrink body/metadata text at any breakpoint
  (`foundations.md` "Responsive reading") and must be verified at all three WU040
  viewport bands (§16).
- No change in this contract alters `.lyt-reading`, `.lyt-reading-main`,
  `.lyt-reading-rail`, `ProblemReadingRail`, `ProblemCompactSectionIndex`, or any
  section-index component. Rail/compact index equivalence (DS-05H, existing tests)
  must continue to pass unmodified.

## 12. Accessibility contract (binding on WU039)

- CR-1 must preserve the existing heading level (`<h4>Independência da evidência</h4>`)
  and its existing `.problem-current-state-item` wrapper semantics; only its DOM
  position within the section moves. Heading-level nesting (`<h3>` section → `<h4>`
  items) remains unbroken after the move.
- No landmark, `aria-label`, or `aria-labelledby` changes. The `problem-evidencia`
  `<section aria-label="Evidência">` boundary and its single heading are unchanged.
- CR-2's approved treatment (§6) does not rely on colour alone
  (`foundations.md` "Colour and contrast intent") — it removes inherited
  `text-transform`/`letter-spacing` only — and does not introduce a new landmark or
  change the existing flat `<h4>` semantic level: heading tag, level, and text remain
  exactly as today.
- Existing keyboard/focus-entry behaviour (`headingRef.current?.focus()` on load,
  `errorRef` on error) is untouched by both CR-1 and CR-2.

## 13. Shared-vs-domain component ownership

- CR-1 touches `ProblemView.tsx` only — a page-composition file per
  `component-model.md` §2.5, which "retains its authored-section order and its single
  presence/index authority" (§4.5). Reordering content within that file is exactly
  the kind of change page composition owns; it requires no new shared component, no
  layout-primitive change, and no Generic UI extraction.
- `.problem-current-state-item` remains Problem-domain-local
  (`component-model.md` §4.2 does not list it as a shared primitive candidate). CR-2's
  approved `open-question-detail-label` override does not promote it to a shared
  component — it is a Problem-domain-scoped CSS addition targeting a narrow
  descendant selector (`.problem-current-state-item h4.open-question-detail-label`),
  per `component-model.md` principle 3 ("Reuse proceeds from layout to semantics, CSS
  first").
- No finding in this contract requires a new domain component, a new layout
  primitive, or a new Generic UI primitive. `RecordIdentifier`, `RecordTypeLabel`,
  `EvidenceEffectTag`, `RailSectionIndex`, `CompactSectionIndex`, `Breadcrumb`,
  `ContextTabs`, `ProgressMessage`, `ErrorNotice`, `EmptyState` are all already
  correctly adopted in the current Problem experience and are unaffected.

## 14. WU039 implementation file boundary

This boundary is execution-deterministic: both CR-1 and CR-2 are approved (§8), so
there is no conditional file. **Exactly three files, and no others:**

- `apps/research-explorer/src/problem/ProblemView.tsx`
  - CR-1: reorder within the `problem-evidencia` section (function `ProblemContent`,
    JSX only — no extractor function signature changes) to the exact order approved
    in §6/§8 OD-2.
  - CR-2: add `className="open-question-detail-label"` to the four `<h4>` labels
    inside `OpenQuestionItem`'s `.problem-current-state-item` blocks. No text change,
    no heading-level change, no change to `.open-question-question`.
- `apps/research-explorer/src/index.css`
  - CR-2 only: add exactly the one selector specified in §6 —
    `.problem-current-state-item h4.open-question-detail-label { text-transform:
    none; letter-spacing: normal; }` — with no other declarations, no change to any
    existing selector, and no DS-04B token introduction.
- `apps/research-explorer/src/problem/ProblemView.test.tsx`
  - CR-1: a new order-sensitive assertion proving the approved Evidência-section
    order (§6, §8 OD-2).
  - CR-2: a new assertion(s) confirming the `open-question-detail-label` className is
    present on the four open-question detail `<h4>` labels and absent from "Estado
    atual"'s `<h4>` items.
  - No existing test's expected behaviour may change (all 13 current
    `ProblemView.test.tsx` cases must continue to pass unmodified, since no
    field/label/presence semantics change).

**CR-1 file mapping:** `ProblemView.tsx` + `ProblemView.test.tsx`.
**CR-2 file mapping:** `ProblemView.tsx` + `index.css` + `ProblemView.test.tsx`.

**WU039 must not change:** `ProblemHistoryView.tsx`, `problemProjection.ts`,
`ContextTabs.tsx`, `InvestigationStatus.tsx`, `ProblemLifecycleStatus.tsx`,
`statusGloss.ts`, `effectSummary.ts`, any file under `apps/research-explorer/src/records/`,
`apps/research-explorer/src/navigation/` (other than as an unmodified import),
`apps/research-explorer/src/styles/reading-layout.css`,
`apps/research-explorer/src/styles/section-index.css`, any `research/**` canonical
data, any schema, `.aiqt/state.json`, `.aiqt/runlog.jsonl`, or any file not listed
above. Discovery of a need to touch a file outside this list is a contract gap: WU039
must stop and return for a WU038 amendment, not improvise.

## 15. WU039 test/validation expectations

- `npm run typecheck` (research-explorer) — must pass unchanged.
- `npm run test` (Vitest, research-explorer) — all existing `ProblemView.test.tsx`
  (13 cases) and `ProblemHistoryView.test.tsx` cases must continue to pass unmodified;
  WU039 adds the CR-1 order assertion and the CR-2 className assertions (§6, §14).
- `npm run build` (research-explorer) — must succeed with no new warnings.
- `npm run research:validate` — must pass unchanged (WU039 touches no canonical
  research data).
- No new test framework, dependency, or Storybook story is required or authorized by
  this contract.

## 16. WU040 built-artifact verification matrix

Primary gate: **production build served via `npm run preview`** (never the Vite dev
server), matching the method used for this WU038 reconciliation.

Required checks, all performed against the served production preview build, on
**PRB-0006** (exercises CR-1 directly — it is the only one of the four WU038 fixtures
with authored `independence_assessment`) and **PRB-0012** (confirms the sparse/no-
`decision_basis` path is unaffected by CR-1's reorder):

1. **Desktop viewport 1440×900** — confirm, on PRB-0006, that
   `independence_assessment` renders as the final conditional block in the Evidência
   section, after `EffectOccurrenceSummary` and all three evidence groups (§6/§8
   OD-2's exact approved order), and before the "O que ainda não sabemos" section;
   confirm PRB-0012's "Evidência" section (no `independence_assessment`, no
   `decision_basis`) is visually unchanged from this WU038 reconciliation's rendered
   evidence. Confirm, on PRB-0006 (its one open question authors all four optional
   fields), that "Estado atual" labels retain their existing uppercase treatment while
   the four open-question internal detail labels ("Porque continua em aberto", "O que
   estamos a fazer", "O que aprendemos mais recentemente", "O que permitiria
   esclarecer") render sentence-case.
2. **Compact viewport 360×740** — same PRB-0006/PRB-0012 checks (evidence order and
   CR-2 label casing); confirm no new horizontal overflow is introduced (baseline: the
   pre-existing 354/345px `.explorer-navigation` delta from §7 must not grow).
3. **Representative check within 768–1059px** (e.g. 900×800) — confirm the
   single-column recomposition still applies, the CR-1 reorder holds in that column
   with no compact typography activated, and CR-2's sentence-case label treatment
   holds at this band.
4. **Section-index equivalence** — confirm rail and compact "Nesta página" indexes
   still expose identical ordered entries/hrefs post-change (re-run the rendered
   equivalent of the existing DS-05H assertions against the built artifact).
5. **Keyboard and focus verification** — tab through the reordered "Evidência"
   section on PRB-0006, confirming no interactive element (evidence-card record
   links) changed order in a way that breaks a logical tab sequence, and that
   `problem-heading` still receives focus on load.
6. **Heading semantics check** — confirm, via the accessibility tree or heading list
   (as done in this WU038 reconciliation, §4), that the four CR-2-styled labels remain
   `<h4>` elements with unchanged text and unchanged nesting under their `.open-question-item`
   `<li>`, and that overall heading hierarchy (§5, finding 10) remains unbroken.
7. **Browser console check** — no new errors/warnings at any tested viewport, on
   either fixture (the pre-existing `favicon.ico` 404 is expected and not a
   regression per §7).

WU040 must record its findings against this exact checklist and must not substitute
Storybook-only or dev-server-only evidence for any item above, matching the standard
already established by `ds-04b-foundation-consolidation-contract.md` §G.

## 17. DS-04B freeze protection

No item in this contract proposes, requires, or implies a change to any DS-04B
owner-frozen value (`ds-04b-foundation-consolidation-contract.md` §H.1: surface/ink/
separator roles, accent/accent-hover clay values, interface/reading/technical
typography roles, migrated spacing/radius roles, target sizing). CR-1 is a DOM-order
change with zero token/selector-value edits. CR-2's approved implementation (§6) is
bounded to exactly one *new* selector (§14) with exactly two declarations
(`text-transform: none`, `letter-spacing: normal`) and is explicitly prohibited from
redefining any existing selector or introducing a new DS-04B-namespaced token —
consistent with `ds-04b-foundation-consolidation-contract.md` §F's prohibition on
introducing new tokens to close a gap, applied here by analogy since WU039 is a
distinct, later work unit under a different contract but touches the same production
stylesheet surface.

## 18. AR-05 / D7 boundary

This contract does not authorize, anticipate, or scope any AR-05 provenance/discovery
work or any D7 activity. The `.explorer-navigation`/`system-ui` literal and
`favicon.ico` 404 observations reproduced during this reconciliation (§7) remain
exactly the pre-existing out-of-scope items named in
`ds-04b-foundation-consolidation-contract.md` §H.1; this contract does not
reclassify, escalate, or schedule them into any future work unit.

## 19. Owner contract-review gate

**This gate has been satisfied.** WU038 owner contract review = **PASS**
(2026-09-11). OD-1 and OD-2 (§8) are both resolved and their exact resolutions are
recorded in CR-1/CR-2 (§6) and §21. Zero OWNER_DECISION_REQUIRED items remain in this
contract.

Satisfying this gate resolves the contract's own open decisions; it does not by
itself authorize WU039 to start. WU038 does not authorize WU039 by its own
completion, and a passed contract review does not substitute for that separate
authorization. The AIQT dependency `WU038 → WU039` (`state.json`) requires this
contract to exist and be owner-approved before implementation may begin — that
mechanical precondition is now satisfied — but WU039 additionally requires its own
owner start gate before any implementation work begins (§21).

## 20. Pre-existing graph debt (reported, not repaired)

`aiqt graph validate` and `aiqt review` report three pre-existing critical/high
findings — `GRAPH-VALIDATE-BROKEN-CHECKPOINT-PACKET-REFERENCE` for checkpoints C008,
C009, and C010 (each references a `packetId` not present in
`state.lastAgentPacket`/runlog history) — and one medium finding,
`workunit:WU040:vague-scope` (WU040 has an empty `scope`/`outOfScope`/`suggestedFiles`
list in `.aiqt/state.json`, which this contract's §16 addresses in substance without
touching that AIQT state field). All four are historical/pre-existing, confirmed
present before any WU038 change, and are explicitly out of WU038's authorized scope
to repair, suppress, or mutate.

## 21. Owner decision record

- **WU038 owner contract review = PASS.**
- **OD-1 = APPROVED.** CR-2 (open-question internal detail label treatment) is
  authorized exactly as specified in §6/§14.
- **OD-2 = APPROVED.** CR-1's exact Evidência-section DOM order is fixed exactly as
  specified in §6/§14: `EffectOccurrenceSummary` (if present) → grouped evidence
  content or `EmptyState` → `independence_assessment` (if authored), as the final
  conditional block.
- **Date:** 2026-09-11.
- **WU039 remains mechanically ready** (per AIQT's dependency computation once WU038
  was marked done) **but is NOT owner-authorized to start.** WU039 requires a
  separate owner start gate distinct from this contract-review gate.
- **AR-05 and D7 remain unauthorized** by this decision record, consistent with §18.
- This decision record persists the owner's resolution of OD-1/OD-2 into the
  canonical contract; it does not itself constitute a WU039 start authorization, does
  not create or amend any AIQT checkpoint, and does not modify `.aiqt/state.json` or
  `.aiqt/runlog.jsonl`.

## 22. Owner closure

Status: OWNER APPROVED / CLOSED

The repository owner explicitly closed M011 after:
- WU038 completed the reconciliation and implementation contract (§1–§21);
- WU039 implemented CR-1 and CR-2 exactly within the approved §14 file boundary;
- WU040 independently verified the built production artifact against the §16
  rendered-verification matrix on real canonical PRB-0006 and PRB-0012 across the
  1440×900, 900×800, and 360×740 viewports;
- checkpoints C039, C040, and C041 all recorded `validationResult: passed` and
  `acceptanceCriteriaResult: passed`, with zero AR-04 FAIL findings across all three
  work units.

### Final approved AR-04 outcomes

**CR-1** — the Evidência section's rendered reading order is fixed as:
1. `EffectOccurrenceSummary` (if present);
2. grouped evidence content (`Evidência que suporta` / `Evidência que limita a
   conclusão` / `Outra evidência relacionada`) or `EmptyState`;
3. `independence_assessment` (if authored), as the final conditional block.

No canonical field meaning, copy, evidence grouping, or effect semantics changed by
this reorder.

**CR-2** — the four `OpenQuestionItem` internal detail labels (`why_open`,
`current_action`, `latest_result`, `resolution_condition`) remain semantic `<h4>`
headings with unchanged text and heading level, rendered sentence-case via the
`open-question-detail-label` treatment. "Estado atual"'s labels retain their existing
uppercase treatment unchanged. No DS-04B foundation value was introduced or altered by
this treatment.

### Accepted observations not legitimized by this closure

The following remain separately known, out-of-scope observations and are **not**
legitimized or adopted as desired AR-04 behaviour by this decision:

- the pre-existing 9px `.explorer-navigation` app-chrome horizontal-overflow delta at
  360px (§7);
- the pre-existing `favicon.ico` 404 (§7);
- historical C008/C009/C010 checkpoint-packet-reference debt (§20).

They remain separate known matters and may be addressed only through separately
authorized work.

### Closure statement

M011 / AR-04 Knowledge-First Problem Experience is owner-closed.

This closure does **not** authorize:
- AR-05;
- D7;
- any successor work, milestone, or work unit;
- repair of C008/C009/C010;
- remediation of the accepted pre-existing/out-of-scope observations listed above.
