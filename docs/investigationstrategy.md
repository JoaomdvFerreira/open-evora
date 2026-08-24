# Investigation Strategy

Operational strategy for investigating civic problems and integrating new research into Open Évora.

This document owns **research method, integration decisions, challenge/validation method, material-review rules, and stopping rules**.

It does not define what Source, Evidence, or Problem records mean; those semantics belong to `docs/datamodel.md`. Repository-wide safety and publication rules belong to `AGENTS.md`.

## 1. Objective

Open Évora is problem-first and evidence-first.

Research exists to improve a decision, not to maximize sources, records, interviews, or findings.

Use the smallest proportionate investigation capable of answering:

> What do we need to know for the project's current understanding or decision about this problem to change?

Software is not the default outcome. A valid investigation may conclude that an existing solution is sufficient, a non-digital response is preferable, improved access to existing data is enough, more research is required, or no intervention is currently justified.

## 2. Investigation principles

- **Claim-scoped authority:** assess whether a source or participant is authoritative for the specific claim, not for the whole Problem.
- **Observation before interpretation:** capture what the evidence directly supports before making corroboration, validation, or other research decisions.
- **Proportionate method:** use broader or more expensive methods only when they can resolve a meaningful uncertainty.
- **Method switching:** when a method repeatedly fails to resolve the question, change method rather than increasing volume.
- **Decision relevance:** do not create records or continue research merely because information is available.

The global claim-strength and publication safeguards in `AGENTS.md` always apply.

## 3. Investigation workflow

For new research:

1. define the investigation question;
2. inspect the existing corpus before creating records;
3. choose the strongest proportionate source or method;
4. integrate genuinely new Sources;
5. extract bounded Evidence;
6. determine whether the Evidence reinforces, contradicts, creates, or materially changes a Problem;
7. check relevant existing/planned solutions and significant uncertainty;
8. perform direct challenge when needed;
9. update current Problem state only when justified and authorized;
10. stop when further research is unlikely to change the current decision proportionately.

## 4. Integrating Sources

Before creating a Source, check whether the underlying source already exists.

For the claim being investigated, assess the relevant combination of:
- publisher/owner and source type;
- geographic, population, and temporal scope;
- claim-scoped authority;
- currentness;
- access and machine readability where relevant;
- reuse/republication conditions where relevant.

Prefer primary or authoritative sources when they directly support the required claim. Secondary sources remain useful for discovery, context, resident experience, independent corroboration, or evidence unavailable from a primary source.

Apply the publication and rights safeguards in `AGENTS.md`; preserve unknown rights as unknown.

### Reuse, evaluation, and replication

Reuse readiness and evaluation readiness are different.

A source may be reusable while lacking the history, granularity, coverage, stable identifiers, temporal consistency, or outcomes needed for evaluation.

Prefer discovery, documentation, supported reuse, and federation before local replication, portals, or APIs. Replicate only when doing so addresses a demonstrated problem.

## 5. Producing Evidence

Apply four checks before integrating Evidence:

1. **Observation** — what is directly supported?
2. **Provenance** — which Source or governed direct engagement supports it?
3. **Scope** — for which place, population, and time does it apply?
4. **Inference limit** — what does it not establish?

### Public and social signals

Public comments, complaints, social posts, and community discussions can identify experiences, recurring themes, journeys worth investigating, and candidate Problems.

They do not by themselves establish prevalence, statistical importance, or representativeness. Discussion volume must not be treated mechanically as civic importance.

Absence of discoverable public signal may indicate that another research method is required.

### Currentness

Evaluate currentness against the claim.

Where relevant distinguish:

`historical diagnosis → intervention/change → current residual state`

Do not treat an old diagnosis as current merely because its source remains available.

### Contradictions

Preserve contradictory Evidence and identify what it challenges: a proposition, causal explanation, scope, currentness, prevalence, or the Problem as a whole.

Do not automatically generalize a bounded contradiction to the entire Problem.

### Independence

Do not infer independent corroboration from record count, Source count, different IDs, or different lineage identifiers alone.

Consider whether evidence shares the same underlying event, institutional voice, evidence-generating process, or derived material.

## 6. Creating or updating Problems

Before creating a Problem:

1. search for an existing Problem describing the same underlying civic failure;
2. identify the affected journey/population and consequence;
3. determine whether the issue is sufficiently distinct to justify its own Problem;
4. check whether existing or planned solutions already address it.

Do not create a civic Problem solely for an API limitation, licensing uncertainty, missing machine-readable data, or implementation preference unless that issue itself produces a distinct civic consequence.

### Granularity

Problem boundaries should follow meaningful differences in manifestation, affected journey, consequence, scope, or underlying mechanism rather than broad thematic domains.

Several observations in one domain may represent different Problems; observations from different places may represent one underlying Problem.

### Existing and planned solutions

Distinguish what already operates, what is planned/announced, and what remains unresolved.

