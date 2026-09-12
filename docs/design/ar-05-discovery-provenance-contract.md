# AR-05 — Discovery & Provenance Reconciliation & Contract

Status: **M012 / AR-05 WU041 CONTRACT — READY FOR OWNER CONTRACT REVIEW.** This
document is the sole WU041 deliverable. It makes no runtime, schema, or
canonical-research change. It contains four OWNER_DECISION_REQUIRED items (§8);
WU042's file boundary (§14) covers only the CHANGE_REQUIRED items that do not
depend on those decisions.

Scope: reconciles the existing canonical SRC → EVD → PRB relationship model, the
Explorer's build-time read model and client-side derivation code, and the
production-rendered discovery/provenance experience, against
`docs/datamodel.md`, `docs/explorerarchitecture.md`, and the approved
`docs/design/` contracts. It defines the exact bounded implementation contract
for WU042 (where fully determinable) and the exact rendered-verification matrix
for WU043.

Authority: this document sits under [docs/design/](README.md) per its authority
hierarchy. It does not redefine [foundations](foundations.md),
[component model](component-model.md),
[component visual contract](component-visual-contract.md),
[Explorer architecture](../explorerarchitecture.md), or
[research-data semantics](../datamodel.md) — those remain the design-intent and
semantic canon. This document owns only the AR-05 reconciliation findings and
the WU042/WU043 bounded contract.

---

## 1. Status and authority

- **M012 — AR-05 Discovery & Provenance.** WU041 is analysis/design-contract
  work only; it makes no runtime, schema, or canonical-research change.
- This contract is subordinate to `docs/datamodel.md`, `docs/explorerarchitecture.md`,
  `docs/design/foundations.md`, `docs/design/component-model.md`,
  `docs/design/component-visual-contract.md`, and
  `docs/design/ar-04-problem-experience-contract.md` (AR-04's closure and its
  §18 AR-05/D7 boundary are binding: this contract does not reopen AR-04's
  Problem-experience findings). Any apparent conflict between a finding below
  and one of those documents is resolved in that document's favour; this
  contract records the conflict as OWNER_DECISION_REQUIRED rather than
  silently overriding it.
- `research_roles[]` (on `PRB.evidence[]`) and `source.source_id` (on `EVD.provenance.sources[]`)
  are existing canonical schema fields, confirmed directly against
  `research/schemas/problem.schema.json`, `research/schemas/evidence.schema.json`,
  and real canonical records (§4). Neither is treated as missing schema
  anywhere in this contract.

## 2. AR-05 objective and explicit boundary

Objective: determine, with evidence from canonical schemas, canonical data,
read-model/projection code, and the rendered production build, what discovery
and provenance capability already exists in the Research Explorer; which
relationships are already deterministic; which backlinks are already
derivable without schema change; which information exists but is poorly
surfaced; which UX/navigation gaps are real; and which apparent gaps are
actually data/schema limitations requiring an owner decision. Then bound
exactly what WU042 may implement and what WU043 must independently verify.

In scope: `apps/research-explorer/src/records/*`, `apps/research-explorer/src/problem/*`
(only insofar as it touches PRB→EVD *discovery/provenance* presentation — not
AR-04's already-closed Evidência-order/open-question-label findings),
`apps/research-explorer/src/navigation/*`, `apps/research-explorer/src/graph/*`
(inspected as read-only context; no redesign proposed), `apps/research-explorer/scripts/*`
(the build-time read-model), and their supporting tests.

Out of scope (per the WU041 packet and AGENTS.md §2 scope control):

- canonical schema modification; adding new canonical fields; canonical-data
  backfill or edits; changing the meaning of existing research fields;
- automatic inference of provenance, research roles, evidence effects, source
  attribution, local relevance, or Problem support not already authored
  canonically;
- Graph redesign or visualisation overhaul (Graph is inspected as
  already-dormant context only — see §5.D and §7);
- AR-04's Problem-experience findings (CR-1/CR-2, already closed — see §1);
- DS-04B owner-frozen foundation values;
- D7 / Decision Horizon;
- repair of C008/C009/C010 (historical AIQT graph debt — see §12);
- any runtime/product/test/canonical-research/schema implementation (WU041
  performs none).

## 3. Canonical relationship model actually present

Confirmed directly against `research/schemas/problem.schema.json`,
`research/schemas/evidence.schema.json`, `research/schemas/source.schema.json`,
and representative real records (`research/problems/PRB-0001.yaml`,
`research/evidence/EVD-000001.yaml`, `research/evidence/EVD-000012.yaml`,
`research/sources/SRC-0002.yaml`, `research/sources/SRC-0017.yaml`).

- **PRB.evidence[]** — each relationship is
  `{ evidence_id: "EVD-xxxxxx", effects: [...], research_roles: [...] }`
  (`problem.schema.json` references entry, `itemField: "evidence_id"`,
  `targetPrefix: "EVD-"`). `effects` observed values: `SUPPORTS`, `REFINES`,
  `BOUNDS`, `CONTRADICTS`. `research_roles` observed values:
  `LOCAL_OBSERVATION`, `CONTEXTUAL`, `COMPARATIVE_MECHANISM`,
  `COMPARATIVE_RESPONSE`, `EXISTING_RESPONSE`, `PLANNED_RESPONSE`. Both fields
  are **existing, populated, schema-defined relationship properties** — they
  describe this Problem's use of the Evidence, per `datamodel.md` §2, and are
  not owned by the Evidence record itself. Confirmed: the same `EVD-000012`
  carries a *different* `effects`/`research_roles` set under `PRB-0004`
  (`REFINES` / `LOCAL_OBSERVATION`) than under `PRB-0005`
  (`BOUNDS, REFINES` / `LOCAL_OBSERVATION, EXISTING_RESPONSE`) — direct proof
  the relationship is edge-owned, not EVD-owned, and is already modelled
  correctly.
- **EVD.provenance.sources[]** — an array of `SRC-*` ID strings, required
  non-empty (`evidence.schema.json`). EVD additionally owns
  `provenance.extracted_at`, `observation.summary`, `scope`, `domains`,
  `evidence_nature`, `claim_authority`, optional `lineage_id`, and required
  `inference_limits[]`. EVD owns **no** PRB relationship, strength/confidence
  score, or research role — those remain exclusively PRB-owned, per
  `datamodel.md` §2.
- **SRC** — has `source_id` and **no** `references[]`/back-reference field of
  any kind in its schema. SRC does not, and per `datamodel.md` §1.1 boundary
  rules must not, author `evidence_ids`. Any SRC→EVD navigation is therefore
  necessarily derived from existing `EVD.provenance.sources[].source_id`
  values, never authored on SRC — confirmed this is exactly how the current
  implementation behaves (§5.B).
- **Corpus totals confirmed:** 12 PRB + 143 EVD + 119 SRC = 274 canonical
  records, matching the expected total exactly.
- **Reuse asymmetry (a load-bearing structural fact for this contract):**
  - EVD reuse across distinct PRBs is **rare**: of 110 distinct EVD IDs
    referenced in any PRB's top-level `evidence[]`, only 2 are cited by more
    than one PRB (`EVD-000011` by PRB-0001/PRB-0002; `EVD-000012` by
    PRB-0004/PRB-0005) — approximately 1.8%.
  - SRC reuse across distinct EVDs is **common**: of 116 distinct SRC IDs
    referenced via `EVD.provenance.sources[]`, 34 are cited by more than one
    EVD (~29%), with `SRC-0017` cited by 8 EVDs as the observed maximum.
  - Practical implication for WU042/WU043: any UI change affecting
    EVD→PRB backlinks should assume low fan-out (0–2 Problems); any change
    affecting SRC→EVD backlinks must render correctly at meaningfully higher
    fan-out (confirmed rendering correctly today up to 8 items — see §6).

## 4. Current discovery capability inventory

Confirmed by code inspection (`apps/research-explorer/src/records/recordIndex.ts`,
`RecordsTable.tsx`, `NarrowRecordsList.tsx`, `columns.ts`,
`apps/research-explorer/src/navigation/urlState.ts`,
`apps/research-explorer/src/graph/*`) and rendered inspection (§6).

1. **Search** — one free-text field matched against a precomputed,
   normalised `recordSearchText` (record ID, type, label, schema-enum
   "summary fields", and a bounded extra `searchText` blob). Confirmed
   rendered: the Records view exposes exactly one `Pesquisar` (search) input.
2. **Filter** — exactly one dimension beyond search: record type
   (`Todos` / `EVD-` / `PRB-` / `SRC-`), confirmed both in code
   (`RecordsFilterState` has only `query`/`typeFilter`) and rendered (the
   `Tipo` select is the only other control in `.records-controls`). **There is
   no filter by `effects`, `research_roles`, or `source`** — these live inside
   nested `evidence[]`/`provenance.sources[]` arrays, not at the
   schema-`enums` top level that `buildSummaryFields()` walks.
3. **Sort** — desktop `RecordsTable` sorts on exactly four generic columns:
   `id`, `type`, `label`, `file`. No sort by effect, role, or source exists.
   `NarrowRecordsList` has no independent sort of its own; it renders the same
   filtered/sorted/paginated rows the desktop table computed.
4. **Type navigation** — record type is a first-class filter and is shown as
   a label/badge on every record; this works today for all three types.
5. **Direct/deep links** — the URL scheme (`view`, `id`, `q`, `type`, `d`
   query params) is bookmarkable, reload-safe, and integrates with browser
   Back/Forward via `pushState`/`popstate`. A record detail of any type opens
   via `id` while `view=records` (or `view=problem` for the PRB-focused
   Problem View). Confirmed rendered: `?view=records&id=SRC-0017` and
   `?view=problem&id=PRB-0005` both open the correct detail directly from a
   fresh navigation.
6. **Related-record links** — implemented pervasively (see §5 for the
   provenance-specific ones): `RecordIdentifier` action variant,
   `TypedLinkButton`, and equivalent controls appear on Evidence→Source,
   Evidence→Problem, Source→Evidence, and Source→Problem relationships. **All
   of these are rendered as `<button type="button" onClick={...}>` elements
   that call `history.pushState`, never as `<a href>` anchors.** This means
   in-page cross-references do not support native middle-click/Ctrl+click
   "open in new tab" or browser status-bar hover preview, even though the
   resulting URL is itself a real, shareable, bookmarkable deep link once
   navigated to directly.
7. **Problem → Evidence navigation** — a Problem's Evidência section groups
   its evidence into "Evidência que suporta" / "Evidência que limita a
   conclusão" / "Outra evidência relacionada" (per AR-04, unchanged here) and
   each `EvidenceCard` links to the full EVD record.
8. **Evidence detail experience** — `EvdDetail.tsx` presents scope, inference
   limits, "Como é usada na investigação" (PRB uses — see §5.A), and
   provenance ("De onde vem esta evidência" — Source list, see §5.B),
   each with its own section-index entry (`#evd-scope`, `#evd-limits`,
   `#evd-investigation`, `#evd-sources`, `#evd-technical`).
9. **Source detail experience** — Overview, Coverage, Dates/access,
   Licensing, Caveats, "O que encontrámos" (Findings — see §5.C), "Na
   investigação" (Investigation — see §5.D), and Technical inspection, each
   with its own section-index entry.
10. **Graph** — implemented (`GraphExplorer.tsx`, `GraphCanvas.tsx`,
    `buildGraphModel.ts`) and would generically visualise every build-time
    edge (including `evidence` and `provenance.sources`) if reached, but is
    **confirmed dormant**: the "Grafo" nav button is rendered
    `aria-disabled="true"` with no `onClick` handler (a deliberate no-op, per
    an explicit code comment), and `urlState.ts` actively rewrites any
    `view=graph` URL to `view=problem` or `view=overview` before it can render
    — confirmed by direct navigation: the nav bar's "Grafo" button is present
    but inert in every rendered inspection performed for this contract.

**Distinguishing "capability exists" from "capability is understandable/useful
to a reader":** items 1–3 exist but are narrow (record-level only, no
relationship-property filtering); items 6 and 10 exist in code but are either
degraded (button-not-anchor) or fully inert (Graph) from a reader's point of
view. These distinctions drive the classification in §9–§10.

