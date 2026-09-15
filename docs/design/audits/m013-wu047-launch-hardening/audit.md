# M013 / WU047 — Production Launch Hardening Audit

Status: **OWNER_ACTION_REQUIRED**

This bounded audit records WU047 evidence only. It does not make a Go/hold
decision and does not execute WU048 verification.

## Audit context

- **Authoritative scope:** current `.aiqt/state.json` WU047 record and
  `EVT-308`; `PKT-048` is historical and was not used as authority.
- **WU044 provenance:** `docs/design/m013-launch-automation-contract.md`
  §§8, 10 and 13.
- **Audit date:** 2026-09-15 (Europe/Lisbon).
- **Intended public origin:** `https://open-evora.vercel.app`.
- **Production deployment inspected:**
  `dpl_9arvHhYKtzfa6raiPZFupu5UcRnm`, `Ready`, created 2026-09-12;
  production alias inspection was read-only.
- **Local render:** generated Explorer read model (274 records, 403 edges),
  then inspected in headless Edge at 1280×900 and 360×800.

## P2 closure evidence

| Item | Observation / evidence | Assessment | Disposition | Remediation / re-validation |
| --- | --- | --- | --- | --- |
| 1. Deployment Protection | An unauthenticated request to the intended public alias returned `200 OK` and the Explorer HTML. A direct immutable production deployment URL returned `302` to Vercel SSO; the public alias remains reachable without authentication. Vercel CLI inspection reported the aliased deployment `Ready`. | The approved public production origin is reachable without unintended authentication. Direct deployment-URL protection does not block the approved alias. | `PASS_VERIFIED` | None. Read-only HTTP and CLI inspection. |
| 2. Preview access control | An unauthenticated request to the inspected Preview URL `open-evora-cotyyp2am-joaomdvferreiras-projects.vercel.app` returned `302` to Vercel SSO. `vercel ls open-evora --environment preview` reported it as `Ready`; it is distinct from the production alias. | Preview is distinguishable from Production and access-controlled for an unauthenticated request. | `PASS_VERIFIED` | None. Read-only HTTP and CLI inspection. |
| 3. Required production metadata | The public HTML has `lang="pt-PT"`, charset, viewport, and the title `Explorador de Investigação Open Évora`; it has no description, OpenGraph, or social-card metadata. WU044 requires OpenGraph/social metadata but does not define the missing values. | A required production metadata set is incomplete. Supplying description/social content would require new owner-approved public copy/branding values. | `OWNER_ACTION_REQUIRED` | No change made; no exact canonical metadata values exist to implement. |
| 4. robots / sitemap | `https://open-evora.vercel.app/robots.txt` and `/sitemap.xml` both returned `404 Not Found`. No repository asset implements either endpoint. | Required endpoints are absent. WU044/WU047 do not define the crawler policy or canonical URL inventory needed to author their content. | `OWNER_ACTION_REQUIRED` | No change made; no exact canonical robots policy or sitemap URL set exists to implement. |
| 5. Required trust surfaces | The Overview visibly provides independence and evidence/provenance explanations. No public About, methodology, correction route, contact, or privacy surface is implemented or reachable from the Explorer. WU044 names these surfaces but supplies no approved content/policy. | Four named trust surfaces are absent; this is not safely remediable by inventing public policy, contact, or methodology copy. | `OWNER_ACTION_REQUIRED` | No change made; requires owner-approved content and routing decisions. |
| 6. Accessibility / responsive / browser compatibility | Existing Explorer tests cover skip-link focus transfer, keyboard navigation, actionable error retry, route transitions, and title/focus behavior. Fully loaded local headless-Edge captures at 1280×900 and 360×800 showed usable global navigation and primary “Explorar” actions at both viewports. No new unusable navigation, inaccessible primary action, material layout block, or primary-workflow breakage was observed. | Bounded launch audit found no new P0/P1 accessibility, responsive, or browser-compatibility blocker. This is not WU048 end-to-end verification. | `PASS_VERIFIED` | No remediation. Revalidated by local rendered desktop/compact captures and existing focused tests. |
| 7. Custom-domain decision | The Vercel project has only the approved `*.vercel.app` aliases; the current WU047 scope and `EVT-308` record the owner decision to defer a custom domain. The intended production alias is usable. | Owner decision already recorded; no domain, DNS, redirect, or Vercel-domain action is authorized. | `OWNER_ACCEPTED_DEFER` | None. |

## P3 re-evaluations

| Observation | Evidence | Disposition |
| --- | --- | --- |
| `favicon.ico` 404 | `https://open-evora.vercel.app/favicon.ico` returned `404 Not Found` during this audit. The response remains cosmetic and did not prevent use of the Explorer. | `OWNER_ACCEPTED_DEFER` |
| Approximately 9px `.explorer-navigation` overflow at approximately 360px | The fully loaded 360×800 Edge render showed the available global navigation actions and primary content usable. No navigation action was hidden or blocked and no material accessibility impact was observed. The known bounded cosmetic observation is not remediated here. | `OWNER_ACCEPTED_DEFER` |

## Required owner action

Before WU047 can close, the owner must provide/approve:

1. the exact public metadata values required for the OpenGraph/social set;
2. the crawler policy and canonical URL inventory for `robots.txt` and
   `sitemap.xml`; and
3. the exact public content and routing for About, methodology, correction,
   contact, and privacy surfaces.

After those decisions exist, only the minimal repository-local implementations
they authorize may be considered. No Vercel, DNS, domain, environment,
CI, ruleset, research-data, AR-05, favicon, or cosmetic-overflow change was
made by this audit.
