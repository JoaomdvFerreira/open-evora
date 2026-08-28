# DS-01 — Research Explorer Current-State Audit

Status: complete. Read-only audit; no production files were changed.

## 1. Scope and method

This audit inventories the current Research Explorer frontend (`apps/research-explorer`) as it exists today, ahead of the Design System milestone (DS-02/DS-03). It does not redesign, refactor, install dependencies, change production UI, or reinterpret canonical research semantics.

Method:
- Read `AGENTS.md`, `CLAUDE.md`, `docs/explorerarchitecture.md`, and `docs/design/` in full before starting.
- Started the existing app (`npm run dev`) against the existing generated read model (`apps/research-explorer/generated/`) — no data was modified or regenerated.
- Captured real rendered screenshots via a Playwright-driven browser at desktop and ~360px viewports for all four required screens.
- Read `apps/research-explorer/src/index.css` (2,998 lines) in full, plus every `.tsx` file under `src/{app,overview,records,problem,navigation,graph,guide,presentation}`.
- Performed quantitative extraction of colors, font-sizes, spacing, widths, radii, and breakpoints directly from `index.css` (grep/regex counts against the literal file, not estimates).
- Ran the existing automated test suite (`vitest run`) as a baseline: **408 passed, 1 skipped, 0 failed** (46 test files passed, 1 skipped).
- Did not use Project Wallace or any external CSS-analysis tool — none was already present as a dependency, and the task instructs not to add tooling for DS-01. Quantitative CSS analysis was performed via direct inspection/regex extraction against the single stylesheet instead, which is an equivalent repository analysis for a codebase with one CSS file.

No `npm install`, no dependency changes, no `git commit` beyond the single commit finalizing this audit.

## 2. Screens/pages reviewed

All four required screens, at desktop (1280×900) and compact (360×800) viewports, using stable representative records:

| Screen | Route used | Record/Problem ID |
|---|---|---|
| Overview | `/` | — (public landing, no selection) |
| Records | `/?view=records` | list view, no selection |
| Record Detail | `/?view=records&id=SRC-0002` | `SRC-0002` (a Source record, chosen because it exercises the richest Record Detail composition — provenance grid, licensing, coverage, findings, technical sections) |
| Problem View | `/?view=problem&id=PRB-0001` | `PRB-0001` (an existing, previously-refreshed problem record with full evidence/open-questions content) |

Local dev server: Vite on `http://localhost:5183`, using the repository's already-generated read model in `apps/research-explorer/generated/` (not regenerated for this audit).

## 3. Current visual baseline

Screenshots are in `docs/design/audits/ds-01-current-state/screenshots/`:

- `overview-desktop-1280.png`, `overview-compact-360.png`
- `records-desktop-1280.png`, `records-compact-360.png`
- `record-detail-desktop-1280.png`, `record-detail-compact-360.png`
- `problem-view-desktop-1280.png`, `problem-view-compact-360.png`

These are full-page captures (not just the visible viewport) so vertical composition is inspectable end-to-end. They are net-new evidence produced by this audit and are separate from `apps/research-explorer/visual-review/`, which remains the project's existing visual-regression fixture set (untouched).

Visible in the captures: a warm-paper editorial surface (serif headings/body for canonical "meaning" content, sans UI chrome, mono technical identifiers) consistent with the V1 foundation comment in `index.css` ("text-first research surface: warm paper, restrained borders, a readable editorial measure"). Record Detail and Problem View both render as a 720px reading column + right-hand context rail on desktop, collapsing to a single stacked column with the rail content moved into an in-flow disclosure at ≤767px — matching the documented responsive invariant in `docs/explorerarchitecture.md` §5.

## 4. CSS/design-system inventory

All styling is centralized in one file, `apps/research-explorer/src/index.css` (2,998 lines) — no CSS Modules, no CSS-in-JS, no Tailwind. React components carry only class names; there are no `.css` files elsewhere in `src/`.