## 5. Current provenance capability inventory

All four items below were independently confirmed by direct code reading
*and* rendered inspection of the production build (§6), not by code reading
alone.

### A. PRB → EVD (forward) — asymmetric: `effects` renders, `research_roles` does not

- `apps/research-explorer/src/problem/problemProjection.ts` computes **both**
  `effects` and `researchRoles` per evidence relationship item into
  `EvidenceWithSources` (both fields present in the returned shape, and this
  presence is locked in by `problemProjection.test.ts`'s `toMatchObject`
  assertion).
- `apps/research-explorer/src/problem/ProblemView.tsx`'s `EvidenceCard`
  destructures and renders `effects` (via `EvidenceEffectTag`) but never
  destructures or renders `researchRoles` anywhere in the function.
  `effectSummary.ts`'s `summarizeEffects` (feeding the aggregate
  `EffectOccurrenceSummary`) also tallies only `effects`; there is no
  equivalent role tally.
- **Confirmed rendered** (`?view=problem&id=PRB-0005`, 1440×900): the
  Evidência section's `EffectOccurrenceSummary` and every `EvidenceCard`
  render effect chips only; a DOM query for role-tag elements
  (`.research-role-tag`) inside `#problem-evidencia` returns **zero** matches,
  even though the aggregate summary's caption text uses the word "papéis"
  (roles) only in explanatory prose about effects, never as an actual
  rendered role value.
- `ResearchRoleTag` (the component that renders `research_roles`, confirmed
  to exist and work correctly — see §5.A reverse direction below) is imported
  and used only in `EvdDetail.tsx`, never in `ProblemView.tsx`.
- **This is a presentation-layer gap, not a missing-data gap**: the value is
  already computed and available at the point `ProblemView.tsx` renders
  `EvidenceCard`; it is simply not passed through or displayed.
- **Test coverage note:** no `ProblemView.test.tsx` assertion checks whether
  `research_roles` renders or does not render in the Problem view — the
  existing test at line ~212–225 supplies a fixture with `research_roles` and
  no `effects`, asserting only the effect-missing fallback text. The absence
  of role rendering is not currently regression-locked in either direction.

### A (reverse). EVD → PRB backlink — already fully implemented, both effects and roles

- `apps/research-explorer/src/records/evdRelations.ts`'s `loadEvdProblemUses`
  derives candidate PRB IDs from the generic build-time `incomingEdges`
  (`field === "evidence"`), then re-reads each PRB's raw `evidence[]` array to
  recover the exact `effects`/`research_roles`/ordinal path for that specific
  relationship.
- `EvdDetail.tsx`'s "Como é usada na investigação" section renders, for each
  PRB use, a `FactList` with two rows: "Efeito" (`EvidenceEffectTag`) **and**
  "Papel" (`ResearchRoleTag`) — both dimensions fully surfaced.
