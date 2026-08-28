# DS-03A — Research Explorer Component & Layout Contract

Status: **PROPOSED — architecture analysis for human Gate C1**

Scope: component and layout boundaries derived from the current Research Explorer. This document proposes a bounded architecture for later implementation. It does not approve component APIs, freeze token values, redesign pages, or change production React/CSS.

The current implementation is the primary evidence for current-state claims. The DS-01 audit in `docs/design/audits/ds-01-current-state/audit.md` remains a useful baseline, but code that changed after that snapshot takes precedence. In particular, `RecordsExplorer` now renders the records list and a selected full-page detail mutually exclusively; `.records-explorer` no longer contains a persistent table-and-detail split.

## 1. Architecture principles

1. **Canonical meaning stays outside visual primitives.** Foundation and layout code may control appearance and geometry. It must not infer research state, translate canonical values, decide section presence, group Evidence, or derive Source/Problem relationships.
2. **Visual similarity is insufficient evidence for semantic reuse.** Record type, canonical identifier, Problem state, PRB→EVD effect, research role, absence, unavailability, methodology, and caveat content remain distinct dimensions even when they use similar borders, radii, or compact text.
3. **Reuse proceeds from layout to semantics.** Prefer a shared frame, flow, grid, surface, or label recipe before introducing a polymorphic React component. Add a shared domain component only when the same domain meaning and behaviour recur.
4. **Composition owns landmarks and reading order.** Page/domain code retains `<main>`, `<article>`, `<section>`, `<aside>`, headings, accessible names, conditional presence, and section order. A generic `Section` component must not conceal those decisions.
5. **Human-readable meaning leads; technical identity remains available.** Shared identifier presentation must never turn an ID into a status or allow a technical label to dominate titles, observations, or sustained prose.
6. **The approved reading relationship is invariant.** The desktop reading composition remains a 720px main measure, a 44px gap, and a 216px supporting rail inside the existing 980px frame. Later implementation may name that relationship but must not change its values in this phase.
7. **Responsive reuse means recomposition, not shrinking.** The current `767px`/`768px` boundary and the geometry-only `768px–1059px` fallback remain intact. Compact and intermediate layouts move supporting content in flow or provide an equivalent in-flow index; essential text does not shrink to preserve a two-column shape.
8. **Native semantics come first.** Use `<a>`, `<button>`, `<input>`, `<select>`, `<fieldset>`, `<details>`, and `<summary>` directly. Shared styling must not erase the difference between navigation and activation or introduce headless/external primitives without demonstrated interaction complexity.
9. **A small demonstrated system is preferable to a catalogue.** This contract admits only primitives supported by multiple current call sites. It does not add a generic modal, tooltip system, data table, form framework, page-header framework, or card library.
10. **Migration is incremental and reversible.** Existing classes and components remain valid until their call sites have moved and deterministic/rendered checks pass. `RETIRE-LATER` never authorizes deletion during DS-03A.

## 2. Layer definitions

### 2.1 Foundation

Global visual and accessibility rules with no component structure or research semantics: typography roles, colour roles, spacing/radius scales, focus treatment, native element baseline, readable measures, responsive boundaries, and visually-hidden technique.

Foundation may provide CSS variables and low-level recipes. It must not expose canonical enum inventories, record-type logic, state labels, or final token values in this document.

### 2.2 Layout primitives

DOM-neutral geometry controlling width, flow, alignment, wrapping, and responsive recomposition. Layout primitives accept content but do not choose headings, landmarks, labels, order, or presence.

The bounded proposed set is:

- `ShellFrame`: width and horizontal centring only;
- `ReadingLayout`: main reading column plus supporting rail and current recomposition behaviour;
- `Stack`: vertical flow with a small set of demonstrated spacing variants;
- `Cluster`: wrapping inline flow with alignment and demonstrated spacing variants;
- `SectionFlow`: spacing between already-semantic sections, implemented as a class/recipe rather than a React `<Section>` owner.

A generic `Grid` is not admitted yet. The current grids encode materially different concerns; the repeated public fact layout belongs to `FactList`, while Overview, Records, and Graph grids remain local.

### 2.3 Generic UI

Reusable accessible presentation whose meaning is supplied by the caller: breadcrumb structure, section indexes, fact lists, feedback framing, unavailable-control explanation, native action/control recipes, surface recipes, and visual label anatomy.

Generic UI may enforce HTML and accessibility behaviour. It must not determine whether a Source field is present, what a Problem status means, which Evidence belongs to a group, or whether an absent value means `NO`, `UNKNOWN`, unavailable, or not authored.

### 2.4 Domain components

Presentation that knows Explorer concepts or research relationships: record identifiers/types, PRB context navigation, Problem state, Evidence effects, research roles, Source sections, canonical record inspection, Evidence cards, reference rows, and record/problem/evidence headers.

Domain components may share generic UI and layout primitives. They retain formatting, labels, conditional presence, navigation intent, and semantic variants for their own canonical dimension.

### 2.5 Page composition

Route/view orchestration, data-state ownership, landmark structure, section order, responsive equivalents, and focus entry. Composition combines lower layers without creating a parallel copy of URL state or canonical research state.

