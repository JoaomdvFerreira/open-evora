# Research Explorer Architecture

Canonical architecture and product invariants for the Open Évora Research Explorer.

This document owns **the Explorer system boundary, data flow, read-model role, public navigation model, presentation hierarchy, responsive invariants, and Explorer-specific validation posture**.

Research-data meaning belongs to `docs/datamodel.md`. Repository-wide safeguards belong to `AGENTS.md`. Exact runtime shapes, components, design tokens, and historical design decisions belong to code/tests/Git history.

## 1. Purpose and system boundary

The Research Explorer is a read-only interface for understanding and inspecting governed Open Évora research.

Supported flow:

`canonical research corpus → deterministic data build → static read model → client application`

The Explorer does not author or mutate research state.

It may derive navigation relationships and presentation projections, but it must not maintain independent research state, redefine canonical research semantics, or silently correct canonical records.

Public data generation must respect the publication boundary in `AGENTS.md` before material reaches public static assets.

The current static client-side architecture remains the default. Add backend persistence, server-side search, or another data store only when measured evidence demonstrates a material limit in a supported workflow.

## 2. Read model

The read model is a deterministic derived representation of canonical research data.

Canonical research YAML uses LF line endings as its repository byte contract. The Explorer build also normalizes only line endings at its byte boundary, so logically identical LF and CRLF checkouts produce the same `corpusFingerprint` and LF canonical EVD/SRC download bytes. This operational normalization does not alter parsed record values or research semantics, and it never writes back into `research/`.

`manifest.sourceCommit` is present only when the canonical `research/` corpus represented by the build is clean against that Git `HEAD`. A `null` value means commit provenance is unavailable or not exact; it does not mean the research is invalid. `corpusFingerprint` remains the concrete identity of the generated corpus.

Keep it generic and schema-driven where practical. Canonical references may be projected into navigation/graph relationships without creating new semantic truth.

Runtime types, builders, and tests own the exact read-model shape.

A rendered Explorer projection must use one generated read-model corpus identity. Record details carry the manifest's `corpusFingerprint`; if a fetched detail belongs to another identity, the provider fails closed and requires an explicit page reload. This generated publication identity is operational provenance, not research currentness. When deployment skew removes a lazy-loaded asset, the Explorer offers the same explicit reload recovery.

The Explorer must expose canonical research record types from `docs/datamodel.md`; it must not preserve or invent deprecated record types independently.

Prefer adapting the projection over changing the architecture when the existing architecture remains sufficient.

## 3. Primary navigation

Primary public concepts are:
- Overview;
- Records;
- Problem context.

Records supports corpus-level discovery and inspection.

Problem context is the primary place for understanding a civic problem and the state/history of its investigation.

Graph capability may remain implemented but is currently deferred as a primary public surface.

All research semantics come from `docs/datamodel.md`; this section owns only their Explorer presentation.

### 3.1 Problem context views

The public Problem context has exactly two views:

- `Detalhes`;
- `Histórico`.

### 3.2 `Detalhes`

`Detalhes` is the primary public Problem reading and verification surface. It answers:

- What is this problem?
- What is the current canonical reading?
- What remains unresolved?
- How did the investigation reach this formulation?
- How can the research be inspected and audited?

Composition order:

`problem identity / statement → investigation state + scope → Leitura atual → open questions → investigation path → evidence/audit layer`

The semantics of the PRB fields it presents (`problem_statement`, `causal_reading`, `investigation.open_questions[]` fields, `investigation.path`, `updated_at`, currentness) are owned by `docs/datamodel.md` §3 "Problem reading and investigation semantics". Explorer-specific presentation invariants:

- `Leitura atual` renders canonical `causal_reading`;
- the view performs no arbitrary selected-evidence or "top evidence" synthesis;
- open-question fields (`latest_result`, `why_open`, `resolution_condition`, `current_action`, `evidence[]`) remain distinct in presentation; per-question current knowledge comes from that question's `latest_result`;
- `updated_at` is presented as edit metadata, never as investigation currentness;
- free-text tokens such as `WATCH` are presented as text, not as structured posture;
- the investigation path is presented as narrative, not as progress, completion, or current/pending state;
- audit presentation does not invent Evidence ranking or strength.