- **Confirmed rendered** (`?view=records&id=EVD-000012`, 1440×900): both
  PRB-0004 ("Efeito: Refina" / "Papel: Observação local") and PRB-0005
  ("Efeito: Delimita, Refina" / "Papel: Observação local, Resposta
  existente") render correctly and distinctly, exactly matching the raw
  canonical relationship data for each PRB.
- Locked in by test: `EvdDetail.test.tsx` asserts the exact `["Efeito",
  "Papel"]` label pair, correct effect/role chip counts, and authored-order
  preservation, using real canonical fixtures (EVD-000012, EVD-000106,
  others).
- Zero-use empty state ("Esta evidência ainda não está ligada explicitamente
  a um Problema.") is implemented and tested.

**A + A(reverse) together are the single most consequential finding of this
contract** (see CR-1, §9): identical data, identical rendering primitives
(`EvidenceEffectTag`, `ResearchRoleTag` both already exist and are already
proven correct), rendered fully in one direction and only half-rendered in
the other.

### B. EVD → SRC (forward) — fully implemented, real navigable action

- `EvdDetail.tsx`'s `EvdSources` renders each `provenance.sources[]` ID as a
  `<button>` wired to `onSelect`, which `RecordDetailPanel.tsx` uses to
  navigate to that Source's own detail view.
- **Confirmed rendered** (`?view=records&id=EVD-000012`): "De onde vem esta
  evidência" shows `SRC-0003` as a clickable "Abrir fonte" (labelled with the
  Source's actual title) button.
- Locked in by test (`EvdDetail.test.tsx`): clicking the SRC button calls
  `onSelect("SRC-0002")` in the relevant fixture.

### C. SRC → EVD (reverse) — fully implemented, client-side derived

- `apps/research-explorer/src/records/sourceEvidenceRelations.ts`'s
  `loadSourceEvidenceRelations` derives related EVD IDs from the generic
  build-time `incomingEdges` (`field === "provenance.sources"`) on the Source
  detail record — **computed lazily in the browser at Source-detail-view
  time**, not precomputed into a dedicated read-model field.
- `SourceFindingsSection.tsx` ("O que encontrámos") renders a count fact
  ("Observações relacionadas") plus one navigable item per related EVD
  (`RecordIdentifier` action variant, or `variant="text"` fallback when no
  `onSelect` is supplied), each showing the EVD's observation summary and a
  compact scope/population/source `FactList`.
- **Confirmed rendered** (`?view=records&id=SRC-0017`, 1440×900): "O que
  encontrámos" shows "Observações relacionadas: 8" and all 8 related EVD IDs
  (EVD-000004 through EVD-000142) as working "Abrir EVD-xxxxxx" buttons, each
  with its own scope/population summary — confirming this renders correctly
  even at the corpus's highest observed SRC fan-out.
- Empty state ("Ainda não existem observações da investigação ligadas
  explicitamente a esta fonte.") is implemented for zero-EVD sources.

### D. SRC → PRB (transitive via EVD, reverse) — implemented, thinner test coverage

- `sourceEvidenceRelations.ts` also aggregates, from the same client-side
  traversal, each related PRB ID and the mediating EVD ID(s)
  (`viaEvidenceIds`) — shares one data load with §5.C (no duplicate fetch).
- `SourceInvestigationSection.tsx` ("Na investigação") renders each related
  PRB as a navigable action with a caption "Através de: EVD-x, EVD-y" listing
  mediating EVD IDs **as plain text** — a deliberate choice (documented in a
  code comment) to avoid duplicating the EVD navigation already available in
  "O que encontrámos". This section renders nothing (`return null`) when zero
  related Problems exist — unlike `SourceFindingsSection`'s explicit
  `EmptyState`, there is no user-visible "no related Problems" message.
- **Confirmed rendered** (`?view=records&id=SRC-0017`): "Na investigação"
  shows "Problemas relacionados" with PRB-0003 ("Através de: EVD-000004,
  EVD-000006"), PRB-0004 ("Através de: EVD-000005, EVD-000140, EVD-000141"),
  and PRB-0005 ("Através de: EVD-000007, EVD-000008, EVD-000142") — correctly
  deduplicated per PRB, correctly attributing the right mediating EVDs to
  each.
- **Test coverage note:** `SourceInvestigationSection.test.tsx` is a single
  minimal test (locks in only that one related PRB ID and its "Através de:"
  text appear) — materially thinner than `EvdDetail.test.tsx`'s equivalent
  EVD→PRB coverage (which exercises loading/error/empty states, multiple
  relationships, and both effect/role dimensions). This is a real,
  independently confirmable coverage gap, not a functional gap: the feature
  works correctly today (confirmed rendered above); its regression
  protection is comparatively weak.

`component-model.md`'s characterisation of `SourceFindingsSection` /
`SourceInvestigationSection` as existing "SRC→EVD provenance-derived
findings" and "SRC→EVD→PRB relation projection" is confirmed accurate by both
code and rendered evidence — this contract does not reclassify or duplicate
that existing capability.

## 6. Representative records inspected

Selected using the reuse/fan-out data in §3, not arbitrarily, to exercise the
corpus's actual structural extremes:

| Record | Why selected | Confirms |
| --- | --- | --- |
| **PRB-0005** / **PRB-0004** (via **EVD-000012**) | The rarer of only 2 EVD-reused-across-PRBs cases in the whole corpus; the relationship's `effects`/`research_roles` genuinely differ per PRB | §5.A forward-direction gap (rendered: zero role tags in PRB-0005's Evidência section); §3's edge-not-EVD-owned relationship model |
| **EVD-000012** | Same record, inspected directly | §5.A(reverse): both PRB uses render fully with distinct effect/role sets ("Refina"/"Observação local" vs. "Delimita, Refina"/"Observação local, Resposta existente") |
| **SRC-0017** | Highest SRC fan-out found in the corpus (8 citing EVDs) | §5.C/§5.D at realistic maximum scale — all 8 EVD backlinks and all 3 transitive PRB backlinks render correctly with no truncation, no overflow, no console error |
| **PRB-0012** | Sparse/minimal record: only 3 `evidence[]` relationships, no `decision_basis` at all (one of 7 PRBs lacking it; fewest evidence relationships of any PRB) | Confirms the omission-not-fabrication path still holds for AR-05's areas of interest — "Estado atual" correctly absent, all 3 evidence items correctly fall into "Outra evidência relacionada" with no forced/fabricated grouping |

No corpus case of an EVD cited across more than 2 PRBs was found; none was
fabricated to test a higher-fan-out case, consistent with AGENTS.md's evidence
integrity rule against inventing scenarios the canonical corpus does not
contain.

## 7. Rendered-experience observations

Built via `npm run build` (vite, 119 modules, no warnings) and served via
`npm run preview` on port 4173 (never the dev server), matching the method
established by AR-04's WU038/WU040.

- **1440×900** — `?view=problem&id=PRB-0005`: confirmed zero
  `.research-role-tag` elements inside `#problem-evidencia` (§5.A).
  `?view=records&id=EVD-000012`: confirmed both PRB-use rows render distinct
  effect+role pairs (§5.A reverse). `?view=records&id=SRC-0017`: confirmed 8
  EVD backlinks and 3 PRB backlinks with correct "Através de" attribution
  (§5.C/§5.D). `?view=records`: confirmed exactly two controls
  (`Pesquisar`, `Tipo`) in `.records-controls` (§4.2).
- **900×800** (768–1059px geometry-fallback band) — `?view=records&id=SRC-0017`:
  zero horizontal overflow (`scrollWidth === clientWidth === 885`); "Na
  investigação" backlinks still render correctly in the single-column
  recomposition; zero console warnings/errors.
- **360×740** (compact QA viewport) — `?view=records&id=SRC-0017`: a 9px
  `scrollWidth`/`clientWidth` delta was observed, traced (consistent with
  AR-04 §7 and `ds-04b-foundation-consolidation-contract.md` §H.1) to the
  same pre-existing `.explorer-navigation` app-chrome overflow, reproducible
  with no AR-05-relevant content on the page. This is not a new,
  AR-05-specific finding and is not reclassified here.
- **Console** — the only observed message across all inspected pages/
  viewports was the pre-existing `favicon.ico` 404 (already known, already
  out of scope per AR-04 §7/§18). Zero new errors or warnings on any
  discovery/provenance surface inspected.
- All representative records in §6 render with no fabricated content: PRB-0012
  correctly shows no "Estado atual" section and correctly groups all evidence
  under "Outra evidência relacionada" with no invented supporting/boundary
  classification.

## 8. Deterministic relationship/backlink matrix

| Relationship | Direction | Deterministically derivable from existing canonical data? | Current implementation status | Classification driver |
| --- | --- | --- | --- | --- |
| PRB → EVD (`effects`) | forward | Already authored, no derivation needed | Implemented and rendered (`EvidenceEffectTag`, `EffectOccurrenceSummary`) | NO_CHANGE (§9.1) |
| PRB → EVD (`research_roles`) | forward | Already authored, no derivation needed | **Computed, never rendered** in `ProblemView.tsx` | CHANGE_REQUIRED (§9, CR-1) |
| EVD → PRB (`effects` + `research_roles`) | reverse (backlink) | Yes — derivable from generic `incomingEdges` (`field: "evidence"`) plus a re-read of the owning PRB's raw relationship entry; no schema change needed | Already implemented, tested, rendered correctly (`EvdDetail.tsx` "Como é usada na investigação") | NO_CHANGE (§9.2) |
| EVD → SRC (`source_id`) | forward | Already authored, no derivation needed | Implemented and rendered as a real navigable action | NO_CHANGE (§9.3) |
| SRC → EVD | reverse (backlink) | Yes — derivable from generic `incomingEdges` (`field: "provenance.sources"`); no schema change, no duplicated canonical field needed | Already implemented, tested, rendered correctly at up to 8-item fan-out (`SourceFindingsSection.tsx`) | NO_CHANGE (§9.4) |
| SRC → PRB (transitive, via EVD) | reverse (backlink of a backlink) | Yes — derivable by composing the two edges above; no schema change needed | Already implemented, rendered correctly, but with materially thinner test coverage than its EVD→PRB sibling | CHANGE_REQUIRED, test-only (§9, CR-2) |
| Record-level filter/sort by `effects`/`research_roles`/`source` | n/a (discovery) | Partially — filtering by a nested relationship-array value is a materially different capability from the existing flat schema-`enums`-driven filter, and its UX shape (which record type's list view should expose it, whether it applies at the record level or the relationship level) is not decided by any existing canonical or design authority | Does not exist in any form | OWNER_DECISION_REQUIRED (§9, OD-1) |
| In-page cross-reference navigation semantics (button vs. anchor) | n/a (discovery) | N/A — this is a component/interaction-pattern question, not a data-derivation question | Universally `<button onClick>` + `history.pushState`, never `<a href>` | OWNER_DECISION_REQUIRED (§9, OD-2) |
| Graph reachability | n/a (discovery) | N/A | Implemented, generically models all SRC↔EVD↔PRB edges, but deliberately unreachable (`aria-disabled`, URL-level rewrite-away) | DEFER (§9, DF-1) — explicitly named out of scope by the WU041 packet ("Graph redesign/visualisation overhaul") |
| `SourceInvestigationSection`'s no-related-Problem empty state | n/a (discovery/consistency) | Already derivable — this is a presentation-consistency question only, no new derivation | Section renders nothing (`return null`) instead of an explicit empty-state message, unlike its `SourceFindingsSection` sibling | CHANGE_REQUIRED (§9, CR-3) |

No new canonical backlink is proposed anywhere in this matrix merely because
it is derivable — per AGENTS.md's provenance rules, every "NO_CHANGE" or
"CHANGE_REQUIRED" backlink item above is already either implemented as a
client-side/build-time *derived* relationship (never duplicated into
canonical data) or is recommended to remain exactly that way.

## 9. Findings register

Every material finding below has exactly one final classification.

### 9.1 NO_CHANGE — PRB → EVD `effects` rendering

Current behaviour (§5.A, §7) is correct, complete, and should be preserved
unchanged. `EvidenceEffectTag` and `EffectOccurrenceSummary` already satisfy
`datamodel.md` §2's requirement that effects never imply strength or ranking
(explicit non-ranking caption confirmed rendered). No WU042 action.

### 9.2 NO_CHANGE — EVD → PRB backlink (both effects and research_roles)

Current behaviour (§5.A reverse, §7) is correct, complete, tested, and
rendered correctly at both single- and multi-relationship fan-out. No WU042
action. This finding directly disproves the possibility of treating
`research_roles[]` as absent/unsupported anywhere in the Explorer — it is
already fully supported in this direction.

### 9.3 NO_CHANGE — EVD → SRC forward navigation

Current behaviour (§5.B, §7) is correct, complete, tested, and already a real
navigable action (not merely a static ID). No WU042 action.

### 9.4 NO_CHANGE — SRC → EVD backlink

Current behaviour (§5.C, §7) is correct, complete, tested, and confirmed to
render correctly at the corpus's highest observed fan-out (8 items, SRC-0017).
No WU042 action.

### CR-1: PRB → EVD forward direction omits `research_roles[]` — CHANGE_REQUIRED

- **Current behaviour:** `ProblemView.tsx`'s `EvidenceCard` renders `effects`
  via `EvidenceEffectTag` but never renders `research_roles`, despite
  `problemProjection.ts` already computing and returning `researchRoles` on
  the same object. `ResearchRoleTag` — the exact component already used
  correctly for this purpose in `EvdDetail.tsx` — is never imported into
  `ProblemView.tsx`.
- **User/comprehension problem:** A reader inspecting a Problem's evidence
  list sees each item's *effect* (how it affects this Problem's conclusion)
  but not its *research role* (why it is relevant — local observation,
  contextual, comparative, existing/planned response). The same information
  is fully visible from the reverse direction (opening the EVD's own detail
  page and reading "Como é usada na investigação"), so the gap is one of
  redundant navigation effort, not unavailable information — but
  `explorerarchitecture.md` §3's "Problema" objective ("supporting and
  contradictory Evidence") is better served when both relationship
  dimensions are visible at the point a reader is already looking at the
  evidence list, matching what is already achieved for `effects`.
- **Supporting evidence:** §5.A, §6 (PRB-0005/EVD-000012 rendered inspection:
  0 role tags in the Problem view's Evidência section vs. full role rendering
  on the same relationship from the EVD side).
- **Exact desired behaviour:** Render each evidence relationship's
  `research_roles[]` alongside its `effects[]` in `ProblemView.tsx`'s
  `EvidenceCard`, using the existing `ResearchRoleTag` component exactly as
  already proven correct in `EvdDetail.tsx` — same component, same visual
  treatment, same non-ranking framing. Do not add a role tally to
  `EffectOccurrenceSummary`/`effectSummary.ts` unless WU042 review finds
  rendered evidence that an aggregate role summary is also needed; the
  minimum correct fix is per-card role rendering, matching the granularity at
  which `research_roles` already exists on the relationship.
- **Canonical semantics that authorize it:** `datamodel.md` §2 ("`research_roles[]`
  … Effects and roles describe this Problem's use of the Evidence"). No new
  field, no new derivation, no schema change — `research_roles` is already
  computed by `problemProjection.ts` and only needs to be passed through to
  rendering.
- **Implementation boundary:** `apps/research-explorer/src/problem/ProblemView.tsx`
  only (import `ResearchRoleTag`, extend `EvidenceCard`'s destructuring and
  JSX). No projection-layer change (`problemProjection.ts` already returns
  the needed data). See §14 for the exact WU042 file boundary.
- **Verification requirement:** WU043 must confirm, on PRB-0005 (or another
  fixture where the relationship's `research_roles` differs from its
  `effects` cardinality), that both dimensions render per evidence card with
  correct 1:1 fidelity to the canonical relationship data, at all three
  required viewports, with no change to evidence grouping, order, or effect
  rendering. See §15.

### CR-2: `SourceInvestigationSection` test coverage is materially thinner than its sibling — CHANGE_REQUIRED

- **Current behaviour:** `SourceInvestigationSection.test.tsx` is a single
  minimal test asserting only that one related PRB ID and its "Através de:"
  text appear. It does not exercise: zero related Problems, multiple related
  Problems (the corpus has real examples — SRC-0017 has 3), the
  `onSelect`-present-vs-absent action/text branch, or loading/error states
  (shared with `SourceFindingsSection` via one hook, but not independently
  re-asserted here as they are for the Findings section).
- **User/comprehension problem:** This is not a currently-observable rendering
  defect (§5.D, §7 confirm the feature works correctly today) — it is a
  regression-risk gap. A future change to `sourceEvidenceRelations.ts` or
  `SourceInvestigationSection.tsx` could silently break the multi-PRB or
  zero-PRB paths with no test failure, unlike the equivalent EVD→PRB and
  SRC→EVD directions, which are both well-covered.
- **Supporting evidence:** §5.D, and direct comparison against
  `EvdDetail.test.tsx`'s materially broader coverage of the symmetric EVD→PRB
  relationship.
- **Exact desired behaviour:** Add test cases to
  `SourceInvestigationSection.test.tsx` covering: zero related Problems
  (confirm nothing renders, matching current `return null` behaviour — see
  CR-3 for whether that behaviour itself should change), multiple related
  Problems with correct per-PRB "Através de" mediating-EVD attribution (using
  real canonical fixture data, e.g. SRC-0017's three-PRB case), and the
  action/text `onSelect` branch already covered for `SourceFindingsSection`.
- **Canonical semantics that authorize it:** None needed — this is a
  test-only addition with no behaviour change.
- **Implementation boundary:** `apps/research-explorer/src/records/SourceInvestigationSection.test.tsx`
  only. No production code change for CR-2 itself (CR-3 below is the
  associated production-behaviour item).
- **Verification requirement:** WU043 confirms the new tests pass and that no
  existing test's expected behaviour changed.

### CR-3: `SourceInvestigationSection`'s zero-related-Problem state has no user-visible message — CHANGE_REQUIRED

- **Current behaviour:** When a Source has zero related Problems (derivable —
  every SRC-cited EVD happens to be unused by any PRB), `SourceInvestigationSection`
  renders `return null` — no heading, no message. This differs from its
  sibling `SourceFindingsSection`, which renders an explicit `EmptyState`
  ("Ainda não existem observações da investigação ligadas explicitamente a
  esta fonte.") for the equivalent zero-EVD case.
- **User/comprehension problem:** A reader who reaches "Na investigação" via
  the section index (the section-index entry itself is presence-conditional,
  per `sourceSectionIndex`/`computeSourceSectionPresence` — so this scenario
  may already be rare/impossible depending on how presence is computed) could
  otherwise see a silently absent section with no explanation, inconsistent
  with the explicit "nothing found" treatment used everywhere else for
  established-empty results (`component-model.md` §4.3's `EmptyState`
  contract: "explicitly established empty result/collection as ordinary
  content").
- **Supporting evidence:** §5.D; `component-model.md` §5.9 ("explicitly
  established empty results use `EmptyState`").
- **Exact desired behaviour:** Confirm first (WU042 investigation step, not
  assumed here) whether `computeSourceSectionPresence`/`sourceSectionIndex`
  already suppresses the "Na investigação" section index entry when zero
  related Problems exist. If the section can currently be *reached* (via
  scroll or direct anchor `#source-investigation`) while empty, render the
  existing `EmptyState` component with an explicit copy string (to be
  drafted consistently with `SourceFindingsSection`'s existing tone) instead
  of `return null`. If the section index already fully suppresses this case
  (making it unreachable in practice), this item converts to NO_CHANGE and
  WU042 must record that finding rather than adding unreachable code.
- **Canonical semantics that authorize it:** None needed — this is a
  presentation-consistency fix using an already-approved generic component
  (`EmptyState`), not a new capability.
- **Implementation boundary:** `apps/research-explorer/src/records/SourceInvestigationSection.tsx`
  and, only if the presence-suppression investigation above finds the section
  is currently reachable while empty, `apps/research-explorer/src/records/sourceSectionIndex.ts`
  (or wherever `computeSourceSectionPresence` lives) for review only — no
  presence-logic change is pre-authorized without WU042 confirming the actual
  current behaviour first.
- **Verification requirement:** WU043 confirms whichever outcome WU042
  reaches (empty-state message added, or finding reclassified to NO_CHANGE
  with cited evidence) against a real or synthetic zero-related-Problem
  Source case.

## 10. Owner decisions

### OD-1: Whether Records discovery should support filtering/sorting by relationship-level values (`effects`, `research_roles`, `source`)

- **Exact question:** Should the Records list (desktop `RecordsTable` /
  compact `NarrowRecordsList`) gain a way to filter or sort by a
  relationship-level value — e.g. "show only PRB records with a
  `CONTRADICTS` relationship," "show only EVD records used with research role
  `PLANNED_RESPONSE`," or "show only EVD records citing SRC-0017" — and if
  so, at what granularity (record-level facet vs. a separate
  relationship-browsing surface)?
- **Why current authority does not resolve it:** `explorerarchitecture.md` §4
  says only that Records should be "compact and scannable" with "useful
  Source/relationship context" — it does not specify whether relationship
  values should be filterable. `component-model.md` explicitly defers a
  generic `Grid`/query-builder concept and does not mention relationship-value
  filtering at all. The current filter model (`recordIndex.ts`) is
  architecturally built around flat, schema-`enums`-level values only;
  extending it to nested relationship arrays is a materially different
  capability, not a bug fix, and its scope (which record type's list, what UI
  affordance, whether it introduces a new "relationship browsing" concept
  distinct from "record browsing") is a product decision with no existing
  canonical or design-contract answer.
- **Viable options:**
  1. No change — Records discovery remains record-type + free-text only;
     relationship-level discovery continues to happen exclusively via
     drilling into a specific record's detail view (current behaviour).
  2. Add a narrow, bounded filter (e.g. one additional "Efeito" or "Papel"
     dropdown on the Records view) scoped only to PRB/EVD list rows.
  3. A more general relationship-browsing surface (e.g. "show all
     `CONTRADICTS` relationships across the corpus") — materially larger
     scope, likely its own future work unit rather than an AR-05 item.
- **Trade-offs:** Option 1 preserves the current, tested, simple filter model
  and defers all product-design risk; Option 2 adds real discovery value for
  a common workflow (e.g. "show me all contradicting evidence") but requires
  new UI, new filter-state shape, and new tests, and risks scope creep beyond
  AR-05's "discovery and provenance" framing into a new query capability;
  Option 3 is explicitly larger than what a single WU042 execution boundary
  should absorb.
- **Recommendation:** If the owner wants to proceed, Option 2 (a narrow,
  bounded addition) is the only one compatible with an execution-deterministic
  WU042 boundary at AR-05's scale; Option 3 should be deferred to a future
  milestone regardless of this decision's outcome.
- **Consequence of deferring:** Records discovery remains as it is today
  (type + free-text only). This is not a regression — it is the status quo,
  and per §4 it already functions correctly for record-level scanning; the
  gap is additive discovery capability, not a defect.

### OD-2: Whether in-page cross-reference controls should become real `<a href>` anchors

- **Exact question:** Should the `<button onClick>` + `history.pushState`
  pattern used for every in-page PRB/EVD/SRC cross-reference (§4.6, §5) be
  changed to real `<a href="...">` anchors carrying the equivalent
  `?view=...&id=...` URL, to gain native browser affordances (new-tab via
  middle-click/Ctrl+click, status-bar hover preview, "copy link address")?
- **Why current authority does not resolve it:** `component-model.md` §4.5
  ("Links and buttons may share appearance only when their native semantics
  remain visible in code... URL-state actions may remain buttons unless a
  separately approved navigation phase changes that contract") explicitly
  anticipates this exact question and explicitly defers it to "a separately
  approved navigation phase" — i.e. the existing design authority already
  identifies this as requiring a future, separate decision, not something
  WU042 may resolve on its own reading of "discovery" being in scope.
  `foundations.md`'s "Interaction and focus" section requires visible,
  keyboard-accessible interactive elements but does not mandate anchor
  semantics specifically.
- **Viable options:**
  1. No change — retain the current button + `pushState` pattern uniformly.
  2. Convert cross-reference controls to real anchors with an `onClick`
     handler that still calls `preventDefault()` + the existing
     `pushState`/state-update logic for same-tab clicks, while allowing the
     browser's native new-tab/hover-preview behaviour for modified clicks —
     this is a well-established hybrid pattern for SPA-internal links.
  3. Convert only a subset (e.g. only the highest-value cross-references,
     such as EVD→PRB "Ver Problema →") as a smaller pilot.
- **Trade-offs:** Option 1 changes nothing and defers all accessibility/UX
  upside; Option 2 is the technically clean, complete fix but touches every
  cross-reference control across `records/`, `problem/`, and
  potentially `navigation/` — a broad, multi-file change with real regression
  risk against `component-model.md` §5.6's existing "Links and buttons may
  share appearance only when their native semantics remain visible in code"
  boundary and every existing click-based test across those files; Option 3
  narrows risk but creates an inconsistent interaction model across the
  Explorer (some cross-references support new-tab, others do not) that
  itself could confuse readers, and does not resolve the underlying question,
  only postpones full resolution.
- **Recommendation:** None offered — `component-model.md` §4.5 already
  anticipated this exact question and explicitly named it as requiring "a
  separately approved navigation phase," which is a stronger and more
  specific existing signal than this contract can add to; this decision
  should most likely be scoped as its own future phase regardless of
  approval or rejection, given its cross-cutting file footprint (every
  cross-reference control in `records/`, `problem/`, and possibly
  `navigation/`) relative to a single WU042 execution boundary.
- **Consequence of deferring:** In-page cross-references remain button-only
  (no native new-tab/hover-preview) but continue to work exactly as they do
  today, including full deep-link support once a destination is reached via
  a click — this is a UX limitation, not a defect, and matches
  `component-model.md`'s own anticipated deferral.

### OD-3: `EffectOccurrenceSummary`-equivalent aggregate summary for `research_roles`

- **Exact question:** If CR-1 (§9) is approved and per-card role rendering is
  added to `ProblemView.tsx`, should an aggregate "role occurrence summary"
  (mirroring `EffectOccurrenceSummary`/`effectSummary.ts`'s tally-and-caption
  pattern) also be added, so a reader sees e.g. "9 registos · 12 papéis
  registados" for roles the way they already do for effects?
- **Why current authority does not resolve it:** This is a genuinely open
  product-design question about information density, not a data-availability
  question — `problemProjection.ts` already returns enough data to compute
  such a summary deterministically, so this is not OWNER_DECISION_REQUIRED on
  data-availability grounds. It is included here rather than folded into CR-1
  because `datamodel.md` and `explorerarchitecture.md` are silent on whether
  a Problem's evidence-role composition deserves the same
  aggregate-visibility treatment as its effect composition, and because
  `docs/design/foundations.md`'s "Reading First" principle could support
  either "yes, symmetry aids comprehension" or "no, avoid adding density that
  the CR-1 per-card fix alone does not require" — a legitimate product
  judgement call, not one this contract's evidence can settle on its own.
- **Viable options:** (1) per-card role rendering only (CR-1's minimum
  scope, no aggregate summary); (2) per-card rendering plus a symmetric
  aggregate role summary alongside `EffectOccurrenceSummary`.
- **Trade-offs:** Option 1 is the smaller, lower-risk change and is
  sufficient to resolve CR-1's stated comprehension gap; Option 2 adds
  parallel-structure clarity (effects and roles presented with equal
  visual weight) at the cost of additional vertical space in an
  already-dense section (`ar-04-problem-experience-contract.md`'s own
  findings note the Evidência section is "dense... but its boundaries
  correspond to distinct authored concepts").
- **Recommendation:** Option 1 (per-card only) is recommended as the minimum
  correct fix for CR-1's stated gap; Option 2 can be considered later with
  its own rendered-comprehension evidence if the owner wants symmetry.
- **Consequence of deferring:** CR-1 ships as per-card rendering only, with
  no aggregate role summary; this fully resolves CR-1's stated
  user/comprehension problem (§9, CR-1) without waiting on this decision, so
  deferring OD-3 does not block WU042 from proceeding with CR-1 as scoped in
  §14 — WU042 must implement CR-1 at Option 1's scope unless and until this
  decision is separately approved.

### OD-4: `research_roles[]` filter/sort granularity relative to OD-1

- **Exact question:** Subsumed by OD-1 — if OD-1 is approved at Option 2's
  scope, should the added filter cover `effects`, `research_roles`, `source`,
  or some subset, and should PRB and EVD list rows both gain it or only one
  record type?
- **Why current authority does not resolve it:** Same reasoning as OD-1; this
  is recorded as a distinct decision only because OD-1's approval does not by
  itself specify which relationship dimension(s) to expose, and a partial
  approval (e.g. "yes to effect filtering, no to source filtering") is a
  realistic owner outcome that would otherwise be ambiguous.
- **Viable options / trade-offs / recommendation:** Identical structure to
  OD-1; no independent recommendation beyond OD-1's Option 2 framing.
- **Consequence of deferring:** Resolved automatically as "no filter of any
  kind" if OD-1 is not approved; requires explicit scoping from the owner
  alongside OD-1 approval if it is.

## 11. DEFER register

### DF-1: Graph reachability / redesign

- **Reason for deferral:** Explicitly named out of scope by the WU041 packet
  ("Graph redesign/visualisation overhaul") and by `component-model.md`
  throughout ("dormant Graph," "excluded from component/layout migration and
  redesign"). Re-enabling Graph as a discovery surface would be a
  significant, independently-scoped product decision (it already generically
  visualises the full SRC↔EVD↔PRB edge set — §4.10 — so re-enabling it is a
  reachability/product decision, not an implementation gap), not a bounded
  AR-05 fix.
- **Likely future boundary:** A dedicated future milestone/work unit
  addressing Graph's product role, not AR-05/WU042.

### DF-2: General relationship-browsing surface (OD-1's Option 3)

- **Reason for deferral:** Materially larger in scope than a filter addition
  to the existing Records view; would introduce a new corpus-wide query
  concept not currently modelled by `recordIndex.ts` or any design contract.
- **Likely future boundary:** Only relevant if OD-1 is approved and the
  owner separately decides Option 2's narrower filter is insufficient; would
  require its own reconciliation contract given its scope.

### DF-3: Broader cross-reference navigation-phase work beyond OD-2's decision itself

- **Reason for deferral:** `component-model.md` §4.5 already names this as
  requiring "a separately approved navigation phase" — this contract records
  the decision (OD-2) but the *execution* of a full anchor-conversion pass
  across every affected file, if approved, is large enough (every
  cross-reference control in `records/`, `problem/`, possibly `navigation/`)
  that it does not belong inside a single WU042 alongside CR-1/CR-2/CR-3.
- **Likely future boundary:** A dedicated work unit scoped specifically to
  OD-2's approved option, sequenced after WU042/WU043 close.

## 12. Pre-existing graph debt (reported, not repaired)

`aiqt review` and `aiqt graph validate`, run during WU041, report exactly the
same three pre-existing critical findings already known from AR-04:
`GRAPH-VALIDATE-BROKEN-CHECKPOINT-PACKET-REFERENCE` for checkpoints C008,
C009, and C010 (each references a `packetId` absent from
`state.lastAgentPacket`/runlog history). No new critical/high finding was
introduced by WU041. The pre-existing `workunit:WU042:vague-scope` and
`workunit:WU043:vague-scope` medium advisories are expected and are the
reason this contract exists — §14/§15 supply the exact boundaries those
advisories call for. All four are confirmed present before any WU041 change,
and remain explicitly out of WU041's authorized scope to repair, suppress, or
mutate.

## 13. Canonical-content/semantic invariants (binding on WU042)

- No field meaning, gloss, enum label, or relationship semantics may change.
  `effects`/`research_roles` values, their canonical enum sets, and their
  ownership (PRB-relationship-owned, not EVD-owned) are unchanged by every
  item in §9.
- No confidence, causality, corroboration, or currentness may be invented.
  Every value any CR item renders must already exist in canonical data today,
  in the same textual/enum form — CR-1 changes only *whether* `research_roles`
  renders in `ProblemView.tsx`, never what the values mean or how they are
  computed (`problemProjection.ts` is unchanged by CR-1 — the data is already
  correctly computed there).
- No canonical backlink may be authored to replace an already-working derived
  one. EVD→PRB, SRC→EVD, and SRC→PRB backlinks remain exactly as
  client-side/build-time derived today (§5, §8) — CR-1/CR-2/CR-3 touch only
  presentation/test code, never `read-model.js`'s generic edge derivation or
  any canonical schema/data file.
- `research_roles[]` and `source.source_id` remain existing, populated,
  correctly-modelled canonical fields throughout this contract and any
  resulting WU042 implementation — no WU042 action may be justified by
  treating either as newly discovered or newly added.
- Independence, corroboration, and evidential-strength judgements remain
  exactly as owned today (`datamodel.md` §2 "Lineage and independence") — no
  CR item in this contract touches `independence_assessment`, lineage
  identifiers, or any judgement field; AR-04's CR-1 (Evidência-section
  reorder including `independence_assessment`'s position) is closed and is
  not reopened here (§1, §2).

## 14. Exact WU042 implementation contract

This boundary is execution-deterministic for the three CHANGE_REQUIRED items
that require no owner decision (CR-1, CR-2, CR-3). It excludes anything gated
by OD-1 through OD-4 — those items must not appear as assumed WU042 work
until separately approved, per the WU041 packet's explicit instruction.

### CR-1 — render `research_roles[]` per evidence card in `ProblemView.tsx`

- **Exact behaviour change:** Each evidence relationship rendered by
  `EvidenceCard` must show its `research_roles[]` using the existing
  `ResearchRoleTag` component, alongside (not replacing) its existing
  `effects[]` rendering via `EvidenceEffectTag`. No aggregate role summary
  (deferred to OD-3, §10).
- **Exact component/projection responsibility:** `problemProjection.ts`'s
  `EvidenceWithSources`/`researchRoles` field is unchanged (already correct);
  `ProblemView.tsx`'s `EvidenceCard` function gains the render responsibility.
- **Exact files allowed to change:**
  - `apps/research-explorer/src/problem/ProblemView.tsx` (import
    `ResearchRoleTag`; extend `EvidenceCard`'s prop destructuring to include
    `researchRoles`; add its rendering adjacent to the existing effect
    rendering, reusing `ResearchRoleTag` exactly as already used in
    `EvdDetail.tsx` — no new visual variant).
  - `apps/research-explorer/src/problem/ProblemView.test.tsx` (new
    assertion(s) proving `research_roles` renders per card with correct
    fidelity to a fixture's canonical relationship data; existing 13 cases
    must continue to pass unmodified).
- **Explicit files/surfaces that must not change:** `problemProjection.ts`,
  `effectSummary.ts`, `ResearchRoleTag`'s own implementation/styling,
  `EvdDetail.tsx`, any file under `apps/research-explorer/src/records/`,
  `apps/research-explorer/src/navigation/`, any CSS file (the existing
  `ResearchRoleTag` visual treatment is reused as-is, no new selector), any
  `research/**` canonical data, any schema, `.aiqt/state.json`,
  `.aiqt/runlog.jsonl`.
- **Canonical semantics to preserve:** `research_roles[]` remains a
  PRB→EVD-relationship-owned field, describing this Problem's use of the
  Evidence, never implying strength/ranking (`ResearchRoleTag`'s existing
  non-ranking framing, already proven correct in `EvdDetail.tsx`, must carry
  over unchanged).
- **Accessibility requirements:** No new landmark; `ResearchRoleTag`'s
  existing accessible-name/labelling behaviour must be preserved exactly as
  it already is in `EvdDetail.tsx`.
- **Responsive requirements:** Must render identically in content (not
  necessarily pixel-identical wrapping) at desktop, the 768–1059px band, and
  compact — no essential text may shrink to accommodate the addition
  (`foundations.md` "Responsive reading").
- **Tests required:** New `ProblemView.test.tsx` assertion(s) as above; all
  13 existing cases continue to pass unmodified.
- **Acceptance criteria:** On a fixture where a relationship's
  `research_roles` differs in cardinality from its `effects` (e.g.
  EVD-000012 under PRB-0005: 2 effects, 2 roles — or another fixture where
  the counts genuinely differ), both dimensions render correctly and
  independently, matching canonical data exactly, with existing effect
  rendering, evidence grouping, and section order completely unchanged.

### CR-2 — broaden `SourceInvestigationSection.test.tsx` coverage

- **Exact behaviour change:** None (test-only).
- **Exact files allowed to change:**
  `apps/research-explorer/src/records/SourceInvestigationSection.test.tsx`
  only.
- **Explicit files/surfaces that must not change:**
  `SourceInvestigationSection.tsx` itself (unless CR-3 below also applies —
  in that case both CRs may touch this file, see CR-3's boundary),
  `sourceEvidenceRelations.ts`, any other file.
- **Canonical semantics to preserve:** N/A (test-only).
- **Accessibility / responsive requirements:** N/A (test-only).
- **Tests required:** New cases covering zero related Problems, multiple
  related Problems (real fixture: SRC-0017's 3-PRB case, or an equivalent
  synthetic fixture consistent with existing test patterns in this file),
  and the `onSelect`-present-vs-absent action/text branch.
- **Acceptance criteria:** New tests pass; existing single test's assertion
  continues to pass unmodified (or is superseded by a strictly more complete
  replacement covering the same case plus the new ones — implementer's
  choice, but no coverage may be net-removed).

### CR-3 — `SourceInvestigationSection` zero-related-Problem presentation

- **Exact behaviour change:** Conditional on WU042's own investigation step
  (see below) — either (a) render the existing `EmptyState` component with
  explicit copy when zero related Problems exist and the section is
  reachable, or (b) no behaviour change, with the finding reclassified to
  NO_CHANGE and the reclassification recorded in the WU042 completion report
  if `computeSourceSectionPresence`/equivalent already fully suppresses this
  case.
- **Exact component/projection responsibility:** `SourceInvestigationSection.tsx`
  owns the rendering change if made; presence-suppression logic (wherever it
  lives — confirm exact file during WU042, likely alongside
  `sourceSectionIndex.ts`) is investigated but not modified unless the
  investigation shows the section is currently reachable while empty AND the
  owner-approved fix requires touching presence logic (unlikely — the
  primary fix is expected to be contained to the rendering file alone).
  If reachability requires a presence-logic change, WU042 must stop and
  return for a contract amendment rather than improvising, consistent with
  §16's rule.
- **Exact files allowed to change:**
  `apps/research-explorer/src/records/SourceInvestigationSection.tsx` (add
  `EmptyState` usage, matching `SourceFindingsSection.tsx`'s existing pattern
  exactly); `SourceInvestigationSection.test.tsx` (new empty-state assertion,
  may be combined with CR-2's work in the same file).
- **Explicit files/surfaces that must not change:** `sourceEvidenceRelations.ts`,
  `SourceFindingsSection.tsx`, any presence/index logic file, unless the
  investigation step above triggers the stop-and-amend path.
- **Canonical semantics to preserve:** No relationship semantics change —
  this is presentation-consistency only, using an already-approved generic
  component (`EmptyState`, per `component-model.md` §4.3) for an
  already-correctly-computed empty condition.
- **Accessibility requirements:** `EmptyState`'s existing accessible
  presentation (no automatic live region/alert, per `component-model.md`
  §4.3) must be used exactly as already implemented, matching
  `SourceFindingsSection.tsx`'s usage.
- **Responsive requirements:** No essential text shrinkage; must render
  identically in content across all three required viewports.
- **Tests required:** New assertion confirming the `EmptyState` renders
  (with its specific copy) for a zero-related-Problem fixture, if outcome
  (a) is reached; a NO_CHANGE-confirming note (not a new render assertion)
  if outcome (b) is reached.
- **Acceptance criteria:** Either a working, tested `EmptyState` render for
  the zero-case, or an explicit, cited finding that the case is unreachable
  today and no change is needed — WU042 may not leave this ambiguous.

### WU042 exact file boundary — combined

**Files WU042 may change (union of CR-1/CR-2/CR-3, no others):**
- `apps/research-explorer/src/problem/ProblemView.tsx`
- `apps/research-explorer/src/problem/ProblemView.test.tsx`
- `apps/research-explorer/src/records/SourceInvestigationSection.tsx`
- `apps/research-explorer/src/records/SourceInvestigationSection.test.tsx`

**Files WU042 must not change:** every other file in
`apps/research-explorer/src/**`, `apps/research-explorer/scripts/**`, any
`research/**` canonical data or schema, any `docs/**` file other than this
contract's own future amendment if one becomes necessary, `.aiqt/state.json`,
`.aiqt/runlog.jsonl`. In particular: `problemProjection.ts`, `effectSummary.ts`,
`EvdDetail.tsx`, `sourceEvidenceRelations.ts`, `SourceFindingsSection.tsx`,
`recordIndex.ts`, `RecordsTable.tsx`, `NarrowRecordsList.tsx`,
`urlState.ts`, and every Graph file must not change under this contract.

**OWNER_DECISION_REQUIRED items (OD-1 through OD-4) must not appear as
assumed WU042 work.** If any is approved before WU042 executes, it requires
a contract amendment (a new/updated CR item with its own exact file boundary)
before WU042 may act on it — WU042 as authorized by this contract covers only
CR-1, CR-2, and CR-3.

## 15. Exact WU043 independent-verification matrix

WU043 remains verification-only. No remediation is permitted inside WU043 —
any defect found must be reported back, not fixed in place.

Primary gate: **production build served via `npm run build` + `npm run preview`**
(never the Vite dev server), matching the method used for this WU041
reconciliation and for AR-04's WU040.

| # | Item | Record/journey | Viewport(s) | Expected rendered behaviour | Canonical-fidelity assertion | Navigation/deep-link assertion | Accessibility assertion | Responsive assertion | Console/network assertion | Automated validation |
| - | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | CR-1 role rendering | `?view=problem&id=PRB-0005` (EVD-000012's relationship; 2 effects, 2 roles) | 1440×900, 900×800, 360×740 | Each evidence card shows both effect chip(s) and role chip(s), matching canonical `evidence[]` data for that specific PRB | Role values/count match `research/problems/PRB-0005.yaml`'s raw `evidence[]` entry for EVD-000012 exactly | N/A (no new link) | `ResearchRoleTag`'s existing accessible name/labelling present exactly as in `EvdDetail.tsx` | No essential text shrinkage at any viewport; single-column recomposition at 900×800/360×740 unaffected | Zero new console errors/warnings (favicon 404 excepted) | `ProblemView.test.tsx` new + existing 13 cases pass |
| 2 | CR-1 non-regression | `?view=problem&id=PRB-0012` (no `decision_basis`, sparse evidence) | 1440×900 | Evidence cards render normally with whatever `research_roles` PRB-0012's 3 relationships carry; no fabricated role invented for any relationship lacking one (schema requires non-empty `research_roles`, so absence is not expected, but verify no placeholder/fallback text is wrongly shown) | Matches `research/problems/PRB-0012.yaml` exactly | N/A | Same as #1 | Same as #1 | Same as #1 | Same suite as #1 |
| 3 | CR-1 effect non-regression | `?view=problem&id=PRB-0006` (4 distinct effects, richest fixture) | 1440×900, 360×740 | `EffectOccurrenceSummary` and every effect chip render exactly as before CR-1 (unchanged); role rendering is additive only | Effect counts/values match `research/problems/PRB-0006.yaml` exactly, unchanged from pre-CR-1 baseline | N/A | Unchanged from AR-04's own PRB-0006 accessibility findings (§5, AR-04 contract) | Unchanged | Same as #1 | Full `apps/research-explorer` test suite passes |
| 4 | CR-2 test coverage | N/A (test-only; verify via test run, not rendered inspection) | N/A | `SourceInvestigationSection.test.tsx` covers zero/multiple-related-Problem and action/text branches | N/A | N/A | N/A | N/A | N/A | New tests pass; full suite green |
| 5 | CR-3 empty state (if outcome (a)) | A zero-related-Problem Source fixture (real or synthetic, per WU042's investigation) | 1440×900, 360×740 | `EmptyState` renders with explicit copy in "Na investigação" | Matches whichever copy WU042 authored, consistent with `SourceFindingsSection`'s tone | N/A | `EmptyState`'s existing non-alerting accessible presentation | No essential text shrinkage | Zero new errors | `SourceInvestigationSection.test.tsx` new case passes |
| 5' | CR-3 (if outcome (b), NO_CHANGE) | N/A | N/A | Confirm WU042's cited evidence that the zero-case is unreachable is accurate (spot-check `computeSourceSectionPresence`/index logic) | N/A | N/A | N/A | N/A | N/A | N/A |
| 6 | SRC-0017 non-regression (existing NO_CHANGE items) | `?view=records&id=SRC-0017` | 1440×900, 900×800, 360×740 | "O que encontrámos" (8 EVDs) and "Na investigação" (3 PRBs, correct "Através de" attribution) render exactly as documented in this contract's §5.C/§5.D/§7, unaffected by CR-1/CR-2/CR-3 | Matches `research/sources/SRC-0017.yaml` and its citing EVDs exactly | Each "Abrir EVD-xxxxxx"/"Abrir PRB-xxxx" button still navigates correctly | Unchanged from this contract's §7 findings | 9px pre-existing `.explorer-navigation` delta at 360px unchanged (must not grow) | Only pre-existing favicon 404 | Full suite green |
| 7 | EVD-000012 non-regression (existing NO_CHANGE item) | `?view=records&id=EVD-000012` | 1440×900 | "Como é usada na investigação" still renders both PRB-0004 and PRB-0005 uses with correct, distinct effect/role pairs, unaffected by CR-1 (which touches only `ProblemView.tsx`, not `EvdDetail.tsx`) | Matches §5.A(reverse)/§7 exactly | "Ver Problema →" buttons still navigate correctly | Unchanged | Unchanged | Only pre-existing favicon 404 | `EvdDetail.test.tsx` unchanged, passes |
| 8 | Full validation suite | N/A | N/A | All of: `npm run test`, `npm run typecheck`, `npm run build`, `npm run research:validate` pass; `git diff --check` clean; `aiqt review`/`aiqt graph validate` show no new finding beyond the pre-existing C008/C009/C010 debt (§12) | N/A | N/A | N/A | N/A | N/A | See §17/validation commands |

WU043 must record its findings against this exact checklist and must not
substitute Storybook-only or dev-server-only evidence for any item above,
matching the standard already established by AR-04's WU040 and
`ds-04b-foundation-consolidation-contract.md` §G.

## 16. Explicit deferred/out-of-scope register

- **OD-1/OD-4 (Records relationship-level filter/sort)** — deferred pending
  owner decision; not assumed as WU042 work (§10, §14).
- **OD-2 (anchor-vs-button cross-reference semantics)** — deferred pending
  owner decision; `component-model.md` §4.5 already anticipates this as
  requiring "a separately approved navigation phase" (§10, §11 DF-3).
- **OD-3 (aggregate research-role summary)** — deferred; CR-1 ships at its
  minimum per-card scope regardless of this decision's timing (§10).
- **Graph reachability/redesign (DF-1)** — explicitly out of scope per the
  WU041 packet; not reopened by any finding in this contract (§11).
- **General relationship-browsing surface (DF-2)** — explicitly deferred,
  contingent on OD-1 (§11).
- **AR-04's Problem-experience findings (CR-1/CR-2 in that contract)** —
  already closed; not reopened here (§1, §2).
- **DS-04B owner-frozen foundation values** — no item in this contract
  proposes, requires, or implies any change to a DS-04B-frozen value;
  `ResearchRoleTag`'s reuse in CR-1 and `EmptyState`'s reuse in CR-3 are both
  reuse of already-approved, already-styled components with zero new
  token/selector-value introduction.
- **D7 / Decision Horizon** — not authorized, anticipated, or scoped by any
  part of this contract.
- **C008/C009/C010 repair** — historical AIQT graph debt, confirmed
  unchanged by WU041 (§12); not repaired here.
- **Canonical schema/data changes of any kind** — no finding in this
  contract requires one; every CHANGE_REQUIRED item is presentation- or
  test-only, and every OWNER_DECISION_REQUIRED item is a product/UX
  decision, not a schema gap (§13).

## 17. Validation performed for this WU041 contract

- `npm run build --prefix apps/research-explorer` — passed (119 modules, no
  warnings).
- `npm run preview` (port 4173) — used for all rendered inspection in §6/§7;
  stopped before this checkpoint.
- Rendered inspection via Playwright at 1440×900, 900×800, and 360×740 on
  PRB-0005, PRB-0012, EVD-000012, and SRC-0017 (§6/§7) — zero new console
  errors/warnings beyond the pre-existing favicon 404; zero new horizontal
  overflow beyond the pre-existing 9px `.explorer-navigation` delta.
- `aiqt review` — warning status; only the pre-existing C008/C009/C010
  findings and the expected WU042/WU043 vague-scope advisories (§12), plus
  the (correct, expected) WU041-awaiting-checkpoint note.
- `aiqt graph validate` — failed on exactly the same pre-existing
  C008/C009/C010 critical findings (§12); no new integrity finding.
- No `research/**` canonical file, schema, or `apps/research-explorer` source
  file was modified during WU041. Only this document was created.