Current owners include `App`, `Explorer`, `Overview`, `RecordsExplorer`, `RecordDetailPanel`, `ProblemView`, `ProblemHistoryView`, and `GraphExplorer`.

## 3. Current-state inventory

This is a bounded inventory of meaningful presentation boundaries, not a complete source-file catalogue.

| Area | Current evidence | Current responsibility and finding |
| --- | --- | --- |
| App shell | `apps/research-explorer/src/app/App.tsx`, `apps/research-explorer/src/app/Explorer.tsx`, `.explorer-shell`, `.explorer-chrome`, `.explorer-chrome-inner` | Startup feedback, skip link, full-bleed header, primary navigation, URL-synced view composition, and corpus footer. Header markup is used once and is correctly app-owned. Loading/error/footer content does not consistently use `.shell-frame`. |
| Outer frame | `.shell-frame` in `apps/research-explorer/src/index.css`; used by Explorer chrome, Overview, Records, Record Detail, Problem View, and History | One successful shared width/centring contract. It contains no page semantics and should remain the sole ordinary desktop frame. |
| Reading layout | `.record-detail-columns`, `.record-detail-main`, `.record-detail-rail`, `.problem-reading-rail`, compact index visibility rules in `apps/research-explorer/src/index.css` | Shared by Record Detail and Problem View; also carries Source/EVD rails. It already owns the approved reading geometry and intermediate/compact recomposition. |
| Records scan | `apps/research-explorer/src/records/RecordsTable.tsx`, `apps/research-explorer/src/records/NarrowRecordsList.tsx`, `.desktop-records-list`, `.narrow-records-list` | Desktop and compact presentations consume the same filtered/sorted/paginated rows. Their different DOM is legitimate responsive composition, not duplicated domain state. |
| Record Detail | `apps/research-explorer/src/records/RecordDetailPanel.tsx` | A large records-domain composition containing breadcrumb, generic/SRC/PRB branches, metadata, canonical-state inspection, references, relations, technical disclosure, rail, loading/error, and focus entry. It is the main boundary pressure point, but its specialised parts should not become generic merely to reduce file size. |
| EVD reading | `apps/research-explorer/src/records/EvdDetail.tsx` | EVD identity, scope, inference limits, PRB uses, Source provenance, technical inspection, and EVD section indexes. It correctly keeps EVD content and PRB→EVD relationship meaning in the domain layer. |
| Source reading | `apps/research-explorer/src/records/SourceOverviewSection.tsx`, `apps/research-explorer/src/records/SourceCoverageSection.tsx`, `apps/research-explorer/src/records/SourceDatesAccessSection.tsx`, `apps/research-explorer/src/records/SourceLicensingSection.tsx`, `apps/research-explorer/src/records/SourceCaveatsSection.tsx`, `apps/research-explorer/src/records/SourceFindingsSection.tsx`, `apps/research-explorer/src/records/SourceInvestigationSection.tsx`, `apps/research-explorer/src/records/SourceTechnicalSection.tsx` | Four fact sections repeat section heading plus `.detail-provenance-grid`; caveats, findings, investigation, and technical inspection have different semantics/structures. `sourceSectionIndex` and `computeSourceSectionPresence` already centralise order/presence correctly. |
| Problem reading | `apps/research-explorer/src/problem/ProblemView.tsx` | Problem header, authored current state, Evidence partition, open questions, contradiction search, investigation path, section index, rail, focus entry, and error states. Presentation is dense but its boundaries correspond to distinct authored concepts. |
| Problem history | `apps/research-explorer/src/problem/ProblemHistoryView.tsx` | Authored material history projection with state transitions and Evidence references. It reuses Problem list/item styles appropriately but duplicates the Problem breadcrumb structure. |
| PRB context nav | `apps/research-explorer/src/navigation/ContextTabs.tsx`, `.context-tabs` | One real shared domain component used by Detail, Problem, History, and dormant Graph context. Its identity-preserving PRB semantics make it domain-owned, not generic tabs. |
| Section navigation | `CompactSectionIndex`, `SourceCompactSectionIndex`, `SourceReadingRailIndex`, `EvdReadingRail`, `ProblemReadingRail`, and the compact index inside `ProblemHelpDisclosure` | Callers correctly own section order/presence, but rail/compact `<nav>/<ul>/<a>` markup and styling are repeated. This supports one semantics-free `SectionIndex` renderer with domain-provided entries. |
| Metadata/facts | `.detail-provenance-grid`, `.problem-scope-grid`, `.problem-header-facts`, `.evd-relation-facts` | Repeated `<dl>` geometry exists. `.detail-provenance-grid` is reused across generic, PRB, SRC, and EVD views; `problem-scope-grid` is already shared by Problem and EVD. Values and presence remain caller-owned. |
| Identifier/type | `formatTypedId`, `TypedLinkButton`, `RelatedRecordButton`, `.detail-technical-field`, `.source-finding-id`, `.detail-reference`, `.prb-reference-target`, `.detail-type-badge`, `.narrow-record-type` | Canonical record identity and record type recur in static and actionable forms. Current styling is fragmented, and type prefixes are sometimes presented through pill recipes that resemble state. Identity and type should share domain components, never status semantics. |
| State/effect/role labels | `StatusChip` in `ProblemView`, `.overview-statuses`, `.effect-chip`, `.record-role-chip`, `.status-chip`, `.evd-identity-fact` | The visual anatomy overlaps, but the canonical dimensions do not. `.record-role-chip` is particularly overloaded: generic schema summary fields and EVD research roles use the same class name. Only base visual anatomy should consolidate by default. |
| Evidence/reference rows | `EvidenceCard`, `OpenQuestionEvidenceRefs`, `PrbCanonicalReferences`, `RelationshipList`, `SourceFindingsSection`, `SourceInvestigationSection`, and EVD Source/Problem lists | Rows answer different questions: observation, exact canonical path, related-record grouping, Source provenance, or Problem use. A generic “reference row” would erase those distinctions. A shared atomic record link/identifier is sufficient. |
| Surfaces | `.record-provenance`, `.effect-summary`, `.problem-help`, `.records-controls`, `.evidence-card`, `.open-question-item`, `.evd-problem-card`, `.problem-identity` | Repeated border/background/padding recipes exist, but the boxes express different boundaries. Consolidate visual surface recipes; keep landmarks/content in domain/page owners. |
| Disclosures/asides | `ReadingGuide`, `ProblemHelpDisclosure`, Overview status explanation, `TechnicalDisclosure`, `PrbRawTechnicalDisclosure`, Source/EVD technical sections | Native `<details>` is consistently appropriate. Their content semantics and default placement differ; there is no evidence for a polymorphic disclosure React component. Canonical technical inspection has enough same-domain repetition for a domain wrapper. |
| Feedback/absence | repeated `role="status"`, `role="alert"`, retry buttons, plain empty messages, `.field-empty`, `UnavailableNote` | Loading and error semantics are consistent but repeated. `.field-empty` currently spans absent canonical values, missing effects, and relationship emptiness, which is too broad a semantic name for a durable primitive. `UnavailableNote` is a proven accessible component and remains distinct. |
| Graph | `apps/research-explorer/src/graph/GraphExplorer.tsx`, `apps/research-explorer/src/graph/GraphCanvas.tsx` | A supplementary, domain-owned view with specialised controls and an HTML fallback. Graph redesign and Graph-specific component extraction are outside DS-03A. |

