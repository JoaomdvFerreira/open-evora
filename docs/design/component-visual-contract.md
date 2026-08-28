# Research Explorer component visual contract

Status: **APPROVED — DS-03B / Gate C2 PASS**

This document is the durable canonical summary of the approved DS-03B component visual contract. It is derived from the [approved component catalogue](reference/components/ds-03b-component-catalogue.dc.html), which remains rendered reference evidence rather than a production specification.

## Authority boundaries

- [Foundations](foundations.md) owns foundation principles.
- [Component model](component-model.md) owns architecture, component, and layout boundaries.
- This document owns the approved component visual relationships from Gate C2.
- Production code and tests own eventual implementation details.
- [Explorer architecture](../explorerarchitecture.md) and [research-data semantics](../datamodel.md) continue to own product and research semantics.

## Approved relationships

- Reading First remains the governing objective. Serif serves editorial reading, sans serif the interface, and monospace technical identifiers.
- Links are underlined at rest. Native interactive elements share a visible keyboard-focus treatment.
- Separators and surfaces use a bounded grammar; ordinary adjacent content is not boxed by default.
- Where the available desktop frame accommodates it, the reading relationship is 720 main / 44 gap / 216 rail. Responsive behaviour recomposes rather than shrinking essential reading content.
- Identifier, record type, validation status, evidence status, Problem lifecycle status, PRB→EVD effect, and research role remain separate semantic/domain dimensions. Shared inline-label visual anatomy is permitted only when it does not collapse those meanings.
- Effects and research roles belong to presentation of a PRB→EVD relationship, not to an EVD intrinsically. `evidence_status` belongs to a Problem’s investigation state, not to an individual EVD.
- Captioned compact PT-PT status forms remain distinct from full standalone public labels.
- A Problem evidence list contains EVD records. Source provenance remains a separate presentation.
- Status always has explicit text: colour and glyph reinforce meaning but never carry it alone. Technical inspection shows raw canonical values.
- `ProgressMessage`, `ErrorNotice`, and `EmptyState` remain visually and semantically distinct treatments.
- Rail and compact section indexes may have different visual and semantic shapes. Static labels do not gain invented interaction states.

## Intentionally implementation-flexible

Gate C2 does not freeze exact font sizes, weights, or line heights; final font adoption; exact colour values or measured contrast; focus measurements, radii, or border weights; precise inline-label anatomy, tints, or effect arrow; caption placement; the 68ch versus 72ch reading ceiling; status glyph set; compact-index list versus disclosure; or short-record rail behaviour, which remains deferred by Gate C1.

These details require implementation, validation, and any further approval appropriate to their scope. They must not be inferred as frozen merely because they appear in the approved rendered artefact.