The page title uses the page-composition heading level consistent with the global Explorer heading hierarchy.

Canonical content that belongs only to the earlier Problem presentation (for example the per-Evidence list, decision-basis prose, recent-history summary, and affected-populations blocks) is not foreground content in `Detalhes`. It remains in the corpus and inspectable through generic Record Detail in Records; it must not be re-added to `Detalhes` without an owner decision. The audit layer's "open the N records" action opens an on-demand modal drawer listing every Evidence record linked by the resolved Problem projection, in projection order and without ranking; each entry opens generic EVD Record Detail. The drawer changes no URL, loads no data, and is not a Problem-local view.

#### Problem dossier projection

The downloadable Problem dossier has a dedicated data boundary:

`ProblemProjection → PrbDossierData → React-PDF renderer → browser download`

`PrbDossierData` is a pure, deterministic, JSON-serialisable projection of the already-resolved Problem projection (PRB, linked EVD in projection order, and their SRC de-duplicated by canonical ID). It fetches nothing, is independent of the `Detalhes` presentation data, carries canonical values and enum codes as authored (unauthored optional content stays absent rather than fabricated; explicit `false` is preserved), and produces no ranking, score or derived research state. It carries an explicit contract version and no generation timestamp: identical input yields identical output.

It performs no document generation. The renderer layer owns presentation labels, formatting, layout and generation metadata: the generation timestamp, publication `sourceCommit` when available, and `corpusFingerprint`. These identify the corpus/build provenance of the portable PDF; they are publication metadata, not canonical research fields.

#### Problem dossier PDF

Expensive React-PDF generation runs in a dedicated browser module Worker; main-thread interaction, busy state, download and notifications remain separate. Rendering stays client-side and lazy-loaded, with no server dependency.

The `Detalhes` dossier action ("Descarregar dossiê (PDF)") generates an A4 PDF entirely in the browser from the current Problem's `PrbDossierData` and downloads it as `open-evora-<PRB-ID>-dossie.pdf`. Invariants:

- the renderer consumes only `PrbDossierData` plus generation metadata (the generation timestamp captured once per generation, publication `sourceCommit` when available, and `corpusFingerprint`, all used only as audit metadata); it never loads data, reads files, inspects the page DOM, or uses website CSS, and it never re-derives or extends the dossier projection;
- labels, dates and topic names come from the shared PT-PT presentation authorities; canonical order is preserved; absent content omits its section or field rather than printing placeholders; explicit `false` renders as such; no ranking, score, strength or confidence is produced;
- source access, availability, reuse permission and the Open Évora last-check date stay separate; the last-check date is never presented as validation, currentness or authority;
- the document contains real selectable text, clickable canonical references and in-document links, and no prototype or development commentary;
- the PDF engine is loaded on demand when the action is used, never as part of the initial Explorer bundle; success is reported only after a PDF Blob exists.

`@react-pdf/renderer` is the chosen production dependency: it provides client-side, PDF-native document layout with pagination, selectable/searchable text and hyperlinks, with no DOM-print and no server dependency. The PDF uses the Explorer's own self-hosted typefaces (bundled @fontsource files, never fetched from a font service).

### 3.3 `Histórico`

Presents the optional authored material-change history of the selected Problem from canonical PRB `history[]`, newest first. It must not fabricate entries. Absence of history does not mean the Problem never changed. It is a read-only projection of PRB history, not a snapshot/version-control or audit-log system.

Explorer presentation invariants:

- it shares the public PRB local header and identity hero with `Detalhes` (one implementation);
- each entry renders only its authored fields (`date`, `summary`, `state_changes`, `evidence`); an exact date may carry a presentation-only relative age;
- no entry type/category or current/in-force state is derived from summary text, entry order, or date;
- `Verificar` navigates to the same Problem's `Detalhes` audit layer, since `Histórico` has none of its own.