## 4. Proposed component and layout taxonomy

### 4.1 Foundation contract

- Keep the existing semantic direction of `:root`, global focus, link, typography-role, spacing, radius, surface, and responsive rules in `apps/research-explorer/src/index.css`.
- Later token work may consolidate legacy literals into approved roles, but DS-03A does not choose values or authorize a bulk migration.
- Extract one visually-hidden utility from the four repeated clip recipes used by `.public-overview > h2`, `.records-table > h2`, `.record-detail-heading`, and the compact `.explorer-subtitle` treatment.
- Keep technical typography as an identity/inspection role, not a general emphasis mechanism.
- Consolidate native focus and link recipes at Foundation. Keep element semantics at each call site.

### 4.2 Layout contract

| Primitive | Contract | Demonstrated users | Admitted variants |
| --- | --- | --- | --- |
| `ShellFrame` | Width and horizontal centring only; no page padding, vertical spacing, landmark, or surface | Chrome inner, Overview, Records, Record Detail, Problem View, History | No semantic variants. A full-bleed parent may contain it. |
| `ReadingLayout` | Approved main/rail relationship, sticky desktop rail, geometry-only intermediate recomposition, compact in-flow/equivalent content | Record Detail, Problem View, Source, EVD | `rail`, `no-rail`; rail visibility/content remains caller controlled. No automatic “short record” mode until approved. |
| `Stack` | Vertical flow only | Rail actions, Evidence lists, open-question/history lists, Graph controls, Source/EVD lists, section nav lists | A bounded spacing choice derived from current small/standard/section gaps; optional alignment. |
| `Cluster` | Inline or inline-flex wrapping only | Status/effect/role groups, EVD identity facts, reference link groups, Overview actions | A bounded spacing choice; start/centre/baseline alignment; no semantic tone. |
| `SectionFlow` | Vertical separation for already-semantic sections | `.problem-section`, `.record-editorial-section`, PRB technical sections | Standard and compact separation only if current rendered evidence supports both. CSS recipe/class, not a landmark-owning React component. |

`FactList` owns the repeated definition-list grid. A free-standing `Grid` does not enter the shared contract because `.overview-concepts`, record scanning, fact grids, relationship facts, and Graph controls do not yet demonstrate one coherent grid API.

### 4.3 Generic UI contract

