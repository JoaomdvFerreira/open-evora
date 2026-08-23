# Research Methodology

**Version:** 0.5  
**Status:** Baseline draft; §2.3–2.4 reconciled for D3/D5 2026-08-11; §11–12 added for D4–D9 programme reconciliation 2026-08-11; §13 (D5 Execution Strategy) added 2026-08-11; §14 (Evidence Qualification v1) added 2026-08-23

## 1. Purpose

The research process exists to discover and understand problems before designing solutions.

The primary research question is not:

> What application should Évora have?

It is:

> What recurring problems affect people and organisations in Évora, why do they occur, and where can digital intervention materially improve the outcome?

## 2. Research streams

### 2.1 Institutional research

Search independently by domain for:

- problems;
- needs;
- goals;
- indicators;
- populations;
- locations;
- existing interventions;
- datasets;
- stakeholders.

Potential institutional sources include:

- Município de Évora;
- CIMAC;
- parish councils;
- INE;
- PORDATA;
- Universidade de Évora;
- NERE;
- public health bodies where relevant;
- employment and education organisations;
- cultural bodies;
- social-sector networks;
- regional infrastructure operators.

Institutional research must not search only for “digital needs”. It should first discover the underlying civic problem.

### 2.2 Public signal discovery

Public signal discovery looks for spontaneous descriptions of friction.

Useful linguistic patterns include:

- “não consigo…”;
- “demora…”;
- “não há…”;
- “é difícil…”;
- “ninguém sabe…”;
- “tenho de…”;
- “falta…”;
- “já reportei…”.

Search should avoid prompts that presuppose a technology solution, such as “apps Évora” or “smart city ideas”.

### 2.3 Stakeholder and user research — two distinct activities

Earlier drafts of this methodology implied that stakeholder contact occurs only after meaningful (solution) hypotheses exist. As of D3 canonicalization, this is corrected: **not all stakeholder/user contact is D5, and D5 does not require a solution `HYP-*` to exist.** Two distinct activities are recognized, at two different phases:

**D3 — formative research** (understanding, not testing a solution):

- purpose: understand what happens today — map the current journey, identify failure points, workarounds, and consequences, and test candidate causal explanations for a problem;
- may happen before any `HYP-*` exists, and before a problem is fully validated;
- used only when a specific D3 decision gate (journey understanding, root-cause understanding, or remaining-gap) cannot be resolved credibly from documentary/public-signal evidence alone — not by default for every problem.

**D5 — formal challenge/validation** (testing the diagnosis, not generic ideation):

- purpose: formally challenge the evidence-backed problem diagnosis/assessment produced by D3 — actively seek counterexamples and negative cases, and assess whether the remaining gap is material;
- updates a problem's formal `validation_status`;
- occurs after a problem assessment exists, but still does not require a solution `HYP-*` — D5 validates the *problem*, not a proposed *solution*.

For both activities, prefer:

> We repeatedly found problem X in context Y. Does this reflect your experience? What happens today?

Avoid, in either activity:

> What app would you like us to build?

### 2.4 Proportionality and method escalation

Heavier research/analytical methods (formative user/stakeholder research, systems mapping, an evidence-gap matrix, comparative "what works" research) are conditional, not default:

- use a heavier method only when it can resolve a specific, named decision gate or critical unknown that lighter/documentary evidence cannot resolve;
- escalate one step at a time — do not jump to comparative/"what works" research (primarily a D4 activity, reserved for surviving opportunities) while a more basic gate (e.g. journey understanding) is still unresolved;
- an unresolved gate or unknown is recorded as `UNKNOWN` and routed (`WATCH`/`DEEPEN`), not silently treated as a fact or skipped;
- absence of a heavier method is not a research failure — a problem may legitimately close a phase as `STOP` or `WATCH` without further primary research if the existing evidence already supports that call.

## 3. Evidence convergence

A problem becomes stronger when independent evidence classes converge.

Example:

```text
Institutional diagnosis
        +
Formal public participation
        +
Informal public signal
        +
Stakeholder validation
        ↓
Stronger problem confidence
```

Volume within one channel must not substitute for independent corroboration.

## 4. Social listening limitations

Social listening is not representative polling.

Do not infer population prevalence from:

- number of comments;
- likes;
- shares;
- subreddit frequency;
- number of posts.

Social channels have selection, demographic, engagement, and geographic biases.

Use social listening to identify:

- pain;
- current journeys;
- workarounds;
- consequences;
- locations;
- actors;
- language;
- possible root causes;
- recurring themes.

## 5. Problem decomposition

For each sufficiently supported problem, investigate:

```text
Observed friction
      ↓
Affected population
      ↓
Current journey
      ↓
Failure point
      ↓
Workaround
      ↓
Consequence
      ↓
Root cause
      ↓
Existing intervention
      ↓
Remaining gap
```

