# Research Explorer design foundations

Status: **APPROVED** — DS-02 / Gate B PASS

Selected direction: **Warm Ledger — Reading First**

This document owns the approved visual relationships for the Research Explorer design foundation. It does not define components, React APIs, CSS custom properties, or implementation tokens. Production code and tests own exact implementation details; [Explorer architecture](../explorerarchitecture.md) continues to own product and responsive invariants.

## Approved foundation decisions

### Reading First

The Research Explorer is primarily a reading and research interface. It must help people understand research content before exposing decoration or technical detail. Readability, information hierarchy, accessibility, and consistency take precedence over visual novelty.

Typography and whitespace should establish grouping and hierarchy before additional containers or colour are introduced. Technical identity remains available, but human-readable meaning leads the reading path.

### Typography roles and reading hierarchy

Three type roles remain semantically distinct:

- serif is the reading voice for headings and sustained prose;
- sans serif is the interface voice for navigation, labels, metadata, supporting text, and controls;
- monospace identifies technical identifiers, not general emphasis.

The hierarchy must preserve clear differences between titles, section headings, body prose, supporting text, metadata labels, and technical identifiers. Body text, metadata, and other essential reading text must not shrink merely to make content fit. Headline typography may use an explicit responsive step when comfortable wrapping requires it.

The current visual candidates are Source Serif 4, Public Sans, and IBM Plex Mono. Their adoption and exact typographic settings are not yet frozen.

### Reading measure

Sustained prose uses a deliberate, readable measure rather than inheriting arbitrary container widths. Supporting text and metadata may use a shorter measure appropriate to their role.

The existing desktop reading geometry remains valid when the available frame can accommodate it: a 720px reading column, a 44px gap, and a 216px supporting rail. This geometry is a layout relationship, not authorization to shrink essential text to make the composition fit.

### Colour and contrast intent

Warm, paper-like neutrals and clear ink tones establish the main reading surface. Accent and status colours are restrained and supportive rather than dominant.

Colour must never carry semantic meaning alone. Status, state, and interaction cues require a non-colour signal such as text, structure, or another accessible indicator. Essential and secondary text must provide accessible contrast with useful resilience; muted treatment must not make task-essential information difficult to read.

### Spacing and rhythm

Spacing communicates relationships: smaller intervals bind closely related content, while larger intervals separate sections or changes in content type. A consistent vertical rhythm should make the relationship between headings, prose, metadata, and supporting material legible without relying on boxes or rules.

### Surfaces and separators

Whitespace, typography, and restrained separators are preferred over unnecessary cardification. Ordinary adjacent content is not boxed by default.

Distinct surfaces are appropriate when they communicate a real boundary, such as an interactive or stateful unit, an unavailable or empty state, or a methodology or caveat aside. Borders and background fills support that structure; they do not substitute for hierarchy.

### Identifier and status principles

Identifiers and statuses may share visual primitives where that improves consistency, but their distinct research dimensions and semantics must not collapse into one another. A technical identifier remains identity; a status remains a human-readable state or posture.

Status presentation must include explicit text and must not rely on colour alone. Identifier text remains legible and technically distinct without dominating the human-readable subject.

Synthetic design content must use unmistakably synthetic identifiers such as `PRB-XXXX`, `EVD-XXXXXX`, or `SRC-XXXX`. Canonical identifiers may appear only with their canonical content.

### Interaction and focus

Links must be visibly identifiable without depending on hover or colour alone. Interactive elements require clear, consistent keyboard focus indication. Focus treatment and interaction states must remain perceptible against the restrained palette and preserve the Explorer's existing keyboard and semantic behaviour.

### Responsive reading

The existing responsive model remains valid:

- compact at 767px and below;
- desktop at 768px and above;
- 360px as a compact QA and stress viewport, not an additional breakpoint.

The product boundary remains compact at 767px and below and desktop at 768px and above. Within the desktop product range, the approved 720/44/216 reading composition applies when the available frame can accommodate it. The existing 768–1059px geometry-only fit fallback may recompose the reading layout into one column; it does not activate compact typography or navigation and does not create a third product breakpoint. Compact presentation also recomposes the reading layout into one column, with supporting rail content placed in flow. Recomposition changes measure and layout, not the importance or legibility of the content. Body text, metadata, status text, and other essential reading text must not shrink to force the two-column composition to fit; headlines may use an explicit responsive size step.

## Not yet frozen implementation details

The following remain provisional and require implementation work, rendered validation, and human review before they become production facts:

- final font-family selection; Source Serif 4, Public Sans, and IBM Plex Mono remain the current candidates;
- exact font sizes, weights, line heights, letter spacing, and responsive headline values, including whether any proposed minimum size is sufficient across the full corpus;
- the precise sustained-prose ceiling, including 68ch versus 72ch, and exact supporting-text measures;
- exact colour values and the final accent/status palette;
- numeric contrast ratios, which must be measured against final implementation colours and rendered text;
- exact spacing values or scales, separator weights, radii, borders, and other surface details;
- status glyphs or icons, identifier/status variants, and whether particular states require visually distinct treatments;
- exact link-decoration and focus-ring measurements;
- whether the desktop metadata rail should ever become inline for shorter records; this remains deferred by DS-03A / Gate C1;
- exact React APIs, implementation file structure, CSS class/custom-property names, and token names or values. Approved component and layout boundaries are owned by [the DS-03A component and layout contract](component-model.md).

These open details must not be inferred from the approved Claude Design HTML or from historical prototypes. They remain candidates until separately implemented, validated, and approved.
