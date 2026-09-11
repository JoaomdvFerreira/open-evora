# DS-04B foundation-consolidation reconciliation and implementation contract

Status: **WU035 contract — reconciliation complete, execution-deterministic bounded implementation contract for WU036/WU037. Amended per owner hold: every legacy property/reference now carries exactly one final disposition; WU036 has zero unresolved design/scope decisions.**

Scope: reconciles the approved DS-04B foundation tokens already present in production
(`apps/research-explorer/src/styles/tokens.css`, imported by
`apps/research-explorer/src/main.tsx` since DS-05A commit `0daf239`) against the legacy
"V1 visual foundation" tokens and hard-coded literals still live in production
`apps/research-explorer/src/index.css`. This document is the single canonical source for
the WU036 implementation contract and the WU037 verification contract. It makes no
runtime change; `apps/research-explorer/src/**`, `package.json`, and all lockfiles are
untouched by WU035.

Authority: this document sits under [docs/design/](README.md) per its authority hierarchy.
It does not redefine [foundations](foundations.md), [component model](component-model.md),
or [component visual contract](component-visual-contract.md) — those remain the design-intent
canon. This document owns the migration mapping, selector inventory, and bounded
implementation/verification contract for the DS-04B → production token consolidation only.

---

## A. Legacy → semantic token mapping

The legacy `:root` block at `index.css:645-684` defines 36 custom properties (the
"V1 visual foundation"). DS-04B's semantic layer in `tokens.css:67-158` defines the
current approved semantic tokens. Every legacy variable is mapped below to its DS-04B
semantic equivalent, or flagged as having none.

### A.0 Final disposition — execution-deterministic, single source of truth

This table is the sole authority for what WU036 does with every one of the 36 legacy
`:root` variables plus the one undefined `--link` reference (37 items total). Every
item carries **exactly one** final disposition. §A.1/§A.2 below retain the descriptive
rationale for each mapping/gap; where §A.1/§A.2 prose and this table could be read as
disagreeing, this table controls. WU036 must implement every `MIGRATE` item and leave
every `LEAVE_UNCHANGED` / `OUT_OF_SCOPE` / `DEAD_NO_ACTION` item exactly as specified
here — no substitution, rounding, opportunistic removal, or independent judgment call.
Live-usage counts below were re-verified directly against `index.css` by exact
`var(--name)` string match (not substring match — `--space-1` vs `--space-10`/`-11`
were previously conflatable and are now counted exactly).

| # | Legacy item | Live uses | Disposition | Destination / action |
| --- | --- | --- | --- | --- |
| 1 | `--canvas` | live (see §B.1) | MIGRATE | `--color-surface-reading` |
| 2 | `--surface` | live | MIGRATE | `--color-surface-raised` |
| 3 | `--surface-muted` | live | MIGRATE | `--color-surface-subtle` |
| 4 | `--ink` | live | MIGRATE | `--color-ink-primary` |
| 5 | `--ink-soft` | live | MIGRATE | `--color-ink-secondary` |
| 6 | `--ink-faint` | 32 | MIGRATE | `--color-ink-muted` — every one of the 32 selectors currently consuming `--ink-faint` (line list: §B.1; full line enumeration preserved in WU035 working notes) migrates to `--color-ink-muted`. Selector-level destination is fixed by legacy variable name, not re-judged per selector, because the legacy and target values are pairwise identical (`#6b675f`) and offer no independent signal. |
| 7 | `--ink-faintest` | 15 | MIGRATE | `--color-ink-faint` — every one of the 15 selectors currently consuming `--ink-faintest` migrates to `--color-ink-faint`, by the same fixed-by-name rule as row 6. The legacy two-role split (`--ink-faint` vs `--ink-faintest`) is preserved as a semantic distinction in DS-04B (`--color-ink-muted` vs `--color-ink-faint`) even though all four values involved are numerically identical (`#6b675f`). WU036 must not merge the two selector sets or reassign any selector across the two destinations. |
| 8 | `--line` | live | MIGRATE | `--color-separator-standard` |
| 9 | `--line-subtle` | live | MIGRATE | `--color-separator-faint` |
| 10 | `--line-emphasis` | live | MIGRATE | `--color-separator-emphasis` |
| 11 | `--accent` | live | MIGRATE | `--color-accent` — visible clay-hue change; every migrated selector must be flagged for WU037 §G.4 contrast review (see §F). |
| 12 | `--accent-dark` | live | MIGRATE | `--color-accent-hover` — same clay-hue caveat as row 11; legacy static-link-ink role inverts to DS-04B's hover-state convention (see §A.1 note) but the destination token is fixed regardless. |
| 13 | `--editorial` | live | MIGRATE | `--font-reading` (exact stack match) |
| 14 | `--ui` | live (21 consumers) | MIGRATE | `--font-interface` (Public Sans substitution, §D) |
| 15 | `--technical` | live | MIGRATE | `--font-technical` (exact stack match) |
| 16 | `--tap-min` | live | MIGRATE | `--target-min` (exact value match) |
| 17 | `--radius-md` | live | MIGRATE | `--radius-control` (exact value match) |
| 18 | `--radius-lg` | live | MIGRATE | `--radius-surface` |
| 19 | `--space-2` | 34 | MIGRATE | `--space-tight` (8px, exact) |
| 20 | `--space-4` | 28 | MIGRATE | `--space-standard` (16px, exact) |
| 21 | `--space-5` | 13 | MIGRATE | `--space-loose` (24px; legacy 20px, close not exact — WU037 visual-parity flag, not a blocking gap) |
| 22 | `--space-6` | 15 | MIGRATE | `--space-loose` (24px, exact) |
| 23 | `--space-9` | 1 | MIGRATE | `--space-section` (48px, exact) |
| 24 | `--space-1` | 10 | LEAVE_UNCHANGED | No DS-04B named-scale equivalent (4px). Do not round or substitute to the nearest DS-04B spacing token. Remains a legacy literal/variable in `index.css` for this migration scope. |
| 25 | `--space-3` | 24 | LEAVE_UNCHANGED | No DS-04B named-scale equivalent (12px). Same rule as row 24. |
| 26 | `--space-8` | 6 | LEAVE_UNCHANGED | No DS-04B named-scale equivalent (40px). Same rule as row 24. |
| 27 | `--radius-sm` | 3 | LEAVE_UNCHANGED | Nearest DS-04B token (`--radius-focus`) is a role-mismatched focus-ring radius, not a general small-surface radius. Do not substitute it. Remains a legacy literal/variable in `index.css`. |
| 28 | `--shell-content-max` | 1 | OUT_OF_SCOPE / LEAVE_UNCHANGED | Outside DS-04B's Foundation-layer ownership entirely (a [component model](component-model.md) `ShellFrame` layout-primitive concern, §2.2). Not a DS-04B gap; not touched by WU036 under this contract. |
| 29 | `--surface-chip` | 0 | DEAD_NO_ACTION | Zero consumers. WU036 must not remove this declaration opportunistically unless removal is strictly required by an already-authorized migrated declaration on the same line/block; otherwise leave the dead `:root` entry exactly as-is. |
| 30 | `--ink-disclaimer` | 0 | DEAD_NO_ACTION | Same rule as row 29. |
| 31 | `--icon-muted` | 0 | DEAD_NO_ACTION | Same rule as row 29. |
| 32 | `--line-control` | 0 | DEAD_NO_ACTION | Same rule as row 29. |
| 33 | `--control-height` | 0 | DEAD_NO_ACTION | Same rule as row 29. |
| 34 | `--space-7` | 0 | DEAD_NO_ACTION | Same rule as row 29. |
| 35 | `--space-10` | 0 | DEAD_NO_ACTION | Same rule as row 29. |
| 36 | `--space-11` | 0 | DEAD_NO_ACTION | Same rule as row 29. |
| 37 | `--link` (undefined, `index.css:2568`) | 1 | OUT_OF_SCOPE | Not a legacy `:root` token — a pre-existing undefined-custom-property defect, unrelated to this migration. Do not fix it as part of M010. Left exactly as-is unless the owner separately authorizes a defect fix outside this contract. |

