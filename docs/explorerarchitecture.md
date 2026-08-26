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

### `Problema`

Answers:

> What is this problem and what do we know about it?

Foreground:
- problem description;
- manifestation, consequence, and scope;
- affected populations/journeys where relevant;
- supporting and contradictory Evidence;
- substantive uncertainty and unresolved gaps.

### `Detalhe`

Answers:

> What is the state of this investigation and how did it evolve?

Foreground:
- current investigation state and decision posture;
- provenance;
- technical inspection where useful.

Material historical-state presentation is deferred until historical snapshot storage exists (`docs/datamodel.md` §4); `Detalhe` currently has no Assessment/history surface to present.

All research semantics come from `docs/datamodel.md`.

## 4. Records presentation

Records should be compact and scannable:
- human-readable meaning before technical identity;
- technical ID retained as secondary identity;
- useful Source/relationship context;
- full technical inspection available without dominating first reading.

## 5. Responsive and accessibility invariants

Responsive boundary:
- compact: `<= 767px`;
- desktop: `>= 768px`.

`360px` is a compact QA viewport, not another breakpoint.

Preserve essential content, keyboard/focus behaviour, and semantic HTML. Avoid unintended page-level horizontal overflow or sticky navigation obscuring target content.

Production code owns exact design-token and component values.

## 6. Visual validation

Explorer validation is proportional to change materiality.

Material visual, responsive, layout, or navigation changes require rendered review at:
- a representative desktop viewport;
- a compact viewport around `360px`;
- affected breakpoint boundaries when breakpoint-sensitive.

When an approved visual reference exists, rendered/browser comparison is the primary visual gate.

Approved references own the intended rendered composition, hierarchy, typography, spacing, density, surfaces, and responsive treatment for the surfaces they cover. Deviate only for a concrete semantic, accessibility, or technical reason.

Minor non-visual changes do not require a full visual-review cycle.

Source View (SRC) functional/product presentation reached closure at commit `cfd0347`. Visual polish, typography/surface refinement, and optional styling of actionable EVD/PRB identifiers remain intentionally deferred to a future Claude Design pass; the closure did not refresh approved visual-review snapshots, so no final visual approval should be inferred from it.

## 7. Performance posture

The static client-side architecture has been validated at corpus sizes materially above the current dataset without a demonstrated architectural cliff in supported workflows.

Treat performance measurements as evidence. Do not introduce architectural complexity pre-emptively.