### 3.4 Problem-local navigation

- Public Problem-local navigation has exactly `Detalhes | Histórico`.
- It is navigation (`<nav>` with current-page semantics), not an ARIA tabs widget.
- Generic Record Detail is a technical/corpus inspection capability, not a third Problem-local view; generic PRB inspection remains available through Records.
- Graph is not a Problem-local view.

### 3.5 Terminal composition

- The `Detalhes` evidence/audit band is the final content band before the public footer.
- The `Histórico` material-history section is likewise its final content band before the public footer.
- The Records landing's pagination row is likewise its final content band before the public footer.
- EVD Record Detail's `Origem e auditoria` band is likewise its final content band before the public footer.
- SRC Record Detail's `Acesso e auditoria` band is likewise its final content band before the public footer.
- SRC Record Detail's terminal `Acesso e auditoria` band exposes canonical access/licensing plus Source acquisition and persistent identity where authored.
- The global manifest/corpus-generation summary is not appended after `Detalhes`, `Histórico`, the Records landing, EVD or SRC Record Detail. Other Record Detail types and Graph may retain it.
- Corpus-generation timestamps are never presented as investigation currentness.

## 4. Records presentation

The public header entry `Registos` opens the complete, unfiltered Records area (`Todos`) and stays current throughout it — every type filter and Record Detail.

Records should be compact and scannable:
- the canonical ID leads each row as the stable citation key, in restrained technical type;
- the human-readable title is the visually primary text;
- record type is carried by the type filters and the ID prefix, not a separate column;
- full technical inspection available in Record Detail without dominating first reading.

Generic Record Detail, reached through Records, is the technical/corpus inspection surface for every record type, including PRB.

## 5. Responsive and accessibility invariants

Responsive boundary:
- compact: `<= 767px`;
- desktop: `>= 768px`.

`360px` is a compact QA viewport, not another breakpoint.

Preserve essential content, keyboard/focus behaviour, and semantic HTML. Avoid unintended page-level horizontal overflow or sticky navigation obscuring target content.

Problem `Detalhes` responsive invariants:
- semantic content and order are preserved at every width;
- wider layouts may use independent columns only where reading/DOM order remains correct;
- narrower open-question layouts use one readable flow;
- the investigation path remains vertical at all supported widths.

Production code owns exact design-token and component values.

## 6. Visual validation

Explorer validation is proportional to change materiality.

Material visual, responsive, layout, or navigation changes require rendered review at:
- a representative desktop viewport;
- a compact viewport around `360px`;
- affected breakpoint boundaries when breakpoint-sensitive.

When an approved visual reference exists, rendered/browser comparison is the primary visual gate.

Approved references own the intended rendered composition, hierarchy, typography, spacing, density, surfaces, and responsive treatment for the surfaces they cover. Deviate only for a concrete semantic, accessibility, or technical reason.

For PRB `Detalhes`, the approved reference is the owner-approved Storybook composition; the static HTML references under `docs/design/reference/prb-details/` remain baseline artifacts where not superseded by its recorded deltas.

Minor non-visual changes do not require a full visual-review cycle.

For SRC Record Detail, the approved references are the owner-approved 1440/1024/768/360 editorial targets; its Storybook review stories render the production composition against the generated read model.

## 7. Performance posture

The static client-side architecture has been validated at corpus sizes materially above the current dataset without a demonstrated architectural cliff in supported workflows.

Treat performance measurements as evidence. Do not introduce architectural complexity pre-emptively.

## 8. Contribution handoff

The public contribution form remains client-only and hands prepared content to GitHub; prefilled navigation is used only within the Explorer's bounded URL safety policy, while long or failed handoffs retain the exact prepared title and body in a recoverable inline fallback. The Explorer never reports a contribution as submitted.