**Disposition totals: 23 MIGRATE, 4 LEAVE_UNCHANGED (rows 24-27), 1 OUT_OF_SCOPE / LEAVE_UNCHANGED (row 28), 8 DEAD_NO_ACTION (rows 29-36), 1 OUT_OF_SCOPE (row 37, non-`:root` defect). Total items: 37. Total `:root` legacy variables covered: 36 (rows 1-36) — matches `index.css:645-684`'s exact declaration count. No `:root` variable is left without a row in this table.**

Note on reconciling this table's row count against a prior owner communication that
referenced "18 items with no safe DS-04B equivalent" grouped as "10 dead/unused, 3
spacing gaps, 1 radius mismatch, 1 layout-width, 1 `--link` defect, 2 collapse-case":
directly re-verified against `index.css` by exact `var(--name)` string match, the dead
count is **8**, not 10 (rows 29-36; `--space-1`, `--space-3`, `--space-8`, `--radius-sm`,
and `--shell-content-max` are live, not dead — 10, 24, 6, 3, and 1 consumers
respectively). The 2 collapse-case items (`--ink-faint`/`--ink-faintest`, rows 6-7) are
MIGRATE, not "no equivalent" — DS-04B does define distinct target roles for both; the
collapse is a *value* coincidence (`#6b675f` on both legacy and both target tokens), not
an absence of a semantic destination. This table's counts (23/4/1/8/1) are the verified
figures; they supersede any earlier illustrative count.

### A.1 Mapped (safe semantic equivalent exists)

| Legacy variable | Legacy value | DS-04B semantic token | DS-04B resolved value | Notes |
| --- | --- | --- | --- | --- |
| `--canvas` | `#faf8f3` | `--color-surface-reading` | `oklch(97% 0.012 80)` | Both are the warm-paper reading background; values differ (not byte-identical), a visual-parity judgement call for WU036/WU037, not a semantic ambiguity. |
| `--surface` | `#ffffff` | `--color-surface-raised` | `#ffffff` | Exact value match. |
| `--surface-muted` | `#f5f3ec` | `--color-surface-subtle` | `#f7f4e9` | Same role (muted/subtle surface fill), close but not identical value. |
| `--ink` | `#1f1d1a` | `--color-ink-primary` | `oklch(22% 0.01 60)` | Same role (primary reading ink). |
| `--ink-soft` | `#3a372e` | `--color-ink-secondary` | `oklch(38% 0.015 60)` | Same role (secondary/softer ink). |
| `--ink-faint` | `#6b675f` | `--color-ink-muted` | `#6b675f` | Exact value match. Disposition MIGRATE; selector-level destination fixed by legacy name per §A.0 row 6 (all 32 current `--ink-faint` consumers → `--color-ink-muted`) — not a WU036 judgment call. |
| `--ink-faintest` | `#6b675f` | `--color-ink-faint` | `#6b675f` | Exact value match. Legacy `--ink-faint` and `--ink-faintest` are already identical values (`#6b675f`) mapping to two distinct DS-04B roles (`--color-ink-muted` vs `--color-ink-faint`, also identical to each other at `#6b675f`) — the legacy two-step distinction collapses to one value on both sides, but the semantic distinction is preserved on the target side. Disposition MIGRATE; selector-level destination fixed by legacy name per §A.0 row 7 (all 15 current `--ink-faintest` consumers → `--color-ink-faint`) — not a WU036 judgment call. |
| `--line` | `#ddd8cc` | `--color-separator-standard` | `#ddd8cc` | Exact value match. |
| `--line-subtle` | `#eeeae0` | `--color-separator-faint` | `#e3ddc9` | Same role (fainter separator), close but not identical value. |
| `--line-emphasis` | `#1f1d1a` | `--color-separator-emphasis` | `#201e1a` | Same role (strong/emphasis separator), near-identical value. |
| `--accent` | `#1d4341` | `--color-accent` | `oklch(42% 0.13 40)` | Same role (interactive accent) but a materially different hue: legacy is a dark teal/green, DS-04B primitive `--p-color-clay` is a warm clay/terracotta. This is a visible design-direction change, not a value-precision difference — flag for explicit WU037 rendered review, not silent adoption. |
| `--accent-dark` | `#2b5d5a` | `--color-accent-hover` | `oklch(30% 0.11 40)` | Nearest DS-04B role is the hover/pressed state, not a distinct "dark link ink" role. Legacy uses `--accent-dark` as static link-text ink (see `a { color: var(--accent-dark); }` at `index.css:806`) and `--accent` only on `:hover`, i.e. the inverse of DS-04B's hover-state convention. WU036 must not assume interchangeable semantics — same clay-hue caveat as `--accent` applies. |
| `--editorial` | `"Source Serif 4", Georgia, "Times New Roman", serif` | `--font-reading` | `"Source Serif 4", Georgia, "Times New Roman", serif` | Exact stack match. |
| `--ui` | `"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | `--font-interface` | `"Public Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | Same role (interface typeface); **family itself changes** (Inter → Public Sans) — this is the owner-approved DS-04B typeface substitution (§D), not a token-naming exercise. |
| `--technical` | `"IBM Plex Mono", ui-monospace, "SFMono-Regular", "Cascadia Code", Consolas, monospace` | `--font-technical` | `"IBM Plex Mono", ui-monospace, "SFMono-Regular", "Cascadia Code", Consolas, monospace` | Exact stack match. |
| `--tap-min` | `44px` | `--target-min` | `44px` | Exact value match. |
| `--radius-md` | `4px` | `--radius-control` | `4px` | Exact value match. |
| `--radius-lg` | `5px` | `--radius-surface` | `6px` | Same role (surface/card radius), close but not identical value. |

