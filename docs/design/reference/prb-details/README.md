# PRB Details — approved visual reference

Approved visual reference for the public Open Évora PRB Details view.

This design applies to all Problem records (PRB), not specifically PRB-0005.

PRB-0005 is used only as the representative reference fixture because it
exercises a sufficiently rich combination of canonical data.

## Scope

The reference defines the visual and responsive architecture for the generic
PRB Details view, including:

- PRB navigation
- editorial hero
- investigation state and scope
- current knowledge/evidence
- open questions
- investigation path
- verification and audit layer

The implementation must work for any canonical PRB and must not contain
PRB-0005-specific logic.

## Reference fixture

The rendered HTML uses PRB-0005 content solely as a design fixture.

Do not infer that:
- every PRB has the same number of questions;
- every PRB has four displayed knowledge items;
- every PRB has the same effects or research roles;
- every PRB has the same investigation-path content;
- every field shown for PRB-0005 is necessarily populated for every PRB.

## Authority

1. Canonical PRB/EVD/SRC data — content and semantics
2. Existing presentation mappings — public labels
3. These HTML references — layout, hierarchy, typography, spacing and
   responsive behaviour

If reference content differs from canonical repository data, canonical data
wins.

The static HTML implementation itself is not a production implementation
contract.