| Candidate | Responsibility | Variants and exclusions |
| --- | --- | --- |
| `Breadcrumb` | Named navigation landmark, ordered actions/items, separator, current item | Caller supplies actual navigation element/action and current label. It never assumes `Registos` or `Visão geral`, derives a route, or formats an ID. |
| `SectionIndex` | Render caller-provided anchor entries as accessible rail or compact navigation | `rail` and `compact`; optional nested entries. Domain code remains sole owner of entry order, label, anchor, and presence. |
| `FactList` | Render a semantic `<dl>` from explicitly supplied labels and values with consistent geometry | `reading` and `compact` density only if both are demonstrated. It performs no field extraction, translation, absence inference, or ordering. |
| `FeedbackMessage` | Enforce accessible structure for repeated progress, error/retry, and empty-result presentation | Explicit semantic modes: progress uses live status; error uses alert; empty is ordinary content. “Unknown”, “not authored”, “unavailable”, and caveat are not automatic modes. |
| `UnavailableNote` | Explain a focusable `aria-disabled` control on hover and keyboard focus | Keep the current `useUnavailableNote` behaviour. It is not a general tooltip or status component. |
| Native action recipes | Apply consistent text-action, outlined-action, and tab-action appearance to the correct native element | CSS recipes/classes, not a polymorphic link/button component. Disabled versus `aria-disabled` stays interaction-owned. |
| Surface recipes | Provide border/background/padding anatomy without choosing HTML or meaning | At most plain outlined, muted inset, and interactive item recipes demonstrated by current surfaces. No default `Card` wrapper and no automatic cardification. |
| Inline-label recipe | Provide shared border/radius/padding/alignment anatomy for compact labels | Visual only. Domain components still own record type, state, effect, and research-role variants; tone must not encode meaning alone. |

Native `<details>/<summary>` remains the generic disclosure primitive. A React `Disclosure` abstraction is deferred: current disclosures differ mainly in content, default placement, anchor behaviour, and domain purpose, while the platform element already supplies the required interaction.

### 4.4 Domain component contract

| Domain component/family | Owner and responsibility | Legitimate variants | Boundary |
| --- | --- | --- | --- |
| `RecordIdentifier` | Records/presentation domain; canonical ID typography and optional navigation action | `text`, `action`; compact/standard density | Does not include state, type meaning, label, relationship direction, or canonical path. Caller supplies navigation intent. |
| `RecordTypeLabel` | Records/presentation domain; prefix plus approved public type label | compact list marker, detail badge | Does not accept Problem status/effect/role values. |
| `EvidenceEffectTag` | PRB→EVD relationship domain; one authored effect with public label and accessible context | compact and standard density only | Shared by Problem evidence and EVD Problem-use presentation. Does not accept `research_roles` or Problem state. |
| Problem state presentations | Problem domain; preserve field/dimension caption, public gloss, and canonical context | Overview summary, Problem reading chip, technical raw value, history transition | These are separate compositions over the same canonical fields. No single status component may erase the dimension caption or substitute a gloss for raw technical inspection. |
| `ContextTabs` | PRB domain; switch the same PRB identity among Detalhe, Problema, and Histórico | Active context only; dormant Graph may consume it without adding a tab in this phase | Remains domain-owned. It is not the generic tab/navigation primitive. |
| Source fact sections | Source domain; Source-owned grouping, extraction, labels, order, and presence | Overview, Coverage, Dates/access, Licensing | May share an internal `SourceFactSection` renderer/`FactList`; separate field selectors and public section components may remain for ownership/test clarity. |
| Source relation/caveat sections | Source domain; Findings, Investigation, Caveats, Technical inspection | Their existing content-specific states only | Must not be folded into `SourceFactSection`; caveat absence is not an affirmative no-caveat state. |
| `CanonicalInspection` family | Records domain; native technical disclosure and `RecordFieldTree` framing | generic full record, PRB exhaustive fallback, Source record-only, EVD with provenance/path facts | May share disclosure shell; field selection, captions, and auxiliary facts remain type-owned. |
| Evidence cards and references | Problem/EVD/Source/records domains | Current domain-specific card/list/row forms | Share `RecordIdentifier`, `EvidenceEffectTag`, `FactList`, `Stack`, and surfaces only. Do not introduce a generic research-reference row. |
| Record headers | Generic Record Detail, Source, EVD, and Problem owners | Current type-specific compositions | Share typography/layout atoms only. Problem title/statement/facts, EVD observation/scope facts, and technical Record Detail orientation are not variants of one semantic header. |
| `RecordFieldTree` | Records domain; exhaustive recursive canonical-field inspection | Existing value-kind rendering | Keep one implementation across record types; do not move it into Generic UI or make it a public metadata component. |
| Reading/methodology guidance | Guide and Problem domains | `ReadingGuide`, `ProblemHelpDisclosure`, rail caveat copy | Preserve separate authorship and placement. Shared surface/disclosure styling is allowed; content is not a generic notice. |

### 4.5 Page composition contract

- `App` retains startup state, skip-link target, and the one application `<main>`.
- `Explorer` retains URL-synced routing and primary navigation composition. Extracting a one-use `ExplorerHeader` is not justified by reuse; a later implementation may move it for readability without treating it as a design-system component.
- `Overview` retains its public narrative order, independence statement, status explanation, and Problem-list composition.
- `RecordsExplorer` retains the mutually exclusive list/detail workflow. `RecordsTable` and `NarrowRecordsList` remain separate responsive presentations over one row pipeline.
- `RecordDetailPanel` retains detail loading/focus entry and type routing. Its internal domain sections may move to smaller files without becoming shared UI.
- `ProblemView` retains its authored-section order and its single presence/index authority. `ProblemHistoryView` remains a separate projection rather than a ProblemView variant.
- `GraphExplorer` and `GraphCanvas` remain domain-owned and out of redesign scope.

