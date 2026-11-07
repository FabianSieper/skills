# Evaluate every active card

Read for existing-card packets. Before additions are searched, every distinct active
card—including commanders and lands—gets one evaluation. Quantities are preserved
by code; multi-role cards do not become extra physical cards.

```text
deck-research next <run>
deck-research next <run> --packet <packet.json> --response <answers.json>
```

The task is returned directly, and saved at `packet`. Its context fingerprint and
complete Oracle paragraphs are bound to the packet. In compact tasks the paragraphs
occur once in `clauses`, keyed by face:paragraph. Read every paragraph and every
face's characteristics; work through one card at a time.

The compact task includes the full active inventory with quantities. Retrieve
additional partners' complete saved source records with `cards <run> --names
"Exact Card" ...`; this works before role aggregation and avoids a network lookup
or loading the entire sidecar. Name interactions only after checking their sources.

The response template uses `card: "1"`, `"2"`, etc. in packet order. The runner
inserts canonical names and Oracle hashes from the verified packet, expands the
response and applies the full existing validator. Save before accepting it; empty
template fields cannot pass. The legacy `packet`/`accept-batch` commands still
accept full records with exact `name` and `oracle_hash`.

1. **Job:** which specific job does this card perform in this deck? Name its actual
   contribution, not just a generic card category.
2. **Clauses/characteristics:** account for every paragraph, types, body, mana cost,
   alternative costs and activated costs. Check defensive restrictions, self-recursion,
   feedback loops and zone-granted abilities; a body may never need to be cast.
3. **Four states:** before commander, commander present, commander unavailable,
   and behind. State what the card actually does and its relevant limitations.
4. **Realistic synergy:** number of pieces, mana, timing, setup, likelihood of
   concurrent availability and removal response. Use transparent assumptions;
   no invented probability or win-rate score.
5. **Resilience/floor:** standalone value, dead-draw risk, commander dependency and
   ability to rebuild. A high dependency can be intentional, but must be counted.
6. **Interactions:** name affected active cards, quantify nonbos and identify
   critical engine/commander impacts. Weigh opposing-board benefit. Record open
   questions separately; avoid automatic judgments from “one affected card”.

Use ratings `very_low`, `low`, `medium`, `high`, `very_high`. High role compression
requires multiple *needed* jobs, not merely a long Oracle text. Basic lands need a
real sources assessment but no invented Oracle clauses.

Return a JSON list, one object per packet card:

```json
[
  {
    "card": "1",
    "job": "Specific function in this deck",
    "roles": ["graveyard_setup", "commander_protection"],
    "characteristics": "How costs/types/body affect deployment",
    "clause_review": {"0:0": "First paragraph's role and limits", "0:1": "Second paragraph's role and limits"},
    "states": {
      "before_commander": {"rating": "medium", "reason": "..."},
      "with_commander": {"rating": "high", "reason": "..."},
      "without_commander": {"rating": "medium", "reason": "..."},
      "behind": {"rating": "low", "reason": "..."}
    },
    "commander_dependency": "medium",
    "setup_complexity": "low",
    "role_compression": "high",
    "dead_draw_risk": "low",
    "plan_fit": "Mechanism supporting primary/secondary plan",
    "mana_efficiency": "Cost compared with actual output",
    "alternative_costs": "Relevant deployment/activation cost, or none",
    "resilience": "What removal interrupts and what remains useful",
    "preference_fit": "How this matches the recorded user style",
    "interactions": [],
    "rules_questions": []
  }
]
```

For exactly identical ratings **and** explanations across states, write for example
`"without_commander": {"same_as": "before_commander"}`. The saved evaluation still
contains all four explicit ratings and reasons. Distinct timing, prerequisites or
failure modes need separate explanations; a shared rating alone is insufficient.
Keep evidence concise without omitting mechanisms, conditions or lost functions.
When acceptance returns `errors` and `repair_response`, correct only those rows and
resubmit that repair file with the same packet. Valid rows are already saved.

Role vocabulary:
`land`, `ramp`, `mana_fixing`, `cost_reduction`, `card_draw`, `card_advantage`,
`card_selection`, `discard_outlet`, `graveyard_setup`, `graveyard_recursion`,
`graveyard_protection`, `commander_protection`, `board_protection`, `spot_removal`,
`board_wipe`, `countermagic`, `tutor`, `commander_enabler`, `value_engine`, `payoff`,
`combat_enabler`, `finisher`, `utility`.

Interaction shape: `{"cards": ["Exact partner"], "kind": "synergy|anti|neutral",
"reason": "Mechanism, cost and impact"}`. Rule question shape:
`{"id": "short-stable-id", "question": "One precise question"}`.

For every card with a land face also include:

```json
"land": {
  "entry_condition": "Tapped/untapped conditions and timing",
  "fetchability": "Actual basic land types and legal fetch targets",
  "utility": "Non-mana use and its opportunity cost",
  "source_reliability": "When each color is actually available",
  "unconditional_colors": ["U"],
  "conditional_colors": []
}
```

Colors are W/U/B/R/G/C. Count a fetch only for colors of actual fetchable targets
and record activation/tapped constraints. A conditional source is not unconditional
early fixing. MDFCs contribute one physical card, a land option and a spell-side
deployment assessment; evaluate the choice rather than assuming both at once.

After all packets, `next` completes existing coverage and aggregates roles. Coverage, clause
keys, hashes and required fields must pass. Reuse validated packets in the same
context. If the context changed, inspect the old analysis but submit a fresh pass.
