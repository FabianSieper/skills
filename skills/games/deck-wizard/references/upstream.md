# Provenance and maintenance

This package combines the user's existing deck-wizard and local
archidekt-deck-optimizer into one discoverable deck skill. Archidekt navigation
remains a separately installed skill for website actions.

The imported toolkit is the installed snapshot registered to
`https://github.com/dan-blanchard/mtg-skills`, skill path `deck-wizard/SKILL.md`,
folder hash `f2fa9468d03668eee544878b0028c7133ea813b691659e267faa72ef0af09d51`,
installed 2026-11-01. That package declares the 0BSD license. Preserve this
attribution and the source hashes when updating. No upstream HEAD equivalence is
claimed: GitHub access failed during consolidation.

Canonical local source is this repository's `skills/games/deck-wizard`.
`references/origin.json` is generated from the repository catalog.
The new `mtg_utils.research` coordinator reuses the existing format/name/legality
tooling and bulk/sidecar caches. The imported `mtg_utils` modules remain the
implementation of the existing CLIs. This skill's supported workflow is now paper
Commander only; unrelated format guides are removed from the active package.
Historical baseline instructions remain under the repository's verification tree.

Maintenance evidence, baseline instructions and tests live in
`verification/deck-wizard` at repository root. They are deliberately not discovered
as skills. New focused Python tests live inside this package under `tests/`.