## 5. Explicit component boundary decisions

### 5.1 Page/container geometry and wrapper duplication

`.shell-frame` is the canonical outer-frame primitive. Do not add independent per-page centring/max-width wrappers for ordinary Explorer surfaces. Page padding remains the full-bleed shell's responsibility; narrower prose measure remains content responsibility.

The loading/error branches in `App`, `RecordsExplorer`, `ProblemView`, `ProblemHistoryView`, and `GraphExplorer`, plus `.manifest-summary` and `.reading-guide`, currently use separate or implicit measures. Later implementation should align them through `ShellFrame` or an intentional reading measure, one surface at a time; this is consolidation, not authorization to redesign their content.

### 5.2 Reading layout and section indexes

`.record-detail-columns/-main/-rail` remains the single reading-layout implementation. Problem, Source, and EVD must not introduce parallel rail widths or breakpoint systems.

Rail and compact indexes may share `SectionIndex`, but their domain selectors remain separate:

- `problemSectionIndex` owns Problem order/presence and nested entries;
- `sourceSectionIndex` plus `computeSourceSectionPresence` owns Source order/presence;
- `evdSectionIndex` owns EVD order/presence.

The renderer must not evaluate records or relation state. `SourceCompactSectionIndex` can retire later as a thin adapter only after the shared renderer is adopted and its tests are preserved.

### 5.3 Breadcrumb and ContextTabs

The breadcrumb markup in `RecordDetailPanel`, `ProblemView`, and `ProblemHistoryView` is one generic pattern with different parent actions. Extract `Breadcrumb`.

`ContextTabs` stays a PRB-scoped domain component. Its tabs preserve one Problem identity across distinct public/technical/history orientations; that contract is not equivalent to generic tabs or global navigation.

### 5.4 Identifier, type, status, effect, and role

Create no universal `Chip` domain component.

- Consolidate only inline-label visual anatomy.
- Use `RecordIdentifier` for canonical identity.
- Use `RecordTypeLabel` for record type/prefix.
- Use `EvidenceEffectTag` only for PRB→EVD `effects`.
- Keep `research_roles` in an explicitly named domain wrapper.
- Keep Problem lifecycle, corroboration/evidence status, and validation status explicitly dimensioned at every public call site.
- Keep technical raw-state presentation separate from public gloss presentation.

The current `.record-role-chip` name must not survive as the shared semantic owner because it styles both generic schema summary fields and EVD research roles. It may temporarily consume the same visual recipe while call sites move to dimension-specific classes/components.

### 5.5 Metadata fields and Source sections

`FactList` may replace repeated `<dl className="detail-provenance-grid">` markup, but callers must supply ordered rows and explicit values. It must not accept a raw canonical record and derive rows.

The four Source fact sections may consolidate their repeated renderer inside the Source domain. Their extractors, public labels, field keys, dates, enum formatting, link eligibility, section presence, and tests stay independently owned. `SourceFindingsSection`, `SourceInvestigationSection`, `SourceCaveatsSection`, and `SourceTechnicalSection` do not use that fact-section abstraction.

### 5.6 Surfaces, cards, and actions

Surface reuse is visual, not structural. A shared surface recipe may reduce drift among `.record-provenance`, `.effect-summary`, `.problem-help`, `.evidence-card`, `.open-question-item`, and `.evd-problem-card`, but each caller continues to choose its semantic element and content structure.

Links and buttons may share appearance only when their native semantics remain visible in code. `TypedLinkButton`, Source finding ID buttons, PRB reference targets, and inline related-record buttons may share `RecordIdentifier` action rendering. External Source URLs remain anchors; URL-state actions may remain buttons unless a separately approved navigation phase changes that contract.

Records and Graph form controls may share foundation styling later. A generic `FormField` component is deferred because only two specialised control groups demonstrate it, Graph is a deferred public surface, and their filtering state/fieldset behaviour differs.

### 5.7 Evidence/reference rows

Keep these separate:

- `EvidenceCard`: an EVD observation in a Problem, with PRB-owned effects and Source provenance;
- `OpenQuestionEvidenceRefs`: compact EVD references attached to authored uncertainty/path content;
- `PrbCanonicalReferences`: exact canonical path occurrence to target ID, deliberately not deduplicated;
- `RelationshipList`: related-record grouping that preserves all edge paths;
- `SourceFindingsSection`: SRC→EVD provenance-derived findings;
- `SourceInvestigationSection`: SRC→EVD→PRB relation projection;
- EVD Source and Problem-use lists.

They may share atomic identifiers, actions, fact lists, stacks, and surfaces. They must not share one row model or infer relationship semantics from generic connectivity.

### 5.8 Headers and primary navigation

Keep `ProblemHeader`, `EvdIdentity`, and the generic Record Detail meaning zone separate. Their apparent heading/identifier similarities do not outweigh different reading questions and canonical sources.

Keep the global header and primary navigation composed in `Explorer`. Its one-use structure is not a design-system component. Global navigation styling may consume foundation/action recipes, while `ContextTabs` retains its distinct PRB domain behaviour.

