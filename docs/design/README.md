# Research Explorer design

`docs/design/` is the canonical repository home for human-approved Research Explorer visual direction and foundation decisions. It owns design intent and visual relationships; it does not redefine research semantics, Explorer architecture, or production implementation contracts. Those remain with their existing canonical owners.

Approved Claude Design artefacts are review evidence and design inputs. Human approval promotes their decisions into this directory; the artefacts themselves do not become production specifications. [The approved foundations](foundations.md) state the durable design intent, while production code and tests own the implemented components, tokens, and behaviour. A material conflict with [Explorer architecture](../explorerarchitecture.md) or research-data semantics must be reported rather than reconciled here.

The current direction is **DS-02 / Gate B: PASS — Warm Ledger, Reading First**. The Research Explorer is primarily a reading and research interface. Readability, information hierarchy, accessibility, and consistency take precedence over visual novelty; colour is restrained and supportive.

Changes follow this flow:

1. Produce or revise design evidence.
2. Obtain an explicit human gate decision.
3. Record only the approved durable decisions in `docs/design/`.
4. Implement them in production code and validate the rendered result against the approved reference.

New evidence can prompt review but cannot silently change an approved foundation. Historical prototypes, including material under `docs/design/research-explorer-prototype/`, remain useful references to earlier decisions; they are not current design authority.