A partial design-token foundation ("V1", `:root` block, lines 662–802) exists and is genuinely used, but coexists with a large body of pre-token CSS that was never migrated:

**Colors** — 26 distinct raw hex literals (60 occurrences total), **all located between lines 8 and 1480** (i.e., entirely pre-token-era rules); zero raw hex from line 1481 to EOF. The `:root` block defines 15 semantic color tokens (`--canvas`, `--surface*`, `--ink*`, `--line*`, `--accent*`). Two raw values (`#1f1d1a`, `#fff`/`#ffffff`) are literal duplicates of token values expressed a second, unlinked way. Three near-identical warm greys (`#bbb3a3`, `#beb7aa`, `--icon-muted`'s `#b7b2a4`) sit within a few RGB points of each other with no shared token, read as accidental drift rather than an intentional multi-tier grey system.

**Font sizes** — 34 distinct raw values (rem/px/em) across roughly 100+ declarations, plus one `clamp()`. A parallel `--recipe-*-size` token set exists (15 tokens defined) but only 9 are actually consumed, in ~17 declarations total, concentrated in the newer Problem View/Record Detail editorial and technical-identifier rules. `var(--recipe-technical-field-size)` (13px) and the raw literal `13px` coexist as two unlinked spellings of the same value in 14+ other rules; `0.85rem` (13.6px) is a third near-miss.

**Spacing** — 52 distinct raw margin/padding/gap values vs. 116 declarations using `var(--space-N)` (an 11-step 4–90px scale). Most raw values (e.g. `0.35rem`, `0.62rem`, `0.28rem`, `0.18rem`) don't land on the `--space-N` scale at all; a few coincide numerically with a scale step (`0.5rem`=8px, `0.25rem`=4px, `1rem`=16px) but are still spelled as literals rather than the token.

**Widths/max-widths** — no shared "prose measure" scale. Seven distinct rem-based content widths exist for nominally the same "constrain a block of text" concern: `42rem, 43rem, 45rem, 48rem, 52rem, 58rem, 68rem`, each hand-picked per component. Separately, a deliberately-composed trio exists for the Record Detail/Problem View reading layout — `720px` main column + `216px` rail + `44px` gap = `980px` total (documented directly in a CSS comment, lines 1513–1517) — but only the `980px` outer sum is tokenized (`--shell-content-max`); the 720/216 components remain raw literals even though `--detail-gap: 44px` exists as a token for the gap alone.

**Border-radius** — a 3-step token scale (`--radius-sm/md/lg` = 3/4/5px, 19 uses) coexists with 10 raw declarations across 6 distinct values; two of those (`3px`, `0.25rem`) are pixel-exact unlinked duplicates of existing tokens, the other four are near-misses (`0.3rem`, `0.22rem`, `0.2rem`, `0.18rem`) clustered around the same 3–5px range.

**Breakpoints** — consistently `767px`/`768px` for the compact/desktop split (used across four separate `@media` blocks rather than one consolidated block), matching `docs/explorerarchitecture.md` §5's stated invariant exactly. Two deviations, both intentional and comment-documented rather than accidental drift: a `480px` sub-breakpoint scoped to one component (`.prb-reference-item` stacking), and a `768–1059px` intermediate band (lines 2139–2179) explicitly documented as a geometry-only fix ("the canonical 720 main + 44 gap + 216 rail composition cannot fit in this band... reuse the compact single-column recomposition... compact typography/navigation rules are intentionally excluded") — not a third responsive tier in the product sense, a layout-fit patch. No stray breakpoints found outside these two documented exceptions. 360px does not appear in the CSS as a breakpoint — consistent with the architecture doc's framing of it as a QA viewport, not a third band.

**Dangling documentation reference** — 8 comments across `index.css` (lines 699, 704, 851, 1513, 2400, 2436) and two `.tsx` files (`ProblemView.tsx:277`, `useNarrowViewport.ts:9`) cite `design-system.md §N` (e.g. "§1", "§2", "§0.1", "§3") as the source of specific rationale (the 980px shell frame, the semantic typography recipes, the 720/216/44 reading-column geometry, the 767px compact boundary). That file, `docs/design/research-explorer/design-system.md`, was deleted in commit `e13712b` ("docs: rationalize project control plane and remove HYP", 2026-08-24) and has no replacement in the current documentation control plane defined by `AGENTS.md` §1. The section numbers these comments cite can no longer be resolved by a reader.

## 5. Layout architecture findings

- **App shell**: `main.explorer-shell` (full-bleed, no max-width of its own) → `.explorer-chrome` (sticky-on-compact header bar) → per-view content. A single `.shell-frame` primitive (box-sizing + `max-width: var(--shell-content-max)` + auto margins) is the one shared desktop outer-frame primitive, explicitly introduced (per its own comment, line 847) to consolidate what was previously independent per-surface max-width/margin drift across Header/Overview/Records/Record Detail/Problem View. This is a real, working consolidation point already in the codebase.
- **Reading layout**: `.record-detail-columns` / `.record-detail-main` / `.record-detail-rail` is the one shared two-column reading composition, reused as-is by Problem View (`.problem-view-columns` reuses the same class names) rather than being reimplemented per surface. This is the strongest existing "layout primitive" in the app.
- **Records layout**: `.records-explorer` (flex row, table + detail panel) is a second, independent layout primitive, not derived from the reading-column primitive — appropriate, since Records is a scan/browse layout, not a reading layout, but worth naming as a second distinct pattern rather than a variant of the first.
- A structural regression test exists (`src/records/recordDetailLayout.test.ts`) that parses the actual compiled CSS rule bodies out of `index.css` and asserts the 980px frame is owned once at the top level rather than re-centered independently by Breadcrumb/ContextTabs/content — written specifically because that exact drift (each surface capping/centering itself independently) occurred once already (V2). A sibling test (`src/guide/readingGuideLayout.test.ts`) does the same for a previously-shipped negative-margin overlap bug in `.reading-guide`. Both are evidence that the single-stylesheet approach has already produced at least two real layout regressions caught only by writing CSS-parsing tests after the fact, not by a structural boundary that would have prevented them.

## 6. Component/reuse findings

Component inventory by directory (verified by reading each file):

- **src/app** — `App.tsx` (root shell: load/error/ready states, skip link), `Explorer.tsx` (URL-synced view router + header + primary nav).
- **src/overview** — `Overview.tsx` (public landing: independence statement, concept explainer, status glossary, in-investigation Problem list).
- **src/records** (18 non-test files) — `RecordsExplorer.tsx` (router between table and detail), `RecordsTable.tsx` (desktop search/filter/sort/paginate) + `NarrowRecordsList.tsx` (compact single-column variant of the *same* already-computed row data — confirmed by `RecordsTable`'s own logic, not a separate pipeline), `RecordDetailPanel.tsx` (1,086 lines — the largest file in the app; generic + PRB/SRC/EVD-specialized detail rendering, breadcrumb, focus management), `EvdDetail.tsx`, `CompactSectionIndex.tsx` (generic, reused twice — directly by EVD and via a one-line adapter by Source), `SourceCompactSectionIndex.tsx` (thin adapter, not a duplicate implementation), `RecordFieldTree.tsx` (generic recursive technical-field renderer, reused across record types), and 7 `Source*Section.tsx` files.
- **src/problem** — `ProblemView.tsx` (1,097 lines — second-largest file; full public Problem reading projection) and `ProblemHistoryView.tsx` (Histórico timeline).
- **src/navigation** — `ContextTabs.tsx` (Detalhe/Problema/Histórico switcher).
- **src/graph** — `GraphCanvas.tsx` (Sigma.js canvas) and `GraphExplorer.tsx` (search/depth/filter chrome + HTML fallback table; Graph remains implemented but deferred as a primary public surface per `docs/explorerarchitecture.md` §3 — this audit did not treat it as one of the four required screens for that reason, consistent with the architecture doc).
- **src/guide** — `ReadingGuide.tsx` (static, deep-linkable help disclosure).
- **src/presentation** — `UnavailableNote.tsx` (`useUnavailableNote` hook — one shared accessible-tooltip primitive for disabled controls).

**Duplication observed**:
- The 7 `Source*Section.tsx` files split into two groups: 5 follow an identical unwritten "extract fields → build rows → render one `<dl class="detail-provenance-grid">`" template with different field names/labels (near copy-paste at the TSX level, even though the CSS classes they consume are already shared); 2 (`SourceFindingsSection`, `SourceInvestigationSection`) render relation-derived card lists instead but still share the same `<section>`/`detail-panel-label` wrapper as the other 5.
- Five independent CSS "small labeled pill" recipes exist for what reads as one conceptual chip/badge primitive — `.record-role-chip`, `.detail-type-badge`, `.status-chip`, `.effect-chip`/`.effect-chip-note`, `.narrow-record-type` — each with its own hand-picked padding/radius/font-size rather than one shared base class. `.detail-type-badge` and `.status-chip` are the two most token-consistent (fully `var()`-driven for color/radius) yet still diverge from each other in padding and radius tier for what appears to be the same semantic role.
- The compact records-row selectors (`.narrow-records-list`, `.narrow-record-row`, `.narrow-record-type`, `.narrow-record-label`, `.narrow-record-id`, `.narrow-record-chevron`) are each defined **twice** in `index.css` — once in the pre-token block (lines 230–289, structural properties: flex, gap, min-height, cursor) and again later (lines 1464–1508, visual/token overrides: color, border-color, background, font-size). The true rendered style is only knowable by reading both blocks together.
- The same 6-line visually-hidden clip-rect recipe is hand-duplicated 4 times (`.public-overview > h2`, `.records-table > h2`, `.record-detail-heading`, `.explorer-subtitle`'s compact override) instead of one shared `sr-only`-style class.

**Existing reusable primitives worth preserving as-is**: `CompactSectionIndex`/`SourceCompactSectionIndex` (genuine single-implementation reuse), `UnavailableNote`/`useUnavailableNote` (genuine single-implementation reuse), `RecordFieldTree` (genuine single-implementation reuse across record types), `.shell-frame` (the one working shared outer-frame CSS primitive), and the `.record-detail-columns/-main/-rail` reading-layout primitive shared by Record Detail and Problem View.

## 7. Responsive findings

- The stated invariant in `docs/explorerarchitecture.md` §5 (compact ≤767px, desktop ≥768px, 360px a QA viewport not a breakpoint) is upheld consistently in the CSS — confirmed by direct inspection of every `@media` query in the file (5 total, at lines 179, 1887, 2139, 2181, 2931).
- Two additional bands exist beyond the base two-tier split, both intentional and explained in adjacent comments rather than undocumented drift: a `480px` sub-breakpoint scoped to one reference-list component, and a `768–1059px` intermediate geometry band scoped to the two reading surfaces (Record Detail, Problem View) that explicitly falls back to the compact single-column structure (layout only, not compact typography/nav) because the canonical 980px two-column composition cannot fit that width range.
- Mobile-specific behavioral differences observed in the screenshots and CSS: sticky compact header (`.explorer-chrome` gains `position: sticky` only ≤767px), rail content moved in-flow via `CompactSectionIndex`/disclosure patterns rather than reflowed sideways, 44px minimum tap targets applied to compact inputs/buttons/pagination (`--tap-min` token, consistently applied at ≤767px), and full-width form controls.
- No page-level horizontal overflow was observed in either compact screenshot (Records or Record Detail), consistent with the architecture doc's explicit responsive invariant against unintended horizontal overflow.

## 8. Accessibility-relevant findings

- Single `<main id="main-content">` landmark app-wide; every major view section carries `aria-labelledby`/`aria-label` paired with a real heading — no landmark found without an accessible name in the files reviewed.
- Consistent `role="status" aria-live="polite"` for loading states and `role="alert"` for error states across async views.
- Consistent `aria-pressed` for toggle-style selection (record rows, sort buttons), `aria-current="page"` for nav/tabs, `aria-hidden="true"` on decorative glyphs.
- `RecordDetailPanel.tsx`, `ProblemView.tsx`, `ProblemHistoryView.tsx`, and `GraphExplorer.tsx` each independently reimplement the same "move focus to the heading (or error box) on data load/navigation" pattern (`useRef` + `tabIndex={-1}` + `useEffect`) rather than sharing one hook — functionally consistent, but the implementation itself is duplicated four times.
- `:focus-visible` is styled globally (`outline-color: var(--accent)`), and one component (`UnavailableNote`) deliberately uses a `:focus-visible ~ note` CSS pattern instead of the native `title` attribute specifically because `title` isn't reliably exposed to keyboard-only/screen-magnifier users (documented in a code comment) — the same pattern is reused for `.effect-chip`. This is a considered, not accidental, accessibility choice.
- The 4x-duplicated visually-hidden recipe (§6) is a maintenance/consistency risk if a future accessibility fix (e.g., adjusting the clip technique) needs to be applied — it would need to be found and changed in four places rather than one.

## 9. KEEP / MERGE / REPLACE / REMOVE matrix

| Component/pattern | Classification | Rationale |
|---|---|---|
| `.shell-frame` outer-frame primitive | **KEEP** | Already the single consolidated desktop-width primitive; documented intent matches actual usage. |
| `.record-detail-columns/-main/-rail` reading layout | **KEEP** | Genuinely shared between Record Detail and Problem View; the one strongest layout primitive in the app. |
| `--space-N`, `--radius-*`, `--recipe-*` token scales | **KEEP** (as a foundation) | Real, coherent scales exist; the problem is under-adoption, not the scales themselves. |
| `CompactSectionIndex` / `SourceCompactSectionIndex` | **KEEP** | Genuine single-implementation reuse across EVD and Source. |
| `UnavailableNote` / `useUnavailableNote` | **KEEP** | Genuine single-implementation reuse; considered accessibility rationale documented inline. |
| `RecordFieldTree` | **KEEP** | Generic recursive renderer, reused across record types. |
| `RecordsTable` / `NarrowRecordsList` desktop/compact split | **KEEP** (as a pattern) | Confirmed to operate on one shared computed row set, branching presentation only — the split itself is sound; DS-02/03 may still choose to reshape the components. |
| CSS-parsing structural regression tests (`recordDetailLayout.test.ts`, `readingGuideLayout.test.ts`) | **KEEP** | Proven to catch real historical layout regressions; a good pattern to extend, not discard. |
| Pre-token raw-color/raw-size rules (lines ~8–1480 of `index.css`) | **MERGE** | Same visual roles as existing tokens in most cases (e.g. `#ccc`≈`--line`, `#555`≈`--ink-faint`); candidates for consolidation onto the existing token set rather than a new one. |
| 5 independent "small labeled pill" CSS recipes (role-chip, type-badge, status-chip, effect-chip, narrow-record-type) | **MERGE** | Same conceptual primitive, 5 divergent implementations; a DS-02 candidate to unify behind one base class/recipe. |
| 5 near-identical `Source*Section.tsx` "extract → dl" components | **MERGE** | Same template repeated 5 times at the TSX level; a parameterized version is a reasonable DS-02/03 target. |
| Duplicated visually-hidden clip-rect recipe (4 places) | **MERGE** | Same 6-line block, 4 independent copies; consolidate to one shared class. |
| Duplicated `.narrow-record-*` rule definitions (pre-token block + later override block) | **MERGE** | Both blocks are currently load-bearing (structural vs. visual properties split across them); should become one coherent definition. |
| Near-duplicate warm greys (`#bbb3a3`, `#beb7aa`, `--icon-muted`) and near-duplicate radii (`0.3rem`, `0.22rem`, `0.2rem`, `0.18rem` vs. the 3-step radius scale) | **MERGE** | Reads as accidental drift around existing tokens rather than an intentional secondary scale. |
| Seven distinct ad hoc prose-measure widths (`42rem`–`68rem`) | **MERGE** | Same conceptual need (constrain a text block), no shared scale; a DS-02 candidate for a small canonical measure set. |
| Dangling `design-system.md §N` comment references | **REPLACE** (the citation, not necessarily the rationale) | The cited document no longer exists; the rationale embedded in the comments themselves still reads as valid and should be preserved, but the citation needs a live target once DS-02/03 produce one, or should be rewritten to stand alone. |
| Independent duplicated focus-management hook logic (4 components) | **MERGE** | Same behavior, 4 separate implementations; a shared hook is a reasonable, low-risk DS-03 target. |
| `.records-explorer` scan/browse layout | **KEEP** | Structurally distinct concern from the reading-column layout; not a duplicate needing merging. |
| Nothing identified in this audit as **REMOVE** | — | No dead/unused component or CSS block was identified as safe to delete outright within the scope of this audit; see §12 for explicit non-findings. |

## 10. Current-state architecture map

```
Foundation
  --canvas/--surface*/--ink*/--line*/--accent*  (15 color tokens, ~1481+ only)
  --space-1..11                                  (11-step spacing scale)
  --radius-sm/md/lg                              (3-step radius scale)
  --recipe-*-family/size/weight/line-height       (~15 typography recipe tokens, partially adopted)
  --editorial/--ui/--technical font stacks
  ⚠ ~26 raw colors, ~34 raw font-sizes, ~52 raw spacing values, 6 raw radii
    still coexist outside this foundation (pre-token era, lines ~8–1480)

Layout
  .shell-frame                    — shared desktop outer-frame (max-width + centering)
  .explorer-shell / .explorer-chrome — app shell + sticky-on-compact header
  .record-detail-columns/-main/-rail — shared two-column reading layout
                                       (Record Detail + Problem View)
  .records-explorer               — independent scan/browse (table + panel) layout

Generic UI
  CompactSectionIndex (+ SourceCompactSectionIndex adapter)
  UnavailableNote / useUnavailableNote
  RecordFieldTree
  ContextTabs
  ReadingGuide
  ⚠ 5 divergent "chip/badge/pill" recipes not unified into one primitive
  ⚠ visually-hidden clip-rect recipe duplicated 4x instead of shared

Domain Component
  RecordsTable / NarrowRecordsList        (records scan, desktop/compact)
  RecordDetailPanel / EvdDetail            (record detail, type-specialized)
  Source*Section.tsx (×7)                  (5 near-duplicate + 2 relation-based)
  ProblemView / ProblemHistoryView         (problem reading + history)
  GraphExplorer / GraphCanvas              (deferred public surface)

Page Composition
  Overview.tsx    → public landing
  Explorer.tsx    → URL-synced view router + nav
  RecordsExplorer.tsx → Records ↔ Record Detail routing
  App.tsx         → load/error/ready shell
```

## 11. Highest-impact inconsistencies / maintenance risks

Ranked by combination of frequency and risk of visible drift:

1. **Token adoption is split roughly at a single historical line boundary (~1480), not by rule type.** Nearly all raw hex/hardcoded values sit before that point and nearly all `var()` usage sits after it — meaning any future edit to an "old" rule is likely to reintroduce a non-token value by default (there is no lint/test currently preventing this).
2. **Five independent chip/badge/pill recipes** for what is functionally one UI concept — the highest-visibility inconsistency, since these render as small colored labels throughout Records, Record Detail, and Problem View and are the kind of thing users compare side-by-side.
3. **Duplicated `.narrow-record-*` definitions split across two non-adjacent blocks** (structural vs. visual properties) — a real risk for a future editor who only finds and edits one of the two blocks.
4. **Seven ungoverned prose-measure widths** (`42rem`–`68rem`) — low visual risk today (each is used in a different, non-adjacent context) but a likely source of "why is this text block a different width than that one" questions once a token scale is introduced.
5. **Dangling `design-system.md` citations** — a documentation-integrity issue: engineers reading `index.css` today are pointed at a document that AGENTS.md's own control-plane list confirms no longer exists, with no substitute; this is a real information-loss risk for anyone using the comments to understand *why* the 980px/720px/44px/216px numbers were chosen.
6. **Four independently-duplicated visually-hidden and focus-management implementations** — lower visual risk (behavior is currently consistent) but a real cost multiplier for any future accessibility-technique change.

## 12. Explicit non-findings / things that do not justify change

- **The breakpoint model is not broken.** All deviations from the strict 767/768 split are intentional, narrowly scoped, and explained in adjacent comments; none read as accidental.
- **The `.shell-frame` / reading-column layout primitives are not fragmented.** They are already the app's best-consolidated pattern and should not be treated as a problem to solve.
- **The desktop/compact Records split (`RecordsTable` vs. `NarrowRecordsList`) is not duplicated data logic** — it is confirmed (by reading the code, not assumed) to operate on one shared computed row set with presentation-only branching.
- **No dead or unused component was found.** Every `.tsx` file reviewed is reachable from a real view and has a corresponding non-skipped test.
- **Test suite is green** (408 passed / 1 skipped / 0 failed) — there is no correctness regression underlying this audit; all findings are structural/consistency observations, not bugs.
- **The existing structural CSS-parsing regression tests are a good pattern, not a workaround to be replaced** — they were written in direct response to real historical bugs and continue to pass.
- **`docs/design/archive/research-explorer-prototype/*.dc.html`** are confirmed (via code comments citing "Prototype A/B/D" as the approved reference for specific implemented decisions) to be historical inputs already reflected in the shipped implementation, not an unrealized target — consistent with the task's framing that they are historical references, not something to copy anew.
- **No evidence was found of a performance or corpus-size problem** — out of scope for this audit and not investigated further, consistent with `docs/explorerarchitecture.md` §7's guidance to treat performance as measured evidence, not speculation.

## 13. Gate A review questions

For human decision before DS-02/DS-03 scope is finalized:

1. Should the ~1480-line boundary between pre-token and token-era CSS be treated as a hard migration boundary (i.e., DS-02 aims to eliminate all raw values above it), or is partial/targeted migration (only the items in the MERGE row of §9) sufficient for the milestone's goals?
2. The five chip/badge/pill recipes render slightly different visual weights (radius `sm` vs `md`, different padding) for what may or may not be intended as the same semantic tier — is that variation meaningful (e.g., "technical identifier chip" vs. "canonical-value chip" deserve different weight) or accidental? This is a product/design judgment this audit cannot resolve from the code alone.
3. `design-system.md` was deliberately removed as part of a documentation control-plane rationalization (commit `e13712b`). Should its content be recovered/rewritten as part of DS-02 (since it's the cited source for several still-load-bearing design decisions), or were those decisions meant to be re-derived fresh in the new design system rather than preserved?
4. Do the seven Source*Section.tsx components' near-identical structure represent a genuine merge opportunity, or does the per-field-group separation (Overview/Coverage/Dates & Access/Licensing/Caveats/Findings/Investigation/Technical) reflect a deliberate content-authoring/ownership boundary from `docs/datamodel.md` that should stay separate even if the code is templated?
5. Should the four independently-duplicated focus-management (`useRef`+`tabIndex`+`useEffect`) implementations be unified into a shared hook as part of DS-02/03, or is that considered implementation detail outside the Design System milestone's scope (per AGENTS.md's guidance that exact runtime shapes belong to code, not documentation)?
6. Is `GraphExplorer`/`GraphCanvas` in scope for the Design System milestone at all, given `docs/explorerarchitecture.md` §3 currently defers Graph as a primary public surface? This audit intentionally did not capture Graph screenshots or include it in the required-screens set for that reason — confirm that exclusion is correct before DS-02 scoping.
