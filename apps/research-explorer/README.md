# Open Évora Research Explorer

Read-only visual exploration tool for the canonical research corpus (`research/`). See `docs/architecture/ADR-001-research-explorer-architecture.md` and `docs/architecture/research-explorer-read-model-spec.md` for the accepted design; this file only covers what RE-01 (the canonical data adapter) actually added.

## Generate the read model

```
node apps/research-explorer/scripts/build-data.js
```

Reads canonical data from `research/` via `tools/validate-research.js#validateResearchTree()` (no second YAML parser), transforms it into the Explorer read model, and publishes it to `apps/research-explorer/generated/` — gitignored, disposable, never a source of truth. No UI, backend, or database is involved; RE-01 is the data-build step only.

## Fail-closed behaviour

The build aborts, with no change to any previously published `generated/`, whenever:

- `validateResearchTree()` reports any canonical validation error (broken reference, missing required field, invalid enum, etc.) — the raw errors are printed and nothing is written;
- the read-model integrity check finds a dangling edge (a reference resolving to an ID not present in the corpus) — this should be impossible after `validateResearchTree()` passes, and is treated as an adapter defect if it ever fires;
- a post-write check, re-reading the freshly generated files on disk, finds a mismatch (record-count mismatch, duplicate ID, missing `record-detail` file, dangling edge in the written `edges.json`).

Publishing itself is atomic: the full read model is built into a fresh temporary directory first; only after every check above passes does it replace `generated/`, via a two-step rename (old → backup, temp → live) so the swap is safe on Windows. Any failure before or during the swap leaves the previous `generated/` untouched and cleans up its own temporary/backup directories.

## Read-model version and corpus fingerprint

`manifest.json` carries two independent identifiers:

- `readModelVersion` — versions the generated-file *shape* (this contract), independent of canonical research schema versions. See the read-model spec's versioning note.
- `corpusFingerprint` — a SHA-256 hash over every canonical record actually included in the build, in stable order (schema prefix ascending, then record ID ascending), computed from each record's `type`, `id`, and the exact raw bytes of its canonical YAML file. Two builds of identical canonical input always produce the same fingerprint; any canonical content change changes it. `generatedAt` and `sourceCommit` are excluded — they are operational metadata only and do not affect the fingerprint or any structural ordering.

`sourceCommit` (git `HEAD`) is included when available but never required — the build succeeds identically outside a git checkout or without git installed.

## RE-01 tests

```
node apps/research-explorer/scripts/build-data.test.js
```

Zero-dependency (Node's built-in `assert`/`fs`/`os`/`path`), matching `tools/test-analytical-foundation.js`'s convention. Fixtures are generated into a fresh temp directory per test; nothing touches the real `research/` corpus.

## Application (RE-02A+)

One-time setup: `npm install` inside `apps/research-explorer/` (the app owns its own dependencies — React, TypeScript, Vite, TanStack Table, Vitest — kept isolated from the repository's zero-dependency root/`tools/` tree).

From the repository root:

- `npm run explorer` — generates the read model (RE-01), then starts the Vite dev server.
- `npm run explorer:build` — generates the read model, typechecks, runs the app's tests, then builds the static production app. Runs TypeScript typecheck **exactly once** (`tsc --noEmit`) as its own pipeline step — the app's own `npm run build` script (`vite build`) deliberately does **not** re-run it. If you run `npm run build` standalone inside `apps/research-explorer/` (bypassing the root command), run `npm run typecheck` first — it is not folded into `build`.

Both root commands are plain `npm --prefix` delegation — no npm workspaces, no monorepo tooling.

Generated read-model data is served as static assets via Vite's `publicDir` (`vite.config.ts`), in both `npm run dev` and `npm run build` — never copied into a second, manually-maintained tree. The app never reads canonical `research/**/*.yaml`, and it targets a configurable `base` path (`VITE_BASE_PATH`, defaulting to `/`) so a future sub-path deployment needs no code change.

## Vercel deployment (Preview readiness)

This is deployment-*readiness*, not a public-deployment approval — see the roadmap's RE-07 gate (`docs/architecture/research-explorer-roadmap.md`) and the [Data Publication and Agent Safety Policy](../../docs/governance/data-publication-and-agent-safety.md): a passing build is not a privacy/licence/accessibility/content review.

The repository root's `vercel.json` pins the settings a Vercel project needs; an operator creating the project should still confirm they match what's shown in the dashboard:

| Setting | Value |
| --- | --- |
| Root Directory | repository root (`/`) — required so the build can read canonical `research/` and `tools/` outside `apps/research-explorer/` |
| Install Command | `npm ci --prefix apps/research-explorer` |
| Build Command | `npm run explorer:build` |
| Output Directory | `apps/research-explorer/dist` |
| Node.js Version | project reads `engines.node` (`24.x`, required by Vite 8) from the root `package.json`; no separate Vercel setting needed |

No rewrites/redirects are configured because Explorer navigation is query-string state on a single `/` route (`useExplorerUrlState.ts`) — every view (`?view=records`, `?view=records&id=...`, `?view=problem&id=...`, etc.) resolves to the same static `index.html`/entry and needs no server-side rewrite.

**Environment variables:** none are required for a root-hosted deployment. `VITE_BASE_PATH` only needs to be set for a future sub-path deployment (e.g. under a path prefix); leave it unset for root hosting, where it defaults to `/`.

**Fonts:** `@fontsource/*` packages self-host Inter, Source Serif 4, and IBM Plex Mono as build assets — there is no runtime Google Fonts dependency.

**Workflow:** deploy to a Vercel **Preview** environment first (e.g. by opening a PR against this branch/repo) to review the public research corpus rendering before any Production promotion. This document does not claim a public Production URL exists.
