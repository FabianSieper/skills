# Pair changes and challenge them

Read for swaps/review. Choose by needed role, user goal, real synergy and floor.
For each strong addition compare the best existing replacement slot. Do not combine
an independent list of strongest additions with weakest individual cards.

## Replacement test

Name every function lost by the cut, its other actual providers, and the incoming
card's comparable function. Read both complete Oracle texts again. Compare setup,
timing, defensive clauses, activated/alternative costs and behavior without the
commander. Account for existing combos and near-miss partners. Preserve protected
cards and narrow unique jobs identified by diagnosis. Use a candidate's explicit
`function_coverage` to justify replacing a unique function.

Write `proposed_swaps.json`:

```json
{
  "repairs": [],
  "swaps": [
    {"cut": "Current Card", "add": "Candidate Card",
     "reason": "Current Card supplies X under condition A, while Candidate supplies the needed X under condition B and addresses measured gap Y.",
     "lost_function": "All lost clauses/jobs, including the best argument for retaining the cut",
     "remaining_providers": ["Candidate Card", "Existing equivalent provider"],
     "replacement_evidence": "Named providers, actual Oracle mechanisms and conditions",
     "curve_and_mana": "Before/after cost, early plays, colors and deployment",
     "combo_impact": "Existing and near-miss lines retained/lost, with justification"}
  ]
}
```

The reason is one comparative sentence naming both sides. Longer evidence lives in
the remaining fields, not in an unsupported “this is a staple” claim. Each cut/add
appears once. `repairs` contains only necessary unpaired corrections for an initially
wrong deck size; these use the same fields with either add or cut null.

## Provider rules

`remaining_providers` is machine-checked against the final deck:

1. Every named provider exists in the final deck. Cut names drop out of the
   final deck by name set even when other copies remain, so a cut can never
   witness its own replacement.
2. Each provider shares at least one role with the cut.
3. The providers' union covers every non-utility role of the cut.

Roles are the `roles` list of the cut's `deck_card_analysis` entry (and of each
provider) — read them before writing the pair. `cut_pool.json` rows carry the
same `roles` list, so coverage is checkable before drafting. `deck-research
check-plan <run>` reports every violated line at once, and both error messages
name the cut -> add pair plus the uncovered roles.

When the request sets `output.images` (default), final validation requires a
verified HTTPS `image_url` in every swap addition's market record. MTGJSON bulk
imports and the `scryfall-lookup` record shape carry no images, so fill missing
values with `deck-research refresh-images <run> --names "Exact A, Exact B"`
(or `--all`) before final validation; it verifies each URL over HTTP.

Reduce lands only with measured surplus, `diagnosis.minimum_lands` and the actual
post-change mana assessment. Compare lands with lands. Changes may not destroy a
critical role or unique function. Verify each pair alone and the combined proposal:
two individually safe cuts can jointly remove all reliable providers.

Run `complete <run> swaps`.

## Adversarial review

Prefer two small-model tasks: proposer explains the deck-specific improvement;
challenger independently rereads the cut/add Oracle text, evidence and measured
role counts. Give each only the relevant files and 1–4 pairs at a time. Request
observable arguments and citations, not private reasoning traces.

For every pair the challenger supplies the strongest case for keeping the cut,
a realistic failure case for the add, and an alternative (including no change).
Resolve objections against evidence; revise and rerun checks if needed. A review
need not invent disagreement or force a minimum number of rounds. At least one
explicit reconciliation pass is required. If independent agents are unavailable,
perform separate proposer/challenger passes and label that limitation.

Write `strategic_review.json`:

```json
{
  "mode": "independent_agents",
  "models": ["actual configured model IDs"],
  "proposal_digest": "Copy run_state.stages.swaps.outputs.proposed_swaps.json",
  "pairs": [
    {"cut": "Current Card", "add": "Candidate Card",
     "best_case_for_keeping_cut": "...", "failure_case_for_add": "...",
     "alternative": "...", "resolution": "Evidence-based reconciliation", "verdict": "accept"}
  ],
  "whole_deck_plan": "How the combined deck still executes its plan",
  "commander_identity": "Why these cards express this commander's actual mechanics",
  "combo_preservation": "What lines survive or why an unwanted line is removed",
  "mana": "Land/source/curve assessment of the combined plan",
  "user_preferences": "How the final pattern matches the request"
}
```

Use `mode: separate_passes` when that is what happened. Real close calls belong in
the report as choices; unresolved contested pairs do not receive final approval.
A commander replacement is a separate user decision, not an ordinary slot cut.

## Pre-flight

Before `next <run> --complete review`: run `deck-research check-plan <run>` and
fix every finding. Then read output-format.md and perform the supplementary
audits that `next` lists for this phase (mana-audit, deck-stats, combo-search,
proposal-check), reconciling any new findings. After the review is sealed, run
`deck-research validate <run>` once and fix every gate it reports in one pass
(final validation now embeds the combo audit, recorded under `combos` in
`swap_validation.json`), then continue with `next <run>` for report generation.
