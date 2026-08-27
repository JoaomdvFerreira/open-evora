# Data Model

Semantic foundation for canonical Open Évora research data.

This document owns **record meaning, state ownership, relationships, and authored/derived-state semantics**.

It does not own research workflow or decision criteria; those belong to `docs/investigationstrategy.md`. It does not duplicate concrete field shapes or enum inventories; those belong to executable schemas.

The canonical research model contains exactly three record types:
- Source (`SRC-*`)
- Evidence (`EVD-*`)
- Problem (`PRB-*`)

No Hypothesis (`HYP-*`) record type is part of the current process or target model.

Assessment (`ASM-*`) is not part of the current canonical model. Historical snapshot storage for material Problem history is deferred until material Problem history actually justifies it; see §4's future-policy note.

## 1. Source (`SRC-*`)

A Source is an identifiable origin from which information is obtained.

A Source establishes provenance. It is distinct from the Evidence extracted or recorded from it.

One Source may support multiple Evidence records.

The three record types remain strictly separated by role:

- **SRC** — identifiable origin/provenance.
- **EVD** — observation extracted from that origin.
- **PRB** — problem-level synthesis.

A Source must not express what it proves, its evidential strength, its relevance to a Problem, or any research role. Research roles are owned exclusively by PRB→EVD relationships.

### 1.1 SRC v2 contract

This section is the semantic authority for the implemented SRC v2 contract. `research/schemas/source.schema.json` and deterministic validation implement its executable shape.

#### Shape

```
source_id
publisher?                  # optional
creators[]?                 # optional
name
resource_type

identity?:
  persistent_identifier?:
    scheme
    value
  version?
  snapshot_reference?

scope:
  geography:
    level
    area?
  temporal?:
    as_of
    OR
    start
    end
  domains[]

access:
  level
  availability
  machine_readable
  method?
  format?

acquisition:
  method
  obtained_at?

canonical_reference?

licensing:
  status
  licence?
  reuse
  attribution?

temporal:
  published_at?
  updated_at?
  last_checked_at
  update_frequency?

caveats[]?
```

#### Controlled values

`resource_type`:
`webpage`, `document`, `dataset`, `database`, `service`, `correspondence`, `other`, `unknown`.

`scope.geography.level`:
`site`, `local_area`, `parish`, `city`, `municipality`, `intermunicipal`, `regional`, `national`, `international`, `non_geographic`, `unknown`.

`access.level`:
`public`, `restricted`, `private`, `unknown`.

`access.availability`:
`available`, `unavailable`, `unknown`.

`access.machine_readable`:
`true`, `false`, `unknown`.

`access.method`:
`browser`, `download`, `api`, `feed`, `gis_service`, `direct`, `other`, `unknown`.

`access.format`:
`html`, `pdf`, `csv`, `json`, `xml`, `xlsx`, `kml`, `geojson`, `image`, `video`, `text`, `other`, `unknown`.

`acquisition.method`:
`public_web`, `direct_contact`, `direct_submission`, `api`, `archive`, `other`, `unknown`.

`licensing.status`:
`known`, `unknown`.

`licensing.reuse`:
`permitted`, `restricted`, `prohibited`, `unknown`.

`temporal.update_frequency`:
`one_off`, `daily`, `weekly`, `monthly`, `quarterly`, `annual`, `irregular`, `unknown`.

#### Required fields

Required at all times:
- `source_id`
- `name`
- `resource_type`
- `scope.geography.level`
- `scope.domains`
- `access.level`
- `access.availability`
- `access.machine_readable`
- `acquisition.method`
- `licensing.status`
- `licensing.reuse`
- `temporal.last_checked_at`

`publisher` is optional.

#### Conditional requirements

`scope.geography.area` is required whenever `scope.geography.level` is not `non_geographic` and not `unknown`.

`scope.temporal`, when present, must use exactly one of two mutually exclusive forms:
- `as_of`, or
- an interval expressed as `start` + `end`.

Both forms must never be present simultaneously on the same `scope.temporal`.

Partial-date fields may use only one of these three precisions:
- `YYYY`
- `YYYY-MM`
- `YYYY-MM-DD`

`temporal.last_checked_at` must always be a full `YYYY-MM-DD` date; partial precision is not permitted for this field.

`acquisition.obtained_at` must be a full `YYYY-MM-DD` date, and is required whenever `acquisition.method` is one of:
- `direct_contact`
- `direct_submission`
- `archive`

#### Machine-readable semantics

`access.machine_readable: true` means the relevant source content is available in a structured representation intended for programmatic consumption, without needing to extract information from a human-oriented document.

Examples:
- CSV, JSON, an API response, or GeoJSON → `true`.
- Editorial HTML or a PDF meant for human reading → `false`.
- Not yet established → `unknown`.

#### Boundaries