Existing does not prove effective. Planned does not mean implemented. Understanding what exists and determining whether it closes the civic gap are separate conclusions.

### Structural change

Use split or merge only when Problem structure actually changes.

Considering and rejecting a split/merge does not create genealogy. Problem overlap is not structural genealogy.

### Decision basis and Eligibility

When a Problem is being considered for promotion readiness or a corroboration decision, keep its structured decision basis current enough to make the authored reasoning inspectable.

The basis should make explicit, where relevant:
- manifestation and consequence;
- currentness;
- deliberate contradiction search;
- supporting and boundary Evidence;
- independence reasoning;
- material limitations.

Keep the two readiness questions distinct:
- **Eligibility** is structural readiness for the human PRB-promotion gate. Overlap/duplication review belongs here; scope boundedness does not.
- **Corroboration** concerns the explicitly authored evidential basis for the Problem reading. Scope and any material boundedness belong here; overlap review does not.
- currentness and deliberate contradiction search are relevant to both.

Eligibility does not establish that the civic problem is true, important, validated, or ready to become a project.

Deterministic tooling may report structural Eligibility/Corroboration readiness from the authored basis. It must not decide substantive truth, corroboration sufficiency, or whether the human promotion gate should promote the Problem.

## 7. Corroboration and validation

Corroboration and validation are human-owned decisions. Do not derive them mechanically from record count, Source count, confidence values, verifier output, or absence of contradiction.

### Corroboration (`evidence_status`)

Corroboration asks whether the current Problem reading has sufficient human-approved evidential support.

`evidence_status` records that human decision. New Evidence may trigger review; it does not automatically change the status.

### Validation (`validation_status`)

Validation asks whether the Problem framing survives proportionate direct challenge.

`validation_status` records the degree of direct challenge the current framing has survived.

Validation is not a vote and does not require universal agreement.

Challenge should actively seek:
- negative cases and exceptions;
- evidence that the Problem does not occur;
- evidence that an existing solution works;
- alternative explanations;
- material populations or conditions omitted from the current framing.

A significant unresolved uncertainty capable of reversing the core diagnosis prevents meaningful validation.

## 8. Direct engagement

Use stakeholder or resident engagement only to resolve a defined investigation question.

Before engagement define:
- the decision or uncertainty to resolve;
- why the participant/role can inform it;
- the minimum information needed;
- relevant negative cases;
- the stopping condition.

Treat participant authority as claim-scoped. Do not ask participants to design a solution unless solution research is explicitly the task.

For public-repository handling, follow `AGENTS.md`. Operationally, canonicalize the civic finding rather than participant identity and keep raw working notes outside the public repository.

Recording requires a concrete need, appropriate consent, and an explicit retention basis.

## 9. Material change and future historical snapshots

Assessment (`ASM-*`) is not an implemented canonical record type (`docs/datamodel.md` §4). Historical snapshot storage for Problem state is deferred until material Problem history actually justifies it. The rules below define materiality itself and are preserved as the future trigger for that snapshot storage, not as a current record-creation requirement.

### Effect test

Ask:

> If the project were asked now what it believes or has decided about this Problem, would the answer materially differ from before the review?

### Mandatory-significance triggers

A completed review is materially significant when it changes:
- Problem lifecycle status;
- `evidence_status` (Corroboration);
- `validation_status` (Validation);
- investigation posture/triage;
- an actual split, merge, or other structural disposition.

These transitions are formal changes in project standing.

### Effect-tested significance triggers

A review is materially significant when the effect test is met by:
- material change to manifestation, consequence, or scope;
- creation, resolution, or material reformulation of a high-impact critical uncertainty;
- a contradiction that materially changes the current conclusion;
- a change to digital tractability or another conditional investigation-state field that materially alters what the project currently states or decides.

A field diff alone is not sufficient for these conditional triggers.

### Non-triggers

A review is not materially significant merely because:
- new Evidence reinforces the existing reading;
- metadata, wording, or formatting changes;
- provenance or Source links are maintained;
- time passes;
- a review reaffirms materially equivalent state.

## 10. Stopping and completion

Stop research when further work is unlikely to change the current decision proportionately.

Examples:
- the investigation question is sufficiently answered;
- a contradiction requires reframing first;
- an existing solution sufficiently closes the gap;
- a non-digital mechanism dominates;
- remaining uncertainty does not justify the research cost;
- the method has reached diminishing information value;
- required access is not proportionate.

Do not use quotas of Sources, Evidence records, interviews, or stakeholder groups as completion criteria.

Before completing an integration:
- avoid duplicate Sources, Evidence, and Problems;
- preserve provenance, scope, contradictions, and material uncertainty;
- confirm current-state changes were authorized;
- run applicable schema/deterministic validation;
- report unresolved gaps rather than silently resolving them.

## 11. Current programme boundary

The programme is currently in stakeholder challenge and validation.

Do not begin the next investigation phase solely because individual Problems appear ready. Programme progression requires explicit authorization.
