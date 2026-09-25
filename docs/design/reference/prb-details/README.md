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
- current reading (`Leitura atual`)
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

1. Canonical PRB/EVD/SRC data — content and semantic authority.
2. Canonical/public presentation mappings — label and meaning authority.
3. The owner-approved final Storybook PRB Details composition — current
   rendered-composition authority.
4. These static HTML references — baseline design artifacts for layout,
   hierarchy, typography, spacing and responsive behaviour, still useful
   where not superseded by the approved Storybook deltas below.

If reference content differs from canonical repository data, canonical data
wins. Public PRB architecture (`Detalhes | Histórico`) is owned by
`docs/explorerarchitecture.md` §3.

The static HTML implementation itself is not a production implementation
contract, and these HTML files are not updated to track the deltas below.

## Approved deltas from the static HTML references

- The standalone selected-evidence "O que sabemos até agora" block is removed.
- `Leitura atual` renders canonical `causal_reading`.
- "O que sabemos até agora" now belongs to each open question and renders
  that question's `latest_result`.
- Open-question fields remain semantically separate.
- No arbitrary EVD subset or ranking is presented.
- The investigation path is vertical at every breakpoint.
- The responsive open-question layout preserves reading order.
- The dossier CTA remains visibly disabled until implemented.
- The audit band is the terminal PRB Details content band before the footer.
