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
Run `complete <run> review`, then `validate <run>`.
