# Research Explorer design

`docs/design/` is the stable home for approved Research Explorer design contracts and their supporting evidence. It owns design intent and approved visual relationships; it does not redefine research semantics, Explorer architecture, or production implementation contracts.

## Authority hierarchy

- [Foundations](foundations.md), [component model](component-model.md), and [component visual contract](component-visual-contract.md) are the current canonical design contracts. Each owns the topic named by its document.
- [Reference](reference/) contains explicit human-approved rendered visual evidence for implementation and comparison.

Explorer and research canonical documents retain ownership of product and research semantics. Production code and tests own eventual implementation details, including React APIs, CSS architecture, tokens, and deterministic behaviour. A material conflict with [Explorer architecture](../explorerarchitecture.md) or [research-data semantics](../datamodel.md) must be reported rather than resolved in this directory.

Claude Design artefacts are visual evidence and design inputs. They do not override canonical research semantics, Explorer architecture, or production implementation contracts. Explicit human approval is required before a durable decision is recorded in a current contract or an artefact enters `reference/`.