### 5.9 Empty, unavailable, methodology, and caveat treatments

- Loading, error/retry, and empty-result framing may use `FeedbackMessage` only with an explicit semantic mode and caller-owned copy.
- Missing/absent canonical content must use explicit caller text. No primitive may turn missing into “No”, unavailable, or unknown.
- `UnavailableNote` remains the focused-control explanation pattern; it is not an empty state.
- `ReadingGuide` and `ProblemHelpDisclosure` remain methodology/orientation content, not generic caveats.
- `SourceCaveatsSection` renders authored Source limitations only and remains absent when none are authored.
- `.field-empty` should retire later after call sites distinguish absent field, empty collection, unresolved effect, and italic secondary copy.

## 6. Recommendation matrix

| Candidate | Current implementation/location | Proposed layer and ownership | Shared or domain-owned | Legitimate variants | Drift eliminated | Migration risk/coupling | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Foundation roles/scales | `:root` and global selectors in `apps/research-explorer/src/index.css` | Foundation | Shared | Role-based only; values remain unfrozen | Parallel literals and inconsistent native baselines over time | High visual blast radius; requires rendered review | **KEEP** |
| Legacy raw CSS values | Pre-foundation and override blocks in `apps/research-explorer/src/index.css` | Foundation migration | Shared recipes, migrated selectively | None defined here | Raw colours/sizes/spacing/radii and split selector definitions | High; no bulk migration | **CONSOLIDATE** |
| Visually-hidden technique | Four clip-rect recipes in `apps/research-explorer/src/index.css` | Foundation utility | Shared | One utility | Accessibility maintenance drift | Low if markup/accessibility names remain tested | **EXTRACT** |
| `.shell-frame` / `ShellFrame` | `apps/research-explorer/src/index.css` and app/view wrappers | Layout | Shared | None | Per-page width/centring drift | Low; structural CSS tests already guard it | **KEEP** |
| `.record-detail-columns/-main/-rail` / `ReadingLayout` | `apps/research-explorer/src/index.css`, Record Detail, Problem View | Layout | Shared | rail/no-rail; current recomposition | Parallel reading geometries | Medium; sticky/compact index coupling | **KEEP** |
| `Stack` | Repeated vertical flex/grid lists and actions across records/problem/graph | Layout | Shared | Bounded gap/alignment | Repeated flow declarations and spacing drift | Low if DOM-neutral | **EXTRACT** |
| `Cluster` | Chip groups, identity facts, reference groups, Overview actions | Layout | Shared | Bounded gap/alignment/wrap | Repeated wrapping/alignment declarations | Low if DOM-neutral | **EXTRACT** |
| Generic `Grid` | Several unrelated grids in `apps/research-explorer/src/index.css` | No shared layer yet | Remain local; fact layout goes to `FactList` | None | Little proven common drift beyond facts | High API ambiguity | **DOMAIN-OWNED** |
| Generic React `Section` | `.problem-section`, `.record-editorial-section`, page landmarks | Page/domain composition plus `SectionFlow` class | Domain-owned semantics | Spacing class only | Shared rhythm without hiding landmarks | High if it owns heading/ARIA/presence | **DOMAIN-OWNED** |
| Breadcrumb | Three implementations in records/problem/history | Generic UI | Shared | Parent action(s), current item | Duplicated nav/separator/current markup | Medium; preserve focus and button semantics | **EXTRACT** |
| `ContextTabs` | `apps/research-explorer/src/navigation/ContextTabs.tsx` | Domain component | PRB-owned, shared across PRB contexts | Active context | Prevents PRB navigation drift already | Low; Graph remains dormant/out of scope | **KEEP** |
| Section indexes | `CompactSectionIndex`, Problem/Source/EVD rail and compact renderers | Generic UI renderer plus domain selectors | Shared renderer; domain-owned entries | rail/compact; nested/flat | Repeated nav/list/anchor markup | Medium; responsive equivalence and presence tests | **CONSOLIDATE** |
| `SourceCompactSectionIndex` | `apps/research-explorer/src/records/SourceCompactSectionIndex.tsx` | Source adapter during migration | Domain-owned temporarily | Source entries only | Thin adapter becomes unnecessary after shared renderer | Low, but tests/call sites must move together | **RETIRE-LATER** |
| `FactList` / `.detail-provenance-grid` | records, Source, EVD, PRB detail | Generic UI | Shared renderer; caller-owned rows | Reading/compact only if demonstrated | Repeated `<dl>/<dt>/<dd>` structure and grid drift | Medium; ReactNode values and compact stacking | **EXTRACT** |
| Surface recipes | Repeated outlined/muted/item boxes in `apps/research-explorer/src/index.css` | Generic visual UI/CSS | Shared anatomy; domain-owned markup | Plain outlined, muted inset, interactive item at most | Border/background/padding drift | Medium; avoid cardification | **CONSOLIDATE** |
| Native action/control recipes | Global links, text buttons, rail actions, form controls | Foundation/Generic UI CSS | Shared appearance | text, outlined, tab; native states | Repeated link-like button/control styling | Medium; link/button semantics must stay explicit | **CONSOLIDATE** |
| `UnavailableNote` | `apps/research-explorer/src/presentation/UnavailableNote.tsx` | Generic UI behaviour | Shared | None | Already removes duplicated inaccessible `title`-only help | Low | **KEEP** |
| `FeedbackMessage` | Repeated loading/error/empty branches across views | Generic UI | Shared structure; caller-owned meaning/copy | progress, error/retry, empty | Repeated roles/live-region/retry markup | Medium; incorrect role or over-broad “empty” semantics | **EXTRACT** |
| `RecordIdentifier` | Multiple static/actionable ID treatments in records/problem/source/history | Domain component | Shared across Explorer domains | text/action; compact/standard density | ID typography/action drift | Medium; must not absorb paths/type/status | **EXTRACT** |
| `RecordTypeLabel` | `.detail-type-badge`, `.narrow-record-type`, EVD type row | Domain component | Shared across record contexts | compact marker, detail badge | Duplicate prefix/type-label anatomy | Medium; keep distinct from ID and state | **EXTRACT** |
| Problem state presentations | Overview dimensions, `StatusChip`, PRB technical state, History transitions | Problem domain | Domain-owned compositions | overview/read/technical/history | May share formatting helpers and visual recipe only | High semantic risk across independent dimensions | **DOMAIN-OWNED** |
| Evidence effect | `.effect-chip` in Problem and EVD | Relationship domain component | Shared where the value is PRB→EVD `effects` | compact/standard density | Duplicate label/accessibility rendering | Medium; no research-role/state values | **EXTRACT** |
| Research-role/generic summary chips | `.record-role-chip` in Record Detail and EVD | Separate domain wrappers over shared visual recipe | Domain-owned | Dimension-specific only | Removes misleading shared semantic class name | High if values are merged | **CONSOLIDATE** |
| Source fact sections | `SourceOverviewSection`, `SourceCoverageSection`, `SourceDatesAccessSection`, `SourceLicensingSection` | Source domain with `FactList`/internal section frame | Domain-owned grouping, shared internal renderer | Overview, Coverage, Dates/access, Licensing | Repeated row/section TSX | Medium; keep extractors, formatting, presence, tests | **CONSOLIDATE** |
| Source findings/investigation/caveats | Source domain section files | Domain components | Source-owned | Current content states | No justified cross-section abstraction | High semantic coupling if merged | **KEEP** |
| `RecordFieldTree` | `apps/research-explorer/src/records/RecordFieldTree.tsx` | Domain technical inspection | Shared across record types | Existing value kinds | Already one recursive renderer | Low | **KEEP** |
| Canonical technical disclosures | Record Detail, PRB, Source, EVD wrappers around technical inspection | Records domain family | Shared shell; type-owned content | Generic full, PRB exhaustive, Source record-only, EVD facts+tree | Repeated summary/caption/details framing | Medium; exhaustive/presence contracts differ | **CONSOLIDATE** |
| Evidence/reference rows | Problem, records, Source, EVD row/card functions | Domain components | Remain domain-owned | Existing semantic forms | Atomic identifier/surface reuse only | High if relationships/path cardinality collapse | **DOMAIN-OWNED** |
| Problem/EVD/record headers | `ProblemHeader`, `EvdIdentity`, Record Detail meaning zone | Domain components/page composition | Domain-owned | Existing type-specific forms | Typography/layout atoms only | High if reading questions collapse | **DOMAIN-OWNED** |
| Desktop/compact Records lists | `RecordsTable.tsx`, `NarrowRecordsList.tsx` | Records domain composition | Domain-owned responsive pair | desktop/compact DOM | Already share one data pipeline | Medium; selection/sort/pagination behaviour | **KEEP** |
| App header/primary nav | `Explorer.tsx` | Page composition | App-owned | compact layout only | Foundation/action styling only | Low benefit from a one-use design-system component | **KEEP** |
| Reading/methodology/caveat treatments | Guide, Problem help, Source caveats, rail caveat copy | Domain composition with shared surface styles | Domain-owned | Existing purposes only | Visual recipe drift only | High semantic risk if unified | **DOMAIN-OWNED** |
| `.field-empty` | Broad call sites across records/problem | Replace with explicit absence/empty presentations | Domain meaning plus generic feedback styles | Missing field, empty list, missing effect kept distinct | Removes semantic overloading | Medium; requires call-site audit | **RETIRE-LATER** |
| Graph components | `apps/research-explorer/src/graph/GraphExplorer.tsx`, `apps/research-explorer/src/graph/GraphCanvas.tsx` | Graph domain | Domain-owned | Existing canvas/HTML fallback | Only consume shared foundation/layout where safe | High and explicitly out of redesign scope | **DOMAIN-OWNED** |