## 6. Existing-solution rule

Before creating a solution hypothesis, establish:

- whether an existing public/private/community solution exists;
- whether the target population knows about it;
- whether it is accessible;
- whether it addresses the root cause;
- where it fails;
- whether integration or improvement is preferable to replacement.

A “do not build” conclusion is a successful research result.

## 7. Saturation / sufficient coverage

A research domain is not closed merely because many sources were read.

A domain may move to consolidation when:

- high-priority institutional sources have been checked;
- at least two materially different evidence classes have been considered where feasible;
- major existing interventions are known;
- no new high-level problem cluster is appearing after additional source review;
- unresolved gaps are explicitly recorded;
- source and date provenance is complete.

This is a pragmatic discovery threshold, not a claim of scientific population representativeness.

## 8. Deduplication

Evidence records remain separate even when they describe the same problem.

Problem records are deduplicated.

Multiple evidence items should point to one shared problem where the underlying failure is materially the same.

## 9. Research outputs

Research should produce structured records rather than only narrative reports:

- `EVD-*` evidence;
- `PRB-*` problems;
- `HYP-*` hypotheses;
- `SRC-*` sources.

Narrative documents summarize these records but do not replace them.

## 10. Derived retrieval tooling (Graphify) — policy

An external evaluation spike (executed against a read-only repository snapshot, never touching repository files or AIQT state) assessed Graphify, a derived graph-based retrieval tool, as an aid for navigating the growing `research/` corpus. Decision: **ADOPT WITH CONSTRAINTS**, recorded here as durable project policy following WU-D1-07's D1 consolidation.

Findings that informed the decision:

- `graphify explain <known-canonical-ID>` reliably reconstructed the YAML's explicit `SRC-*` → `EVD-*` → `PRB-*` relationships, correctly distinguishing YAML-explicit (EXTRACTED) edges from text-derived (AMBIGUOUS/INFERRED) ones, and materially reduced file-opening for "what cites X" questions.
- The free-text `graphify query` command was unreliable — it missed or mis-targeted roughly half of a gold-set test, sometimes performing worse than plain text search, especially for finding records by decision-status (e.g. DEFER/WEAKEN) rather than by structural reference.
- Indexing narrative documents (`docs/discovery/`, `docs/milestones/`) alongside canonical records degraded canonical-record recall rather than improving it, and added graph noise.
- Incremental updates were substantially faster than full rebuilds and preserved unrelated nodes correctly, but one test produced a duplicate/ambiguous node for a short ID — short canonical IDs are not always guaranteed unique inside a Graphify-built graph, and node IDs are not fully deterministic across separate rebuilds.

Policy, effective immediately:

- Canonical YAML under `research/` remains the sole source of truth. Graphify's index is optional, derived, and disposable — it is never committed to the repository.
- Graphify indexes canonical `research/` records only (`sources/`, `evidence/`, `problems/`, `hypotheses/`). It must never index narrative discovery/milestone documents under `docs/`.
- Prefer `graphify explain <known-ID>` over free-text `query`. Treat `query` results as exploratory and non-authoritative.
- Every AMBIGUOUS/INFERRED relationship surfaced by Graphify requires canonical YAML verification before it is cited as fact.
- Graphify must never create, promote, or modify evidence, problem, or hypothesis records. It is a read-only retrieval aid.
- Avoid frequent full semantic rebuilds due to their token/context cost; prefer incremental updates where available.
- Graphify is not required for `tools/validate-research.js` or for repository correctness, and must not become a hard dependency of either.

No Graphify tooling, configuration, or custom deterministic index has been implemented in this repository. Further retrieval-tooling improvements (e.g. addressing free-text query reliability or ID-determinism) are noted as future work, not undertaken as part of D1 closure.

## 11. AI-assisted research provenance

Canonicalized as part of the D4–D9 programme reconciliation (`docs/discovery/roadmap.md`), this is a proportionate disclosure rule, not a new record-level requirement:

- AI-assisted research must remain source-grounded — every material claim traces to a `SRC-*`/`EVD-*`, never to model output alone;
- AI output is not itself a source;
- material externally researched conclusions must retain their actual source provenance (the original publisher/operator/document), not an AI-assistance label in its place;
- significant AI-assisted research batches may record the research protocol/assistance at batch or methodology level (e.g. a handoff or progress document), where that is useful for audit;
- do not add an AI-provenance field to every atomic `SRC-*`/`EVD-*` record unless a concrete governance decision later requires it — this is deliberately not a new schema obligation.

## 12. Living assessments

`ASM-*` reassessment is event-driven or volatility-driven, not continuous. Do not create a standing obligation to re-research every problem on a schedule.

Reassess a problem's `ASM-*` when:

