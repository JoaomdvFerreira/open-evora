# Data Model

Semantic foundation for canonical Open Évora research data.

This document owns **record meaning, state ownership, relationships, and authored/derived-state semantics**.

It does not own research workflow or decision criteria; those belong to `docs/investigationstrategy.md`. It does not duplicate concrete field shapes or enum inventories; those belong to executable schemas.

The canonical research model contains exactly four record types:
- Source (`SRC-*`)
- Evidence (`EVD-*`)
- Problem (`PRB-*`)
- Assessment (`ASM-*`)

No Hypothesis (`HYP-*`) record type is part of the current process or target model.

> **Transition:** the PRB-current-state / ASM-immutable-snapshot model below is the adopted target model. Until its schema/tooling migration is complete, implemented contracts may still expose legacy ASM current-state fields. Treat that mismatch as explicit migration work. Pre-migration analyzers/verifiers may still require or select a legacy current ASM for a PRB. This is transitional runtime compatibility, not target state ownership.

## 1. Source (`SRC-*`)

A Source is an identifiable origin from which information is obtained.

A Source establishes provenance. It is distinct from the Evidence extracted or recorded from it.

One Source may support multiple Evidence records.

## 2. Evidence (`EVD-*`)

Evidence is a bounded observation with identifiable provenance.

Evidence is not the project's conclusion about a Problem.

Its meaning includes the observation itself and the context needed to interpret it safely, including applicable scope and inference limits.

Evidence may contribute to more than one Problem.

### Contribution

Contribution describes the analytical role Evidence plays in a Problem reading. It is not a truth, prevalence, or importance score.

Contradictory Evidence may challenge only part of a Problem and does not automatically invalidate it.

Evidence describing an existing solution and Evidence describing a planned solution are semantically distinct. Neither establishes effectiveness by existence alone.

### Lineage and independence

Lineage identifies an underlying evidence thread or generating event where applicable.

Different Evidence IDs, Sources, or lineage identifiers do not automatically imply independent corroboration. Independence remains a substantive judgement.

## 3. Problem (`PRB-*`)

A Problem is the canonical mutable representation of the project's current understanding of a distinct civic problem.

It owns:
- the current substantive problem description;
- the current investigation state and decision posture.

The Problem is the canonical answer to:

> What does the project currently understand and decide about this civic problem?

### Current substantive state

This includes the current representation of the Problem's manifestation, affected journey/population, consequences, scope, supported causal reading, relevant Evidence, existing/planned solutions, and material unresolved uncertainty.

### Current investigation state

The Problem owns the current human-authored research standing of the investigation.

Core concepts include:
- **lifecycle/status** — the current disposition of the Problem;
- **Corroboration** — the human-authored judgement that the current Problem reading has approved evidential support; the implemented field is `evidence_status`;
- **Validation** — the degree of direct challenge the current framing has survived; the implemented field is `validation_status`;
- **digital tractability** — the current judgement of whether digital intervention is materially relevant;
- **investigation posture** — the current STOP/WATCH/DEEPEN/PROCEED-style disposition or its successor representation;
- **critical uncertainties** — unresolved questions capable of materially changing the current Problem reading or decision.

Exact field names and enum values are schema-owned.

`digital_tractability` is the single canonical digital-opportunity concept. The target model has no independently authored `digital_leverage` equivalent.

### Decision basis

A Problem may carry a structured, human-authored decision basis explaining the evidence and reasoning behind promotion-relevant current judgements.

It exists for inspectability and deterministic structural checking, not to score or decide the Problem.

Conceptually it may record:
- manifestation and consequence;
- currentness;
- contradiction search;
- overlap/duplication review;
- scope and limitations;
- supporting/boundary Evidence;
- independence reasoning.

The exact structure is schema-owned.

### Problem relationships

Overlap and genealogy are distinct.

- **Overlap** expresses a substantive relationship between Problems.
- `split_from` records predecessor Problem(s) from which a successor was actually split.
- `merged_from` records predecessor Problem(s) actually combined into a successor.

Inverse genealogy should be derived rather than redundantly authored.

Considering and rejecting structural change creates no genealogy.

## 4. Assessment (`ASM-*`)

An Assessment is an immutable historical record associated with exactly one Problem.

Its semantic kind is either **REVIEW** (a material investigation-state snapshot) or **CORRECTION** (a correction to an incorrectly recorded historical snapshot).

It is not current investigation state. The target model has no mutable, continuously edited, or draft current Assessment.

### REVIEW

A REVIEW records genuine evolution in the Problem's understanding or decision.

It preserves:
- the relevant resulting state;
- the semantic delta;
- materiality rationale;
- supporting provenance;
- the preceding REVIEW relationship for the same Problem.

A REVIEW supersession chain never crosses Problem identities.

### CORRECTION

A CORRECTION fixes an Assessment that was recorded incorrectly.

It is a new immutable Assessment, does not create a new investigation-state transition, identifies the erroneous Assessment through a distinct correction relationship, and leaves that erroneous record intact.

The valid historical state at that chain position is read through the applicable correction. Later REVIEWs continue from the corrected understanding.

Historical resolution must remain unambiguous. Schema/tooling must prevent or deterministically resolve competing correction paths rather than leaving multiple effective versions of the same chain position.

### Derived lifecycle

The target model has no authored `assessment_status`.

Current/superseded position is derived from history. A draft is not yet an Assessment. Archival belongs to Problem lifecycle or presentation policy rather than intrinsic Assessment state.

### Migration boundary

Structured Assessment history begins from adoption of this model forward. Existing pre-migration Assessment records may be carried forward as migration-boundary seed snapshots without inventing predecessor history.

Do not infer historical snapshots from legacy notes, work-unit labels, or narrative change logs.

## 5. Core relationships

Conceptually:

`SRC → EVD → PRB`

`PRB → ASM history`

A Source supports Evidence. Evidence informs one or more Problems. A Problem owns current state. Assessments preserve material historical states of one Problem.

No additional canonical research record type sits between Problem and future intervention/project work.

Problem overlap remains distinct from split/merge genealogy.

## 6. Authored and derived state

**Authored state** is intentionally recorded research judgement.

**Derived state** is deterministically calculated from canonical state without adding semantic judgement.

Derived systems may project relationships, calculate structural readiness, derive Assessment chain position, and prepare presentation read models.

They must not silently create authored decisions such as corroboration, validation, or investigation posture.

## 7. Schema boundary

`research/schemas/*` and associated executable validation define implemented record shape.

This document defines semantic meaning and ownership only.

No application, generated projection, or document may create a competing semantic definition of canonical research state.