## 7. Known non-components and composition that should remain local

- Page and article landmarks, heading levels, `aria-labelledby`, and section order.
- Problem section presence, `problemSectionIndex`, Evidence partitioning, open-question extraction, contradiction-search presentation, and investigation-path order.
- Source field extraction, Source section presence/order, public-link eligibility, and SRC→EVD→PRB relation resolution.
- Exact canonical-reference collection and its non-deduplicated path occurrences.
- Related-record grouping/deduplication rules and incoming/outgoing direction labels.
- Overview narrative, independence statement, trust/methodology copy, and its deliberately dimensioned status summary.
- Record Detail, Problem, EVD, and Source headers as one universal `PageHeader`.
- Evidence Card, Source finding, canonical-reference row, relation row, and EVD Source row as one universal `ReferenceRow`.
- A universal `Chip` that accepts record types, IDs, statuses, effects, and research roles.
- A universal `Card` that chooses landmark or heading structure.
- A generic React `Section` that manufactures a heading or accessible name.
- A generic `Grid` until a second non-fact layout demonstrates the same contract.
- A `FormField` framework based mainly on Records and the deferred Graph surface.
- A custom disclosure/headless primitive where native `<details>/<summary>` remains sufficient.
- Automatic rail-to-inline behaviour for “short” records; the approved foundation leaves that decision open and current code supplies no content-length rule.
- Graph-specific control, canvas, legend, node, or edge redesign.

