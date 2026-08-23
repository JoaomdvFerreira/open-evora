# Research Explorer — Design System v1 (approved, canonical)

Status: **APPROVED**. This document is the canonical, repository-integrated source for the Research Explorer visual design system. It is derived from the approved `Research-Explorer-Design-System.md` v1.3.1 and its rendered companion (`Research-Explorer-Design-System.dc.html`), with the canonical corrections in [§0.1](#01-canonical-corrections-applied-at-integration) applied during integration.

Same visual language as the approved source — no redesign performed during integration. See [visual-implementation-contract.md](visual-implementation-contract.md) for precedence rules, binding vs. illustrative design intent, and the phased V1/V2/V3 rollout this document feeds.

## 0. Implementation Authority / Precedence

1. **This document** defines canonical reusable visual rules and implementation contracts for the Research Explorer.
2. **Approved page prototypes A–D** remain authoritative for page-specific composition where more specific than this document.
3. The 360px frames from the approved Design System source are golden **QA/Playwright visual references** — not a production breakpoint (see §0.1).
4. Current live styling has no precedence over this document or the approved page prototypes.
5. Implementation agents translate the approved design into production code. They do not independently redesign or reinterpret it.
6. Deviation requires a concrete reason: semantic correctness, accessibility, responsive necessity, real-data constraint, or technical constraint. "Current styling works" is not a valid deviation reason.
7. Canonical data, public PT-PT semantics, and publication-safety rules remain authoritative over illustrative prototype content.

### 0.1 Canonical corrections applied at integration

These corrections were made when integrating the approved source into this repository. They do not change visual intent — they resolve terminology/measurement details for production use:

- **Breakpoints**: production uses **compact `<=767px`** and **desktop `>=768px`**. **360px is a QA/golden viewport used for Playwright visual comparison, not a breakpoint.** (The approved source's "bp-compact" bucket corresponds to `<=767px`.)
- **Production content widths** (supersede the Design System doc-shell width, which is doc chrome only and never production):
  - Reading (Problem View): **800px**
  - Workspace / Overview: **900px**
  - Record Detail: **980px** total = 720px main content column + 44px gap (`--detail-gap`) + 216px rail
  - Design System doc shell width (1180px) is never a production content width.
- **Fonts**: Inter, Source Serif 4, and IBM Plex Mono are **locally bundled/self-hosted** in production (currently via `@fontsource/*`, imported in [main.tsx](../../../apps/research-explorer/src/main.tsx)). There is no runtime Google Fonts fetch or other network font dependency. This matches §10 of the approved source (deterministic golden rendering via `local()` fallback) but production goes further: it ships the font files itself rather than relying on `local()` resolution.

Everything else in this document preserves the approved source's semantics as-is.

## 1. Foundations

Declared once as custom properties on `:root` (see [§6](#6-current-production-mapping--integration-status) for current production token names and migration status), consumed everywhere via `var()`.

- **Colour**: `canvas #FAF8F3`, `surface-recessed #F5F3EC`, `surface-chip #F1EFE8`, `surface-raised #FFFFFF`, `text-primary #1F1D1A`, `text-secondary #3A372E`, `text-tertiary #565248`, `text-muted #6B675F`, `text-faint #8A8578`, `text-disclaimer #A6A192`, `icon-muted #B7B2A4`, `border #DDD8CC`, `border-light #EEEAE0`, `border-control #C7C2B4`, `border-emphasis #1F1D1A`, `link #2B5D5A`, `link-hover #1D4341`.
- **Spacing scale**: `space-1…11` = 4/8/12/16/20/24/32/40/48/64/90px.
- **Named exceptions to the scale** (not on the space-N ladder): `control-height:40px` (inputs/selects/buttons), `tap-min:44px` (any tappable row/link), `detail-gap:44px` (desktop two-column gap, Record Detail).
- **Radii**: `radius-sm:3px`, `radius-md:4px`, `radius-lg:5px`.
- **No-shadow rule**: `box-shadow` is never used in production. Elevation/separation comes only from 1px borders and the three flat surface steps (surface-raised → surface-recessed → surface-chip). A component that seems to need a shadow needs a border or surface step instead.
- **Breakpoints**: two canonical buckets, no intermediate tablet tier — **desktop `>=768px`** (full GlobalShell, §3) and **compact `<=767px`** (wordmark row + 3 equal-width nav tabs, §3). 360px is a QA/golden reference width for Playwright comparison, not a breakpoint (§0.1).
- **Production content widths (approved, per surface)**: Record Detail **980px** = 720px main content column + 44px gap (`detail-gap`) + 216px rail · Reading (Problem View) **800px** · Workspace / Overview **900px** · compact, all surfaces: full-bleed to viewport, 360px used only as the QA/golden reference width.

## 2. Semantic Typography Recipes (implementation-ready)

Each is a bundle of custom properties (`family/size/weight/lh/letter-spacing/transform`) — an implementer selects the recipe, never assembles size+family+weight independently.

| Recipe | Family | Size | Weight | Line-height | Notes |
|---|---|---|---|---|---|
| `text-wordmark` | Inter | ui-md 15 | 700 | 1.2 | |
| `text-shell-subtitle` | Inter | ui-base 14 | 400 | 1.3 | `color-text-muted` |
| `text-global-nav` | Inter | ui-base 14 | 400 (600 active) | 1.3 | |
| `text-section-label` | Inter | ui-xs 12 | 600 | 1.4 | uppercase, ls .5px |
| `text-interface-body` | Inter | ui-base 14 | 400 | 1.55 | |
| `text-interface-meta` | Inter | ui-xs 12 | 400 | 1.4 | |
| `text-problem-card-title` | Source Serif 4 | serif-base 15 (compact: serif-sm 14) | 400 | 1.45 | |
| `text-record-label` | Inter | ui-base 14 | **600** (canonical) | 1.35 | |
| `text-editorial-intro` | Source Serif 4 | serif-xl 22 (compact: serif-lg 17) | 400 | 1.55 | |
| `text-editorial-body` | Source Serif 4 | serif-lg 17 | 400 | 1.6 | |
| `text-editorial-h1` | Source Serif 4 | serif-2xl 25 (compact: serif-lg 17) | 600 | 1.4 | |
| `text-evidence-hero` | Source Serif 4 | serif-lg 17 | 400 | 1.5 | |
| `text-technical-id` | IBM Plex Mono | mono-xs 11 | 400 | 1.3 | `color-text-faint` |
| `text-technical-field` | IBM Plex Mono | mono-md 13 | 400 | 1.4 | `color-text-secondary` |
| `text-technical-meta` | IBM Plex Mono | mono-2xs 10 | 400 | 1.3 | `color-text-faint` |
| `text-status` | Inter | ui-2xs 11 (standard variant: ui-sm 13) | 400 | 1.2 | |
| `text-control` | Inter | ui-base 14 | 400 | 1.2 | inputs/selects/buttons |

Zero production-binding literal font sizes should remain outside this table once V1 visual reconciliation is complete (see §6 for current status).

## 3. GlobalShell / GlobalNav — universal, single canonical pattern

Used identically by all four surfaces (Overview, Records, Record Detail, Problem View). No page-specific shell variants.

**Desktop (`>=768px`)**: `text-wordmark` + `text-shell-subtitle`; nav items `text-global-nav`, gap `space-6`; active item weight 600, `border-bottom:2px solid color-link`, `padding-bottom:space-1`; breadcrumb (record-scoped pages only) sits directly beneath as a second bar, same horizontal padding as shell.

**Compact (`<=767px`) canonical order** (record-scoped pages): wordmark row → 3 equal-width global-nav tabs → breadcrumb → ContextTabs (PRB identity in view only, per below) → page content. Global navigation is never hidden or collapsed to an icon at compact widths.

**ContextTabs rule, explicit (corrected UX-B)**: Detalhe/Problema/Grafo is a PRB-identity-scoped triad, not a Problem-View-only one — it appears while viewing the **same PRB record's identity** across all three of its representations: PRB Record Detail (`Detalhe` active), Problem View (`Problema` active), and Graph focused on that PRB (`Grafo` active). Navigating between tabs preserves the PRB identity. A non-PRB record never renders ContextTabs in any of the three surfaces — Record Detail for a non-PRB record (e.g. a bare EVD- evidence record reached directly) keeps its equivalent navigation as explicit named links inside "Mais ações" (Ver como Problema / Ver no Grafo), and Graph focused on a non-PRB record likewise renders no PRB ContextTabs. This is a rule, not an omission.

**Hover/focus**: nav items are real links; hover → `color-link-hover` + underline; focus-visible → `outline:2px solid color-link; outline-offset:2px` on the control itself, never on a sub-element.

## 4. FilterSelect — unified-control correction

- Outer `position:relative` wrapper, width 100%.
- `<select>` fills the wrapper: `height:control-height(40px)`, single `border:1px solid color-border-control`, `border-radius:radius-md`, `appearance:none`, `padding: 0 space-7 0 space-3` (extra right padding reserves chevron space), `text-control` recipe.
- Chevron is an `aria-hidden` `<span>` absolutely positioned `top:50%; right:space-3; transform:translateY(-50%); pointer-events:none`, `color-text-faint`, small size — visually subordinate, never boxed, never bordered.
- Focus-visible ring applies to the `<select>` element as a whole, never to the chevron span.
- Same anatomy at desktop and compact; no horizontal overflow.
- Reads as `[ Tipo ▾ Todos                    ⌄ ]`, not a boxed arrow button.

## 5. Contribution Terminology — OWNER APPROVED, FINAL

No longer provisional. Public PT-PT presentation (raw enum confined to TechnicalDisclosure only):
`CONFIRMS→CONFIRMA · REFINES→REFINA · CONTRADICTS→CONTRADIZ · CURRENT-STATE-UPDATE→ATUALIZA O ESTADO · EXISTING-SOLUTION→SOLUÇÃO EXISTENTE · PLANNED-SOLUTION→SOLUÇÃO PLANEADA · NEW-CANDIDATE→NOVO CANDIDATO`

## 6. Current production mapping / integration status

The production stylesheet ([apps/research-explorer/src/index.css](../../../apps/research-explorer/src/index.css)) implements the "V1 visual foundation" token layer under `:root` using its own established names (`--canvas`, `--ink`, `--ink-soft`, `--ink-faint`, `--line`, `--line-subtle`, `--accent`, `--accent-dark`, `--editorial`, `--ui`, `--technical`, plus the `--space-*`/`--control-height`/`--tap-min`/`--detail-gap`/`--radius-*` scale). This is the existing canonical token location for the app — there is no separate `design-tokens.css` or parallel styling architecture, and none should be introduced. As of this integration, the color/spacing/radius **values** are byte-identical to §1 above; only the **names** differ (kept as the app's established naming rather than introducing the Design System's own property names).

Mapping from this document's foundation names to the current production tokens:

| This document | Current production token |
|---|---|
| `color-canvas` | `--canvas` |
| `color-surface-raised` | `--surface` |
| `color-surface-recessed` / `color-surface-chip` | `--surface-muted` / `--surface-chip` |
| `color-text-primary` | `--ink` |
| `color-text-secondary` | `--ink-soft` |
| `color-text-tertiary` / `color-text-muted` | `--ink-faint` |
| `color-text-faint` | `--ink-faintest` |
| `color-text-disclaimer` | `--ink-disclaimer` |
| `color-icon-muted` | `--icon-muted` |
| `color-border` | `--line` |
| `color-border-light` | `--line-subtle` |
| `color-border-control` | `--line-control` |
| `color-border-emphasis` | `--line-emphasis` |
| `color-link` | `--accent-dark` |
| `color-link-hover` | `--accent` |
| `space-1…11`, `control-height`, `tap-min`, `detail-gap`, `radius-sm/md/lg` | identical names (`--space-1…11`, `--control-height`, `--tap-min`, `--detail-gap`, `--radius-sm/md/lg`) |
| `text-editorial-*` family | `--editorial` |
| `text-*` (Inter recipes) family | `--ui` |
| `text-technical-*` family | `--technical` |

Known deviations, intentionally deferred to the V1 visual reconciliation pass (not in scope for this integration):

- The semantic typography *recipes* (§2) are implemented as `--recipe-*` custom-property primitives in `:root` (e.g. `--recipe-editorial-h1-family/-size/-size-compact/-weight/-line-height`), one group per recipe row. No existing component selector consumes them yet — production selectors still assemble literal sizes/weights inline, using the correct families/colors. Migrating component selectors onto these primitives is V1/V2/V3 visual-fidelity work per [visual-implementation-contract.md](visual-implementation-contract.md), not this integration.
- `text-record-label` weight, FilterSelect chevron anatomy, ContextTabs placement, and other component-level compositions in §3–§5 are visual-fidelity work for V1/V2/V3, not this integration.

## 7. Remaining unresolved (carried from approved source)

- Desktop Records: principles only, still no approved visual spec.
- Authoritative glosses for `CONFIRMS/REFINES/CURRENT-STATE-UPDATE/NEW-CANDIDATE` (as enum *meaning*, not label) and `corroborated` vs `discovered` — canonically undocumented.
- Graph view, at any width — out of scope.
- Generic (non-PRB) Detail context switcher — deferred.
