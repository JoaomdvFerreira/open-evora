# M013 / WU047 — Production Launch Hardening Audit

Status: **REMEDIATION_IMPLEMENTED — INDEPENDENT_REVIEW_PENDING**

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
| 3. Required production metadata | The owner approved the exact title, description and social title/description. `npm run build --prefix apps/research-explorer` emitted the home and all five trust-page HTML entries with `lang="pt-PT"`, charset, viewport, description, OpenGraph title/description/type, and Twitter summary/title/description. No discretionary image was added because no existing project branding asset is available. | The required repository-local metadata set is present in the built production artifact. | `PASS_VERIFIED` | Objective local-build inspection; deployment was deliberately not changed. |
| 4. robots / sitemap | The deterministic Vite build emits `dist/robots.txt` with `Allow: /` and `Sitemap: https://open-evora.vercel.app/sitemap.xml`, plus a six-URL `dist/sitemap.xml`: `/` and the five approved trust routes. It contains no query strings, fragments, duplicate, Preview, development, asset, tooling, or non-public URLs. Problem and Record details remain query-state-only application URLs and are explicitly deferred from sitemap inclusion by the owner. | The bounded, owner-refined crawler policy is present in the built production artifact. | `PASS_VERIFIED` | R1 remediation and focused artifact/test inspection; deployment was deliberately not changed. |
| 5. Required trust surfaces | The owner approved exact PT-PT content and canonical Issues destination. The deterministic build emitted `/about`, `/methodology`, `/corrections`, `/contact` and `/privacy` static entries; the global footer makes each reachable. Focused tests verify the privacy content/footer and the corrections link to `https://github.com/JoaomdvFerreira/open-evora/issues`. The privacy precondition review found no accounts/authentication, public personal-data forms, analytics, or non-essential cookies/tracking in production application sources. | Each required public trust surface is implemented from owner-approved copy and has an objective build/test record. | `PASS_VERIFIED` | Objective local-build and focused-test inspection; deployment was deliberately not changed. |
| 6. Accessibility / responsive / browser compatibility | Existing Explorer tests cover skip-link focus transfer, keyboard navigation, actionable error retry, route transitions, and title/focus behavior. Fully loaded local headless-Edge captures at 1280×900 and 360×800 showed usable global navigation and primary “Explorar” actions at both viewports. No new unusable navigation, inaccessible primary action, material layout block, or primary-workflow breakage was observed. | Bounded launch audit found no new P0/P1 accessibility, responsive, or browser-compatibility blocker. This is not WU048 end-to-end verification. | `PASS_VERIFIED` | No remediation. Revalidated by local rendered desktop/compact captures and existing focused tests. |
| 7. Custom-domain decision | The Vercel project has only the approved `*.vercel.app` aliases; the current WU047 scope and `EVT-308` record the owner decision to defer a custom domain. The intended production alias is usable. | Owner decision already recorded; no domain, DNS, redirect, or Vercel-domain action is authorized. | `OWNER_ACCEPTED_DEFER` | None. |

## P3 re-evaluations

| Observation | Evidence | Disposition |
| --- | --- | --- |
| `favicon.ico` 404 | `https://open-evora.vercel.app/favicon.ico` returned `404 Not Found` during this audit. The response remains cosmetic and did not prevent use of the Explorer. | `OWNER_ACCEPTED_DEFER` |
| Approximately 9px `.explorer-navigation` overflow at approximately 360px | The fully loaded 360×800 Edge render showed the available global navigation actions and primary content usable. No navigation action was hidden or blocked and no material accessibility impact was observed. The known bounded cosmetic observation is not remediated here. | `OWNER_ACCEPTED_DEFER` |

## Owner-decision record

`EVT-309` records the owner's approval of the exact metadata, crawler policy,
canonical URL inventory, five trust-surface texts, GitHub Issues destination,
and privacy precondition. The two accepted P3 deferrals remain recorded above
and in `EVT-308`.

No Vercel, DNS, domain, environment, CI, ruleset, research-data, AR-05,
favicon, or cosmetic-overflow change was made by this remediation.

## R1 sitemap remediation record

The independent review found that the initial sitemap contained **292 total
URLs**: **286 query-state Problem/Record detail URLs**
(`?view=problem&id=...` and `?view=records&id=...`), plus `/` and the five
trust routes. Its previous assertion that query/filter/search state was
excluded "by construction" was incorrect.

The follow-up investigation confirmed that the current Explorer uses
`URLSearchParams` for Problem and Record selection and has no already-supported
non-query canonical detail routes. The owner explicitly declined a routing
architecture change in WU047. Accordingly, Problem/Record canonical routing
and their later sitemap inclusion are deferred beyond WU047; this remediation
does not create paths, aliases, redirects, or routing infrastructure.

The owner-refined WU047 sitemap contains only the existing path-based public
routes: `/`, `/about`, `/methodology`, `/corrections`, `/contact`, and
`/privacy`. Focused tests assert the approved origin, deterministic generation,
valid XML, XML escaping, zero query URLs, zero fragment URLs, uniqueness, and
the complete six-route inventory. The post-build `dist/sitemap.xml` inspection
is recorded with the validation results for this remediation.

## Bounded browser evidence

| Capture | Route/surface | Viewport | Browser/runtime | Observations |
| --- | --- | --- | --- | --- |
| `desktop-1280x900.png` | `/` overview | 1280x900 | locally installed Google Chrome 153.0.8010.36, headless | Primary navigation is visible and usable; the `Explorar problemas` primary action is visible and usable; no material clipping or page-level overflow observed. |
| `compact-360x800.png` | `/` overview | 360x800 | locally installed Google Chrome 153.0.8010.36, headless | Primary navigation actions `Visão geral` and `Registos` remain visible and usable; `Explorar problemas` remains visible and usable. The known approximately 9px horizontal `.explorer-navigation` overflow is visible but cosmetic; no action is hidden or blocked. |

The PNG files are retained beside this audit for independent inspection. This is
bounded WU047 responsive/browser evidence only; it is not WU048 end-to-end or
adversarial Go-Live verification.
