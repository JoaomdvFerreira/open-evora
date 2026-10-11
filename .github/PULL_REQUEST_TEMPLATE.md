## Summary

<!-- Briefly state the outcome and why it is needed. -->

## Scope

<!-- State what is included and explicitly identify material exclusions. -->

## Changes

<!-- List the substantive changes. -->

## Validation

- [ ] Relevant tests pass.
- [ ] `git diff --check` passes.
- [ ] Required repository checks pass.

## Research semantic review

<!--
Keep N/A when this PR creates, updates or deletes no canonical PRB/EVD/SRC record file.
Otherwise replace N/A with the exact compact receipt block printed by `npm run research:lane-b:prepare -- --base <base>`, run before the research change is committed. Never write or edit the receipt by hand.
- A self-review is not sufficient; the receipt binds a separate independent reviewer's result.
- The complete independent review, including every CLEC signal disposition, is stored in the generated review artifact `.research-review/<reviewSha256>.json`, which must be committed in this PR. The receipt carries only its hash and binding data.
- CI rebuilds the reviewer input from Git and verifies the receipt and that exact artifact against it.
- The receipt must correspond to this PR's exact base and canonical record content; altering reviewed record content invalidates the receipt and requires a new review.
- Only a CONCUR review is eligible for human approval; it is not an approval.
- Agents do not inspect the full review artifact unless the repository owner explicitly directs it.
-->

N/A

## Source / provenance

- Branch: `...`
- Head SHA: `...`
- Base branch / SHA: `...`
- Source inputs or deployment identifiers (if applicable): `...`

Do not claim provenance, attestation, or verification unless it has been verified.

## Risks / deferred work

<!-- State risks, follow-up work, and decisions deliberately left outside this PR. -->

## Merge requirements

- [ ] Required approval is present.
- [ ] All review threads are resolved.
- [ ] Required repository checks pass.
- [ ] Head SHA has been rechecked immediately before merge, where applicable.

## Notes

Do not include secrets, tokens, cookies, authentication material, bypass instructions, or other sensitive material in this PR.