## 8. Human Gate C1 questions

1. **Layout implementation form:** should `ShellFrame`, `ReadingLayout`, `Stack`, `Cluster`, and `SectionFlow` be CSS classes/recipes by default, with React wrappers only where behaviour/markup requires one? This contract recommends that default to avoid wrapper components with no semantic value.
2. **Section index boundary:** approve one generic `SectionIndex` renderer with rail/compact and flat/nested variants, while Problem/Source/EVD keep independent order and presence authorities?
3. **Identifier/type boundary:** approve separate `RecordIdentifier` and `RecordTypeLabel` domain components, rather than one combined badge that makes type and identity inseparable?
4. **Inline-label consolidation:** approve a CSS-only visual recipe with dimension-specific domain wrappers for Problem state, Evidence effect, research role, and record type? The alternative—a single React `Chip`—is not recommended because it makes semantic misuse easier.
5. **Source fact consolidation:** may the four fact-based Source sections use one internal Source renderer/`FactList` while keeping their extraction, formatting, public labels, presence, and tests separate? If per-section React boundaries are considered part of Source ownership, only their internal row markup should consolidate.
6. **Feedback boundary:** should later implementation introduce one `FeedbackMessage` with required semantic modes, or separate `ProgressMessage`, `ErrorNotice`, and `EmptyState` components? The latter is more explicit; the former removes more repeated structure but needs stricter misuse tests.
7. **Frame coverage:** should ordinary startup/view feedback, `ReadingGuide`, and `.manifest-summary` align through `ShellFrame`, while Graph-specific content remains unchanged? Current measures differ, but changing alignment requires rendered review.
8. **Short-record rail:** confirm that automatic inline metadata for shorter desktop records remains deferred. The contract recommends retaining only the demonstrated rail/no-rail and current responsive recomposition until content-based behaviour is explicitly approved.

## 9. Recommended implementation order for later phases

1. **Lock structural tests around current invariants.** Preserve/extend the existing shell/reading-layout and compact-overflow tests before moving markup. Add focused tests for section-index equivalence and identifier/status separation.
2. **Foundation-only cleanup with no visual target change.** Extract visually-hidden and native action/focus recipes; consolidate only exact or approved visual equivalents. Do not perform a bulk stylesheet migration.
3. **Adopt layout primitives.** Keep `ShellFrame` and `ReadingLayout`; introduce `Stack`, `Cluster`, and `SectionFlow` at repeated call sites with rendered checks at desktop, around 360px, and the breakpoint-sensitive intermediate band.
4. **Extract generic structural UI.** Implement `Breadcrumb`, `SectionIndex`, and `FactList`; migrate one domain at a time. Keep domain selectors/presence logic untouched.
5. **Separate compact-label semantics.** Add `RecordIdentifier`, `RecordTypeLabel`, and `EvidenceEffectTag`; replace overloaded `.record-role-chip` call sites with dimension-specific wrappers over the shared visual recipe.
6. **Consolidate Source fact rendering.** Move the four fact sections onto the approved internal renderer without changing extractors, order, presence, labels, link rules, or relation loading.
7. **Consolidate technical disclosure framing and feedback.** Preserve exhaustive canonical content and current accessibility/focus behaviour. Replace `.field-empty` only after every call site has an explicit semantic classification.
8. **Decompose large domain files for ownership, not reuse.** Move PRB technical sections and Record Detail type branches out of `RecordDetailPanel.tsx`; move Problem domain sections only where this improves test ownership. Do not convert them into generic UI.
9. **Retire compatibility adapters/classes.** Remove thin index adapters and old/duplicated selectors only after all call sites, structural tests, unit tests, and rendered validation pass.
10. **Run a separate visual implementation gate.** Compare representative Overview, Records, SRC/EVD/PRB Detail, Problem, and History surfaces at required viewports. Graph consumes safe foundation changes only and receives no redesign in this sequence.

## 10. Scope boundary

DS-03A creates only this proposed contract. It does not implement components, modify production React/CSS, add Storybook or dependencies, freeze token values, change schemas/read models/canonical research data, redesign Graph, or authorize the later implementation order before Gate C1.