- `publisher` and `creators` describe provenance, not authority. SRC v2 carries no field expressing source authority/trust ranking.
- Source publication and update dates (`temporal.published_at`, `temporal.updated_at`) are factual metadata, not a freshness judgement. SRC v2 carries no derived freshness status.
- `access` and `licensing` are independent axes; a source's access level does not determine or imply its licensing status, and vice versa.
- Publication governance (how/when the source itself was published or updated) is independent from both `access` and `licensing`.
- `acquisition` records how Open Évora obtained the source (method and, where applicable, when). It does not record the surrounding engagement workflow, correspondence content, or process history.
- `caveats[]` may contain only limitations or conditions of the source itself (e.g. incomplete coverage, self-reported data, known gaps). It must not contain research-process commentary.
- The following do not belong in SRC, at any version: WU identifiers, batch identifiers, gates, research-process history, extracted observations, Problem-level conclusions, evidential-strength judgements, and PRB→EVD research-role judgements. Research roles remain owned exclusively by PRB→EVD relationships.
- SRC v2 does not author `evidence_ids`. Future SRC → EVD navigation is derived from existing EVD → SRC references, not authored on the Source record.
- Research roles are owned only by PRB→EVD relationships.

#### 1.2 Fields retired from SRC v2

The following fields belonged to the pre-v2 executable schema and pre-v2 `SRC-*` corpus; they do not belong in the SRC v2 contract:

- `authority` — expresses a trust/authority ranking; provenance (`publisher`/`creators`) is not the same as authority, per the boundary above.
- `freshness.status` — a derived freshness judgement; factual publication/update/check dates remain, but the derived status does not.
- `canonical_source` — not part of the v2 shape.
- `api_candidate` — not part of the v2 shape.
- `notes` — free-text notes are not part of the v2 shape; any legitimate source-level limitation belongs in `caveats[]` under the boundary above.

#### 1.3 Status of this contract

SRC v2 is implemented by `research/schemas/source.schema.json`, the canonical `SRC-*` corpus and the deterministic validators.

## 2. Evidence (`EVD-*`)

Evidence is a bounded observation with identifiable provenance.

Evidence is not the project's conclusion about a Problem.

Its meaning includes the observation itself and the context needed to interpret it safely, including applicable scope and inference limits.

Evidence may contribute to more than one Problem.

### EVD vNext contract

The executable EVD contract has only the following canonical concepts: provenance (`provenance.sources[]`, `provenance.extracted_at`), bounded Observation (`observation.summary`), scope, domains, `evidence_nature`, `claim_authority`, optional `lineage_id`, and explicit `inference_limits[]`.

EVD does not own a strength/confidence score, a primary-versus-additional Source hierarchy, a Problem relationship, research role, analysis block, personal-data workflow fields, or free-form process notes. `evidence_nature` describes the proposition; it is not a verdict.

### PRB → EVD relationships

Each PRB owns its `evidence[]` relationships. A relationship names an `evidence_id` and has non-empty `effects[]` (`SUPPORTS`, `REFINES`, `BOUNDS`, `CONTRADICTS`) and `research_roles[]` (`LOCAL_OBSERVATION`, `CONTEXTUAL`, `COMPARATIVE_MECHANISM`, `COMPARATIVE_RESPONSE`, `EXISTING_RESPONSE`, `PLANNED_RESPONSE`). Effects and roles describe this Problem's use of the Evidence; neither changes the Evidence itself.

Contradictory Evidence may challenge only part of a Problem and does not automatically invalidate it. Existing and planned responses are distinct research roles and neither establishes effectiveness.

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

## 4. Future historical-snapshot policy

Assessment (`ASM-*`) is not an implemented canonical record type. Historical snapshots of Problem state are deferred until material Problem history actually justifies storing them; this unit does not design that future schema.

The material-change criteria that previously governed Assessment creation are preserved here as the future policy for when a historical snapshot would be justified, so a later decision to implement snapshot storage does not require redefining what counts as a materially significant Problem change. `docs/investigationstrategy.md` §9 owns the operational rules; this section anchors their status as forward-looking policy, not an active requirement.

A materially significant Problem change is one where, if the project were asked what it currently believes or has decided about the Problem, the answer would differ from before the change. This includes changes to lifecycle status, `evidence_status`, `validation_status`, investigation posture/triage, an actual structural disposition (split/merge), or an effect-tested material change to manifestation, consequence, scope, a high-impact critical uncertainty, or a materially conclusion-changing contradiction. It excludes reinforcing evidence, metadata/wording/formatting changes, maintained provenance links, mere passage of time, or a review reaffirming materially equivalent state.

Should historical snapshot storage be implemented in the future, it may reuse these criteria as its creation trigger rather than redefining materiality from scratch.

## 5. Core relationships

Conceptually:

`SRC → EVD → PRB`

A Source supports Evidence. Evidence informs one or more Problems. A Problem owns current state, including current investigation state.

No additional canonical research record type sits between Problem and future intervention/project work.

Problem overlap remains distinct from split/merge genealogy.

## 6. Authored and derived state

**Authored state** is intentionally recorded research judgement.

**Derived state** is deterministically calculated from canonical state without adding semantic judgement.

Derived systems may project relationships, calculate structural readiness, and prepare presentation read models.

They must not silently create authored decisions such as corroboration, validation, or investigation posture.

## 7. Schema boundary

`research/schemas/*` and associated executable validation define implemented record shape.

This document defines semantic meaning and ownership only.

No application, generated projection, or document may create a competing semantic definition of canonical research state.