### A.2 No safe semantic equivalent (explicit gap)

Dispositions below are fixed by §A.0; this table retains only the rationale.

| Legacy variable | Legacy value | Live usage (index.css) | Disposition | Why no safe DS-04B equivalent |
| --- | --- | --- | --- | --- |
| `--surface-chip` | `#f1efe8` | 0 (dead — defined, never consumed) | DEAD_NO_ACTION | No consumer; no mapping needed. Not removed opportunistically per §A.0 row 29. |
| `--ink-disclaimer` | `#a6a192` | 0 (dead) | DEAD_NO_ACTION | No consumer; no mapping needed. Not removed opportunistically per §A.0 row 30. |
| `--icon-muted` | `#b7b2a4` | 0 (dead) | DEAD_NO_ACTION | No consumer; no mapping needed. Not removed opportunistically per §A.0 row 31. |
| `--line-control` | `#c7c2b4` | 0 (dead) | DEAD_NO_ACTION | No consumer; no mapping needed. Not removed opportunistically per §A.0 row 32. |
| `--control-height` | `40px` | 0 (dead) | DEAD_NO_ACTION | No consumer; no mapping needed. Not removed opportunistically per §A.0 row 33. |
| `--space-7` | `32px` | 0 (dead) | DEAD_NO_ACTION | No consumer; no mapping needed. Not removed opportunistically per §A.0 row 34. |
| `--space-10` | `64px` | 0 (dead) | DEAD_NO_ACTION | No consumer; no mapping needed. Not removed opportunistically per §A.0 row 35. |
| `--space-11` | `90px` | 0 (dead) | DEAD_NO_ACTION | No consumer; no mapping needed. Not removed opportunistically per §A.0 row 36. |
| `--space-1` | `4px` | 10 | LEAVE_UNCHANGED | DS-04B's spacing layer (`--space-tight` 8px, `--space-standard` 16px, `--space-loose` 24px, `--space-section` 48px) is a **4-step named scale**, not a 10-step numeric scale, and has no 4px step. Not rounded/substituted per §A.0 row 24. |
| `--space-3` | `12px` | 24 | LEAVE_UNCHANGED | No DS-04B named-scale equivalent (no 12px step). Not rounded/substituted per §A.0 row 25. |
| `--space-8` | `40px` | 6 | LEAVE_UNCHANGED | No DS-04B named-scale equivalent (no 40px step). Not rounded/substituted per §A.0 row 26. |
| `--radius-sm` | `3px` | 3 | LEAVE_UNCHANGED | Nearest DS-04B token is `--radius-focus` (`--p-radius-sm` = `2px`), a *focus-ring* radius role, not a general small-surface radius. Reusing it for `.narrow-record-type`'s pill-badge radius (its only remaining live use, `index.css:1467`) would be a role conflation, not a safe mapping. Not substituted per §A.0 row 27. |
| `--shell-content-max` | `980px` | 1 | OUT_OF_SCOPE / LEAVE_UNCHANGED | No DS-04B layout-width token exists; DS-04B is a Foundation-layer (typography/colour/spacing) token set only, and does not define a shell/frame width primitive. This is a [component model](component-model.md) `ShellFrame` layout-primitive concern (§2.2), outside DS-04B's Foundation scope entirely. Not touched by WU036 per §A.0 row 28. |
| `--link` (undefined, found at `index.css:2568`) | n/a — never defined anywhere in the codebase | 1 (`.evd-problem-action, .evd-source-list button { color: var(--link); }`) | OUT_OF_SCOPE | Not a legacy token at all — a pre-existing bug (undefined custom property resolves to the property's initial/inherited value). Out of DS-04B mapping scope; flagged here so WU036 does not mistake it for an intentional token. Not fixed in M010 per §A.0 row 37. |

`--space-2`, `--space-4`, `--space-5`, `--space-6`, and `--space-9` are **MIGRATE**
(§A.0 rows 19-23, target `--space-tight`/`--space-standard`/`--space-loose`/
`--space-section`) — they are not listed in this gap table because they have a safe
semantic equivalent; see §A.1's role for the general mapping pattern and §A.0 for the
authoritative per-variable row.

---

## B. Affected-selector inventory

Full inventory verified directly against `apps/research-explorer/src/index.css` (2875
lines) by exact selector/line cross-check. No other file under
`apps/research-explorer/src/` consumes any of the 36 legacy variable names — `tokens.css`
and every other `styles/*.css` file already use the disjoint DS-04B `--p-*`/`--color-*`/
`--font-*`/`--text-*`/`--space-*` naming convention with zero name collisions.

### B.1 Direct variable consumers (live, in scope)

**201 rule blocks / 193 distinct selector texts** in `index.css` consume at least one
legacy `var(--...)`, grouped by feature area (all line numbers are current-file, pre-WU036):

- **Global body/reset/typography base (6):** `:root` (645); `body` (786); `button, select, input` — accent-color rule (799); `a` (805); `a:hover` (811); `:focus-visible` (1491).
- **Navigation/chrome/skip-link (12):** `.explorer-chrome` (822, 2117); `.shell-frame` (835); `.explorer-chrome-inner > h1` (855, 2133); `.explorer-brand` (865); `.explorer-subtitle` (870); `.manifest-summary` (877); `.explorer-navigation button` (896); `.explorer-navigation button:hover` (908); `.explorer-navigation button[aria-disabled="true"]` (913); `.explorer-navigation button[aria-current="page"]` (923); `.explorer-navigation button[aria-current="page"]::after` (929); `.skip-link` (939).
- **Overview surface (26):** `.reading-guide` (945, 2179); `.reading-guide summary, .overview-status-explanation summary` (957); `.overview-introduction` (978); `.overview-introduction + p` (987); `.overview-independence, .overview-trust, .overview-status-explanation` (1000); `.overview-independence` (1008); `.overview-independence strong` (1016); `.overview-concepts` (1046); `.overview-concepts h3` (1054); `.overview-concepts p` (1062); `.overview-trust` (1068); `.overview-trust strong` (1078); `.overview-status-explanation p` (1088); `.overview-status-explanation p.overview-mobile-copy` (2234); `.overview-problems-heading h3` (1096); `.overview-problems-heading p` (1105); `.overview-problem-list li` (1116); `.overview-problem-list li:hover` (1125); `.overview-problem-list code, .technical-id` (1131); `.overview-problem-list h4` (1139); `.overview-statuses` (1149); `.overview-problem-action button` (1170); `.overview-problem-action button:hover` (1181); `.overview-closing-actions` (1187); `.overview-closing-actions button` (1193); `.overview-closing-actions button:hover` (1203); `.overview-corpus-context` (1209).
- **Records table/list (33):** `.records-controls` (1234); `.records-controls label` (1243); `.records-controls input, .records-controls select` (1251); `.records-controls input:focus, .records-controls select:focus` (1266); `.records-result-count` (1270); `.records-sort-controls` (1277); `.records-sort-controls button` (1291); `.records-sort-controls button:hover, ...[aria-pressed="true"]` (1302); `.desktop-records-list` (1308); `.desktop-record-row` (1315); `.desktop-record-row:hover` (1331); `.desktop-record-row[aria-pressed="true"]` (1335); `.desktop-record-type` (1340); `.desktop-record-label` (1352); `.desktop-record-id` (1360); `.desktop-record-chevron` (1368); `.records-table table` (1374); `.records-table th, .records-table td` (1380); `.records-table th` (1387); `.records-table tbody td:nth-child(1,2,4)` (1402); `.records-table tbody td:nth-child(3)` (1408); `.records-table tbody tr:hover` (1414); `.records-table tr[aria-selected="true"]` (1418); `.records-pagination` (1423); `.records-pagination button` (1430); `.records-pagination button:disabled` (1440); `.narrow-records-list` (1446); `.narrow-record-row` (1450); `.narrow-record-row:hover` (1457); `.narrow-record-type` (1466); `.narrow-record-label` (1474); `.narrow-record-id` (1480); `.narrow-record-chevron` (1486).
- **Record Detail / Problem View / Evidence technical panels (121):** `.detail-breadcrumb` (1514, 2342); `.detail-breadcrumb button, .record-detail-layout > .ui-breadcrumb > button, .problem-view > .ui-breadcrumb > button` (1532); the `:hover` variant (1543); `.record-detail-layout > .ui-breadcrumb, .problem-view > .ui-breadcrumb` (1558, 1564); `.detail-rail-type-note` (1576) + `code` (1583) + `p` (1592); `.detail-rail-actions` (1599) + `button` (1605) + `button:hover` (1619) + `a` (1624) + `a:hover` (1636); `.detail-rail-file` (1643); `.detail-type-row` (1652); `.detail-type-kind` (1660); `.record-detail-main .record-meaning-zone` (1666); `.record-detail-main .record-meaning` (1671); `.record-detail-main .record-role-fields` (1680); `.detail-effect-target` (1685); `.record-detail-main .record-provenance` (1690); `.record-prb-metadata, .record-prb-canonical-state, .record-prb-inspector, .record-prb-references` (1706); `.inspector-field` (1723) + `-name` (1728) + `-value` (1734); `.inspector-object, .inspector-array` (1739); `.inspector-key` (1748); `.inspector-index` (1755); `.inspector-null, .inspector-empty` (1762); `.inspector-scalar-value` (1771); `.prb-reference-item` (1794); `.prb-reference-path` (1804); `.detail-panel-label` (1823) + compound selector (1842); `.detail-provenance-grid` (1847, 2351) + `dt` (1856, 2356) + `dd` (1860); `.detail-technical-field` (1865); `.record-detail-technical` (1871) + `.technical-disclosure summary` (1877); `.technical-disclosure-caption` (1886); `.record-orientation-intro` (1894); `.record-quick-read` (1904) + `-title` (1912) + `-grid` (1918) + `-item dt/dd` (1931/1935) + `-relations` (1940) / `button` (1950) / `button:hover` (1960); `.record-detail-relations` (1964) + `.relationship-paths` (1970); `.record-prb-relations-boundary h4` (1984); `.prb-relations-list li/button/button:hover` (2004/2008/2019); `.problem-compact-section-index` (2034); `.source-compact-section-index, .evd-compact-section-index` (2062); `.problem-view` (2374); `.context-tabs` (2378) + `button` (2388) / `button:hover` (2404) / `[aria-disabled]` (2409) / `[aria-current]` (2419); `.unavailable-note` (2436); `.problem-help` (2466) + `summary` (2474) + `-content` (2482) + `-content p` (2489); `.problem-identity` (2493, 2844) + `-id` (2500) + `-title` (2507); `.problem-file-path` (2516); `.problem-section, .record-editorial-section` (2530) + `.detail-panel-label` compound (2535); `.evd-identity` (2541); `.evd-type-row, .evd-identity-facts, .evd-problem-heading, .evd-source-list li, .evd-relation-values` (2545); `.problem-statement` (2572); `.problem-header-statement` (2582); `.problem-header-facts` (2589) + `dt` (2596) / `dd` (2605); `.problem-current-state-item` (2615) + `h4, .record-editorial-subheading` (2624) + `p` (2634); `.problem-scope-grid` (2641) + `dt` (2648) / `dd` (2657); `.problem-support-statement` (2667); `.evidence-group` (2681) + `h4` (2689); `.evidence-list` (2699); `.evidence-card` (2708); `.evidence-observation, .evidence-provenance` (2721); `.evidence-provenance` (2728); `.evidence-sources` (2733); `.open-question-list` (2744) + `-item` (2753) + `-question` (2759) + `-evidence-refs` (2768) + `-label` (2774) + `-list` (2783); `.status-chip-row` (2806).

### B.2 Hard-coded literals never tokenized (no legacy variable involved at all)

These are live declarations using a raw literal directly — no legacy variable to map, and
therefore no item in §A.0's inventory. Disposition: OUT_OF_SCOPE for WU036 (see rationale
below); these are recorded here only so WU036 does not mistake them for MIGRATE targets:

**Hex color literals (9 live occurrences, 4 distinct values):**

| Selector | Property | Value | Line |
| --- | --- | --- | --- |
| `.overview-problem-list li:hover` | `border-color` | `#bbb3a3` | 1126 |
| `.records-controls input, .records-controls select` | `border` | `1px solid #beb7aa` | 1256 |
| `.records-pagination button` | `border` | `1px solid #beb7aa` | 1434 |
| `.desktop-record-row[aria-pressed="true"]` | `background` | `#f0f5f3` | 1336 |
| `.records-table tr[aria-selected="true"]` | `background` | `#f0f5f3` | 1420 |
| `.narrow-record-row[aria-pressed="true"]` | `background` | `#f0f5f3` | 1462 |
| `th, td` | `border` | `1px solid #ccc` | 325 |
| `tr[aria-selected="true"]` | `outline` | `2px solid #111` | 353 |
| `code` | `background` | `#f2f2f2` | 480 |
| `.graph-controls fieldset` | `border` | `1px solid #ccc` | 501 |
| `.graph-canvas` | `border` / `background` | `1px solid #ccc` / `#fafafa` | 512 / 513 |
| `.graph-focus-panel` | `border` | `1px solid #ccc` | 533 |

None of these has a DS-04B semantic equivalent — DS-04B's semantic palette (§A.1/A.2) does
not define pressed-row, hover-border, or graph-canvas roles. **Disposition: OUT_OF_SCOPE
for WU036.** These literals were never part of the 37-item legacy-`:root`-variable
inventory in §A.0 (they have no legacy variable to begin with), and §F does not authorize
WU036 to introduce a new token/value decision for any of them. They remain as-is until a
future, separately authorized work unit addresses hard-coded-literal tokenization.