- important new evidence appears;
- an operating solution changes;
- the problem's current state materially changes;
- a critical unknown is resolved;
- a D4/D5/D6 result changes a decision gate;
- a `WATCH` trigger fires.

High-volatility `PRB-*` may justify scheduled current-state checks; stable `PRB-*` should not be continuously researched. This rule applies across D4–D9, mirroring the proportionality principle already established in §2.4.

## 13. D5 Execution Strategy — Stakeholder Challenge & Validation

Canonicalized 2026-08-11, following `M004`/D4 closure. See `docs/discovery/roadmap.md` §D5 for the roadmap-level objective; this section canonicalizes D5's operating contract. Validation-status semantics live in `docs/models/problem-model.md`; evidence-capture rules live in `docs/models/evidence-model.md`; privacy/consent rules live in `docs/discovery/research-ethics.md` §11.

### 13.1 Purpose

D5 challenges the current evidence-backed problem diagnoses with the smallest credible set of direct stakeholder, operator, journey and primary-data interactions. It is not a generic interview campaign, a requirement to speak to every stakeholder class, a popularity poll, a solution-ideation workshop, or a requirement that every `PRB-*` becomes `validated`.

Core question: *what is the smallest credible direct challenge that could confirm, refine, contradict or falsify the decision-relevant parts of the current problem diagnosis?* A contradiction, refinement, access limitation, or failed validation attempt is a legitimate D5 result.

### 13.2 Unit of work: Validation Question

Every engagement must trace to one or more explicit `ASM.critical_unknowns`, blocked/partial decision gates, D4 falsification questions, a `WATCH` trigger, or a current-journey/root-cause/remaining-gap uncertainty. For each question, milestone/progress documentation should capture: question id; related `PRB-*`; decision/gate affected; claim being challenged; who can answer/challenge it; minimum credible method; evidence that would support; evidence that would contradict/refine; stopping rule. No new canonical record type is created for this unless implementation later proves one necessary.

### 13.3 Minimum credible challenge — evidence roles, not quotas

Use only the roles needed for the specific decision question:

- **Affected-journey evidence** — direct experience of the assessed journey/failure; best for lived friction, workarounds, consequence, materiality, accessibility/usability and negative cases.
- **Operator/process evidence** — direct knowledge of the service/process/data; best for workflow, routing, service rules, operational failure modes, data availability and current-solution coverage. May come from a meeting, an authoritative written response, a process artefact, or administrative/service data — a meeting is not required if stronger direct evidence answers the question.
- **Counterexample/negative case** — actively seek evidence that the problem does not occur, occurs differently, is already solved, is caused by something else, or matters only in a narrower context.
- **Direct observation** — used when the journey/failure can be credibly observed without collecting unnecessary personal data (e.g. an accessibility location audit, a stop-level information audit, a cycling-journey observation).

Do not interview people merely because D5 is called stakeholder validation.

### 13.4 Sufficiency and stopping

D5 success is never defined as *N interviews*. Stop a question when: additional engagement is unlikely to change the relevant gate/status/route; a contradiction requires reframing before more validation is useful; an existing solution is shown to close the gap sufficiently; non-digital dominance makes further digital-gap work decision-irrelevant; the necessary access cannot be obtained proportionately (preserve the unknown rather than forcing access); or new engagements repeat the same material finding without resolving another decision-relevant uncertainty. Do not continue recruitment for symmetry across `PRB-*`.

### 13.4a Institutional/operator non-response timing (canonical rule)

Owner decision, canonicalized 2026-08-15. This resolves §13.4's "reasonable non-response window" into a deterministic rule for institutional/operator outreach specifically (it does not change the general sufficiency/stopping criteria above, which still govern when to stop pursuing a question at all):

- `INITIAL_NON_RESPONSE_WINDOW` = 7 complete calendar days from dispatch.
- `MAX_PROJECT_INITIATED_FOLLOW_UPS` = 1.
- `POST_FOLLOW_UP_WINDOW` = 7 complete calendar days from the follow-up.

Sequence:

1. After initial dispatch, wait 7 complete calendar days.
2. If no substantive response has arrived by then, one project-initiated follow-up is permitted (not required).
3. After that follow-up is sent, wait another 7 complete calendar days.
4. If still no substantive response, the route may be classified `EXHAUSTED_NON_RESPONSE`.

Calendar-day calculation is deterministic: the dispatch (or follow-up) day is day 0; eligibility begins once 7 calendar days have elapsed. Example: sent 2026-08-12 → follow-up eligible 2026-08-19; if the follow-up is sent 2026-08-19 → exhaustion eligible 2026-08-26.

Rules of application:

