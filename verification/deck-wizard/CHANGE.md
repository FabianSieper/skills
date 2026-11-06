# Deck Wizard consolidation

State: implemented and installed locally on 2026-11-06. The merged source is in
this repository. The old `deck-wizard` and `archidekt-deck-optimizer` installations
were backed up and replaced; `archidekt-navigation` is unchanged.

Base: repository commit `803319a6f6ea8c0d3c4d40b0b8f72256d33284e8`.
Source: installed snapshot registered to `dan-blanchard/mtg-skills`, package license
`0BSD`, plus the user's local Archidekt optimizer. Upstream network access was
unavailable; no claim of matching current upstream HEAD. Original instructions
and file hashes are retained under `baseline/` for comparison.

## Intended changes and regression criteria

1. One discoverable deck skill; website manipulation stays in archidekt-navigation.
2. Commander research resumes from content-checked artifacts, not conversation memory.
3. Every active card, all Oracle clauses and four board states are evaluated before
   candidate search. Packet size defaults to 8 and cannot exceed 12.
4. Unknown categories, missing names, wrong deck identity and incomplete external
   exclusion lists block dependent phases. An exclusion overrides an active category.
5. Commander/sideboard/parked quantities are separate; multiple categories never
   duplicate a card. Printings aggregate; partner commanders are supported.
6. Candidate filters cover aliases, Oracle identity, legality, color identity,
   price freshness, currency, budget and user/external exclusions.
7. Cuts are compared within roles; unique critical functions and protected cards
   survive. Land options and printed lands are counted separately.
8. Complex rules require citations and resolved questions. Final swaps include
   the lost function, replacement evidence and individual plus cumulative checks.
9. Modified goals, deck, Oracle data, exclusions, budgets and output settings
   invalidate only their dependent artifacts; missing/corrupt receipts never pass.
10. Existing constructed/Arena/limited/build workflows and tool interfaces remain
    available through branch-specific references. Foundation rules/tests are intact.

## Evaluation scope

Local deterministic regression tests and existing repository checks pass. GPT-6
Luna performed two review passes and a bounded synthetic packet test. A broad paired
baseline/candidate model benchmark was not run. See VALIDATION.md for the actual
scope; these results do not establish universally excellent small-model quality.
