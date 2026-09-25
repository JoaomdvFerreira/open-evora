# Research Explorer Architecture

Canonical architecture and product invariants for the Open Évora Research Explorer.

This document owns **the Explorer system boundary, data flow, read-model role, public navigation model, presentation hierarchy, responsive invariants, and Explorer-specific validation posture**.

Research-data meaning belongs to `docs/datamodel.md`. Repository-wide safeguards belong to `AGENTS.md`. Exact runtime shapes, components, design tokens, and historical design decisions belong to code/tests/Git history.

## 1. Purpose and system boundary

The Research Explorer is a read-only interface for understanding and inspecting governed Open Évora research.

Supported flow:

`canonical research corpus → deterministic data build → static read model → client application`

The Explorer does not author or mutate research state.

It may derive navigation relationships and presentation projections, but it must not maintain independent research state, redefine canonical research semantics, or silently correct canonical records.

Public data generation must respect the publication boundary in `AGENTS.md` before material reaches public static assets.

The current static client-side architecture remains the default. Add backend persistence, server-side search, or another data store only when measured evidence demonstrates a material limit in a supported workflow.

## 2. Read model

The read model is a deterministic derived representation of canonical research data.

Keep it generic and schema-driven where practical. Canonical references may be projected into navigation/graph relationships without creating new semantic truth.

Runtime types, builders, and tests own the exact read-model shape.

The Explorer must expose canonical research record types from `docs/datamodel.md`; it must not preserve or invent deprecated record types independently.

Prefer adapting the projection over changing the architecture when the existing architecture remains sufficient.

## 3. Primary navigation

Primary public concepts are:
- Overview;
- Records;
- Problem context.

Records supports corpus-level discovery and inspection.

Problem context is the primary place for understanding a civic problem and the state/history of its investigation.

Graph capability may remain implemented but is currently deferred as a primary public surface.

All research semantics come from `docs/datamodel.md`; this section owns only their Explorer presentation.

### 3.1 Problem context views

The public Problem context has exactly two views:

- `Detalhes`;
- `Histórico`.

Transition: this is the adopted, owner-approved architecture. Until runtime integration lands, the running Explorer may still expose the earlier `Detalhe | Problema | Histórico` context navigation; that is implementation lag, not a competing contract.

### 3.2 `Detalhes`

`Detalhes` is the primary public Problem reading and verification surface. It answers:

- What is this problem?
- What is the current canonical reading?
- What remains unresolved?
- How did the investigation reach this formulation?
- How can the research be inspected and audited?

Composition order:

`problem identity / statement → investigation state + scope → Leitura atual → open questions → investigation path → evidence/audit layer`

The semantics of the PRB fields it presents (`problem_statement`, `causal_reading`, `investigation.open_questions[]` fields, `investigation.path`, `updated_at`, currentness) are owned by `docs/datamodel.md` §3 "Problem reading and investigation semantics". Explorer-specific presentation invariants:

- `Leitura atual` renders canonical `causal_reading`;
- the view performs no arbitrary selected-evidence or "top evidence" synthesis;
- open-question fields (`latest_result`, `why_open`, `resolution_condition`, `current_action`, `evidence[]`) remain distinct in presentation; per-question current knowledge comes from that question's `latest_result`;
- `updated_at` is presented as edit metadata, never as investigation currentness;
- free-text tokens such as `WATCH` are presented as text, not as structured posture;
- the investigation path is presented as narrative, not as progress, completion, or current/pending state;
- audit presentation does not invent Evidence ranking or strength.

The page title uses the page-composition heading level consistent with the global Explorer heading hierarchy.

Canonical content that belongs only to the earlier Problem presentation (for example the per-Evidence list, decision-basis prose, recent-history summary, and affected-populations blocks) is not foreground content in `Detalhes`. It remains in the corpus and inspectable through generic Record Detail in Records; it must not be re-added to `Detalhes` without an owner decision. A bulk "open the N records" action from the audit layer is not implemented.

### 3.3 `Histórico`

Presents the optional authored material-change history of the selected Problem from canonical PRB `history[]`, newest first. It must not fabricate entries. Absence of history does not mean the Problem never changed. It is a read-only projection of PRB history, not a snapshot/version-control or audit-log system.

Runtime integration adapts only its navigation/header to the two-view model; a full `Histórico` visual redesign is deferred.

### 3.4 Problem-local navigation

- Public Problem-local navigation has exactly `Detalhes | Histórico`.
- It is navigation (`<nav>` with current-page semantics), not an ARIA tabs widget.
- Generic Record Detail is a technical/corpus inspection capability, not a third Problem-local view; generic PRB inspection remains available through Records.
- Graph is not a Problem-local view.

### 3.5 Terminal composition

- The `Detalhes` evidence/audit band is the final content band before the public footer.
- The global manifest/corpus-generation summary is not appended after `Detalhes`. Records, `Histórico`, and Graph may retain it.
- Corpus-generation timestamps are never presented as investigation currentness.

## 4. Records presentation

Records should be compact and scannable:
- human-readable meaning before technical identity;
- technical ID retained as secondary identity;
- useful Source/relationship context;
- full technical inspection available without dominating first reading.

Generic Record Detail, reached through Records, is the technical/corpus inspection surface for every record type, including PRB.

## 5. Responsive and accessibility invariants

Responsive boundary:
- compact: `<= 767px`;
- desktop: `>= 768px`.

`360px` is a compact QA viewport, not another breakpoint.

Preserve essential content, keyboard/focus behaviour, and semantic HTML. Avoid unintended page-level horizontal overflow or sticky navigation obscuring target content.

Problem `Detalhes` responsive invariants:
- semantic content and order are preserved at every width;
- wider layouts may use independent columns only where reading/DOM order remains correct;
- narrower open-question layouts use one readable flow;
- the investigation path remains vertical at all supported widths.

Production code owns exact design-token and component values.

## 6. Visual validation

Explorer validation is proportional to change materiality.

Material visual, responsive, layout, or navigation changes require rendered review at:
- a representative desktop viewport;
- a compact viewport around `360px`;
- affected breakpoint boundaries when breakpoint-sensitive.

When an approved visual reference exists, rendered/browser comparison is the primary visual gate.

Approved references own the intended rendered composition, hierarchy, typography, spacing, density, surfaces, and responsive treatment for the surfaces they cover. Deviate only for a concrete semantic, accessibility, or technical reason.

For PRB `Detalhes`, the approved reference is the owner-approved Storybook composition; the static HTML references under `docs/design/reference/prb-details/` remain baseline artifacts where not superseded by its recorded deltas.

Minor non-visual changes do not require a full visual-review cycle.

Source View (SRC) functional/product presentation reached closure at commit `cfd0347`. Visual polish, typography/surface refinement, and optional styling of actionable EVD/PRB identifiers remain intentionally deferred to a future Claude Design pass; the closure did not refresh approved visual-review snapshots, so no final visual approval should be inferred from it.

## 7. Performance posture

The static client-side architecture has been validated at corpus sizes materially above the current dataset without a demonstrated architectural cliff in supported workflows.

Treat performance measurements as evidence. Do not introduce architectural complexity pre-emptively.