- Non-response is evidence only of engagement attempt/exhaustion — never treated as substantive domain evidence.
- Any question left unresolved by `EXHAUSTED_NON_RESPONSE` must be explicitly carried forward (e.g. to `WU023`) or closed under the relevant stopping rule (§13.4) — exhaustion alone does not resolve the underlying question.
- Respondent-initiated routing/referral within the same engagement (e.g. a route being forwarded internally, or a named future continuation from the same respondent) does not itself count as an additional independent outreach route or consume the single-follow-up allowance.
- Do not create additional institutional contacts merely to maximize response count or corroboration; second-wave outreach remains governed by each route's own documented stopping rule, not by this timing rule alone.

### 13.5 Engagement grouping

Organise around respondent knowledge, not one campaign per `PRB-*`. A single interaction may address multiple problems only when the respondent genuinely has direct knowledge of each question — e.g. a mobility/transport/parking cluster spanning `PRB-0001`/`PRB-0002`/`PRB-0004`/`PRB-0005` where the same operator or passenger has relevant knowledge of more than one. `PRB-0009` engagement, if run at all, is scoped only to its narrow `D5-P9-*` falsification questions (`docs/milestones/D4-WU02-PRB0009-progress.md`) — its core mechanism stays `WATCH`, and a resident campaign is not created for it merely because D5 exists. `PRB-0010` remains `WATCH-TRIGGER` with no active D5 engagement by default.

### 13.6 Challenge discipline

Every engagement guide must include at least one explicit negative-case prompt, e.g.: *when does this problem not happen? What currently works well? Who does not experience this difficulty? What would make our current diagnosis wrong? Is there an existing process/tool we missed? Is the consequence smaller than our evidence suggests?* Do not lead participants toward agreement. Do not show a proposed solution before the problem challenge is complete, unless the D5 question explicitly concerns an existing solution.

### 13.7 D5 decision record

For every `PRB-*` actually challenged in D5, synthesis must record: the problem; questions challenged; stakeholder/evidence roles reached; counterexamples sought; material findings; contradictions/refinements; remaining high-impact unknowns; `validation_status` before and after; `PRB.status` change, if any; `ASM` gate/triage changes, if any; and the next route. No status change is mandatory.

### 13.8 Pre-contact gate

Before first participant/operator contact, have in hand: the exact decision question(s); the respondent role required; a negative-case prompt; the minimal data to collect; the privacy/consent notice (`docs/discovery/research-ethics.md` §11); the recording decision; the raw-note handling decision; the canonical-evidence plan; and the stopping rule. Do not begin open-ended recruitment without these.

### 13.9 Recommended future `M005` shape — planning guidance only

Not created by this canonicalization. Recommended later structure, for the project owner to plan separately:

1. **Operator / Institutional Challenge** — only decision-compatible questions answerable via operators/institutions/data.
2. **Affected-Journey Challenge** — only user/lived-journey questions still needed after operator evidence.
3. **Validation Decisions & D5 Closure** — integrate evidence, apply the validation contract (`docs/models/problem-model.md`), update `ASM`/`PRB` only where justified, create the D6 handoff, and close D5.

External contacts/data requests may run in parallel outside AIQT while canonical repository integration remains serialized.

## 14. Evidence Qualification v1 — authoring/intake rule

Canonicalized 2026-08-23, following a read-only audit of the `EVD-*` corpus. This is a human authoring/reconciliation methodology, applied when drafting or reconciling `EVD-*` records — it is **not** a semantic verifier, truth engine, or automated check, and it does not add fields to the Evidence schema (`docs/models/evidence-model.md`).

Before promoting information to a canonical `EVD-*`, the investigator should be able to determine, from the record's canonical representation (the `observation`, `source`, `geography`/`population`, and `notes` fields already in the schema — no new fields required):

1. **Observation** — there is one identifiable, sufficiently atomic factual observation (not a bundle of unrelated claims).
2. **Provenance** — the observation is directly supported by the cited `SRC-*`/engagement, not inferred beyond what it states.
3. **Scope** — its actual place/population/time bounds are understood.
4. **Inference limits** — the material conclusion(s) it does *not* support are understood (see `docs/models/evidence-model.md`'s waiting-time example).

Qualification as `EVD` is not evidential strength — `strength` and `evidence_nature` remain the separate dimensions already defined in the Evidence Model. Weak, scoped, or anecdotal information may still qualify as `EVD` when represented honestly and its scope/limits are clear. If a material question above cannot be answered, the information should normally remain source/context/research note/lead pending further investigation, rather than being promoted.

Independence stays relational and is assessed at `ASM-*`/problem level, not per-record (§13; `docs/models/evidence-model.md`). Directness stays `PRB-*`-relative, assessed per-problem, not per-record. Neither is redefined by this section.

Apply this prospectively, and during other reconciliation work already touching a record. Do not trigger a historical corpus backfill merely because this section now exists.
