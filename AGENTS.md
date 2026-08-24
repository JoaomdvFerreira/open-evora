# AGENTS.md

Canonical repository-wide instructions for AI agents working on Open Évora.

This file owns **global safeguards, repository execution discipline, and document routing**. It does not own research methodology, research-data semantics, or Research Explorer architecture.

## 1. Document routing and ownership

Read only the context required for the task.

| Task | Required internal context | Canonical owner |
| --- | --- | --- |
| Research, evidence, or corpus work | `docs/investigationstrategy.md`, `docs/datamodel.md` | investigation method + data semantics |
| Research Explorer work | `docs/explorerarchitecture.md` | Explorer architecture/product invariants |
| Explorer work touching research data/projections | add `docs/datamodel.md` | research-data semantics |
| Mixed work | all applicable documents above | each document owns only its domain |

Do not use `README.md`, deleted/superseded documents, or historical Git content as internal governance unless the task explicitly requires them. `README.md` is the public project overview.

The internal documentation control plane is exactly:
- `AGENTS.md`
- `CLAUDE.md`
- `docs/investigationstrategy.md`
- `docs/datamodel.md`
- `docs/explorerarchitecture.md`

`README.md` is the only public project overview.

Do not create additional project documentation files without explicit repository-owner authorization. Put a durable rule in its existing owner document; keep implementation detail in code/tests and historical rationale in Git/PR history.

A rule should have one canonical documentary owner. Other documents may reference it but should not recreate a competing version.

## 2. Global safeguards

These rules always apply.

### Language

User/public-facing Open Évora content uses PT-PT. Internal technical documentation and canonical schema/enums remain English unless their contract says otherwise. Localize technical values only at presentation. Preserve official published names.

### Publication boundary

The repository is public. Treat commits, branches, pull requests, generated artifacts, and deployments as potential publication acts.

Do not publish:
- private correspondence or raw stakeholder material;
- transcripts, recordings, private notes, or unnecessary personal identifiers;
- credentials, secrets, or local-machine state;
- material whose publication or reuse rights are unclear.

Public accessibility, machine readability, permission to reuse, and permission to republish are separate properties. Do not infer one from another.

When publication safety is genuinely uncertain, stop and report the uncertainty.

If potentially non-public material is encountered, stop the affected work. Do not reproduce that material in reports; report only relevant IDs/paths/categories. Seek authorization before remediation.

### Evidence integrity

Never strengthen a claim beyond what canonical evidence supports.

In particular:
- `UNKNOWN` is not `NO`;
- reported is not verified;
- historical is not necessarily current;
- proposed or planned is not implemented;
- source availability does not establish authority for every claim;
- absence of evidence does not establish absence of a problem.

Do not invent, silently normalize, or fill factual gaps.

### Canonical-state integrity

Preserve one canonical source of truth:

`canonical state → governed derived representation → presentation`

Do not create parallel semantic state in application code, generated data, documentation, or UI.

If documentation and executable contracts materially disagree, identify the conflict and stop the affected change rather than silently reconciling it.

### Human-owned decisions

New evidence may justify review; it does not automatically authorize a research-state transition.

Deterministic tools may evaluate structure and readiness. They must not silently make human-owned semantic decisions such as corroboration, validation, investigation posture, or equivalent research judgement.

A verifier PASS/READY result is not proof that a substantive claim is true.

### Scope control

Do not autonomously:
- start the next milestone or investigation phase;
- introduce adjacent architecture or product work;
- perform unrelated cleanup;
- turn a future improvement into current implementation.

Record useful out-of-scope findings concisely and leave them for later work.

### External actions

Do not perform external actions unless explicitly authorized by the task.

This includes stakeholder outreach, publishing, deployment, releases, sending messages, or creating commitments on behalf of Open Évora.

Do not imply institutional partnership, endorsement, or authorization that has not been established.

### Destructive actions

Do not perform destructive or difficult-to-reverse operations without explicit authorization.

This includes force-push, rewriting shared Git history, destructive migration, deletion of canonical research data, removal of evidence/provenance to satisfy validation, or bypassing repository protections.

Prefer reversible remediation.

## 3. Documentation and executable authority

Markdown owns durable methodology, semantics, and architecture only in the document assigned to that domain.

Executable contracts own implemented structure and deterministic behaviour where applicable, including schemas, validators, tests, runtime types, and tooling.

Do not duplicate complete schemas, enum inventories, component inventories, generated state, or implementation detail in Markdown.

If a semantic document describes an adopted target that is not yet implemented, that transition must be explicit.

## 4. Git and handoff

Work through a branch and pull request unless the task explicitly defines another workflow.

Do not push directly to protected `main` or bypass repository protections unless explicitly authorized by the repository owner.

Before handing work back:
- inspect the complete diff;
- run relevant deterministic validation;
- run `git diff --check`;
- report failures and blockers accurately.

Do not claim validation that was not performed.