**Raw `font-family` literals never assigned `var(--technical)` (9 occurrences, block-2-era,
i.e. not legacy shadow residue — an ongoing drift pattern):** `.narrow-record-type` (259),
`.narrow-record-id` (281), `.record-type-context code` (409), `.record-role-chip code`
(435), `.technical-disclosure dt` (460), `code` (481), `.inspector-field-name` (1729),
`.inspector-key` (1749), `.inspector-index` (1756), `.prb-reference-path` (1805) — all use
the literal stack `ui-monospace, "SFMono-Regular", "Cascadia Code", Consolas, monospace`
rather than `var(--technical)` (or, post-migration, `var(--font-technical)`), including
selectors added well after the legacy `:root` block existed. This is a genuine consolidation
target, not legacy shadow.

**Other never-tokenized live literals:** `body { font-family: system-ui, sans-serif; }`
(line 6, live — see §B.3); `.overview-introduction { font-size: clamp(1.15rem, 2.4vw,
1.45rem); }` (983); assorted `min-height` literals (`38px` at 1253, `54px` at 1320, `36px`
at 1431, `42px` at 900) that duplicate or sit near `--tap-min`/`--target-min` (44px) without
using it.

### B.3 Selectors with dead (shadowed) legacy declarations — informational only, no WU036 action required

`index.css` contains two eras of rules: an early "utilitarian workbench" block
(lines 1–644, hard-coded literals, no custom properties) and the `:root`-token "V1" block
(645 onward). Where the same selector is re-declared in both blocks, the later (V1)
declaration wins per normal CSS cascade for any property both blocks set. The pre-line-645
declarations are already fully or partially dead in that case and require **no WU036
migration action** — they are listed here only so WU036 does not mistake a dead
hard-coded literal for a live one requiring a token:

Fully shadowed (dead) selectors: `.manifest-summary` (17→877), `.explorer-navigation`
(38→887), `.explorer-navigation button[aria-current="page"]` (54→923), `.overview-introduction`
(61→978), `.overview-concepts h3` (84→1054), `.overview-problems-heading p` (108→1105),
`.overview-problem-list h4` (129→1139), `.overview-problem-action` (151→1161),
`.overview-corpus-context` (165→1209), `.reading-guide` (464→945).

