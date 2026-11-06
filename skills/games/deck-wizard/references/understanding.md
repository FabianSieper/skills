# Understand the deck before searching

Read when `status.next` is understanding. Inputs: request, active deck, complete
card data. Save a concise, falsifiable `commander_model.json`; no replacement-card
names are needed in this phase.

1. Read every commander clause and its characteristics. Identify zones, costs,
   timing limits, trigger conditions, targets and restrictions. Verify commander
   eligibility; two commanders require an actual compatible pairing rule.
2. Explain the causal plan: setup → enabler → engine → payoff → win. Distinguish
   delivering cards/resources to a zone from having useful cards in that zone.
3. Describe the primary plan and genuine backup plan, expected deployment sequence,
   mana/resource constraints, and how the deck resumes after commander removal.
4. Map meaningful interactions using named active cards and typed edges
   (`synergy`, `anti`, `neutral`). Each edge needs its mechanism and prerequisites.
   Graph degree is a navigation aid, never a strength ranking.
5. Predict behavior without the commander, after a removal spell and while behind.
   Include actual failure modes. Compare predictions with the user's stated games
   when available; ask a focused question only if the answer changes the strategy.
6. List unresolved rule questions. Consult current rulings/Comprehensive Rules for
   assumptions the whole deck depends on now; candidates receive another isolated
   rules review later. Mark assumptions clearly rather than treating them as facts.

For copy/transform/zone-changing commanders, distinguish characteristics, counters,
external continuous effects, created effects, attached permanents, retained
commander abilities and abilities already on the stack. Analyze the actual event:
a new object after a zone change differs from changing characteristics of the same
object. Do not generalize a ruling from one commander to another.

For multiplier commanders, record realistic low/high trigger counts, opponents,
mana and board prerequisites. Compute output at those assumptions and the baseline.
An extra trigger is not automatically available; summon timing, attack restrictions,
once-per-turn clauses and removal can change the result.

Schema (all narrative fields are nonempty strings; `none, because ...` is valid):

```json
{
  "primary_plan": "...",
  "secondary_plan": "...",
  "win_conditions": "...",
  "setup_sequence": "...",
  "recovery_plan": "...",
  "bottlenecks": "...",
  "realistic_resources": "...",
  "user_alignment": "Confirmed goals and explicitly stated assumptions...",
  "commander_legality_evidence": "Current legalities plus actual eligibility/pairing evidence...",
  "commander_clauses": {"Canonical Commander Name": {"0:0": "What this Oracle paragraph does and requires"}},
  "interactions": [
    {"cards": ["Active card A", "Active card B"], "kind": "synergy", "reason": "Mechanism and prerequisites"}
  ],
  "predictions": {"without_commander": "...", "after_removal": "...", "behind": "..."},
  "rules_questions": [{"id": "timing-1", "question": "One exact unresolved interaction question"}]
}
```

Use the exact clause keys in `card_data.json`; include every commander paragraph.
For two commanders include a `rules_questions` entry with ID `commander-pairing`;
the final plan requires its verified rules evidence.
For no open rules questions use `[]`. Save sources under `evidence/`.
Run `deck-research complete <run> understanding`. Completion means the plan can be
explained through specific cards, costs, transitions and failure cases. A generic
label such as “graveyard value” alone is insufficient.