Partially shadowed (a border/outline **width+style** — e.g. `1px solid` — survives from
block 1 because block 2 only resets the `-color` sub-property on the same selector; the
color itself is always live from block 2, only the width/style is legacy-block residue and
carries no color literal to migrate): `body` (font-family only, see §B.2), `.skip-link`
(22→939), `.explorer-navigation button` (46→896), `.overview-independence,
.overview-trust, .overview-status-explanation` group border (68→1000, and
`.overview-status-explanation`'s own border further at 1082 never resets it),
`.overview-concepts` (77→1046), `.overview-problem-list` (113→1111),
`.overview-problem-list li` (119→1116), `.overview-statuses` (156→1149),
`.records-explorer` (173→1218), `.narrow-records-list` (230→1446), `.narrow-record-row`
(237→1450), `.narrow-record-type` (257→1466), `.narrow-record-label` (272→1474),
`.narrow-record-id` (279→1480), `.narrow-record-chevron` (287→1486),
`.records-controls` (305→1234), `.records-controls label` (312→1243),
`.records-pagination` (357→1423), `:focus-visible` (485→1491, outline width/style only).

These dead/partially-dead literals must not be independently "cleaned up" as part of
WU036 — that would be unrelated cleanup (AGENTS.md §2 Scope control, and the explicit
WU036 prohibition in §F below) unless the same selector is already being touched for a
live-property token migration reason.

---

## C. Migration strategy decision

**Chosen strategy: direct selector rewrites.**

**Rejected alternative: compatibility aliases** (redefining the 36 legacy variable names
in `:root` to reference the DS-04B semantic tokens, e.g. `--ink: var(--color-ink-primary);`,
leaving every consuming selector unchanged).

### Rationale

1. **Value drift makes aliasing lossy, not transparent.** §A.1 shows most mappings are
   *close but not identical* (e.g. `--canvas` `#faf8f3` vs `--color-surface-reading`
   `oklch(97% 0.012 80)`; `--accent` `#1d4341` vs `--color-accent` `oklch(42% 0.13 40)` — a
   materially different hue, not a rounding difference). An alias silently changes the
   rendered value of every one of the 193 selectors in §B.1 in one step with no per-selector
   review point. A direct rewrite makes each selector's new value an explicit, reviewable
   line change.
2. **No 1:1 scale mapping exists for spacing/radius (§A.0/§A.2).** Aliasing requires a
   total function from legacy name to semantic name; `--space-1`, `--space-3`, `--space-8`,
   and `--radius-sm` have no safe target. An alias approach would have to either leave those
   four unaliased (a partial, confusing migration) or force an unsafe mapping. Direct rewrite
   lets each of these four be classified LEAVE_UNCHANGED (§A.0 rows 24-27) on its own terms,
   without inventing a fifth spacing step or reusing a role-mismatched token, and without an
   alias block forcing a premature choice for them.
3. **Two legacy names already collapse to one value (`--ink-faint`/`--ink-faintest`, both
   `#6b675f`) mapping to two distinct DS-04B roles.** An alias must pick one target for each
   name mechanically; a direct rewrite preserves each legacy name's existing selector set as
   its own fixed destination (§A.0 rows 6-7: every current `--ink-faint` consumer to
   `--color-ink-muted`, every current `--ink-faintest` consumer to `--color-ink-faint`),
   rather than collapsing both into a single aliased value.
4. **Aliases would extend the legacy names' effective lifetime indefinitely**, contrary to
   the intent that DS-04B tokens become the single production naming convention (§H).
   Aliasing solves a short-term diff-size problem at the cost of leaving two live naming
   systems (`--ink` and `--color-ink-primary`) permanently addressable in production CSS.

### Migration-risk tradeoff

Direct rewrite touches more lines (193 selectors across `index.css`, versus a ~36-line
`:root` alias block) and is not revertable in a single line-count-bounded diff. This is the
accepted tradeoff: WU036's exact allowed diff is scoped and enumerated in §F precisely
because the selector-by-selector nature of direct rewrites requires an explicit boundary,
not because the risk is unmanaged. Aliasing's lower line-count is not a safety property once
§A.1's value-drift and §A.2's scale-mismatch findings are accounted for — it would only
mask them.

### Temporary compatibility alias after WU036

**None.** No legacy variable name is converted to an alias at any point, before or after
WU036.

This contract is now execution-deterministic (§A.0): every one of the 23 MIGRATE items
has an exact destination and an exact, fully enumerated selector set (§A.0, §B.1); every
LEAVE_UNCHANGED/OUT_OF_SCOPE/DEAD_NO_ACTION item is exempted from migration entirely, not
deferred. There is therefore no "WU036 may not finish the inventory" case left open:
WU036 must implement all 23 MIGRATE items in full and leave every other item exactly per
§A.0 — completion is binary, not partial. If WU036 discovers a legacy `var(--...)`
consumer in `apps/research-explorer/src/**` that is not represented in §A.0/§B.1's
inventory (an unclassified legacy consumer), that is a contract failure: WU036 must stop
and return to the owner for a WU035 amendment rather than improvising a disposition for
it, exactly as §F states.

---

## D. Typography/package contract

- **Public Sans** is the owner-frozen interface-role font family for this migration scope
  (`--font-interface` in `tokens.css:98`, replacing legacy `--ui`'s Inter stack).
- **Source Serif 4** is the reading family (`--font-reading`, unchanged — legacy `--editorial`
  already matches exactly, §A.1).
- **IBM Plex Mono** is the technical family (`--font-technical`, unchanged — legacy
  `--technical` already matches exactly, §A.1).
- **`@fontsource/public-sans` dependency move:** currently listed in `devDependencies`
  (`apps/research-explorer/package.json:30`) despite already being imported by production
  `main.tsx:12-13` since DS-04B/DS-05A. WU036 must move this one line from
  `devDependencies` to `dependencies` in `apps/research-explorer/package.json`. No version
  change, no other dependency entries move.
- **Inter production-import removal (frozen, unconditional per §A.0):** `main.tsx:3-6`
  imports four `@fontsource/inter` weight files for production. §A.0 makes `--ui`
  migration (row 14, all 21 live consumers → `--font-interface`) a mandatory, fully
  enumerated MIGRATE item, not a partial-completion possibility — WU036 must complete
  100% of `--ui` consumers as part of its required scope. WU036 must therefore: (1)
  migrate every `--ui` consumer to `--font-interface`; (2) confirm zero remaining
  production selector resolves to Inter; (3) only then remove the four
  `@fontsource/inter` production imports from `main.tsx`. There is no "phase where the
  import stays because migration is incomplete" case — completion is required, so the
  removal is unconditional on completion, not optional.
- **`@fontsource/inter` package classification (frozen):** once step (2) above is
  confirmed (zero production import/consumer resolves to Inter), WU036 **must** move
  `@fontsource/inter` from `dependencies` to `devDependencies` in
  `apps/research-explorer/package.json`, because its only remaining verified consumers
  are Storybook/development-only: `.storybook/preview.ts:3-6` imports the same four
  Inter weight files, and `.storybook/preview.css`'s `.workbench-smoke` class sets
  `font-family: Inter, system-ui, sans-serif`. This move is required, not optional or
  left to WU036's packaging judgment — the only precondition is confirming zero
  production Inter consumer remains, which is the same confirmation already required for
  the `main.tsx` import removal above. WU036 must verify `storybook build`/`npm run
  storybook` still resolves `@fontsource/inter` correctly from `devDependencies` before
  treating this step as complete (a `devDependencies` package remains installed and
  resolvable in the Storybook dev/build environment; this is a verification step, not an
  open design decision).
- **Escape hatch:** if WU036 discovers any genuine production Inter consumer not already
  represented in this contract's `--ui` inventory (§A.0 row 14, §B.1) — i.e. a
  font-family reference to Inter that this document did not account for — WU036 must
  stop and return to the owner for a WU035 contract amendment. It must not resolve the
  discrepancy by leaving the package classification to implementation judgment.
- Verified: no other production or Storybook file references `Inter` as a font-family value
  beyond `main.tsx` and `.storybook/preview.ts`/`.storybook/preview.css` (checked
  `foundations.css`, `ui.css`, and both `.stories.tsx` files under `styles/` — no live
  `Inter` font-family references found there; earlier substring matches on "Interface"/
  "Interactive" were false positives, verified by exact-string re-check).

---

## E. tokens.css stale-comment correction

**Exact current stale statement** (`apps/research-explorer/src/styles/tokens.css:4-7`):

> "This file is consumed by Storybook only. It is not yet imported by the
> production application (see apps/research-explorer/src/index.css)."

This is contradicted by production fact: `tokens.css` has been imported by
`apps/research-explorer/src/main.tsx:33` since DS-05A (commit `0daf239`), predating WU035.

**Exact replacement wording, to be applied by WU036:**

> "This file is consumed by both Storybook and the production application (imported by
> `apps/research-explorer/src/main.tsx` since DS-05A). Legacy `index.css` still defines
> its own separate `:root` token block; see `docs/design/ds-04b-foundation-consolidation-contract.md`
> for the exact legacy-to-semantic migration mapping and status."

WU036 must not alter any other line of the file header comment (lines 1-3, 8-13) beyond
this replacement of lines 4-7.

---

## F. WU036 implementation contract

This contract is execution-deterministic: §A.0 assigns exactly one disposition
(MIGRATE / LEAVE_UNCHANGED / OUT_OF_SCOPE / DEAD_NO_ACTION) to every one of the 37
inventoried legacy items, and every §B.1 selector's destination is enumerated. **WU036
must implement every item classified MIGRATE and must leave every item classified
LEAVE_UNCHANGED / OUT_OF_SCOPE / DEAD_NO_ACTION exactly according to this artifact.**
WU036 has no open design or scope decision to make within the items this contract
covers. Discovery of a legacy `var(--...)` consumer, an Inter font-family reference, or
any other item in `apps/research-explorer/src/**` during WU036 that is not represented
in §A.0/§B.1/§B.2's inventory is a **contract failure**: WU036 must stop and return to
the owner for a WU035 amendment. WU036 must not improvise a disposition for an
unclassified item under any circumstance.

**Exact files WU036 may change:**

- `apps/research-explorer/src/index.css` — selector-by-selector rewrite of every §A.0
  MIGRATE item's §B.1 consumers to its §A.0-assigned DS-04B semantic destination. No
  change to any §A.0 LEAVE_UNCHANGED/OUT_OF_SCOPE item's selectors, and no removal of
  any §A.0 DEAD_NO_ACTION `:root` declaration except as permitted below.
- `apps/research-explorer/src/styles/tokens.css` — the §E stale-comment correction only. No
  new tokens, no value changes to any existing token.
- `apps/research-explorer/src/main.tsx` — only the unconditional Inter-import removal
  described in §D (required upon confirming 100% `--ui` consumer migration, per §A.0 row
  14), and no other line.
- `apps/research-explorer/package.json` — only the two frozen moves described in §D:
  `@fontsource/public-sans` `devDependencies` → `dependencies`, and `@fontsource/inter`
  `dependencies` → `devDependencies` (the latter upon confirming zero remaining
  production Inter consumer, verified not to break Storybook per §D). No version bumps,
  no other dependency additions/removals, no script changes.
- `apps/research-explorer/package-lock.json` — only the lockfile delta mechanically produced
  by the above two `package.json` edits (via the project's normal install command), never
  hand-edited.

**Exact token/selector changes authorized:**

- Replace each §A.0 MIGRATE item's §B.1 legacy `var(--legacy-name)` occurrence with the
  §A.0-assigned `var(--semantic-name)`, preserving the exact CSS property and selector —
  no property additions, removals, or selector restructuring. This includes the
  selector-fixed-by-legacy-name rule for `--ink-faint`→`--color-ink-muted` and
  `--ink-faintest`→`--color-ink-faint` (§A.0 rows 6-7): no selector may be reassigned
  across these two destinations.
- For the 8 DEAD_NO_ACTION zero-usage variables (§A.0 rows 29-36: `--surface-chip`,
  `--ink-disclaimer`, `--icon-muted`, `--line-control`, `--control-height`, `--space-7`,
  `--space-10`, `--space-11`): WU036 must **not** remove their `:root` definitions
  opportunistically. Removal is permitted only if strictly required as a mechanical
  consequence of an already-authorized MIGRATE change on the same declaration/line (e.g.
  the `:root` block itself is being edited for a MIGRATE item and a dead declaration
  physically cannot remain in a resulting partial edit) — never as independent cleanup.
  If in doubt, leave the dead declaration exactly as-is.
- For the 4 LEAVE_UNCHANGED items (§A.0 rows 24-27: `--space-1`, `--space-3`,
  `--space-8`, `--radius-sm`) and the 1 OUT_OF_SCOPE/LEAVE_UNCHANGED item (§A.0 row 28:
  `--shell-content-max`): WU036 must leave the legacy variable and every one of its
  consuming selectors completely unchanged. WU036 must **not** round or substitute any
  of these to the nearest DS-04B token, and must **not** introduce a new DS-04B-namespaced
  token to close any of these five gaps — that decision is reserved to a future,
  separately authorized work unit, not WU036.
- For the 1 OUT_OF_SCOPE item (§A.0 row 37: undefined `--link`): WU036 must not touch
  `index.css:2568` or otherwise fix the defect.
- For §B.2's hard-coded literals with no legacy variable (hex-colour literals, the
  `ui-monospace` font-family drift pattern, other never-tokenized literals): these were
  never in §A.0's 37-item legacy inventory and remain out of WU036's scope entirely,
  except the one narrow case already stated below (a selector already being edited for
  an in-scope MIGRATE reason may also have its `font-family` corrected to
  `var(--font-technical)` on that same selector).
- `--accent`/`--accent-dark` (§A.0 rows 11-12): the clay-hue change is a required MIGRATE
  item, and WU036 must flag every selector so migrated for WU037's rendered review — this
  is the one mapping with a visible, not just numeric, colour change.

**Tests allowed/required:**

- `apps/research-explorer/npm run typecheck` — required, must pass unchanged (no TS surface
  touched, but CSS class/selector renames must not break any `.test.ts`/`.test.tsx` that
  asserts on CSS text, e.g. `recordDetailLayout.test.ts`'s literal-string assertions against
  `index.css` — verify these before and after).
- `apps/research-explorer/npm run test` (Vitest) — required, must pass unchanged.
- `apps/research-explorer/npm run build` — required, must succeed with no new warnings
  attributable to this change.
- No new tests are required to be added by WU036; this is a token-value migration, not new
  behaviour. If WU036 judges a specific regression risk (e.g. the `--accent` hue change)
  warrants a new assertion, WU036 may add one and must justify it in its own checkpoint;
  this is additive latitude on testing only, not a design/scope decision, and does not
  reopen any disposition in §A.0.

**Explicit prohibitions (WU036 must not):**

- Adopt `apps/research-explorer/src/styles/foundations.css` wholesale (global body/heading/
  link/control rules) — confirmed still excluded per DS-05A's own `main.tsx` comment
  (`main.tsx:26-28`) and [component model](component-model.md) §2.1's Foundation-layer
  boundary.
- Adopt `apps/research-explorer/src/styles/layout.css` wholesale — confirmed still excluded
  per `main.tsx`'s import list (not present) and [component model](component-model.md)
  §2.2's Layout-primitive boundary (`ShellFrame`/`ReadingLayout`/`Stack`/`Cluster`/
  `SectionFlow` remain unauthorized for adoption here).
- Perform any structural, component-boundary, navigation, or layout redesign — every change
  is a property-value substitution on an existing selector, never a selector restructuring,
  new class, removed class (other than the narrowly-conditioned dead-variable removal
  above), or DOM/JSX change.
- Perform unrelated cleanup or refactors — including the §B.3 dead/shadowed legacy
  declarations (explicitly out of scope, no action required or permitted there), the
  undefined `--link` variable (§A.0 row 37, a pre-existing bug, not this migration's
  concern), and the `ui-monospace` literal drift pattern in §B.2 *except* where those
  exact selectors are already being touched for their in-scope `var(--technical)`-eligible
  property (i.e. WU036 may fix `font-family` on a selector it is already editing for
  another MIGRATE reason, but may not open new selectors solely to fix the `ui-monospace`
  drift).
- Introduce any new DS-04B-namespaced token to close a LEAVE_UNCHANGED gap (§A.0 rows
  24-28) — that decision is reserved, not delegated to WU036.
- Leave any MIGRATE item (§A.0) partially migrated, or treat any part of the 37-item
  inventory as optional or deferrable.
- Improvise a disposition for any legacy consumer discovered during implementation that
  is not already classified in §A.0 — stop and return for a WU035 amendment instead.
- Change any file outside the exact list at the top of this section.

---

## G. WU037 verification contract

Primary gate: **production build served via `npm run preview`** (or an equivalent static
production-build server) — never the Vite dev server (`npm run dev`), which does not
reflect production CSS bundling/minification behaviour.

Required checks, all performed against the served production preview build:

1. **Desktop viewport ~1440×900** — full-page rendered review of Overview, Records
   (table + detail), Problem View, and Evidence/Source detail surfaces.
2. **Compact viewport ~360×740** — same surfaces, compact/narrow presentation
   (`<=767px` per [Explorer architecture](../explorerarchitecture.md) §5).
3. **Representative check within the 768–1059px geometry-fallback band** — at least one
   viewport in this range, confirming the existing geometry-only recomposition still
   applies without activating compact typography/navigation (per [foundations.md](foundations.md)
   "Responsive reading" and [component-model.md](component-model.md) principle 7).
4. **Computed-style contrast measurements** — for every selector migrated under the
   `--accent`/`--accent-dark` clay-hue change (§F) at minimum, and for any other migrated
   text/background pairing WU036 flags as a visible change; measure actual rendered
   contrast ratio via computed style, not the token's nominal/authored value.
5. **Keyboard and focus-visible verification** — tab through migrated interactive
   selectors (navigation, records controls, pagination, detail-rail actions, breadcrumb)
   confirming focus-ring visibility and order are unchanged.
6. **Visible-overflow check** — at all three viewport bands above, confirm no unintended
   horizontal page-level overflow was introduced by any spacing/radius value change.
7. **Browser console check** — no new errors/warnings introduced by the build at any
   tested viewport.
8. **Storybook/axe-core evidence** — supplemental corroboration only, never the primary
   gate; Storybook's own Foundation stories may be used as an additional data point but a
   passing Storybook/axe run does not substitute for any of checks 1-7 above.

WU037 must record its findings against this exact checklist; a WU037 checkpoint that
substitutes Storybook-only or dev-server-only evidence for any of checks 1-7 does not
satisfy this contract.

---

## H. Freeze boundary

Every DS-04B numeric/token value referenced in this document (§A.0/§A.1's resolved
values and destinations) **remains a bounded implementation candidate throughout WU035
and WU036**. WU035 does not freeze any of them. This is a distinct question from §A.0's
dispositions: §A.0 freezes *which selectors migrate to which destination token, and
which items are left alone* (execution-determinism, so WU036 has no scope/design
decision left to make); it does not freeze the *numeric value* any semantic token
resolves to today. WU036 may not introduce a new token (§F expressly prohibits this),
but the values of the existing DS-04B tokens it migrates selectors onto remain
implementation-candidate state until this section's three conditions are met.

These values become owner-frozen foundation values for the M010 migration scope **only**
after all three of the following have occurred, jointly:

1. WU036 implementation completes per §F's exact contract;
2. WU037 verification completes per §G's exact contract and produces a PASS result;
3. The repository owner explicitly closes M010.

Prior to all three, any value in this document, in `tokens.css`, or in a migrated
`index.css` selector remains subject to revision without requiring a new WU035-equivalent
reconciliation pass — it is implementation-candidate state, not canonical design fact, per
[foundations.md](foundations.md) "Not yet frozen implementation details" and
[component-visual-contract.md](component-visual-contract.md) "Intentionally
implementation-flexible."
